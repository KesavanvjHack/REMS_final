import React, { createContext, useState, useRef, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import monitoringAPI from '../services/monitoringAPI';

export const ScreenShareContext = createContext();

export const ScreenShareProvider = ({ children }) => {
    const auth = useContext(AuthContext);
    const user = auth?.user;
    const [stream, setStream] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const [roomId, setRoomId] = useState(null);
    const pcRef = useRef(null);
    const wsRef = useRef(null);
    const streamRef = useRef(null);

    const stopSharing = async () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setStream(null);
        streamRef.current = null;
        setIsSharing(false);
        setRoomId(null);
        
        try {
            await monitoringAPI.stopSession();
        } catch (err) {
            console.error("Failed to stop session on backend:", err);
        }
    };

    // Cleanup on logout
    useEffect(() => {
        if (!user && isSharing) {
            stopSharing();
        }
    }, [user, isSharing]);

    // Restore session on mount
    useEffect(() => {
        const restoreSession = async () => {
            if (user?.role === 'employee' && !isSharing) {
                try {
                    const resp = await monitoringAPI.getCurrentSession();
                    if (resp.data && resp.data.is_active) {
                        setRoomId(resp.data.room_id);
                        setIsSharing(true);
                        // We don't have the stream yet (requires user gesture)
                    }
                } catch (err) {
                    // 404 is fine, just means no active session
                    if (err.response?.status !== 404) {
                        console.error("Error restoring session:", err);
                    }
                }
            }
        };
        restoreSession();
    }, [user]);

    // Handle shift enforcement periodically
    useEffect(() => {
        let interval;
        if (isSharing && user?.role === 'employee') {
            interval = setInterval(async () => {
                try {
                    const resp = await monitoringAPI.checkShift();
                    if (!resp.data.within_shift) {
                        console.log("Shift ended, stopping monitoring automatically.");
                        stopSharing();
                        alert("Your shift has ended. Live monitoring has been stopped.");
                    }
                } catch (err) {
                    console.error("Shift check failed:", err);
                }
            }, 60000); // Check every minute
        }
        return () => clearInterval(interval);
    }, [isSharing, user]);

    const value = {
        stream,
        setStream,
        isSharing,
        setIsSharing,
        roomId,
        setRoomId,
        pcRef,
        wsRef,
        streamRef,
        stopSharing
    };

    return (
        <ScreenShareContext.Provider value={value}>
            {children}
        </ScreenShareContext.Provider>
    );
};
