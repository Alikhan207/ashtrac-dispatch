import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, XCircle } from "lucide-react";
import AppShell from "@/components/dispatch/app-shell";
import ProviderCard from "@/components/dispatch/provider-card";
import WinnerPanel from "@/components/dispatch/winner-panel";
import { useDispatch } from "@/hooks/use-dispatch";
import { categoryLabel } from "@/lib/dispatch/category";

const LiveDispatchPage = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const { data, status } = useDispatch(requestId ?? null);

  const attempts = data?.attempts ?? [];
  const winner = data?.winner ?? null;
  const done = status === "done";
  const noWinner = done && !winner && attempts.length > 0 && attempts.every((a) => a.status === "completed");

  const activeIndex = attempts.findIndex((a) => a.status === "calling");
  const completedCount = attempts.filter((a) => a.status === "completed").length;

  const statusLine = winner
    ? "Confirmed"
    : noWinner
      ? "All providers contacted"
      : activeIndex >= 0
        ? `Calling ${activeIndex + 1} of ${attempts.length}`
        : attempts.length > 0
          ? "Starting dispatch…"
          : "Connecting…";

  return (
    <AppShell
      right={
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> New request
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {/* Context + status */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {statusLine}
          </p>
          {data?.need_text ? (
            <p className="mt-2 text-[15px] text-foreground/90 line-clamp-3">
              {data.need_text}
            </p>
          ) : null}
          {data?.category ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {categoryLabel(data.category)}
            </span>
          ) : null}
        </div>

        {/* Provider attempt cards */}
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {attempts.map((attempt, i) => (
              <ProviderCard key={attempt.call_id || i} attempt={attempt} index={i} />
            ))}
          </AnimatePresence>

          {attempts.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-card/30">
              <p className="text-sm text-muted-foreground">Preparing provider list…</p>
            </div>
          )}
        </div>

        {/* Winner */}
        <AnimatePresence>
          {winner && <WinnerPanel key="winner" winner={winner} />}
        </AnimatePresence>

        {/* Terminal: no one confirmed */}
        {noWinner && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-warning/30 bg-warning/[0.04] p-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-warning">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">
                No provider available right now
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {completedCount} provider{completedCount === 1 ? "" : "s"} contacted — none could confirm.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Try again
            </Link>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
};

export default LiveDispatchPage;
