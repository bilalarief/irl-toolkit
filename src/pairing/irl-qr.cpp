#include "pairing/irl-qr.hpp"

#include <qrcodegen.hpp>

using namespace qrcodegen;

QImage renderQrImage(const QString &text, int pixels)
{
	const QrCode qr = QrCode::encodeText(text.toUtf8().constData(), QrCode::Ecc::MEDIUM);
	const int n = qr.getSize();
	const int border = 4;
	QImage img(n + border * 2, n + border * 2, QImage::Format_RGB888);
	img.fill(Qt::white);
	for (int y = 0; y < n; ++y) {
		for (int x = 0; x < n; ++x) {
			if (qr.getModule(x, y))
				img.setPixel(x + border, y + border, qRgb(0, 0, 0));
		}
	}
	if (img.width() != pixels)
		img = img.scaled(pixels, pixels, Qt::IgnoreAspectRatio, Qt::FastTransformation);
	return img;
}
