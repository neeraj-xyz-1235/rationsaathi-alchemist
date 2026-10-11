import { z } from 'zod'

const email = z.string().trim().toLowerCase().max(254, 'Email must be 254 characters or fewer.').email('Enter a valid email address.')
const password = z.string().min(10, 'Use at least 10 characters.').max(128, 'Password must be 128 characters or fewer.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
})

export const signupSchema = z.object({
  displayName: z.string().trim().max(50, 'Name must be 50 characters or fewer.').optional().or(z.literal('')),
  email, password,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'], message: 'Passwords do not match.',
})
