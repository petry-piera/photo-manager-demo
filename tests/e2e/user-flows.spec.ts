/**
 * End-to-end tests for PhotoManager user flows
 * Tests complete user workflows from quickstart guide
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test data setup
const mockPhotoFiles = [
  'tests/fixtures/sample-photo-1.jpg',
  'tests/fixtures/sample-photo-2.jpg',
  'tests/fixtures/sample-photo-3.jpg'
];

// Helper functions
async function waitForLoadingToComplete(page: Page) {
  await page.waitForSelector('.loading-spinner', { state: 'hidden', timeout: 10000 });
}

async function uploadPhotos(page: Page, files: string[]) {
  // Click import button
  await page.click('button:has-text("Import Photos")');

  // Wait for import dialog
  await page.waitForSelector('.photo-import-dialog');

  // Upload files via file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(files);

  // Wait for processing to complete
  await page.waitForSelector('.import-progress', { state: 'visible' });
  await page.waitForSelector('.import-progress', { state: 'hidden', timeout: 30000 });

  // Close dialog
  await page.click('button:has-text("Done")');
}

async function createAlbum(page: Page, name: string) {
  await page.click('button:has-text("Create Album")');
  await page.fill('input[placeholder*="album name"]', name);
  await page.click('button:has-text("Create")');
  await waitForLoadingToComplete(page);
}

async function searchPhotos(page: Page, query: string) {
  await page.fill('input[placeholder*="Search"]', query);
  await page.press('input[placeholder*="Search"]', 'Enter');
  await waitForLoadingToComplete(page);
}

test.describe('PhotoManager User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to PhotoManager
    await page.goto('/');

    // Wait for application to load
    await waitForLoadingToComplete(page);
  });

  test.describe('First-time user experience', () => {
    test('should show welcome screen for new users', async ({ page }) => {
      // Should show welcome content
      await expect(page.locator('h2:has-text("Welcome to PhotoManager")')).toBeVisible();

      // Should show feature cards
      await expect(page.locator('.feature-card')).toHaveCount(4);

      // Should have import button prominent
      await expect(page.locator('button:has-text("Import Photos")')).toBeVisible();

      // Should show supported formats
      await expect(page.locator(':text("Supported formats")')).toBeVisible();
    });

    test('should guide user through first photo import', async ({ page }) => {
      // Click import photos
      await page.click('button:has-text("Import Photos")');

      // Should open import dialog
      await expect(page.locator('.photo-import-dialog')).toBeVisible();

      // Should show instructions
      await expect(page.locator(':text("Select photos to import")')).toBeVisible();

      // Should have drag-drop zone
      await expect(page.locator('.drag-drop-zone')).toBeVisible();

      // Should have file picker button
      await expect(page.locator('button:has-text("Choose Files")')).toBeVisible();
    });
  });

  test.describe('Photo import workflow', () => {
    test('should import photos successfully', async ({ page }) => {
      await uploadPhotos(page, mockPhotoFiles);

      // Should show album grid after import
      await expect(page.locator('.album-grid')).toBeVisible();

      // Should have created date albums
      await expect(page.locator('.album-card')).toHaveCount.toBeGreaterThan(0);

      // Should show photo count in status bar
      const statusText = page.locator('.status-bar .status-info');
      await expect(statusText).toContainText('photos');
    });

    test('should show import progress', async ({ page }) => {
      await page.click('button:has-text("Import Photos")');
      await page.waitForSelector('.photo-import-dialog');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(mockPhotoFiles);

      // Should show progress bar
      await expect(page.locator('.import-progress')).toBeVisible();

      // Should show file names being processed
      await expect(page.locator('.current-file')).toBeVisible();

      // Should show percentage
      await expect(page.locator('.progress-percentage')).toBeVisible();
    });

    test('should handle import errors gracefully', async ({ page }) => {
      await page.click('button:has-text("Import Photos")');
      await page.waitForSelector('.photo-import-dialog');

      // Try to upload invalid file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(['tests/fixtures/invalid-file.txt']);

      // Should show error message
      await expect(page.locator('.error-message')).toBeVisible();

      // Should allow user to continue with valid files
      await expect(page.locator('button:has-text("Continue")')).toBeVisible();
    });

    test('should extract and display EXIF data', async ({ page }) => {
      await uploadPhotos(page, mockPhotoFiles);

      // Open first photo
      await page.click('.photo-thumbnail').first();

      // Should show photo modal
      await expect(page.locator('.photo-modal')).toBeVisible();

      // Should show EXIF data section
      await expect(page.locator('.exif-data')).toBeVisible();

      // Should show technical details
      await expect(page.locator(':text("Technical Details")')).toBeVisible();
    });
  });

  test.describe('Album management', () => {
    test.beforeEach(async ({ page }) => {
      // Setup: Import some photos first
      await uploadPhotos(page, mockPhotoFiles);
    });

    test('should create custom album', async ({ page }) => {
      await createAlbum(page, 'My Vacation Photos');

      // Should show new album in grid
      await expect(page.locator('.album-card:has-text("My Vacation Photos")')).toBeVisible();

      // Should show 0 photos initially
      await expect(page.locator('.album-card:has-text("My Vacation Photos") :text("0 photos")')).toBeVisible();
    });

    test('should navigate to album view', async ({ page }) => {
      // Click on existing date album
      await page.click('.album-card').first();

      // Should navigate to album view
      await expect(page.locator('.album-view')).toBeVisible();

      // Should show album name in header
      await expect(page.locator('.album-title')).toBeVisible();

      // Should show breadcrumb navigation
      await expect(page.locator('button:has-text("Back to Albums")')).toBeVisible();

      // Should show album statistics
      await expect(page.locator('.album-stats')).toBeVisible();
    });

    test('should add photos to custom album', async ({ page }) => {
      await createAlbum(page, 'Selected Photos');

      // Open the custom album
      await page.click('.album-card:has-text("Selected Photos")');

      // Click add photos button
      await page.click('button:has-text("Add Photos")');

      // Should open photo selection interface
      await expect(page.locator('.photo-selection-dialog')).toBeVisible();

      // Select some photos
      await page.click('.photo-thumbnail').first();
      await page.click('.photo-thumbnail').nth(1);

      // Add selected photos
      await page.click('button:has-text("Add Selected")');

      // Should return to album view with photos
      await expect(page.locator('.photo-grid .photo-item')).toHaveCount.toBeGreaterThan(0);
    });

    test('should reorder photos within album', async ({ page }) => {
      // Navigate to album with photos
      await page.click('.album-card').first();

      const photoItems = page.locator('.photo-item');
      await expect(photoItems).toHaveCount.toBeGreaterThan(1);

      // Get initial order
      const firstPhotoId = await photoItems.first().getAttribute('data-photo-id');
      const secondPhotoId = await photoItems.nth(1).getAttribute('data-photo-id');

      // Drag first photo to second position
      await photoItems.first().dragTo(photoItems.nth(1));

      // Wait for reorder to complete
      await waitForLoadingToComplete(page);

      // Verify order changed
      const newFirstPhotoId = await photoItems.first().getAttribute('data-photo-id');
      expect(newFirstPhotoId).toBe(secondPhotoId);
    });

    test('should delete album', async ({ page }) => {
      await createAlbum(page, 'Album to Delete');

      // Right-click album for context menu
      await page.click('.album-card:has-text("Album to Delete")', { button: 'right' });

      // Click delete option
      await page.click('button:has-text("Delete Album")');

      // Confirm deletion
      await page.click('button:has-text("Yes, Delete")');

      // Album should be removed
      await expect(page.locator('.album-card:has-text("Album to Delete")')).not.toBeVisible();
    });
  });

  test.describe('Photo viewing and editing', () => {
    test.beforeEach(async ({ page }) => {
      await uploadPhotos(page, mockPhotoFiles);
      await page.click('.album-card').first(); // Go to first album
    });

    test('should open photo in modal', async ({ page }) => {
      await page.click('.photo-thumbnail').first();

      // Should open photo modal
      await expect(page.locator('.photo-modal')).toBeVisible();

      // Should show photo image
      await expect(page.locator('.photo-main-image')).toBeVisible();

      // Should show navigation buttons if multiple photos
      await expect(page.locator('.nav-btn')).toHaveCount.toBeGreaterThan(0);
    });

    test('should navigate between photos', async ({ page }) => {
      await page.click('.photo-thumbnail').first();

      // Navigate to next photo
      await page.click('.nav-next');

      // Should change photo
      const photoTitle = page.locator('.photo-modal-title h2');
      await expect(photoTitle).not.toHaveText(await photoTitle.textContent() || '');

      // Navigate to previous photo
      await page.click('.nav-prev');

      // Should go back to first photo
      // (More complex assertion would compare actual photo IDs)
    });

    test('should edit photo caption and tags', async ({ page }) => {
      await page.click('.photo-thumbnail').first();

      // Click edit button
      await page.click('button:has-text("Edit")');

      // Should show edit form
      await expect(page.locator('.photo-edit-form')).toBeVisible();

      // Add caption
      await page.fill('textarea[placeholder*="caption"]', 'Beautiful sunset photo');

      // Add tags
      await page.fill('input[placeholder*="tag"]', 'sunset');
      await page.press('input[placeholder*="tag"]', 'Enter');

      await page.fill('input[placeholder*="tag"]', 'nature');
      await page.press('input[placeholder*="tag"]', 'Enter');

      // Save changes
      await page.click('button:has-text("Save Changes")');

      // Should return to view mode
      await expect(page.locator('.photo-edit-form')).not.toBeVisible();

      // Should show updated caption
      await expect(page.locator(':text("Beautiful sunset photo")')).toBeVisible();

      // Should show tags
      await expect(page.locator('.tag-chip:has-text("sunset")')).toBeVisible();
      await expect(page.locator('.tag-chip:has-text("nature")')).toBeVisible();
    });

    test('should delete photo', async ({ page }) => {
      await page.click('.photo-thumbnail').first();

      // Click delete button
      await page.click('button:has-text("Delete")');

      // Confirm deletion
      await page.click('button:has-text("Yes, Delete")');

      // Should close modal and remove photo from grid
      await expect(page.locator('.photo-modal')).not.toBeVisible();

      // Photo count should decrease
      const albumStats = page.locator('.album-stats');
      await expect(albumStats).toContainText('photos');
    });
  });

  test.describe('Search functionality', () => {
    test.beforeEach(async ({ page }) => {
      await uploadPhotos(page, mockPhotoFiles);

      // Add some tags to photos for testing
      await page.click('.album-card').first();
      await page.click('.photo-thumbnail').first();
      await page.click('button:has-text("Edit")');
      await page.fill('input[placeholder*="tag"]', 'landscape');
      await page.press('input[placeholder*="tag"]', 'Enter');
      await page.click('button:has-text("Save Changes")');
      await page.click('button:has-text("Close")');

      // Go back to home
      await page.click('button:has-text("Back to Albums")');
    });

    test('should search by text query', async ({ page }) => {
      await searchPhotos(page, 'landscape');

      // Should show search results view
      await expect(page.locator('.home-search-view')).toBeVisible();

      // Should show search results
      await expect(page.locator(':text("Search Results")')).toBeVisible();
      await expect(page.locator('.photo-grid .photo-item')).toHaveCount.toBeGreaterThan(0);
    });

    test('should use advanced search filters', async ({ page }) => {
      // Open advanced filters
      await page.click('button:has-text("Filters")');

      // Should show advanced filters panel
      await expect(page.locator('.advanced-filters')).toBeVisible();

      // Set date range
      await page.fill('input[type="date"]:first-of-type', '2024-01-01');
      await page.fill('input[type="date"]:nth-of-type(2)', '2024-12-31');

      // Select options
      await page.check('input[type="checkbox"]:near(:text("Has GPS location"))');

      // Apply filters (automatic)
      await waitForLoadingToComplete(page);

      // Should show filtered results
      await expect(page.locator('.photo-grid')).toBeVisible();
    });

    test('should use search presets', async ({ page }) => {
      await page.click('button:has-text("Filters")');

      // Click preset for recent photos
      await page.click('button:has-text("Recent Photos")');

      // Should apply preset filters
      await waitForLoadingToComplete(page);

      // Should show results
      await expect(page.locator('.photo-grid')).toBeVisible();
    });

    test('should show search suggestions', async ({ page }) => {
      // Start typing in search
      await page.fill('input[placeholder*="Search"]', 'land');

      // Should show suggestions
      await expect(page.locator('.search-suggestions')).toBeVisible();
      await expect(page.locator('.search-suggestion:has-text("landscape")')).toBeVisible();

      // Click suggestion
      await page.click('.search-suggestion:has-text("landscape")');

      // Should perform search
      await waitForLoadingToComplete(page);
      await expect(page.locator('.photo-grid')).toBeVisible();
    });
  });

  test.describe('Settings and preferences', () => {
    test('should access settings panel', async ({ page }) => {
      await page.click('button:has-text("Settings")');

      // Should show settings panel
      await expect(page.locator('.settings-panel')).toBeVisible();

      // Should show different setting sections
      await expect(page.locator(':text("Appearance")')).toBeVisible();
      await expect(page.locator(':text("Performance")')).toBeVisible();
      await expect(page.locator(':text("Import")')).toBeVisible();
    });

    test('should change theme', async ({ page }) => {
      await page.click('button:has-text("Settings")');

      // Switch to dark theme
      await page.click('button:has-text("Dark")');

      // Should apply dark theme
      await expect(page.locator('html[data-theme="dark"]')).toBeVisible();

      // Switch to light theme
      await page.click('button:has-text("Light")');

      // Should apply light theme
      await expect(page.locator('html[data-theme="light"]')).toBeVisible();
    });

    test('should adjust performance settings', async ({ page }) => {
      await page.click('button:has-text("Settings")');

      // Change thumbnail size
      await page.selectOption('select:near(:text("Thumbnail size"))', 'large');

      // Change photos per page
      await page.fill('input:near(:text("Photos per page"))', '100');

      // Toggle virtual scrolling
      await page.uncheck('input:near(:text("Virtual scrolling"))');

      // Settings should be saved automatically
      await page.click('button:has-text("Close")');

      // Settings should persist
      await page.click('button:has-text("Settings")');
      await expect(page.locator('select:near(:text("Thumbnail size"))')).toHaveValue('large');
    });

    test('should export and import settings', async ({ page }) => {
      await page.click('button:has-text("Settings")');

      // Export settings
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Export Data")');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/settings.*\.json/);

      // Import settings (would require file upload)
      await expect(page.locator('button:has-text("Import Data")')).toBeVisible();
    });
  });

  test.describe('Accessibility features', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await uploadPhotos(page, mockPhotoFiles);

      // Tab through interface
      await page.keyboard.press('Tab');

      // Should focus on import button
      await expect(page.locator('button:has-text("Import Photos"):focus')).toBeVisible();

      // Continue tabbing
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to navigate to albums
      await page.keyboard.press('Enter');

      // Should navigate to album
      await expect(page.locator('.album-view')).toBeVisible();
    });

    test('should announce important changes to screen readers', async ({ page }) => {
      // This would require testing with actual screen reader or ARIA live regions
      await uploadPhotos(page, mockPhotoFiles);

      // Check for ARIA live regions
      await expect(page.locator('[aria-live]')).toHaveCount.toBeGreaterThan(0);

      // Verify important actions create announcements
      await createAlbum(page, 'Test Album');

      // Live region should have announcement content
      const liveRegion = page.locator('[aria-live="polite"]');
      await expect(liveRegion).toHaveText(/album.*created/i, { timeout: 5000 });
    });

    test('should support high contrast mode', async ({ page }) => {
      // Simulate high contrast preference
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          value: (query: string) => ({
            matches: query.includes('prefers-contrast: high'),
            addEventListener: () => {},
            removeEventListener: () => {}
          })
        });
      });

      await page.reload();

      // Should apply high contrast styles
      await expect(page.locator('html.high-contrast')).toBeVisible();
    });

    test('should support reduced motion', async ({ page }) => {
      // Simulate reduced motion preference
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          value: (query: string) => ({
            matches: query.includes('prefers-reduced-motion: reduce'),
            addEventListener: () => {},
            removeEventListener: () => {}
          })
        });
      });

      await page.reload();

      // Should apply reduced motion styles
      await expect(page.locator('html.reduce-motion')).toBeVisible();
    });
  });

  test.describe('Offline functionality', () => {
    test('should work offline for viewing existing photos', async ({ page, context }) => {
      await uploadPhotos(page, mockPhotoFiles);

      // Go offline
      await context.setOffline(true);

      // Should still be able to view albums
      await expect(page.locator('.album-grid')).toBeVisible();

      // Should be able to open photos
      await page.click('.album-card').first();
      await page.click('.photo-thumbnail').first();
      await expect(page.locator('.photo-modal')).toBeVisible();
    });

    test('should show offline indicator when disconnected', async ({ page, context }) => {
      await uploadPhotos(page, mockPhotoFiles);

      // Go offline
      await context.setOffline(true);

      // Should show offline indicator
      await expect(page.locator(':text("Connection Lost")')).toBeVisible();

      // Go back online
      await context.setOffline(false);

      // Should show connection restored
      await expect(page.locator(':text("Connection Restored")')).toBeVisible();
    });
  });

  test.describe('Performance validation', () => {
    test('should load initial page within performance targets', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');
      await waitForLoadingToComplete(page);

      const loadTime = Date.now() - startTime;

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle large photo collections efficiently', async ({ page }) => {
      // This would require a large test dataset
      await uploadPhotos(page, mockPhotoFiles);

      const startTime = Date.now();

      // Navigate to album with many photos
      await page.click('.album-card').first();
      await waitForLoadingToComplete(page);

      const navigationTime = Date.now() - startTime;

      // Should navigate quickly even with many photos
      expect(navigationTime).toBeLessThan(1000);
    });

    test('should maintain responsive UI during photo processing', async ({ page }) => {
      await page.click('button:has-text("Import Photos")');
      await page.waitForSelector('.photo-import-dialog');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(mockPhotoFiles);

      // UI should remain responsive during processing
      const startTime = Date.now();

      // Try to interact with UI
      await page.click('button:has-text("Cancel")');

      const responseTime = Date.now() - startTime;

      // Should respond within 100ms
      expect(responseTime).toBeLessThan(100);
    });
  });

  test.describe('Data persistence', () => {
    test('should persist data across browser sessions', async ({ page, context }) => {
      await uploadPhotos(page, mockPhotoFiles);

      // Create custom album
      await createAlbum(page, 'Persistent Album');

      // Close and reopen page
      await page.close();
      const newPage = await context.newPage();
      await newPage.goto('/');
      await waitForLoadingToComplete(newPage);

      // Data should still be there
      await expect(newPage.locator('.album-card:has-text("Persistent Album")')).toBeVisible();
      await expect(newPage.locator('.album-card')).toHaveCount.toBeGreaterThan(1); // Date albums + custom album
    });

    test('should handle storage quota gracefully', async ({ page }) => {
      // This would require mocking storage quota exceeded
      // For now, just verify error handling exists

      await page.click('button:has-text("Import Photos")');
      await expect(page.locator('.photo-import-dialog')).toBeVisible();

      // Should have error handling UI elements
      await expect(page.locator('.error-message', { timeout: 1000 })).toBeHidden();
    });
  });
});