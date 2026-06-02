export type DeliveryType =
  | 'electron'
  | 'qagaz'
  | 'awizeki'
  | 'electron_qagaz'
  | 'electron_awizeki'
  | 'jiynalmali_papka';

export type TicketStatus =
  | 'waiting'
  | 'called'
  | 'serving'
  | 'served'
  | 'skipped'
  | 'cancelled';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface ServiceCategory {
  id: number;
  code: string;         // 'A', 'B', ...
  name_kaa: string;
  name_ru: string;
  color: string;        // hex
  order: number;
}

export interface Service {
  id: number;
  category_id: number;
  name_kaa: string;
  name_ru: string;
  sla_days: number;     // 0 = immediate
  delivery_type: DeliveryType;
  requires_visit: boolean;
  is_active: boolean;
  is_popular?: boolean;   // surfaced in the kiosk "popular" shortcut block
}

export interface Ticket {
  id: string;           // uuid
  number: string;       // 'A042'
  category_id: number;
  service_id: number | null;
  status: TicketStatus;
  counter_id: number | null;
  operator_id: number | null;   // who's currently serving (null while waiting)
  created_at: string;           // ISO
  called_at: string | null;     // ISO — set when status becomes 'called'
}

export interface CreateTicketRequest {
  category_id: number;
  service_id?: number;
  idempotency_key: string;
}

// -------- Phase 3 additions --------

export interface Counter {
  id: number;
  number: string;         // display label, e.g. "1", "2A"
  name: string;           // e.g. "Окно 1 · Акад. справки"
  service_ids: number[];  // which services this counter serves
  is_active: boolean;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  counter_id: number | null;  // assigned counter for operators; null for admins/viewers
  is_active: boolean;
}

export interface AuthState {
  token: string | null;
  username: string | null;
  role: UserRole | null;
  expiresAt: number | null;   // unix ms
}

export interface DashboardMetrics {
  ticketsToday: number;
  avgWaitMinutes: number;
  activeCounters: number;
  served: number;
}

export interface HourlyLoadPoint {
  hour: number;           // 8..18
  issued: number;
  served: number;
}

export interface RecentTicket {
  id: string;
  number: string;
  category_code: string;
  service_name: string;
  status: TicketStatus;
  counter_number: string | null;
  issued_at: string;      // ISO
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: UserRole;
  expires_at: string;     // ISO
}

// -------- Phase 4 additions --------

export type OperatorSessionStatus = 'active' | 'break' | 'ended';

export interface OperatorSession {
  id: number;
  user_id: number;
  counter_id: number;
  status: OperatorSessionStatus;
  started_at: string;       // ISO
  ended_at: string | null;  // ISO
}

export interface CreateOperatorSessionRequest {
  user_id: number;
  counter_id: number;
}

export interface CallNextRequest {
  counter_id: number;
  operator_id: number;
}

export interface TransferTicketRequest {
  counter_id: number;
}

// -------- Phase 5 additions --------

/** A call rendered on the waiting-hall display — ticket joined with its counter. */
export interface DisplayCall {
  id: string;             // ticket id
  number: string;         // 'A013'
  category_id: number;
  counter_id: number;
  counter_number: string; // '1'
  counter_name: string;   // 'Okno 1 — …'
  called_at: string;      // ISO
  status: 'called' | 'serving';
}
