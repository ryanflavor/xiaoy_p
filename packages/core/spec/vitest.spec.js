import { describe, it, expect } from 'vitest';
import { sum } from '../index.js';

describe('sum', () => {
  it('adds numbers', () => {
    expect(sum(1, 2)).toBe(3);
  });
});
