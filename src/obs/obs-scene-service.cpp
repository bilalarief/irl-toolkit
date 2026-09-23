#include "obs/obs-scene-service.hpp"

#include <obs-frontend-api.h>
#include <obs.h>

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

} // namespace obs_scene_service
