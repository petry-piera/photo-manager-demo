/**
 * PhotoManager Application Entry Point
 */

import './styles/globals.css';

// Initialize the application
async function initializeApp(): Promise<void> {
  try {
    // Initialize database
    const { db } = await import('./services/DatabaseService');
    await db.initialize();

    console.log('✅ PhotoManager database initialized');

    // Show application interface
    showAppInterface();

    // Load settings and apply theme
    await loadAndApplySettings();

  } catch (error) {
    console.error('❌ Failed to initialize PhotoManager:', error);
    showErrorState(error instanceof Error ? error.message : 'Unknown initialization error');
  }
}

/**
 * Show basic application interface
 */
function showAppInterface(): void {
  const appContainer = document.getElementById('app');
  const loadingState = document.getElementById('loading-state');

  if (!appContainer) {
    throw new Error('App container not found');
  }

  // Remove loading state
  if (loadingState) {
    loadingState.remove();
  }

  // Create main application structure
  appContainer.innerHTML = `
    <div class="app-shell">
      <!-- Header -->
      <header class="app-header">
        <div class="header-content">
          <h1 class="app-title">PhotoManager</h1>
          <div class="header-actions">
            <button id="import-btn" class="btn btn-primary">
              📁 Import Photos
            </button>
            <button id="settings-btn" class="btn btn-secondary">
              ⚙️ Settings
            </button>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main id="main-content" class="main-content">
        <div class="welcome-section">
          <div class="welcome-content">
            <h2>Welcome to PhotoManager</h2>
            <p>Your personal photo collection organizer - local, fast, and private.</p>

            <div class="features-grid">
              <div class="feature-card">
                <div class="feature-icon">📸</div>
                <h3>Auto Organization</h3>
                <p>Photos automatically organized by date from EXIF metadata</p>
              </div>

              <div class="feature-card">
                <div class="feature-icon">🏷️</div>
                <h3>Smart Tagging</h3>
                <p>Tag and caption your photos for easy searching</p>
              </div>

              <div class="feature-card">
                <div class="feature-icon">🔒</div>
                <h3>Privacy First</h3>
                <p>All data stays on your device - no cloud uploads</p>
              </div>

              <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <h3>Fast Performance</h3>
                <p>Handle thousands of photos efficiently</p>
              </div>
            </div>

            <div class="getting-started">
              <h3>Getting Started</h3>
              <p>Click "Import Photos" to begin organizing your photo collection.</p>
              <div class="supported-formats">
                <strong>Supported formats:</strong> JPEG, PNG, WebP, HEIC
              </div>
            </div>
          </div>
        </div>

        <!-- Album Grid (will be populated when photos are imported) -->
        <div id="album-grid" class="album-grid" style="display: none;">
          <h2>Your Albums</h2>
          <div id="albums-container" class="albums-container">
            <!-- Albums will be rendered here -->
          </div>
        </div>
      </main>

      <!-- Status Bar -->
      <footer class="status-bar">
        <div class="status-info">
          <span id="status-text">Ready</span>
        </div>
        <div class="storage-info">
          <span id="storage-usage">Storage: 0 MB used</span>
        </div>
      </footer>
    </div>
  `;

  // Add event listeners
  setupEventListeners();
}

/**
 * Setup event listeners for UI interactions
 */
function setupEventListeners(): void {
  const importBtn = document.getElementById('import-btn');
  const settingsBtn = document.getElementById('settings-btn');

  if (importBtn) {
    importBtn.addEventListener('click', handleImportPhotos);
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', handleOpenSettings);
  }

  // Listen for drag and drop
  setupDragAndDrop();
}

/**
 * Handle photo import button click
 */
async function handleImportPhotos(): Promise<void> {
  try {
    updateStatus('Preparing to import photos...');

    // Check browser support
    if (!('showOpenFilePicker' in window)) {
      alert('File System Access API not supported. Please use drag and drop or a modern browser.');
      return;
    }

    // Request file selection
    const fileHandles = await (window as any).showOpenFilePicker({
      multiple: true,
      types: [{
        description: 'Images',
        accept: {
          'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic']
        }
      }]
    });

    if (fileHandles.length === 0) {
      updateStatus('Ready');
      return;
    }

    // Convert file handles to files
    const files: File[] = [];
    for (const handle of fileHandles) {
      const file = await handle.getFile();
      files.push(file);
    }

    updateStatus(`Processing ${files.length} files...`);

    // Import photos using PhotoService
    const { photoService } = await import('./services/PhotoService');
    await photoService.initialize();

    const result = await photoService.importPhotos(files, {
      batchSize: 3,
      generateThumbnails: true,
      extractFullExif: true,
      autoCreateAlbums: true,
      duplicateHandling: 'rename',
      onProgress: (progress) => {
        updateStatus(`Processing ${progress.currentFileName} (${progress.current}/${progress.total})`);
      }
    });

    if (result.errors.length > 0) {
      console.warn('Import errors:', result.errors);
      updateStatus(`Imported ${result.imported.length} photos with ${result.errors.length} errors`);
    } else {
      updateStatus(`Successfully imported ${result.imported.length} photos!`);
    }

    // Refresh album grid with new photos
    await refreshAlbumGrid();
    await updateStorageInfo();

  } catch (error) {
    console.error('Import error:', error);
    updateStatus('Import failed');

    if (error instanceof Error && error.name === 'AbortError') {
      updateStatus('Import cancelled');
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to import photos: ${errorMessage}`);
    }
  }
}

/**
 * Handle settings button click
 */
function handleOpenSettings(): void {
  // TODO: Open settings modal (not implemented yet)
  alert('Settings panel coming soon!');
}

/**
 * Setup drag and drop functionality
 */
function setupDragAndDrop(): void {
  const mainContent = document.getElementById('main-content');

  if (!mainContent) return;

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    mainContent.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    mainContent.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    mainContent.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files
  mainContent.addEventListener('drop', handleDrop, false);

  function preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight(): void {
    mainContent?.classList.add('drag-over');
  }

  function unhighlight(): void {
    mainContent?.classList.remove('drag-over');
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    const files = Array.from(e.dataTransfer?.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please drop image files only.');
      return;
    }

    updateStatus(`Processing ${imageFiles.length} dropped files...`);

    try {
      // Import dropped photos using PhotoService
      const { photoService } = await import('./services/PhotoService');
      await photoService.initialize();

      const result = await photoService.importPhotos(imageFiles, {
        batchSize: 3,
        generateThumbnails: true,
        extractFullExif: true,
        autoCreateAlbums: true,
        duplicateHandling: 'rename',
        onProgress: (progress) => {
          updateStatus(`Processing ${progress.currentFileName} (${progress.current}/${progress.total})`);
        }
      });

      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
        updateStatus(`Imported ${result.imported.length} photos with ${result.errors.length} errors`);
      } else {
        updateStatus(`Successfully imported ${result.imported.length} photos!`);
      }

      // Refresh album grid and storage info
      await refreshAlbumGrid();
      await updateStorageInfo();

    } catch (error) {
      console.error('Drop import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateStatus(`Import failed: ${errorMessage}`);
    }
  }
}

/**
 * Load and apply application settings
 */
async function loadAndApplySettings(): Promise<void> {
  try {
    const { db } = await import('./services/DatabaseService');
    const settings = await db.appSettings.get('main');

    if (settings) {
      // Apply theme
      applyTheme(settings.theme);
      updateStorageInfo();
    }
  } catch (error) {
    console.warn('Failed to load settings:', error);
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement;

  if (theme === 'system') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

/**
 * Update storage usage information
 */
async function updateStorageInfo(): Promise<void> {
  try {
    const { db } = await import('./services/DatabaseService');
    const stats = await db.getUsageStats();

    const storageElement = document.getElementById('storage-usage');
    if (storageElement) {
      const sizeMB = (stats.estimatedSize / (1024 * 1024)).toFixed(1);
      storageElement.textContent = `Storage: ${sizeMB} MB used • ${stats.photosCount} photos • ${stats.albumsCount} albums`;
    }
  } catch (error) {
    console.warn('Failed to update storage info:', error);
  }
}

/**
 * Refresh album grid with current albums
 */
async function refreshAlbumGrid(): Promise<void> {
  try {
    const { albumService } = await import('./services/AlbumService');
    await albumService.initialize();

    const albums = await albumService.getAllAlbums();
    const albumGrid = document.getElementById('album-grid');
    const albumsContainer = document.getElementById('albums-container');

    if (!albumGrid || !albumsContainer) return;

    if (albums.length === 0) {
      albumGrid.style.display = 'none';
      return;
    }

    // Show album grid
    albumGrid.style.display = 'block';

    // Clear existing albums
    albumsContainer.innerHTML = '';

    // Render albums
    for (const album of albums) {
      const albumElement = document.createElement('div');
      albumElement.className = 'album-card';
      albumElement.style.cssText = `
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        box-shadow: var(--box-shadow);
        cursor: pointer;
        transition: transform var(--transition-fast);
        text-align: center;
      `;

      // Get cover photo for thumbnail
      let thumbnailHtml = '<div style="width: 150px; height: 150px; background: var(--color-background); border-radius: var(--border-radius); display: flex; align-items: center; justify-content: center; font-size: 3rem; margin: 0 auto var(--spacing-md);">📸</div>';

      try {
        const coverPhoto = await albumService.getAlbumCover(album.id);
        if (coverPhoto?.thumbnailDataUrl) {
          thumbnailHtml = `<img src="${coverPhoto.thumbnailDataUrl}" alt="${album.name}" style="width: 150px; height: 150px; object-fit: cover; border-radius: var(--border-radius); margin: 0 auto var(--spacing-md); display: block;">`;
        }
      } catch (error) {
        console.warn('Failed to load album cover:', error);
      }

      albumElement.innerHTML = `
        ${thumbnailHtml}
        <h3 style="margin: 0 0 var(--spacing-sm); color: var(--color-text); font-size: var(--font-size-lg);">${album.name}</h3>
        <p style="margin: 0; color: var(--color-text-secondary); font-size: var(--font-size-sm);">${album.photoCount} photos</p>
      `;

      // Add hover effect
      albumElement.addEventListener('mouseenter', () => {
        albumElement.style.transform = 'translateY(-2px)';
        albumElement.style.boxShadow = 'var(--box-shadow-lg)';
      });

      albumElement.addEventListener('mouseleave', () => {
        albumElement.style.transform = 'none';
        albumElement.style.boxShadow = 'var(--box-shadow)';
      });

      albumElement.addEventListener('click', () => {
        // TODO: Open album view
        alert(`Opening album: ${album.name} (${album.photoCount} photos)`);
      });

      albumsContainer.appendChild(albumElement);
    }

  } catch (error) {
    console.warn('Failed to refresh album grid:', error);
  }
}

/**
 * Update status text
 */
function updateStatus(message: string): void {
  const statusElement = document.getElementById('status-text');
  if (statusElement) {
    statusElement.textContent = message;
  }

  // Auto-clear status after 5 seconds
  setTimeout(() => {
    if (statusElement && statusElement.textContent === message) {
      statusElement.textContent = 'Ready';
    }
  }, 5000);
}

/**
 * Show error state
 */
function showErrorState(message: string): void {
  const appContainer = document.getElementById('app');

  if (appContainer) {
    appContainer.innerHTML = `
      <div class="error-state">
        <div class="error-content">
          <h1>⚠️ PhotoManager Error</h1>
          <p>Failed to initialize the application:</p>
          <div class="error-message">${message}</div>
          <button onclick="location.reload()" class="btn btn-primary">
            🔄 Retry
          </button>
        </div>
      </div>
    `;
  }
}

/**
 * Handle keyboard shortcuts
 */
document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Ctrl/Cmd + O for import
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    handleImportPhotos();
  }

  // Ctrl/Cmd + , for settings
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault();
    handleOpenSettings();
  }
});

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}