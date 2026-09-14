export interface CategoryDef {
  key: string;
  label: string;
  keywords: string[];
}

export const CATEGORIES: CategoryDef[] = [
  { key: "home_repair", label: "Home Repair", keywords: ["plaster", "wall", "ceiling", "roof", "leak", "crack", "repair", "fix", "broken", "damage"] },
  { key: "plumbing", label: "Plumbing", keywords: ["pipe", "water", "drain", "tap", "faucet", "toilet", "sink", "burst", "clog", "sewer"] },
  { key: "electrical", label: "Electrical", keywords: ["power", "electric", "wiring", "light", "switch", "outlet", "socket", "fuse", "short", "spark"] },
  { key: "hvac", label: "HVAC & Cooling", keywords: ["ac", "air condition", "cooling", "heater", "furnace", "thermostat", "vent", "refrigerator", "fridge"] },
  { key: "automotive", label: "Automotive", keywords: ["car", "vehicle", "engine", "tyre", "tire", "battery", "tow", "breakdown", "bike"] },
  { key: "appliance", label: "Appliance Repair", keywords: ["washing machine", "dishwasher", "oven", "microwave", "machine", "appliance"] },
];

export const DEFAULT_CATEGORY: CategoryDef = {
  key: "general",
  label: "General",
  keywords: [],
};

export function detectCategory(text: string): CategoryDef {
  const lower = text.toLowerCase();
  let best: CategoryDef | null = null;
  let bestScore = 0;
  for (const cat of CATEGORIES) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best ?? DEFAULT_CATEGORY;
}

export function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
