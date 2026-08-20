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
