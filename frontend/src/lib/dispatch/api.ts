import type {
  DispatchResponse,
  StartDispatchResponse,
} from "./types";

/**
 * Base URL for the dispatch backend (FastAPI). When unset, the app runs in
 * demo/simulation mode so the live dispatch flow is demonstrable in the
 * preview without a real backend.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const isSimMode = !API_BASE_URL;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Dispatch API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function startDispatch(
  needText: string
): Promise<StartDispatchResponse> {
  return http<StartDispatchResponse>("/api/dispatch", {
    method: "POST",
    body: JSON.stringify({ need_text: needText }),
  });
}

export async function getDispatch(
  requestId: string
): Promise<DispatchResponse> {
  return http<DispatchResponse>(`/api/dispatch/${requestId}`);
}

/* ------------------------------------------------------------------ */
/* Demo simulation                                                     */
/* ------------------------------------------------------------------ */
/* Emits the same shape the real backend will, over realistic timing,  */
/* so the live dispatch animation is demonstrable in the preview.      */

import { detectCategory } from "./category";

const SIM_PROVIDERS = [
  { id: "p1", name: "Sharma Home Services", phone: "+91 98xxx xxx01" },
  { id: "p2", name: "Verma Repair Co.", phone: "+91 98xxx xxx02" },
  { id: "p3", name: "QuickFix Trades", phone: "+91 98xxx xxx03" },
];

let simStore: Record<string, SimState> = {};

interface SimState {
  requestId: string;
  needText: string;
  category: string;
  startedAt: number;
  timeline: { at: number; attemptIndex: number; patch: Partial<DispatchResponse["attempts"][number]> }[];
  attempts: DispatchResponse["attempts"];
  winner: DispatchResponse["winner"] | null;
  finished: boolean;
}

function buildSimState(requestId: string, needText: string): SimState {
  const category = detectCategory(needText).key;
  const now = Date.now();
  // Provider 1: unavailable after ~10s
  // Provider 2: confirmed after ~12s -> winner
  const attempts: SimState["attempts"] = SIM_PROVIDERS.map((p, i) => ({
    provider: p,
    call_id: `sim_${requestId}_${i}`,
    status: "queued",
    availability: null,
    eta: "",
    price: "",
    evidence: "",
    error: null,
  }));

  const timeline: SimState["timeline"] = [
    // P1 calling
    { at: now + 600, attemptIndex: 0, patch: { status: "calling" } },
    // P1 result: no
    { at: now + 600 + 9000, attemptIndex: 0, patch: { status: "completed", availability: "no", evidence: "Fully booked today, no slots until tomorrow." } },
    // P2 calling
    { at: now + 600 + 9000 + 700, attemptIndex: 1, patch: { status: "calling" } },
    // P2 result: yes
    { at: now + 600 + 9000 + 700 + 11000, attemptIndex: 1, patch: { status: "completed", availability: "yes", eta: "4–6 PM today", price: "₹500", evidence: "Yes, we can send someone between 4 and 6 PM for approximately 500 rupees." } },
  ];

  return { requestId, needText, category, startedAt: now, timeline, attempts, winner: null, finished: false };
}

function advanceSim(state: SimState): SimState {
  const now = Date.now();
  for (const step of state.timeline) {
    if (now >= step.at) {
      const a = state.attempts[step.attemptIndex];
      if (a && a.status !== step.patch.status) {
        state.attempts[step.attemptIndex] = { ...a, ...step.patch };
      } else if (step.patch.availability && a.availability !== step.patch.availability) {
        state.attempts[step.attemptIndex] = { ...a, ...step.patch };
      }
    }
  }
  // Determine winner / finished
  const confirmed = state.attempts.find((a) => a.availability === "yes");
  if (confirmed) {
    state.winner = {
      provider: { id: confirmed.provider.id, name: confirmed.provider.name },
      eta: confirmed.eta,
      price: confirmed.price,
      evidence: confirmed.evidence,
    };
    state.finished = true;
  } else if (state.attempts.every((a) => a.status === "completed")) {
    state.finished = true;
  } else {
    state.finished = false;
  }
  return state;
}

export function simStartDispatch(needText: string): StartDispatchResponse {
  const requestId = `req_${Math.random().toString(36).slice(2, 10)}`;
  simStore[requestId] = buildSimState(requestId, needText);
  return { request_id: requestId };
}

export function simGetDispatch(requestId: string): DispatchResponse {
  const state = simStore[requestId];
  if (!state) {
    // Fallback: build a fresh state if unknown (e.g. direct nav)
    const fresh = buildSimState(requestId, "The plaster on my wall is falling off and my usual contact isn't answering");
    simStore[requestId] = fresh;
    advanceSim(fresh);
    return { request_id: requestId, need_text: fresh.needText, category: fresh.category, attempts: fresh.attempts, winner: fresh.winner };
  }
  advanceSim(state);
  return {
    request_id: state.requestId,
    need_text: state.needText,
    category: state.category,
    attempts: state.attempts.map((a) => ({ ...a })),
    winner: state.winner,
  };
}

/** Unified entry points used by the hook. */
export const dispatchApi = {
  start: isSimMode ? simStartDispatch : startDispatch,
  get: isSimMode ? simGetDispatch : getDispatch,
};
