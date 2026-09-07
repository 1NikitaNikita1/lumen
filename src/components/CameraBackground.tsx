import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

type Props = {
    onReady?: () => void;
};

type CameraState = 'requesting' | 'ready' | 'denied' | 'unsupported' | 'error';

const CameraBackground = forwardRef<HTMLVideoElement, Props>(({ onReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [state, setState] = useState<CameraState>('requesting');
    const [errorMessage, setErrorMessage] = useState('');

    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    useEffect(() => {
        let cancelled = false;

        const startCamera = async () => {
            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                setState('unsupported');
                return;
            }

            try {
                setState('requesting');
                setErrorMessage('');

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'user' }
                    },
                    audio: false
                });

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;

                const video = videoRef.current;

                if (!video) {
                    throw new Error('Video element is not available');
                }

                video.srcObject = stream;
                video.muted = true;
                video.playsInline = true;

                await video.play();

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                setState('ready');
                onReady?.();
            } catch (error) {
                console.error('Camera error:', error);

                if (error instanceof DOMException) {
                    console.error('Camera error name:', error.name);
                    console.error('Camera error message:', error.message);

                    switch (error.name) {
                        case 'NotAllowedError':
                            setErrorMessage(
                                'Camera permission was denied. Please allow camera access in your browser settings.'
                            );
                            break;

                        case 'NotFoundError':
                            setErrorMessage('No camera was found on this device.');
                            break;

                        case 'NotReadableError':
                            setErrorMessage('Camera is already being used by another application.');
                            break;

                        case 'OverconstrainedError':
                            setErrorMessage('The requested camera configuration is not supported.');
                            break;

                        case 'SecurityError':
                            setErrorMessage('Camera access is blocked because of browser security settings.');
                            break;

                        default:
                            setErrorMessage(error.message || 'Unable to access the camera.');
                    }
                } else if (error instanceof Error) {
                    setErrorMessage(error.message);
                } else {
                    setErrorMessage('Unable to access the camera.');
                }

                setState('error');
            }
        };

        startCamera();

        return () => {
            cancelled = true;

            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }

            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [onReady]);

    return (
        <div className='camera-layer'>
            <video ref={videoRef} className='camera-video' playsInline muted autoPlay />

            {state !== 'ready' && (
                <div className='camera-fallback'>
                    {state === 'requesting' && <p>Requesting camera access…</p>}

                    {state === 'denied' && <p>{errorMessage}</p>}

                    {state === 'error' && <p>{errorMessage}</p>}

                    {state === 'unsupported' && (
                        <p>This browser doesn't support camera access. Drawing and audio still work.</p>
                    )}
                </div>
            )}
        </div>
    );
});

CameraBackground.displayName = 'CameraBackground';

export default CameraBackground;
