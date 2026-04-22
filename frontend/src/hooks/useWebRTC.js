import { useContext, useEffect, useCallback } from 'react';
import { ScreenShareContext } from '../context/ScreenShareContext';
import monitoringAPI from '../services/monitoringAPI';

const useWebRTC = () => {
    const {
        stream, setStream,
        isSharing, setIsSharing,
        roomId, setRoomId,
        pcRef, wsRef, streamRef,
        stopSharing
    } = useContext(ScreenShareContext);

    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Placeholder for TURN
        // { urls: 'turn:YOUR_TURN_SERVER:3478', username: 'user', credential: 'pass' }
    ];

    const createPeerConnection = useCallback((rid) => {
        const pc = new RTCPeerConnection({
            iceServers,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate
                }));
            }
        };

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                // Optimization: Tell the browser this is text-heavy content (Screen Share)
                if (track.kind === 'video') {
                    track.contentHint = 'text';
                }

                const sender = pc.addTrack(track, streamRef.current);
                
                // Quality Optimization
                try {
                    const params = sender.getParameters();
                    if (!params.encodings) params.encodings = [{}];
                    params.encodings[0].maxBitrate = 8000 * 1000; // 8 Mbps Ultra Quality
                    params.degradationPreference = 'maintain-resolution'; // Prioritize text clarity
                    sender.setParameters(params);
                } catch (e) {
                    console.warn("Failed to set sender parameters:", e);
                }
            });
        }

        pcRef.current = pc;
        return pc;
    }, []);

    const startSharing = async () => {
        try {
            // 1. Shift check
            const shiftCheck = await monitoringAPI.checkShift();
            if (!shiftCheck.data.within_shift) {
                alert(`Live monitoring is only active during your shift hours (${shiftCheck.data.shift_start} - ${shiftCheck.data.shift_end})`);
                return;
            }

            // 2. Media Capture (Do this FIRST)
            let captureStream = null;
            while (true) {
                try {
                    captureStream = await navigator.mediaDevices.getDisplayMedia({
                        video: { 
                            displaySurface: 'monitor',
                            width: { ideal: 1920, max: 1920 },
                            height: { ideal: 1080, max: 1080 },
                            frameRate: { ideal: 30, max: 60 }
                        }
                    });
                } catch (e) {
                    throw e; // Rethrow to catch block (e.g. user cancelled)
                }

                const track = captureStream.getVideoTracks()[0];
                if (track.getSettings().displaySurface === 'monitor') {
                    break;
                } else {
                    track.stop();
                    alert("Please select 'Entire Screen' only to proceed.");
                }
            }

            // 3. Start/Restart Session on Backend (Only after stream is secured)
            const session = await monitoringAPI.startSession();
            const rid = session.data.room_id;
            setRoomId(rid);

            setStream(captureStream);
            streamRef.current = captureStream;
            setIsSharing(true);

            // 4. WebSocket Signaling
            const wsBase = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
            const wsUrl = `${wsBase}/ws/monitoring/${rid}/`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = async (e) => {
                const data = JSON.parse(e.data);
                try {
                    if (data.type === 'viewer-joined') {
                        // Start negotiation when a viewer joins
                        const pc = createPeerConnection(rid);
                        const offer = await pc.createOffer();
                        
                        // SDP Bandwidth Modification (Ultra HD/HD)
                        let sdp = offer.sdp;
                        if (!sdp.includes('b=AS:')) {
                            sdp = sdp.replace(/c=IN IP4 (.*)\r\n/g, `c=IN IP4 $1\r\nb=AS:8000\r\n`);
                        }
                        
                        await pc.setLocalDescription({ type: 'offer', sdp });
                        ws.send(JSON.stringify({ type: 'offer', sdp }));
                    } else if (data.type === 'answer') {
                        const pc = pcRef.current;
                        if (pc && pc.signalingState === 'have-local-offer') {
                            await pc.setRemoteDescription(new RTCSessionDescription(data));
                        }
                    } else if (data.type === 'ice-candidate') {
                        const pc = pcRef.current;
                        if (pc && data.candidate) {
                            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                        }
                    }
                } catch (err) {
                    console.warn("WebRTC signaling warning:", err);
                }
            };

            ws.onclose = () => {
                console.log("Signaling WebSocket closed.");
            };

        } catch (err) {
            console.error("Failed to start screen share:", err);
            // DO NOT stopSharing() here — we want the 'Resume' banner to persist
            // so the user can try again if they clicked Cancel by mistake.
        }
    };

    return { startSharing, stopSharing, isSharing, stream };
};

export default useWebRTC;
