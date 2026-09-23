#pragma once

#include <cstdint>
#include <string>
#include <vector>

struct CanvasInfo {
	uint32_t width = 0;
	uint32_t height = 0;
};

struct SceneItemInfo {
	int64_t sceneItemId = 0;
	std::string sourceName;
	std::string sourceType;
	float x = 0.f;
	float y = 0.f;
	float width = 0.f;
	float height = 0.f;
	float scaleX = 1.f;
	float scaleY = 1.f;
	float rotation = 0.f;
	bool visible = true;
};

struct SceneInfo {
	std::string name;
	CanvasInfo canvas;
	std::vector<SceneItemInfo> items;
};

namespace obs_scene_service {

bool getCanvasInfo(CanvasInfo &out);
SceneInfo getCurrentSceneInfo();

} // namespace obs_scene_service
