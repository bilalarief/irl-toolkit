#include "obs/obs-thumbnail.hpp"

#include <obs-frontend-api.h>
#include <obs.h>
#include <util/bmem.h>
#include <util/config-file.h>

#ifdef _MSC_VER
#pragma warning(disable : 4996)
#endif

#include <QApplication>
#include <QBuffer>
#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QGuiApplication>
#include <QImage>
#include <QMainWindow>
#include <QPixmap>
#include <QRegularExpression>
#include <QScreen>
#include <QStandardPaths>
#include <QThread>
#include <QWidget>
#include <QWindow>

#include <obs-module.h>
#include <plugin-support.h>

// Screenshot save folder: prefer OBS-configured path, fall back to OS Pictures.
// Uses deprecated global-config API only where still available; wrapped to
// avoid -Werror=deprecated-declarations on GCC/Clang and C4996 on MSVC.
static QString getScreenshotDir()
{
#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#endif
	config_t *cfg = obs_frontend_get_global_config();
	const char *path = cfg ? config_get_string(cfg, "Output", "ScreenshotPath") : nullptr;
#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic pop
#endif
	if (path && *path)
		return QString::fromUtf8(path);
	QString pics = QStandardPaths::writableLocation(QStandardPaths::PicturesLocation);
	if (!pics.isEmpty())
		return pics;
	return QDir::homePath() + "/Pictures";
}

static QWidget *findPreviewWidget(QMainWindow *mainWindow)
{
	if (!mainWindow)
		return nullptr;
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
	const QStringList names = {"preview", "previewDisplay", "OBSBasicPreview", "obsPreview", "qtDisplay"};
	for (const QString &n : names) {
		if (QWidget *w = mainWindow->findChild<QWidget *>(n)) {
			obs_log(LOG_INFO, "thumbnail: found by name %s", qPrintable(n));
			return w;
		}
	}
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
			obs_log(LOG_INFO, "thumbnail: fallback central %s %dx%d",
				qPrintable(best->metaObject()->className()), best->width(), best->height());
			return best;
		}
		return central;
	}
	return nullptr;
}

static QString pixmapToBase64(const QPixmap &pix, int maxWidth)
{
	QPixmap scaled = pix;
	if (scaled.width() > maxWidth)
		scaled = scaled.scaledToWidth(maxWidth, Qt::SmoothTransformation);
	QByteArray ba;
	QBuffer buffer(&ba);
	buffer.open(QIODevice::WriteOnly);
	if (!scaled.save(&buffer, "JPEG", 70))
		return {};
	return QString("data:image/jpeg;base64,") + QString::fromLatin1(ba.toBase64());
}

static QString captureViaScreenGrab(QWidget *preview, int maxWidth)
{
	if (!preview)
		return {};
	QScreen *screen = QGuiApplication::primaryScreen();
	if (!screen)
		return {};
	QPoint globalPos = preview->mapToGlobal(QPoint(0, 0));
	QPixmap desktop = screen->grabWindow(0, globalPos.x(), globalPos.y(), preview->width(), preview->height());
	if (desktop.isNull())
		return {};
	// Check if blank (all same color)
	QImage img = desktop.toImage().scaled(16, 16, Qt::IgnoreAspectRatio, Qt::FastTransformation);
	bool allSame = true;
	QRgb first = img.pixel(0, 0);
	for (int y = 0; y < img.height(); ++y) {
		for (int x = 0; x < img.width(); ++x) {
			if (img.pixel(x, y) != first) {
				allSame = false;
				break;
			}
		}
		if (!allSame)
			break;
	}
	if (allSame) {
		obs_log(LOG_INFO, "thumbnail: screen grab is blank");
		return {};
	}
	obs_log(LOG_INFO, "thumbnail: screen grab %dx%d", desktop.width(), desktop.height());
	return pixmapToBase64(desktop, maxWidth);
}

static QString captureViaScreenshotFile(int maxWidth)
{
	obs_source_t *sceneSource = obs_frontend_get_current_scene();
	if (!sceneSource)
		return {};
	QString screenshotDir = getScreenshotDir();

	QDir dir(screenshotDir);
	if (!dir.exists())
		dir.mkpath(".");

	// Count files before
	QStringList before = dir.entryList(QDir::Files, QDir::Time);
	// Trigger OBS screenshot of scene source (saves file async)
	obs_frontend_take_source_screenshot(sceneSource);
	obs_source_release(sceneSource);

	// Wait up to 1.5s for new file
	QString newFile;
	for (int i = 0; i < 15; ++i) {
		QThread::msleep(100);
		QCoreApplication::processEvents();
		QStringList after = dir.entryList(QDir::Files, QDir::Time);
		if (after.size() > before.size()) {
			// Find newest file not in before
			for (const QString &f : after) {
				if (!before.contains(f)) {
					newFile = dir.filePath(f);
					break;
				}
			}
			if (!newFile.isEmpty())
				break;
		}
		// Also check for any new file by time
		if (!after.isEmpty()) {
			QFileInfo fi(dir.filePath(after.first()));
			if (fi.lastModified().secsTo(QDateTime::currentDateTime()) < 2 &&
			    !before.contains(after.first())) {
				newFile = dir.filePath(after.first());
				break;
			}
		}
	}

	if (newFile.isEmpty()) {
		obs_log(LOG_INFO, "thumbnail: screenshot file not found in %s", qPrintable(screenshotDir));
		return {};
	}

	QPixmap pix(newFile);
	if (pix.isNull()) {
		obs_log(LOG_WARNING, "thumbnail: failed to load screenshot %s", qPrintable(newFile));
		return {};
	}
	obs_log(LOG_INFO, "thumbnail: screenshot file %s %dx%d", qPrintable(newFile), pix.width(), pix.height());
	// Optionally delete file after reading to avoid clutter
	// QFile::remove(newFile);
	return pixmapToBase64(pix, maxWidth);
}

// Dedicated local folder for this plugin's thumbnails:
// %APPDATA%/obs-studio/plugin_config/irl-toolkit/thumbs (auto-created).
// Later: files here are uploaded to the server, then auto-removed on success.
static QString getThumbsDir()
{
	char *path = obs_module_get_config_path(obs_current_module(), "thumbs");
	QString dir = path ? QString::fromUtf8(path) : QString();
	if (path)
		bfree(path);
	if (dir.isEmpty())
		dir = QStandardPaths::writableLocation(QStandardPaths::PicturesLocation) + "/irl-toolkit";
	QDir().mkpath(dir);
	return dir;
}

// DUMMY uploader for local testing: pretends to upload and always succeeds,
// so the caller deletes the local file right away.
// TODO(supabase): PUT jpeg bytes to Supabase Storage here and return the
// public URL instead of a data URI. Delete local file only on HTTP 200.
static QString dummyUploadJpeg(const QByteArray &jpeg, const QString &objectName, const QString &localPath)
{
	(void)jpeg;
	obs_log(LOG_INFO, "thumbnail: dummy upload %s (local %s) -> success, removing local file",
		qPrintable(objectName), qPrintable(localPath));
	QFile::remove(localPath);
	return {}; // caller falls back to data URI for local preview
}

QString captureSourceThumbnail(obs_source_t *source, int maxWidth)
{
	if (!source)
		return {};
	const char *srcName = obs_source_get_name(source);
	QString screenshotDir = getScreenshotDir();
	QDir dir(screenshotDir);
	if (!dir.exists())
		dir.mkpath(".");
	QStringList before = dir.entryList(QDir::Files, QDir::Time);
	obs_frontend_take_source_screenshot(source);
	// Wait up to 1.5s
	QString newFile;
	for (int i = 0; i < 15; ++i) {
		QThread::msleep(100);
		QCoreApplication::processEvents();
		QStringList after = dir.entryList(QDir::Files, QDir::Time);
		if (after.size() > before.size()) {
			for (const QString &f : after) {
				if (!before.contains(f)) {
					newFile = dir.filePath(f);
					break;
				}
			}
			if (!newFile.isEmpty())
				break;
		}
		if (!after.isEmpty()) {
			QFileInfo fi(dir.filePath(after.first()));
			if (fi.lastModified().secsTo(QDateTime::currentDateTime()) < 2 &&
			    !before.contains(after.first())) {
				newFile = dir.filePath(after.first());
				break;
			}
		}
	}
	if (newFile.isEmpty()) {
		obs_log(LOG_INFO, "thumbnail: source screenshot not found for %s", srcName ? srcName : "?");
		return {};
	}
	// Move into our dedicated folder
	QString thumbsDir = getThumbsDir();
	QString objectName = QString("%1.jpg").arg(QString::fromUtf8(srcName ? srcName : "source"));
	// Sanitize filename
	objectName.replace(QRegularExpression("[^A-Za-z0-9._-]"), "_");
	QString localPath = thumbsDir + "/" + objectName;
	QFile::remove(localPath);
	if (!QFile::rename(newFile, localPath)) {
		// Fall back to reading in place
		localPath = newFile;
	}
	QPixmap pix(localPath);
	if (pix.isNull()) {
		obs_log(LOG_WARNING, "thumbnail: failed to load source screenshot %s", qPrintable(localPath));
		return {};
	}
	obs_log(LOG_INFO, "thumbnail: source %s screenshot %s %dx%d", srcName ? srcName : "?", qPrintable(localPath),
		pix.width(), pix.height());
	if (pix.width() > maxWidth)
		pix = pix.scaledToWidth(maxWidth, Qt::SmoothTransformation);
	QByteArray jpeg;
	QBuffer buffer(&jpeg);
	buffer.open(QIODevice::WriteOnly);
	if (!pix.save(&buffer, "JPEG", 70))
		return {};
	// Dummy upload for local test (deletes local file on "success")
	dummyUploadJpeg(jpeg, objectName, localPath);
	// Local preview: data URI so PWA works on localhost without a server
	return QString("data:image/jpeg;base64,") + QString::fromLatin1(jpeg.toBase64());
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

	// Try screen grab first (fast, no file IO)
	QString b64 = captureViaScreenGrab(preview, maxWidth);
	if (!b64.isEmpty())
		return b64;

	// Fallback: OBS screenshot file (accurate WYSIWYG)
	obs_log(LOG_INFO, "thumbnail: trying screenshot file fallback");
	b64 = captureViaScreenshotFile(maxWidth);
	if (!b64.isEmpty())
		return b64;

	// Last fallback: widget grab
	QPixmap pix = preview->grab();
	if (!pix.isNull()) {
		obs_log(LOG_INFO, "thumbnail: fallback widget grab %dx%d", pix.width(), pix.height());
		return pixmapToBase64(pix, maxWidth);
	}

	obs_log(LOG_WARNING, "thumbnail: all capture methods failed");
	return {};
}
