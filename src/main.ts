/**
 * PhotoManager Application Entry Point
 * Initializes services, database, and mounts the React application
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from '@/components/AppShell/AppShell';
import { DragDropProvider } from '@/components/DragDrop/DragDropProvider';
import { storageService } from '@/services/StorageService';
import { photoService } from '@/services/PhotoService';
import { albumService } from '@/services/AlbumService';
import './styles/globals.css';

/**
 * Performance monitoring interface
 */
interface PerformanceMetrics {
  navigationStart: number;
  loadStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
}

/**
 * Application initialization state
 */
interface InitState {
  storageReady: boolean;
  servicesReady: boolean;
  error?: Error;
}

/**
 * Global error handler for unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  logError('unhandled_promise_rejection', event.reason);
  event.preventDefault();
});

/**
 * Global error handler for JavaScript errors
 */
window.addEventListener('error', (event) => {
  console.error('Global JavaScript error:', event.error);
  logError('javascript_error', event.error);
});

/**
 * Service worker registration
 */
async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully:', registration);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New app version available');
                if (window.confirm('A new version of PhotoManager is available. Reload to update?')) {
                  window.location.reload();
                }
              } else {
                console.log('App is ready for offline use');
              }
            }
          });
        }
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}

/**
 * Performance metrics collection
 */
function collectPerformanceMetrics(): PerformanceMetrics {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');

  const metrics: PerformanceMetrics = {
    navigationStart: navigation.navigationStart,
    loadStart: navigation.loadEventStart,
    domContentLoaded: navigation.domContentLoadedEventEnd,
    loadComplete: navigation.loadEventEnd
  };

  for (const entry of paint) {
    if (entry.name === 'first-paint') {
      metrics.firstPaint = entry.startTime;
    } else if (entry.name === 'first-contentful-paint') {
      metrics.firstContentfulPaint = entry.startTime;
    }
  }

  return metrics;
}

/**
 * Error logging function
 */
function logError(type: string, error: any): void {
  try {
    const errorLog = {
      type,
      message: error?.message || String(error),
      stack: error?.stack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    const storedErrors = localStorage.getItem('photoManager_errors');
    const allErrors = storedErrors ? JSON.parse(storedErrors) : [];

    allErrors.push(errorLog);

    if (allErrors.length > 20) {
      allErrors.splice(0, allErrors.length - 20);
    }

    localStorage.setItem('photoManager_errors', JSON.stringify(allErrors));
  } catch (storageError) {
    console.warn('Failed to store error log:', storageError);
  }
}

/**
 * Initialize database and services
 */
async function initializeServices(): Promise<InitState> {
  const state: InitState = {
    storageReady: false,
    servicesReady: false
  };

  try {
    console.log('🚀 Initializing PhotoManager...');

    // Initialize storage service first
    console.log('📦 Initializing storage service...');
    await storageService.initialize();
    state.storageReady = true;
    console.log('✅ Storage service ready');

    // Initialize other services
    console.log('🔧 Initializing photo and album services...');

    // Services should be ready immediately as they depend on storage service
    await Promise.all([
      photoService.initialize?.(),
      albumService.initialize?.()
    ].filter(Boolean));

    state.servicesReady = true;
    console.log('✅ All services ready');

    return state;
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    state.error = error instanceof Error ? error : new Error(String(error));
    return state;
  }
}

/**
 * Initialize application theme
 */
function initializeTheme(): void {
  const savedTheme = localStorage.getItem('photoManager_theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let theme: string;
  if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
    theme = savedTheme;
  } else {
    theme = 'auto';
  }

  if (theme === 'auto') {
    theme = systemPrefersDark ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', theme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentTheme = localStorage.getItem('photoManager_theme');
    if (!currentTheme || currentTheme === 'auto') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Initialize accessibility features
 */
function initializeAccessibility(): void {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    document.documentElement.classList.add('reduce-motion');
  }

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (e.matches) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  });

  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  if (prefersHighContrast) {
    document.documentElement.classList.add('high-contrast');
  }
}

/**
 * Parse URL parameters to determine initial route
 */
function parseInitialRoute(): { view: 'home' | 'album' | 'settings'; albumId?: string } {
  const path = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  if (path.startsWith('/album/')) {
    const albumId = path.split('/album/')[1];
    return { view: 'album', albumId };
  } else if (path === '/settings') {
    return { view: 'settings' };
  }

  const view = searchParams.get('view');
  const albumId = searchParams.get('album');

  if (view === 'album' && albumId) {
    return { view: 'album', albumId };
  } else if (view === 'settings') {
    return { view: 'settings' };
  }

  return { view: 'home' };
}

/**
 * Mount React application
 */
function mountApplication(initState: InitState): void {
  const container = document.getElementById('app') || document.getElementById('root');
  if (!container) {
    throw new Error('Root container not found');
  }

  const root = createRoot(container);
  const initialRoute = parseInitialRoute();

  const App = React.createElement(DragDropProvider, null,
    React.createElement(AppShell, {
      initialView: initialRoute.view,
      initialAlbumId: initialRoute.albumId
    })
  );

  root.render(App);

  console.log('✅ PhotoManager application mounted successfully');
}

// Initialize the application
async function initializeApp(): Promise<void> {
  try {
    // Initialize theme and accessibility before anything else
    initializeTheme();
    initializeAccessibility();

    // Initialize services
    const initState = await initializeServices();

    if (initState.error) {
      throw initState.error;
    }

    // Register service worker for offline support
    await registerServiceWorker();

    // Mount React application
    mountApplication(initState);

    // Collect and log performance metrics after load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const metrics = collectPerformanceMetrics();
        console.group('📊 Performance Metrics');
        console.log('DOM Content Loaded:', metrics.domContentLoaded - metrics.navigationStart, 'ms');
        console.log('Load Complete:', metrics.loadComplete - metrics.navigationStart, 'ms');
        if (metrics.firstPaint) console.log('First Paint:', metrics.firstPaint, 'ms');
        if (metrics.firstContentfulPaint) console.log('First Contentful Paint:', metrics.firstContentfulPaint, 'ms');
        console.groupEnd();
      }, 100);
    });

    console.log('🎉 PhotoManager initialization complete');

  } catch (error) {
    console.error('💥 Application initialization failed:', error);
    logError('initialization_error', error);

    const errorInstance = error instanceof Error ? error : new Error(String(error));
    showErrorState(errorInstance.message);
  }
}

/**
 * Show error state
 */
function showErrorState(message: string): void {
  const container = document.getElementById('app') || document.getElementById('root');
  if (container) {
    container.innerHTML = `
      <div class="app-error-screen">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <h1>Failed to Start PhotoManager</h1>
          <p class="error-message">${message}</p>
          <div class="error-actions">
            <button onclick="window.location.reload()" class="btn btn-primary">
              Reload Application
            </button>
            <button onclick="localStorage.clear(); window.location.reload()" class="btn btn-secondary">
              Reset Data & Reload
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Make development debugging easier
if (import.meta.env.DEV) {
  (window as any).photoManagerDebug = {
    storageService,
    photoService,
    albumService,
    getPerformanceMetrics: () => {
      const stored = localStorage.getItem('photoManager_performance');
      return stored ? JSON.parse(stored) : [];
    },
    getErrorLogs: () => {
      const stored = localStorage.getItem('photoManager_errors');
      return stored ? JSON.parse(stored) : [];
    },
    clearData: () => {
      localStorage.clear();
      indexedDB.deleteDatabase('PhotoManagerDB');
      console.log('All application data cleared');
    }
  };

  console.log('🛠️ Development mode - Debug tools available at window.photoManagerDebug');
}