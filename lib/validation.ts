import { z } from 'zod';

/**
 * Zod schema for `POST /api/auth/register`.
 *
 * - `email` is trimmed and lowercased before validation so stored emails are
 *   canonical (unique constraint enforced on the canonical form).
 * - `password` must be at least 8 and at most 72 characters (bcrypt ignores
 *   bytes beyond 72, so we reject rather than silently truncate).
 * - `name` is optional and capped at 100 characters to match the `users.name`
 *   column (`varchar(100)`).
 * - `role` is optional and restricted to the Prisma `Role` enum values. It
 *   currently has no effect beyond being stored.
 */
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(72, 'Password must be at most 72 characters long.'),
  name: z
    .string()
    .trim()
    .max(100, 'Name must be at most 100 characters long.')
    .optional(),
  role: z.enum(['USER', 'DRIVER', 'ADMIN']).optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Zod schema for NextAuth credentials sign-in (the `authorize` callback).
 *
 * - `email` is normalised exactly like registration (trimmed + lowercased) so
 *   lookups match the canonical stored form.
 * - `password` is only required to be non-empty here: login is verified with
 *   bcrypt, so we deliberately do not re-impose registration length rules on
 *   an existing credential attempt.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address.'),
  password: z.string().min(1, 'Password is required.')
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Zod schema for `POST /api/vehicles`.
 *
 * - `make` / `model` are required, trimmed, and capped at 100 characters to
 *   match the `vehicles` columns (`varchar(100)`).
 * - `year` is coerced from a number or numeric string and constrained to a
 *   sane four-digit range.
 * - `color` is optional and capped at 50 characters (`varchar(50)`).
 * - `licensePlate` is required, trimmed, and capped at 20 characters
 *   (`varchar(20)`). Uniqueness is enforced at the database layer (409).
 * - `seatCapacity` is coerced from a number or numeric string and must be an
 *   integer between 1 and 8 inclusive.
 * - `vehicleType` must be one of the Prisma `VehicleType` enum values.
 */
export const vehicleSchema = z.object({
  make: z
    .string()
    .trim()
    .min(1, 'Make is required.')
    .max(100, 'Make must be at most 100 characters long.'),
  model: z
    .string()
    .trim()
    .min(1, 'Model is required.')
    .max(100, 'Model must be at most 100 characters long.'),
  year: z.coerce
    .number()
    .int('Year must be a whole number.')
    .min(1900, 'Year must be at least 1900.')
    .max(2100, 'Year must be at most 2100.'),
  color: z
    .string()
    .trim()
    .max(50, 'Color must be at most 50 characters long.')
    .optional()
    .nullable()
    .transform((v) => v || undefined),
  licensePlate: z
    .string()
    .trim()
    .min(1, 'License plate is required.')
    .max(20, 'License plate must be at most 20 characters long.'),
  seatCapacity: z.coerce
    .number()
    .int('Seat capacity must be a whole number.')
    .min(1, 'Seat capacity must be at least 1.')
    .max(8, 'Seat capacity must be at most 8.'),
  vehicleType: z.enum(['SEDAN', 'SUV', 'HATCHBACK', 'VAN', 'COUPE', 'CONVERTIBLE', 'TRUCK', 'OTHER'])
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

/**
 * Ride field limits. `source`/`destination` map to `varchar(255)` columns and
 * `notes` maps to `varchar(280)`, so the schemas cap input to the same sizes.
 */
const RIDE_SOURCE_MAX = 255;
const RIDE_DESTINATION_MAX = 255;
const RIDE_NOTES_MAX = 280;

/** A departure is only valid if it is strictly in the future. */
const futureDeparture = (date: Date) => date.getTime() > Date.now();

/**
 * Zod schema for `POST /api/rides`.
 *
 * - `vehicleId` must be a UUID. Ownership of the referenced vehicle is verified
 *   server-side in the route (never trust a client-submitted owner).
 * - `source` / `destination` are required, trimmed, and at least 2 characters.
 * - `departureTime` is coerced from a number or ISO string and must be in the
 *   future.
 * - `seatsTotal` is coerced from a number or numeric string and must be an
 *   integer of at least 1. The upper bound (the vehicle's seat capacity) depends
 *   on the selected vehicle and is enforced in the route after lookup.
 * - `notes` is optional and capped at 280 characters.
 */
export const rideCreateSchema = z.object({
  vehicleId: z.string().uuid('A valid vehicle ID is required.'),
  source: z
    .string()
    .trim()
    .min(2, 'Source must be at least 2 characters long.')
    .max(RIDE_SOURCE_MAX, `Source must be at most ${RIDE_SOURCE_MAX} characters long.`),
  destination: z
    .string()
    .trim()
    .min(2, 'Destination must be at least 2 characters long.')
    .max(RIDE_DESTINATION_MAX, `Destination must be at most ${RIDE_DESTINATION_MAX} characters long.`),
  departureTime: z
    .coerce
    .date()
    .refine(futureDeparture, 'Departure time must be in the future.'),
  seatsTotal: z.coerce
    .number()
    .int('Seats must be a whole number.')
    .min(1, 'Seats must be at least 1.'),
  notes: z
    .string()
    .trim()
    .max(RIDE_NOTES_MAX, `Notes must be at most ${RIDE_NOTES_MAX} characters long.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
});

export type RideCreateInput = z.infer<typeof rideCreateSchema>;

/**
 * Zod schema for `PATCH /api/rides/{id}`.
 *
 * Every field is optional (partial update). The same per-field rules as creation
 * apply. Whether a field is *allowed* to change is decided by the route based on
 * the ride's accepted-seat lock state (REQ-9).
 */
export const rideUpdateSchema = z.object({
  vehicleId: z.string().uuid('A valid vehicle ID is required.').optional(),
  source: z
    .string()
    .trim()
    .min(2, 'Source must be at least 2 characters long.')
    .max(RIDE_SOURCE_MAX, `Source must be at most ${RIDE_SOURCE_MAX} characters long.`)
    .optional(),
  destination: z
    .string()
    .trim()
    .min(2, 'Destination must be at least 2 characters long.')
    .max(RIDE_DESTINATION_MAX, `Destination must be at most ${RIDE_DESTINATION_MAX} characters long.`)
    .optional(),
  departureTime: z
    .coerce
    .date()
    .refine(futureDeparture, 'Departure time must be in the future.')
    .optional(),
  seatsTotal: z.coerce
    .number()
    .int('Seats must be a whole number.')
    .min(1, 'Seats must be at least 1.')
    .optional(),
  notes: z
    .string()
    .trim()
    .max(RIDE_NOTES_MAX, `Notes must be at most ${RIDE_NOTES_MAX} characters long.`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value === '' || value === null ? null : value))
});

export type RideUpdateInput = z.infer<typeof rideUpdateSchema>;
