import { useCallback, useEffect, useRef, useState } from "react";
import { dispatchApi } from "@/lib/dispatch/api";
import type { DispatchResponse, DispatchStatus } from "@/lib/dispatch/types";

const POLL_INTERVAL = 2500;

/**
 * Polls a dispatch request and exposes the live attempts + winner.
 * Works in both real-backend (async fetch) and demo simulation (sync) modes.
 */
export function useDispatch(requestId: string | null) {
  const [data, setData] = useState<DispatchResponse | null>(null);
  const [status, setStatus] = useState<DispatchStatus>(requestId ? "live" : "idle");
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!requestId) return;
    cancelledRef.current = false;
    setStatus("live");
    setData(null);
    setError(null);

    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const result = await Promise.resolve(dispatchApi.get(requestId));
        if (cancelledRef.current) return;
        setData(result);

        const terminal =
          !!result.winner ||
          result.attempts.length > 0 && result.attempts.every((a) => a.status === "completed");

        if (terminal) {
          setStatus("done");
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL);
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to fetch dispatch updates");
        setStatus("done");
      }
    };

    poll();

    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
    };
  }, [requestId]);

  const start = useCallback(async (needText: string) => {
    setStatus("starting");
    const res = await Promise.resolve(dispatchApi.start(needText));
    return res.request_id;
  }, []);

  return { data, status, error, start };
}
