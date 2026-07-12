import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "../constants.js";

// Opt-in transport for later integration. Importing this hook does not connect.
export function useLiveStream(onMessage) {
  const [status, setStatus] = useState("disconnected");
  const socketRef = useRef(null);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current) return;
    setStatus("connecting");
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    socket.onopen = () => setStatus("live");
    socket.onmessage = (event) => {
      try { onMessage(JSON.parse(event.data)); } catch { /* Ignore malformed frames. */ }
    };
    socket.onerror = () => setStatus("error");
    socket.onclose = () => {
      socketRef.current = null;
      setStatus("disconnected");
    };
  }, [onMessage]);

  const sendConfig = useCallback((config) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "config", ...config }));
    }
  }, []);

  useEffect(() => disconnect, [disconnect]);
  return { status, connect, disconnect, sendConfig };
}
