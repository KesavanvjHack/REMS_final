import React, { useEffect, useRef, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { VideoCameraIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';

const ScreenSharer = () => {
  const { user } = useContext(AuthContext);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);
  
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnections = useRef({}); // { managerId: RTCPeerConnection }
  
  // Only employees share screens
  if (!user || user.role !== 'employee') return null;

  const startSharing = async () => {
    try {
      if (streamRef.current) return streamRef.current;

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 }
        },
        audio: false
      });

      // STRICT CHECK: ENTIRE SCREEN ONLY
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      // Some browsers use displaySurface, others might not support this specific check easily
      // but we try to enforce it where possible
      if (settings.displaySurface && settings.displaySurface !== 'monitor') {
        track.stop();
        throw new Error("UNAUTHORIZED_SURFACE");
      }

      streamRef.current = stream;
      setIsSharing(true);
      setError(null);

      // Handle stream end (user clicks browser 'Stop Sharing' button)
      track.onended = () => {
        stopSharing();
        window.dispatchEvent(new CustomEvent('rems_monitoring_stopped'));
      };

      // Connect to signaling
      connectSignaling();

      return stream;
    } catch (err) {
      if (err.message === "UNAUTHORIZED_SURFACE") {
         toast.error("Sharing Aborted: You MUST share your 'Entire Screen' to start work.", { duration: 5000 });
      } else {
         console.error("Screen share error:", err);
         toast.error("Failed to start screen monitoring. Please ensure permissions are granted.");
      }
      setError(err.message);
      throw err;
    }
  };

  const stopSharing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsSharing(false);
    
    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const connectSignaling = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/monitor/${user.id}/`;
    
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'signal') {
        const { sender_id, data } = msg;

        if (data.type === 'offer') {
          await handleOffer(sender_id, data);
        } else if (data.type === 'candidate') {
          const pc = peerConnections.current[sender_id];
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
    };
  };

  const handleOffer = async (managerId, offer) => {
    const pc = createPeerConnection(managerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    socketRef.current.send(JSON.stringify({
      action: 'signal',
      data: { type: 'answer', answer: pc.localDescription }
    }));
  };

  const createPeerConnection = (managerId) => {
    if (peerConnections.current[managerId]) {
      peerConnections.current[managerId].close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Add current stream tracks to this connection
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.send(JSON.stringify({
          action: 'signal',
          data: { type: 'candidate', candidate: e.candidate }
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        delete peerConnections.current[managerId];
      }
    };

    peerConnections.current[managerId] = pc;
    return pc;
  };

  useEffect(() => {
    // Listen for start command from WorkSession page
    const handleStartWork = async (e) => {
      try {
        await startSharing();
        // Notify WorkSession that sharing is ready
        window.dispatchEvent(new CustomEvent('rems_monitoring_ready'));
      } catch (err) {
        // WorkSession will handle restriction
      }
    };

    const handleStopWork = () => stopSharing();

    window.addEventListener('rems_start_monitoring', handleStartWork);
    window.addEventListener('rems_stop_monitoring', handleStopWork);

    return () => {
      window.removeEventListener('rems_start_monitoring', handleStartWork);
      window.removeEventListener('rems_stop_monitoring', handleStopWork);
      stopSharing();
    };
  }, []);

  if (!isSharing) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl backdrop-blur-md shadow-2xl animate-pulse">
      <div className="w-2 y-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
      <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-400">Live Monitoring Active</span>
      <VideoCameraIcon className="h-4 w-4 text-emerald-400" />
    </div>
  );
};

export default ScreenSharer;
