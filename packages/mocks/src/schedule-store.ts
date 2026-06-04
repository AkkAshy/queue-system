import type { Weekday } from '@queue/types';

/** Raw shift row as stored in the mock (denormalised labels are added by the
 * handler from the user/counter stores at read time). */
export interface ScheduleRow {
  id: number;
  user_id: number;
  counter_id: number;
  weekday: Weekday;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  is_active: boolean;
}

export const WEEKDAY_LABELS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
] as const;

export class ScheduleStore {
  private items: ScheduleRow[] = [];
  private nextId = 1;

  list(): ScheduleRow[] {
    return this.items.map((r) => ({ ...r }));
  }

  create(input: Omit<ScheduleRow, 'id'>): ScheduleRow {
    const row: ScheduleRow = { ...input, id: this.nextId++ };
    this.items.push(row);
    return { ...row };
  }

  update(id: number, patch: Partial<Omit<ScheduleRow, 'id'>>): ScheduleRow | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    this.items[idx] = { ...this.items[idx]!, ...patch };
    return { ...this.items[idx]! };
  }

  remove(id: number): boolean {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }
}
