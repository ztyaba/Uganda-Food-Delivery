import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { REALTIME_STREAM_URL } from '../utils/config.js';

const KNOWN_EVENTS = [
  'realtime:ready',
  'realtime:error',
  'ping',
  'order:new',
  'order:updated',
  'order:progress',
  'order:available',
  'order:taken',
  'order:driverAccepted',
  'order:pickedUp',
  'order:delivered',
  'payout:completed',
  'payout:auto'
];

const RealtimeContext = createContext(null);

function parseEventData(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function RealtimeProvider({ children }) {
  const { token } = useAuth();
  const [ready, setReady] = useState(false);
  const sourceRef = useRef(null);
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
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
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

    const streamUrl = `${REALTIME_STREAM_URL}?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);
    sourceRef.current = eventSource;
    setReady(false);

    const listenerMap = new Map();

    KNOWN_EVENTS.forEach((eventName) => {
      const listener = (event) => {
        const payload = parseEventData(event.data);
        if (eventName === 'realtime:ready') {
          setReady(true);
        }
        if (eventName === 'realtime:error') {
          setReady(false);
        }
        dispatch(eventName, payload);
      };
      listenerMap.set(eventName, listener);
      eventSource.addEventListener(eventName, listener);
    });

    const errorListener = () => {
      setReady(false);
    };
    eventSource.addEventListener('error', errorListener);

    return () => {
      listenerMap.forEach((listener, eventName) => {
        eventSource.removeEventListener(eventName, listener);
      });
      eventSource.removeEventListener('error', errorListener);
      eventSource.close();
      if (sourceRef.current === eventSource) {
        sourceRef.current = null;
      }
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

  const value = useMemo(() => ({ ready, subscribe }), [ready, subscribe]);
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
