#pragma once

#include <QHash>
#include <QObject>
#include <QSet>
#include <QString>

class QNetworkAccessManager;
class QTimer;

// Internet relay via Supabase Postgres + REST polling (no extra deps).
// The pairing session id IS the channel. The plugin announces pending
// pairings so the PWA can discover the channel by 6-digit code, then both
// sides exchange protocol messages as table rows. Dormant unless the
// Supabase URL + anon key are set in the dock settings.
class IRLRelayClient : public QObject {
	Q_OBJECT

public:
	explicit IRLRelayClient(QObject *parent = nullptr);

	bool isConfigured() const;
	QString statusText() const;
	void reconfigure();

	// Persisted dock settings
	static QString supaUrl();
	static QString anonKey();
	static QString pwaUrl();
	static void saveSettings(const QString &supaUrl, const QString &anonKey, const QString &pwaUrl);

signals:
	void statusChanged();

private slots:
	void poll();
	void onPairingChanged();

private:
	QNetworkRequest restRequest(const QString &pathQuery) const;
	void announcePairing();
	void postRow(const QString &channel, const QString &sender, const QByteArray &body);
	void deleteRow(qint64 id);
	void deletePairing(const QString &code);
	void handleIncoming(const QString &channel, qint64 id, const QByteArray &body);

	QNetworkAccessManager *net = nullptr;
	QTimer *timer = nullptr;
	QString announcedCode;
	QHash<QString, qint64> lastIds; // channel -> last consumed message id
	QSet<QString> relayAuthed; // channels that completed pairing
};

IRLRelayClient *irl_get_relay_client();
