#include "obs/obs-thumbnail.hpp"

#include <obs-frontend-api.h>

#include <QApplication>
#include <QBuffer>
#include <QGuiApplication>
#include <QImage>
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

	QPixmap pix;

	// Method 1: Screen grab of desktop cropped to preview geometry (captures GPU content)
	if (QScreen *screen = QGuiApplication::primaryScreen()) {
		QPoint globalPos = preview->mapToGlobal(QPoint(0, 0));
		// Use desktop window 0 for full screen capture then crop (captures GPU preview)
		QPixmap desktop = screen->grabWindow(0, globalPos.x(), globalPos.y(), preview->width(), preview->height());
		if (!desktop.isNull()) {
			pix = desktop;
			obs_log(LOG_INFO, "thumbnail: captured via QScreen grabWindow(0) %dx%d", pix.width(), pix.height());
		} else {
			obs_log(LOG_INFO, "thumbnail: QScreen grabWindow(0) failed, trying windowHandle");
			if (QWindow *wh = preview->windowHandle()) {
				QScreen *s = wh->screen();
				if (!s) s = screen;
				QPixmap winPix = s->grabWindow(wh->winId(), globalPos.x(), globalPos.y(), preview->width(), preview->height());
				if (!winPix.isNull()) {
					pix = winPix;
					obs_log(LOG_INFO, "thumbnail: captured via windowHandle %dx%d", pix.width(), pix.height());
				}
			}
		}
	}

	// Fallback: QWidget::grab (for software rendered)
	if (pix.isNull()) {
		pix = preview->grab();
		if (!pix.isNull()) {
			obs_log(LOG_INFO, "thumbnail: captured via QWidget::grab %dx%d", pix.width(), pix.height());
		}
	}

	if (pix.isNull()) {
		obs_log(LOG_WARNING, "thumbnail: all grab methods failed");
		return {};
	}

	// Check if pix is blank (all same color) – indicates GPU preview not captured
	QImage img = pix.toImage().scaled(16, 16, Qt::IgnoreAspectRatio, Qt::FastTransformation);
	bool allSame = true;
	QRgb first = img.pixel(0, 0);
	for (int y = 0; y < img.height(); ++y) {
		for (int x = 0; x < img.width(); ++x) {
			if (img.pixel(x, y) != first) {
				allSame = false;
				break;
			}
		}
		if (!allSame) break;
	}
	if (allSame) {
		obs_log(LOG_WARNING, "thumbnail: captured image is blank (all same color), preview may be GPU, trying alternative");
		// Try grabbing main window central area as last resort
		QScreen *screen = QGuiApplication::primaryScreen();
		if (screen) {
			QRect mainGeo = mainWindow->geometry();
			QPixmap mainPix = screen->grabWindow(0, mainGeo.x() + mainGeo.width()/4, mainGeo.y() + mainGeo.height()/4, mainGeo.width()/2, mainGeo.height()/2);
			if (!mainPix.isNull() && mainPix.width() > 50) {
				pix = mainPix;
				obs_log(LOG_INFO, "thumbnail: fallback main window grab %dx%d", pix.width(), pix.height());
			}
		}
	}

	// Scale to maxWidth preserving aspect
	if (pix.width() > maxWidth) {
		pix = pix.scaledToWidth(maxWidth, Qt::SmoothTransformation);
	}

	QByteArray ba;
	QBuffer buffer(&ba);
	buffer.open(QIODevice::WriteOnly);
	if (!pix.save(&buffer, "JPEG", 75)) {
		obs_log(LOG_WARNING, "thumbnail: save to JPEG failed");
		return {};
	}

	QString b64 = QString::fromLatin1(ba.toBase64());
	obs_log(LOG_INFO, "thumbnail: success %dx%d -> %d bytes b64", pix.width(), pix.height(), b64.size());
	return QString("data:image/jpeg;base64,") + b64;
}
