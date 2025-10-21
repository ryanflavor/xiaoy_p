import { describe, it, expect } from 'vitest'
import { OutboundQueue } from '../src/queue.js'

describe('OutboundQueue', () => {
  it('enforces max size and drains', () => {
    const q = new OutboundQueue<number>(3)
    expect(q.push(1).ok).toBe(true)
    expect(q.push(2).ok).toBe(true)
    expect(q.push(3).ok).toBe(true)
    expect(q.push(4).ok).toBe(false)
    const consumed:number[] = []
    const n = q.drain(x => consumed.push(x))
    expect(n).toBe(3)
    expect(consumed).toEqual([1,2,3])
    expect(q.size()).toBe(0)
  })
})

