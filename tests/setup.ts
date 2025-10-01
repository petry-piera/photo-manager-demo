/**
 * Test setup configuration
 */

import { beforeAll, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock DOM APIs that aren't available in happy-dom
beforeAll(() => {
  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    callback: IntersectionObserverCallback;
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock requestAnimationFrame
  global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(callback, 16);
  };

  global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  // Mock URL methods
  global.URL.createObjectURL = () => 'blob:mock-url';
  global.URL.revokeObjectURL = () => {};

  // Mock PerformanceObserver
  global.PerformanceObserver = class PerformanceObserver {
    constructor(callback: PerformanceObserverCallback) {
      this.callback = callback;
    }
    callback: PerformanceObserverCallback;
    observe() {}
    disconnect() {}
  };

  // Mock performance.memory (Chrome only)
  Object.defineProperty(performance, 'memory', {
    get: () => ({
      usedJSHeapSize: 16777216, // 16MB
      totalJSHeapSize: 33554432, // 32MB
      jsHeapSizeLimit: 2147483648 // 2GB
    }),
    configurable: true
  });

  // Mock File System Access API
  global.showOpenFilePicker = () => Promise.resolve([]);

  // Mock canvas context
  HTMLCanvasElement.prototype.getContext = () => {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
    } as any;
  };

  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,mock';
});

// Cleanup after each test
afterEach(() => {
  // Clear any remaining timers
  clearTimeout.mockClear?.();
  clearInterval.mockClear?.();

  // Clear DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});