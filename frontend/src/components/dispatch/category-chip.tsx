import { useState } from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { CATEGORIES, detectCategory, type CategoryDef } from "@/lib/dispatch/category";

interface CategoryChipProps {
  text: string;
  value: CategoryDef;
  onChange: (cat: CategoryDef) => void;
}

const CategoryChip = ({ text, value, onChange }: CategoryChipProps) => {
  const [open, setOpen] = useState(false);

  // Auto-detect overrides manual choice when text changes meaningfully — but we
  // only re-detect if the user hasn't picked one. Keep it simple: detect live.
  const detected = detectCategory(text);
  const current = value.key === "general" ? detected : value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 pl-3 pr-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        <span>{current.label}</span>
        <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 w-48 rounded-xl border border-border bg-popover p-1 shadow-elevated">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                onChange(cat);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              {cat.label}
              {current.key === cat.key && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryChip;
