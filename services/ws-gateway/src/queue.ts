export class OutboundQueue<T> {
  private q: T[] = [];
  constructor(public readonly max: number) {}

  size() { return this.q.length; }
  push(item: T): { ok: true } | { ok: false } {
    if (this.q.length >= this.max) return { ok: false };
    this.q.push(item);
    return { ok: true };
  }
  drain(consumer: (item: T) => void): number {
    let n = 0;
    while (this.q.length) {
      const it = this.q.shift()!;
      consumer(it);
      n++;
    }
    return n;
  }
}

