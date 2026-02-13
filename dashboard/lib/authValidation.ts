import { z } from 'zod';

const passwordSchema = z
  .string().min(8, 'Password must be at least 8 characters long').refine((pwd) =>
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    { message: 'Password must contain uppercase, lowercase, number, and special character' }
  );

const cleanTeam = z.string().optional().transform((value) => {
  if (typeof value !== 'string') return undefined;
  
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
});

export const registerSchema = z
  .object({email: z.string().trim().min(1, 'Email is required').email('Invalid email format'),
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters').regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    teamName: cleanTeam, }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.output<typeof registerSchema>;
export type RegisterFormInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(1, 'Email or username required'),
  password: z.string().min(1, 'Password required'),
  rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
