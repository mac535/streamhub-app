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

  // SMTP / Email
  SMTP_HOST: z.string().default('mail.stream.net.in'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().default('support@stream.net.in'),
  SMTP_PASS: z.string().default('MSAK9KdE>*RR9bJ<'),
  SMTP_FROM_EMAIL: z.string().default('support@stream.net.in'),

  // Admin credentials
  ADMIN_EMAIL: z.string().default('support@stream.net.in'),
  ADMIN_PASSWORD: z.string().default('MSAK9KdE>*RR9bJ<'),
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
