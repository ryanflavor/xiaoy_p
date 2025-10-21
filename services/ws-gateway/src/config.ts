import { readFileSync } from 'node:fs';
import { ZodError, z } from 'zod';

export const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  WS_PATH: z.string().default('/ws'),
  HEALTH_PATH: z.string().default('/healthz'),
  METRICS_PATH: z.string().default('/metrics'),

  // TLS for HTTP server
  TLS_ENABLE: z.coerce.boolean().default(false),
  TLS_CERT_PATH: z.string().optional(),
  TLS_KEY_PATH: z.string().optional(),
  TLS_CA_PATH: z.string().optional(),

  // NATS
  NATS_URLS: z.string().default('nats://localhost:4222'),
  NATS_TLS_ENABLE: z.coerce.boolean().default(false),
  NATS_TLS_CA: z.string().optional(),
  NATS_TLS_CERT: z.string().optional(),
  NATS_TLS_KEY: z.string().optional(),

  // Auth
  JWT_JWKS_URL: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(), // PEM (SPKI)
  JWT_ALLOWED_AUD: z.string().optional(), // CSV
  JWT_ALLOWED_ISS: z.string().optional(), // CSV
  ALLOWED_ORIGINS: z.string().default('*'), // CSV or '*'

  // ACL
  WS_SUBJECT_WHITELIST: z.string().default('xy.md.*'), // CSV of patterns

  // Backpressure / queues
  WS_SEND_QUEUE_MAX: z.coerce.number().int().positive().default(1000),
});

export type AppConfig = z.infer<typeof configSchema> & {
  tls?: {
    cert: Buffer;
    key: Buffer;
    ca?: Buffer;
  };
  natsTls?: {
    cert?: Buffer;
    key?: Buffer;
    ca?: Buffer;
  };
  allowedOrigins: string[] | '*';
  whitelist: string[];
  allowedAud?: string[];
  allowedIss?: string[];
};

export function loadConfig(env = process.env): AppConfig {
  let base: z.infer<typeof configSchema>;
  try {
    base = configSchema.parse(env);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error('Configuration invalid: ' + e.errors.map(er => er.message).join('; '));
    }
    throw e;
  }

  const allowedOrigins = base.ALLOWED_ORIGINS.trim() === '*'
    ? '*'
    : base.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  const whitelist = base.WS_SUBJECT_WHITELIST.split(',').map(s => s.trim()).filter(Boolean);

  const cfg: AppConfig = {
    ...base,
    allowedOrigins,
    whitelist,
  } as any;

  if (base.TLS_ENABLE) {
    if (!base.TLS_CERT_PATH || !base.TLS_KEY_PATH) {
      throw new Error('TLS_ENABLE=true requires TLS_CERT_PATH and TLS_KEY_PATH');
    }
    cfg.tls = {
      cert: readFileSync(base.TLS_CERT_PATH),
      key: readFileSync(base.TLS_KEY_PATH),
      ca: base.TLS_CA_PATH ? readFileSync(base.TLS_CA_PATH) : undefined,
    };
  }

  if (base.NATS_TLS_ENABLE) {
    cfg.natsTls = {
      cert: base.NATS_TLS_CERT ? readFileSync(base.NATS_TLS_CERT) : undefined,
      key: base.NATS_TLS_KEY ? readFileSync(base.NATS_TLS_KEY) : undefined,
      ca: base.NATS_TLS_CA ? readFileSync(base.NATS_TLS_CA) : undefined,
    };
  }

  // Parse allowed audience/issuer lists if provided
  if (base.JWT_ALLOWED_AUD) {
    cfg.allowedAud = base.JWT_ALLOWED_AUD.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (base.JWT_ALLOWED_ISS) {
    cfg.allowedIss = base.JWT_ALLOWED_ISS.split(',').map(s => s.trim()).filter(Boolean);
  }

  return cfg;
}
