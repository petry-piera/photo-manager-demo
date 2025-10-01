/**
 * AlbumView component - Individual album page
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PhotoGrid, type PhotoGridConfig } from '@/components/PhotoGrid/PhotoGrid';
import { PhotoModal } from '@/components/PhotoView/PhotoModal';
import { PhotoImportDialog } from '@/components/PhotoImport/PhotoImportDialog';
import { albumService } from '@/services/AlbumService';
import { photoService, type PhotoImportResult } from '@/services/PhotoService';
import { ResponsiveUtils } from '@/utils/dom-utils';
import type { Album } from '@/models/Album';
import type { Photo } from '@/models/Photo';

/**
 * Album view modes
 */
type AlbumViewMode = 'grid' | 'masonry' | 'list';
type AlbumGridSize = 'compact' | 'normal' | 'large';

/**
 * Album view props
 */
export interface AlbumViewProps {
  albumId: string;
  onNavigateBack?: () => void;
  onNavigateToPhoto?: (photoId: string) => void;
  className?: string;
}

/**
 * Album statistics component
 */
const AlbumStats: React.FC<{ album: Album; photos: Photo[] }> = ({ album, photos }) => {
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const getDateRange = useCallback(() => {
    if (photos.length === 0) return null;

    const dates = photos
      .map(p => p.dateTaken || p.dateAdded)
      .sort((a, b) => a.getTime() - b.getTime());

    const earliest = dates[0];
    const latest = dates[dates.length - 1];

    if (earliest.toDateString() === latest.toDateString()) {
      return formatDate(earliest);
    }

    return `${formatDate(earliest)} - ${formatDate(latest)}`;
  }, [photos, formatDate]);

  const getTotalSize = useCallback(() => {
    const totalBytes = photos.reduce((sum, photo) => sum + (photo.fileSize || 0), 0);

    if (totalBytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = totalBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }, [photos]);

  const dateRange = getDateRange();
  const totalSize = getTotalSize();

  return (
    <div className="album-stats">
      <div className="stat-item">
        <span className="stat-label">Photos:</span>
        <span className="stat-value">{album.photoCount}</span>
      </div>

      {dateRange && (
        <div className="stat-item">
          <span className="stat-label">Date Range:</span>
          <span className="stat-value">{dateRange}</span>
        </div>
      )}

      <div className="stat-item">
        <span className="stat-label">Total Size:</span>
        <span className="stat-value">{totalSize}</span>
      </div>

      <div className="stat-item">
        <span className="stat-label">Created:</span>
        <span className="stat-value">{formatDate(album.dateCreated)}</span>
      </div>
    </div>
  );
};

/**
 * Album toolbar component
 */
const AlbumToolbar: React.FC<{
  album: Album;
  viewMode: AlbumViewMode;
  gridSize: AlbumGridSize;
  selectedPhotos: Photo[];
  onViewModeChange: (mode: AlbumViewMode) => void;
  onGridSizeChange: (size: AlbumGridSize) => void;
  onAddPhotos: () => void;
  onDeleteSelected: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onEditAlbum: () => void;
  isMobile: boolean;
}> = ({
  album,
  viewMode,
  gridSize,
  selectedPhotos,
  onViewModeChange,
  onGridSizeChange,
  onAddPhotos,
  onDeleteSelected,
  onSelectAll,
  onClearSelection,
  onEditAlbum,
  isMobile
}) => {
  const hasSelection = selectedPhotos.length > 0;

  return (
    <div className="album-toolbar">
      <div className="toolbar-section">
        <div className="view-controls">
          {!isMobile && (
            <>
              <div className="view-mode-selector">
                <button
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => onViewModeChange('grid')}
                  title="Grid view"
                  type="button"
                >
                  ⊞
                </button>
                <button
                  className={`view-btn ${viewMode === 'masonry' ? 'active' : ''}`}
                  onClick={() => onViewModeChange('masonry')}
                  title="Masonry view"
                  type="button"
                >
                  ⊟
                </button>
                <button
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => onViewModeChange('list')}
                  title="List view"
                  type="button"
                >
                  ☰
                </button>
              </div>

              <div className="size-selector">
                <button
                  className={`size-btn ${gridSize === 'compact' ? 'active' : ''}`}
                  onClick={() => onGridSizeChange('compact')}
                  title="Compact"
                  type="button"
                >
                  S
                </button>
                <button
                  className={`size-btn ${gridSize === 'normal' ? 'active' : ''}`}
                  onClick={() => onGridSizeChange('normal')}
                  title="Normal"
                  type="button"
                >
                  M
                </button>
                <button
                  className={`size-btn ${gridSize === 'large' ? 'active' : ''}`}
                  onClick={() => onGridSizeChange('large')}
                  title="Large"
                  type="button"
                >
                  L
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="toolbar-section">
        <div className="selection-info">
          {hasSelection && (
            <>
              <span className="selection-count">
                {selectedPhotos.length} selected
              </span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={onClearSelection}
                type="button"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div className="toolbar-section">
        <div className="action-buttons">
          {hasSelection ? (
            <>
              <button
                className="btn btn-danger"
                onClick={onDeleteSelected}
                type="button"
              >
                🗑️ Delete ({selectedPhotos.length})
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={onSelectAll}
                type="button"
              >
                Select All
              </button>
              <button
                className="btn btn-secondary"
                onClick={onEditAlbum}
                type="button"
              >
                ✏️ {isMobile ? '' : 'Edit Album'}
              </button>
              <button
                className="btn btn-primary"
                onClick={onAddPhotos}
                type="button"
              >
                📷 {isMobile ? '' : 'Add Photos'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * AlbumView component
 */
export const AlbumView: React.FC<AlbumViewProps> = ({
  albumId,
  onNavigateBack,
  onNavigateToPhoto,
  className = ''
}) => {
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [viewMode, setViewMode] = useState<AlbumViewMode>('grid');
  const [gridSize, setGridSize] = useState<AlbumGridSize>('normal');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile
  useEffect(() => {
    const updateMobile = () => {
      setIsMobile(ResponsiveUtils.isMobile());
    };

    updateMobile();
    const cleanup = ResponsiveUtils.onBreakpointChange(updateMobile);
    return cleanup;
  }, []);

  // Load album and photos
  useEffect(() => {
    const loadAlbumData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [albumData, photosData] = await Promise.all([
          albumService.getAlbum(albumId),
          albumService.getPhotosInAlbum(albumId)
        ]);

        setAlbum(albumData);
        setPhotos(photosData);
      } catch (err) {
        console.error('Failed to load album data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load album');
      } finally {
        setLoading(false);
      }
    };

    loadAlbumData();
  }, [albumId]);

  // Photo grid configuration
  const photoGridConfig: PhotoGridConfig = useMemo(() => ({
    viewMode,
    size: gridSize,
    enableMultiSelect: true,
    enableDragDrop: true,
    lazyLoading: true,
    showMetadata: viewMode === 'list',
    columns: isMobile ? 2 : undefined,
    minColumnWidth: isMobile ? 120 : undefined
  }), [viewMode, gridSize, isMobile]);

  // Handle photo click
  const handlePhotoClick = useCallback((photo: Photo) => {
    const index = photos.findIndex(p => p.id === photo.id);
    setCurrentPhotoIndex(index);
    setShowPhotoModal(true);
    onNavigateToPhoto?.(photo.id);
  }, [photos, onNavigateToPhoto]);

  // Handle photo selection
  const handlePhotoSelect = useCallback((selected: Photo[]) => {
    setSelectedPhotos(selected);
  }, []);

  // Handle photo navigation in modal
  const handlePhotoNext = useCallback(() => {
    if (currentPhotoIndex < photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  }, [currentPhotoIndex, photos.length]);

  const handlePhotoPrevious = useCallback(() => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  }, [currentPhotoIndex]);

  // Handle photo update
  const handlePhotoUpdate = useCallback((updatedPhoto: Photo) => {
    setPhotos(prev => prev.map(photo =>
      photo.id === updatedPhoto.id ? updatedPhoto : photo
    ));
  }, []);

  // Handle photo delete
  const handlePhotoDelete = useCallback((deletedPhoto: Photo) => {
    setPhotos(prev => prev.filter(photo => photo.id !== deletedPhoto.id));
    setShowPhotoModal(false);
  }, []);

  // Handle selected photos delete
  const handleDeleteSelected = useCallback(async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedPhotos.length} photo(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      for (const photo of selectedPhotos) {
        await photoService.deletePhoto(photo.id);
      }

      setPhotos(prev => prev.filter(photo =>
        !selectedPhotos.some(selected => selected.id === photo.id)
      ));
      setSelectedPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photos');
    } finally {
      setLoading(false);
    }
  }, [selectedPhotos]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    setSelectedPhotos([...photos]);
  }, [photos]);

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedPhotos([]);
  }, []);

  // Handle album edit
  const handleEditAlbum = useCallback(async () => {
    if (!album) return;

    const newName = prompt('Enter new album name:', album.name);
    if (!newName?.trim() || newName === album.name) return;

    try {
      setLoading(true);
      const updatedAlbum = await albumService.updateAlbum(album.id, {
        name: newName.trim()
      });
      setAlbum(updatedAlbum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update album');
    } finally {
      setLoading(false);
    }
  }, [album]);

  // Handle photo import
  const handleImportComplete = useCallback((result: PhotoImportResult) => {
    console.log('Import completed:', result);
    setShowImportDialog(false);

    if (result.summary.imported > 0) {
      // Refresh photos
      albumService.getPhotosInAlbum(albumId)
        .then(setPhotos)
        .catch(console.error);
    }
  }, [albumId]);

  // Render loading state
  if (loading && !album) {
    return (
      <div className={`album-view loading ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading album...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !album) {
    return (
      <div className={`album-view error ${className}`}>
        <div className="error-container">
          <h2>Error Loading Album</h2>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={onNavigateBack}
            type="button"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!album) return null;

  return (
    <div className={`album-view ${className}`}>
      {/* Header */}
      <div className="album-header">
        <div className="album-breadcrumb">
          <button
            className="breadcrumb-btn"
            onClick={onNavigateBack}
            type="button"
          >
            ← Back to Albums
          </button>
        </div>

        <div className="album-title-section">
          <h1 className="album-title">{album.name}</h1>
          <div className="album-type-badge">
            {album.type === 'date' ? '📅 Date Album' : '📁 Custom Album'}
          </div>
        </div>

        <AlbumStats album={album} photos={photos} />
      </div>

      {/* Error banner */}
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

      {/* Toolbar */}
      {album && (
        <AlbumToolbar
          album={album}
          viewMode={viewMode}
          gridSize={gridSize}
          selectedPhotos={selectedPhotos}
          onViewModeChange={setViewMode}
          onGridSizeChange={setGridSize}
          onAddPhotos={() => setShowImportDialog(true)}
          onDeleteSelected={handleDeleteSelected}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onEditAlbum={handleEditAlbum}
          isMobile={isMobile}
        />
      )}

      {/* Photo grid */}
      <div className="album-content">
        <PhotoGrid
          albumId={albumId}
          config={photoGridConfig}
          selectedPhotos={selectedPhotos}
          onPhotoClick={handlePhotoClick}
          onPhotoSelect={handlePhotoSelect}
        />
      </div>

      {/* Photo modal */}
      <PhotoModal
        photo={photos[currentPhotoIndex]}
        albumId={albumId}
        photos={photos}
        currentIndex={currentPhotoIndex}
        open={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onNext={handlePhotoNext}
        onPrevious={handlePhotoPrevious}
        onPhotoUpdate={handlePhotoUpdate}
        onPhotoDelete={handlePhotoDelete}
      />

      {/* Import dialog */}
      <PhotoImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Please wait...</p>
        </div>
      )}
    </div>
  );
};

export default AlbumView;