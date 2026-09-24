#include "obs/obs-thumbnail.hpp"

#include <obs-frontend-api.h>

#include <QApplication>
#include <QBuffer>
#include <QGuiApplication>
#include <QMainWindow>
#include <QPixmap>
#include <QScreen>
#include <QWidget>
#include <QWindow>

#include <obs-module.h>
#include <plugin-support.h>

static QWidget *findPreviewWidget(QMainWindow *mainWindow)
{
	if (!mainWindow)
		return nullptr;

	// 1. Try OBSQTDisplay class (actual preview is OBSQTDisplay)
	for (QWidget *w : mainWindow->findChildren<QWidget *>()) {
		const char *cls = w->metaObject()->className();
		QString cn = QString::fromUtf8(cls);
		if (cn.contains("Display", Qt::CaseInsensitive) || cn.contains("Preview", Qt::CaseInsensitive)) {
			if (w->isVisible() && w->width() > 100 && w->height() > 100) {
				obs_log(LOG_INFO, "thumbnail: found candidate %s objectName='%s' %dx%d", qPrintable(cn),
					qPrintable(w->objectName()), w->width(), w->height());
				return w;
			}
		}
	}

	// 2. Try common object names
	const QStringList names = {"preview", "previewDisplay", "OBSBasicPreview", "obsPreview", "qtDisplay"};
	for (const QString &n : names) {
		if (QWidget *w = mainWindow->findChild<QWidget *>(n)) {
			obs_log(LOG_INFO, "thumbnail: found by name %s", qPrintable(n));
			return w;
		}
	}

	// 3. Fallback: centralWidget is most likely to contain preview
	if (QWidget *central = mainWindow->centralWidget()) {
		// preview is usually the largest child of centralWidget
		QWidget *best = nullptr;
		int bestArea = 0;
		for (QWidget *w : central->findChildren<QWidget *>()) {
			if (!w->isVisible())
				continue;
			int area = w->width() * w->height();
			if (area < 100 * 100)
				continue;
			if (area > bestArea) {
				best = w;
				bestArea = area;
			}
		}
		if (best) {
			obs_log(LOG_INFO, "thumbnail: fallback central %s %dx%d", qPrintable(best->metaObject()->className()),
				best->width(), best->height());
			return best;
		}
		return central;
	}

	return nullptr;
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

	// Try screen grab for GPU preview (more reliable than QWidget::grab)
	QPixmap pix;
	if (QWindow *wh = preview->windowHandle()) {
		QScreen *screen = wh->screen();
		if (!screen)
			screen = QGuiApplication::primaryScreen();
		if (screen) {
			// Map preview widget geometry to global
			QPoint globalPos = preview->mapToGlobal(QPoint(0, 0));
			pix = screen->grabWindow(wh->winId(), globalPos.x(), globalPos.y(), preview->width(), preview->height());
		}
	}
	if (pix.isNull()) {
		// Fallback to widget grab
		pix = preview->grab();
	}
	if (pix.isNull()) {
		obs_log(LOG_WARNING, "thumbnail: grab returned null (both screen and widget)");
		return {};
	}
	obs_log(LOG_INFO, "thumbnail: captured %dx%d from %s", pix.width(), pix.height(),
		qPrintable(preview->metaObject()->className()));

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
