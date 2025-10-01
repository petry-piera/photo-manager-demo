/**
 * Image processing and manipulation utilities
 */

/**
 * Image resize options
 */
export interface ImageResizeOptions {
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  maintainAspectRatio?: boolean;
  background?: string;
}

/**
 * Thumbnail generation options
 */
export interface ThumbnailOptions {
  size: number;
  quality?: number;
  format?: 'jpeg' | 'webp';
  crop?: boolean;
  background?: string;
}

/**
 * Image load options
 */
export interface ImageLoadOptions {
  timeout?: number;
  crossOrigin?: string;
  referrerPolicy?: string;
}

/**
 * Progressive loading state
 */
export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Image dimensions
 */
export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

/**
 * Color analysis result
 */
export interface ColorAnalysis {
  dominantColor: string;
  averageColor: string;
  brightness: number;
  contrast: number;
  palette: string[];
}

/**
 * Load image from URL or File with promise
 */
export function loadImage(
  source: string | File,
  options: ImageLoadOptions = {}
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const { timeout = 10000, crossOrigin, referrerPolicy } = options;

    let timeoutId: number;

    const cleanup = () => {
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      resolve(img);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${typeof source === 'string' ? source : source.name}`));
    };

    if (timeout > 0) {
      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Image load timeout'));
      }, timeout);
    }

    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }

    if (referrerPolicy) {
      img.referrerPolicy = referrerPolicy;
    }

    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Get image dimensions without loading the full image
 */
export function getImageDimensions(source: string | File): Promise<ImageDimensions> {
  return loadImage(source).then(img => {
    const dimensions = {
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspectRatio: img.naturalWidth / img.naturalHeight
    };

    // Clean up object URL if created
    if (typeof source !== 'string') {
      URL.revokeObjectURL(img.src);
    }

    return dimensions;
  });
}

/**
 * Resize image to fit within constraints
 */
export function resizeImage(
  source: string | File | HTMLImageElement,
  options: ImageResizeOptions = {}
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        width,
        height,
        maxWidth,
        maxHeight,
        quality = 0.8,
        format = 'jpeg',
        maintainAspectRatio = true,
        background = '#ffffff'
      } = options;

      let img: HTMLImageElement;

      if (source instanceof HTMLImageElement) {
        img = source;
      } else {
        img = await loadImage(source);
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      let targetWidth = width || img.naturalWidth;
      let targetHeight = height || img.naturalHeight;

      // Apply max constraints
      if (maxWidth && targetWidth > maxWidth) {
        targetWidth = maxWidth;
        if (maintainAspectRatio) {
          targetHeight = (targetWidth / img.naturalWidth) * img.naturalHeight;
        }
      }

      if (maxHeight && targetHeight > maxHeight) {
        targetHeight = maxHeight;
        if (maintainAspectRatio) {
          targetWidth = (targetHeight / img.naturalHeight) * img.naturalWidth;
        }
      }

      // Maintain aspect ratio if only one dimension specified
      if (maintainAspectRatio) {
        if (width && !height) {
          targetHeight = (targetWidth / img.naturalWidth) * img.naturalHeight;
        } else if (height && !width) {
          targetWidth = (targetHeight / img.naturalHeight) * img.naturalWidth;
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Fill background for transparent images when converting to JPEG
      if (format === 'jpeg') {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // Draw resized image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Convert to data URL
      const mimeType = `image/${format}`;
      const dataUrl = canvas.toDataURL(mimeType, quality);

      // Clean up object URL if created
      if (typeof source !== 'string' && !(source instanceof HTMLImageElement)) {
        URL.revokeObjectURL(img.src);
      }

      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate thumbnail from image
 */
export function generateThumbnail(
  source: string | File | HTMLImageElement,
  options: ThumbnailOptions
): Promise<string> {
  const {
    size,
    quality = 0.8,
    format = 'jpeg',
    crop = true,
    background = '#ffffff'
  } = options;

  return new Promise(async (resolve, reject) => {
    try {
      let img: HTMLImageElement;

      if (source instanceof HTMLImageElement) {
        img = source;
      } else {
        img = await loadImage(source);
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      canvas.width = size;
      canvas.height = size;

      // Fill background
      if (format === 'jpeg') {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
      }

      if (crop) {
        // Crop to square from center
        const sourceSize = Math.min(img.naturalWidth, img.naturalHeight);
        const sourceX = (img.naturalWidth - sourceSize) / 2;
        const sourceY = (img.naturalHeight - sourceSize) / 2;

        ctx.drawImage(
          img,
          sourceX, sourceY, sourceSize, sourceSize,
          0, 0, size, size
        );
      } else {
        // Fit image within square
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        let drawWidth = size;
        let drawHeight = size;
        let drawX = 0;
        let drawY = 0;

        if (aspectRatio > 1) {
          // Landscape
          drawHeight = size / aspectRatio;
          drawY = (size - drawHeight) / 2;
        } else {
          // Portrait
          drawWidth = size * aspectRatio;
          drawX = (size - drawWidth) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      }

      const mimeType = `image/${format}`;
      const dataUrl = canvas.toDataURL(mimeType, quality);

      // Clean up object URL if created
      if (typeof source !== 'string' && !(source instanceof HTMLImageElement)) {
        URL.revokeObjectURL(img.src);
      }

      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Progressive image loader with placeholder
 */
export class ProgressiveImageLoader {
  private element: HTMLImageElement;
  private state: LoadingState = 'idle';
  private observers: Array<(state: LoadingState) => void> = [];

  constructor(element: HTMLImageElement) {
    this.element = element;
  }

  /**
   * Load image with progressive enhancement
   */
  async load(
    thumbnailSrc: string,
    fullSrc: string,
    options: {
      fadeTransition?: boolean;
      transitionDuration?: number;
    } = {}
  ): Promise<void> {
    const { fadeTransition = true, transitionDuration = 300 } = options;

    this.setState('loading');

    try {
      // Load thumbnail first
      if (thumbnailSrc !== fullSrc) {
        await this.loadSrc(thumbnailSrc);
        this.element.style.filter = 'blur(2px)';
      }

      // Load full resolution image
      await this.loadSrc(fullSrc);

      if (fadeTransition) {
        this.element.style.transition = `filter ${transitionDuration}ms ease-in-out`;
        this.element.style.filter = 'none';
      }

      this.setState('loaded');
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Load specific image source
   */
  private loadSrc(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.element.src = src;
        resolve();
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${src}`));
      };

      img.src = src;
    });
  }

  /**
   * Get current loading state
   */
  getState(): LoadingState {
    return this.state;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: LoadingState) => void): () => void {
    this.observers.push(callback);
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Set loading state and notify observers
   */
  private setState(state: LoadingState): void {
    this.state = state;
    this.observers.forEach(observer => observer(state));
  }
}

/**
 * Lazy image loading with intersection observer
 */
export class LazyImageLoader {
  private observer: IntersectionObserver;
  private images = new Map<HTMLImageElement, string>();

  constructor(options: IntersectionObserverInit = {}) {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = this.images.get(img);
          if (src) {
            this.loadImage(img, src);
            this.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    });
  }

  /**
   * Add image to lazy loading
   */
  observe(img: HTMLImageElement, src: string): void {
    this.images.set(img, src);
    this.observer.observe(img);
  }

  /**
   * Remove image from lazy loading
   */
  unobserve(img: HTMLImageElement): void {
    this.images.delete(img);
    this.observer.unobserve(img);
  }

  /**
   * Load image and handle states
   */
  private async loadImage(img: HTMLImageElement, src: string): Promise<void> {
    img.classList.add('loading');

    try {
      await loadImage(src);
      img.src = src;
      img.classList.remove('loading');
      img.classList.add('loaded');
    } catch (error) {
      img.classList.remove('loading');
      img.classList.add('error');
      console.error('Failed to load lazy image:', error);
    }
  }

  /**
   * Disconnect observer and cleanup
   */
  disconnect(): void {
    this.observer.disconnect();
    this.images.clear();
  }
}

/**
 * Image format detection and validation
 */
export const ImageValidation = {
  /**
   * Detect image format from data URL or blob
   */
  detectFormat(dataUrl: string): string | null {
    const match = dataUrl.match(/^data:image\/([^;]+)/);
    return match ? match[1] : null;
  },

  /**
   * Check if format is supported
   */
  isFormatSupported(format: string): boolean {
    const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'bmp', 'svg'];
    return supportedFormats.includes(format.toLowerCase());
  },

  /**
   * Validate image dimensions
   */
  validateDimensions(
    width: number,
    height: number,
    constraints: {
      minWidth?: number;
      maxWidth?: number;
      minHeight?: number;
      maxHeight?: number;
      aspectRatio?: number;
      tolerance?: number;
    } = {}
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const {
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      aspectRatio,
      tolerance = 0.1
    } = constraints;

    if (minWidth && width < minWidth) {
      errors.push(`Width ${width} is below minimum ${minWidth}`);
    }

    if (maxWidth && width > maxWidth) {
      errors.push(`Width ${width} exceeds maximum ${maxWidth}`);
    }

    if (minHeight && height < minHeight) {
      errors.push(`Height ${height} is below minimum ${minHeight}`);
    }

    if (maxHeight && height > maxHeight) {
      errors.push(`Height ${height} exceeds maximum ${maxHeight}`);
    }

    if (aspectRatio) {
      const currentRatio = width / height;
      const diff = Math.abs(currentRatio - aspectRatio);
      if (diff > tolerance) {
        errors.push(`Aspect ratio ${currentRatio.toFixed(2)} does not match required ${aspectRatio.toFixed(2)}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

/**
 * Memory management for large images
 */
export class ImageMemoryManager {
  private cache = new Map<string, { url: string; lastUsed: number; size: number }>();
  private maxCacheSize: number;
  private maxAge: number;

  constructor(maxCacheSize = 100 * 1024 * 1024, maxAge = 5 * 60 * 1000) { // 100MB, 5 minutes
    this.maxCacheSize = maxCacheSize;
    this.maxAge = maxAge;
  }

  /**
   * Add image to cache
   */
  addToCache(key: string, url: string, size: number): void {
    this.cache.set(key, {
      url,
      lastUsed: Date.now(),
      size
    });

    this.cleanup();
  }

  /**
   * Get image from cache
   */
  getFromCache(key: string): string | null {
    const item = this.cache.get(key);
    if (item) {
      item.lastUsed = Date.now();
      return item.url;
    }
    return null;
  }

  /**
   * Remove from cache
   */
  removeFromCache(key: string): void {
    const item = this.cache.get(key);
    if (item) {
      URL.revokeObjectURL(item.url);
      this.cache.delete(key);
    }
  }

  /**
   * Cleanup old or oversized cache entries
   */
  private cleanup(): void {
    const now = Date.now();
    let totalSize = 0;

    // Remove expired items
    for (const [key, item] of this.cache) {
      if (now - item.lastUsed > this.maxAge) {
        this.removeFromCache(key);
      } else {
        totalSize += item.size;
      }
    }

    // Remove oldest items if cache is too large
    if (totalSize > this.maxCacheSize) {
      const sortedItems = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

      for (const [key] of sortedItems) {
        this.removeFromCache(key);
        totalSize -= this.cache.get(key)?.size || 0;
        if (totalSize <= this.maxCacheSize * 0.8) break; // Clean to 80% capacity
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    for (const [key] of this.cache) {
      this.removeFromCache(key);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    itemCount: number;
    totalSize: number;
    oldestItem: number;
    newestItem: number;
  } {
    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;

    for (const [, item] of this.cache) {
      totalSize += item.size;
      oldestTime = Math.min(oldestTime, item.lastUsed);
      newestTime = Math.max(newestTime, item.lastUsed);
    }

    return {
      itemCount: this.cache.size,
      totalSize,
      oldestItem: oldestTime === Infinity ? 0 : oldestTime,
      newestItem: newestTime
    };
  }
}

/**
 * Basic color analysis utilities
 */
export const ColorAnalysis = {
  /**
   * Get dominant color from image
   */
  async getDominantColor(source: string | File | HTMLImageElement): Promise<string> {
    let img: HTMLImageElement;

    if (source instanceof HTMLImageElement) {
      img = source;
    } else {
      img = await loadImage(source);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }

    // Use small canvas for performance
    const size = 50;
    canvas.width = size;
    canvas.height = size;

    ctx.drawImage(img, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    const colorCounts = new Map<string, number>();

    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i + 1] / 32) * 32;
      const b = Math.round(data[i + 2] / 32) * 32;
      const color = `rgb(${r},${g},${b})`;

      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }

    // Find most common color
    let dominantColor = 'rgb(128,128,128)';
    let maxCount = 0;

    for (const [color, count] of colorCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    }

    // Clean up object URL if created
    if (typeof source !== 'string' && !(source instanceof HTMLImageElement)) {
      URL.revokeObjectURL(img.src);
    }

    return dominantColor;
  },

  /**
   * Calculate image brightness (0-1)
   */
  async getBrightness(source: string | File | HTMLImageElement): Promise<number> {
    let img: HTMLImageElement;

    if (source instanceof HTMLImageElement) {
      img = source;
    } else {
      img = await loadImage(source);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }

    const size = 50;
    canvas.width = size;
    canvas.height = size;

    ctx.drawImage(img, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    let totalBrightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate relative luminance
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      totalBrightness += brightness;
      pixelCount++;
    }

    // Clean up object URL if created
    if (typeof source !== 'string' && !(source instanceof HTMLImageElement)) {
      URL.revokeObjectURL(img.src);
    }

    return totalBrightness / pixelCount;
  }
};