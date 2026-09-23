#include "net/irl-websocket-server.hpp"

#include "protocol/irl-protocol.hpp"

#include <QJsonDocument>
#include <QJsonObject>
#include <QWebSocket>

#include <obs-module.h>
#include <plugin-support.h>

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
		obs_log(LOG_INFO, "WebSocket server listening on ws://0.0.0.0:%u", port);
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
