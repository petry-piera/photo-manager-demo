/**
 * DOM manipulation and utility functions
 */

/**
 * Query selector options
 */
export interface QueryOptions {
  multiple?: boolean;
  within?: Element | Document;
}

/**
 * Event delegation options
 */
export interface EventDelegationOptions {
  capture?: boolean;
  passive?: boolean;
  once?: boolean;
}

/**
 * Focus management options
 */
export interface FocusOptions {
  preventScroll?: boolean;
  restoreOnEscape?: boolean;
  trapFocus?: boolean;
}

/**
 * Scroll options
 */
export interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

/**
 * Enhanced query selector with type safety
 */
export function query<T extends Element = Element>(
  selector: string,
  options: QueryOptions & { multiple: true }
): NodeListOf<T>;
export function query<T extends Element = Element>(
  selector: string,
  options?: QueryOptions & { multiple?: false }
): T | null;
export function query<T extends Element = Element>(
  selector: string,
  options: QueryOptions = {}
): T | null | NodeListOf<T> {
  const { multiple = false, within = document } = options;

  if (multiple) {
    return within.querySelectorAll<T>(selector);
  }

  return within.querySelector<T>(selector);
}

/**
 * Enhanced query with required element (throws if not found)
 */
export function queryRequired<T extends Element = Element>(
  selector: string,
  options: QueryOptions = {}
): T {
  const element = query<T>(selector, options);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element as T;
}

/**
 * Create element with attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes?: Partial<HTMLElementTagNameMap[K]> & { [key: string]: any },
  children?: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value as string;
      } else if (key === 'textContent') {
        element.textContent = value as string;
      } else if (key === 'innerHTML') {
        element.innerHTML = value as string;
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, String(value));
      } else if (key in element) {
        (element as any)[key] = value;
      } else {
        element.setAttribute(key, String(value));
      }
    });
  }

  if (children) {
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });
  }

  return element;
}

/**
 * Add CSS classes safely
 */
export function addClass(element: Element | null, ...classes: string[]): void {
  if (!element) return;
  element.classList.add(...classes.filter(Boolean));
}

/**
 * Remove CSS classes safely
 */
export function removeClass(element: Element | null, ...classes: string[]): void {
  if (!element) return;
  element.classList.remove(...classes.filter(Boolean));
}

/**
 * Toggle CSS class with optional force parameter
 */
export function toggleClass(
  element: Element | null,
  className: string,
  force?: boolean
): boolean {
  if (!element) return false;
  return element.classList.toggle(className, force);
}

/**
 * Check if element has CSS class
 */
export function hasClass(element: Element | null, className: string): boolean {
  if (!element) return false;
  return element.classList.contains(className);
}

/**
 * Set element attributes safely
 */
export function setAttributes(
  element: Element,
  attributes: Record<string, string | number | boolean | null>
): void {
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === null || value === false) {
      element.removeAttribute(key);
    } else {
      element.setAttribute(key, String(value));
    }
  });
}

/**
 * Get element attributes as object
 */
export function getAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attributes[attr.name] = attr.value;
  }
  return attributes;
}

/**
 * Event delegation helper
 */
export function delegate<T extends Event = Event>(
  container: Element | Document,
  eventType: string,
  selector: string,
  handler: (event: T, target: Element) => void,
  options: EventDelegationOptions = {}
): () => void {
  const listener = (event: Event) => {
    const target = (event.target as Element)?.closest(selector);
    if (target && container.contains(target)) {
      handler(event as T, target);
    }
  };

  container.addEventListener(eventType, listener, options);

  // Return cleanup function
  return () => {
    container.removeEventListener(eventType, listener, options);
  };
}

/**
 * Wait for DOM content to be loaded
 */
export function ready(callback: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    // DOM is already ready
    callback();
  }
}

/**
 * Debounced event listener
 */
export function debouncedListener<T extends Event = Event>(
  element: Element | Document | Window,
  eventType: string,
  handler: (event: T) => void,
  delay: number = 250,
  options: AddEventListenerOptions = {}
): () => void {
  let timeoutId: number;

  const debouncedHandler = (event: Event) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => handler(event as T), delay);
  };

  element.addEventListener(eventType, debouncedHandler, options);

  return () => {
    clearTimeout(timeoutId);
    element.removeEventListener(eventType, debouncedHandler, options);
  };
}

/**
 * Throttled event listener
 */
export function throttledListener<T extends Event = Event>(
  element: Element | Document | Window,
  eventType: string,
  handler: (event: T) => void,
  delay: number = 100,
  options: AddEventListenerOptions = {}
): () => void {
  let lastCall = 0;

  const throttledHandler = (event: Event) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      handler(event as T);
    }
  };

  element.addEventListener(eventType, throttledHandler, options);

  return () => {
    element.removeEventListener(eventType, throttledHandler, options);
  };
}

/**
 * Focus management utilities
 */
export const FocusManager = {
  /**
   * Set focus on element with options
   */
  focus(element: HTMLElement, options: FocusOptions = {}): void {
    const { preventScroll = false } = options;
    element.focus({ preventScroll });
  },

  /**
   * Get all focusable elements within container
   */
  getFocusableElements(container: Element = document.body): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
      .filter(element => {
        // Check if element is visible
        const style = getComputedStyle(element);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               element.offsetWidth > 0 &&
               element.offsetHeight > 0;
      });
  },

  /**
   * Trap focus within container
   */
  trapFocus(container: Element): () => void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // Focus first element initially
    firstElement.focus();

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  },

  /**
   * Restore focus to previously focused element
   */
  restoreFocus(previousElement: HTMLElement | null): void {
    if (previousElement && document.contains(previousElement)) {
      previousElement.focus();
    }
  }
};

/**
 * Scroll utilities
 */
export const ScrollManager = {
  /**
   * Scroll element into view smoothly
   */
  scrollIntoView(element: Element, options: ScrollOptions = {}): void {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
      ...options
    });
  },

  /**
   * Get scroll position
   */
  getScrollPosition(element: Element = document.documentElement): { x: number; y: number } {
    return {
      x: element.scrollLeft,
      y: element.scrollTop
    };
  },

  /**
   * Set scroll position
   */
  setScrollPosition(
    element: Element = document.documentElement,
    x?: number,
    y?: number,
    smooth = false
  ): void {
    if (smooth) {
      element.scrollTo({
        left: x,
        top: y,
        behavior: 'smooth'
      });
    } else {
      if (x !== undefined) element.scrollLeft = x;
      if (y !== undefined) element.scrollTop = y;
    }
  },

  /**
   * Check if element is in viewport
   */
  isInViewport(element: Element, threshold = 0): boolean {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.top >= -threshold &&
      rect.left >= -threshold &&
      rect.bottom <= windowHeight + threshold &&
      rect.right <= windowWidth + threshold
    );
  },

  /**
   * Get element's distance from viewport top
   */
  getDistanceFromTop(element: Element): number {
    const rect = element.getBoundingClientRect();
    return rect.top + window.pageYOffset;
  }
};

/**
 * Intersection Observer wrapper for lazy loading
 */
export class LazyObserver {
  private observer: IntersectionObserver;
  private callbacks = new Map<Element, () => void>();

  constructor(options: IntersectionObserverInit = {}) {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const callback = this.callbacks.get(entry.target);
          if (callback) {
            callback();
            this.unobserve(entry.target);
          }
        }
      });
    }, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    });
  }

  observe(element: Element, callback: () => void): void {
    this.callbacks.set(element, callback);
    this.observer.observe(element);
  }

  unobserve(element: Element): void {
    this.callbacks.delete(element);
    this.observer.unobserve(element);
  }

  disconnect(): void {
    this.observer.disconnect();
    this.callbacks.clear();
  }
}

/**
 * Responsive utilities
 */
export const ResponsiveUtils = {
  /**
   * Get current breakpoint
   */
  getCurrentBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  },

  /**
   * Check if device is mobile
   */
  isMobile(): boolean {
    return this.getCurrentBreakpoint() === 'mobile';
  },

  /**
   * Check if device supports touch
   */
  isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  /**
   * Get viewport dimensions
   */
  getViewportSize(): { width: number; height: number } {
    return {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight
    };
  },

  /**
   * Listen for breakpoint changes
   */
  onBreakpointChange(callback: (breakpoint: 'mobile' | 'tablet' | 'desktop') => void): () => void {
    let currentBreakpoint = this.getCurrentBreakpoint();

    const handler = () => {
      const newBreakpoint = this.getCurrentBreakpoint();
      if (newBreakpoint !== currentBreakpoint) {
        currentBreakpoint = newBreakpoint;
        callback(newBreakpoint);
      }
    };

    return debouncedListener(window, 'resize', handler, 100);
  }
};

/**
 * Animation utilities
 */
export const AnimationUtils = {
  /**
   * Fade in element
   */
  fadeIn(element: HTMLElement, duration = 300): Promise<void> {
    return new Promise(resolve => {
      element.style.opacity = '0';
      element.style.transition = `opacity ${duration}ms ease-in-out`;

      // Force reflow
      element.offsetHeight;

      element.style.opacity = '1';

      setTimeout(resolve, duration);
    });
  },

  /**
   * Fade out element
   */
  fadeOut(element: HTMLElement, duration = 300): Promise<void> {
    return new Promise(resolve => {
      element.style.transition = `opacity ${duration}ms ease-in-out`;
      element.style.opacity = '0';

      setTimeout(() => {
        element.style.display = 'none';
        resolve();
      }, duration);
    });
  },

  /**
   * Slide down element
   */
  slideDown(element: HTMLElement, duration = 300): Promise<void> {
    return new Promise(resolve => {
      element.style.height = '0';
      element.style.overflow = 'hidden';
      element.style.transition = `height ${duration}ms ease-in-out`;

      const targetHeight = element.scrollHeight;

      // Force reflow
      element.offsetHeight;

      element.style.height = `${targetHeight}px`;

      setTimeout(() => {
        element.style.height = 'auto';
        element.style.overflow = '';
        resolve();
      }, duration);
    });
  },

  /**
   * Slide up element
   */
  slideUp(element: HTMLElement, duration = 300): Promise<void> {
    return new Promise(resolve => {
      element.style.height = `${element.offsetHeight}px`;
      element.style.overflow = 'hidden';
      element.style.transition = `height ${duration}ms ease-in-out`;

      // Force reflow
      element.offsetHeight;

      element.style.height = '0';

      setTimeout(() => {
        element.style.display = 'none';
        resolve();
      }, duration);
    });
  }
};

/**
 * Keyboard utilities
 */
export const KeyboardUtils = {
  /**
   * Check if key matches any of the provided keys
   */
  isKey(event: KeyboardEvent, ...keys: string[]): boolean {
    return keys.includes(event.key);
  },

  /**
   * Check for modifier keys
   */
  hasModifier(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
  },

  /**
   * Handle escape key to close modals/dialogs
   */
  onEscape(callback: () => void): () => void {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback();
      }
    };

    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  },

  /**
   * Handle arrow key navigation
   */
  onArrowKeys(callbacks: {
    up?: () => void;
    down?: () => void;
    left?: () => void;
    right?: () => void;
  }): () => void {
    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          callbacks.up?.();
          break;
        case 'ArrowDown':
          event.preventDefault();
          callbacks.down?.();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          callbacks.left?.();
          break;
        case 'ArrowRight':
          event.preventDefault();
          callbacks.right?.();
          break;
      }
    };

    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }
};