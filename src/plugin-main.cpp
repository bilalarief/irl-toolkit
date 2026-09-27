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
#include "net/irl-relay.hpp"
#include "net/irl-websocket-server.hpp"
#include "pairing/irl-pairing.hpp"

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE(PLUGIN_NAME, "en-US")

static IRLToolkitDock *irl_toolkit_dock = nullptr;
static IRLWebSocketServer *irl_ws_server = nullptr;
static IRLPairingManager *irl_pairing = nullptr;
static IRLRelayClient *irl_relay = nullptr;

IRLWebSocketServer *irl_get_websocket_server()
{
	return irl_ws_server;
}

IRLPairingManager *irl_get_pairing_manager()
{
	return irl_pairing;
}

IRLRelayClient *irl_get_relay_client()
{
	return irl_relay;
}

// Tools -> IRL Toolkit: guaranteed way to bring the dock back if it was
// closed with X and the View -> Docks toggle misbehaves.
static void on_tools_menu_show(void *private_data)
{
	(void)private_data;
	if (irl_toolkit_dock) {
		irl_toolkit_dock->setVisible(true);
		irl_toolkit_dock->raise();
		irl_toolkit_dock->activateWindow();
	}
}

bool obs_module_load(void)
{
	obs_log(LOG_INFO, "plugin loaded successfully (version %s)", PLUGIN_VERSION);
	obs_log(LOG_INFO, "protocol features: save_changes(+order/delete) get_scene get_scenes switch_scene");

	QMainWindow *mainWindow = static_cast<QMainWindow *>(obs_frontend_get_main_window());
	if (!mainWindow) {
		obs_log(LOG_WARNING, "failed to get OBS main window - dock will not be created");
		return true;
	}

	// Pairing manager must exist before the dock (dock shows QR/code)
	irl_pairing = new IRLPairingManager(mainWindow);
	irl_pairing->regenerate();

	// Start WebSocket server for PWA (local dev: ws://localhost:8087)
	irl_ws_server = new IRLWebSocketServer(mainWindow);
	if (!irl_ws_server->start(8087)) {
		obs_log(LOG_WARNING, "WebSocket server not started - PWA will not connect");
	}

	// Internet relay (dormant unless Supabase URL + key are set in dock settings)
	irl_relay = new IRLRelayClient(mainWindow);

	irl_toolkit_dock = new IRLToolkitDock(mainWindow);

	const char *title = obs_module_text("IRLToolkitDockTitle");
	if (!title || title[0] == '\0')
		title = "IRL Toolkit";

	obs_frontend_add_dock_by_id("irl-toolkit-dock", title, irl_toolkit_dock);
	obs_frontend_add_tools_menu_item("IRL Toolkit", on_tools_menu_show, nullptr);

	obs_log(LOG_INFO, "IRL Toolkit dock created");
	return true;
}

void obs_module_unload(void)
{
	obs_log(LOG_INFO, "plugin unloaded");
	if (irl_ws_server) {
		irl_ws_server->stop();
		irl_ws_server->deleteLater();
		irl_ws_server = nullptr;
	}
	if (irl_pairing) {
		irl_pairing->deleteLater();
		irl_pairing = nullptr;
	}
	if (irl_relay) {
		irl_relay->deleteLater();
		irl_relay = nullptr;
	}
	// Dock is parented to main window and will be destroyed automatically
	irl_toolkit_dock = nullptr;
}
