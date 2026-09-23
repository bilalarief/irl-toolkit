#include "irl-toolkit-dock.hpp"

#include <QFrame>
#include <QLabel>
#include <QVBoxLayout>
#include <QWidget>

IRLToolkitDock::IRLToolkitDock(QWidget *parent) : QDockWidget(parent)
{
	setObjectName("irlToolkitDock");
	setWindowTitle("IRL Toolkit");
	setFeatures(QDockWidget::DockWidgetMovable | QDockWidget::DockWidgetFloatable | QDockWidget::DockWidgetClosable);

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

	// QR placeholder frame
	QFrame *qrFrame = new QFrame(container);
	qrFrame->setObjectName("qrPlaceholder");
	qrFrame->setFrameShape(QFrame::StyledPanel);
	qrFrame->setStyleSheet(
		"#qrPlaceholder { background-color: #f9fafb; border: 2px dashed #d1d5db; border-radius: 12px; }");
	qrFrame->setMinimumHeight(160);

	QVBoxLayout *qrLayout = new QVBoxLayout(qrFrame);
	qrLayout->setContentsMargins(16, 16, 16, 16);
	qrLayout->setAlignment(Qt::AlignCenter);

	QLabel *qrIcon = new QLabel(QString::fromUtf8("[ QR CODE ]"), qrFrame);
	qrIcon->setAlignment(Qt::AlignCenter);
	qrIcon->setStyleSheet("font-size: 13px; font-weight: 600; color: #9ca3af; letter-spacing: 0.5px;");
	qrLayout->addWidget(qrIcon);

	QLabel *qrHint = new QLabel("QR pairing coming soon", qrFrame);
	qrHint->setAlignment(Qt::AlignCenter);
	qrHint->setStyleSheet("font-size: 11px; color: #9ca3af;");
	qrHint->setWordWrap(true);
	qrLayout->addWidget(qrHint);

	mainLayout->addWidget(qrFrame);

	QLabel *waitingLabel = new QLabel("Waiting for phone...", container);
	waitingLabel->setAlignment(Qt::AlignCenter);
	waitingLabel->setStyleSheet("font-size: 12px; color: #6b7280; font-style: italic;");
	waitingLabel->setWordWrap(true);
	mainLayout->addWidget(waitingLabel);

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
	setMinimumWidth(280);
	setMaximumWidth(420);
}

IRLToolkitDock::~IRLToolkitDock() = default;
