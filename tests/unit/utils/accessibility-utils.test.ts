/**
 * Unit tests for accessibility utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ScreenReaderAnnouncer,
  KeyboardNavigationManager,
  FocusTrapManager,
  AriaUtils,
  HighContrastUtils,
  ReducedMotionUtils,
  announcer
} from '@/utils/accessibility-utils';

describe('Accessibility Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ScreenReaderAnnouncer', () => {
    let screenReader: ScreenReaderAnnouncer;

    beforeEach(() => {
      screenReader = new ScreenReaderAnnouncer();
    });

    afterEach(() => {
      screenReader.destroy();
    });

    it('should create ARIA live regions', () => {
      const liveRegions = document.querySelectorAll('[aria-live]');
      expect(liveRegions).toHaveLength(2); // polite and assertive

      const politeRegion = document.querySelector('[aria-live="polite"]');
      const assertiveRegion = document.querySelector('[aria-live="assertive"]');

      expect(politeRegion).toBeDefined();
      expect(assertiveRegion).toBeDefined();
      expect(politeRegion?.getAttribute('aria-atomic')).toBe('true');
      expect(assertiveRegion?.getAttribute('aria-atomic')).toBe('true');
    });

    it('should announce messages with polite priority', () => {
      vi.useFakeTimers();

      screenReader.announce('Test message', { priority: 'polite' });

      const politeRegion = document.querySelector('[aria-live="polite"]');

      vi.advanceTimersByTime(10);
      expect(politeRegion?.textContent).toBe('Test message');

      vi.advanceTimersByTime(1000);
      expect(politeRegion?.textContent).toBe('');

      vi.useRealTimers();
    });

    it('should announce messages with assertive priority', () => {
      vi.useFakeTimers();

      screenReader.announce('Urgent message', { priority: 'assertive' });

      const assertiveRegion = document.querySelector('[aria-live="assertive"]');

      vi.advanceTimersByTime(10);
      expect(assertiveRegion?.textContent).toBe('Urgent message');

      vi.useRealTimers();
    });

    it('should announce loading states', () => {
      vi.useFakeTimers();

      screenReader.announceLoading('Processing photos');

      const politeRegion = document.querySelector('[aria-live="polite"]');

      vi.advanceTimersByTime(10);
      expect(politeRegion?.textContent).toBe('Processing photos...');

      vi.useRealTimers();
    });

    it('should announce completion', () => {
      vi.useFakeTimers();

      screenReader.announceCompletion('Photo upload');

      const politeRegion = document.querySelector('[aria-live="polite"]');

      vi.advanceTimersByTime(10);
      expect(politeRegion?.textContent).toBe('Photo upload complete');

      vi.useRealTimers();
    });

    it('should announce errors with assertive priority', () => {
      vi.useFakeTimers();

      screenReader.announceError('Upload failed');

      const assertiveRegion = document.querySelector('[aria-live="assertive"]');

      vi.advanceTimersByTime(10);
      expect(assertiveRegion?.textContent).toBe('Error: Upload failed');

      vi.useRealTimers();
    });

    it('should announce navigation changes', () => {
      vi.useFakeTimers();

      screenReader.announceNavigation('Album View', 'Photo Gallery');

      const politeRegion = document.querySelector('[aria-live="polite"]');

      vi.advanceTimersByTime(10);
      expect(politeRegion?.textContent).toBe('Navigated to Album View in Photo Gallery');

      vi.useRealTimers();
    });

    it('should handle delayed announcements', () => {
      vi.useFakeTimers();

      screenReader.announce('Delayed message', { delay: 500 });

      const politeRegion = document.querySelector('[aria-live="polite"]');

      vi.advanceTimersByTime(400);
      expect(politeRegion?.textContent).toBe('');

      vi.advanceTimersByTime(200);
      expect(politeRegion?.textContent).toBe('Delayed message');

      vi.useRealTimers();
    });

    it('should clear previous messages when clear option is true', () => {
      vi.useFakeTimers();

      const politeRegion = document.querySelector('[aria-live="polite"]');
      politeRegion!.textContent = 'Previous message';

      screenReader.announce('New message', { clear: true });

      expect(politeRegion?.textContent).toBe('');

      vi.advanceTimersByTime(10);
      expect(politeRegion?.textContent).toBe('New message');

      vi.useRealTimers();
    });
  });

  describe('KeyboardNavigationManager', () => {
    let navManager: KeyboardNavigationManager;
    let buttons: HTMLButtonElement[];

    beforeEach(() => {
      // Create test buttons
      buttons = Array.from({ length: 5 }, (_, i) => {
        const button = document.createElement('button');
        button.textContent = `Button ${i + 1}`;
        button.className = 'nav-button';
        document.body.appendChild(button);
        return button;
      });

      navManager = new KeyboardNavigationManager({
        selector: '.nav-button',
        loop: true,
        skipDisabled: true
      });
    });

    afterEach(() => {
      navManager.destroy();
      buttons.forEach(button => button.remove());
    });

    it('should navigate to next element', () => {
      const focusSpy = vi.spyOn(buttons[1], 'focus');

      navManager.navigateTo(0); // Start at first button
      navManager.next();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should navigate to previous element', () => {
      const focusSpy = vi.spyOn(buttons[0], 'focus');

      navManager.navigateTo(1); // Start at second button
      navManager.previous();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should loop to beginning when at end', () => {
      const focusSpy = vi.spyOn(buttons[0], 'focus');

      navManager.navigateTo(4); // Start at last button
      navManager.next();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should loop to end when at beginning', () => {
      const focusSpy = vi.spyOn(buttons[4], 'focus');

      navManager.navigateTo(0); // Start at first button
      navManager.previous();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should navigate to first element', () => {
      const focusSpy = vi.spyOn(buttons[0], 'focus');

      navManager.first();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should navigate to last element', () => {
      const focusSpy = vi.spyOn(buttons[4], 'focus');

      navManager.last();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should skip disabled elements', () => {
      buttons[1].disabled = true;
      navManager.updateElements();

      const focusSpy = vi.spyOn(buttons[2], 'focus');

      navManager.navigateTo(0);
      navManager.next(); // Should skip disabled button[1] and go to button[2]

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should call onNavigate callback', () => {
      const onNavigate = vi.fn();

      const customNavManager = new KeyboardNavigationManager({
        selector: '.nav-button',
        onNavigate
      });

      customNavManager.navigateTo(2);

      expect(onNavigate).toHaveBeenCalledWith(buttons[2], 2);

      customNavManager.destroy();
    });

    it('should handle keyboard events', () => {
      const focusSpy = vi.spyOn(buttons[1], 'focus');

      navManager.navigateTo(0);

      // Simulate arrow right key
      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      document.dispatchEvent(keyEvent);

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should handle Home and End keys', () => {
      const firstFocusSpy = vi.spyOn(buttons[0], 'focus');
      const lastFocusSpy = vi.spyOn(buttons[4], 'focus');

      // Test Home key
      const homeEvent = new KeyboardEvent('keydown', { key: 'Home' });
      document.dispatchEvent(homeEvent);
      expect(firstFocusSpy).toHaveBeenCalled();

      // Test End key
      const endEvent = new KeyboardEvent('keydown', { key: 'End' });
      document.dispatchEvent(endEvent);
      expect(lastFocusSpy).toHaveBeenCalled();
    });
  });

  describe('FocusTrapManager', () => {
    let container: HTMLElement;
    let focusTrap: FocusTrapManager;
    let inputs: HTMLInputElement[];

    beforeEach(() => {
      container = document.createElement('div');
      container.innerHTML = `
        <input type="text" id="input1" />
        <button id="button1">Button 1</button>
        <input type="text" id="input2" />
        <button id="button2">Button 2</button>
      `;
      document.body.appendChild(container);

      inputs = Array.from(container.querySelectorAll('input, button')) as HTMLInputElement[];
    });

    afterEach(() => {
      if (focusTrap) {
        focusTrap.destroy();
      }
      container.remove();
    });

    it('should trap focus within container', () => {
      focusTrap = new FocusTrapManager(container);

      const firstInput = inputs[0];
      const lastInput = inputs[inputs.length - 1];

      // Focus should start on first element
      expect(document.activeElement).toBe(firstInput);

      // Simulate Tab from last element
      lastInput.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      document.dispatchEvent(tabEvent);

      // Should wrap to first element
      expect(document.activeElement).toBe(firstInput);
    });

    it('should handle Shift+Tab to go backwards', () => {
      focusTrap = new FocusTrapManager(container);

      const firstInput = inputs[0];
      const lastInput = inputs[inputs.length - 1];

      firstInput.focus();

      // Simulate Shift+Tab from first element
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true
      });
      document.dispatchEvent(shiftTabEvent);

      // Should wrap to last element
      expect(document.activeElement).toBe(lastInput);
    });

    it('should set initial focus on specified element', () => {
      const targetInput = inputs[2];

      focusTrap = new FocusTrapManager(container, {
        initialFocus: targetInput
      });

      expect(document.activeElement).toBe(targetInput);
    });

    it('should return focus on deactivation', () => {
      const externalButton = document.createElement('button');
      document.body.appendChild(externalButton);
      externalButton.focus();

      focusTrap = new FocusTrapManager(container, {
        returnFocus: externalButton
      });

      focusTrap.deactivate();

      expect(document.activeElement).toBe(externalButton);

      externalButton.remove();
    });

    it('should handle containers with no focusable elements', () => {
      const emptyContainer = document.createElement('div');
      emptyContainer.innerHTML = '<span>No focusable elements</span>';
      document.body.appendChild(emptyContainer);

      expect(() => {
        focusTrap = new FocusTrapManager(emptyContainer);
      }).not.toThrow();

      emptyContainer.remove();
    });
  });

  describe('AriaUtils', () => {
    it('should generate unique IDs', () => {
      const id1 = AriaUtils.generateId('test');
      const id2 = AriaUtils.generateId('test');

      expect(id1).toMatch(/^test-/);
      expect(id2).toMatch(/^test-/);
      expect(id1).not.toBe(id2);
    });

    it('should set up described-by relationship', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      const descId = AriaUtils.describedBy(element, 'This is a description');

      expect(element.getAttribute('aria-describedby')).toBe(descId);

      const descElement = document.getElementById(descId);
      expect(descElement).toBeDefined();
      expect(descElement?.textContent).toBe('This is a description');

      element.remove();
      descElement?.remove();
    });

    it('should set up labelled-by relationship', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      const labelId = AriaUtils.labelledBy(element, 'Label text');

      expect(element.getAttribute('aria-labelledby')).toBe(labelId);

      const labelElement = document.getElementById(labelId);
      expect(labelElement).toBeDefined();
      expect(labelElement?.textContent).toBe('Label text');

      element.remove();
      labelElement?.remove();
    });

    it('should setup expandable ARIA attributes', () => {
      const trigger = document.createElement('button');
      const target = document.createElement('div');
      document.body.appendChild(trigger);
      document.body.appendChild(target);

      AriaUtils.setupExpandable(trigger, target, false);

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBe(target.id);
      expect(target.getAttribute('aria-hidden')).toBe('true');

      trigger.remove();
      target.remove();
    });

    it('should update expandable state', () => {
      const trigger = document.createElement('button');
      const target = document.createElement('div');
      document.body.appendChild(trigger);
      document.body.appendChild(target);

      AriaUtils.setupExpandable(trigger, target, false);
      AriaUtils.updateExpandable(trigger, target, true);

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(target.getAttribute('aria-hidden')).toBe('false');

      trigger.remove();
      target.remove();
    });

    it('should setup modal ARIA attributes', () => {
      const modal = document.createElement('div');
      const title = document.createElement('h1');
      title.textContent = 'Modal Title';

      document.body.appendChild(modal);
      document.body.appendChild(title);

      AriaUtils.setupModal(modal, title);

      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
      expect(modal.getAttribute('aria-labelledby')).toBe(title.id);
      expect(modal.getAttribute('tabindex')).toBe('-1');

      modal.remove();
      title.remove();
    });

    it('should setup progress indicator', () => {
      const progress = document.createElement('div');
      document.body.appendChild(progress);

      AriaUtils.setupProgress(progress, 50, 100, 'Upload progress');

      expect(progress.getAttribute('role')).toBe('progressbar');
      expect(progress.getAttribute('aria-valuenow')).toBe('50');
      expect(progress.getAttribute('aria-valuemin')).toBe('0');
      expect(progress.getAttribute('aria-valuemax')).toBe('100');
      expect(progress.getAttribute('aria-label')).toBe('Upload progress');
      expect(progress.getAttribute('aria-valuetext')).toBe('50% complete');

      progress.remove();
    });

    it('should cleanup ARIA relationships', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      const descId = AriaUtils.describedBy(element, 'Description');
      const labelId = AriaUtils.labelledBy(element, 'Label');

      expect(document.getElementById(descId)).toBeDefined();
      expect(document.getElementById(labelId)).toBeDefined();

      AriaUtils.cleanup(element);

      expect(element.getAttribute('aria-describedby')).toBeNull();
      expect(element.getAttribute('aria-labelledby')).toBeNull();
      expect(document.getElementById(descId)).toBeNull();
      expect(document.getElementById(labelId)).toBeNull();

      element.remove();
    });
  });

  describe('HighContrastUtils', () => {
    let highContrastUtils: HighContrastUtils;
    let mockMediaQuery: any;

    beforeEach(() => {
      mockMediaQuery = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      vi.spyOn(window, 'matchMedia').mockReturnValue(mockMediaQuery);
      highContrastUtils = new HighContrastUtils();
    });

    it('should detect high contrast mode', () => {
      mockMediaQuery.matches = true;
      expect(highContrastUtils.isHighContrast()).toBe(true);

      mockMediaQuery.matches = false;
      expect(highContrastUtils.isHighContrast()).toBe(false);
    });

    it('should apply high contrast styles', () => {
      mockMediaQuery.matches = true;

      // Trigger the change by creating a new instance
      const newUtils = new HighContrastUtils();

      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    });

    it('should notify listeners of changes', () => {
      const listener = vi.fn();
      const unsubscribe = highContrastUtils.onChange(listener);

      // Simulate media query change
      const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1];
      mockMediaQuery.matches = true;
      changeHandler();

      expect(listener).toHaveBeenCalledWith(true);

      unsubscribe();
      mockMediaQuery.matches = false;
      changeHandler();

      expect(listener).toHaveBeenCalledTimes(1); // Should not be called after unsubscribe
    });
  });

  describe('ReducedMotionUtils', () => {
    let reducedMotionUtils: ReducedMotionUtils;
    let mockMediaQuery: any;

    beforeEach(() => {
      mockMediaQuery = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      vi.spyOn(window, 'matchMedia').mockReturnValue(mockMediaQuery);
      reducedMotionUtils = new ReducedMotionUtils();
    });

    it('should detect reduced motion preference', () => {
      mockMediaQuery.matches = true;
      expect(reducedMotionUtils.prefersReducedMotion()).toBe(true);

      mockMediaQuery.matches = false;
      expect(reducedMotionUtils.prefersReducedMotion()).toBe(false);
    });

    it('should apply reduced motion styles', () => {
      mockMediaQuery.matches = true;

      // Trigger the change by creating a new instance
      const newUtils = new ReducedMotionUtils();

      expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    });

    it('should notify listeners of changes', () => {
      const listener = vi.fn();
      const unsubscribe = reducedMotionUtils.onChange(listener);

      // Simulate media query change
      const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1];
      mockMediaQuery.matches = true;
      changeHandler();

      expect(listener).toHaveBeenCalledWith(true);

      unsubscribe();
      mockMediaQuery.matches = false;
      changeHandler();

      expect(listener).toHaveBeenCalledTimes(1); // Should not be called after unsubscribe
    });
  });

  describe('Global announcer instance', () => {
    it('should be available as singleton', () => {
      expect(announcer).toBeInstanceOf(ScreenReaderAnnouncer);
    });

    it('should work with the global instance', () => {
      vi.useFakeTimers();

      announcer.announce('Global test');

      const politeRegion = document.querySelector('[aria-live="polite"]');

      vi.advanceTimersByTime(10);
      expect(politeRegion?.textContent).toBe('Global test');

      vi.useRealTimers();
    });
  });

  describe('Integration and edge cases', () => {
    it('should handle multiple focus traps', () => {
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');

      container1.innerHTML = '<button>Button 1</button>';
      container2.innerHTML = '<button>Button 2</button>';

      document.body.appendChild(container1);
      document.body.appendChild(container2);

      const trap1 = new FocusTrapManager(container1);
      const trap2 = new FocusTrapManager(container2);

      // Second trap should take precedence
      expect(document.activeElement).toBe(container2.querySelector('button'));

      trap1.destroy();
      trap2.destroy();
      container1.remove();
      container2.remove();
    });

    it('should handle keyboard navigation with dynamically changing elements', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const navManager = new KeyboardNavigationManager({
        selector: '.dynamic-btn'
      });

      // Add button dynamically
      const button = document.createElement('button');
      button.className = 'dynamic-btn';
      container.appendChild(button);

      navManager.updateElements();

      const focusSpy = vi.spyOn(button, 'focus');
      navManager.navigateTo(0);

      expect(focusSpy).toHaveBeenCalled();

      navManager.destroy();
      container.remove();
    });

    it('should handle ARIA utils with elements not in DOM', () => {
      const element = document.createElement('div');
      // Don't append to DOM

      const descId = AriaUtils.describedBy(element, 'Description');
      expect(element.getAttribute('aria-describedby')).toBe(descId);

      // Should not throw when cleaning up
      expect(() => AriaUtils.cleanup(element)).not.toThrow();
    });
  });
});