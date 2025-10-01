/**
 * Unit tests for image utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadImage,
  getImageDimensions,
  resizeImage,
  generateThumbnail,
  ProgressiveImageLoader,
  LazyImageLoader,
  ImageValidation,
  ImageMemoryManager,
  ColorAnalysis
} from '@/utils/image-utils';

// Mock HTML Image element
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  crossOrigin = '';
  referrerPolicy = '';
  naturalWidth = 800;
  naturalHeight = 600;
  complete = false;
  width = 800;
  height = 600;

  static shouldError = false;
  static shouldTimeout = false;

  constructor() {
    // Simulate async loading
    setTimeout(() => {
      if (MockImage.shouldTimeout) {
        return; // Don't call onload or onerror
      }

      this.complete = true;
      if (MockImage.shouldError && this.onerror) {
        this.onerror();
      } else if (this.onload) {
        this.onload();
      }
    }, 1); // Reduced delay
  }
}

// Mock Canvas and Context
class MockCanvasRenderingContext2D {
  fillStyle = '';
  canvas = { width: 0, height: 0 };

  static shouldReturnNull = false;

  fillRect = vi.fn();
  drawImage = vi.fn();
  getImageData = vi.fn(() => ({
    data: new Uint8ClampedArray([128, 128, 128, 255, 64, 64, 64, 255, 192, 192, 192, 255])
  }));
  toDataURL = vi.fn(() => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...');
}

class MockCanvas {
  width = 0;
  height = 0;

  getContext = vi.fn(() => {
    if (MockCanvasRenderingContext2D.shouldReturnNull) {
      return null;
    }
    return new MockCanvasRenderingContext2D();
  });
  toDataURL = vi.fn(() => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...');
}

describe('Image Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset mock state
    MockImage.shouldError = false;
    MockImage.shouldTimeout = false;
    MockCanvasRenderingContext2D.shouldReturnNull = false;

    // Mock Image constructor
    global.Image = MockImage as any;

    // Mock document.createElement for canvas
    const originalCreateElement = document.createElement;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return new MockCanvas() as any;
      }
      return originalCreateElement.call(document, tagName);
    });

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('loadImage', () => {
    it('should load image from string URL', async () => {
      const imagePromise = loadImage('https://example.com/image.jpg');

      vi.advanceTimersByTime(20);
      const img = await imagePromise;

      expect(img).toBeInstanceOf(MockImage);
      expect(img.src).toBe('https://example.com/image.jpg');
    });

    it('should load image from File', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const imagePromise = loadImage(file);

      vi.advanceTimersByTime(20);
      const img = await imagePromise;

      expect(img).toBeInstanceOf(MockImage);
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
    });

    it('should handle image load timeout', async () => {
      MockImage.shouldTimeout = true;
      const imagePromise = loadImage('https://example.com/image.jpg', { timeout: 50 });

      vi.advanceTimersByTime(60);

      await expect(imagePromise).rejects.toThrow('Image load timeout');
    });

    it('should handle image load error', async () => {
      MockImage.shouldError = true;
      const imagePromise = loadImage('https://example.com/broken-image.jpg');

      vi.advanceTimersByTime(20);

      await expect(imagePromise).rejects.toThrow('Failed to load image: https://example.com/broken-image.jpg');
    });

    it('should set cross-origin and referrer policy', async () => {
      const imagePromise = loadImage('https://example.com/image.jpg', {
        crossOrigin: 'anonymous',
        referrerPolicy: 'no-referrer'
      });

      vi.advanceTimersByTime(20);
      const img = await imagePromise;

      expect(img.crossOrigin).toBe('anonymous');
      expect(img.referrerPolicy).toBe('no-referrer');
    });

    it('should handle zero timeout (no timeout)', async () => {
      const imagePromise = loadImage('https://example.com/image.jpg', { timeout: 0 });

      vi.advanceTimersByTime(20);
      const img = await imagePromise;

      expect(img).toBeInstanceOf(MockImage);
    });
  });

  describe('getImageDimensions', () => {
    it('should get dimensions from string URL', async () => {
      const dimensionsPromise = getImageDimensions('https://example.com/image.jpg');

      vi.advanceTimersByTime(20);
      const dimensions = await dimensionsPromise;

      expect(dimensions).toEqual({
        width: 800,
        height: 600,
        aspectRatio: 800 / 600
      });
    });

    it('should get dimensions from File and cleanup URL', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const dimensionsPromise = getImageDimensions(file);

      vi.advanceTimersByTime(20);
      const dimensions = await dimensionsPromise;

      expect(dimensions).toEqual({
        width: 800,
        height: 600,
        aspectRatio: 800 / 600
      });
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('resizeImage', () => {
    it('should resize image with width constraint', async () => {
      const resizedPromise = resizeImage('https://example.com/image.jpg', {
        width: 400,
        maintainAspectRatio: true
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await resizedPromise;

      expect(dataUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...');
    });

    it('should resize image with max constraints', async () => {
      const resizedPromise = resizeImage('https://example.com/image.jpg', {
        maxWidth: 400,
        maxHeight: 300,
        maintainAspectRatio: true
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await resizedPromise;

      expect(dataUrl).toBeTruthy();
    });

    it('should resize with specific format and quality', async () => {
      const resizedPromise = resizeImage('https://example.com/image.jpg', {
        width: 400,
        format: 'png',
        quality: 0.9
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await resizedPromise;

      expect(dataUrl).toBeTruthy();
    });

    it('should handle HTMLImageElement as source', async () => {
      const img = new MockImage() as any;
      img.naturalWidth = 1000;
      img.naturalHeight = 800;
      img.complete = true;
      vi.advanceTimersByTime(10);

      const dataUrl = await resizeImage(img, { width: 500 });

      expect(dataUrl).toBeTruthy();
    });

    it('should fill background for JPEG format', async () => {
      const resizedPromise = resizeImage('https://example.com/image.jpg', {
        width: 400,
        format: 'jpeg',
        background: '#ff0000'
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await resizedPromise;

      expect(dataUrl).toBeTruthy();
    });

    it('should handle canvas context not available', async () => {
      // Mock getContext to return null
      MockCanvas.prototype.getContext = vi.fn(() => null);

      const resizedPromise = resizeImage('https://example.com/image.jpg', { width: 400 });

      vi.advanceTimersByTime(20);

      await expect(resizedPromise).rejects.toThrow('Canvas 2D context not available');
    });

    it('should cleanup object URL for File sources', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const resizedPromise = resizeImage(file, { width: 400 });

      vi.advanceTimersByTime(20);
      const dataUrl = await resizedPromise;

      expect(dataUrl).toBeTruthy();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('generateThumbnail', () => {
    it('should generate cropped thumbnail', async () => {
      const thumbnailPromise = generateThumbnail('https://example.com/image.jpg', {
        size: 150,
        crop: true
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await thumbnailPromise;

      expect(dataUrl).toBeTruthy();
    });

    it('should generate fitted thumbnail', async () => {
      const thumbnailPromise = generateThumbnail('https://example.com/image.jpg', {
        size: 150,
        crop: false
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await thumbnailPromise;

      expect(dataUrl).toBeTruthy();
    });

    it('should handle portrait image fitting', async () => {
      // Mock a portrait image
      global.Image = class extends MockImage {
        naturalWidth = 400;
        naturalHeight = 600;
      } as any;

      const thumbnailPromise = generateThumbnail('https://example.com/image.jpg', {
        size: 150,
        crop: false
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await thumbnailPromise;

      expect(dataUrl).toBeTruthy();
    });

    it('should use custom format and quality', async () => {
      const thumbnailPromise = generateThumbnail('https://example.com/image.jpg', {
        size: 150,
        format: 'webp',
        quality: 0.7
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await thumbnailPromise;

      expect(dataUrl).toBeTruthy();
    });

    it('should handle HTMLImageElement as source', async () => {
      const img = new MockImage() as any;
      img.complete = true;
      vi.advanceTimersByTime(10);
      const dataUrl = await generateThumbnail(img, { size: 150 });

      expect(dataUrl).toBeTruthy();
    });
  });

  describe('ProgressiveImageLoader', () => {
    let imgElement: HTMLImageElement;
    let loader: ProgressiveImageLoader;

    beforeEach(() => {
      imgElement = document.createElement('img');
      loader = new ProgressiveImageLoader(imgElement);
    });

    it('should initialize with idle state', () => {
      expect(loader.getState()).toBe('idle');
    });

    it('should load images progressively', async () => {
      const loadPromise = loader.load(
        'https://example.com/thumbnail.jpg',
        'https://example.com/full.jpg'
      );

      vi.advanceTimersByTime(20);
      await loadPromise;

      expect(loader.getState()).toBe('loaded');
    });

    it('should apply blur effect for thumbnail', async () => {
      const loadPromise = loader.load(
        'https://example.com/thumbnail.jpg',
        'https://example.com/full.jpg',
        { fadeTransition: true }
      );

      vi.advanceTimersByTime(10);
      expect(imgElement.style.filter).toBe('blur(2px)');

      vi.advanceTimersByTime(20);
      await loadPromise;

      expect(imgElement.style.filter).toBe('none');
    });

    it('should handle same thumbnail and full URLs', async () => {
      const loadPromise = loader.load(
        'https://example.com/image.jpg',
        'https://example.com/image.jpg'
      );

      vi.advanceTimersByTime(20);
      await loadPromise;

      expect(loader.getState()).toBe('loaded');
    });

    it('should handle load errors', async () => {
      // Mock image that fails to load
      global.Image = class extends MockImage {
        constructor() {
          super();
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 10);
        }
      } as any;

      const loadPromise = loader.load(
        'https://example.com/thumbnail.jpg',
        'https://example.com/broken.jpg'
      );

      vi.advanceTimersByTime(20);

      await expect(loadPromise).rejects.toThrow();
      expect(loader.getState()).toBe('error');
    });

    it('should notify state change observers', async () => {
      const observer = vi.fn();
      const unsubscribe = loader.onStateChange(observer);

      const loadPromise = loader.load(
        'https://example.com/thumbnail.jpg',
        'https://example.com/full.jpg'
      );

      expect(observer).toHaveBeenCalledWith('loading');

      vi.advanceTimersByTime(20);
      await loadPromise;

      expect(observer).toHaveBeenCalledWith('loaded');

      unsubscribe();
    });

    it('should cleanup observers', () => {
      const observer = vi.fn();
      const unsubscribe = loader.onStateChange(observer);

      unsubscribe();

      // State change should not call observer
      loader['setState']('loading');
      expect(observer).not.toHaveBeenCalled();
    });
  });

  describe('LazyImageLoader', () => {
    let loader: LazyImageLoader;
    let mockIntersectionObserver: any;

    beforeEach(() => {
      mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        callback
      }));
      global.IntersectionObserver = mockIntersectionObserver;

      loader = new LazyImageLoader();
    });

    afterEach(() => {
      loader.disconnect();
    });

    it('should observe images for lazy loading', () => {
      const img = document.createElement('img');

      loader.observe(img, 'https://example.com/image.jpg');

      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it('should load image when intersecting', async () => {
      const img = document.createElement('img');
      const src = 'https://example.com/image.jpg';

      loader.observe(img, src);

      // Get the intersection observer callback
      const intersectionCallback = mockIntersectionObserver.mock.calls[0][0];

      // Simulate intersection
      intersectionCallback([{
        target: img,
        isIntersecting: true
      }]);

      vi.advanceTimersByTime(20);

      expect(img.classList.contains('loading')).toBe(false);
      expect(img.classList.contains('loaded')).toBe(true);
      expect(img.src).toBe(src);
    });

    it('should handle image load errors', async () => {
      // Mock image that fails to load
      global.Image = class extends MockImage {
        constructor() {
          super();
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 10);
        }
      } as any;

      const img = document.createElement('img');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      loader.observe(img, 'https://example.com/broken.jpg');

      const intersectionCallback = mockIntersectionObserver.mock.calls[0][0];
      intersectionCallback([{
        target: img,
        isIntersecting: true
      }]);

      vi.advanceTimersByTime(20);

      expect(img.classList.contains('loading')).toBe(false);
      expect(img.classList.contains('error')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load lazy image:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should unobserve images', () => {
      const img = document.createElement('img');

      loader.observe(img, 'https://example.com/image.jpg');
      loader.unobserve(img);

      const observerInstance = mockIntersectionObserver.mock.results[0].value;
      expect(observerInstance.unobserve).toHaveBeenCalledWith(img);
    });

    it('should disconnect and cleanup', () => {
      loader.disconnect();

      const observerInstance = mockIntersectionObserver.mock.results[0].value;
      expect(observerInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe('ImageValidation', () => {
    it('should detect image format from data URL', () => {
      const jpegUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJ...';
      const pngUrl = 'data:image/png;base64,iVBORw0KGgoA...';
      const invalidUrl = 'data:text/plain;base64,aGVsbG8=';

      expect(ImageValidation.detectFormat(jpegUrl)).toBe('jpeg');
      expect(ImageValidation.detectFormat(pngUrl)).toBe('png');
      expect(ImageValidation.detectFormat(invalidUrl)).toBeNull();
    });

    it('should check if format is supported', () => {
      expect(ImageValidation.isFormatSupported('jpeg')).toBe(true);
      expect(ImageValidation.isFormatSupported('PNG')).toBe(true); // Case insensitive
      expect(ImageValidation.isFormatSupported('webp')).toBe(true);
      expect(ImageValidation.isFormatSupported('tiff')).toBe(false);
    });

    it('should validate image dimensions with constraints', () => {
      const result1 = ImageValidation.validateDimensions(800, 600, {
        minWidth: 400,
        maxWidth: 1000,
        minHeight: 300,
        maxHeight: 800
      });

      expect(result1.valid).toBe(true);
      expect(result1.errors).toEqual([]);

      const result2 = ImageValidation.validateDimensions(200, 100, {
        minWidth: 400,
        maxWidth: 1000
      });

      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Width 200 is below minimum 400');
    });

    it('should validate aspect ratio with tolerance', () => {
      const result1 = ImageValidation.validateDimensions(800, 600, {
        aspectRatio: 4/3,
        tolerance: 0.1
      });

      expect(result1.valid).toBe(true);

      const result2 = ImageValidation.validateDimensions(800, 400, {
        aspectRatio: 4/3,
        tolerance: 0.1
      });

      expect(result2.valid).toBe(false);
      expect(result2.errors[0]).toMatch(/Aspect ratio/);
    });

    it('should handle all dimension constraint violations', () => {
      const result = ImageValidation.validateDimensions(2000, 50, {
        minWidth: 100,
        maxWidth: 1000,
        minHeight: 100,
        maxHeight: 500
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        'Width 2000 exceeds maximum 1000',
        'Height 50 is below minimum 100'
      ]);
    });
  });

  describe('ImageMemoryManager', () => {
    let manager: ImageMemoryManager;

    beforeEach(() => {
      manager = new ImageMemoryManager(1000, 100); // 1000 bytes, 100ms
    });

    it('should add items to cache', () => {
      manager.addToCache('key1', 'url1', 500);

      const cached = manager.getFromCache('key1');
      expect(cached).toBe('url1');
    });

    it('should update last used time on cache hit', () => {
      manager.addToCache('key1', 'url1', 500);

      vi.advanceTimersByTime(50);
      const cached = manager.getFromCache('key1');

      expect(cached).toBe('url1');
    });

    it('should return null for non-existent cache keys', () => {
      const cached = manager.getFromCache('non-existent');
      expect(cached).toBeNull();
    });

    it('should remove items from cache', () => {
      manager.addToCache('key1', 'url1', 500);
      manager.removeFromCache('key1');

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('url1');

      const cached = manager.getFromCache('key1');
      expect(cached).toBeNull();
    });

    it('should cleanup expired items', () => {
      manager.addToCache('key1', 'url1', 500);

      // Advance time beyond max age
      vi.advanceTimersByTime(150);

      // Adding new item should trigger cleanup
      manager.addToCache('key2', 'url2', 300);

      const cached = manager.getFromCache('key1');
      expect(cached).toBeNull();
    });

    it('should cleanup oversized cache', () => {
      // Add items that exceed max cache size
      manager.addToCache('key1', 'url1', 600);
      manager.addToCache('key2', 'url2', 500); // This should trigger cleanup

      const stats = manager.getCacheStats();
      expect(stats.totalSize).toBeLessThanOrEqual(800); // 80% of 1000
    });

    it('should clear all cache', () => {
      manager.addToCache('key1', 'url1', 500);
      manager.addToCache('key2', 'url2', 300);

      manager.clearCache();

      const stats = manager.getCacheStats();
      expect(stats.itemCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it('should provide cache statistics', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      manager.addToCache('key1', 'url1', 500);

      vi.advanceTimersByTime(50);
      manager.addToCache('key2', 'url2', 300);

      const stats = manager.getCacheStats();
      expect(stats.itemCount).toBe(2);
      expect(stats.totalSize).toBe(800);
      expect(stats.oldestItem).toBe(now);
      expect(stats.newestItem).toBe(now + 50);
    });

    it('should handle empty cache statistics', () => {
      const stats = manager.getCacheStats();
      expect(stats.itemCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestItem).toBe(0);
      expect(stats.newestItem).toBe(0);
    });
  });

  describe('ColorAnalysis', () => {
    beforeEach(() => {
      // Mock getImageData to return specific color data
      MockCanvasRenderingContext2D.prototype.getImageData = vi.fn(() => ({
        data: new Uint8ClampedArray([
          // First pixel: red
          255, 0, 0, 255,
          // Second pixel: green
          0, 255, 0, 255,
          // Third pixel: blue
          0, 0, 255, 255,
          // Fourth pixel: red (most common)
          255, 0, 0, 255
        ])
      }));
    });

    it('should get dominant color from string URL', async () => {
      const colorPromise = ColorAnalysis.getDominantColor('https://example.com/image.jpg');

      vi.advanceTimersByTime(20);
      const color = await colorPromise;

      expect(typeof color).toBe('string');
      expect(color).toMatch(/rgb\(\d+,\d+,\d+\)/);
    });

    it('should get dominant color from HTMLImageElement', async () => {
      const img = new MockImage() as any;
      const color = await ColorAnalysis.getDominantColor(img);

      expect(typeof color).toBe('string');
      expect(color).toMatch(/rgb\(\d+,\d+,\d+\)/);
    });

    it('should cleanup object URL for File sources', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const colorPromise = ColorAnalysis.getDominantColor(file);

      vi.advanceTimersByTime(20);
      const color = await colorPromise;

      expect(color).toBeTruthy();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should calculate image brightness', async () => {
      const brightnessPromise = ColorAnalysis.getBrightness('https://example.com/image.jpg');

      vi.advanceTimersByTime(20);
      const brightness = await brightnessPromise;

      expect(typeof brightness).toBe('number');
      expect(brightness).toBeGreaterThanOrEqual(0);
      expect(brightness).toBeLessThanOrEqual(1);
    });

    it('should handle canvas context not available for color analysis', async () => {
      MockCanvas.prototype.getContext = vi.fn(() => null);

      const colorPromise = ColorAnalysis.getDominantColor('https://example.com/image.jpg');

      vi.advanceTimersByTime(20);

      await expect(colorPromise).rejects.toThrow('Canvas 2D context not available');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle image load without onload handler', () => {
      const img = new MockImage();
      img.onload = null;

      vi.advanceTimersByTime(20);

      // Should not throw error
      expect(img.complete).toBe(true);
    });

    it('should handle resizing with invalid dimensions', async () => {
      const resizedPromise = resizeImage('https://example.com/image.jpg', {
        width: 0,
        height: 0
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await resizedPromise;

      // Should still work with 0 dimensions
      expect(dataUrl).toBeTruthy();
    });

    it('should handle thumbnail generation with square image', async () => {
      // Mock square image
      global.Image = class extends MockImage {
        naturalWidth = 500;
        naturalHeight = 500;
      } as any;

      const thumbnailPromise = generateThumbnail('https://example.com/image.jpg', {
        size: 150,
        crop: true
      });

      vi.advanceTimersByTime(20);
      const dataUrl = await thumbnailPromise;

      expect(dataUrl).toBeTruthy();
    });

    it('should handle memory manager cleanup with non-existent URLs', () => {
      const manager = new ImageMemoryManager();

      expect(() => {
        manager.removeFromCache('non-existent');
      }).not.toThrow();
    });

    it('should handle progressive loader state changes without observers', () => {
      const imgElement = document.createElement('img');
      const loader = new ProgressiveImageLoader(imgElement);

      expect(() => {
        loader['setState']('loading');
      }).not.toThrow();
    });

    it('should handle color analysis with very small images', async () => {
      // Mock tiny 1x1 image
      global.Image = class extends MockImage {
        naturalWidth = 1;
        naturalHeight = 1;
      } as any;

      const colorPromise = ColorAnalysis.getDominantColor('https://example.com/tiny.jpg');

      vi.advanceTimersByTime(20);
      const color = await colorPromise;

      expect(color).toBeTruthy();
    });

    it('should handle validation with extreme aspect ratios', () => {
      const result = ImageValidation.validateDimensions(10000, 1, {
        aspectRatio: 1,
        tolerance: 0.01
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Aspect ratio/);
    });
  });
});