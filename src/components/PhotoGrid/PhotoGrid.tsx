/**
 * PhotoGrid component for displaying and managing photos
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GridLayout, type GridItem } from '@/components/common/GridLayout';
import { SortableContainer, useDragDrop } from '@/components/DragDrop/DragDropProvider';
import { photoService, type PhotoSearchOptions } from '@/services/PhotoService';
import { ProgressiveImageLoader, LazyImageLoader } from '@/utils/image-utils';
import type { Photo } from '@/models/Photo';
import '../../styles/components/photo-grid.css';

/**
 * Photo display modes
 */
export type PhotoViewMode = 'grid' | 'masonry' | 'list';

/**
 * Photo grid layout sizes
 */
export type PhotoGridSize = 'compact' | 'normal' | 'large';

/**
 * Photo sort options
 */
export type PhotoSortBy = 'dateTaken' | 'dateAdded' | 'fileName' | 'fileSize';
export type PhotoSortOrder = 'asc' | 'desc';

/**
 * Photo filters
 */
export interface PhotoFilters {
  albumIds?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchText?: string;
  fileTypes?: string[];
}

/**
 * Photo grid configuration
 */
export interface PhotoGridConfig {
  viewMode?: PhotoViewMode;
  size?: PhotoGridSize;
  columns?: number;
  minColumnWidth?: number;
  maxColumnWidth?: number;
  gap?: number;
  aspectRatio?: number;
  showMetadata?: boolean;
  showActions?: boolean;
  enableDragDrop?: boolean;
  enableMultiSelect?: boolean;
  enableVirtualScrolling?: boolean;
  lazyLoading?: boolean;
}

/**
 * Photo grid props
 */
export interface PhotoGridProps {
  albumId?: string;
  config?: PhotoGridConfig;
  filters?: PhotoFilters;
  sortBy?: PhotoSortBy;
  sortOrder?: PhotoSortOrder;
  selectedPhotos?: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  onPhotoDoubleClick?: (photo: Photo) => void;
  onPhotoSelect?: (photos: Photo[]) => void;
  onPhotoDelete?: (photos: Photo[]) => void;
  onPhotoReorder?: (moves: Array<{ photoId: string; fromIndex: number; toIndex: number }>) => void;
  onPhotoEdit?: (photo: Photo) => void;
  className?: string;
}

/**
 * Photo item props
 */
interface PhotoItemProps {
  photo: Photo;
  viewMode: PhotoViewMode;
  size: PhotoGridSize;
  selected?: boolean;
  showMetadata?: boolean;
  showActions?: boolean;
  lazyLoading?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Photo item component
 */
const PhotoItem: React.FC<PhotoItemProps> = ({
  photo,
  viewMode,
  size,
  selected = false,
  showMetadata = true,
  showActions = true,
  lazyLoading = true,
  onClick,
  onDoubleClick,
  onEdit,
  onDelete
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [progressiveLoader, setProgressiveLoader] = useState<ProgressiveImageLoader | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Create progressive loader when image element is available
  useEffect(() => {
    if (imageRef.current && !progressiveLoader) {
      setProgressiveLoader(new ProgressiveImageLoader(imageRef.current));
    }
  }, [progressiveLoader]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const getDimensions = useCallback(() => {
    if (photo.width && photo.height) {
      return `${photo.width} × ${photo.height}`;
    }
    return null;
  }, [photo.width, photo.height]);

  // Render image with progressive loading
  const renderImage = useCallback(() => {
    if (imageError) {
      return (
        <div className="photo-image error">
          🖼️
        </div>
      );
    }

    return (
      <img
        ref={imageRef}
        className={`photo-image ${imageLoaded ? 'loaded' : 'loading'}`}
        src={photo.thumbnailDataUrl || ''}
        alt={photo.fileName}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={lazyLoading ? 'lazy' : 'eager'}
        draggable={false}
      />
    );
  }, [photo.thumbnailDataUrl, photo.fileName, imageLoaded, imageError, lazyLoading, handleImageLoad, handleImageError]);

  // Render metadata
  const renderMetadata = useCallback(() => {
    if (!showMetadata) return null;

    const displayDate = photo.dateTaken || photo.dateAdded;

    if (viewMode === 'list') {
      return (
        <div className="photo-info list-info">
          <div className="photo-name">{photo.fileName}</div>
          <div className="photo-meta">
            <span className="photo-date">📅 {formatDate(displayDate)}</span>
            {photo.fileSize && (
              <span className="photo-size">💾 {formatFileSize(photo.fileSize)}</span>
            )}
            {getDimensions() && (
              <span className="photo-dimensions">📐 {getDimensions()}</span>
            )}
            {photo.tags.length > 0 && (
              <span className="photo-tags">🏷️ {photo.tags.slice(0, 3).join(', ')}</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="photo-overlay">
        <div className="photo-info">
          <div className="photo-name">{photo.fileName}</div>
          <div className="photo-meta">
            <span className="photo-date">📅 {formatDate(displayDate)}</span>
            {photo.fileSize && (
              <span className="photo-size">💾 {formatFileSize(photo.fileSize)}</span>
            )}
            {getDimensions() && (
              <span className="photo-dimensions">📐 {getDimensions()}</span>
            )}
          </div>
        </div>
      </div>
    );
  }, [showMetadata, viewMode, photo, formatDate, formatFileSize, getDimensions]);

  const itemClassName = `photo-item ${viewMode}-item ${size} ${selected ? 'selected' : ''}`;

  return (
    <div
      className={itemClassName}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {renderImage()}
      {renderMetadata()}

      {showActions && viewMode !== 'list' && (
        <div className="photo-actions">
          <button
            className="photo-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            title="Edit photo"
            type="button"
          >
            ✏️
          </button>
          <button
            className="photo-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            title="Delete photo"
            type="button"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Photo grid skeleton loader
 */
const PhotoGridSkeleton: React.FC<{
  count?: number;
  viewMode?: PhotoViewMode;
  size?: PhotoGridSize;
}> = ({
  count = 12,
  viewMode = 'grid',
  size = 'normal'
}) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`photo-skeleton ${viewMode}-skeleton ${size}`}>
          <div className="photo-skeleton-content" />
        </div>
      ))}
    </>
  );
};

/**
 * PhotoGrid component
 */
export const PhotoGrid: React.FC<PhotoGridProps> = ({
  albumId,
  config = {},
  filters = {},
  sortBy = 'dateTaken',
  sortOrder = 'desc',
  selectedPhotos = [],
  onPhotoClick,
  onPhotoDoubleClick,
  onPhotoSelect,
  onPhotoDelete,
  onPhotoReorder,
  onPhotoEdit,
  className = ''
}) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDragging } = useDragDrop();

  const {
    viewMode = 'grid',
    size = 'normal',
    columns,
    minColumnWidth = 150,
    maxColumnWidth = 300,
    gap = 8,
    aspectRatio = 1,
    showMetadata = true,
    showActions = true,
    enableDragDrop = true,
    enableMultiSelect = false,
    enableVirtualScrolling = false,
    lazyLoading = true
  } = config;

  // Calculate column width based on size
  const getColumnWidth = useCallback(() => {
    switch (size) {
      case 'compact':
        return { min: 100, max: 150 };
      case 'large':
        return { min: 250, max: 400 };
      default:
        return { min: minColumnWidth, max: maxColumnWidth };
    }
  }, [size, minColumnWidth, maxColumnWidth]);

  // Load photos
  const loadPhotos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let photoList: Photo[];

      if (albumId) {
        // Load photos from specific album
        photoList = await photoService.getPhotosInAlbum(albumId);
      } else {
        // Search photos with filters
        const searchOptions: PhotoSearchOptions = {
          query: filters.searchText,
          tags: filters.tags,
          albumIds: filters.albumIds,
          dateRange: filters.dateRange,
          sortBy,
          sortOrder
        };

        photoList = await photoService.searchPhotos(searchOptions);
      }

      setPhotos(photoList);
    } catch (err) {
      console.error('Failed to load photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [albumId, filters, sortBy, sortOrder]);

  // Load photos on mount and when dependencies change
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Convert photos to grid items
  const gridItems = useMemo((): GridItem[] => {
    return photos.map(photo => ({
      id: photo.id,
      data: photo,
      width: photo.width,
      height: photo.height,
      aspectRatio: photo.width && photo.height ? photo.width / photo.height : 1
    }));
  }, [photos]);

  // Handle photo selection
  const handlePhotoSelect = useCallback((selectedItems: GridItem[]) => {
    const selectedPhotoList = selectedItems.map(item => item.data as Photo);
    onPhotoSelect?.(selectedPhotoList);
  }, [onPhotoSelect]);

  // Handle photo click
  const handlePhotoClick = useCallback((photo: Photo) => {
    onPhotoClick?.(photo);
  }, [onPhotoClick]);

  // Handle photo double click
  const handlePhotoDoubleClick = useCallback((photo: Photo) => {
    onPhotoDoubleClick?.(photo);
  }, [onPhotoDoubleClick]);

  // Handle photo edit
  const handlePhotoEdit = useCallback((photo: Photo) => {
    onPhotoEdit?.(photo);
  }, [onPhotoEdit]);

  // Handle photo delete
  const handlePhotoDelete = useCallback((photo: Photo) => {
    onPhotoDelete?.([photo]);
  }, [onPhotoDelete]);

  // Handle drag and drop reordering
  const handleSortableUpdate = useCallback((event: any) => {
    if (!enableDragDrop || !onPhotoReorder) return;

    const { oldIndex, newIndex } = event;
    if (oldIndex === newIndex) return;

    const moves = [{
      photoId: photos[oldIndex].id,
      fromIndex: oldIndex,
      toIndex: newIndex
    }];

    onPhotoReorder(moves);
  }, [enableDragDrop, onPhotoReorder, photos]);

  // Render photo item
  const renderPhotoItem = useCallback((item: GridItem, index: number) => {
    const photo = item.data as Photo;
    const isSelected = selectedPhotos.some(selected => selected.id === photo.id);

    return (
      <PhotoItem
        photo={photo}
        viewMode={viewMode}
        size={size}
        selected={isSelected}
        showMetadata={showMetadata}
        showActions={showActions}
        lazyLoading={lazyLoading}
        onClick={() => handlePhotoClick(photo)}
        onDoubleClick={() => handlePhotoDoubleClick(photo)}
        onEdit={() => handlePhotoEdit(photo)}
        onDelete={() => handlePhotoDelete(photo)}
      />
    );
  }, [
    viewMode,
    size,
    selectedPhotos,
    showMetadata,
    showActions,
    lazyLoading,
    handlePhotoClick,
    handlePhotoDoubleClick,
    handlePhotoEdit,
    handlePhotoDelete
  ]);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <div className="photo-grid-empty">
      <div className="photo-grid-empty-icon">🖼️</div>
      <h3>No Photos Found</h3>
      <p>
        {filters.searchText
          ? `No photos match "${filters.searchText}"`
          : albumId
          ? 'This album is empty'
          : 'No photos in your collection'}
      </p>
    </div>
  ), [filters.searchText, albumId]);

  // Render loading state
  const renderLoadingState = useCallback(() => (
    <div className="photo-grid-loading">
      <PhotoGridSkeleton count={12} viewMode={viewMode} size={size} />
    </div>
  ), [viewMode, size]);

  const columnWidths = getColumnWidth();
  const gridConfig = {
    columns: viewMode === 'list' ? 1 : columns,
    minColumnWidth: columnWidths.min,
    maxColumnWidth: columnWidths.max,
    gap,
    aspectRatio: viewMode === 'masonry' ? undefined : aspectRatio,
    maintainAspectRatio: viewMode !== 'masonry'
  };

  const virtualScrollConfig = enableVirtualScrolling ? {
    enabled: true,
    itemHeight: viewMode === 'list' ? 80 : columnWidths.min,
    overscan: 5,
    threshold: 100
  } : { enabled: false };

  const containerClassName = `photo-grid ${viewMode}-layout ${size} ${isDragging ? 'dragging' : ''} ${enableMultiSelect ? 'multi-select' : ''} ${className}`;

  if (enableDragDrop && albumId) {
    return (
      <SortableContainer
        id="photo-grid-sortable"
        config={{
          animation: 150,
          disabled: !enableDragDrop || loading || viewMode === 'masonry',
          onUpdate: handleSortableUpdate
        }}
        className={containerClassName}
      >
        <GridLayout
          items={gridItems}
          config={gridConfig}
          virtualScroll={virtualScrollConfig}
          renderItem={renderPhotoItem}
          onItemClick={(item) => handlePhotoClick(item.data as Photo)}
          onItemDoubleClick={(item) => handlePhotoDoubleClick(item.data as Photo)}
          onSelectionChange={enableMultiSelect ? handlePhotoSelect : undefined}
          selectedItems={enableMultiSelect ? gridItems.filter(item =>
            selectedPhotos.some(selected => selected.id === item.id)
          ) : undefined}
          multiSelect={enableMultiSelect}
          loading={loading}
          error={error}
          emptyState={renderEmptyState()}
          loadingState={renderLoadingState()}
        />
      </SortableContainer>
    );
  }

  return (
    <div className={containerClassName}>
      <GridLayout
        items={gridItems}
        config={gridConfig}
        virtualScroll={virtualScrollConfig}
        renderItem={renderPhotoItem}
        onItemClick={(item) => handlePhotoClick(item.data as Photo)}
        onItemDoubleClick={(item) => handlePhotoDoubleClick(item.data as Photo)}
        onSelectionChange={enableMultiSelect ? handlePhotoSelect : undefined}
        selectedItems={enableMultiSelect ? gridItems.filter(item =>
          selectedPhotos.some(selected => selected.id === item.id)
        ) : undefined}
        multiSelect={enableMultiSelect}
        loading={loading}
        error={error}
        emptyState={renderEmptyState()}
        loadingState={renderLoadingState()}
      />
    </div>
  );
};

export default PhotoGrid;