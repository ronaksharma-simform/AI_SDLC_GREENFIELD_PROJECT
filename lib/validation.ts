import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organization: z.string().trim().min(1, 'Organization is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Validates a sign-in attempt. Deliberately only checks shape (a valid email
 * and a non-empty password): credential *correctness* is verified by
 * NextAuth's `authorize` and any failure there is reported generically, so
 * this schema must never be the source of a "user not found" style hint.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
