#pragma once

#include <QObject>
#include <QWebSocketServer>

class QWebSocket;

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

signals:
	void clientConnected();
	void clientDisconnected();
	void messageReceived(const QString &msg);

private slots:
	void onNewConnection();
	void onTextMessage(const QString &message);
	void onSocketDisconnected();

private:
	QWebSocketServer *server = nullptr;
	QList<QWebSocket *> clients;
	quint16 listenPort = 0;
};
