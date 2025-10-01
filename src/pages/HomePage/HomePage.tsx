/**
 * HomePage component - Main application page
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AlbumGrid } from '@/components/AlbumGrid/AlbumGrid';
import { SearchBar, type SearchFilters } from '@/components/Search/SearchBar';
import { PhotoImportDialog } from '@/components/PhotoImport/PhotoImportDialog';
import { PhotoGrid } from '@/components/PhotoGrid/PhotoGrid';
import { albumService } from '@/services/AlbumService';
import { photoService, type PhotoImportResult } from '@/services/PhotoService';
import { ResponsiveUtils } from '@/utils/dom-utils';
import type { Album } from '@/models/Album';
import type { Photo } from '@/models/Photo';

/**
 * Home page view modes
 */
type HomeViewMode = 'albums' | 'search' | 'recent';

/**
 * HomePage component
 */
export const HomePage: React.FC = () => {
  const [viewMode, setViewMode] = useState<HomeViewMode>('albums');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedAlbums, setSelectedAlbums] = useState<Album[]>([]);
  const [searchResults, setSearchResults] = useState<Photo[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const updateMobile = () => {
      setIsMobile(ResponsiveUtils.isMobile());
    };

    updateMobile();
    const cleanup = ResponsiveUtils.onBreakpointChange(updateMobile);
    return cleanup;
  }, []);

  // Load recent photos
  useEffect(() => {
    const loadRecentPhotos = async () => {
      try {
        const photos = await photoService.searchPhotos({
          sortBy: 'dateAdded',
          sortOrder: 'desc',
          limit: 20
        });
        setRecentPhotos(photos);
      } catch (err) {
        console.error('Failed to load recent photos:', err);
      }
    };

    loadRecentPhotos();
  }, []);

  // Handle album selection
  const handleAlbumClick = useCallback((album: Album) => {
    // Navigate to album view (this would typically use a router)
    console.log('Navigate to album:', album.id);
  }, []);

  // Handle album creation
  const handleAlbumCreate = useCallback(async () => {
    const albumName = prompt('Enter album name:');
    if (!albumName?.trim()) return;

    try {
      setLoading(true);
      await albumService.createAlbum({
        name: albumName.trim(),
        type: 'custom'
      });

      // Refresh album grid by forcing a re-render
      // In a real app, this would be handled by state management
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create album');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle album deletion
  const handleAlbumDelete = useCallback(async (albums: Album[]) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${albums.length} album(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      for (const album of albums) {
        await albumService.deleteAlbum(album.id);
      }

      // Refresh album grid
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete albums');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle album edit
  const handleAlbumEdit = useCallback(async (album: Album) => {
    const newName = prompt('Enter new album name:', album.name);
    if (!newName?.trim() || newName === album.name) return;

    try {
      setLoading(true);
      await albumService.updateAlbum(album.id, {
        name: newName.trim()
      });

      // Refresh album grid
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update album');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback((results: Photo[]) => {
    setSearchResults(results);
    if (results.length > 0) {
      setViewMode('search');
    }
  }, []);

  // Handle search filters change
  const handleSearchFiltersChange = useCallback((filters: SearchFilters) => {
    setSearchFilters(filters);
  }, []);

  // Handle photo import
  const handleImportComplete = useCallback((result: PhotoImportResult) => {
    console.log('Import completed:', result);
    setShowImportDialog(false);

    // Show detailed result message
    if (result.summary.imported > 0) {
      console.log('Photos imported successfully:', result.imported);
      alert(`Successfully imported ${result.summary.imported} photos!${result.summary.errors > 0 ? ` (${result.summary.errors} errors)` : ''}`);

      // Instead of full page reload, try to refresh data
      setRecentPhotos([]);
      setViewMode('albums');

      // Reload recent photos
      const loadRecentPhotos = async () => {
        try {
          const photos = await photoService.searchPhotos({
            sortBy: 'dateAdded',
            sortOrder: 'desc',
            limit: 20
          });
          setRecentPhotos(photos);
          console.log('Loaded recent photos after import:', photos);
        } catch (err) {
          console.error('Failed to reload recent photos after import:', err);
        }
      };

      loadRecentPhotos();
    } else if (result.summary.errors > 0) {
      console.error('Import errors:', result.errors);
      alert(`Import failed: ${result.errors.map(e => e.error.message).join(', ')}`);
    } else {
      console.warn('No photos were imported');
      alert('No photos were imported. Please check the file formats and try again.');
    }
  }, []);

  // Handle photo click
  const handlePhotoClick = useCallback((photo: Photo) => {
    console.log('Photo clicked:', photo.id);
    // Open photo modal or navigate to photo view
  }, []);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: HomeViewMode) => {
    setViewMode(mode);
  }, []);

  // Render main content based on view mode
  const renderMainContent = () => {
    switch (viewMode) {
      case 'albums':
        return (
          <div className="home-albums-view">
            <div className="section-header">
              <h2>Photo Albums</h2>
              <div className="section-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleAlbumCreate}
                  disabled={loading}
                  type="button"
                >
                  📁 Create Album
                </button>
              </div>
            </div>

            <AlbumGrid
              config={{
                columns: isMobile ? 2 : undefined,
                minColumnWidth: isMobile ? 150 : 200,
                enableMultiSelect: !isMobile,
                enableDragDrop: !isMobile
              }}
              selectedAlbums={selectedAlbums}
              onAlbumClick={handleAlbumClick}
              onAlbumSelect={setSelectedAlbums}
              onAlbumCreate={handleAlbumCreate}
              onAlbumDelete={handleAlbumDelete}
              onAlbumEdit={handleAlbumEdit}
            />
          </div>
        );

      case 'search':
        return (
          <div className="home-search-view">
            <div className="section-header">
              <h2>Search Results</h2>
              <p>{searchResults.length} photos found</p>
            </div>

            <PhotoGrid
              config={{
                viewMode: 'grid',
                size: isMobile ? 'compact' : 'normal',
                enableMultiSelect: !isMobile,
                enableDragDrop: false
              }}
              filters={searchFilters}
              onPhotoClick={handlePhotoClick}
            />
          </div>
        );

      case 'recent':
        return (
          <div className="home-recent-view">
            <div className="section-header">
              <h2>Recent Photos</h2>
              <p>{recentPhotos.length} recent photos</p>
            </div>

            <PhotoGrid
              config={{
                viewMode: 'grid',
                size: isMobile ? 'compact' : 'normal',
                enableMultiSelect: !isMobile,
                enableDragDrop: false
              }}
              onPhotoClick={handlePhotoClick}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Render welcome state for empty collection
  const renderWelcomeState = () => (
    <div className="welcome-section">
      <div className="welcome-content">
        <h2>Welcome to PhotoManager</h2>
        <p>Organize and manage your photo collection with ease.</p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📁</div>
            <h3>Smart Albums</h3>
            <p>Automatically organize photos by date or create custom albums.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Powerful Search</h3>
            <p>Find photos instantly by tags, dates, or metadata.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🏷️</div>
            <h3>Smart Tagging</h3>
            <p>Tag and categorize photos with automatic suggestions.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Responsive Design</h3>
            <p>Access your photos on any device, anywhere.</p>
          </div>
        </div>

        <div className="getting-started">
          <h3>Get Started</h3>
          <p>Import your first photos to begin organizing your collection.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowImportDialog(true)}
              type="button"
            >
              📷 Import Photos
            </button>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  const photos = await photoService.searchPhotos({});
                  const albums = await albumService.getAlbums();
                  console.log('Debug - All photos:', photos);
                  console.log('Debug - All albums:', albums);
                  alert(`Database contains: ${photos.length} photos, ${albums.length} albums`);
                } catch (error) {
                  console.error('Debug error:', error);
                  alert(`Debug error: ${error}`);
                }
              }}
              type="button"
            >
              🔍 Debug DB
            </button>
          </div>

          <div className="supported-formats">
            <strong>Supported formats:</strong> JPEG, PNG, WebP, HEIC, TIFF
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="home-page">
      {/* Header */}
      <div className="home-header">
        <div className="header-content">
          <h1 className="app-title">PhotoManager</h1>

          <div className="header-actions">
            <SearchBar
              filters={searchFilters}
              onFiltersChange={handleSearchFiltersChange}
              onSearch={handleSearch}
              showAdvancedFilters={!isMobile}
              enableSuggestions={true}
            />

            <button
              className="btn btn-primary"
              onClick={() => setShowImportDialog(true)}
              type="button"
            >
              {isMobile ? '📷' : '📷 Import'}
            </button>
          </div>
        </div>

        {/* View mode tabs */}
        <div className="view-mode-tabs">
          <button
            className={`tab-button ${viewMode === 'albums' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('albums')}
            type="button"
          >
            📁 Albums
          </button>
          <button
            className={`tab-button ${viewMode === 'recent' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('recent')}
            type="button"
          >
            🕒 Recent
          </button>
          {searchResults.length > 0 && (
            <button
              className={`tab-button ${viewMode === 'search' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('search')}
              type="button"
            >
              🔍 Search ({searchResults.length})
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>Error: {error}</span>
            <button
              onClick={() => setError(null)}
              className="error-dismiss"
              type="button"
            >
              ✕
            </button>
          </div>
        )}

        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <p>Loading...</p>
          </div>
        )}

        {/* Show welcome state if no photos and albums, otherwise show main content */}
        {viewMode === 'albums' && recentPhotos.length === 0 ? (
          renderWelcomeState()
        ) : (
          renderMainContent()
        )}
      </main>

      {/* Import dialog */}
      <PhotoImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Status bar */}
      <div className="status-bar">
        <span className="status-info">
          {viewMode === 'albums' ? 'Albums View' :
           viewMode === 'search' ? `${searchResults.length} search results` :
           `${recentPhotos.length} recent photos`}
        </span>
        <span className="storage-info">
          {/* Storage info would be populated from storage service */}
          Ready
        </span>
      </div>
    </div>
  );
};

export default HomePage;