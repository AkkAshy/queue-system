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

export type UserRole = 'admin' | 'chief_admin' | 'hall_admin' | 'operator' | 'viewer';

// A service hall (zal). The office has two, each with its own queue/board.
export interface Hall {
  id: number;
  code: string;         // '1', '2'
  name_kaa: string;
  name_ru: string;
  name_uz?: string;     // Uzbek (Latin)
  name_en?: string;     // English
  is_active: boolean;
  order: number;
}

export interface ServiceCategory {
  id: number;
  hall_id?: number | null;
  code: string;         // 'A', 'B', ...
  name_kaa: string;
  name_ru: string;
  name_uz?: string;     // Uzbek (Latin)
  name_en?: string;     // English
  color: string;        // hex
  order: number;
}

export interface Service {
  id: number;
  category_id: number;
  name_kaa: string;
  name_ru: string;
  name_uz?: string;     // Uzbek (Latin)
  name_en?: string;     // English
  sla_days: number;     // 0 = immediate
  delivery_type: DeliveryType;
  requires_visit: boolean;
  is_active: boolean;
  is_popular?: boolean;   // surfaced in the kiosk "popular" shortcut block
}

// Kiosk locales (UI + catalog name selection). Staff apps are Uzbek-only.
export type KioskLocale = 'kaa' | 'ru' | 'uz' | 'en';

/** Pick the catalog name for a locale with graceful fallback (uz/en may be
 * missing on older rows → fall back to ru, then kaa). */
export function localizedName(
  obj: { name_kaa: string; name_ru: string; name_uz?: string; name_en?: string },
  locale: KioskLocale,
): string {
  switch (locale) {
    case 'ru': return obj.name_ru || obj.name_kaa;
    case 'uz': return obj.name_uz || obj.name_ru || obj.name_kaa;
    case 'en': return obj.name_en || obj.name_ru || obj.name_kaa;
    default:   return obj.name_kaa || obj.name_ru;
  }
}

export interface Ticket {
  id: string;           // uuid
  number: string;       // 'A042'
  hall_id?: number | null;
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
  hall_id?: number | null;
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
  hall_id?: number | null;    // assigned hall for hall_admin (head of hall)
  is_active: boolean;
}

export interface AuthState {
  token: string | null;
  username: string | null;
  role: UserRole | null;
  expiresAt: number | null;   // unix ms
}

// 0 = Monday … 6 = Sunday (matches Python's date.weekday()).
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WorkSchedule {
  id: number;
  user_id: number;
  user_name: string;          // denormalised for the table
  counter_id: number;
  counter_number: string;     // denormalised
  hall_id: number | null;
  weekday: Weekday;
  weekday_label: string;      // ru name, e.g. "Понедельник"
  start_time: string;         // "HH:MM"
  end_time: string;           // "HH:MM"
  is_active: boolean;
}

/** Bulk shift assignment: operators × weekdays in one call. Each operator's
 *  window is taken from their profile (User.counter), so no counter is sent. */
export interface ScheduleBulkInput {
  weekdays: Weekday[];
  user_ids: number[];
  start_time: string;         // "HH:MM"
  end_time: string;           // "HH:MM"
  is_active: boolean;
}

/** Result of a bulk assignment: rows created, rows updated (existing day's
 *  time/active changed), and operators skipped for having no window. */
export interface ScheduleBulkResult {
  created: WorkSchedule[];
  updated: number;
  no_counter: number[];       // operator ids skipped (no counter on profile)
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
  service: { name_kaa: string; name_ru: string; name_uz?: string; name_en?: string } | null;
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
  user_id: number;
  username: string;
  name: string;
  role: UserRole;
  counter_id: number | null;
  hall_id: number | null;
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
  // When set, call this specific waiting ticket (operator picked from the
  // queue) instead of the oldest one.
  ticket_id?: string;
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

// One window on the board: the counter + its current call (null when idle).
export interface DisplayBoardWindow {
  counter_id: number;
  counter_number: string; // '1'
  counter_name: string;   // 'Okno 1 — …'
  current: DisplayCall | null;
}

// A waiting (issued, not yet called) ticket shown in the board's queue list.
export interface DisplayWaiting {
  id: string;
  number: string;     // 'A005'
  category_id: number;
}

// Board / system configuration, editable from the admin app.
export interface DisplaySettings {
  youtube_url: string;
  org_name?: string;
  ticker_text?: string;
  voice_enabled?: boolean;
  voice_lang?: string;
}
