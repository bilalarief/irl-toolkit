#include "protocol/irl-protocol.hpp"

#include "obs/obs-scene-service.hpp"
#include "obs/obs-thumbnail.hpp"

#include <obs.h>

#include <QJsonArray>
#include <QJsonObject>

namespace irl_protocol {

QJsonObject handleMessage(const QJsonObject &req)
{
	QString type = req.value("type").toString();

	if (type == "ping") {
		QJsonObject res;
		res["type"] = "pong";
		return res;
	}

	if (type == "get_scene" || type == "get_scene_items") {
		SceneInfo info = obs_scene_service::getCurrentSceneInfo();

		QJsonObject scene;
		scene["name"] = QString::fromUtf8(info.name.c_str());
		scene["canvasWidth"] = static_cast<int>(info.canvas.width);
		scene["canvasHeight"] = static_cast<int>(info.canvas.height);

		QJsonArray items;
		for (const auto &it : info.items) {
			QJsonObject obj;
			obj["sceneItemId"] = static_cast<qint64>(it.sceneItemId);
			obj["sourceName"] = QString::fromUtf8(it.sourceName.c_str());
			obj["sourceType"] = QString::fromUtf8(it.sourceType.c_str());
			obj["x"] = it.x;
			obj["y"] = it.y;
			obj["width"] = it.width;
			obj["height"] = it.height;
			obj["scaleX"] = it.scaleX;
			obj["scaleY"] = it.scaleY;
			obj["rotation"] = it.rotation;
			obj["visible"] = it.visible;
			items.append(obj);
		}
		scene["items"] = items;

		QJsonObject res;
		res["type"] = "scene_state";
		res["scene"] = scene;
		// echo requestId if present
		if (req.contains("requestId"))
			res["requestId"] = req.value("requestId");
		return res;
	}

	if (type == "save_changes") {
		QJsonArray changes = req.value("changes").toArray();
		// Also support flat diff array as used by PWA: [{sceneItemId, patch}]
		if (changes.isEmpty() && req.contains("diff")) {
			changes = req.value("diff").toArray();
		}
		QString error;
		bool ok = obs_scene_service::applySceneChanges(changes, error);

		QJsonObject res;
		res["type"] = "save_result";
		res["success"] = ok;
		if (!error.isEmpty())
			res["error"] = error;
		if (req.contains("requestId"))
			res["requestId"] = req.value("requestId");

		// Include fresh scene state on success for PWA to update original
		if (ok) {
			SceneInfo info = obs_scene_service::getCurrentSceneInfo();
			QJsonObject scene;
			scene["name"] = QString::fromUtf8(info.name.c_str());
			scene["canvasWidth"] = static_cast<int>(info.canvas.width);
			scene["canvasHeight"] = static_cast<int>(info.canvas.height);
			QJsonArray items;
			for (const auto &it : info.items) {
				QJsonObject obj;
				obj["sceneItemId"] = static_cast<qint64>(it.sceneItemId);
				obj["sourceName"] = QString::fromUtf8(it.sourceName.c_str());
				obj["sourceType"] = QString::fromUtf8(it.sourceType.c_str());
				obj["x"] = it.x;
				obj["y"] = it.y;
				obj["width"] = it.width;
				obj["height"] = it.height;
				obj["scaleX"] = it.scaleX;
				obj["scaleY"] = it.scaleY;
				obj["rotation"] = it.rotation;
				obj["visible"] = it.visible;
				items.append(obj);
			}
			scene["items"] = items;
			res["scene"] = scene;
		}
		return res;
	}

	if (type == "get_thumbnail") {
		QString data = capturePreviewBase64(480);
		QJsonObject res;
		res["type"] = "thumbnail";
		res["data"] = data;
		if (req.contains("requestId"))
			res["requestId"] = req.value("requestId");
		if (data.isEmpty()) {
			res["error"] = "capture failed";
		}
		return res;
	}

	if (type == "get_thumbnails") {
		SceneInfo info = obs_scene_service::getCurrentSceneInfo();
		QJsonArray thumbs;
		for (const auto &it : info.items) {
			// Find source by name
			obs_source_t *src = obs_get_source_by_name(it.sourceName.c_str());
			QString data;
			if (src) {
				data = captureSourceThumbnail(src, 160);
				obs_source_release(src);
			}
			QJsonObject obj;
			obj["sceneItemId"] = static_cast<qint64>(it.sceneItemId);
			obj["thumbnail"] = data;
			thumbs.append(obj);
		}
		QJsonObject res;
		res["type"] = "thumbnails";
		res["items"] = thumbs;
		if (req.contains("requestId"))
			res["requestId"] = req.value("requestId");
		return res;
	}

	// Unknown type
	QJsonObject err;
	err["type"] = "error";
	err["message"] = QString("unknown type: %1").arg(type);
	if (req.contains("requestId"))
		err["requestId"] = req.value("requestId");
	return err;
}

} // namespace irl_protocol
