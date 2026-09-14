export type Availability = "yes" | "no" | "unknown";

export type AttemptStatus = "queued" | "calling" | "completed";

export interface Provider {
  id: string;
  name: string;
  phone: string;
}

export interface DispatchAttempt {
  provider: Provider;
  call_id: string;
  status: AttemptStatus;
  availability: Availability | null;
  eta: string;
  price: string;
  evidence: string;
  error: string | null;
}

export interface DispatchWinner {
  provider: Pick<Provider, "name" | "id">;
  eta: string;
  price: string;
  evidence: string;
}

export interface DispatchResponse {
  request_id: string;
  need_text: string;
  category: string;
  attempts: DispatchAttempt[];
  winner: DispatchWinner | null;
}

export interface StartDispatchResponse {
  request_id: string;
}

export type DispatchStatus =
  | "idle"
  | "starting"
  | "live"
  | "done";
