#include "obs/obs-streaming.hpp"

#include <obs-frontend-api.h>

namespace obs_streaming {

bool isStreamingActive()
{
	return obs_frontend_streaming_active();
}

void startStreaming()
{
	if (!obs_frontend_streaming_active())
		obs_frontend_start_streaming();
}

void stopStreaming()
{
	if (obs_frontend_streaming_active())
		obs_frontend_stop_streaming();
}

} // namespace obs_streaming
