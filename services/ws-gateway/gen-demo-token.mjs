import { generateKeyPair, exportSPKI, SignJWT } from 'jose'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const dir = path.dirname(fileURLToPath(import.meta.url))
const { privateKey, publicKey } = await generateKeyPair('RS256')
const pub = await exportSPKI(publicKey)
const token = await new SignJWT({ sub: 'demo-user', scope: 'read' })
  .setProtectedHeader({ alg: 'RS256', kid: 'demo-kid-1' })
  .setIssuedAt()
  .setExpirationTime('20m')
  .sign(privateKey)
writeFileSync(path.join(dir, '.demo_pub.pem'), pub.trim() + '\n')
writeFileSync(path.join(dir, '.demo_token.txt'), token + '\n')
console.log('PUB='+path.join(dir, '.demo_pub.pem'))
console.log('TOKEN='+token)
