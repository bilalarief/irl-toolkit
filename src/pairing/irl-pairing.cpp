#include "pairing/irl-pairing.hpp"

#include <QHostAddress>
#include <QNetworkInterface>
#include <QRandomGenerator>
#include <QSettings>

#include <obs-module.h>
#include <plugin-support.h>

namespace {

constexpr char SESSIONS_KEY[] = "sessions";

QSettings pairingSettings()
{
	return QSettings("IRLToolkit", "irl-toolkit");
}

} // namespace

IRLPairingManager::IRLPairingManager(QObject *parent) : QObject(parent)
{
	loadSessions();
}

void IRLPairingManager::regenerate(int ttlSecs)
{
	pendingToken = randomHex(32);
	pendingChannel = randomHex(32);
	// 6-digit code, unique among nothing else pending (single pending slot)
	quint32 n = QRandomGenerator::system()->bounded(900000u);
	pendingCode = QString::number(100000u + n);
	pendingExpires = QDateTime::currentDateTimeUtc().addSecs(ttlSecs);
	prune();
	obs_log(LOG_INFO, "pairing regenerated (code %s, ttl %ds)", qPrintable(pendingCode), ttlSecs);
	emit pairingChanged();
}

bool IRLPairingManager::hasPending() const
{
	return !pendingToken.isEmpty() && QDateTime::currentDateTimeUtc() < pendingExpires;
}

int IRLPairingManager::secondsLeft() const
{
	if (pendingToken.isEmpty())
		return 0;
	int left = static_cast<int>(QDateTime::currentDateTimeUtc().secsTo(pendingExpires));
	return left > 0 ? left : 0;
}

QString IRLPairingManager::redeemToken(const QString &token)
{
	prune();
	if (!hasPending() || token.isEmpty() || token != pendingToken) {
		obs_log(LOG_WARNING, "pairing redeem failed (token mismatch or expired)");
		return {};
	}
	// The session id is the relay channel: same credential, any transport.
	// Sessions never expire and survive restarts (see loadSessions) so the
	// phone reconnects on its own; revoke them from the dock if needed.
	const QString sessionId = pendingChannel;
	sessions.insert(sessionId, {sessionId});
	saveSessions();
	// Single-use: consume the pairing
	pendingToken.clear();
	pendingCode.clear();
	pendingChannel.clear();
	obs_log(LOG_INFO, "pairing redeemed via token, session issued");
	emit pairingChanged();
	return sessionId;
}

QString IRLPairingManager::redeemCode(const QString &code)
{
	prune();
	if (!hasPending() || code.isEmpty() || code != pendingCode) {
		obs_log(LOG_WARNING, "pairing redeem failed (code mismatch or expired)");
		return {};
	}
	const QString sessionId = pendingChannel;
	sessions.insert(sessionId, {sessionId});
	saveSessions();
	pendingToken.clear();
	pendingCode.clear();
	pendingChannel.clear();
	obs_log(LOG_INFO, "pairing redeemed via code, session issued");
	emit pairingChanged();
	return sessionId;
}

bool IRLPairingManager::validateSession(const QString &id)
{
	if (id.isEmpty())
		return false;
	return sessions.contains(id);
}

void IRLPairingManager::revokeAll()
{
	sessions.clear();
	saveSessions();
	obs_log(LOG_INFO, "all pairing sessions revoked");
	emit pairingChanged();
}

QStringList IRLPairingManager::activeChannels()
{
	prune();
	QStringList out;
	if (hasPending() && !pendingChannel.isEmpty())
		out.append(pendingChannel);
	for (auto it = sessions.begin(); it != sessions.end(); ++it)
		out.append(it.key());
	return out;
}

QString IRLPairingManager::lanIpAddress()
{
	for (const QHostAddress &addr : QNetworkInterface::allAddresses()) {
		if (addr.protocol() == QAbstractSocket::IPv4Protocol && !addr.isLoopback())
			return addr.toString();
	}
	return "127.0.0.1";
}

void IRLPairingManager::prune()
{
	// Sessions are persistent by design (revoked only via revokeAll).
}

void IRLPairingManager::loadSessions()
{
	const QStringList ids = pairingSettings().value(SESSIONS_KEY).toStringList();
	for (const QString &id : ids) {
		if (!id.isEmpty())
			sessions.insert(id, {id});
	}
	if (!sessions.isEmpty())
		obs_log(LOG_INFO, "loaded %d pairing session(s) from disk", static_cast<int>(sessions.size()));
}

void IRLPairingManager::saveSessions()
{
	pairingSettings().setValue(SESSIONS_KEY, QStringList(sessions.keys()));
}

QString IRLPairingManager::randomHex(int bytes)
{
	QByteArray buf(bytes, 0);
	QRandomGenerator *rng = QRandomGenerator::system();
	for (int i = 0; i < bytes; ++i)
		buf[i] = static_cast<char>(rng->bounded(256));
	return QString::fromLatin1(buf.toHex());
}
