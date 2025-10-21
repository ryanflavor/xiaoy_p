import { describe, it, expect } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair, importJWK } from 'jose'
import { verifyJwt } from '../src/jwt.js'

describe('JWT verification (public key)', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  const pub = await importJWK(jwk, 'RS256')
  // obtain PEM SPKI string from crypto subtle export workaround
  // For tests, we sign and verify using jose; verifyJwt will accept the PEM via string
  // Build a PEM from Node's publicKey export
  const pubPem = (publicKey as any).export({ format: 'pem', type: 'spki' }).toString()

  it('verifies a valid token', async () => {
    const token = await new SignJWT({ sub: 'user1', scope: 'read' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(privateKey)

    const claims = await verifyJwt(token, { publicKeyPemPathOrString: pubPem })
    expect(claims.sub).toBe('user1')
  })

  it('rejects invalid token', async () => {
    const token = await new SignJWT({ sub: 'user2' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(privateKey)
    await expect(verifyJwt(token + 'x', { publicKeyPemPathOrString: pubPem })).rejects.toBeTruthy()
  })
})
