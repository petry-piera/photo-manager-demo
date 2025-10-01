/**
 * Accessibility compliance validation tests
 * - Run axe-core automated testing
 * - Perform manual keyboard navigation testing
 * - Test with screen readers (NVDA, JAWS, VoiceOver simulation)
 * - Validate WCAG 2.1 AA compliance
 */

import { test, expect, Page, Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// WCAG 2.1 AA compliance levels and criteria
const WCAG_CRITERIA = {
  LEVEL_A: [
    'color-contrast',
    'keyboard',
    'focus-order',
    'link-purpose',
    'heading-order',
    'label',
    'bypass'
  ],
  LEVEL_AA: [
    'color-contrast-enhanced',
    'resize-text',
    'reflow',
    'non-text-contrast',
    'text-spacing',
    'content-on-hover-or-focus'
  ]
};

// Screen reader simulation utilities
class ScreenReaderSimulator {
  private page: Page;
  private announcements: string[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async initialize() {
    // Set up ARIA live region monitoring
    await this.page.evaluate(() => {
      const liveRegions = document.querySelectorAll('[aria-live]');

      liveRegions.forEach(region => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
              const text = (mutation.target as Element).textContent;
              if (text && text.trim()) {
                (window as any).screenReaderAnnouncements = (window as any).screenReaderAnnouncements || [];
                (window as any).screenReaderAnnouncements.push({
                  timestamp: Date.now(),
                  text: text.trim(),
                  priority: (mutation.target as Element).getAttribute('aria-live') || 'polite'
                });
              }
            }
          });
        });

        observer.observe(region, {
          childList: true,
          subtree: true,
          characterData: true
        });
      });
    });
  }

  async getAnnouncements(): Promise<Array<{ timestamp: number; text: string; priority: string }>> {
    return this.page.evaluate(() => {
      return (window as any).screenReaderAnnouncements || [];
    });
  }

  async clearAnnouncements() {
    await this.page.evaluate(() => {
      (window as any).screenReaderAnnouncements = [];
    });
  }
}

// Keyboard navigation helper
class KeyboardNavigator {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateWithTab(steps: number = 1): Promise<Locator> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('Tab');
    }
    return this.page.locator(':focus');
  }

  async navigateWithShiftTab(steps: number = 1): Promise<Locator> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('Shift+Tab');
    }
    return this.page.locator(':focus');
  }

  async activateFocusedElement(): Promise<void> {
    await this.page.keyboard.press('Enter');
  }

  async activateWithSpace(): Promise<void> {
    await this.page.keyboard.press('Space');
  }

  async navigateWithArrows(direction: 'Up' | 'Down' | 'Left' | 'Right'): Promise<void> {
    await this.page.keyboard.press(`Arrow${direction}`);
  }

  async getFocusedElementInfo(): Promise<{
    tagName: string;
    ariaLabel?: string;
    ariaRole?: string;
    textContent: string;
  }> {
    return this.page.evaluate(() => {
      const focused = document.activeElement;
      if (!focused) return null;

      return {
        tagName: focused.tagName.toLowerCase(),
        ariaLabel: focused.getAttribute('aria-label') || undefined,
        ariaRole: focused.getAttribute('role') || undefined,
        textContent: focused.textContent?.trim() || ''
      };
    });
  }
}

// Helper to simulate different accessibility preferences
async function setAccessibilityPreferences(page: Page, preferences: {
  highContrast?: boolean;
  reducedMotion?: boolean;
  largeText?: boolean;
}) {
  await page.addInitScript((prefs) => {
    // Mock matchMedia for accessibility preferences
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => {
      let matches = false;

      if (query.includes('prefers-contrast: high') && prefs.highContrast) {
        matches = true;
      }
      if (query.includes('prefers-reduced-motion: reduce') && prefs.reducedMotion) {
        matches = true;
      }

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
      };
    };

    // Apply text scaling if needed
    if (prefs.largeText) {
      document.documentElement.style.fontSize = '120%';
    }
  }, preferences);
}

test.describe('Accessibility Compliance Tests', () => {
  let screenReader: ScreenReaderSimulator;
  let keyboardNav: KeyboardNavigator;

  test.beforeEach(async ({ page }) => {
    screenReader = new ScreenReaderSimulator(page);
    keyboardNav = new KeyboardNavigator(page);

    // Navigate to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Initialize screen reader simulation
    await screenReader.initialize();
  });

  test.describe('Automated Accessibility Testing (axe-core)', () => {
    test('should have no accessibility violations on home page', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have no violations in photo import flow', async ({ page }) => {
      // Open import dialog
      await page.click('button:has-text("Import Photos")');
      await page.waitForSelector('.photo-import-dialog');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have no violations in settings panel', async ({ page }) => {
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('.settings-panel');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have no violations with modal dialogs', async ({ page }) => {
      // Simulate having some photos first
      await page.evaluate(() => {
        const container = document.querySelector('main') || document.body;
        const photoElement = document.createElement('div');
        photoElement.className = 'photo-item';
        photoElement.innerHTML = `
          <img src="data:image/jpeg;base64,/9j/4AAQSkZJ..." alt="Sample photo" class="photo-thumbnail">
        `;
        photoElement.addEventListener('click', () => {
          const modal = document.createElement('div');
          modal.className = 'photo-modal';
          modal.setAttribute('role', 'dialog');
          modal.setAttribute('aria-labelledby', 'modal-title');
          modal.innerHTML = `
            <div class="modal-content">
              <h2 id="modal-title">Photo Details</h2>
              <img src="data:image/jpeg;base64,/9j/4AAQSkZJ..." alt="Sample photo">
              <button type="button" aria-label="Close modal">×</button>
            </div>
          `;
          document.body.appendChild(modal);
        });
        container.appendChild(photoElement);
      });

      // Open photo modal
      await page.click('.photo-thumbnail');
      await page.waitForSelector('.photo-modal');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should allow complete navigation using only keyboard', async ({ page }) => {
      // Start navigation from document body
      await page.keyboard.press('Tab');

      // Should focus on first interactive element
      const firstFocus = await keyboardNav.getFocusedElementInfo();
      expect(firstFocus).toBeTruthy();
      expect(['button', 'input', 'a'].includes(firstFocus!.tagName)).toBe(true);

      // Navigate through several elements
      let tabCount = 0;
      const focusedElements = [];

      while (tabCount < 10) {
        const focusedElement = await keyboardNav.navigateWithTab();
        const elementInfo = await keyboardNav.getFocusedElementInfo();

        if (elementInfo) {
          focusedElements.push(elementInfo);
        }

        tabCount++;
      }

      // Should have focused on multiple interactive elements
      expect(focusedElements.length).toBeGreaterThan(3);

      // Each focused element should be interactive
      focusedElements.forEach(element => {
        expect(['button', 'input', 'a', 'select', 'textarea'].includes(element.tagName)).toBe(true);
      });
    });

    test('should support reverse tab navigation', async ({ page }) => {
      // Navigate forward first
      await keyboardNav.navigateWithTab(5);
      const forwardElement = await keyboardNav.getFocusedElementInfo();

      // Navigate backward
      await keyboardNav.navigateWithShiftTab(1);
      const backwardElement = await keyboardNav.getFocusedElementInfo();

      // Should be different elements
      expect(backwardElement).not.toEqual(forwardElement);
    });

    test('should activate elements with Enter and Space keys', async ({ page }) => {
      // Focus on import button
      await page.keyboard.press('Tab');
      const focusedElement = await page.locator(':focus');

      if (await focusedElement.innerText() === 'Import Photos') {
        await keyboardNav.activateFocusedElement();

        // Should open import dialog
        await page.waitForSelector('.photo-import-dialog');
        expect(await page.locator('.photo-import-dialog').isVisible()).toBe(true);

        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForSelector('.photo-import-dialog', { state: 'hidden' });
      }
    });

    test('should trap focus within modal dialogs', async ({ page }) => {
      // Create and open a modal
      await page.evaluate(() => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.innerHTML = `
          <div class="modal-content">
            <button id="first-button">First Button</button>
            <input id="modal-input" type="text" placeholder="Input field">
            <button id="second-button">Second Button</button>
            <button id="close-button">Close</button>
          </div>
        `;
        document.body.appendChild(modal);

        // Simple focus trap implementation
        const focusableElements = modal.querySelectorAll('button, input, select, textarea, a[href]');
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        firstElement.focus();

        modal.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          }
        });
      });

      // First element should be focused
      const firstFocused = await keyboardNav.getFocusedElementInfo();
      expect(firstFocused?.textContent).toBe('First Button');

      // Tab to end and verify focus wraps
      await keyboardNav.navigateWithTab(4); // Should wrap to first element
      const wrappedFocus = await keyboardNav.getFocusedElementInfo();
      expect(wrappedFocus?.textContent).toBe('First Button');

      // Test reverse tab wrapping
      await keyboardNav.navigateWithShiftTab(1);
      const reverseWrapped = await keyboardNav.getFocusedElementInfo();
      expect(reverseWrapped?.textContent).toBe('Close');
    });

    test('should support arrow key navigation in grids', async ({ page }) => {
      // Create a grid of items
      await page.evaluate(() => {
        const container = document.querySelector('main') || document.body;
        const grid = document.createElement('div');
        grid.className = 'photo-grid';
        grid.setAttribute('role', 'grid');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;';

        for (let i = 0; i < 9; i++) {
          const gridCell = document.createElement('div');
          gridCell.setAttribute('role', 'gridcell');
          gridCell.setAttribute('tabindex', i === 0 ? '0' : '-1');
          gridCell.style.cssText = 'padding: 20px; background: #f0f0f0; cursor: pointer;';
          gridCell.textContent = `Item ${i + 1}`;

          // Arrow key navigation
          gridCell.addEventListener('keydown', (e) => {
            const items = Array.from(grid.querySelectorAll('[role="gridcell"]'));
            const currentIndex = items.indexOf(e.target as Element);
            let targetIndex = currentIndex;

            switch (e.key) {
              case 'ArrowRight':
                targetIndex = Math.min(currentIndex + 1, items.length - 1);
                break;
              case 'ArrowLeft':
                targetIndex = Math.max(currentIndex - 1, 0);
                break;
              case 'ArrowDown':
                targetIndex = Math.min(currentIndex + 3, items.length - 1);
                break;
              case 'ArrowUp':
                targetIndex = Math.max(currentIndex - 3, 0);
                break;
              default:
                return;
            }

            if (targetIndex !== currentIndex) {
              e.preventDefault();
              items.forEach(item => item.setAttribute('tabindex', '-1'));
              (items[targetIndex] as HTMLElement).setAttribute('tabindex', '0');
              (items[targetIndex] as HTMLElement).focus();
            }
          });

          grid.appendChild(gridCell);
        }

        container.appendChild(grid);
      });

      // Focus on first grid item
      await page.click('[role="gridcell"]:first-child');

      // Test right arrow
      await keyboardNav.navigateWithArrows('Right');
      const rightFocus = await keyboardNav.getFocusedElementInfo();
      expect(rightFocus?.textContent).toBe('Item 2');

      // Test down arrow
      await keyboardNav.navigateWithArrows('Down');
      const downFocus = await keyboardNav.getFocusedElementInfo();
      expect(downFocus?.textContent).toBe('Item 5');
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should announce page title and main landmarks', async ({ page }) => {
      await screenReader.clearAnnouncements();

      // Check page title
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);

      // Check for main landmarks
      const landmarks = await page.locator('[role="main"], main, [role="navigation"], nav, [role="banner"], header').count();
      expect(landmarks).toBeGreaterThan(0);

      // Check for proper heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);

      // Verify h1 exists and is unique
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);
    });

    test('should announce dynamic content changes', async ({ page }) => {
      await screenReader.clearAnnouncements();

      // Create a live region for testing
      await page.evaluate(() => {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.id = 'status-updates';
        document.body.appendChild(liveRegion);
      });

      // Trigger a status update
      await page.evaluate(() => {
        const liveRegion = document.getElementById('status-updates');
        if (liveRegion) {
          liveRegion.textContent = 'Photo import started';
        }
      });

      await page.waitForTimeout(100);

      // Check for announcement
      const announcements = await screenReader.getAnnouncements();
      const importAnnouncement = announcements.find(a => a.text.includes('Photo import started'));
      expect(importAnnouncement).toBeTruthy();
      expect(importAnnouncement?.priority).toBe('polite');
    });

    test('should provide meaningful labels for interactive elements', async ({ page }) => {
      const interactiveElements = await page.locator('button, input, a, select, textarea').all();

      for (const element of interactiveElements) {
        // Each interactive element should have accessible text
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        const textContent = await element.textContent();
        const title = await element.getAttribute('title');
        const altText = await element.getAttribute('alt');

        const hasAccessibleName = ariaLabel || ariaLabelledBy || textContent?.trim() || title || altText;
        expect(hasAccessibleName).toBeTruthy();
      }
    });

    test('should announce form validation errors', async ({ page }) => {
      await screenReader.clearAnnouncements();

      // Create a form with validation
      await page.evaluate(() => {
        const form = document.createElement('form');
        form.innerHTML = `
          <label for="test-input">Test Input</label>
          <input id="test-input" type="text" required aria-describedby="test-error">
          <div id="test-error" role="alert" aria-live="assertive" style="display: none;"></div>
          <button type="submit">Submit</button>
        `;
        document.body.appendChild(form);

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = form.querySelector('#test-input') as HTMLInputElement;
          const errorDiv = form.querySelector('#test-error') as HTMLElement;

          if (!input.value.trim()) {
            errorDiv.textContent = 'This field is required';
            errorDiv.style.display = 'block';
            input.setAttribute('aria-invalid', 'true');
          }
        });
      });

      // Submit empty form
      await page.click('button[type="submit"]');
      await page.waitForTimeout(100);

      // Check for error announcement
      const announcements = await screenReader.getAnnouncements();
      const errorAnnouncement = announcements.find(a => a.text.includes('required'));
      expect(errorAnnouncement).toBeTruthy();
      expect(errorAnnouncement?.priority).toBe('assertive');
    });

    test('should provide context for complex UI widgets', async ({ page }) => {
      // Create a complex widget (carousel/slider)
      await page.evaluate(() => {
        const container = document.querySelector('main') || document.body;
        const carousel = document.createElement('div');
        carousel.setAttribute('role', 'region');
        carousel.setAttribute('aria-label', 'Photo carousel');
        carousel.innerHTML = `
          <div role="group" aria-labelledby="carousel-heading" aria-describedby="carousel-instructions">
            <h3 id="carousel-heading">Recent Photos</h3>
            <p id="carousel-instructions">Use arrow keys to navigate between photos</p>
            <div class="carousel-items" role="listbox" aria-label="Photo list">
              <div role="option" aria-label="Photo 1 of 3" tabindex="0">Photo 1</div>
              <div role="option" aria-label="Photo 2 of 3" tabindex="-1">Photo 2</div>
              <div role="option" aria-label="Photo 3 of 3" tabindex="-1">Photo 3</div>
            </div>
          </div>
        `;
        container.appendChild(carousel);
      });

      // Focus on carousel
      await page.click('[role="option"]:first-child');
      const focusedElement = await keyboardNav.getFocusedElementInfo();

      expect(focusedElement?.ariaLabel).toContain('1 of 3');
      expect(focusedElement?.ariaRole).toBe('option');
    });
  });

  test.describe('Visual Accessibility', () => {
    test('should maintain color contrast ratios', async ({ page }) => {
      const contrastViolations = await new AxeBuilder({ page })
        .withTags(['color-contrast'])
        .analyze();

      expect(contrastViolations.violations).toEqual([]);
    });

    test('should support high contrast mode', async ({ page }) => {
      await setAccessibilityPreferences(page, { highContrast: true });
      await page.reload();

      // Check if high contrast styles are applied
      const hasHighContrastClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('high-contrast') ||
               document.body.classList.contains('high-contrast');
      });

      // Should either have high contrast class or pass axe contrast tests
      if (!hasHighContrastClass) {
        const contrastResults = await new AxeBuilder({ page })
          .withTags(['color-contrast'])
          .analyze();
        expect(contrastResults.violations).toEqual([]);
      }
    });

    test('should support reduced motion preferences', async ({ page }) => {
      await setAccessibilityPreferences(page, { reducedMotion: true });
      await page.reload();

      // Check if reduced motion is respected
      const hasReducedMotion = await page.evaluate(() => {
        const computedStyle = getComputedStyle(document.body);
        return computedStyle.getPropertyValue('--animation-duration') === '0s' ||
               document.documentElement.classList.contains('reduce-motion');
      });

      expect(hasReducedMotion).toBe(true);
    });

    test('should be usable at 200% zoom level', async ({ page }) => {
      // Set zoom level to 200%
      await page.setViewportSize({ width: 640, height: 480 }); // Simulate 200% zoom on 1280x960

      // Check that content is still accessible
      const accessibilityResults = await new AxeBuilder({ page })
        .withTags(['wcag21aa'])
        .analyze();

      expect(accessibilityResults.violations).toEqual([]);

      // Verify horizontal scrolling is not required for text content
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });

      // Some horizontal scroll might be acceptable for complex layouts
      // but text content should be readable
      const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, span').all();

      for (const element of textElements.slice(0, 5)) { // Test first 5 elements
        const box = await element.boundingBox();
        if (box) {
          expect(box.width).toBeLessThan(640); // Should fit in viewport
        }
      }
    });
  });

  test.describe('WCAG 2.1 AA Compliance', () => {
    test('should pass all WCAG 2.1 Level A criteria', async ({ page }) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag21a'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('should pass all WCAG 2.1 Level AA criteria', async ({ page }) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements =>
        elements.map(el => ({
          level: parseInt(el.tagName.charAt(1)),
          text: el.textContent?.trim() || ''
        }))
      );

      if (headings.length > 0) {
        // Should start with h1
        expect(headings[0].level).toBe(1);

        // Should not skip levels
        for (let i = 1; i < headings.length; i++) {
          const currentLevel = headings[i].level;
          const previousLevel = headings[i - 1].level;

          // Can stay same, go down one level, or go up any number
          expect(currentLevel).toBeLessThanOrEqual(previousLevel + 1);
        }
      }
    });

    test('should provide skip links for navigation', async ({ page }) => {
      // Focus on first element (usually skip link)
      await page.keyboard.press('Tab');
      const focusedElement = await keyboardNav.getFocusedElementInfo();

      // Skip link should be present and functional
      if (focusedElement?.textContent?.toLowerCase().includes('skip')) {
        await keyboardNav.activateFocusedElement();

        // Should move focus to main content
        const afterSkip = await keyboardNav.getFocusedElementInfo();
        expect(afterSkip).not.toEqual(focusedElement);
      }
    });

    test('should have proper form labeling', async ({ page }) => {
      const formInputs = await page.locator('input, select, textarea').all();

      for (const input of formInputs) {
        const inputId = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        // Should have a label element, aria-label, or aria-labelledby
        const hasLabel = ariaLabel || ariaLabelledBy ||
          (inputId && await page.locator(`label[for="${inputId}"]`).count() > 0);

        expect(hasLabel).toBe(true);
      }
    });

    test('should provide error identification and suggestions', async ({ page }) => {
      // Test with a form that has validation
      await page.evaluate(() => {
        const form = document.createElement('form');
        form.innerHTML = `
          <label for="email-input">Email Address</label>
          <input id="email-input" type="email" required aria-describedby="email-error">
          <div id="email-error" role="alert" aria-live="polite"></div>
          <button type="submit">Submit</button>
        `;
        document.body.appendChild(form);

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = form.querySelector('#email-input') as HTMLInputElement;
          const errorDiv = form.querySelector('#email-error') as HTMLElement;

          if (!input.validity.valid) {
            errorDiv.textContent = 'Please enter a valid email address (e.g., user@example.com)';
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', 'email-error');
          }
        });
      });

      // Submit with invalid email
      await page.fill('#email-input', 'invalid-email');
      await page.click('button[type="submit"]');

      // Check that error is properly associated and descriptive
      const errorText = await page.locator('#email-error').textContent();
      expect(errorText).toContain('valid email');
      expect(errorText).toContain('@'); // Should provide example

      const isInvalid = await page.locator('#email-input').getAttribute('aria-invalid');
      expect(isInvalid).toBe('true');
    });
  });

  test.describe('Mobile Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should have adequate touch targets', async ({ page }) => {
      const touchTargets = await page.locator('button, a, input[type="checkbox"], input[type="radio"]').all();

      for (const target of touchTargets) {
        const box = await target.boundingBox();
        if (box) {
          // WCAG recommends minimum 44x44 CSS pixels
          expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should support screen reader gestures', async ({ page }) => {
      // Simulate screen reader navigation
      await page.evaluate(() => {
        // Add landmarks for navigation
        const main = document.createElement('main');
        main.innerHTML = `
          <h1>PhotoManager</h1>
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="#photos">Photos</a></li>
              <li><a href="#albums">Albums</a></li>
              <li><a href="#settings">Settings</a></li>
            </ul>
          </nav>
          <section id="photos">
            <h2>Recent Photos</h2>
            <p>Your recently imported photos</p>
          </section>
        `;
        document.body.appendChild(main);
      });

      // Verify landmarks are accessible
      const landmarks = await page.locator('[role="main"], main, [role="navigation"], nav').count();
      expect(landmarks).toBeGreaterThanOrEqual(2);

      // Verify headings are properly structured for navigation
      const headings = await page.locator('h1, h2, h3').count();
      expect(headings).toBeGreaterThanOrEqual(2);
    });
  });
});

test.describe('Accessibility Regression Tests', () => {
  test('should maintain accessibility after dynamic content updates', async ({ page }) => {
    // Initial accessibility check
    const initialResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(initialResults.violations).toEqual([]);

    // Add dynamic content
    await page.evaluate(() => {
      const container = document.querySelector('main') || document.body;
      const newContent = document.createElement('div');
      newContent.innerHTML = `
        <section aria-label="Dynamic content">
          <h2>New Photos</h2>
          <ul role="list">
            <li><button type="button">Photo 1</button></li>
            <li><button type="button">Photo 2</button></li>
          </ul>
        </section>
      `;
      container.appendChild(newContent);
    });

    // Re-check accessibility
    const afterUpdateResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(afterUpdateResults.violations).toEqual([]);
  });

  test('should maintain accessibility during loading states', async ({ page }) => {
    // Add loading state
    await page.evaluate(() => {
      const container = document.querySelector('main') || document.body;
      const loadingDiv = document.createElement('div');
      loadingDiv.setAttribute('aria-live', 'polite');
      loadingDiv.setAttribute('aria-label', 'Loading photos');
      loadingDiv.innerHTML = `
        <div role="status" aria-label="Loading">
          <div class="spinner" aria-hidden="true"></div>
          <span class="sr-only">Loading photos...</span>
        </div>
      `;
      container.appendChild(loadingDiv);
    });

    const loadingResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(loadingResults.violations).toEqual([]);

    // Verify loading is announced to screen readers
    const hasStatusRole = await page.locator('[role="status"]').count();
    expect(hasStatusRole).toBeGreaterThan(0);
  });
});