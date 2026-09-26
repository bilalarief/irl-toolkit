#pragma once

#include <QDateTime>
#include <QHash>
#include <QObject>
#include <QString>
#include <QStringList>

// Short-lived pairing bootstrap -> long-lived session.
// Flow: dock shows QR/code (single-use, 5 min) -> PWA redeems it once ->
// gets a session id (24 h) used for reconnects and, later, the relay.
// No accounts, no permanent secrets in QR codes.
class IRLPairingManager : public QObject {
	Q_OBJECT

public:
	static constexpr int PAIR_TTL_SECS = 300;
	static constexpr int SESSION_TTL_SECS = 24 * 3600;

	explicit IRLPairingManager(QObject *parent = nullptr);

	// Creates a fresh single-use pairing, replacing any pending one.
	// Also mints the relay channel: the redeemed session id IS the channel,
	// so the same credential works over local WS and the internet relay.
	void regenerate(int ttlSecs = PAIR_TTL_SECS);
	bool hasPending() const;
	QString token() const { return pendingToken; }
	QString code() const { return pendingCode; }
	QString channel() const { return pendingChannel; }
	QDateTime pairExpiresAt() const { return pendingExpires; }
	int secondsLeft() const;

	// Redeem a single-use credential. Returns the session id (== channel).
	QString redeemToken(const QString &token);
	QString redeemCode(const QString &code);
	bool validateSession(const QString &id);
	// Channels the relay should listen on: pending pairing + live sessions.
	QStringList activeChannels();

	// First non-loopback IPv4, for the ws:// URL shown in the dock/QR.
	static QString lanIpAddress();

signals:
	void pairingChanged();

private:
	struct Session {
		QString id;
		QDateTime expires;
	};

	void prune();
	static QString randomHex(int bytes);

	QString pendingToken;
	QString pendingCode;
	QString pendingChannel;
	QDateTime pendingExpires;
	QHash<QString, Session> sessions;
};

IRLPairingManager *irl_get_pairing_manager();
