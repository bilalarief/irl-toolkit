#include "obs/obs-thumbnail.hpp"

#include <obs-frontend-api.h>

#include <QApplication>
#include <QBuffer>
#include <QMainWindow>
#include <QPixmap>
#include <QWidget>

#include <obs-module.h>
#include <plugin-support.h>

static QWidget *findPreviewWidget(QMainWindow *mainWindow)
{
	if (!mainWindow)
		return nullptr;

	// Try common object names
	const QStringList names = {"preview", "previewDisplay", "OBSBasicPreview", "obsPreview"};
	for (const QString &n : names) {
		if (QWidget *w = mainWindow->findChild<QWidget *>(n))
			return w;
	}

	// Fallback: find largest center widget that looks like preview (heuristic)
	QWidget *best = nullptr;
	int bestArea = 0;
	const auto widgets = mainWindow->findChildren<QWidget *>();
	for (QWidget *w : widgets) {
		if (!w->isVisible())
			continue;
		// Preview is typically a large widget in central area
		QRect g = w->geometry();
		int area = g.width() * g.height();
		// Filter small widgets
		if (area < 50 * 50)
			continue;
		// Must be inside central widget area
		if (area > bestArea) {
			// Heuristic: preview has no layout children with many buttons
			best = w;
			bestArea = area;
		}
	}
	return best;
}

QString capturePreviewBase64(int maxWidth)
{
	QMainWindow *mainWindow = static_cast<QMainWindow *>(obs_frontend_get_main_window());
	if (!mainWindow) {
		obs_log(LOG_WARNING, "thumbnail: no main window");
		return {};
	}

	QWidget *preview = findPreviewWidget(mainWindow);
	if (!preview) {
		obs_log(LOG_WARNING, "thumbnail: preview widget not found");
		return {};
	}

	// Grab widget
	QPixmap pix = preview->grab();
	if (pix.isNull()) {
		obs_log(LOG_WARNING, "thumbnail: grab returned null");
		return {};
	}

	// Scale to maxWidth preserving aspect
	if (pix.width() > maxWidth) {
		pix = pix.scaledToWidth(maxWidth, Qt::SmoothTransformation);
	}

	QByteArray ba;
	QBuffer buffer(&ba);
	buffer.open(QIODevice::WriteOnly);
	// JPEG 75% quality for size
	if (!pix.save(&buffer, "JPEG", 75)) {
		obs_log(LOG_WARNING, "thumbnail: save to JPEG failed");
		return {};
	}

	QString b64 = QString::fromLatin1(ba.toBase64());
	return QString("data:image/jpeg;base64,") + b64;
}
