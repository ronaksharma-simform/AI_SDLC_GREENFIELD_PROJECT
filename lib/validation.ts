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
