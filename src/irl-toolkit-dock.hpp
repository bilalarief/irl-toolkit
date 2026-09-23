#pragma once

#include <QDockWidget>

class IRLToolkitDock : public QDockWidget {
	Q_OBJECT

public:
	explicit IRLToolkitDock(QWidget *parent = nullptr);
	~IRLToolkitDock() override;
};
