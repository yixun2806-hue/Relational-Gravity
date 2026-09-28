import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  INVITE_EXPIRES_DAYS: z.coerce.number().default(7),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().default(""),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  WEB_ORIGIN: z.string().default(""),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = envSchema.parse(env);
  if (config.NODE_ENV === "production" && !config.ADMIN_PASSWORD) {
    throw new Error("生产环境必须配置 ADMIN_PASSWORD");
  }
  return config;
}
