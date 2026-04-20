// Polyfill PointerEvent for jsdom (not natively supported)
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  (window as unknown as Record<string, unknown>).PointerEvent = PointerEvent;
}
