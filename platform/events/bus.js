// platform/events/bus.js
// EventBus — Architecture v1.0, interface version 1.
//
// Extracted verbatim from engine.js (the first implementation step of the
// platform refactor). on()/emit() behave exactly as before; off() and the
// unsubscribe return value are ADDITIVE to satisfy the frozen interface and
// change no existing behavior (nothing called off() before; callers that
// ignore on()'s return value are unaffected).
//
// Shared by every app (game, terminal, future shells). No dependencies.

class EventBus {
  constructor() { this._listeners = {}; }

  // subscribe; returns an unsubscribe function
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const arr = this._listeners[event];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i !== -1) arr.splice(i, 1);
  }

  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }
}

EventBus.version = 1;
