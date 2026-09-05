require('dotenv').config();
const { z } = require('zod');
const path = require('path');

const envSchema = z.object({
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  UPLOAD_DIR: z.string().default(path.join(__dirname, '../../uploads')),
  MAX_FILE_SIZE: z.coerce.number().default(5242880), // 5MB

  // Dedicated Admin credentials from environment variables
  ADMIN_EMAIL: z.string().default(process.env.ADMIN_EMAIL || ''),
  ADMIN_PASSWORD: z.string().default(process.env.ADMIN_PASSWORD || ''),

  // SMTP / Direct Email Configuration (referencing ADMIN_EMAIL & ADMIN_PASSWORD)
  SMTP_HOST: z.string().default(process.env.SMTP_HOST || 'smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(process.env.SMTP_PORT || 465),
  SMTP_USER: z.string().default(process.env.SMTP_USER || process.env.ADMIN_EMAIL || ''),
  SMTP_PASS: z.string().default(process.env.SMTP_PASS || process.env.ADMIN_PASSWORD || ''),
  SMTP_FROM_EMAIL: z.string().default(process.env.SMTP_FROM_EMAIL || process.env.ADMIN_EMAIL || ''),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Environment validation failed:');
  console.error(error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = { env };
