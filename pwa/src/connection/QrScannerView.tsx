import { useEffect, useRef, useState, useCallback } from 'react';

interface QrScannerViewProps {
  onScan: (code: string) => void;
}

export function QrScannerView({ onScan }: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [detectorSupported, setDetectorSupported] = useState<boolean>(true);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung pada browser ini.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setHasPermission(true);

      // Start QR Barcode Detection if supported
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (BarcodeDetectorClass) {
        setDetectorSupported(true);
        try {
          const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
          scanIntervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2 || !scanning) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                const raw = barcodes[0].rawValue.trim();
                navigator.vibrate?.(40);
                setScanning(false);
                onScan(raw);
              }
            } catch {
              // frame detection error, ignore and continue
            }
          }, 350);
        } catch {
          // BarcodeDetector failed to initialize
          setDetectorSupported(false);
        }
      } else {
        setDetectorSupported(false);
      }
    } catch (err: unknown) {
      setHasPermission(false);
      const message = err instanceof Error ? err.message : 'Gagal mengakses kamera.';
      setErrorMsg(message);
    }
  }, [stopCamera, scanning, onScan]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      {/* Live Video Stream from Device Camera */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: hasPermission ? 'block' : 'none',
        }}
      />

      {/* Permission / Error Fallback */}
      {hasPermission === false && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            textAlign: 'center',
            backgroundColor: '#18181b',
            color: '#a1a1aa',
            fontSize: 13,
            gap: 12,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
          <div>{errorMsg || 'Akses kamera tidak diizinkan.'}</div>
          <button
            type="button"
            onClick={startCamera}
            style={{
              backgroundColor: '#27272a',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Laser Scanning Animation Line */}
      {hasPermission && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(250, 200, 0, 0.8) 50%, rgba(255,255,255,0) 100%)',
            boxShadow: '0 0 12px rgba(250, 200, 0, 0.9)',
            top: '45%',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Target Corner Frame / Reticle Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 170,
          height: 170,
          border: '1.5px solid rgba(255, 255, 255, 0.25)',
          borderRadius: 14,
          pointerEvents: 'none',
        }}
      />

      {/* Helpful banner if BarcodeDetector is not supported natively in this browser */}
      {hasPermission && !detectorSupported && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            right: 12,
            padding: '6px 10px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            border: '1px solid rgba(250, 200, 0, 0.3)',
            borderRadius: 8,
            color: '#fef08a',
            fontSize: 10.5,
            textAlign: 'center',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
          }}
        >
          Kamera aktif. Auto-scan memerlukan browser Chrome/Edge/iOS 17+. Gunakan tab <b>Tautan</b> jika kode belum terdeteksi.
        </div>
      )}
    </div>
  );
}
