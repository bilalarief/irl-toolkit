#pragma once

#include <QObject>

#ifdef HAS_QT_WEBSOCKETS
#include <QWebSocketServer>
class QWebSocket;
#else
#include <QHash>
#include <QByteArray>
class QTcpServer;
class QTcpSocket;
#endif
#include <QSet>

class IRLWebSocketServer : public QObject {
	Q_OBJECT

public:
	explicit IRLWebSocketServer(QObject *parent = nullptr);
	~IRLWebSocketServer() override;

	bool start(quint16 port = 8087);
	void stop();
	quint16 port() const { return listenPort; }
	bool isListening() const;
	int clientCount() const;
	int authedCount() const { return authed.size(); }
	// Drops all paired sockets back to unpaired (they must pair again).
	void revokeAll() { authed.clear(); }

signals:
	void clientConnected();
	void clientDisconnected();
	void messageReceived(const QString &msg);

private slots:
	void onNewConnection();
#ifdef HAS_QT_WEBSOCKETS
	void onTextMessage(const QString &message);
#else
	void onReadyRead();
	void handleWsMessage(QTcpSocket *socket, const QString &message);
	void sendTextMessage(QTcpSocket *socket, const QString &message);
#endif
	void onSocketDisconnected();

private:
#ifdef HAS_QT_WEBSOCKETS
	QWebSocketServer *server = nullptr;
	QList<QWebSocket *> clients;
#else
	QTcpServer *tcpServer = nullptr;
	QList<QTcpSocket *> clients;
	QHash<QTcpSocket *, QByteArray> buffers;
	QHash<QTcpSocket *, bool> handshaked;
#endif
	// Sockets that completed pairing (token/code/session). Control messages
	// are rejected on any other socket.
	QSet<QObject *> authed;
	quint16 listenPort = 0;
};
