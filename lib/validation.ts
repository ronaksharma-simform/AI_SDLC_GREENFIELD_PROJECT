import { z } from 'zod';
import { MESSAGE_CONTENT_MAX } from '@/lib/conversations';

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
 * Ride field limits. `sourceAddress`/`destinationAddress` map to the renamed
 * `varchar(255)` address columns and `notes` maps to `varchar(280)`, so the
 * schemas cap input to the same sizes.
 */
const RIDE_ADDRESS_MAX = 255;
const PLACE_ID_MAX = 255;
const RIDE_NOTES_MAX = 280;

/** A departure is only valid if it is strictly in the future. */
const futureDeparture = (date: Date) => date.getTime() > Date.now();

/**
 * A structured location value used for both a ride's source and destination.
 *
 * - `latitude` / `longitude` are coerced to numbers and bounded to valid
 *   coordinate ranges (the same bounds the geocode proxy enforces).
 * - `address` is the resolved, human-readable location name (from reverse
 *   geocoding or manually edited by the user). It is required: REQ-11 blocks a
 *   ride from being created without a location name.
 * - `placeId` is an optional, provider-specific identifier returned by the
 *   geocoding service. It is accepted for caching/re-querying but is not
 *   persisted on the Ride entity.
 */
export const locationInputSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90.')
    .max(90, 'Latitude must be between -90 and 90.'),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180.')
    .max(180, 'Longitude must be between -180 and 180.'),
  address: z
    .string()
    .trim()
    .min(2, 'Address must be at least 2 characters long.')
    .max(RIDE_ADDRESS_MAX, `Address must be at most ${RIDE_ADDRESS_MAX} characters long.`),
  placeId: z
    .string()
    .trim()
    .max(PLACE_ID_MAX, `Place ID must be at most ${PLACE_ID_MAX} characters long.`)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : undefined))
});

export type LocationInput = z.infer<typeof locationInputSchema>;

/**
 * Zod schema for `POST /api/rides`.
 *
 * - `vehicleId` must be a UUID. Ownership of the referenced vehicle is verified
 *   server-side in the route (never trust a client-submitted owner).
 * - `source` / `destination` are structured `LocationInput` values (coordinates
 *   + a resolved/manually-entered address). The "source and destination must not
 *   be the same point" rule is enforced in the route after parsing (it spans two
 *   fields).
 * - `departureTime` is coerced from a number or ISO string and must be in the
 *   future.
 * - `seatsTotal` is coerced from a number or numeric string and must be an
 *   integer of at least 1. The upper bound (the vehicle's seat capacity) depends
 *   on the selected vehicle and is enforced in the route after lookup.
 * - `notes` is optional and capped at 280 characters.
 */
export const rideCreateSchema = z.object({
  vehicleId: z.string().uuid('A valid vehicle ID is required.'),
  source: locationInputSchema,
  destination: locationInputSchema,
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
  source: locationInputSchema.optional(),
  destination: locationInputSchema.optional(),
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

/**
 * Zod schema for `POST /api/rides/{id}/requests`.
 *
 * - `seatsRequested` is coerced from a number or numeric string and must be a
 *   positive integer. Whether it exceeds the ride's current availability is
 *   checked in the route after the ride is loaded (REQ-19a).
 * - `message` is optional, trimmed, and capped at 280 characters (matches the
 *   `ride_requests.message` column).
 */
export const rideRequestCreateSchema = z.object({
  seatsRequested: z.coerce
    .number()
    .int('Seats must be a whole number.')
    .min(1, 'Seats must be at least 1.'),
  message: z
    .string()
    .trim()
    .max(RIDE_NOTES_MAX, `Message must be at most ${RIDE_NOTES_MAX} characters long.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
});

export type RideRequestCreateInput = z.infer<typeof rideRequestCreateSchema>;

/**
 * Zod schema for `POST /api/conversations/{id}/messages`.
 *
 * - `content` is required, trimmed, and capped at `MESSAGE_CONTENT_MAX`
 *   characters. It is additionally sanitized (HTML stripped, control chars
 *   normalised) in `lib/conversations.sanitizeMessageContent` before storage.
 */
export const messageCreateSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(MESSAGE_CONTENT_MAX, `Message must be at most ${MESSAGE_CONTENT_MAX} characters long.`)
});

export type MessageCreateInput = z.infer<typeof messageCreateSchema>;

/**
 * Resolves an optional environment override for a numeric default, falling back
 * to `fallback` when the variable is unset, empty, or not a positive number.
 *
 * Both feed defaults live behind environment variables so product/ops can tune
 * them without a code change (Part B — REQ-7). The variables are read once at
 * module load; tests can set `process.env` before importing this module.
 */
function envPositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Default departure-time tolerance for the discovery feed (±30 minutes).
 * Configurable via `FEED_DEFAULT_TIME_WINDOW_MINUTES` (REQ-7).
 */
export const DEFAULT_FEED_TOLERANCE_MINUTES = envPositiveNumber(
  process.env.FEED_DEFAULT_TIME_WINDOW_MINUTES,
  30
);

/**
 * Default proximity radius for the discovery feed (500 meters) applied when the
 * Seeker supplies a pickup point (`lat`/`lng`) but no explicit `radius`.
 * Configurable via `FEED_DEFAULT_RADIUS_METERS` (REQ-7).
 */
export const DEFAULT_PROXIMITY_RADIUS_METERS = envPositiveNumber(
  process.env.FEED_DEFAULT_RADIUS_METERS,
  500
);

/**
 * Zod schema for the query string of `GET /api/rides/feed`.
 *
 * Every filter is optional. When absent, no constraint is applied for that
 * dimension.
 *
 * - `source` / `destination` are free-text route filters, matched
 *   case-insensitively against the ride's stored addresses.
 * - `time` must be a valid date/time. When provided, only rides whose departure
 *   falls within `±window` (or `±toleranceMinutes`) of that time are returned
 *   (REQ-13a).
 * - `seats` must be a positive integer; only rides with at least that many
 *   available seats are returned (REQ-13b).
 * - `toleranceMinutes` configures the time window; defaults to 30 (REQ-13a).
 *   Kept for backwards compatibility with the base feed spec.
 * - `window` is the Part B name for the same time-window filter; a positive
 *   number of minutes, defaults to 30. Takes precedence over
 *   `toleranceMinutes` when both are provided.
 * - `lat` / `lng` are the Seeker's pickup-point coordinates. When **both** are
 *   provided, only rides whose pickup point lies within `radius` meters are
 *   returned (proximity filter, Part B REQ-1/REQ-2).
 * - `radius` is a positive number of meters; defaults to
 *   `DEFAULT_PROXIMITY_RADIUS_METERS` (500m) when omitted (REQ-2).
 */
export const rideFeedQuerySchema = z.object({
  source: z
    .string()
    .trim()
    .min(1, 'Source must not be empty.')
    .max(RIDE_ADDRESS_MAX, `Source must be at most ${RIDE_ADDRESS_MAX} characters long.`)
    .optional(),
  destination: z
    .string()
    .trim()
    .min(1, 'Destination must not be empty.')
    .max(RIDE_ADDRESS_MAX, `Destination must be at most ${RIDE_ADDRESS_MAX} characters long.`)
    .optional(),
  time: z.coerce.date().optional(),
  seats: z.coerce
    .number()
    .int('Seats must be a whole number.')
    .min(1, 'Seats must be at least 1.')
    .optional(),
  toleranceMinutes: z.coerce
    .number()
    .int('Tolerance must be a whole number of minutes.')
    .min(0, 'Tolerance must be at least 0 minutes.')
    .max(1440, 'Tolerance must be at most 1440 minutes.')
    .optional(),
  window: z.coerce
    .number()
    .positive('Window must be a positive number of minutes.')
    .max(1440, 'Window must be at most 1440 minutes.')
    .optional(),
  lat: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90.')
    .max(90, 'Latitude must be between -90 and 90.')
    .optional(),
  lng: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180.')
    .max(180, 'Longitude must be between -180 and 180.')
    .optional(),
  radius: z.coerce
    .number()
    .positive('Radius must be a positive number of meters.')
    .max(50000, 'Radius must be at most 50000 meters.')
    .optional()
});

export type RideFeedQueryInput = z.infer<typeof rideFeedQuerySchema>;
