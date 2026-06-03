import type { ServiceCategory } from '@queue/types';

export class CategoryStore {
  private items: ServiceCategory[];

  constructor(initial: ServiceCategory[]) {
    this.items = initial.map((c) => ({ ...c }));
  }

  list(): ServiceCategory[] {
    return this.items.map((c) => ({ ...c }));
  }

  get(id: number): ServiceCategory | undefined {
    const c = this.items.find((x) => x.id === id);
    return c ? { ...c } : undefined;
  }

  update(id: number, patch: Partial<Omit<ServiceCategory, 'id'>>): ServiceCategory | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    const existing = this.items[idx]!;
    const updated: ServiceCategory = { ...existing, ...patch };
    this.items[idx] = updated;
    return { ...updated };
  }

  create(data: Omit<ServiceCategory, 'id'>): ServiceCategory {
    const id = this.items.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    const created: ServiceCategory = { ...data, id };
    this.items.push(created);
    return { ...created };
  }

  remove(id: number): boolean {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }
}
