import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  Phone,
  XCircle,
} from "lucide-react";
import type { DispatchAttempt } from "@/lib/dispatch/types";
import CallIndicator from "./call-indicator";

interface ProviderCardProps {
  attempt: DispatchAttempt;
  index: number;
}

type Outcome = "yes" | "no" | "unknown" | null;

const ProviderCard = ({ attempt, index }: ProviderCardProps) => {
  const { provider, status, availability, eta, price, evidence } = attempt;
  const outcome: Outcome = status === "completed" ? availability : null;

  // Track when this card entered the "calling" state for the elapsed counter.
  const callingSinceRef = useRef<number | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    if (status === "calling") {
      if (callingSinceRef.current === null) callingSinceRef.current = Date.now();
      force((n) => n + 1);
    }
  }, [status]);

  const isQueued = status === "queued";
  const isCalling = status === "calling";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: isQueued ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={[
        "relative rounded-2xl border p-5 transition-colors duration-300",
        outcome === "yes"
          ? "border-primary/50 bg-primary/[0.06]"
          : outcome === "no"
            ? "border-warning/30 bg-warning/[0.04]"
            : outcome === "unknown"
              ? "border-border bg-card/40"
              : isCalling
                ? "border-primary/30 bg-card/60"
                : "border-border bg-card/30",
      ].join(" ")}
    >
      {/* Header: provider + phone */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground text-sm font-semibold">
            {provider.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {provider.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Provider {index + 1} · {provider.phone}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          {isQueued && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Waiting
            </span>
          )}
          {isCalling && <CallIndicator since={callingSinceRef.current ?? undefined} />}
          {outcome === "yes" && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4" /> Confirmed
            </span>
          )}
          {outcome === "no" && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-warning">
              <XCircle className="h-4 w-4" /> Unavailable
            </span>
          )}
          {outcome === "unknown" && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <HelpCircle className="h-4 w-4" /> No clear answer
            </span>
          )}
        </div>
      </div>

      {/* Result detail */}
      {outcome === "yes" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.35 }}
          className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2 overflow-hidden"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">ETA</p>
            <p className="text-2xl font-semibold text-primary">{eta || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
            <p className="text-2xl font-semibold text-primary">{price || "—"}</p>
          </div>
        </motion.div>
      )}

      {outcome === "no" && evidence && (
        <p className="mt-3 text-sm text-warning/80">{evidence}</p>
      )}
      {outcome === "unknown" && evidence && (
        <p className="mt-3 text-sm text-muted-foreground">{evidence || "No clear answer from the call."}</p>
      )}

      {isCalling && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" /> Live call in progress…
        </p>
      )}
    </motion.div>
  );
};

export default ProviderCard;
