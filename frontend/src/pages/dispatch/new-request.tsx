import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Radio, Send } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/dispatch/app-shell";
import CategoryChip from "@/components/dispatch/category-chip";
import { dispatchApi, isSimMode } from "@/lib/dispatch/api";
import { DEFAULT_CATEGORY, detectCategory, type CategoryDef } from "@/lib/dispatch/category";

const PLACEHOLDER =
  "The plaster on my wall is falling off and my usual contact isn't answering";

const NewRequestPage = () => {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<CategoryDef>(DEFAULT_CATEGORY);
  const [submitting, setSubmitting] = useState(false);

  const detected = useMemo(() => detectCategory(text), [text]);
  const showChip = text.trim().length > 0;
  const canSubmit = text.trim().length > 0 && !submitting;

  const handleDispatch = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { request_id } = await Promise.resolve(dispatchApi.start(text.trim()));
      navigate(`/dispatch/${request_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start dispatch");
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-12 sm:px-8 sm:py-20">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-primary" />
            AI Dispatch Agent
          </span>
          <h1 className="h1 mt-5 max-w-xl text-foreground">
            What do you need help with?
          </h1>
          <p className="paragraph-regular mt-4 max-w-lg text-muted-foreground">
            Describe an urgent need. Ashtrac calls real service providers one by
            one, adapts the moment one says no, and stops the instant one
            confirms availability with a price and ETA.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-2xl">
          <div className="relative rounded-2xl border border-border bg-card/60 p-1.5 shadow-elevated focus-within:border-primary/50 transition-colors">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (category.key !== "general") setCategory(DEFAULT_CATEGORY);
              }}
              placeholder={PLACEHOLDER}
              rows={4}
              className="w-full resize-none rounded-xl bg-transparent px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleDispatch();
              }}
            />
            <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-1.5">
              <div>
                {showChip && (
                  <CategoryChip
                    text={text}
                    value={category.key === "general" ? detected : category}
                    onChange={setCategory}
                  />
                )}
              </div>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleDispatch}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Dispatch
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {isSimMode
              ? "Demo mode — simulating live calls. Connect a backend via VITE_API_BASE_URL for real calls."
              : "Real calls will be placed to live service providers."}
          </p>
        </div>
      </div>
    </AppShell>
  );
};

export default NewRequestPage;
