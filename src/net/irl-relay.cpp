#include "net/irl-relay.hpp"

#include "pairing/irl-pairing.hpp"
#include "protocol/irl-protocol.hpp"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonValue>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSettings>
#include <QTimer>
#include <QUrl>

#include <obs-module.h>
#include <plugin-support.h>

namespace {

constexpr int POLL_MS = 700;

QSettings relaySettings()
{
	return QSettings("IRLToolkit", "irl-toolkit");
}

} // namespace

IRLRelayClient::IRLRelayClient(QObject *parent) : QObject(parent)
{
	net = new QNetworkAccessManager(this);
	timer = new QTimer(this);
	connect(timer, &QTimer::timeout, this, &IRLRelayClient::poll);
	if (IRLPairingManager *pm = irl_get_pairing_manager())
		connect(pm, &IRLPairingManager::pairingChanged, this, &IRLRelayClient::onPairingChanged);
	reconfigure();
}

bool IRLRelayClient::isConfigured() const
{
	return !supaUrl().isEmpty() && !anonKey().isEmpty();
}

QString IRLRelayClient::statusText() const
{
	if (!isConfigured())
		return "Relay: not configured";
	QUrl u(supaUrl());
	return QString("Relay: %1 (%2)").arg(u.host()).arg(timer->isActive() ? "polling" : "idle");
}

void IRLRelayClient::reconfigure()
{
	if (isConfigured() && !timer->isActive()) {
		timer->start(POLL_MS);
		announcePairing();
	} else if (!isConfigured() && timer->isActive()) {
		timer->stop();
	}
	emit statusChanged();
}

QString IRLRelayClient::supaUrl()
{
	QString u = relaySettings().value("supa_url").toString().trimmed();
	while (u.endsWith('/'))
		u.chop(1);
	return u;
}

QString IRLRelayClient::anonKey()
{
	return relaySettings().value("supa_key").toString().trimmed();
}

QString IRLRelayClient::pwaUrl()
{
	QString u = relaySettings().value("pwa_url").toString().trimmed();
	while (u.endsWith('/'))
		u.chop(1);
	return u;
}

void IRLRelayClient::saveSettings(const QString &supaUrl, const QString &anonKey, const QString &pwaUrl)
{
	QSettings s = relaySettings();
	QString u = supaUrl.trimmed();
	while (u.endsWith('/'))
		u.chop(1);
	s.setValue("supa_url", u);
	s.setValue("supa_key", anonKey.trimmed());
	QString p = pwaUrl.trimmed();
	while (p.endsWith('/'))
		p.chop(1);
	s.setValue("pwa_url", p);
	s.sync();
}

QNetworkRequest IRLRelayClient::restRequest(const QString &pathQuery) const
{
	QNetworkRequest req(QUrl(supaUrl() + "/rest/v1/" + pathQuery));
	req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
	req.setRawHeader("apikey", anonKey().toUtf8());
	req.setRawHeader("Authorization", ("Bearer " + anonKey()).toUtf8());
	req.setRawHeader("Accept", "application/json");
	return req;
}

void IRLRelayClient::onPairingChanged()
{
	if (!isConfigured())
		return;
	IRLPairingManager *pm = irl_get_pairing_manager();
	if (!pm)
		return;
	// Withdraw the previous announcement if it is gone or replaced
	if (!announcedCode.isEmpty() && (!pm->hasPending() || pm->code() != announcedCode)) {
		deletePairing(announcedCode);
		announcedCode.clear();
	}
	announcePairing();
}

void IRLRelayClient::announcePairing()
{
	IRLPairingManager *pm = irl_get_pairing_manager();
	if (!isConfigured() || !pm || !pm->hasPending() || pm->code() == announcedCode)
		return;
	QJsonObject row;
	row["code"] = pm->code();
	row["channel"] = pm->channel();
	row["expires_at"] = pm->pairExpiresAt().toString(Qt::ISODateWithMs);
	QJsonArray arr;
	arr.append(row);
	QNetworkReply *reply =
		net->post(restRequest("irl_pairings"), QJsonDocument(arr).toJson(QJsonDocument::Compact));
	connect(reply, &QNetworkReply::finished, this, [this, reply]() {
		reply->deleteLater();
		if (reply->error() != QNetworkReply::NoError) {
			obs_log(LOG_WARNING, "relay: announce failed: %s", qPrintable(reply->errorString()));
			return;
		}
	});
	announcedCode = pm->code();
}

void IRLRelayClient::deletePairing(const QString &code)
{
	if (!isConfigured() || code.isEmpty())
		return;
	QNetworkReply *reply = net->deleteResource(restRequest("irl_pairings?code=eq." + code));
	connect(reply, &QNetworkReply::finished, this, [reply]() { reply->deleteLater(); });
}

void IRLRelayClient::postRow(const QString &channel, const QString &sender, const QByteArray &body)
{
	if (!isConfigured())
		return;
	QJsonObject row;
	row["channel"] = channel;
	row["sender"] = sender;
	row["body"] = QJsonDocument::fromJson(body).object();
	QJsonArray arr;
	arr.append(row);
	QNetworkReply *reply =
		net->post(restRequest("irl_messages"), QJsonDocument(arr).toJson(QJsonDocument::Compact));
	connect(reply, &QNetworkReply::finished, this, [this, reply]() {
		reply->deleteLater();
		if (reply->error() != QNetworkReply::NoError)
			obs_log(LOG_WARNING, "relay: post failed: %s", qPrintable(reply->errorString()));
	});
}

void IRLRelayClient::deleteRow(qint64 id)
{
	if (!isConfigured())
		return;
	QNetworkReply *reply = net->deleteResource(restRequest(QString("irl_messages?id=eq.%1").arg(id)));
	connect(reply, &QNetworkReply::finished, this, [reply]() { reply->deleteLater(); });
}

void IRLRelayClient::poll()
{
	if (!isConfigured())
		return;
	IRLPairingManager *pm = irl_get_pairing_manager();
	if (!pm)
		return;
	for (const QString &channel : pm->activeChannels()) {
		const qint64 last = lastIds.value(channel, 0);
		QString q = QString("irl_messages?channel=eq.%1&sender=eq.pwa&order=id.asc&id=gt.%2&select=id,body")
				    .arg(channel)
				    .arg(last);
		QNetworkReply *reply = net->get(restRequest(q));
		connect(reply, &QNetworkReply::finished, this, [this, reply, channel]() {
			reply->deleteLater();
			if (reply->error() != QNetworkReply::NoError) {
				// Quiet: transient network blips retry on the next tick
				return;
			}
			QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
			if (!doc.isArray())
				return;
			for (const QJsonValue v : doc.array()) {
				if (!v.isObject())
					continue;
				QJsonObject row = v.toObject();
				const qint64 id = static_cast<qint64>(row.value("id").toDouble(0));
				if (id <= 0 || id <= lastIds.value(channel, 0))
					continue;
				lastIds[channel] = id;
				deleteRow(id);
				handleIncoming(
					channel, id,
					QJsonDocument(row.value("body").toObject()).toJson(QJsonDocument::Compact));
			}
		});
	}
}

void IRLRelayClient::handleIncoming(const QString &channel, qint64 id, const QByteArray &body)
{
	(void)id;
	QJsonDocument doc = QJsonDocument::fromJson(body);
	if (!doc.isObject())
		return;
	QJsonObject req = doc.object();
	const QString reqType = req.value("type").toString();
	if (reqType != "pair" && !relayAuthed.contains(channel)) {
		obs_log(LOG_WARNING, "relay: ignoring unauthenticated '%s' on channel", qPrintable(reqType));
		return;
	}
	QJsonObject res = irl_protocol::handleMessage(req);
	if (reqType == "pair" && res.value("type").toString() == "paired" && res.value("success").toBool()) {
		relayAuthed.insert(channel);
		// Single-use pairing consumed — withdraw the announcement
		if (!announcedCode.isEmpty()) {
			deletePairing(announcedCode);
			announcedCode.clear();
		}
	}
	if (req.contains("requestId"))
		res["requestId"] = req.value("requestId");
	postRow(channel, "plugin", QJsonDocument(res).toJson(QJsonDocument::Compact));
	obs_log(LOG_INFO, "relay: %s -> %s", qPrintable(QString::fromUtf8(body)),
		qPrintable(QString::fromUtf8(QJsonDocument(res).toJson(QJsonDocument::Compact))));
}
