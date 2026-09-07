import { forwardRef, useEffect, useState } from "react";

type Props = {
  /** Reported once the stream is playing, so the app knows canvases can size themselves against it. */
  onReady?: () => void;
};

type CameraState = "requesting" | "ready" | "denied" | "unsupported";

const CameraBackground = forwardRef<HTMLVideoElement, Props>(({ onReady }, ref) => {
  const [state, setState] = useState<CameraState>("requesting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = (ref as React.RefObject<HTMLVideoElement>).current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setState("ready");
        onReady?.();
      } catch (err) {
        setState("denied");
      }
    }

    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="camera-layer">
      <video ref={ref} className="camera-video" playsInline muted autoPlay />
      {state !== "ready" && (
        <div className="camera-fallback">
          {state === "requesting" && <p>Requesting camera access…</p>}
          {state === "denied" && (
            <p>
              Camera access was denied. You can still draw and play notes — allow
              camera permission in your browser settings to see the video feed.
            </p>
          )}
          {state === "unsupported" && (
            <p>This browser doesn't support camera access. Drawing and audio still work.</p>
          )}
        </div>
      )}
    </div>
  );
});

CameraBackground.displayName = "CameraBackground";

export default CameraBackground;
