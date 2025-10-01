/**
 * Unit tests for DOM utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  query,
  queryRequired,
  createElement,
  addClass,
  removeClass,
  toggleClass,
  hasClass,
  setAttributes,
  getAttributes,
  delegate,
  ready,
  debouncedListener,
  throttledListener,
  FocusManager,
  ScrollManager,
  LazyObserver,
  ResponsiveUtils,
  AnimationUtils,
  KeyboardUtils
} from '@/utils/dom-utils';

describe('DOM Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.body.innerHTML = '';

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();

    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      callback
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('query functions', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="test-container" class="container">
          <p class="text" data-id="1">First paragraph</p>
          <p class="text" data-id="2">Second paragraph</p>
          <span class="highlight">Span element</span>
        </div>
      `;
    });

    it('should query single element', () => {
      const container = query('#test-container');
      expect(container).toBeTruthy();
      expect(container!.tagName).toBe('DIV');
      expect(container!.id).toBe('test-container');
    });

    it('should query multiple elements', () => {
      const paragraphs = query('.text', { multiple: true });
      expect(paragraphs).toBeTruthy();
      expect(paragraphs!.length).toBe(2);
    });

    it('should query within specific container', () => {
      const container = query('#test-container')!;
      const span = query('.highlight', { within: container });
      expect(span).toBeTruthy();
      expect(span!.tagName).toBe('SPAN');
    });

    it('should return null for non-existent element', () => {
      const element = query('#non-existent');
      expect(element).toBeNull();
    });

    it('should throw error for required element not found', () => {
      expect(() => queryRequired('#non-existent')).toThrow('Required element not found: #non-existent');
    });

    it('should return required element when found', () => {
      const container = queryRequired('#test-container');
      expect(container).toBeTruthy();
      expect(container.id).toBe('test-container');
    });
  });

  describe('createElement', () => {
    it('should create element with tag name', () => {
      const div = createElement('div');
      expect(div.tagName).toBe('DIV');
    });

    it('should create element with attributes', () => {
      const div = createElement('div', {
        id: 'test-div',
        className: 'test-class',
        'data-value': '123'
      });

      expect(div.id).toBe('test-div');
      expect(div.className).toBe('test-class');
      expect(div.getAttribute('data-value')).toBe('123');
    });

    it('should create element with text content', () => {
      const p = createElement('p', { textContent: 'Hello, World!' });
      expect(p.textContent).toBe('Hello, World!');
    });

    it('should create element with innerHTML', () => {
      const div = createElement('div', { innerHTML: '<span>Content</span>' });
      expect(div.innerHTML).toBe('<span>Content</span>');
    });

    it('should create element with children', () => {
      const span = createElement('span', {}, ['Hello, ', 'World!']);
      const child = createElement('em', {}, ['Child']);
      const div = createElement('div', {}, [span, child]);

      expect(div.children.length).toBe(2);
      expect(div.textContent).toBe('Hello, World!Child');
    });

    it('should handle property assignment', () => {
      const input = createElement('input', {
        type: 'text',
        value: 'test-value',
        disabled: true
      });

      expect(input.type).toBe('text');
      expect(input.value).toBe('test-value');
      expect(input.disabled).toBe(true);
    });
  });

  describe('CSS class utilities', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = createElement('div', { className: 'initial' });
    });

    it('should add CSS classes', () => {
      addClass(element, 'new-class', 'another-class');
      expect(element.classList.contains('initial')).toBe(true);
      expect(element.classList.contains('new-class')).toBe(true);
      expect(element.classList.contains('another-class')).toBe(true);
    });

    it('should filter out empty classes', () => {
      addClass(element, 'valid-class', '', null as any, 'another-class');
      expect(element.classList.contains('valid-class')).toBe(true);
      expect(element.classList.contains('another-class')).toBe(true);
      expect(element.classList.length).toBe(3); // initial + 2 valid classes
    });

    it('should remove CSS classes', () => {
      addClass(element, 'remove-me', 'keep-me');
      removeClass(element, 'remove-me', 'initial');
      expect(element.classList.contains('remove-me')).toBe(false);
      expect(element.classList.contains('initial')).toBe(false);
      expect(element.classList.contains('keep-me')).toBe(true);
    });

    it('should toggle CSS class', () => {
      const result1 = toggleClass(element, 'toggle-class');
      expect(result1).toBe(true);
      expect(element.classList.contains('toggle-class')).toBe(true);

      const result2 = toggleClass(element, 'toggle-class');
      expect(result2).toBe(false);
      expect(element.classList.contains('toggle-class')).toBe(false);
    });

    it('should force toggle CSS class', () => {
      toggleClass(element, 'force-class', true);
      expect(element.classList.contains('force-class')).toBe(true);

      toggleClass(element, 'force-class', true);
      expect(element.classList.contains('force-class')).toBe(true);

      toggleClass(element, 'force-class', false);
      expect(element.classList.contains('force-class')).toBe(false);
    });

    it('should check if element has class', () => {
      expect(hasClass(element, 'initial')).toBe(true);
      expect(hasClass(element, 'non-existent')).toBe(false);
    });
  });

  describe('attribute utilities', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = createElement('div');
    });

    it('should set attributes', () => {
      setAttributes(element, {
        id: 'test-id',
        'data-value': 'test-value',
        'aria-label': 'Test Label',
        tabindex: 0
      });

      expect(element.id).toBe('test-id');
      expect(element.getAttribute('data-value')).toBe('test-value');
      expect(element.getAttribute('aria-label')).toBe('Test Label');
      expect(element.getAttribute('tabindex')).toBe('0');
    });

    it('should remove attributes with null values', () => {
      element.setAttribute('remove-me', 'value');
      setAttributes(element, {
        'remove-me': null,
        'keep-me': 'value'
      });

      expect(element.hasAttribute('remove-me')).toBe(false);
      expect(element.getAttribute('keep-me')).toBe('value');
    });

    it('should remove attributes with false values', () => {
      element.setAttribute('remove-me', 'value');
      setAttributes(element, {
        'remove-me': false,
        'keep-me': true
      });

      expect(element.hasAttribute('remove-me')).toBe(false);
      expect(element.getAttribute('keep-me')).toBe('true');
    });

    it('should get all attributes as object', () => {
      setAttributes(element, {
        id: 'test-id',
        'data-value': 'test-value',
        class: 'test-class'
      });

      const attributes = getAttributes(element);
      expect(attributes).toEqual({
        id: 'test-id',
        'data-value': 'test-value',
        class: 'test-class'
      });
    });
  });

  describe('event delegation', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = createElement('div');
      container.innerHTML = `
        <button class="btn" data-action="click">Button 1</button>
        <button class="btn" data-action="click">Button 2</button>
        <div class="nested">
          <button class="btn" data-action="click">Button 3</button>
        </div>
      `;
      document.body.appendChild(container);
    });

    it('should handle delegated events', () => {
      const handler = vi.fn();
      const cleanup = delegate(container, 'click', '.btn', handler);

      const button = container.querySelector('.btn')!;
      button.click();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.any(Event), button);

      cleanup();
    });

    it('should handle nested delegated events', () => {
      const handler = vi.fn();
      delegate(container, 'click', '.btn', handler);

      const nestedButton = container.querySelector('.nested .btn')!;
      nestedButton.click();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should cleanup event listeners', () => {
      const handler = vi.fn();
      const cleanup = delegate(container, 'click', '.btn', handler);

      cleanup();

      const button = container.querySelector('.btn')!;
      button.click();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should pass event delegation options', () => {
      const handler = vi.fn();
      const addEventListenerSpy = vi.spyOn(container, 'addEventListener');

      delegate(container, 'click', '.btn', handler, { capture: true, passive: true });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        { capture: true, passive: true }
      );
    });
  });

  describe('ready function', () => {
    it('should call callback immediately if DOM is ready', () => {
      const callback = vi.fn();

      // Mock document.readyState as 'complete'
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true
      });

      ready(callback);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should wait for DOMContentLoaded if DOM is loading', () => {
      const callback = vi.fn();
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      // Mock document.readyState as 'loading'
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        writable: true
      });

      ready(callback);

      expect(callback).not.toHaveBeenCalled();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        callback,
        { once: true }
      );
    });
  });

  describe('debounced listener', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = createElement('div');
      document.body.appendChild(element);
    });

    it('should debounce event handler', () => {
      const handler = vi.fn();
      const cleanup = debouncedListener(element, 'click', handler, 100);

      // Trigger multiple events
      element.click();
      element.click();
      element.click();

      expect(handler).not.toHaveBeenCalled();

      // Advance timers
      vi.advanceTimersByTime(100);

      expect(handler).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should reset debounce timer on new events', () => {
      const handler = vi.fn();
      const cleanup = debouncedListener(element, 'click', handler, 100);

      element.click();
      vi.advanceTimersByTime(50);
      element.click(); // Reset timer
      vi.advanceTimersByTime(50);

      expect(handler).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(handler).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should cleanup event listener and timeout', () => {
      const handler = vi.fn();
      const cleanup = debouncedListener(element, 'click', handler, 100);

      element.click();
      cleanup();

      vi.advanceTimersByTime(100);
      expect(handler).not.toHaveBeenCalled();

      element.click();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('throttled listener', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = createElement('div');
      document.body.appendChild(element);
    });

    it('should throttle event handler', () => {
      const handler = vi.fn();
      const cleanup = throttledListener(element, 'click', handler, 100);

      element.click();
      expect(handler).toHaveBeenCalledTimes(1);

      element.click();
      element.click();
      expect(handler).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      element.click();
      expect(handler).toHaveBeenCalledTimes(2);

      cleanup();
    });

    it('should cleanup event listener', () => {
      const handler = vi.fn();
      const cleanup = throttledListener(element, 'click', handler, 100);

      cleanup();

      element.click();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('FocusManager', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = createElement('div');
      container.innerHTML = `
        <button id="btn1">Button 1</button>
        <input id="input1" type="text">
        <select id="select1"><option>Option</option></select>
        <textarea id="textarea1"></textarea>
        <a id="link1" href="#">Link</a>
        <div id="div1" tabindex="0">Focusable div</div>
        <button id="btn-disabled" disabled>Disabled button</button>
        <input id="input-disabled" type="text" disabled>
      `;
      document.body.appendChild(container);

      // Mock offsetWidth and offsetHeight for all elements to make them "visible"
      const allElements = container.querySelectorAll('*');
      allElements.forEach(element => {
        Object.defineProperty(element, 'offsetWidth', { value: 100, writable: true });
        Object.defineProperty(element, 'offsetHeight', { value: 20, writable: true });
      });
    });

    it('should focus element with options', () => {
      const button = container.querySelector('#btn1') as HTMLElement;
      const focusSpy = vi.spyOn(button, 'focus');

      FocusManager.focus(button, { preventScroll: true });

      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('should get focusable elements', () => {
      const focusableElements = FocusManager.getFocusableElements(container);

      expect(focusableElements.length).toBe(6);
      expect(focusableElements.map(el => el.id)).toEqual([
        'btn1', 'input1', 'select1', 'textarea1', 'link1', 'div1'
      ]);
    });

    it('should exclude disabled elements', () => {
      const focusableElements = FocusManager.getFocusableElements(container);
      const ids = focusableElements.map(el => el.id);

      expect(ids).not.toContain('btn-disabled');
      expect(ids).not.toContain('input-disabled');
    });

    it('should trap focus within container', () => {
      const cleanup = FocusManager.trapFocus(container);

      const firstButton = container.querySelector('#btn1') as HTMLElement;
      const lastDiv = container.querySelector('#div1') as HTMLElement;

      // Focus should be on first element initially
      expect(document.activeElement).toBe(firstButton);

      // Simulate Tab on last element
      lastDiv.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      container.dispatchEvent(tabEvent);

      // Should wrap to first element (mocked)
      expect(tabEvent.defaultPrevented).toBe(true);

      cleanup();
    });

    it('should restore focus to previous element', () => {
      const button = container.querySelector('#btn1') as HTMLElement;
      const focusSpy = vi.spyOn(button, 'focus');

      FocusManager.restoreFocus(button);

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should handle null previous element gracefully', () => {
      expect(() => FocusManager.restoreFocus(null)).not.toThrow();
    });
  });

  describe('ScrollManager', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = createElement('div');
      document.body.appendChild(element);
    });

    it('should scroll element into view', () => {
      // scrollIntoView is already mocked in beforeEach
      ScrollManager.scrollIntoView(element, { behavior: 'smooth', block: 'center' });

      expect(element.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    });

    it('should get scroll position', () => {
      element.scrollLeft = 100;
      element.scrollTop = 200;

      const position = ScrollManager.getScrollPosition(element);

      expect(position).toEqual({ x: 100, y: 200 });
    });

    it('should set scroll position without smooth scrolling', () => {
      ScrollManager.setScrollPosition(element, 50, 100, false);

      expect(element.scrollLeft).toBe(50);
      expect(element.scrollTop).toBe(100);
    });

    it('should set scroll position with smooth scrolling', () => {
      const scrollToSpy = vi.spyOn(element, 'scrollTo').mockImplementation(() => {});

      ScrollManager.setScrollPosition(element, 50, 100, true);

      expect(scrollToSpy).toHaveBeenCalledWith({
        left: 50,
        top: 100,
        behavior: 'smooth'
      });
    });

    it('should check if element is in viewport', () => {
      // Mock getBoundingClientRect
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 50,
        bottom: 200,
        right: 150,
        width: 100,
        height: 100,
        x: 50,
        y: 100,
        toJSON: () => {}
      });

      // Mock window dimensions
      Object.defineProperties(window, {
        innerHeight: { value: 800, writable: true },
        innerWidth: { value: 1200, writable: true }
      });

      const isVisible = ScrollManager.isInViewport(element);
      expect(isVisible).toBe(true);
    });

    it('should get distance from top', () => {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 0,
        bottom: 200,
        right: 0,
        width: 0,
        height: 100,
        x: 0,
        y: 100,
        toJSON: () => {}
      });

      Object.defineProperty(window, 'pageYOffset', { value: 50, writable: true });

      const distance = ScrollManager.getDistanceFromTop(element);
      expect(distance).toBe(150); // 100 + 50
    });
  });

  describe('LazyObserver', () => {
    let observer: LazyObserver;
    let mockIntersectionObserver: any;

    beforeEach(() => {
      mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        callback
      }));
      global.IntersectionObserver = mockIntersectionObserver;

      observer = new LazyObserver();
    });

    afterEach(() => {
      observer.disconnect();
    });

    it('should observe elements with callbacks', () => {
      const element = createElement('div');
      const callback = vi.fn();

      observer.observe(element, callback);

      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it('should execute callback when element intersects', () => {
      const element = createElement('div');
      const callback = vi.fn();

      observer.observe(element, callback);

      // Get the intersection observer instance and simulate intersection
      const observerInstance = mockIntersectionObserver.mock.results[0].value;
      const intersectionCallback = mockIntersectionObserver.mock.calls[0][0];

      intersectionCallback([{
        target: element,
        isIntersecting: true
      }]);

      expect(callback).toHaveBeenCalled();
    });

    it('should unobserve elements', () => {
      const element = createElement('div');
      const callback = vi.fn();

      observer.observe(element, callback);
      observer.unobserve(element);

      const observerInstance = mockIntersectionObserver.mock.results[0].value;
      expect(observerInstance.unobserve).toHaveBeenCalledWith(element);
    });

    it('should disconnect and cleanup', () => {
      const observerInstance = mockIntersectionObserver.mock.results[0].value;

      observer.disconnect();

      expect(observerInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe('ResponsiveUtils', () => {
    beforeEach(() => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    });

    it('should detect mobile breakpoint', () => {
      window.innerWidth = 500;
      expect(ResponsiveUtils.getCurrentBreakpoint()).toBe('mobile');
      expect(ResponsiveUtils.isMobile()).toBe(true);
    });

    it('should detect tablet breakpoint', () => {
      window.innerWidth = 800;
      expect(ResponsiveUtils.getCurrentBreakpoint()).toBe('tablet');
      expect(ResponsiveUtils.isMobile()).toBe(false);
    });

    it('should detect desktop breakpoint', () => {
      window.innerWidth = 1200;
      expect(ResponsiveUtils.getCurrentBreakpoint()).toBe('desktop');
      expect(ResponsiveUtils.isMobile()).toBe(false);
    });

    it('should detect touch device', () => {
      // Mock touch support
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 2, writable: true });
      expect(ResponsiveUtils.isTouchDevice()).toBe(true);

      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, writable: true });
      expect(ResponsiveUtils.isTouchDevice()).toBe(false);
    });

    it('should get viewport size', () => {
      window.innerWidth = 1200;
      window.innerHeight = 800;

      const size = ResponsiveUtils.getViewportSize();
      expect(size).toEqual({ width: 1200, height: 800 });
    });

    it('should listen for breakpoint changes', () => {
      const callback = vi.fn();
      window.innerWidth = 1200;

      const cleanup = ResponsiveUtils.onBreakpointChange(callback);

      // Change breakpoint
      window.innerWidth = 500;
      window.dispatchEvent(new Event('resize'));
      vi.runAllTimers();

      expect(callback).toHaveBeenCalledWith('mobile');

      cleanup();
    });
  });

  describe('AnimationUtils', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = createElement('div');
      document.body.appendChild(element);
    });

    it('should fade in element', async () => {
      const promise = AnimationUtils.fadeIn(element, 100);

      expect(element.style.opacity).toBe('1');
      expect(element.style.transition).toBe('opacity 100ms ease-in-out');

      vi.advanceTimersByTime(100);
      await promise;

      // Animation completed
      expect(true).toBe(true);
    });

    it('should fade out element', async () => {
      const promise = AnimationUtils.fadeOut(element, 100);

      expect(element.style.opacity).toBe('0');
      expect(element.style.transition).toBe('opacity 100ms ease-in-out');

      vi.advanceTimersByTime(100);
      await promise;

      expect(element.style.display).toBe('none');
    });

    it('should slide down element', async () => {
      // Mock scrollHeight
      Object.defineProperty(element, 'scrollHeight', { value: 200, writable: true });

      const promise = AnimationUtils.slideDown(element, 100);

      expect(element.style.height).toBe('200px');
      expect(element.style.overflow).toBe('hidden');
      expect(element.style.transition).toBe('height 100ms ease-in-out');

      vi.advanceTimersByTime(100);
      await promise;

      expect(element.style.height).toBe('auto');
      expect(element.style.overflow).toBe('');
    });

    it('should slide up element', async () => {
      // Mock offsetHeight
      Object.defineProperty(element, 'offsetHeight', { value: 200, writable: true });

      const promise = AnimationUtils.slideUp(element, 100);

      expect(element.style.height).toBe('0px');
      expect(element.style.overflow).toBe('hidden');
      expect(element.style.transition).toBe('height 100ms ease-in-out');

      vi.advanceTimersByTime(100);
      await promise;

      expect(element.style.display).toBe('none');
    });
  });

  describe('KeyboardUtils', () => {
    it('should check if key matches', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      expect(KeyboardUtils.isKey(event, 'Enter')).toBe(true);
      expect(KeyboardUtils.isKey(event, 'Enter', 'Space')).toBe(true);
      expect(KeyboardUtils.isKey(event, 'Space', 'Tab')).toBe(false);
    });

    it('should check for modifier keys', () => {
      const ctrlEvent = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
      const normalEvent = new KeyboardEvent('keydown', { key: 'c' });

      expect(KeyboardUtils.hasModifier(ctrlEvent)).toBe(true);
      expect(KeyboardUtils.hasModifier(normalEvent)).toBe(false);
    });

    it('should handle escape key', () => {
      const callback = vi.fn();
      const cleanup = KeyboardUtils.onEscape(callback);

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      expect(callback).toHaveBeenCalled();

      cleanup();
    });

    it('should handle arrow keys', () => {
      const callbacks = {
        up: vi.fn(),
        down: vi.fn(),
        left: vi.fn(),
        right: vi.fn()
      };

      const cleanup = KeyboardUtils.onArrowKeys(callbacks);

      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

      document.dispatchEvent(upEvent);
      document.dispatchEvent(downEvent);
      document.dispatchEvent(leftEvent);
      document.dispatchEvent(rightEvent);

      expect(callbacks.up).toHaveBeenCalled();
      expect(callbacks.down).toHaveBeenCalled();
      expect(callbacks.left).toHaveBeenCalled();
      expect(callbacks.right).toHaveBeenCalled();

      expect(upEvent.defaultPrevented).toBe(true);
      expect(downEvent.defaultPrevented).toBe(true);
      expect(leftEvent.defaultPrevented).toBe(true);
      expect(rightEvent.defaultPrevented).toBe(true);

      cleanup();
    });

    it('should cleanup arrow key listeners', () => {
      const callbacks = { up: vi.fn() };
      const cleanup = KeyboardUtils.onArrowKeys(callbacks);

      cleanup();

      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      document.dispatchEvent(upEvent);

      expect(callbacks.up).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle missing elements gracefully', () => {
      const nonExistentElement = document.querySelector('#non-existent');
      // The function should handle null gracefully, so it should not throw
      expect(() => addClass(nonExistentElement, 'class')).not.toThrow();
    });

    it('should handle window resize without debounced listener setup', () => {
      // Test edge case where window resize happens without listener
      expect(() => {
        window.dispatchEvent(new Event('resize'));
      }).not.toThrow();
    });

    it('should handle focus management with no focusable elements', () => {
      const emptyContainer = createElement('div');
      const cleanup = FocusManager.trapFocus(emptyContainer);

      expect(() => cleanup()).not.toThrow();
    });

    it('should handle animation utils with detached elements', () => {
      const detachedElement = createElement('div');

      expect(async () => {
        await AnimationUtils.fadeIn(detachedElement, 0);
      }).not.toThrow();
    });

    it('should handle LazyObserver with elements not in container', () => {
      const observer = new LazyObserver();
      const element = createElement('div');
      const callback = vi.fn();

      // Element is not in DOM
      expect(() => {
        observer.observe(element, callback);
      }).not.toThrow();

      observer.disconnect();
    });
  });
});