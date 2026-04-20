import React, { useEffect, useRef, useState } from 'react';
import { XMarkIcon, ArrowPathIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const LiveViewer = ({ employeeId, employeeName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullScreen, setFullScreen] = useState(false);
  
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);

  const connectSignaling = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/monitor/${employeeId}/`;
    
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      setLoading(true);
      // Wait a moment for room join then send offer
      setTimeout(sendOffer, 1000);
    };

    socketRef.current.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'signal') {
        const { data } = msg;
        if (data.type === 'answer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setLoading(false);
        } else if (data.type === 'candidate') {
          if (pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        }
      }
    };

    socketRef.current.onclose = () => setError("Signaling connection lost.");
    socketRef.current.onerror = () => setError("Signaling error occurred.");
  };

  const sendOffer = async () => {
    try {
      const pc = createPeerConnection();
      const offer = await pc.createOffer({ offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      
      socketRef.current.send(JSON.stringify({
        action: 'signal',
        data: { type: 'offer', offer: pc.localDescription }
      }));
    } catch (err) {
      console.error("Offer error:", err);
      setError("Failed to initiate stream handshake.");
    }
  };

  const createPeerConnection = () => {
    if (pcRef.current) pcRef.current.close();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.send(JSON.stringify({
          action: 'signal',
          data: { type: 'candidate', candidate: e.candidate }
        }));
      }
    };

    pc.ontrack = (e) => {
      if (videoRef.current) {
        videoRef.current.srcObject = e.streams[0];
        setLoading(false);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setError("WebRTC Connection failed. Employee may be offline or behind a strict firewall.");
      }
    };

    pcRef.current = pc;
    return pc;
  };

  useEffect(() => {
    connectSignaling();
    return () => {
      if (pcRef.current) pcRef.current.close();
      if (socketRef.current) socketRef.current.close();
    };
  }, [employeeId]);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-950/80 transition-all duration-300`}>
      <div className={`bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl overflow-hidden flex flex-col transition-all duration-500 ${fullScreen ? 'w-full h-full' : 'max-w-5xl w-full aspect-video'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h3 className="font-bold text-slate-200">LIVE MONITORING: <span className="text-indigo-400 uppercase tracking-tighter">{employeeName}</span></h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setFullScreen(!fullScreen)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                title="Toggle Fullscreen"
            >
              <ArrowsPointingOutIcon className="h-5 w-5" />
            </button>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-rose-500/20 rounded-full text-slate-400 hover:text-rose-400 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Video Surface */}
        <div className="flex-1 relative bg-black flex items-center justify-center group">
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 z-10">
              <ArrowPathIcon className="h-10 w-10 text-indigo-500 animate-spin" />
              <p className="text-slate-400 text-sm font-medium animate-pulse">Establishing HD Secure Link...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 z-10 p-8 text-center">
              <div className="p-4 bg-rose-500/10 rounded-full">
                <XMarkIcon className="h-10 w-10 text-rose-500" />
              </div>
              <h4 className="text-white font-bold">Link Interrupted</h4>
              <p className="text-slate-400 text-sm max-w-md">{error}</p>
              <button 
                onClick={() => { setError(null); connectSignaling(); }}
                className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all"
              >
                Retry Connection
              </button>
            </div>
          )}
          
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            className="w-full h-full object-contain"
          />

          {/* Overlay Info */}
          {!loading && !error && (
            <div className="absolute bottom-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Stream Quality</p>
              <p className="text-xs text-white">High Definition • 15 FPS • Encrypted</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveViewer;
