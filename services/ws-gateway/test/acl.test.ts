import { describe, it, expect } from 'vitest'
import { compileWhitelist, isSubjectAllowed } from '../src/acl.js'

describe('ACL whitelist', () => {
  it('xy.md.* matches one token after prefix', () => {
    const re = compileWhitelist(['xy.md.*'])
    expect(isSubjectAllowed('xy.md.bar', re)).toBe(true)
    expect(isSubjectAllowed('xy.md.tick.demo', re)).toBe(false)
    expect(isSubjectAllowed('xy.other', re)).toBe(false)
  })

  it('supports > wildcard', () => {
    const re = compileWhitelist(['xy.md.>'])
    expect(isSubjectAllowed('xy.md.a.b.c', re)).toBe(true)
    expect(isSubjectAllowed('xy.md.', re)).toBe(true)
  })
})
