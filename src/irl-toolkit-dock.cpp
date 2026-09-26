#include "irl-toolkit-dock.hpp"

#include "obs/obs-scene-service.hpp"
#include "net/irl-relay.hpp"
#include "net/irl-websocket-server.hpp"
#include "pairing/irl-pairing.hpp"
#include "pairing/irl-qr.hpp"

#include <QLineEdit>

IRLWebSocketServer *irl_get_websocket_server();

#include <QFrame>
#include <QLabel>
#include <QPushButton>
#include <QScrollArea>
#include <QTextEdit>
#include <QTimer>
#include <QVBoxLayout>
#include <QWidget>

#include <obs-module.h>
#include <plugin-support.h>

IRLToolkitDock::IRLToolkitDock(QWidget *parent) : QDockWidget(parent)
{
	setObjectName("irlToolkitDock");
	setWindowTitle("IRL Toolkit");
	setFeatures(QDockWidget::DockWidgetMovable | QDockWidget::DockWidgetFloatable |
		    QDockWidget::DockWidgetClosable);

	QWidget *container = new QWidget(this);
	container->setObjectName("irlToolkitContainer");

	QVBoxLayout *mainLayout = new QVBoxLayout(container);
	mainLayout->setContentsMargins(16, 16, 16, 16);
	mainLayout->setSpacing(12);

	// Title
	QLabel *titleLabel = new QLabel("IRL TOOLKIT", container);
	titleLabel->setObjectName("irlToolkitTitle");
	titleLabel->setStyleSheet("font-size: 18px; font-weight: 800; letter-spacing: 1px;");
	titleLabel->setAlignment(Qt::AlignLeft);

	mainLayout->addWidget(titleLabel);

	// Divider under title
	QFrame *titleDivider = new QFrame(container);
	titleDivider->setFrameShape(QFrame::HLine);
	titleDivider->setFrameShadow(QFrame::Sunken);
	titleDivider->setStyleSheet("color: #e5e7eb;");
	mainLayout->addWidget(titleDivider);

	// OBS Section
	QLabel *obsHeader = new QLabel("OBS", container);
	obsHeader->setStyleSheet("font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.8px;");
	mainLayout->addWidget(obsHeader);

	QLabel *connectedLabel = new QLabel(QString::fromUtf8("● Connected"), container);
	connectedLabel->setObjectName("irlToolkitConnected");
	connectedLabel->setStyleSheet("font-size: 14px; font-weight: 600; color: #16a34a;");
	mainLayout->addWidget(connectedLabel);

	QLabel *runningLabel = new QLabel("Plugin is running.", container);
	runningLabel->setStyleSheet("font-size: 13px; color: #374151;");
	runningLabel->setWordWrap(true);
	mainLayout->addWidget(runningLabel);

	// Divider
	QFrame *divider = new QFrame(container);
	divider->setFrameShape(QFrame::HLine);
	divider->setFrameShadow(QFrame::Sunken);
	divider->setStyleSheet("color: #e5e7eb; margin-top: 4px; margin-bottom: 4px;");
	mainLayout->addWidget(divider);

	// PHONE Section
	QLabel *phoneHeader = new QLabel("PHONE", container);
	phoneHeader->setStyleSheet("font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.8px;");
	mainLayout->addWidget(phoneHeader);

	// QR pairing frame (single-use code, 5 min expiry)
	QFrame *qrFrame = new QFrame(container);
	qrFrame->setObjectName("qrFrame");
	qrFrame->setFrameShape(QFrame::StyledPanel);
	qrFrame->setStyleSheet(
		"#qrFrame { background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; }");

	QVBoxLayout *qrLayout = new QVBoxLayout(qrFrame);
	qrLayout->setContentsMargins(12, 12, 12, 12);
	qrLayout->setSpacing(4);
	qrLayout->setAlignment(Qt::AlignCenter);

	qrLabel = new QLabel(qrFrame);
	qrLabel->setAlignment(Qt::AlignCenter);
	qrLabel->setMinimumSize(160, 160);
	qrLayout->addWidget(qrLabel, 0, Qt::AlignCenter);

	codeLabel = new QLabel("--", qrFrame);
	codeLabel->setAlignment(Qt::AlignCenter);
	codeLabel->setStyleSheet("font-size: 22px; font-weight: 800; letter-spacing: 4px; color: #111827;");
	codeLabel->setTextInteractionFlags(Qt::TextSelectableByMouse);
	qrLayout->addWidget(codeLabel);

	expiryLabel = new QLabel("", qrFrame);
	expiryLabel->setAlignment(Qt::AlignCenter);
	expiryLabel->setStyleSheet("font-size: 11px; color: #6b7280;");
	qrLayout->addWidget(expiryLabel);

	mainLayout->addWidget(qrFrame);

	QPushButton *regenBtn = new QPushButton("Regenerate code", container);
	regenBtn->setStyleSheet(
		"QPushButton { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 12px; font-size: 12px; }"
		"QPushButton:hover { background: #e5e7eb; }");
	connect(regenBtn, &QPushButton::clicked, this, &IRLToolkitDock::regeneratePairing);
	mainLayout->addWidget(regenBtn);

	QLabel *waitingLabel = new QLabel("Scan the QR or type the code in the phone app.", container);
	waitingLabel->setAlignment(Qt::AlignCenter);
	waitingLabel->setStyleSheet("font-size: 12px; color: #6b7280; font-style: italic;");
	waitingLabel->setWordWrap(true);
	mainLayout->addWidget(waitingLabel);

	// WebSocket status (Milestone 4)
	wsStatusLabel = new QLabel("WebSocket: --", container);
	wsStatusLabel->setStyleSheet("font-size: 11px; color: #374151; font-family: monospace;");
	wsStatusLabel->setWordWrap(true);
	mainLayout->addWidget(wsStatusLabel);

	wsClientsLabel = new QLabel("Clients: 0", container);
	wsClientsLabel->setStyleSheet("font-size: 11px; color: #6b7280;");
	mainLayout->addWidget(wsClientsLabel);

	// --- Internet Relay Section ---
	QLabel *relayHeader = new QLabel("INTERNET RELAY", container);
	relayHeader->setStyleSheet("font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.8px;");
	mainLayout->addWidget(relayHeader);

	relayStatusLabel = new QLabel("Relay: not configured", container);
	relayStatusLabel->setStyleSheet("font-size: 11px; color: #6b7280;");
	relayStatusLabel->setWordWrap(true);
	mainLayout->addWidget(relayStatusLabel);

	supaUrlEdit = new QLineEdit(container);
	supaUrlEdit->setPlaceholderText("Supabase URL (https://xyz.supabase.co)");
	supaUrlEdit->setStyleSheet("font-size: 11px; padding: 6px; border: 1px solid #e5e7eb; border-radius: 6px;");
	mainLayout->addWidget(supaUrlEdit);

	supaKeyEdit = new QLineEdit(container);
	supaKeyEdit->setPlaceholderText("Supabase anon key");
	supaKeyEdit->setEchoMode(QLineEdit::Password);
	supaKeyEdit->setStyleSheet("font-size: 11px; padding: 6px; border: 1px solid #e5e7eb; border-radius: 6px;");
	mainLayout->addWidget(supaKeyEdit);

	pwaUrlEdit = new QLineEdit(container);
	pwaUrlEdit->setPlaceholderText("PWA URL (https://…vercel.app)");
	pwaUrlEdit->setStyleSheet("font-size: 11px; padding: 6px; border: 1px solid #e5e7eb; border-radius: 6px;");
	mainLayout->addWidget(pwaUrlEdit);

	QPushButton *relaySaveBtn = new QPushButton("Save relay settings", container);
	relaySaveBtn->setStyleSheet(
		"QPushButton { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 12px; font-size: 12px; }"
		"QPushButton:hover { background: #e5e7eb; }");
	connect(relaySaveBtn, &QPushButton::clicked, this, &IRLToolkitDock::saveRelaySettings);
	mainLayout->addWidget(relaySaveBtn);

	supaUrlEdit->setText(IRLRelayClient::supaUrl());
	supaKeyEdit->setText(IRLRelayClient::anonKey());
	pwaUrlEdit->setText(IRLRelayClient::pwaUrl());
	if (IRLRelayClient *relay = irl_get_relay_client())
		connect(relay, &IRLRelayClient::statusChanged, this, &IRLToolkitDock::updateRelayStatus);
	updateRelayStatus();

	// --- Scene Debug Section (Milestone 3) ---
	QFrame *sceneDivider = new QFrame(container);
	sceneDivider->setFrameShape(QFrame::HLine);
	sceneDivider->setFrameShadow(QFrame::Sunken);
	sceneDivider->setStyleSheet("color: #e5e7eb; margin-top: 8px;");
	mainLayout->addWidget(sceneDivider);

	QLabel *sceneHeader = new QLabel("CURRENT SCENE", container);
	sceneHeader->setStyleSheet("font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.8px;");
	mainLayout->addWidget(sceneHeader);

	canvasLabel = new QLabel("Canvas: --", container);
	canvasLabel->setStyleSheet("font-size: 12px; color: #374151; font-family: monospace;");
	mainLayout->addWidget(canvasLabel);

	sceneLabel = new QLabel("Scene: --", container);
	sceneLabel->setStyleSheet("font-size: 12px; color: #374151; font-weight: 600;");
	sceneLabel->setWordWrap(true);
	mainLayout->addWidget(sceneLabel);

	itemsLabel = new QLabel("Items: --", container);
	itemsLabel->setStyleSheet("font-size: 12px; color: #374151;");
	mainLayout->addWidget(itemsLabel);

	detailsEdit = new QTextEdit(container);
	detailsEdit->setReadOnly(true);
	detailsEdit->setMaximumHeight(140);
	detailsEdit->setStyleSheet(
		"font-size: 10px; font-family: monospace; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;");
	detailsEdit->setPlaceholderText("Scene items will appear here...");
	mainLayout->addWidget(detailsEdit);

	QPushButton *refreshBtn = new QPushButton("Refresh", container);
	refreshBtn->setStyleSheet(
		"QPushButton { background: #111827; color: white; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 600; }"
		"QPushButton:hover { background: #1f2937; }"
		"QPushButton:pressed { background: #030712; }");
	connect(refreshBtn, &QPushButton::clicked, this, &IRLToolkitDock::refreshSceneInfo);
	mainLayout->addWidget(refreshBtn);

	mainLayout->addStretch();

	// Footer hint
	QLabel *footer = new QLabel("Open View → Docks → IRL Toolkit to show/hide this panel.", container);
	footer->setWordWrap(true);
	footer->setAlignment(Qt::AlignCenter);
	footer->setStyleSheet("font-size: 10px; color: #9ca3af; margin-top: 8px;");
	mainLayout->addWidget(footer);

	container->setLayout(mainLayout);
	setWidget(container);

	// Constrain dock width for OBS's dock area
	setMinimumWidth(300);
	setMaximumWidth(420);

	// Auto-refresh timer (every 2s) + immediate
	refreshTimer = new QTimer(this);
	connect(refreshTimer, &QTimer::timeout, this, &IRLToolkitDock::refreshSceneInfo);
	refreshTimer->start(2000);
	refreshSceneInfo();

	// WebSocket status timer
	wsTimer = new QTimer(this);
	connect(wsTimer, &QTimer::timeout, this, &IRLToolkitDock::updateWebSocketStatus);
	wsTimer->start(1000);
	updateWebSocketStatus();

	// Pairing QR/code refresh (countdown + auto-regenerate on expiry)
	if (IRLPairingManager *pm = irl_get_pairing_manager())
		connect(pm, &IRLPairingManager::pairingChanged, this, &IRLToolkitDock::refreshPairing);
	pairingTimer = new QTimer(this);
	connect(pairingTimer, &QTimer::timeout, this, &IRLToolkitDock::refreshPairing);
	pairingTimer->start(1000);
	refreshPairing();
}

IRLToolkitDock::~IRLToolkitDock() = default;

void IRLToolkitDock::regeneratePairing()
{
	if (IRLPairingManager *pm = irl_get_pairing_manager())
		pm->regenerate();
}

void IRLToolkitDock::saveRelaySettings()
{
	IRLRelayClient::saveSettings(supaUrlEdit->text(), supaKeyEdit->text(), pwaUrlEdit->text());
	if (IRLRelayClient *relay = irl_get_relay_client())
		relay->reconfigure();
	updateRelayStatus();
	refreshPairing();
}

void IRLToolkitDock::updateRelayStatus()
{
	IRLRelayClient *relay = irl_get_relay_client();
	if (!relay) {
		relayStatusLabel->setText("Relay: unavailable");
		return;
	}
	relayStatusLabel->setText(relay->statusText());
}

void IRLToolkitDock::refreshPairing()
{
	IRLPairingManager *pm = irl_get_pairing_manager();
	if (!pm)
		return;
	if (!pm->hasPending()) {
		// Single-use code consumed (phone paired) or expired — issue a fresh one
		pm->regenerate();
		return;
	}
	// Relay QR when the relay is configured (works over the internet),
	// otherwise the local-WS QR (same WiFi only).
	QString payload;
	IRLRelayClient *relay = irl_get_relay_client();
	if (relay && relay->isConfigured() && !IRLRelayClient::pwaUrl().isEmpty()) {
		payload = QString("%1/?channel=%2&code=%3").arg(IRLRelayClient::pwaUrl(), pm->channel(), pm->code());
	} else {
		IRLWebSocketServer *srv = irl_get_websocket_server();
		const quint16 port = srv ? srv->port() : 8087;
		payload = QString("IRLTOOLKIT:ws://%1:%2?token=%3")
				  .arg(IRLPairingManager::lanIpAddress())
				  .arg(port)
				  .arg(pm->token());
	}
	qrLabel->setPixmap(QPixmap::fromImage(renderQrImage(payload, 192)));

	const QString code = pm->code();
	codeLabel->setText(code.length() == 6 ? code.left(3) + " " + code.mid(3) : code);

	const int left = pm->secondsLeft();
	expiryLabel->setText(QString("Code expires in %1:%2").arg(left / 60).arg(left % 60, 2, 10, QChar('0')));
}

void IRLToolkitDock::updateWebSocketStatus()
{
	IRLWebSocketServer *srv = irl_get_websocket_server();
	if (!srv) {
		wsStatusLabel->setText("WebSocket: not started");
		wsStatusLabel->setStyleSheet("font-size: 11px; color: #dc2626; font-family: monospace;");
		wsClientsLabel->setText("Clients: 0");
		return;
	}
	if (srv->isListening()) {
		wsStatusLabel->setText(
			QString("WebSocket: ws://%1:%2").arg(IRLPairingManager::lanIpAddress()).arg(srv->port()));
		wsStatusLabel->setStyleSheet("font-size: 11px; color: #16a34a; font-family: monospace;");
		wsClientsLabel->setText(
			QString("Clients: %1 (paired %2)").arg(srv->clientCount()).arg(srv->authedCount()));
		if (srv->authedCount() > 0)
			wsClientsLabel->setStyleSheet("font-size: 11px; color: #16a34a; font-weight: 600;");
		else
			wsClientsLabel->setStyleSheet("font-size: 11px; color: #6b7280;");
	} else {
		wsStatusLabel->setText(QString("WebSocket: failed (port %1)").arg(srv->port()));
		wsStatusLabel->setStyleSheet("font-size: 11px; color: #dc2626; font-family: monospace;");
		wsClientsLabel->setText(QString("Clients: %1").arg(srv->clientCount()));
	}
}

void IRLToolkitDock::refreshSceneInfo()
{
	SceneInfo info = obs_scene_service::getCurrentSceneInfo();

	if (info.canvas.width && info.canvas.height) {
		canvasLabel->setText(QString("Canvas: %1 × %2").arg(info.canvas.width).arg(info.canvas.height));
	} else {
		canvasLabel->setText("Canvas: --");
	}

	if (!info.name.empty()) {
		sceneLabel->setText(QString("Scene: %1").arg(QString::fromUtf8(info.name.c_str())));
	} else {
		sceneLabel->setText("Scene: (none)");
	}

	itemsLabel->setText(QString("Items: %1").arg(info.items.size()));

	QString details;
	for (const auto &item : info.items) {
		details += QString("#%1 %2 (%3)  x:%4 y:%5  %6×%7  s:%8,%9  r:%10°  %11\n")
				   .arg(item.sceneItemId)
				   .arg(QString::fromUtf8(item.sourceName.c_str()))
				   .arg(QString::fromUtf8(item.sourceType.c_str()))
				   .arg(qRound(item.x))
				   .arg(qRound(item.y))
				   .arg(qRound(item.width))
				   .arg(qRound(item.height))
				   .arg(item.scaleX, 0, 'f', 2)
				   .arg(item.scaleY, 0, 'f', 2)
				   .arg(qRound(item.rotation))
				   .arg(item.visible ? "visible" : "hidden");
	}
	if (details.isEmpty())
		details = "(no items or scene not loaded)";
	detailsEdit->setPlainText(details);

	obs_log(LOG_INFO, "scene refresh: canvas %ux%u scene '%s' items %zu", info.canvas.width, info.canvas.height,
		info.name.c_str(), info.items.size());
}
