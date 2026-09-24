#pragma once

#include <QString>

class obs_source_t;

// Returns base64 JPEG of OBS preview (data:image/jpeg;base64,...)
// Empty string if capture failed
QString capturePreviewBase64(int maxWidth = 480);

// Per-source thumbnail (for WYSIWYG per overlay)
QString captureSourceThumbnail(obs_source_t *source, int maxWidth = 160);
