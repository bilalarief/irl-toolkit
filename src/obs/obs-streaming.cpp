#include "obs/obs-streaming.hpp"

#include <obs-frontend-api.h>
#include <obs-service.h>

namespace obs_streaming {

bool isStreamingActive()
{
	return obs_frontend_streaming_active();
}

void startStreaming()
{
	if (!obs_frontend_streaming_active())
		obs_frontend_streaming_start();
}

void stopStreaming()
{
	if (obs_frontend_streaming_active())
		obs_frontend_streaming_stop();
}

StreamSettings getStreamSettings()
{
	StreamSettings out;
	obs_service_t *svc = obs_frontend_get_streaming_service();
	if (!svc)
		return out;
	const char *id = obs_service_get_id(svc);
	if (id)
		out.serviceId = id;
	// Settings object is owned by the service — read only, do not release.
	obs_data_t *settings = obs_service_get_settings(svc);
	if (settings) {
		const char *service = obs_data_get_string(settings, "service");
		const char *server = obs_data_get_string(settings, "server");
		const char *key = obs_data_get_string(settings, "key");
		if (service)
			out.service = service;
		if (server)
			out.server = server;
		if (key)
			out.key = key;
	}
	obs_service_release(svc);
	return out;
}

} // namespace obs_streaming
