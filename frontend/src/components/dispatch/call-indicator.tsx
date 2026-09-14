import { useEffect, useState } from "react";

interface CallIndicatorProps {
  /** ms timestamp when the call started; drives the elapsed counter */
  since?: number;
  label?: string;
}

const CallIndicator = ({ since, label = "In call" }: CallIndicatorProps) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!since) return;
    const tick = () => setElapsed(Math.floor((Date.now() - since) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);

  return (
    <div className="flex items-center gap-2.5">
      <span className="pulse-dot" aria-hidden />
      <span className="flex items-end gap-[3px] h-4" aria-hidden>
        <span className="wave-bar" />
        <span className="wave-bar" />
        <span className="wave-bar" />
        <span className="wave-bar" />
      </span>
      <span className="text-sm font-medium text-primary">
        {label}
        {since ? <span className="text-muted-foreground"> · {elapsed}s</span> : null}
      </span>
    </div>
  );
};

export default CallIndicator;
