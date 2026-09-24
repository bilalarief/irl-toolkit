#pragma once

#include <QString>

// Returns base64 JPEG of OBS preview (data:image/jpeg;base64,...)
// Empty string if capture failed
QString capturePreviewBase64(int maxWidth = 480);
