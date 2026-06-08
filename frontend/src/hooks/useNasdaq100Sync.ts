import { useEffect, useRef, useState } from "react";
import { API } from "../constants";

export interface SyncStatus {
  state: "idle" | "running" | "completed" | "failed";
  completed: number;
  total: number;
  currentSymbol: string | null;
  failures: string[];
  summary: string | null;
}

const POLL_INTERVAL_MS = 2500;

export function useNasdaq100Sync() {
  const [status, setStatus] = useState<SyncStatus>({
    state: "idle",
    completed: 0,
    total: 0,
    currentSymbol: null,
    failures: [],
    summary: null,
  });
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/fmp/sync-nasdaq100/status`);
      if (!res.ok) return;
      const data: SyncStatus = await res.json();
      setStatus(data);
      // Stop polling once the job is no longer running
      if (data.state !== "running") {
        stopPolling();
      }
    } catch {
      // Network error — keep polling silently
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
  };

  // On mount: fetch current status — picks up any job that was already running
  // (e.g. user navigated away and returned)
  useEffect(() => {
    fetchStatus().then(() => {
      // If a job was already in progress when we mounted, start polling
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
      const res = await fetch(`${API}/fmp/sync-nasdaq100`, { method: "POST" });
      const data: SyncStatus = await res.json();
      setStatus(data);
      if (res.status === 202 || data.state === "running") {
        startPolling();
      }
    } catch {
      // leave status unchanged
    } finally {
      setStarting(false);
    }
  };

  return { status, starting, start };
}
