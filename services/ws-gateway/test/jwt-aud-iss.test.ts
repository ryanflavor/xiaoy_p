import { describe, it, expect } from 'vitest'
import { SignJWT, generateKeyPair } from 'jose'
import { verifyJwt } from '../src/jwt.js'

describe('JWT audience/issuer constraints', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const pubPem = (publicKey as any).export({ format: 'pem', type: 'spki' }).toString()

  it('accepts token when aud/iss match allowed lists', async () => {
    const token = await new SignJWT({ sub: 'u1', scope: 'read' })
      .setProtectedHeader({ alg: 'RS256' })
      .setAudience(['app-x'])
      .setIssuer('issuer-x')
      .setExpirationTime('5m')
      .sign(privateKey)
    const claims = await verifyJwt(token, { publicKeyPemPathOrString: pubPem, allowedAud: ['app-x'], allowedIss: ['issuer-x'] })
    expect(claims.sub).toBe('u1')
  })

  it('rejects token when aud not allowed', async () => {
    const token = await new SignJWT({ sub: 'u2' })
      .setProtectedHeader({ alg: 'RS256' })
      .setAudience('app-y')
      .setIssuer('issuer-x')
      .setExpirationTime('5m')
      .sign(privateKey)
    await expect(verifyJwt(token, { publicKeyPemPathOrString: pubPem, allowedAud: ['app-x'], allowedIss: ['issuer-x'] })).rejects.toBeTruthy()
  })
})

