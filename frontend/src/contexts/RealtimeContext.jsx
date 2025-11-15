import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { SOCKET_BASE_URL } from '../utils/config.js';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setReady(false);
      return;
    }

    const instance = io(SOCKET_BASE_URL, {
      transports: ['websocket'],
      autoConnect: false
    });

    setSocket(instance);
    setReady(false);

    const handleConnect = () => {
      instance.emit('register', { token });
    };
    const handleReady = () => setReady(true);
    const handleError = () => {
      setReady(false);
      instance.disconnect();
    };
    const handleDisconnect = () => setReady(false);

    instance.on('connect', handleConnect);
    instance.on('realtime:ready', handleReady);
    instance.on('realtime:error', handleError);
    instance.on('disconnect', handleDisconnect);

    instance.connect();

    return () => {
      instance.off('connect', handleConnect);
      instance.off('realtime:ready', handleReady);
      instance.off('realtime:error', handleError);
      instance.off('disconnect', handleDisconnect);
      instance.disconnect();
      setReady(false);
      setSocket((current) => (current === instance ? null : current));
    };
  }, [token]);

  const value = useMemo(() => ({ socket, ready }), [socket, ready]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
