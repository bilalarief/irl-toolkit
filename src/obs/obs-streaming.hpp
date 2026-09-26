#pragma once

#include <string>

namespace obs_streaming {

bool isStreamingActive();
void startStreaming();
void stopStreaming();

struct StreamSettings {
	std::string serviceId;
	std::string service;
	std::string server;
	std::string key;
};

// Reads the current streaming service (RTMP server/key) for display.
// The key is only ever sent to already-paired PWA clients.
StreamSettings getStreamSettings();

} // namespace obs_streaming
