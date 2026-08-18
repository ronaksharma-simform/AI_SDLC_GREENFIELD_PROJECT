import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organization: z.string().trim().min(1, 'Organization is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
