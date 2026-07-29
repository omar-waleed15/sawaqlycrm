'use client';

/**
 * Creates an unthrottled background timer using a Web Worker.
 * Web Workers run in a separate background thread and are NEVER throttled by Chrome/Edge
 * when the browser tab is hidden, minimized, or on another screen.
 */
export function createBackgroundTimer(callback: () => void, intervalMs: number = 3000): () => void {
  if (typeof window === 'undefined') return () => {};

  try {
    const workerCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data.action === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('tick');
          }, e.data.intervalMs || 3000);
        } else if (e.data.action === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e) => {
      if (e.data === 'tick') {
        callback();
      }
    };

    worker.postMessage({ action: 'start', intervalMs });

    return () => {
      try {
        worker.postMessage({ action: 'stop' });
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      } catch (err) {
        // Silently swallow cleanup errors
      }
    };
  } catch (err) {
    // Fallback to standard setInterval if Web Worker creation is blocked by CSP
    const interval = setInterval(callback, intervalMs);
    return () => clearInterval(interval);
  }
}

/**
 * Request native OS Desktop Notification permissions.
 */
export function requestDesktopNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// Auto-request permission on first click
if (typeof window !== 'undefined') {
  const initPermission = () => {
    requestDesktopNotificationPermission();
    window.removeEventListener('click', initPermission);
  };
  window.addEventListener('click', initPermission, { once: true });
}

/**
 * Display a native OS Desktop Notification banner (Windows Action Center / macOS Notification Center).
 */
export function sendDesktopNotification(title: string, options?: { body?: string; icon?: string; tag?: string }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body: options?.body || '',
      icon: options?.icon || '/logo.png',
      tag: options?.tag,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.error('Failed to trigger desktop notification banner', err);
  }
}
