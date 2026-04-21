import type { Service } from '@queue/types';

export class ServiceStore {
  private items: Service[];

  constructor(initial: Service[]) {
    this.items = initial.map((s) => ({ ...s }));
  }

  list(): Service[] {
    return this.items.map((s) => ({ ...s }));
  }

  listByCategory(categoryId: number): Service[] {
    return this.items
      .filter((s) => s.category_id === categoryId)
      .map((s) => ({ ...s }));
  }

  get(id: number): Service | undefined {
    const s = this.items.find((x) => x.id === id);
    return s ? { ...s } : undefined;
  }

  update(id: number, patch: Partial<Omit<Service, 'id'>>): Service | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    const existing = this.items[idx]!;
    const updated: Service = { ...existing, ...patch };
    this.items[idx] = updated;
    return { ...updated };
  }
}
