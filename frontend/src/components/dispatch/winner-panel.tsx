import { motion } from "framer-motion";
import { CheckCircle2, PhoneCall } from "lucide-react";
import type { DispatchWinner } from "@/lib/dispatch/types";

interface WinnerPanelProps {
  winner: DispatchWinner;
}

const WinnerPanel = ({ winner }: WinnerPanelProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mt-6 rounded-2xl border border-primary/40 bg-primary/[0.06] p-6 glow-accent"
    >
      <div className="flex items-center gap-2 text-primary">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wide">Provider confirmed</span>
      </div>

      <h3 className="mt-3 text-xl font-semibold text-foreground">{winner.provider.name}</h3>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">ETA</p>
          <p className="text-lg font-semibold text-foreground">
            {winner.eta || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
          <p className="text-lg font-semibold text-foreground">
            {winner.price || "—"}
          </p>
        </div>
      </div>

      {winner.evidence ? (
        <p className="mt-4 rounded-lg bg-background/60 border border-border px-4 py-3 text-sm italic text-muted-foreground">
          “{winner.evidence}”
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => import("sonner").then(({ toast }) => toast("Booking confirmation is a demo stub"))}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
      >
        <PhoneCall className="h-4 w-4" />
        Confirm Booking
      </button>
    </motion.div>
  );
};

export default WinnerPanel;
