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
}

export interface Ticket {
  id: string;           // uuid
  number: string;       // 'A042'
  category_id: number;
  service_id: number | null;
  status: TicketStatus;
  counter_id: number | null;
  created_at: string;   // ISO
}

export interface CreateTicketRequest {
  category_id: number;
  service_id?: number;
  idempotency_key: string;
}
