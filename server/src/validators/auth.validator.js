const { z } = require('zod');

exports.signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(32, 'Password too long'),
  role: z.enum(['Admin', 'Analyst', 'Viewer']).optional()
});

exports.signinSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});
