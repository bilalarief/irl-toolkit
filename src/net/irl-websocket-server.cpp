#include "net/irl-websocket-server.hpp"

#include "protocol/irl-protocol.hpp"

#include <QJsonDocument>
#include <QJsonObject>

#include <obs-module.h>
#include <plugin-support.h>

#ifdef HAS_QT_WEBSOCKETS
#include <QWebSocket>
#include <QHostAddress>

IRLWebSocketServer::IRLWebSocketServer(QObject *parent) : QObject(parent)
{
	server = new QWebSocketServer(QStringLiteral("IRL Toolkit"), QWebSocketServer::NonSecureMode, this);
	connect(server, &QWebSocketServer::newConnection, this, &IRLWebSocketServer::onNewConnection);
}

IRLWebSocketServer::~IRLWebSocketServer()
{
	stop();
}

bool IRLWebSocketServer::start(quint16 port)
{
	if (server->isListening())
		server->close();

	listenPort = port;
	bool ok = server->listen(QHostAddress::Any, port);
	if (ok) {
		obs_log(LOG_INFO, "WebSocket server (QtWebSockets) listening on ws://0.0.0.0:%u", port);
	} else {
		obs_log(LOG_ERROR, "WebSocket server failed to listen on port %u: %s", port,
			qPrintable(server->errorString()));
	}
	return ok;
}

void IRLWebSocketServer::stop()
{
	if (server->isListening())
		server->close();
	for (auto *c : clients) {
		c->close();
		c->deleteLater();
	}
	clients.clear();
}

bool IRLWebSocketServer::isListening() const
{
	return server && server->isListening();
}

int IRLWebSocketServer::clientCount() const
{
	return clients.size();
}

void IRLWebSocketServer::onNewConnection()
{
	QWebSocket *socket = server->nextPendingConnection();
	if (!socket)
		return;

	obs_log(LOG_INFO, "WebSocket client connected from %s", qPrintable(socket->peerAddress().toString()));
	clients.append(socket);

	connect(socket, &QWebSocket::textMessageReceived, this, &IRLWebSocketServer::onTextMessage);
	connect(socket, &QWebSocket::disconnected, this, &IRLWebSocketServer::onSocketDisconnected);

	emit clientConnected();
}

void IRLWebSocketServer::onSocketDisconnected()
{
	QWebSocket *socket = qobject_cast<QWebSocket *>(sender());
	if (!socket)
		return;

	obs_log(LOG_INFO, "WebSocket client disconnected");
	clients.removeAll(socket);
	socket->deleteLater();
	emit clientDisconnected();
}

void IRLWebSocketServer::onTextMessage(const QString &message)
{
	QWebSocket *socket = qobject_cast<QWebSocket *>(sender());
	if (!socket)
		return;

	emit messageReceived(message);

	QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8());
	if (!doc.isObject()) {
		QJsonObject err;
		err["type"] = "error";
		err["message"] = "invalid json";
		socket->sendTextMessage(QString::fromUtf8(QJsonDocument(err).toJson(QJsonDocument::Compact)));
		return;
	}

	QJsonObject req = doc.object();
	QJsonObject res = irl_protocol::handleMessage(req);
	QJsonDocument resDoc(res);
	socket->sendTextMessage(QString::fromUtf8(resDoc.toJson(QJsonDocument::Compact)));

	obs_log(LOG_INFO, "WebSocket req: %s -> res: %s", qPrintable(message),
		qPrintable(QString::fromUtf8(resDoc.toJson(QJsonDocument::Compact))));
}

#else // Fallback: QTcpServer with manual WebSocket handshake (no QtWebSockets)

#include <QHostAddress>
#include <QTcpServer>
#include <QTcpSocket>
#include <QCryptographicHash>

IRLWebSocketServer::IRLWebSocketServer(QObject *parent) : QObject(parent)
{
	tcpServer = new QTcpServer(this);
	connect(tcpServer, &QTcpServer::newConnection, this, &IRLWebSocketServer::onNewConnection);
}

IRLWebSocketServer::~IRLWebSocketServer()
{
	stop();
}

bool IRLWebSocketServer::start(quint16 port)
{
	if (tcpServer->isListening())
		tcpServer->close();

	listenPort = port;
	bool ok = tcpServer->listen(QHostAddress::Any, port);
	if (ok) {
		obs_log(LOG_INFO, "WebSocket server (QTcpServer fallback) listening on ws://0.0.0.0:%u", port);
	} else {
		obs_log(LOG_ERROR, "WebSocket server failed to listen on port %u: %s", port,
			qPrintable(tcpServer->errorString()));
	}
	return ok;
}

void IRLWebSocketServer::stop()
{
	if (tcpServer->isListening())
		tcpServer->close();
	for (auto *c : clients) {
		c->close();
		c->deleteLater();
	}
	clients.clear();
	buffers.clear();
	handshaked.clear();
}

bool IRLWebSocketServer::isListening() const
{
	return tcpServer && tcpServer->isListening();
}

int IRLWebSocketServer::clientCount() const
{
	return clients.size();
}

void IRLWebSocketServer::onNewConnection()
{
	while (tcpServer->hasPendingConnections()) {
		QTcpSocket *socket = tcpServer->nextPendingConnection();
		if (!socket)
			continue;

		obs_log(LOG_INFO, "WebSocket client connected (TCP) from %s", qPrintable(socket->peerAddress().toString()));
		clients.append(socket);
		buffers[socket] = QByteArray();
		handshaked[socket] = false;

		connect(socket, &QTcpSocket::readyRead, this, &IRLWebSocketServer::onReadyRead);
		connect(socket, &QTcpSocket::disconnected, this, &IRLWebSocketServer::onSocketDisconnected);

		emit clientConnected();
	}
}

void IRLWebSocketServer::onSocketDisconnected()
{
	QTcpSocket *socket = qobject_cast<QTcpSocket *>(sender());
	if (!socket)
		return;

	obs_log(LOG_INFO, "WebSocket client disconnected");
	clients.removeAll(socket);
	buffers.remove(socket);
	handshaked.remove(socket);
	socket->deleteLater();
	emit clientDisconnected();
}

void IRLWebSocketServer::onReadyRead()
{
	QTcpSocket *socket = qobject_cast<QTcpSocket *>(sender());
	if (!socket)
		return;

	QByteArray &buf = buffers[socket];
	buf.append(socket->readAll());

	// Handshake phase
	if (!handshaked.value(socket, false)) {
		int headerEnd = buf.indexOf("\r\n\r\n");
		if (headerEnd == -1)
			return; // need more data

		QByteArray header = buf.left(headerEnd);
		buf.remove(0, headerEnd + 4);

		// Extract Sec-WebSocket-Key
		QString headerStr = QString::fromUtf8(header);
		QString key;
		for (const QString &line : headerStr.split("\r\n")) {
			if (line.startsWith("Sec-WebSocket-Key:", Qt::CaseInsensitive)) {
				key = line.section(':', 1).trimmed();
				break;
			}
		}
		if (key.isEmpty()) {
			socket->close();
			return;
		}

		QByteArray accept = QCryptographicHash::hash((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toUtf8(),
							     QCryptographicHash::Sha1)
					  .toBase64();

		QByteArray response = "HTTP/1.1 101 Switching Protocols\r\n"
				      "Upgrade: websocket\r\n"
				      "Connection: Upgrade\r\n"
				      "Sec-WebSocket-Accept: " +
				      accept + "\r\n\r\n";
		socket->write(response);
		socket->flush();
		handshaked[socket] = true;
		obs_log(LOG_INFO, "WebSocket handshake completed for %s", qPrintable(socket->peerAddress().toString()));
		// Fall through to frame parsing if buffer already has data
		if (buf.isEmpty())
			return;
	}

	// Frame parsing (masked text frames from client)
	while (buf.size() >= 2) {
		quint8 b0 = static_cast<quint8>(buf[0]);
		quint8 b1 = static_cast<quint8>(buf[1]);
		// bool fin = b0 & 0x80; // currently unused, assume single frame
		quint8 opcode = b0 & 0x0F;
		bool masked = b1 & 0x80;
		quint64 payloadLen = b1 & 0x7F;
		int headerLen = 2;

		if (payloadLen == 126) {
			if (buf.size() < 4)
				break;
			payloadLen = (static_cast<quint8>(buf[2]) << 8) | static_cast<quint8>(buf[3]);
			headerLen = 4;
		} else if (payloadLen == 127) {
			if (buf.size() < 10)
				break;
			payloadLen = 0;
			for (int i = 0; i < 8; ++i) {
				payloadLen = (payloadLen << 8) | static_cast<quint8>(buf[2 + i]);
			}
			headerLen = 10;
		}

		if (masked)
			headerLen += 4;

		if (static_cast<quint64>(buf.size()) < static_cast<quint64>(headerLen) + payloadLen)
			break;

		QByteArray payload;
		if (masked) {
			QByteArray mask = buf.mid(headerLen - 4, 4);
			QByteArray maskedPayload = buf.mid(headerLen, static_cast<int>(payloadLen));
			for (int i = 0; i < maskedPayload.size(); ++i)
				maskedPayload[i] = maskedPayload[i] ^ mask[i % 4];
			payload = maskedPayload;
		} else {
			payload = buf.mid(headerLen, static_cast<int>(payloadLen));
		}

		buf.remove(0, headerLen + static_cast<int>(payloadLen));

		if (opcode == 0x8) { // close
			socket->close();
			break;
		} else if (opcode == 0x9) { // ping -> send pong
			// Simple pong: send same payload as pong frame (0x8A)
			QByteArray pong;
			pong.append(char(0x8A));
			if (payload.size() < 126) {
				pong.append(char(payload.size()));
			} else if (payload.size() < 65536) {
				pong.append(char(126));
				pong.append(char((payload.size() >> 8) & 0xFF));
				pong.append(char(payload.size() & 0xFF));
			}
			pong.append(payload);
			socket->write(pong);
			continue;
		} else if (opcode == 0x1) { // text
			QString msg = QString::fromUtf8(payload);
			handleWsMessage(socket, msg);
		}
		// continue loop for next frame
	}
}

void IRLWebSocketServer::handleWsMessage(QTcpSocket *socket, const QString &message)
{
	emit messageReceived(message);

	QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8());
	if (!doc.isObject()) {
		QJsonObject err;
		err["type"] = "error";
		err["message"] = "invalid json";
		sendTextMessage(socket, QString::fromUtf8(QJsonDocument(err).toJson(QJsonDocument::Compact)));
		return;
	}

	QJsonObject req = doc.object();
	QJsonObject res = irl_protocol::handleMessage(req);
	QJsonDocument resDoc(res);
	sendTextMessage(socket, QString::fromUtf8(resDoc.toJson(QJsonDocument::Compact)));

	obs_log(LOG_INFO, "WebSocket req: %s -> res: %s", qPrintable(message),
		qPrintable(QString::fromUtf8(resDoc.toJson(QJsonDocument::Compact))));
}

void IRLWebSocketServer::sendTextMessage(QTcpSocket *socket, const QString &message)
{
	QByteArray payload = message.toUtf8();
	QByteArray frame;
	frame.append(char(0x81)); // FIN + text
	if (payload.size() < 126) {
		frame.append(char(payload.size()));
	} else if (payload.size() < 65536) {
		frame.append(char(126));
		frame.append(char((payload.size() >> 8) & 0xFF));
		frame.append(char(payload.size() & 0xFF));
	} else {
		frame.append(char(127));
		for (int i = 7; i >= 0; --i)
			frame.append(char((payload.size() >> (i * 8)) & 0xFF));
	}
	frame.append(payload);
	socket->write(frame);
	socket->flush();
}

#endif
