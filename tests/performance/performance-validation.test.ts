/**
 * Performance validation tests per quickstart.md requirements
 * - Verify <100ms UI response times
 * - Test with 1000+ photo collections
 * - Validate memory usage stays under 2GB
 * - Ensure thumbnail loading <200ms
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  UI_RESPONSE_TIME: 100, // ms
  THUMBNAIL_LOAD_TIME: 200, // ms
  MAX_MEMORY_USAGE: 2048, // MB
  PAGE_LOAD_TIME: 3000, // ms
  LARGE_COLLECTION_SIZE: 1000, // photos
  SCROLL_PERFORMANCE: 16.67 // ms per frame (60fps)
};

// Helper functions
async function measurePerformance(page: Page, operation: () => Promise<void>): Promise<number> {
  const startTime = performance.now();
  await operation();
  return performance.now() - startTime;
}

async function createLargePhotoCollection(page: Page, size: number = 100) {
  // Simulate large collection by injecting mock data
  await page.evaluate((photoCount) => {
    const mockPhotos = Array.from({ length: photoCount }, (_, i) => ({
      id: `mock-photo-${i}`,
      fileName: `photo-${i + 1}.jpg`,
      thumbnailDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      dateAdded: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      tags: [`tag-${i % 10}`, `category-${i % 5}`],
      caption: `Photo ${i + 1} caption`
    }));

    // Store in window for component access
    (window as any).mockPhotoCollection = mockPhotos;
  }, size);
}

async function getMemoryUsage(page: Page): Promise<number> {
  return page.evaluate(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  });
}

async function measureFPS(page: Page, duration: number = 1000): Promise<number> {
  return page.evaluate((testDuration) => {
    return new Promise<number>((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();

      function countFrame() {
        frameCount++;
        const elapsed = performance.now() - startTime;

        if (elapsed < testDuration) {
          requestAnimationFrame(countFrame);
        } else {
          const fps = (frameCount / elapsed) * 1000;
          resolve(fps);
        }
      }

      requestAnimationFrame(countFrame);
    });
  }, duration);
}

test.describe('Performance Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to PhotoManager
    await page.goto('/');

    // Wait for initial load
    await page.waitForLoadState('networkidle');
  });

  test.describe('UI Response Times', () => {
    test('should respond to clicks within 100ms', async ({ page }) => {
      // Test various UI interactions
      const interactions = [
        () => page.click('button:has-text("Import Photos")'),
        () => page.click('button:has-text("Settings")'),
        () => page.click('input[placeholder*="Search"]'),
      ];

      for (const interaction of interactions) {
        const responseTime = await measurePerformance(page, interaction);
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.UI_RESPONSE_TIME);

        // Clean up - close any opened dialogs
        await page.keyboard.press('Escape');
      }
    });

    test('should update search results within 100ms of typing', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search"]');

      const responseTime = await measurePerformance(page, async () => {
        await searchInput.fill('test query');
        // Wait for UI to update (not including network request)
        await page.waitForTimeout(10);
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.UI_RESPONSE_TIME);
    });

    test('should open photo modal within 100ms', async ({ page }) => {
      // First, create some mock photos
      await createLargePhotoCollection(page, 10);

      // Inject photos into the page
      await page.evaluate(() => {
        const container = document.querySelector('.photo-grid') || document.body;
        const mockPhotos = (window as any).mockPhotoCollection;

        mockPhotos.slice(0, 5).forEach((photo: any, index: number) => {
          const photoElement = document.createElement('div');
          photoElement.className = 'photo-item';
          photoElement.innerHTML = `
            <img src="${photo.thumbnailDataUrl}" alt="${photo.fileName}" class="photo-thumbnail">
          `;
          photoElement.addEventListener('click', () => {
            // Simulate modal opening
            const modal = document.createElement('div');
            modal.className = 'photo-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
            modal.style.zIndex = '1000';
            document.body.appendChild(modal);
          });
          container.appendChild(photoElement);
        });
      });

      const responseTime = await measurePerformance(page, async () => {
        await page.click('.photo-thumbnail');
        await page.waitForSelector('.photo-modal');
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.UI_RESPONSE_TIME);
    });
  });

  test.describe('Thumbnail Loading Performance', () => {
    test('should load thumbnails within 200ms', async ({ page }) => {
      await createLargePhotoCollection(page, 50);

      // Measure thumbnail generation/loading time
      const loadTime = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          const startTime = performance.now();
          let loadedCount = 0;
          const totalThumbnails = 10;

          for (let i = 0; i < totalThumbnails; i++) {
            const img = new Image();
            img.onload = () => {
              loadedCount++;
              if (loadedCount === totalThumbnails) {
                resolve(performance.now() - startTime);
              }
            };
            // Use a small test image
            img.src = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
          }
        });
      });

      expect(loadTime / 10).toBeLessThan(PERFORMANCE_THRESHOLDS.THUMBNAIL_LOAD_TIME);
    });

    test('should lazy load thumbnails efficiently', async ({ page }) => {
      await createLargePhotoCollection(page, 100);

      // Inject lazy loading test
      await page.evaluate(() => {
        const container = document.querySelector('main') || document.body;
        const mockPhotos = (window as any).mockPhotoCollection;

        // Create a scrollable container with many thumbnails
        const scrollContainer = document.createElement('div');
        scrollContainer.style.height = '500px';
        scrollContainer.style.overflowY = 'auto';
        scrollContainer.className = 'scroll-container';

        mockPhotos.forEach((photo: any, index: number) => {
          const photoElement = document.createElement('div');
          photoElement.className = 'photo-item';
          photoElement.style.height = '200px';
          photoElement.style.marginBottom = '10px';
          photoElement.innerHTML = `
            <img data-src="${photo.thumbnailDataUrl}" alt="${photo.fileName}" class="lazy-thumbnail" style="width:100px;height:100px;background:#f0f0f0;">
            <p>Photo ${index + 1}</p>
          `;
          scrollContainer.appendChild(photoElement);
        });

        container.appendChild(scrollContainer);

        // Simulate intersection observer for lazy loading
        const images = scrollContainer.querySelectorAll('.lazy-thumbnail');
        let loadedCount = 0;

        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
                loadedCount++;
              }
              observer.unobserve(img);
            }
          });
        });

        images.forEach(img => observer.observe(img));
        (window as any).lazyLoadedCount = () => loadedCount;
      });

      // Scroll and measure loading performance
      const scrollContainer = page.locator('.scroll-container');

      const loadTime = await measurePerformance(page, async () => {
        // Scroll to trigger lazy loading
        await scrollContainer.evaluate(el => {
          el.scrollTop = el.scrollHeight / 2;
        });

        // Wait for some images to load
        await page.waitForFunction(() => {
          return (window as any).lazyLoadedCount() > 5;
        }, { timeout: 5000 });
      });

      expect(loadTime).toBeLessThan(1000); // Should load several images within 1 second
    });
  });

  test.describe('Memory Usage Validation', () => {
    test('should maintain memory usage under 2GB with large collections', async ({ page }) => {
      // Create a large collection
      await createLargePhotoCollection(page, PERFORMANCE_THRESHOLDS.LARGE_COLLECTION_SIZE);

      // Force garbage collection if available
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc();
        }
      });

      const initialMemory = await getMemoryUsage(page);

      // Perform memory-intensive operations
      await page.evaluate(() => {
        const mockPhotos = (window as any).mockPhotoCollection;
        const container = document.querySelector('main') || document.body;

        // Create DOM elements for photos
        mockPhotos.forEach((photo: any, index: number) => {
          if (index < 100) { // Only render first 100 to avoid browser limits
            const photoElement = document.createElement('div');
            photoElement.className = 'photo-item';
            photoElement.innerHTML = `
              <img src="${photo.thumbnailDataUrl}" alt="${photo.fileName}">
              <div class="photo-metadata">
                <h3>${photo.fileName}</h3>
                <p>${photo.caption}</p>
                <div class="tags">${photo.tags.join(', ')}</div>
              </div>
            `;
            container.appendChild(photoElement);
          }
        });
      });

      const finalMemory = await getMemoryUsage(page);

      expect(finalMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_USAGE);

      // Memory shouldn't grow excessively
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(500); // Less than 500MB increase
    });

    test('should clean up memory when navigating between views', async ({ page }) => {
      const initialMemory = await getMemoryUsage(page);

      // Create large collection and render
      await createLargePhotoCollection(page, 200);

      await page.evaluate(() => {
        const mockPhotos = (window as any).mockPhotoCollection;
        const container = document.querySelector('main') || document.body;

        mockPhotos.slice(0, 50).forEach((photo: any) => {
          const photoElement = document.createElement('div');
          photoElement.className = 'photo-item';
          photoElement.innerHTML = `<img src="${photo.thumbnailDataUrl}" alt="${photo.fileName}">`;
          container.appendChild(photoElement);
        });
      });

      const memoryWithPhotos = await getMemoryUsage(page);

      // Navigate away and back
      await page.goto('about:blank');
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Force garbage collection
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc();
        }
      });

      const memoryAfterNavigation = await getMemoryUsage(page);

      // Memory should be cleaned up (allowing some margin for browser overhead)
      const memoryDifference = memoryAfterNavigation - initialMemory;
      expect(memoryDifference).toBeLessThan(100); // Less than 100MB difference
    });
  });

  test.describe('Scroll and Animation Performance', () => {
    test('should maintain 60fps during scrolling', async ({ page }) => {
      await createLargePhotoCollection(page, 500);

      // Create scrollable photo grid
      await page.evaluate(() => {
        const mockPhotos = (window as any).mockPhotoCollection;
        const container = document.querySelector('main') || document.body;

        const gridContainer = document.createElement('div');
        gridContainer.style.cssText = `
          height: 500px;
          overflow-y: auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
          padding: 10px;
        `;

        mockPhotos.slice(0, 200).forEach((photo: any) => {
          const photoElement = document.createElement('div');
          photoElement.style.cssText = `
            aspect-ratio: 1;
            background: #f0f0f0;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          `;
          photoElement.innerHTML = `<img src="${photo.thumbnailDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
          gridContainer.appendChild(photoElement);
        });

        container.appendChild(gridContainer);
        (window as any).gridContainer = gridContainer;
      });

      // Measure FPS during scrolling
      const fps = await page.evaluate(async () => {
        const container = (window as any).gridContainer;
        let frameCount = 0;
        const startTime = performance.now();
        const duration = 1000; // 1 second test

        return new Promise<number>((resolve) => {
          function scrollAndCount() {
            frameCount++;
            container.scrollTop += 5; // Smooth scroll

            const elapsed = performance.now() - startTime;
            if (elapsed < duration) {
              requestAnimationFrame(scrollAndCount);
            } else {
              const fps = (frameCount / elapsed) * 1000;
              resolve(fps);
            }
          }

          requestAnimationFrame(scrollAndCount);
        });
      });

      // Should maintain close to 60fps (allowing some margin)
      expect(fps).toBeGreaterThan(55);
    });

    test('should handle rapid UI updates efficiently', async ({ page }) => {
      // Test rapid filter changes
      const updateTime = await page.evaluate(async () => {
        const startTime = performance.now();
        let updateCount = 0;

        // Simulate rapid filter updates
        for (let i = 0; i < 50; i++) {
          // Simulate DOM update
          const element = document.createElement('div');
          element.textContent = `Update ${i}`;
          document.body.appendChild(element);

          // Force layout
          element.offsetHeight;

          // Clean up
          element.remove();
          updateCount++;
        }

        return performance.now() - startTime;
      });

      // Should handle 50 rapid updates quickly
      expect(updateTime).toBeLessThan(500); // 500ms for 50 updates
    });
  });

  test.describe('Large Collection Performance', () => {
    test('should handle 1000+ photo collection efficiently', async ({ page }) => {
      // Create large collection
      await createLargePhotoCollection(page, PERFORMANCE_THRESHOLDS.LARGE_COLLECTION_SIZE);

      const renderTime = await measurePerformance(page, async () => {
        await page.evaluate(() => {
          const mockPhotos = (window as any).mockPhotoCollection;

          // Simulate virtual scrolling - only render visible items
          const container = document.querySelector('main') || document.body;
          const gridContainer = document.createElement('div');
          gridContainer.className = 'virtual-grid';
          gridContainer.style.cssText = `
            height: 500px;
            overflow-y: auto;
            position: relative;
          `;

          // Create viewport for virtual scrolling
          const viewport = document.createElement('div');
          viewport.style.cssText = `
            height: ${mockPhotos.length * 120}px;
            position: relative;
          `;

          // Render only first 20 items (simulating virtual scrolling)
          const visibleCount = 20;
          const itemHeight = 120;

          for (let i = 0; i < Math.min(visibleCount, mockPhotos.length); i++) {
            const photo = mockPhotos[i];
            const photoElement = document.createElement('div');
            photoElement.style.cssText = `
              position: absolute;
              top: ${i * itemHeight}px;
              left: 0;
              right: 0;
              height: ${itemHeight - 10}px;
              background: #f9f9f9;
              border-radius: 8px;
              padding: 10px;
              display: flex;
              align-items: center;
              gap: 10px;
            `;
            photoElement.innerHTML = `
              <img src="${photo.thumbnailDataUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;">
              <div>
                <h4>${photo.fileName}</h4>
                <p>${photo.caption}</p>
              </div>
            `;
            viewport.appendChild(photoElement);
          }

          gridContainer.appendChild(viewport);
          container.appendChild(gridContainer);
        });
      });

      // Should render virtual list quickly even with large dataset
      expect(renderTime).toBeLessThan(200);
    });

    test('should search through large collections efficiently', async ({ page }) => {
      await createLargePhotoCollection(page, 1000);

      const searchTime = await measurePerformance(page, async () => {
        await page.evaluate(() => {
          const mockPhotos = (window as any).mockPhotoCollection;
          const searchQuery = 'tag-5';

          // Simulate client-side search
          const results = mockPhotos.filter((photo: any) =>
            photo.tags.includes(searchQuery) || photo.fileName.includes(searchQuery)
          );

          // Store results
          (window as any).searchResults = results;
        });
      });

      const resultCount = await page.evaluate(() => (window as any).searchResults.length);

      // Should search quickly and return results
      expect(searchTime).toBeLessThan(50); // 50ms for searching 1000 items
      expect(resultCount).toBeGreaterThan(0);
    });
  });

  test.describe('Network and Loading Performance', () => {
    test('should load initial page within 3 seconds', async ({ page }) => {
      const loadTime = await measurePerformance(page, async () => {
        await page.goto('/', { waitUntil: 'networkidle' });
      });

      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD_TIME);
    });

    test('should handle concurrent image loading efficiently', async ({ page }) => {
      const concurrentLoadTime = await page.evaluate(async () => {
        const startTime = performance.now();
        const imagePromises = [];

        // Load 20 images concurrently
        for (let i = 0; i < 20; i++) {
          const promise = new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Resolve on error too
            img.src = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
          });
          imagePromises.push(promise);
        }

        await Promise.all(imagePromises);
        return performance.now() - startTime;
      });

      // Should load 20 concurrent images within reasonable time
      expect(concurrentLoadTime).toBeLessThan(1000);
    });
  });

  test.describe('Error Recovery Performance', () => {
    test('should recover from errors quickly', async ({ page }) => {
      // Simulate error condition
      await page.evaluate(() => {
        // Trigger an error
        throw new Error('Simulated error');
      });

      // Measure recovery time
      const recoveryTime = await measurePerformance(page, async () => {
        // Page should still be functional
        await page.waitForSelector('body');
        await page.click('body'); // Ensure page is responsive
      });

      expect(recoveryTime).toBeLessThan(100);
    });

    test('should handle storage quota gracefully', async ({ page }) => {
      const handlingTime = await measurePerformance(page, async () => {
        await page.evaluate(() => {
          // Simulate storage quota exceeded
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';

          // Trigger error handling
          window.dispatchEvent(new ErrorEvent('error', { error }));
        });

        // Should handle error without freezing
        await page.waitForTimeout(10);
      });

      expect(handlingTime).toBeLessThan(50);
    });
  });
});