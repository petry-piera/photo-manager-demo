/**
 * Accessibility utilities for PhotoManager
 * - Comprehensive ARIA labels and descriptions
 * - Keyboard navigation for all interactions
 * - Screen reader announcements for dynamic content
 * - High contrast and reduced motion support
 */

/**
 * ARIA live region types
 */
export type AriaLiveType = 'polite' | 'assertive' | 'off';

/**
 * Screen reader announcement options
 */
export interface AnnouncementOptions {
  priority?: AriaLiveType;
  delay?: number;
  clear?: boolean;
}

/**
 * Keyboard navigation configuration
 */
export interface KeyboardNavConfig {
  selector: string;
  loop?: boolean;
  skipDisabled?: boolean;
  onNavigate?: (element: HTMLElement, index: number) => void;
}

/**
 * Focus trap configuration
 */
export interface FocusTrapConfig {
  initialFocus?: HTMLElement | string;
  returnFocus?: HTMLElement;
  allowOutsideClick?: boolean;
}

/**
 * Screen reader announcer class
 */
export class ScreenReaderAnnouncer {
  private liveRegion: HTMLElement;
  private politeRegion: HTMLElement;
  private assertiveRegion: HTMLElement;

  constructor() {
    this.createLiveRegions();
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, options: AnnouncementOptions = {}): void {
    const { priority = 'polite', delay = 0, clear = true } = options;

    const region = priority === 'assertive' ? this.assertiveRegion : this.politeRegion;

    if (clear) {
      region.textContent = '';
    }

    setTimeout(() => {
      region.textContent = message;
    }, delay);

    // Clear after announcement to avoid repetition
    setTimeout(() => {
      region.textContent = '';
    }, delay + 1000);
  }

  /**
   * Announce loading state
   */
  announceLoading(message: string = 'Loading'): void {
    this.announce(`${message}...`, { priority: 'polite' });
  }

  /**
   * Announce completion
   */
  announceCompletion(message: string): void {
    this.announce(`${message} complete`, { priority: 'polite' });
  }

  /**
   * Announce error
   */
  announceError(message: string): void {
    this.announce(`Error: ${message}`, { priority: 'assertive' });
  }

  /**
   * Announce navigation change
   */
  announceNavigation(location: string, context?: string): void {
    const message = context ? `Navigated to ${location} in ${context}` : `Navigated to ${location}`;
    this.announce(message, { priority: 'polite' });
  }

  /**
   * Create ARIA live regions
   */
  private createLiveRegions(): void {
    // Polite announcements
    this.politeRegion = document.createElement('div');
    this.politeRegion.setAttribute('aria-live', 'polite');
    this.politeRegion.setAttribute('aria-atomic', 'true');
    this.politeRegion.setAttribute('class', 'sr-only');
    this.politeRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';

    // Assertive announcements
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    this.assertiveRegion.setAttribute('class', 'sr-only');
    this.assertiveRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';

    // Main live region (for backwards compatibility)
    this.liveRegion = this.politeRegion;

    document.body.appendChild(this.politeRegion);
    document.body.appendChild(this.assertiveRegion);
  }

  /**
   * Cleanup live regions
   */
  destroy(): void {
    this.politeRegion?.remove();
    this.assertiveRegion?.remove();
  }
}

/**
 * Keyboard navigation manager
 */
export class KeyboardNavigationManager {
  private currentIndex = -1;
  private elements: HTMLElement[] = [];
  private config: KeyboardNavConfig;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(config: KeyboardNavConfig) {
    this.config = config;
    this.updateElements();
    this.setupKeyboardHandlers();
  }

  /**
   * Update navigable elements
   */
  updateElements(): void {
    const allElements = Array.from(document.querySelectorAll(this.config.selector)) as HTMLElement[];
    this.elements = this.config.skipDisabled
      ? allElements.filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-disabled'))
      : allElements;
  }

  /**
   * Navigate to specific index
   */
  navigateTo(index: number): void {
    if (index < 0 || index >= this.elements.length) {
      if (this.config.loop) {
        index = index < 0 ? this.elements.length - 1 : 0;
      } else {
        return;
      }
    }

    this.currentIndex = index;
    const element = this.elements[index];

    if (element) {
      element.focus();
      this.config.onNavigate?.(element, index);
    }
  }

  /**
   * Navigate to next element
   */
  next(): void {
    this.navigateTo(this.currentIndex + 1);
  }

  /**
   * Navigate to previous element
   */
  previous(): void {
    this.navigateTo(this.currentIndex - 1);
  }

  /**
   * Navigate to first element
   */
  first(): void {
    this.navigateTo(0);
  }

  /**
   * Navigate to last element
   */
  last(): void {
    this.navigateTo(this.elements.length - 1);
  }

  /**
   * Set current element by element reference
   */
  setCurrent(element: HTMLElement): void {
    const index = this.elements.indexOf(element);
    if (index >= 0) {
      this.currentIndex = index;
    }
  }

  /**
   * Setup keyboard event handlers
   */
  private setupKeyboardHandlers(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.elements.length) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          this.next();
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          this.previous();
          break;
        case 'Home':
          e.preventDefault();
          this.first();
          break;
        case 'End':
          e.preventDefault();
          this.last();
          break;
      }
    };

    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Cleanup keyboard handlers
   */
  destroy(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
  }
}

/**
 * Focus trap manager
 */
export class FocusTrapManager {
  private container: HTMLElement;
  private config: FocusTrapConfig;
  private previousFocus?: HTMLElement;
  private focusableElements: HTMLElement[] = [];
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement, config: FocusTrapConfig = {}) {
    this.container = container;
    this.config = config;
    this.activate();
  }

  /**
   * Activate focus trap
   */
  activate(): void {
    // Store previous focus
    this.previousFocus = document.activeElement as HTMLElement;

    // Update focusable elements
    this.updateFocusableElements();

    // Set initial focus
    this.setInitialFocus();

    // Setup keyboard trap
    this.setupKeyboardTrap();

    // Prevent focus outside container
    this.preventOutsideFocus();
  }

  /**
   * Deactivate focus trap
   */
  deactivate(): void {
    // Remove keyboard handler
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }

    // Return focus
    if (this.config.returnFocus !== undefined) {
      this.config.returnFocus?.focus();
    } else if (this.previousFocus) {
      this.previousFocus.focus();
    }
  }

  /**
   * Update list of focusable elements
   */
  private updateFocusableElements(): void {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    this.focusableElements = Array.from(this.container.querySelectorAll(selector))
      .filter(el => {
        const element = el as HTMLElement;
        return element.offsetWidth > 0 && element.offsetHeight > 0 && !element.hasAttribute('aria-hidden');
      }) as HTMLElement[];
  }

  /**
   * Set initial focus
   */
  private setInitialFocus(): void {
    let initialElement: HTMLElement | null = null;

    if (this.config.initialFocus) {
      if (typeof this.config.initialFocus === 'string') {
        initialElement = this.container.querySelector(this.config.initialFocus);
      } else {
        initialElement = this.config.initialFocus;
      }
    }

    if (!initialElement && this.focusableElements.length > 0) {
      initialElement = this.focusableElements[0];
    }

    if (!initialElement) {
      initialElement = this.container;
      this.container.setAttribute('tabindex', '-1');
    }

    initialElement.focus();
  }

  /**
   * Setup keyboard trap for Tab navigation
   */
  private setupKeyboardTrap(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      this.updateFocusableElements();

      if (this.focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const currentIndex = this.focusableElements.indexOf(document.activeElement as HTMLElement);
      let nextIndex: number;

      if (e.shiftKey) {
        // Shift+Tab: previous element
        nextIndex = currentIndex <= 0 ? this.focusableElements.length - 1 : currentIndex - 1;
      } else {
        // Tab: next element
        nextIndex = currentIndex >= this.focusableElements.length - 1 ? 0 : currentIndex + 1;
      }

      e.preventDefault();
      this.focusableElements[nextIndex].focus();
    };

    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Prevent focus outside container
   */
  private preventOutsideFocus(): void {
    const observer = new MutationObserver(() => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && !this.container.contains(activeElement)) {
        if (this.focusableElements.length > 0) {
          this.focusableElements[0].focus();
        } else {
          this.container.focus();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['tabindex', 'disabled', 'aria-hidden']
    });

    // Store observer for cleanup
    (this as any).observer = observer;
  }

  /**
   * Cleanup focus trap
   */
  destroy(): void {
    this.deactivate();
    (this as any).observer?.disconnect();
  }
}

/**
 * ARIA utilities
 */
export class AriaUtils {
  /**
   * Generate unique ID for ARIA relationships
   */
  static generateId(prefix: string = 'aria'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up ARIA description relationship
   */
  static describedBy(element: HTMLElement, description: string): string {
    const descId = this.generateId('desc');
    const descElement = document.createElement('div');
    descElement.id = descId;
    descElement.textContent = description;
    descElement.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';

    document.body.appendChild(descElement);
    element.setAttribute('aria-describedby', descId);

    return descId;
  }

  /**
   * Set up ARIA label relationship
   */
  static labelledBy(element: HTMLElement, labelText: string): string {
    const labelId = this.generateId('label');
    const labelElement = document.createElement('div');
    labelElement.id = labelId;
    labelElement.textContent = labelText;
    labelElement.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';

    document.body.appendChild(labelElement);
    element.setAttribute('aria-labelledby', labelId);

    return labelId;
  }

  /**
   * Announce state change
   */
  static announceStateChange(element: HTMLElement, state: string, value?: string): void {
    element.setAttribute(`aria-${state}`, value || 'true');
    announcer.announce(`${state} ${value || 'activated'}`, { priority: 'polite' });
  }

  /**
   * Set up expandable/collapsible ARIA attributes
   */
  static setupExpandable(trigger: HTMLElement, target: HTMLElement, expanded: boolean = false): void {
    const targetId = target.id || this.generateId('expandable');
    target.id = targetId;

    trigger.setAttribute('aria-expanded', expanded.toString());
    trigger.setAttribute('aria-controls', targetId);
    target.setAttribute('aria-hidden', (!expanded).toString());
  }

  /**
   * Update expandable state
   */
  static updateExpandable(trigger: HTMLElement, target: HTMLElement, expanded: boolean): void {
    trigger.setAttribute('aria-expanded', expanded.toString());
    target.setAttribute('aria-hidden', (!expanded).toString());

    const action = expanded ? 'expanded' : 'collapsed';
    announcer.announce(`Section ${action}`, { priority: 'polite' });
  }

  /**
   * Set up modal ARIA attributes
   */
  static setupModal(modal: HTMLElement, titleElement?: HTMLElement): void {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    if (titleElement) {
      const titleId = titleElement.id || this.generateId('modal-title');
      titleElement.id = titleId;
      modal.setAttribute('aria-labelledby', titleId);
    }

    // Ensure modal is in tab order
    if (!modal.hasAttribute('tabindex')) {
      modal.setAttribute('tabindex', '-1');
    }
  }

  /**
   * Set up progress indicator ARIA attributes
   */
  static setupProgress(element: HTMLElement, value: number, max: number = 100, label?: string): void {
    element.setAttribute('role', 'progressbar');
    element.setAttribute('aria-valuenow', value.toString());
    element.setAttribute('aria-valuemin', '0');
    element.setAttribute('aria-valuemax', max.toString());

    if (label) {
      element.setAttribute('aria-label', label);
    }

    const percentage = Math.round((value / max) * 100);
    element.setAttribute('aria-valuetext', `${percentage}% complete`);
  }

  /**
   * Clean up ARIA relationships
   */
  static cleanup(element: HTMLElement): void {
    const describedBy = element.getAttribute('aria-describedby');
    const labelledBy = element.getAttribute('aria-labelledby');

    if (describedBy) {
      const descElement = document.getElementById(describedBy);
      descElement?.remove();
      element.removeAttribute('aria-describedby');
    }

    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      labelElement?.remove();
      element.removeAttribute('aria-labelledby');
    }
  }
}

/**
 * High contrast mode utilities
 */
export class HighContrastUtils {
  private mediaQuery: MediaQueryList;
  private callbacks: Set<(highContrast: boolean) => void> = new Set();

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-contrast: high)');
    this.setupListener();
    this.applyHighContrastStyles();
  }

  /**
   * Check if high contrast mode is enabled
   */
  isHighContrast(): boolean {
    return this.mediaQuery.matches;
  }

  /**
   * Subscribe to high contrast changes
   */
  onChange(callback: (highContrast: boolean) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Apply high contrast styles
   */
  private applyHighContrastStyles(): void {
    if (this.isHighContrast()) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }

  /**
   * Setup media query listener
   */
  private setupListener(): void {
    this.mediaQuery.addEventListener('change', () => {
      this.applyHighContrastStyles();
      this.callbacks.forEach(callback => callback(this.isHighContrast()));
    });
  }
}

/**
 * Reduced motion utilities
 */
export class ReducedMotionUtils {
  private mediaQuery: MediaQueryList;
  private callbacks: Set<(reducedMotion: boolean) => void> = new Set();

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.setupListener();
    this.applyReducedMotionStyles();
  }

  /**
   * Check if reduced motion is preferred
   */
  prefersReducedMotion(): boolean {
    return this.mediaQuery.matches;
  }

  /**
   * Subscribe to reduced motion changes
   */
  onChange(callback: (reducedMotion: boolean) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Apply reduced motion styles
   */
  private applyReducedMotionStyles(): void {
    if (this.prefersReducedMotion()) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }

  /**
   * Setup media query listener
   */
  private setupListener(): void {
    this.mediaQuery.addEventListener('change', () => {
      this.applyReducedMotionStyles();
      this.callbacks.forEach(callback => callback(this.prefersReducedMotion()));
    });
  }
}

/**
 * Global accessibility instances
 */
export const announcer = new ScreenReaderAnnouncer();
export const highContrastUtils = new HighContrastUtils();
export const reducedMotionUtils = new ReducedMotionUtils();

/**
 * Initialize accessibility features
 */
export function initializeAccessibility(): void {
  console.log('♿ Accessibility features initialized');

  // Add focus-visible polyfill behavior
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      document.body.classList.add('keyboard-navigation');
    }
  });

  document.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-navigation');
  });

  // Add skip link functionality
  const skipLink = document.querySelector('.skip-link') as HTMLElement;
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(skipLink.getAttribute('href') || '#main') as HTMLElement;
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Announce page changes for SPA navigation
  let currentPath = window.location.pathname;
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== currentPath) {
      currentPath = window.location.pathname;
      announcer.announceNavigation(document.title || currentPath);
    }
  });

  observer.observe(document.querySelector('title') || document.head, {
    childList: true,
    subtree: true
  });
}

/**
 * Cleanup accessibility utilities
 */
export function cleanupAccessibility(): void {
  announcer.destroy();
}