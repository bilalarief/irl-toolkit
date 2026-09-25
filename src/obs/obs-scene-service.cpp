#include "obs/obs-scene-service.hpp"

#include <obs-frontend-api.h>
#include <obs.h>

#include <QJsonArray>
#include <QJsonObject>

namespace obs_scene_service {

bool getCanvasInfo(CanvasInfo &out)
{
	obs_video_info ovi;
	if (!obs_get_video_info(&ovi))
		return false;
	out.width = ovi.base_width;
	out.height = ovi.base_height;
	return true;
}

static bool enumSceneItems(obs_scene_t *scene, obs_sceneitem_t *item, void *param)
{
	(void)scene;
	auto *items = static_cast<std::vector<SceneItemInfo> *>(param);

	SceneItemInfo info;
	info.sceneItemId = obs_sceneitem_get_id(item);

	obs_source_t *src = obs_sceneitem_get_source(item);
	if (src) {
		const char *name = obs_source_get_name(src);
		const char *type = obs_source_get_id(src);
		info.sourceName = name ? name : "";
		info.sourceType = type ? type : "";
		info.width = static_cast<float>(obs_source_get_width(src));
		info.height = static_cast<float>(obs_source_get_height(src));
	}

	struct vec2 pos;
	obs_sceneitem_get_pos(item, &pos);
	info.x = pos.x;
	info.y = pos.y;

	struct vec2 scale;
	obs_sceneitem_get_scale(item, &scale);
	info.scaleX = scale.x;
	info.scaleY = scale.y;

	info.rotation = obs_sceneitem_get_rot(item);
	info.visible = obs_sceneitem_visible(item);

	items->push_back(std::move(info));
	return true;
}

SceneInfo getCurrentSceneInfo()
{
	SceneInfo result;
	getCanvasInfo(result.canvas);

	obs_source_t *curSceneSource = obs_frontend_get_current_scene();
	if (!curSceneSource)
		return result;

	const char *name = obs_source_get_name(curSceneSource);
	result.name = name ? name : "";

	obs_scene_t *scene = obs_scene_from_source(curSceneSource);
	if (scene) {
		obs_scene_enum_items(scene, enumSceneItems, &result.items);
	}

	obs_source_release(curSceneSource);
	return result;
}

bool applySceneChanges(const QJsonArray &changes, QString &error)
{
	obs_source_t *curSceneSource = obs_frontend_get_current_scene();
	if (!curSceneSource) {
		error = "no current scene";
		return false;
	}

	obs_scene_t *scene = obs_scene_from_source(curSceneSource);
	if (!scene) {
		obs_source_release(curSceneSource);
		error = "current source is not a scene";
		return false;
	}

	bool allOk = true;

	for (const auto &val : changes) {
		if (!val.isObject())
			continue;
		QJsonObject obj = val.toObject();

		// sceneItemId may be in top level or inside transform
		qint64 id = 0;
		if (obj.contains("sceneItemId"))
			id = obj.value("sceneItemId").toVariant().toLongLong();
		else if (obj.contains("id"))
			id = obj.value("id").toVariant().toLongLong();
		if (id == 0) {
			error = "missing sceneItemId";
			allOk = false;
			continue;
		}

		QJsonObject patch;
		if (obj.contains("transform") && obj.value("transform").isObject())
			patch = obj.value("transform").toObject();
		else if (obj.contains("patch") && obj.value("patch").isObject())
			patch = obj.value("patch").toObject();
		else
			patch = obj; // flat

		// Find item by id
		struct FindCtx {
			qint64 id;
			obs_sceneitem_t *found = nullptr;
		} ctx{id, nullptr};

		obs_scene_enum_items(
			scene,
			[](obs_scene_t *, obs_sceneitem_t *item, void *param) {
				auto *c = static_cast<FindCtx *>(param);
				if (obs_sceneitem_get_id(item) == c->id) {
					c->found = item;
					return false; // stop
				}
				return true;
			},
			&ctx);

		if (!ctx.found) {
			error = QString("item %1 not found").arg(id);
			allOk = false;
			continue;
		}

		obs_sceneitem_t *item = ctx.found;

		// Deletion: remove the item from the scene (source itself is kept)
		if (obj.value("deleted").toBool(false)) {
			obs_sceneitem_remove(item);
			continue;
		}

		if (patch.contains("x") || patch.contains("y")) {
			struct vec2 pos;
			obs_sceneitem_get_pos(item, &pos);
			if (patch.contains("x"))
				pos.x = float(patch.value("x").toDouble(pos.x));
			if (patch.contains("y"))
				pos.y = float(patch.value("y").toDouble(pos.y));
			obs_sceneitem_set_pos(item, &pos);
		}
		if (patch.contains("scaleX") || patch.contains("scaleY")) {
			struct vec2 scale;
			obs_sceneitem_get_scale(item, &scale);
			if (patch.contains("scaleX"))
				scale.x = float(patch.value("scaleX").toDouble(scale.x));
			if (patch.contains("scaleY"))
				scale.y = float(patch.value("scaleY").toDouble(scale.y));
			obs_sceneitem_set_scale(item, &scale);
		}
		if (patch.contains("rotation")) {
			float rot = float(patch.value("rotation").toDouble(obs_sceneitem_get_rot(item)));
			obs_sceneitem_set_rot(item, rot);
		}
		if (patch.contains("visible")) {
			bool vis = patch.value("visible").toBool(obs_sceneitem_visible(item));
			obs_sceneitem_set_visible(item, vis);
		}
		// width/height changes are applied as scale adjustment if source size known
		if (patch.contains("width") || patch.contains("height")) {
			obs_source_t *src = obs_sceneitem_get_source(item);
			if (src) {
				uint32_t srcW = obs_source_get_width(src);
				uint32_t srcH = obs_source_get_height(src);
				if (srcW && srcH) {
					struct vec2 scale;
					obs_sceneitem_get_scale(item, &scale);
					if (patch.contains("width")) {
						float newW = float(patch.value("width").toDouble(srcW * scale.x));
						scale.x = newW / float(srcW);
					}
					if (patch.contains("height")) {
						float newH = float(patch.value("height").toDouble(srcH * scale.y));
						scale.y = newH / float(srcH);
					}
					obs_sceneitem_set_scale(item, &scale);
				}
			}
		}
	}

	obs_source_release(curSceneSource);
	return allOk;
}

} // namespace obs_scene_service
