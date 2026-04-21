import type { User } from '@queue/types';

export class UserStore {
  // Internal array — never exposed directly to protect state
  private items: User[];
  private nextId: number;

  constructor(initial: User[]) {
    // Deep-copy seed data so constructor arg mutations can't affect us
    this.items = initial.map((u) => ({ ...u }));
    this.nextId = (this.items.reduce((m, u) => Math.max(m, u.id), 0) || 0) + 1;
  }

  /** Returns a shallow copy of every user (callers can't mutate internal state). */
  list(): User[] {
    return this.items.map((u) => ({ ...u }));
  }

  /** Returns a copy of the user with the given id, or undefined. */
  get(id: number): User | undefined {
    const u = this.items.find((x) => x.id === id);
    return u ? { ...u } : undefined;
  }

  /**
   * Dev stub: password must equal the username (e.g. admin/admin, operator1/operator1).
   * Returns a copy of the user if credentials are valid and user is active, else undefined.
   */
  authenticate(username: string, password: string): User | undefined {
    const u = this.items.find((x) => x.username === username);
    if (!u || !u.is_active) return undefined;
    if (password !== username) return undefined;
    return { ...u };
  }

  /** Creates a new user with an auto-incremented id and returns a copy. */
  create(input: Omit<User, 'id'>): User {
    const u: User = { ...input, id: this.nextId++ };
    this.items.push(u);
    return { ...u };
  }

  /** Merges patch into the user and returns a copy, or undefined if not found. */
  update(id: number, patch: Partial<Omit<User, 'id'>>): User | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    const existing = this.items[idx]!;
    const updated: User = { ...existing, ...patch };
    this.items[idx] = updated;
    return { ...updated };
  }

  /** Removes the user with the given id. Returns true if found, false otherwise. */
  remove(id: number): boolean {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }
}
