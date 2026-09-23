#pragma once

#include <QDockWidget>

class QLabel;
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

private:
	QLabel *canvasLabel = nullptr;
	QLabel *sceneLabel = nullptr;
	QLabel *itemsLabel = nullptr;
	QTextEdit *detailsEdit = nullptr;
	QTimer *refreshTimer = nullptr;
};
