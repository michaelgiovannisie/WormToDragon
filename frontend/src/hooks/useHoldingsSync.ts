import { useEffect, useRef, useState } from "react";
import { API } from "../constants";

export interface HoldingsSyncStatus {
  state: "idle" | "running" | "completed" | "failed";
  completed: number;
  total: number;
  currentSymbol: string | null;
  failures: string[];
  summary: string | null;
}

const POLL_INTERVAL_MS = 2500;

export function useHoldingsSync(onComplete?: () => void) {
  const [status, setStatus] = useState<HoldingsSyncStatus>({
    state: "idle",
    completed: 0,
    total: 0,
    currentSymbol: null,
    failures: [],
    summary: null,
  });
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete; // always current, no stale closure

  const stopPolling = () => {
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/fmp/sync-holdings-bg/status`);
      if (!res.ok) return;
      const data: HoldingsSyncStatus = await res.json();
      setStatus(data);
      if (data.state !== "running") {
        stopPolling();
        if (data.state === "completed") onCompleteRef.current?.();
      }
    } catch {
      // Network error — keep polling silently
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
  };

  // On mount: pick up any job already running (e.g. user navigated away and back)
  useEffect(() => {
    fetchStatus().then(() => {
      setStatus(prev => {
        if (prev.state === "running") startPolling();
        return prev;
      });
    });
    return stopPolling;
  }, []);

  const start = async () => {
    if (starting || status.state === "running") return;
    setStarting(true);
    try {
      const res = await fetch(`${API}/fmp/sync-holdings-bg`, { method: "POST" });
      const data: HoldingsSyncStatus = await res.json();
      setStatus(data);
      if (res.status === 202 || data.state === "running") startPolling();
    } catch {
      // leave status unchanged
    } finally {
      setStarting(false);
    }
  };

  return { status, starting, start };
}
