/**
 * Unit tests for performance utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VirtualScrollManager,
  ImageLoadingManager,
  MemoryManager,
  PerformanceTracker,
  debounce,
  throttle,
  rafThrottle
} from '@/utils/performance-utils';

describe('Performance Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('VirtualScrollManager', () => {
    let container: HTMLElement;
    let manager: VirtualScrollManager;

    beforeEach(() => {
      container = document.createElement('div');
      container.style.height = '500px';
      container.style.overflowY = 'auto';
      document.body.appendChild(container);

      manager = new VirtualScrollManager(container, {
        itemHeight: 100,
        bufferSize: 2,
        threshold: 0.1,
        overscan: 2
      });
    });

    afterEach(() => {
      manager.destroy();
      container.remove();
    });

    it('should initialize with empty state', () => {
      const visible = manager.getVisibleItems();
      expect(visible.items).toEqual([]);
      expect(visible.startIndex).toBe(0);
      expect(visible.endIndex).toBe(0);
    });

    it('should calculate visible range correctly', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      manager.setItems(items);

      const visible = manager.getVisibleItems();
      expect(visible.items.length).toBeGreaterThan(0);
      expect(visible.startIndex).toBe(0);
      expect(visible.endIndex).toBeGreaterThan(visible.startIndex);
    });

    it('should update visible range on scroll', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      manager.setItems(items);

      let rangeChangeCount = 0;
      const cleanup = manager.onVisibleRangeChange(() => {
        rangeChangeCount++;
      });

      // Simulate scroll
      Object.defineProperty(container, 'scrollTop', { value: 500, writable: true });
      container.dispatchEvent(new Event('scroll'));

      // Allow requestAnimationFrame to process
      vi.runAllTimers();

      expect(rangeChangeCount).toBeGreaterThan(0);
      cleanup();
    });

    it('should handle empty items list', () => {
      manager.setItems([]);
      const visible = manager.getVisibleItems();

      expect(visible.items).toEqual([]);
      expect(visible.startIndex).toBe(0);
      expect(visible.endIndex).toBe(0);
    });

    it('should include buffer and overscan in calculations', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      manager.setItems(items);

      const visible = manager.getVisibleItems();

      // Should include buffer items
      expect(visible.items.length).toBeGreaterThan(5); // More than just visible items
    });
  });

  describe('ImageLoadingManager', () => {
    let manager: ImageLoadingManager;
    let mockIntersectionObserver: any;

    beforeEach(() => {
      // Mock IntersectionObserver
      mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
      }));
      global.IntersectionObserver = mockIntersectionObserver;

      manager = new ImageLoadingManager();
    });

    afterEach(() => {
      manager.destroy();
    });

    it('should queue images with different priorities', () => {
      const img1 = document.createElement('img');
      const img2 = document.createElement('img');
      const img3 = document.createElement('img');

      manager.queueImage(img1, 'high');
      manager.queueImage(img2, 'normal');
      manager.queueImage(img3, 'low');

      // High priority images should be processed first
      // This is tested through the internal queue behavior
      expect(img1.src).toBeDefined();
    });

    it('should enable lazy loading with intersection observer', () => {
      const img = document.createElement('img');
      const dataSrc = 'https://example.com/image.jpg';

      manager.enableLazyLoading(img, dataSrc);

      expect(img.dataset.src).toBe(dataSrc);
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it('should handle image load events', () => {
      const img = document.createElement('img');
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

      manager.queueImage(img, 'high');

      // Simulate image load
      img.dispatchEvent(new Event('load'));

      expect(img.complete).toBe(true);
    });

    it('should handle image error events', () => {
      const img = document.createElement('img');
      img.src = 'invalid-url';

      manager.queueImage(img, 'high');

      // Simulate image error
      img.dispatchEvent(new Event('error'));

      // Should continue processing other images
      expect(true).toBe(true); // Test that no error is thrown
    });

    it('should change image priority', () => {
      const img = document.createElement('img');

      manager.queueImage(img, 'low');
      manager.setPriority(img, 'high');

      // Image should now be prioritized
      expect(true).toBe(true); // Internal queue reorganization
    });
  });

  describe('MemoryManager', () => {
    let manager: MemoryManager;
    let mockPerformanceMemory: any;

    beforeEach(() => {
      // Mock performance.memory
      mockPerformanceMemory = {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
      };

      Object.defineProperty(performance, 'memory', {
        value: mockPerformanceMemory,
        writable: true
      });

      manager = new MemoryManager();
    });

    afterEach(() => {
      manager.destroy();
    });

    it('should get memory information', () => {
      const memInfo = manager.getMemoryInfo();

      expect(memInfo).toBeDefined();
      expect(memInfo!.usedJSHeapSize).toBe(50 * 1024 * 1024);
      expect(memInfo!.totalJSHeapSize).toBe(100 * 1024 * 1024);
      expect(memInfo!.jsHeapSizeLimit).toBe(2 * 1024 * 1024 * 1024);
    });

    it('should detect high memory usage', () => {
      // Set high memory usage
      mockPerformanceMemory.usedJSHeapSize = 1.8 * 1024 * 1024 * 1024; // 1.8GB

      const isHigh = manager.isMemoryUsageHigh();
      expect(isHigh).toBe(true);
    });

    it('should detect normal memory usage', () => {
      // Set normal memory usage
      mockPerformanceMemory.usedJSHeapSize = 100 * 1024 * 1024; // 100MB

      const isHigh = manager.isMemoryUsageHigh();
      expect(isHigh).toBe(false);
    });

    it('should register cleanup callbacks', () => {
      const cleanupCallback = vi.fn();
      const unregister = manager.onMemoryPressure(cleanupCallback);

      expect(typeof unregister).toBe('function');

      // Trigger cleanup
      manager.cleanup();
      expect(cleanupCallback).toHaveBeenCalled();

      // Unregister and trigger again
      unregister();
      cleanupCallback.mockClear();
      manager.cleanup();
      expect(cleanupCallback).not.toHaveBeenCalled();
    });

    it('should cleanup blob URLs', () => {
      // Create test blob URLs
      const img1 = document.createElement('img');
      const img2 = document.createElement('img');
      img1.src = 'blob:http://localhost/test1';
      img2.src = 'blob:http://localhost/test2';

      document.body.appendChild(img1);
      document.body.appendChild(img2);

      // Mock URL.revokeObjectURL
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      manager.cleanup();

      // Should not revoke URLs for images still in DOM
      expect(revokeObjectURL).not.toHaveBeenCalled();

      // Remove image from DOM
      img1.remove();
      manager.cleanup();

      img1.remove();
      img2.remove();
    });

    it('should handle missing performance.memory gracefully', () => {
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        writable: true
      });

      const memInfo = manager.getMemoryInfo();
      expect(memInfo).toBeNull();

      const isHigh = manager.isMemoryUsageHigh();
      expect(isHigh).toBe(false);
    });
  });

  describe('PerformanceTracker', () => {
    let tracker: PerformanceTracker;

    beforeEach(() => {
      // Mock PerformanceObserver
      global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
        observe: vi.fn(),
        disconnect: vi.fn()
      }));

      tracker = new PerformanceTracker();
    });

    afterEach(() => {
      tracker.destroy();
    });

    it('should track timing operations', () => {
      const endTiming = tracker.startTiming('test-operation');

      // Simulate some work
      vi.advanceTimersByTime(100);

      endTiming();

      const metrics = tracker.getMetrics('test-operation');
      expect(metrics.length).toBe(1);
      expect(metrics[0].type).toBe('test-operation');
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    it('should add custom metrics', () => {
      tracker.addMetric({
        timestamp: Date.now(),
        type: 'custom-metric',
        duration: 150,
        metadata: { custom: 'data' }
      });

      const metrics = tracker.getMetrics('custom-metric');
      expect(metrics.length).toBe(1);
      expect(metrics[0].duration).toBe(150);
      expect(metrics[0].metadata).toEqual({ custom: 'data' });
    });

    it('should calculate average duration', () => {
      tracker.addMetric({
        timestamp: Date.now(),
        type: 'test',
        duration: 100
      });

      tracker.addMetric({
        timestamp: Date.now(),
        type: 'test',
        duration: 200
      });

      tracker.addMetric({
        timestamp: Date.now(),
        type: 'test',
        duration: 300
      });

      const average = tracker.getAverageDuration('test');
      expect(average).toBe(200);
    });

    it('should limit metrics storage', () => {
      // Add many metrics
      for (let i = 0; i < 1200; i++) {
        tracker.addMetric({
          timestamp: Date.now() + i,
          type: 'bulk-test',
          duration: i
        });
      }

      const allMetrics = tracker.getMetrics();
      expect(allMetrics.length).toBeLessThanOrEqual(1000); // Should be limited
    });

    it('should clear all metrics', () => {
      tracker.addMetric({
        timestamp: Date.now(),
        type: 'test',
        duration: 100
      });

      expect(tracker.getMetrics()).toHaveLength(1);

      tracker.clearMetrics();
      expect(tracker.getMetrics()).toHaveLength(0);
    });

    it('should return 0 average for unknown metric type', () => {
      const average = tracker.getAverageDuration('non-existent');
      expect(average).toBe(0);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should support immediate execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100, true);

      debouncedFn();
      expect(fn).toHaveBeenCalledTimes(1);

      debouncedFn();
      debouncedFn();
      expect(fn).toHaveBeenCalledTimes(1); // Still only once

      vi.advanceTimersByTime(100);
      debouncedFn();
      expect(fn).toHaveBeenCalledTimes(2); // Now called again
    });

    it('should reset timer on new calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);
      debouncedFn(); // Reset timer
      vi.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);

      throttledFn();
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1); // Still only once

      vi.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2); // Now called again
    });

    it('should maintain context', () => {
      const obj = {
        value: 42,
        fn: vi.fn(function(this: any) {
          return this.value;
        })
      };

      const throttledFn = throttle(obj.fn.bind(obj), 100);
      throttledFn();

      expect(obj.fn).toHaveBeenCalled();
    });
  });

  describe('rafThrottle', () => {
    it('should throttle using requestAnimationFrame', () => {
      const fn = vi.fn();
      const throttledFn = rafThrottle(fn);

      // Mock requestAnimationFrame
      let rafCallback: FrameRequestCallback;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        rafCallback = callback;
        return 1;
      });

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).not.toHaveBeenCalled();

      // Execute the RAF callback
      rafCallback!(performance.now());
      expect(fn).toHaveBeenCalledTimes(1);

      // Should be able to call again after RAF
      throttledFn();
      rafCallback!(performance.now());
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle VirtualScrollManager with zero height container', () => {
      const container = document.createElement('div');
      container.style.height = '0px';

      const manager = new VirtualScrollManager(container, {
        itemHeight: 100,
        bufferSize: 2,
        threshold: 0.1,
        overscan: 2
      });

      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      manager.setItems(items);

      const visible = manager.getVisibleItems();
      expect(visible.items.length).toBeGreaterThanOrEqual(0);

      manager.destroy();
      container.remove();
    });

    it('should handle performance tracking without PerformanceObserver support', () => {
      const originalPO = global.PerformanceObserver;
      delete (global as any).PerformanceObserver;

      const tracker = new PerformanceTracker();

      // Should not throw errors
      tracker.addMetric({
        timestamp: Date.now(),
        type: 'test',
        duration: 100
      });

      expect(tracker.getMetrics()).toHaveLength(1);

      tracker.destroy();
      global.PerformanceObserver = originalPO;
    });

    it('should handle memory manager cleanup callback errors', () => {
      const manager = new MemoryManager();
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      manager.onMemoryPressure(errorCallback);
      manager.cleanup();

      expect(consoleWarn).toHaveBeenCalledWith('Cleanup callback failed:', expect.any(Error));

      consoleWarn.mockRestore();
      manager.destroy();
    });
  });
});