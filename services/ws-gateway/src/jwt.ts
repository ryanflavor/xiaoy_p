import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readFile } from 'node:fs/promises';
import { createPublicKey } from 'node:crypto';

export type JwtOptions = {
  jwksUrl?: string;
  publicKeyPemPathOrString?: string;
  allowedAud?: string | string[];
  allowedIss?: string | string[];
};

export type JwtClaims = Record<string, any> & {
  sub?: string;
  scope?: string;
};

export async function verifyJwt(token: string, opts: JwtOptions): Promise<JwtClaims> {
  const { jwksUrl, publicKeyPemPathOrString, allowedAud, allowedIss } = opts;
  const clockToleranceSec = Number(process.env.JWT_CLOCK_TOLERANCE_SEC || '0') || 0
  let key: any;
  if (jwksUrl) {
    key = createRemoteJWKSet(new URL(jwksUrl));
  } else if (publicKeyPemPathOrString) {
    const pem = publicKeyPemPathOrString.includes('BEGIN PUBLIC KEY') || publicKeyPemPathOrString.includes('BEGIN RSA PUBLIC KEY')
      ? publicKeyPemPathOrString
      : await readFile(publicKeyPemPathOrString, 'utf8');
    key = createPublicKey(pem);
  } else {
    throw new Error('JWT verification requires JWKS URL or PUBLIC KEY');
  }

  const { payload } = await jwtVerify(token, key, {
    audience: allowedAud,
    issuer: allowedIss,
    clockTolerance: clockToleranceSec,
  });
  return payload as JwtClaims;
}

export function extractTokenFromHeaders(headers: IncomingHttpHeadersLike, urlQueryToken?: string | null): string | null {
  const auth = headers['authorization'];
  if (auth && typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1];
  }
  const proto = headers['sec-websocket-protocol'];
  if (proto && typeof proto === 'string') {
    // e.g., 'bearer, eyJhbGciOi...'
    const parts = proto.split(',').map(s => s.trim());
    const idx = parts.findIndex(p => p.toLowerCase() === 'bearer');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  }
  if (urlQueryToken) return urlQueryToken;
  return null;
}

export type IncomingHttpHeadersLike = Record<string, string | string[] | undefined>;
