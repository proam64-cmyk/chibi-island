import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/EventBus';

interface Ev { ping: { n: number }; pong: { s: string } }

describe('EventBus', () => {
  it('delivers payloads to subscribers of the same type only', () => {
    const bus = new EventBus<Ev>();
    const got: number[] = [];
    bus.on('ping', (p) => got.push(p.n));
    bus.on('pong', () => got.push(-1));
    bus.emit('ping', { n: 3 });
    expect(got).toEqual([3]);
  });
  it('unsubscribes with the returned function and with off()', () => {
    const bus = new EventBus<Ev>();
    let count = 0;
    const fn = () => count++;
    const off = bus.on('ping', fn);
    bus.emit('ping', { n: 1 }); off(); bus.emit('ping', { n: 1 });
    bus.on('ping', fn); bus.off('ping', fn); bus.emit('ping', { n: 1 });
    expect(count).toBe(1);
    expect(bus.listenerCount('ping')).toBe(0);
  });
  it('once() fires a single time, even if the listener emits again', () => {
    const bus = new EventBus<Ev>();
    let count = 0;
    bus.once('ping', () => { count++; bus.emit('ping', { n: 2 }); });
    bus.emit('ping', { n: 1 });
    expect(count).toBe(1);
  });
});
