import request from 'supertest';
import { createApp } from './app';
import { store } from './store';

const app = createApp();

const PASSWORD = 'password123';

function sessionCookie(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const value = header && header[0] ? header[0] : '';
  return value.split(';')[0];
}

async function register(email: string): Promise<void> {
  const res = await request(app).post('/api/auth/register').send({ email, password: PASSWORD });
  expect(res.status).toBe(201);
}

async function login(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return sessionCookie(res);
}

async function createVehicle(cookie: string, payload: Record<string, unknown>): Promise<request.Response> {
  return request(app).post('/api/vehicles').set('Cookie', cookie).send(payload);
}

describe('vehicles-list', () => {
  beforeEach(() => {
    store.reset();
  });

  it('returns 401 for an unauthenticated GET /api/vehicles', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 401 for an invalid session token', async () => {
    const res = await request(app).get('/api/vehicles').set('Cookie', 'sid=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns only the requesting user’s vehicles, ordered by createdAt desc', async () => {
    await register('alice@example.com');
    const alice = await login('alice@example.com');

    await register('bob@example.com');
    const bob = await login('bob@example.com');

    // Alice creates two vehicles (a1 first, a2 second → a2 should list first).
    const a1 = await createVehicle(alice, { make: 'Toyota', model: 'Corolla', year: 2020 });
    expect(a1.status).toBe(201);
    const a2 = await createVehicle(alice, { make: 'Honda', model: 'Civic', year: 2021 });
    expect(a2.status).toBe(201);

    // Bob creates two vehicles that must NOT leak into Alice's list.
    const b1 = await createVehicle(bob, { make: 'Ford', model: 'Fiesta', year: 2019 });
    expect(b1.status).toBe(201);
    const b2 = await createVehicle(bob, { make: 'BMW', model: 'M3', year: 2022 });
    expect(b2.status).toBe(201);

    const aliceRes = await request(app).get('/api/vehicles').set('Cookie', alice);
    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body.vehicles).toHaveLength(2);
    expect(aliceRes.body.vehicles.map((v: { id: string }) => v.id)).toEqual([
      a2.body.vehicle.id,
      a1.body.vehicle.id,
    ]);
    for (const v of aliceRes.body.vehicles) {
      expect(v.userId).toBe(a1.body.vehicle.userId);
      expect(v.userId).toBe(a2.body.vehicle.userId);
    }

    const bobRes = await request(app).get('/api/vehicles').set('Cookie', bob);
    expect(bobRes.status).toBe(200);
    expect(bobRes.body.vehicles).toHaveLength(2);
    expect(bobRes.body.vehicles.map((v: { id: string }) => v.id)).toEqual([
      b2.body.vehicle.id,
      b1.body.vehicle.id,
    ]);
    for (const v of bobRes.body.vehicles) {
      expect(v.userId).toBe(b1.body.vehicle.userId);
    }
  });

  it('returns an empty list for a user with no vehicles', async () => {
    await register('carol@example.com');
    const carol = await login('carol@example.com');

    const res = await request(app).get('/api/vehicles').set('Cookie', carol);
    expect(res.status).toBe(200);
    expect(res.body.vehicles).toEqual([]);
  });
});
