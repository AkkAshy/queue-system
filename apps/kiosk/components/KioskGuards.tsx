'use client';

import { useEffect } from 'react';

/**
 * Blocks context menu, text selection, and common escape keys.
 * Does NOT exit fullscreen — that's done by the browser's kiosk-mode flag.
 */
export function KioskGuards() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();

    const keyHandler = (e: KeyboardEvent) => {
      // F5, F11, F12, Ctrl+R, Ctrl+Shift+I, Ctrl+U, Alt+F4
      const block =
        ['F5', 'F11', 'F12'].includes(e.key) ||
        (e.ctrlKey && ['r', 'R', 'u', 'U'].includes(e.key)) ||
        (e.ctrlKey && e.shiftKey && ['i', 'I', 'j', 'J'].includes(e.key)) ||
        (e.altKey && e.key === 'F4');
      if (block) e.preventDefault();
    };

    document.addEventListener('contextmenu', prevent);
    document.addEventListener('selectstart', prevent);
    document.addEventListener('dragstart', prevent);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('selectstart', prevent);
      document.removeEventListener('dragstart', prevent);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  return null;
}
