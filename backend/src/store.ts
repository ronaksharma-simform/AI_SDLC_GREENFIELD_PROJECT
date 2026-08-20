import { randomUUID } from 'crypto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: Date;
}

export interface Vehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  createdAt: Date;
}

/**
 * Lightweight in-memory data store for the CoRide vehicles slice.
 *
 * Kept dependency-free so the API can boot and be exercised anywhere
 * without requiring a live PostgreSQL instance. It exposes the same
 * entity boundaries (users, sessions, vehicles) a Postgres-backed
 * repository would, so it can be swapped later without touching routes.
 *
 * `createdAt` is backed by a monotonic clock so that vehicles created in
 * the same millisecond still have a deterministic "newest first" order.
 */
export class MemoryStore {
  private users: User[] = [];
  private sessions: Session[] = [];
  private vehicles: Vehicle[] = [];
  private lastCreatedAt = 0;

  reset(): void {
    this.users = [];
    this.sessions = [];
    this.vehicles = [];
    this.lastCreatedAt = 0;
  }

  // ---- Users ---------------------------------------------------------
  createUser(email: string, passwordHash: string): User {
    const user: User = {
      id: randomUUID(),
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  findUserByEmail(email: string): User | undefined {
    return this.users.find((u) => u.email === email.toLowerCase());
  }

  findUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  // ---- Sessions ------------------------------------------------------
  createSession(userId: string): Session {
    const session: Session = { token: randomUUID(), userId, createdAt: new Date() };
    this.sessions.push(session);
    return session;
  }

  findSession(token: string): Session | undefined {
    return this.sessions.find((s) => s.token === token);
  }

  deleteSession(token: string): void {
    this.sessions = this.sessions.filter((s) => s.token !== token);
  }

  // ---- Vehicles ------------------------------------------------------
  private nextCreatedAt(): Date {
    const now = Date.now();
    this.lastCreatedAt = now > this.lastCreatedAt ? now : this.lastCreatedAt + 1;
    return new Date(this.lastCreatedAt);
  }

  createVehicle(input: { userId: string; make: string; model: string; year: number; color?: string }): Vehicle {
    const vehicle: Vehicle = {
      id: randomUUID(),
      userId: input.userId,
      make: input.make,
      model: input.model,
      year: input.year,
      color: input.color,
      createdAt: this.nextCreatedAt(),
    };
    this.vehicles.push(vehicle);
    return vehicle;
  }

  /** Vehicles belonging to `userId`, newest first (createdAt desc). */
  listVehiclesByUser(userId: string): Vehicle[] {
    return this.vehicles
      .filter((v) => v.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findVehicleById(id: string): Vehicle | undefined {
    return this.vehicles.find((v) => v.id === id);
  }
}

/** The single shared store instance for the running process. */
export const store = new MemoryStore();
