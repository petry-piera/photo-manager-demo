/**
 * Performance optimization utilities for PhotoManager
 * - Virtual scrolling optimizations
 * - Image loading prioritization
 * - Memory cleanup utilities
 * - Performance metrics collection
 */

/**
 * Virtual scrolling configuration
 */
export interface VirtualScrollConfig {
  itemHeight: number;
  bufferSize: number;
  threshold: number;
  overscan: number;
}

/**
 * Image loading priority levels
 */
export type ImagePriority = 'high' | 'normal' | 'low';

/**
 * Performance metrics data
 */
export interface PerformanceMetrics {
  timestamp: number;
  type: string;
  duration: number;
  metadata?: Record<string, any>;
}

/**
 * Memory usage information
 */
export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  estimatedDOMSize: number;
  imageMemoryUsage: number;
}

/**
 * Virtual scrolling optimization utility
 */
export class VirtualScrollManager {
  private config: VirtualScrollConfig;
  private container: HTMLElement;
  private items: any[];
  private visibleRange: { start: number; end: number } = { start: 0, end: 0 };
  private scrollTop = 0;
  private callbacks: Set<(range: { start: number; end: number }) => void> = new Set();

  constructor(container: HTMLElement, config: VirtualScrollConfig) {
    this.container = container;
    this.config = config;
    this.items = [];
    this.setupScrollListener();
  }

  /**
   * Set items for virtual scrolling
   */
  setItems(items: any[]): void {
    this.items = items;
    this.updateVisibleRange();
    this.updateScrollHeight();
  }

  /**
   * Get currently visible items
   */
  getVisibleItems(): { items: any[]; startIndex: number; endIndex: number } {
    const { start, end } = this.visibleRange;
    return {
      items: this.items.slice(start, end),
      startIndex: start,
      endIndex: end
    };
  }

  /**
   * Subscribe to visible range changes
   */
  onVisibleRangeChange(callback: (range: { start: number; end: number }) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Setup scroll event listener with throttling
   */
  private setupScrollListener(): void {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.scrollTop = this.container.scrollTop;
          this.updateVisibleRange();
          ticking = false;
        });
        ticking = true;
      }
    };

    this.container.addEventListener('scroll', handleScroll, { passive: true });
  }

  /**
   * Update visible range based on scroll position
   */
  private updateVisibleRange(): void {
    const containerHeight = this.container.clientHeight;
    const startIndex = Math.floor(this.scrollTop / this.config.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / this.config.itemHeight) + this.config.overscan,
      this.items.length
    );

    const bufferedStart = Math.max(0, startIndex - this.config.bufferSize);
    const bufferedEnd = Math.min(this.items.length, endIndex + this.config.bufferSize);

    if (bufferedStart !== this.visibleRange.start || bufferedEnd !== this.visibleRange.end) {
      this.visibleRange = { start: bufferedStart, end: bufferedEnd };
      this.notifyRangeChange();
    }
  }

  /**
   * Update total scroll height
   */
  private updateScrollHeight(): void {
    const totalHeight = this.items.length * this.config.itemHeight;
    this.container.style.height = `${totalHeight}px`;
  }

  /**
   * Notify callbacks of range change
   */
  private notifyRangeChange(): void {
    this.callbacks.forEach(callback => callback(this.visibleRange));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.callbacks.clear();
  }
}

/**
 * Image loading prioritization system
 */
export class ImageLoadingManager {
  private loadQueue: Map<ImagePriority, Set<HTMLImageElement>> = new Map([
    ['high', new Set()],
    ['normal', new Set()],
    ['low', new Set()]
  ]);
  private loading = new Set<HTMLImageElement>();
  private maxConcurrentLoads = 3;
  private observer?: IntersectionObserver;

  constructor() {
    this.setupIntersectionObserver();
  }

  /**
   * Queue image for loading with priority
   */
  queueImage(img: HTMLImageElement, priority: ImagePriority = 'normal'): void {
    this.loadQueue.get(priority)?.add(img);
    this.processQueue();
  }

  /**
   * Set image loading priority
   */
  setPriority(img: HTMLImageElement, newPriority: ImagePriority): void {
    // Remove from current queue
    this.loadQueue.forEach(queue => queue.delete(img));

    // Add to new priority queue
    this.loadQueue.get(newPriority)?.add(img);
    this.processQueue();
  }

  /**
   * Enable lazy loading for images in viewport
   */
  enableLazyLoading(img: HTMLImageElement, dataSrc: string): void {
    img.dataset.src = dataSrc;
    this.observer?.observe(img);
  }

  /**
   * Process loading queue
   */
  private processQueue(): void {
    if (this.loading.size >= this.maxConcurrentLoads) {
      return;
    }

    // Process high priority first, then normal, then low
    const priorities: ImagePriority[] = ['high', 'normal', 'low'];

    for (const priority of priorities) {
      const queue = this.loadQueue.get(priority);
      if (!queue || queue.size === 0) continue;

      const img = queue.values().next().value;
      if (img) {
        queue.delete(img);
        this.loadImage(img);

        if (this.loading.size >= this.maxConcurrentLoads) {
          break;
        }
      }
    }
  }

  /**
   * Load individual image
   */
  private loadImage(img: HTMLImageElement): void {
    this.loading.add(img);

    const onLoad = () => {
      this.loading.delete(img);
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      this.processQueue();
    };

    const onError = () => {
      this.loading.delete(img);
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      this.processQueue();
    };

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);

    // Start loading
    if (img.dataset.src) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
  }

  /**
   * Setup intersection observer for lazy loading
   */
  private setupIntersectionObserver(): void {
    if (!('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              this.queueImage(img, 'high');
              this.observer?.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.1
      }
    );
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.observer?.disconnect();
    this.loadQueue.forEach(queue => queue.clear());
    this.loading.clear();
  }
}

/**
 * Memory management utilities
 */
export class MemoryManager {
  private memoryThreshold = 0.8; // 80% of available memory
  private cleanupCallbacks: Set<() => void> = new Set();
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.startMemoryMonitoring();
  }

  /**
   * Get current memory usage information
   */
  getMemoryInfo(): MemoryInfo | null {
    if (!('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    const domNodes = document.querySelectorAll('*').length;
    const images = document.querySelectorAll('img').length;

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      estimatedDOMSize: domNodes * 100, // Rough estimate
      imageMemoryUsage: images * 50000 // Rough estimate per image
    };
  }

  /**
   * Check if memory usage is high
   */
  isMemoryUsageHigh(): boolean {
    const memInfo = this.getMemoryInfo();
    if (!memInfo) return false;

    const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
    return usageRatio > this.memoryThreshold;
  }

  /**
   * Register cleanup callback
   */
  onMemoryPressure(callback: () => void): () => void {
    this.cleanupCallbacks.add(callback);
    return () => this.cleanupCallbacks.delete(callback);
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection(): void {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  /**
   * Cleanup unused resources
   */
  cleanup(): void {
    // Revoke object URLs that might be unused
    const images = document.querySelectorAll('img[src^="blob:"]');
    images.forEach(img => {
      if (!img.parentElement) {
        URL.revokeObjectURL((img as HTMLImageElement).src);
      }
    });

    // Call registered cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Cleanup callback failed:', error);
      }
    });

    // Force garbage collection
    this.forceGarbageCollection();
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      if (this.isMemoryUsageHigh()) {
        console.warn('High memory usage detected, triggering cleanup');
        this.cleanup();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop memory monitoring
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.cleanupCallbacks.clear();
  }
}

/**
 * Performance metrics collection
 */
export class PerformanceTracker {
  private metrics: PerformanceMetrics[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private maxMetrics = 1000;

  constructor() {
    this.setupPerformanceObservers();
  }

  /**
   * Start timing operation
   */
  startTiming(name: string): () => void {
    const startTime = performance.now();
    return () => this.endTiming(name, startTime);
  }

  /**
   * End timing operation
   */
  endTiming(name: string, startTime: number, metadata?: Record<string, any>): void {
    const duration = performance.now() - startTime;
    this.addMetric({
      timestamp: Date.now(),
      type: name,
      duration,
      metadata
    });
  }

  /**
   * Add custom metric
   */
  addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only latest metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.maxMetrics);
    }
  }

  /**
   * Get metrics by type
   */
  getMetrics(type?: string): PerformanceMetrics[] {
    return type
      ? this.metrics.filter(m => m.type === type)
      : [...this.metrics];
  }

  /**
   * Get average duration for metric type
   */
  getAverageDuration(type: string): number {
    const typeMetrics = this.getMetrics(type);
    if (typeMetrics.length === 0) return 0;

    const total = typeMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / typeMetrics.length;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Setup performance observers
   */
  private setupPerformanceObservers(): void {
    if (!('PerformanceObserver' in window)) return;

    // Observe navigation timing
    try {
      const navObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.addMetric({
              timestamp: Date.now(),
              type: 'navigation',
              duration: navEntry.loadEventEnd - navEntry.navigationStart,
              metadata: {
                domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.navigationStart,
                firstPaint: navEntry.loadEventStart - navEntry.navigationStart
              }
            });
          }
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.set('navigation', navObserver);
    } catch (error) {
      console.warn('Failed to setup navigation observer:', error);
    }

    // Observe paint timing
    try {
      const paintObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.addMetric({
            timestamp: Date.now(),
            type: entry.name || 'paint',
            duration: entry.startTime,
            metadata: { entryType: entry.entryType }
          });
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.set('paint', paintObserver);
    } catch (error) {
      console.warn('Failed to setup paint observer:', error);
    }

    // Observe largest contentful paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.addMetric({
            timestamp: Date.now(),
            type: 'largest-contentful-paint',
            duration: lastEntry.startTime,
            metadata: { size: (lastEntry as any).size }
          });
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.set('lcp', lcpObserver);
    } catch (error) {
      console.warn('Failed to setup LCP observer:', error);
    }
  }

  /**
   * Cleanup observers
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics = [];
  }
}

/**
 * Debounced function utility
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function(this: any, ...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };

    const callNow = immediate && !timeout;

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func.apply(this, args);
  };
}

/**
 * Throttled function utility
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * RequestAnimationFrame-based throttle
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return function(this: any, ...args: Parameters<T>) {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        rafId = null;
      });
    }
  };
}

/**
 * Create performance-optimized global instances
 */
export const imageLoadingManager = new ImageLoadingManager();
export const memoryManager = new MemoryManager();
export const performanceTracker = new PerformanceTracker();

/**
 * Initialize performance optimizations
 */
export function initializePerformanceOptimizations(): void {
  // Add global performance monitoring
  console.log('🚀 Performance optimizations initialized');

  // Monitor FPS
  let frameCount = 0;
  let lastTime = performance.now();

  function countFPS() {
    frameCount++;
    const currentTime = performance.now();

    if (currentTime - lastTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      performanceTracker.addMetric({
        timestamp: Date.now(),
        type: 'fps',
        duration: fps,
        metadata: { period: currentTime - lastTime }
      });

      frameCount = 0;
      lastTime = currentTime;
    }

    requestAnimationFrame(countFPS);
  }

  requestAnimationFrame(countFPS);
}

/**
 * Cleanup all performance utilities
 */
export function cleanupPerformanceUtils(): void {
  imageLoadingManager.destroy();
  memoryManager.destroy();
  performanceTracker.destroy();
}