import { forwardRef, useEffect, useRef, useState } from 'react';

type Props = {
    onReady?: () => void;
    onVideoReady?: (video: HTMLVideoElement) => void;
};

type CameraState = 'requesting' | 'ready' | 'denied' | 'unsupported' | 'error';

const CameraBackground = forwardRef<HTMLVideoElement, Props>(({ onReady, onVideoReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    const [state, setState] = useState<CameraState>('requesting');

    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let stream: MediaStream | null = null;
        let cancelled = false;

        async function start() {
            if (!navigator.mediaDevices?.getUserMedia) {
                setState('unsupported');
                return;
            }

            try {
                setState('requesting');

                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: {
                            ideal: 'user'
                        }
                    },
                    audio: false
                });

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());

                    return;
                }

                const video = videoRef.current;

                if (!video) {
                    throw new Error('Video element is not available');
                }

                video.srcObject = stream;
                video.muted = true;
                video.playsInline = true;

                await video.play();

                onVideoReady?.(video);

                if (typeof ref === 'object' && ref !== null) {
                    ref.current = video;
                }

                setState('ready');

                onReady?.();
            } catch (error) {
                console.error('Camera error:', error);

                if (error instanceof DOMException) {
                    console.error('Camera error name:', error.name);

                    console.error('Camera error message:', error.message);

                    if (error.name === 'NotAllowedError') {
                        setErrorMessage(
                            'Camera permission was denied. Please allow camera access in your browser settings.'
                        );
                    } else if (error.name === 'NotFoundError') {
                        setErrorMessage('No camera was found on this device.');
                    } else if (error.name === 'NotReadableError') {
                        setErrorMessage('Camera is already being used by another application.');
                    } else {
                        setErrorMessage(error.message || 'Unable to access the camera.');
                    }
                } else {
                    setErrorMessage('Unable to access the camera.');
                }

                setState('error');
            }
        }

        start();

        return () => {
            cancelled = true;

            stream?.getTracks().forEach((track) => track.stop());

            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [onReady, onVideoReady, ref]);

    return (
        <div className='camera-layer'>
            <video ref={videoRef} className='camera-video' playsInline muted autoPlay />

            {state !== 'ready' && (
                <div className='camera-fallback'>
                    {state === 'requesting' && <p>Requesting camera access…</p>}

                    {(state === 'denied' || state === 'error') && <p>{errorMessage}</p>}

                    {state === 'unsupported' && <p>This browser doesn't support camera access.</p>}
                </div>
            )}
        </div>
    );
});

CameraBackground.displayName = 'CameraBackground';

export default CameraBackground;
