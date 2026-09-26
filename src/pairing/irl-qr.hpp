#pragma once

#include <QImage>
#include <QString>

// Renders a QR code for the given text. The payload format is:
//   IRLTOOLKIT:ws://<host>:<port>?token=<hex>
// (documented here so the PWA parser and a future relay stay compatible)
QImage renderQrImage(const QString &text, int pixels = 192);
