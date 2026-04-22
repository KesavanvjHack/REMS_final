import { useState, useRef, useEffect, useCallback } from 'react';

const useViewerWebRTC = (roomId) => {
    const [stream, setStream] = useState(null);
    const pcRef = useRef(null);
    const wsRef = useRef(null);

    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ];

    const connect = useCallback(() => {
        if (!roomId) return;

        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/monitoring/${roomId}/`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        pc.ontrack = (event) => {
            setStream(event.streams[0]);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate
                }));
            }
        };

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'viewer-joined' }));
        };

        ws.onmessage = async (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));
            } else if (data.type === 'ice-candidate') {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else if (data.type === 'peer-left') {
                setStream(null);
            }
        };

        return () => {
            ws.close();
            pc.close();
        };
    }, [roomId]);

    useEffect(() => {
        const cleanup = connect();
        return cleanup;
    }, [connect]);

    return { stream };
};

export default useViewerWebRTC;
