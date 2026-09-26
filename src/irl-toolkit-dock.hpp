#pragma once

#include <QDockWidget>

class QLabel;
class QLineEdit;
class QPushButton;
class QTextEdit;
class QTimer;

class IRLToolkitDock : public QDockWidget {
	Q_OBJECT

public:
	explicit IRLToolkitDock(QWidget *parent = nullptr);
	~IRLToolkitDock() override;

private slots:
	void refreshSceneInfo();
	void updateWebSocketStatus();
	void refreshPairing();
	void regeneratePairing();
	void saveRelaySettings();
	void updateRelayStatus();

private:
	QLabel *canvasLabel = nullptr;
	QLabel *sceneLabel = nullptr;
	QLabel *itemsLabel = nullptr;
	QTextEdit *detailsEdit = nullptr;
	QTimer *refreshTimer = nullptr;
	QTimer *wsTimer = nullptr;
	QLabel *wsStatusLabel = nullptr;
	QLabel *wsClientsLabel = nullptr;
	QLabel *qrLabel = nullptr;
	QLabel *codeLabel = nullptr;
	QLabel *expiryLabel = nullptr;
	QTimer *pairingTimer = nullptr;
	QLabel *relayStatusLabel = nullptr;
	QLineEdit *supaUrlEdit = nullptr;
	QLineEdit *supaKeyEdit = nullptr;
	QLineEdit *pwaUrlEdit = nullptr;
};
