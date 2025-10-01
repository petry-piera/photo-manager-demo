/**
 * AppShell component - Main application layout and navigation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HomePage } from '@/pages/HomePage/HomePage';
import { AlbumView } from '@/pages/AlbumView/AlbumView';
import { ResponsiveUtils, FocusManager, KeyboardUtils } from '@/utils/dom-utils';
import { storageService } from '@/services/StorageService';
import type { AppSettings } from '@/models/AppSettings';
import { DEFAULT_SETTINGS } from '@/models/AppSettings';

/**
 * Application view types
 */
type AppView = 'home' | 'album' | 'settings';

/**
 * Navigation item
 */
interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  view: AppView;
  shortcut?: string;
}

/**
 * Application theme
 */
type AppTheme = 'light' | 'dark' | 'auto';

/**
 * Error boundary state
 */
interface ErrorState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * AppShell props
 */
export interface AppShellProps {
  initialView?: AppView;
  initialAlbumId?: string;
  className?: string;
}

/**
 * Settings panel component
 */
const SettingsPanel: React.FC<{
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onClose: () => void;
}> = ({ settings, onSettingsChange, onClose }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSettingChange = useCallback((key: keyof AppSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange({ [key]: value });
  }, [localSettings, onSettingsChange]);

  const handleThemeChange = useCallback((theme: AppTheme) => {
    handleSettingChange('theme', theme);

    // Apply theme immediately
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }, [handleSettingChange]);

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary close-btn"
          title="Close settings"
        >
          ✕
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Appearance</h3>

          <div className="setting-group">
            <label className="setting-label">Theme:</label>
            <div className="theme-selector">
              <button
                type="button"
                className={`theme-btn ${localSettings.theme === 'light' ? 'active' : ''}`}
                onClick={() => handleThemeChange('light')}
              >
                ☀️ Light
              </button>
              <button
                type="button"
                className={`theme-btn ${localSettings.theme === 'dark' ? 'active' : ''}`}
                onClick={() => handleThemeChange('dark')}
              >
                🌙 Dark
              </button>
              <button
                type="button"
                className={`theme-btn ${localSettings.theme === 'auto' ? 'active' : ''}`}
                onClick={() => handleThemeChange('auto')}
              >
                🔄 Auto
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={localSettings.enableAnimations}
                onChange={(e) => handleSettingChange('enableAnimations', e.target.checked)}
              />
              Enable animations
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={localSettings.reduceMotion}
                onChange={(e) => handleSettingChange('reduceMotion', e.target.checked)}
              />
              Reduce motion (accessibility)
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>Performance</h3>

          <div className="setting-group">
            <label className="setting-label">
              Thumbnail size:
              <select
                value={localSettings.defaultThumbnailSize}
                onChange={(e) => handleSettingChange('defaultThumbnailSize', e.target.value)}
                className="setting-select"
              >
                <option value="compact">Compact (120px)</option>
                <option value="normal">Normal (180px)</option>
                <option value="large">Large (240px)</option>
              </select>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Photos per page:
              <input
                type="number"
                min="20"
                max="200"
                step="20"
                value={localSettings.photosPerPage}
                onChange={(e) => handleSettingChange('photosPerPage', parseInt(e.target.value))}
                className="setting-input"
              />
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={localSettings.enableVirtualScrolling}
                onChange={(e) => handleSettingChange('enableVirtualScrolling', e.target.checked)}
              />
              Virtual scrolling (for large collections)
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>Import</h3>

          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={localSettings.autoCreateDateAlbums}
                onChange={(e) => handleSettingChange('autoCreateDateAlbums', e.target.checked)}
              />
              Auto-create date albums
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={localSettings.preserveOriginalFiles}
                onChange={(e) => handleSettingChange('preserveOriginalFiles', e.target.checked)}
              />
              Preserve original files
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Duplicate handling:
              <select
                value={localSettings.duplicateHandling}
                onChange={(e) => handleSettingChange('duplicateHandling', e.target.value)}
                className="setting-select"
              >
                <option value="skip">Skip duplicates</option>
                <option value="rename">Rename duplicates</option>
                <option value="replace">Replace duplicates</option>
                <option value="ask">Ask each time</option>
              </select>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>Storage</h3>

          <div className="setting-group">
            <div className="storage-info">
              <p>
                <strong>Used:</strong> {/* Storage usage would be calculated */}
                Loading...
              </p>
              <p>
                <strong>Available:</strong> {/* Available storage would be calculated */}
                Loading...
              </p>
            </div>
          </div>

          <div className="setting-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                // TODO: Implement database cleanup
                console.log('Cleaning up database...');
              }}
            >
              🧹 Clean Up Database
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3>Data</h3>

          <div className="setting-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                // TODO: Implement export functionality
                console.log('Exporting data...');
              }}
            >
              📤 Export Data
            </button>
          </div>

          <div className="setting-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                // TODO: Implement import functionality
                console.log('Importing data...');
              }}
            >
              📥 Import Data
            </button>
          </div>

          <div className="setting-group">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                const confirmed = window.confirm(
                  'Are you sure you want to reset all data? This action cannot be undone.'
                );
                if (confirmed) {
                  // TODO: Implement data reset
                  console.log('Resetting all data...');
                }
              }}
            >
              🗑️ Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Error boundary component
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: React.ErrorInfo) => void },
  ErrorState
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error, errorInfo: React.ErrorInfo) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error:', error, errorInfo);
    this.setState({ error, errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h1>Something went wrong</h1>
            <p>We're sorry, but something unexpected happened.</p>

            <details className="error-details">
              <summary>Technical Details</summary>
              <pre className="error-stack">
                {this.state.error?.stack}
              </pre>
            </details>

            <div className="error-actions">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Reload Application
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="btn btn-secondary"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Main navigation component
 */
const MainNavigation: React.FC<{
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  isMobile: boolean;
  onMenuToggle?: () => void;
}> = ({ currentView, onNavigate, isMobile, onMenuToggle }) => {
  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: '🏠',
      view: 'home',
      shortcut: 'H'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      view: 'settings',
      shortcut: 'S'
    }
  ];

  return (
    <nav className="main-navigation" role="navigation" aria-label="Main navigation">
      <div className="nav-brand">
        <h1 className="app-title">📷 PhotoManager</h1>
        {isMobile && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="menu-toggle"
            aria-label="Toggle navigation menu"
          >
            ☰
          </button>
        )}
      </div>

      <ul className="nav-items">
        {navigationItems.map(item => (
          <li key={item.id} className="nav-item">
            <button
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`nav-link ${currentView === item.view ? 'active' : ''}`}
              title={`${item.label} ${item.shortcut ? `(${item.shortcut})` : ''}`}
              aria-current={currentView === item.view ? 'page' : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

/**
 * AppShell component
 */
export const AppShell: React.FC<AppShellProps> = ({
  initialView = 'home',
  initialAlbumId,
  className = ''
}) => {
  const [currentView, setCurrentView] = useState<AppView>(initialView);
  const [currentAlbumId, setCurrentAlbumId] = useState<string | undefined>(initialAlbumId);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    ...DEFAULT_SETTINGS,
    theme: 'auto' // Override with auto theme
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mainRef = useRef<HTMLElement>(null);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  // Check if mobile and handle responsive behavior
  useEffect(() => {
    const updateMobile = () => {
      setIsMobile(ResponsiveUtils.isMobile());
    };

    updateMobile();
    const cleanup = ResponsiveUtils.onBreakpointChange(updateMobile);
    return cleanup;
  }, []);

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        // TODO: Load settings from storage service
        // const userSettings = await storageService.getSettings();
        // setSettings({ ...settings, ...userSettings });

        // Apply theme
        const theme = settings.theme === 'auto'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          : settings.theme;
        document.documentElement.setAttribute('data-theme', theme);

        // Apply accessibility preferences
        if (settings.reduceMotion) {
          document.documentElement.style.setProperty('--animation-duration', '0s');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError('Failed to load user settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Handle shortcuts
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'h':
            e.preventDefault();
            handleNavigate('home');
            break;
          case 's':
            e.preventDefault();
            handleNavigate('settings');
            break;
        }
      }

      // Handle escape key
      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
        } else if (showMobileMenu) {
          setShowMobileMenu(false);
        } else if (currentView === 'album') {
          handleNavigate('home');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentView, showSettings, showMobileMenu]);

  // Handle navigation
  const handleNavigate = useCallback((view: AppView, albumId?: string) => {
    setCurrentView(view);
    setCurrentAlbumId(albumId);
    setShowSettings(view === 'settings');
    setShowMobileMenu(false);

    // Update URL without page reload (if using router)
    const url = view === 'album' && albumId ? `/album/${albumId}` : `/${view}`;
    window.history.pushState({ view, albumId }, '', url);

    // Focus main content for screen readers
    if (mainRef.current) {
      mainRef.current.focus();
    }
  }, []);

  // Handle album navigation from home page
  const handleAlbumClick = useCallback((albumId: string) => {
    handleNavigate('album', albumId);
  }, [handleNavigate]);

  // Handle back navigation from album view
  const handleBackToHome = useCallback(() => {
    handleNavigate('home');
  }, [handleNavigate]);

  // Handle settings changes
  const handleSettingsChange = useCallback(async (newSettings: Partial<AppSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    try {
      // TODO: Save settings to storage service
      // await storageService.saveSettings(updatedSettings);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    }
  }, [settings]);

  // Handle application errors
  const handleApplicationError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Application error:', error, errorInfo);
    setError(`Application error: ${error.message}`);
  }, []);

  // Skip to main content (accessibility)
  const handleSkipToMain = useCallback(() => {
    if (mainRef.current) {
      mainRef.current.focus();
    }
  }, []);

  // Render main content based on current view
  const renderMainContent = () => {
    if (loading) {
      return (
        <div className="app-loading">
          <div className="loading-spinner" />
          <p>Loading PhotoManager...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'home':
        return (
          <HomePage
            onAlbumClick={handleAlbumClick}
          />
        );

      case 'album':
        return currentAlbumId ? (
          <AlbumView
            albumId={currentAlbumId}
            onNavigateBack={handleBackToHome}
          />
        ) : (
          <div className="error-view">
            <h2>Album not found</h2>
            <p>The requested album could not be loaded.</p>
            <button
              type="button"
              onClick={handleBackToHome}
              className="btn btn-primary"
            >
              Back to Home
            </button>
          </div>
        );

      case 'settings':
        return (
          <SettingsPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onClose={() => handleNavigate('home')}
          />
        );

      default:
        return (
          <div className="error-view">
            <h2>Page not found</h2>
            <p>The requested page could not be found.</p>
            <button
              type="button"
              onClick={() => handleNavigate('home')}
              className="btn btn-primary"
            >
              Back to Home
            </button>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="app-shell loading">
        <div className="app-loading">
          <div className="loading-spinner" />
          <p>Initializing PhotoManager...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleApplicationError}>
      <div className={`app-shell ${className} ${isMobile ? 'mobile' : 'desktop'}`}>
        {/* Skip link for accessibility */}
        <a
          ref={skipLinkRef}
          href="#main-content"
          className="skip-link"
          onClick={(e) => {
            e.preventDefault();
            handleSkipToMain();
          }}
        >
          Skip to main content
        </a>

        {/* Global error banner */}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="error-dismiss"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header with navigation */}
        <header className="app-header">
          <MainNavigation
            currentView={currentView}
            onNavigate={handleNavigate}
            isMobile={isMobile}
            onMenuToggle={() => setShowMobileMenu(!showMobileMenu)}
          />
        </header>

        {/* Mobile menu overlay */}
        {isMobile && showMobileMenu && (
          <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
            <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
              <MainNavigation
                currentView={currentView}
                onNavigate={handleNavigate}
                isMobile={isMobile}
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <main
          ref={mainRef}
          id="main-content"
          className="app-main"
          tabIndex={-1}
          role="main"
          aria-live="polite"
        >
          {renderMainContent()}
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-content">
            <span className="app-version">PhotoManager v1.0.0</span>
            <span className="footer-separator">•</span>
            <span className="privacy-note">All data stored locally</span>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
};

export default AppShell;