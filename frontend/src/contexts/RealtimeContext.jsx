import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { SOCKET_BASE_URL } from '../utils/config.js';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [ready, setReady] = useState(false);
  const handlersRef = useRef(new Map());

  const dispatch = useCallback((eventName, payload) => {
    const listeners = handlersRef.current.get(eventName);
    if (!listeners || listeners.size === 0) {
      return;
    }
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error('Realtime listener error', error);
      }
    });
  }, []);

  useEffect(() => {
    if (!token) {
      setReady(false);
      setSocket((current) => {
        if (current) {
          current.disconnect();
        }
        return null;
      });
      return undefined;
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

    const handleReady = (payload) => {
      setReady(true);
      dispatch('realtime:ready', payload);
    };

    const handleError = (payload) => {
      setReady(false);
      dispatch('realtime:error', payload);
      instance.disconnect();
    };

    const handleDisconnect = () => {
      setReady(false);
    };

    const handleConnectError = (error) => {
      setReady(false);
      dispatch('realtime:error', { message: error?.message || 'Connection failed' });
    };

    const handleAny = (eventName, ...args) => {
      if (eventName === 'realtime:ready' || eventName === 'realtime:error') {
        return;
      }
      const payload = args.length > 1 ? args : args[0];
      dispatch(eventName, payload);
    };

    instance.on('connect', handleConnect);
    instance.on('realtime:ready', handleReady);
    instance.on('realtime:error', handleError);
    instance.on('disconnect', handleDisconnect);
    instance.on('connect_error', handleConnectError);
    instance.onAny(handleAny);

    instance.connect();

    return () => {
      instance.off('connect', handleConnect);
      instance.off('realtime:ready', handleReady);
      instance.off('realtime:error', handleError);
      instance.off('disconnect', handleDisconnect);
      instance.off('connect_error', handleConnectError);
      instance.offAny(handleAny);
      instance.disconnect();
      setReady(false);
      setSocket((current) => (current === instance ? null : current));
    };
  }, [token, dispatch]);

  const subscribe = useCallback((eventName, handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    if (!handlersRef.current.has(eventName)) {
      handlersRef.current.set(eventName, new Set());
    }
    const listeners = handlersRef.current.get(eventName);
    listeners.add(handler);
    return () => {
      const current = handlersRef.current.get(eventName);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        handlersRef.current.delete(eventName);
      }
    };
  }, []);

  const value = useMemo(() => ({ socket, ready, subscribe }), [socket, ready, subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
