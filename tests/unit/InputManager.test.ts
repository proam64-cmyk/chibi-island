import { describe, expect, it } from 'vitest';
import { InputManager } from '../../src/input/InputManager';

const key = (type: string, code: string, repeat = false) => Object.assign(new Event(type, { cancelable: true }), { code, repeat });
const pointer = (type: string, id: number, x: number, y: number) => Object.assign(new Event(type), { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0 });

describe('InputManager', () => {
  it('maps WASD to a normalized move vector and Shift to run', () => {
    const keys = new EventTarget(), ptr = new EventTarget();
    const im = new InputManager(keys, ptr);
    keys.dispatchEvent(key('keydown', 'KeyW'));
    keys.dispatchEvent(key('keydown', 'KeyD'));
    keys.dispatchEvent(key('keydown', 'ShiftLeft'));
    im.update(0.016);
    expect(Math.hypot(im.state.moveX, im.state.moveY)).toBeCloseTo(1, 5);
    expect(im.state.moveX).toBeGreaterThan(0);
    expect(im.state.moveY).toBeGreaterThan(0);
    expect(im.state.run).toBe(true);
    keys.dispatchEvent(key('keyup', 'KeyW'));
    keys.dispatchEvent(key('keyup', 'KeyD'));
    im.update(0.016);
    expect(im.state.moveX).toBe(0);
    expect(im.state.moveY).toBe(0);
  });
  it('reports jump for exactly one frame per press and ignores key repeat', () => {
    const keys = new EventTarget();
    const im = new InputManager(keys, new EventTarget());
    keys.dispatchEvent(key('keydown', 'Space'));
    im.update(0.016); expect(im.state.jumpPressed).toBe(true);
    keys.dispatchEvent(key('keydown', 'Space', true));
    im.update(0.016); expect(im.state.jumpPressed).toBe(false);
  });
  it('fires toggle handlers once per press (F3)', () => {
    const keys = new EventTarget();
    const im = new InputManager(keys, new EventTarget());
    let n = 0;
    im.onToggle('F3', () => n++);
    keys.dispatchEvent(key('keydown', 'F3'));
    keys.dispatchEvent(key('keydown', 'F3', true));
    expect(n).toBe(1);
  });
  it('accumulates one-finger drag as camera look and two-finger pinch as zoom', () => {
    const ptr = new EventTarget();
    const im = new InputManager(new EventTarget(), ptr);
    ptr.dispatchEvent(pointer('pointerdown', 1, 100, 100));
    ptr.dispatchEvent(pointer('pointermove', 1, 130, 90));
    expect(im.consumeLook()).toEqual({ dx: 30, dy: -10 });
    expect(im.consumeLook()).toEqual({ dx: 0, dy: 0 });
    ptr.dispatchEvent(pointer('pointerdown', 2, 230, 90));      // pinch starts at 100 px apart
    ptr.dispatchEvent(pointer('pointermove', 2, 330, 90));      // 200 px apart → zoom in (negative)
    expect(im.consumeZoom()).toBeLessThan(0);
    expect(im.idleCameraTime).toBe(0);
  });
  it('clears held keys when the window loses focus', () => {
    const keys = new EventTarget();
    const im = new InputManager(keys, new EventTarget());
    keys.dispatchEvent(key('keydown', 'KeyW'));
    keys.dispatchEvent(new Event('blur'));
    im.update(0.016);
    expect(im.state.moveY).toBe(0);
  });
});
