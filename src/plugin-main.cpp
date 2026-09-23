/*
IRL Toolkit
Copyright (C) 2026 IRL Toolkit Contributors

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program. If not, see <https://www.gnu.org/licenses/>.
*/

#include <obs-module.h>
#include <obs-frontend-api.h>
#include <plugin-support.h>

#include <QMainWindow>

#include "irl-toolkit-dock.hpp"

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE(PLUGIN_NAME, "en-US")

static IRLToolkitDock *irl_toolkit_dock = nullptr;

bool obs_module_load(void)
{
	obs_log(LOG_INFO, "plugin loaded successfully (version %s)", PLUGIN_VERSION);

	QMainWindow *mainWindow = static_cast<QMainWindow *>(obs_frontend_get_main_window());
	if (!mainWindow) {
		obs_log(LOG_WARNING, "failed to get OBS main window - dock will not be created");
		return true;
	}

	irl_toolkit_dock = new IRLToolkitDock(mainWindow);

	const char *title = obs_module_text("IRLToolkitDockTitle");
	if (!title || title[0] == '\0')
		title = "IRL Toolkit";

	obs_frontend_add_dock_by_id("irl-toolkit-dock", title, irl_toolkit_dock);

	obs_log(LOG_INFO, "IRL Toolkit dock created");
	return true;
}

void obs_module_unload(void)
{
	obs_log(LOG_INFO, "plugin unloaded");
	// Dock is parented to main window and will be destroyed automatically
	irl_toolkit_dock = nullptr;
}
