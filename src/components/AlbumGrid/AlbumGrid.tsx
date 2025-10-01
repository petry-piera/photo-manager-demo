/**
 * AlbumGrid component for displaying and managing photo albums
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GridLayout, type GridItem } from '@/components/common/GridLayout';
import { SortableContainer, useDragDrop } from '@/components/DragDrop/DragDropProvider';
import { albumService, type AlbumQueryOptions } from '@/services/AlbumService';
import { photoService } from '@/services/PhotoService';
import type { Album } from '@/models/Album';
import type { Photo } from '@/models/Photo';
import '../../styles/components/album-grid.css';

/**
 * Album display mode
 */
export type AlbumViewMode = 'grid' | 'list';

/**
 * Album sort options
 */
export type AlbumSortBy = 'position' | 'name' | 'dateCreated' | 'photoCount';
export type AlbumSortOrder = 'asc' | 'desc';

/**
 * Album filter options
 */
export interface AlbumFilters {
  type?: 'date' | 'custom';
  year?: number;
  month?: number;
  includeEmpty?: boolean;
  searchText?: string;
}

/**
 * Album grid configuration
 */
export interface AlbumGridConfig {
  columns?: number;
  minColumnWidth?: number;
  maxColumnWidth?: number;
  gap?: number;
  showActions?: boolean;
  enableDragDrop?: boolean;
  enableMultiSelect?: boolean;
}

/**
 * Album grid props
 */
export interface AlbumGridProps {
  config?: AlbumGridConfig;
  filters?: AlbumFilters;
  sortBy?: AlbumSortBy;
  sortOrder?: AlbumSortOrder;
  viewMode?: AlbumViewMode;
  selectedAlbums?: Album[];
  onAlbumClick?: (album: Album) => void;
  onAlbumDoubleClick?: (album: Album) => void;
  onAlbumSelect?: (albums: Album[]) => void;
  onAlbumCreate?: () => void;
  onAlbumDelete?: (albums: Album[]) => void;
  onAlbumReorder?: (moves: Array<{ albumId: string; newPosition: number }>) => void;
  onAlbumEdit?: (album: Album) => void;
  className?: string;
}

/**
 * Album card props
 */
interface AlbumCardProps {
  album: Album;
  coverPhoto?: Photo | null;
  selected?: boolean;
  showActions?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Album card component
 */
const AlbumCard: React.FC<AlbumCardProps> = ({
  album,
  coverPhoto,
  selected = false,
  showActions = true,
  onClick,
  onDoubleClick,
  onEdit,
  onDelete
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const formatPhotoCount = useCallback((count: number) => {
    if (count === 0) return 'Empty';
    if (count === 1) return '1 photo';
    return `${count} photos`;
  }, []);

  const getAlbumTypeIcon = useCallback((type: string) => {
    return type === 'date' ? '📅' : '📁';
  }, []);

  return (
    <div
      className={`album-card ${selected ? 'selected' : ''}`}
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
      <div className="album-cover">
        {coverPhoto && !imageError ? (
          <img
            className={`album-cover-image ${imageLoaded ? 'loaded' : 'loading'}`}
            src={coverPhoto.thumbnailDataUrl || ''}
            alt={`Cover for ${album.name}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="album-cover-placeholder">
            {getAlbumTypeIcon(album.type)}
          </div>
        )}

        <div className="album-photo-count">
          {formatPhotoCount(album.photoCount)}
        </div>

        {showActions && (
          <div className="album-actions">
            <button
              className="album-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              title="Edit album"
              type="button"
            >
              ✏️
            </button>
            <button
              className="album-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              title="Delete album"
              type="button"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      <div className="album-info">
        <h3 className="album-name" title={album.name}>
          {album.name}
        </h3>
        <div className="album-meta">
          <span className={`album-type ${album.type}`}>
            {getAlbumTypeIcon(album.type)}
            {album.type === 'date' ? 'Date Album' : 'Custom Album'}
          </span>
          <span className="album-date">
            {album.dateCreated.toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Album grid skeleton loader
 */
const AlbumGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="album-skeleton">
          <div className="album-skeleton-cover" />
          <div className="album-skeleton-info">
            <div className="album-skeleton-name" />
            <div className="album-skeleton-meta" />
          </div>
        </div>
      ))}
    </>
  );
};

/**
 * AlbumGrid component
 */
export const AlbumGrid: React.FC<AlbumGridProps> = ({
  config = {},
  filters = {},
  sortBy = 'position',
  sortOrder = 'asc',
  viewMode = 'grid',
  selectedAlbums = [],
  onAlbumClick,
  onAlbumDoubleClick,
  onAlbumSelect,
  onAlbumCreate,
  onAlbumDelete,
  onAlbumReorder,
  onAlbumEdit,
  className = ''
}) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [coverPhotos, setCoverPhotos] = useState<Map<string, Photo | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDragging } = useDragDrop();

  const {
    columns,
    minColumnWidth = 200,
    maxColumnWidth = 300,
    gap = 16,
    showActions = true,
    enableDragDrop = true,
    enableMultiSelect = false
  } = config;

  // Load albums
  const loadAlbums = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryOptions: AlbumQueryOptions = {
        type: filters.type,
        year: filters.year,
        month: filters.month,
        includeEmpty: filters.includeEmpty,
        sortBy,
        sortOrder
      };

      let albumList = await albumService.queryAlbums(queryOptions);

      // Apply search filter if provided
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        albumList = albumList.filter(album =>
          album.name.toLowerCase().includes(searchLower)
        );
      }

      setAlbums(albumList);

      // Load cover photos for albums
      const coverPhotoMap = new Map<string, Photo | null>();
      await Promise.all(
        albumList.map(async (album) => {
          try {
            const coverPhoto = await albumService.getAlbumCover(album.id);
            coverPhotoMap.set(album.id, coverPhoto);
          } catch (err) {
            console.warn(`Failed to load cover photo for album ${album.id}:`, err);
            coverPhotoMap.set(album.id, null);
          }
        })
      );

      setCoverPhotos(coverPhotoMap);
    } catch (err) {
      console.error('Failed to load albums:', err);
      setError(err instanceof Error ? err.message : 'Failed to load albums');
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, sortOrder]);

  // Load albums on mount and when dependencies change
  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  // Convert albums to grid items
  const gridItems = useMemo((): GridItem[] => {
    return albums.map(album => ({
      id: album.id,
      data: album,
      aspectRatio: 1 // Square aspect ratio for album cards
    }));
  }, [albums]);

  // Handle album selection
  const handleAlbumSelect = useCallback((selectedItems: GridItem[]) => {
    const selectedAlbumList = selectedItems.map(item => item.data as Album);
    onAlbumSelect?.(selectedAlbumList);
  }, [onAlbumSelect]);

  // Handle album click
  const handleAlbumClick = useCallback((album: Album) => {
    onAlbumClick?.(album);
  }, [onAlbumClick]);

  // Handle album double click
  const handleAlbumDoubleClick = useCallback((album: Album) => {
    onAlbumDoubleClick?.(album);
  }, [onAlbumDoubleClick]);

  // Handle album edit
  const handleAlbumEdit = useCallback((album: Album) => {
    onAlbumEdit?.(album);
  }, [onAlbumEdit]);

  // Handle album delete
  const handleAlbumDelete = useCallback((album: Album) => {
    onAlbumDelete?.([album]);
  }, [onAlbumDelete]);

  // Handle drag and drop reordering
  const handleSortableUpdate = useCallback((event: any) => {
    if (!enableDragDrop || !onAlbumReorder) return;

    const { oldIndex, newIndex } = event;
    if (oldIndex === newIndex) return;

    const sourceAlbum = albums[oldIndex];
    const targetAlbum = albums[newIndex];

    if (!sourceAlbum || !targetAlbum) return;

    const moves = [{
      albumId: sourceAlbum.id,
      newPosition: targetAlbum.position
    }];

    onAlbumReorder(moves);
  }, [enableDragDrop, onAlbumReorder, albums]);

  // Render album item
  const renderAlbumItem = useCallback((item: GridItem, index: number) => {
    const album = item.data as Album;
    const coverPhoto = coverPhotos.get(album.id);
    const isSelected = selectedAlbums.some(selected => selected.id === album.id);

    return (
      <AlbumCard
        album={album}
        coverPhoto={coverPhoto}
        selected={isSelected}
        showActions={showActions}
        onClick={() => handleAlbumClick(album)}
        onDoubleClick={() => handleAlbumDoubleClick(album)}
        onEdit={() => handleAlbumEdit(album)}
        onDelete={() => handleAlbumDelete(album)}
      />
    );
  }, [
    coverPhotos,
    selectedAlbums,
    showActions,
    handleAlbumClick,
    handleAlbumDoubleClick,
    handleAlbumEdit,
    handleAlbumDelete
  ]);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <div className="album-grid-empty">
      <div className="album-grid-empty-icon">📁</div>
      <h3>No Albums Found</h3>
      <p>
        {filters.searchText
          ? `No albums match "${filters.searchText}"`
          : 'Create your first album to get started'}
      </p>
      {onAlbumCreate && !filters.searchText && (
        <button
          className="btn btn-primary"
          onClick={onAlbumCreate}
          type="button"
        >
          Create Album
        </button>
      )}
    </div>
  ), [filters.searchText, onAlbumCreate]);

  // Render loading state
  const renderLoadingState = useCallback(() => (
    <div className="album-grid-loading">
      <AlbumGridSkeleton count={6} />
    </div>
  ), []);

  const gridConfig = {
    columns,
    minColumnWidth,
    maxColumnWidth,
    gap,
    aspectRatio: 1,
    maintainAspectRatio: true
  };

  if (enableDragDrop) {
    return (
      <SortableContainer
        id="album-grid-sortable"
        config={{
          animation: 150,
          disabled: !enableDragDrop || loading,
          onUpdate: handleSortableUpdate
        }}
        className={`album-grid ${isDragging ? 'dragging' : ''} ${className}`}
      >
        <GridLayout
          items={gridItems}
          config={gridConfig}
          renderItem={renderAlbumItem}
          onItemClick={(item) => handleAlbumClick(item.data as Album)}
          onItemDoubleClick={(item) => handleAlbumDoubleClick(item.data as Album)}
          onSelectionChange={enableMultiSelect ? handleAlbumSelect : undefined}
          selectedItems={enableMultiSelect ? gridItems.filter(item =>
            selectedAlbums.some(selected => selected.id === item.id)
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
    <div className={`album-grid ${className}`}>
      <GridLayout
        items={gridItems}
        config={gridConfig}
        renderItem={renderAlbumItem}
        onItemClick={(item) => handleAlbumClick(item.data as Album)}
        onItemDoubleClick={(item) => handleAlbumDoubleClick(item.data as Album)}
        onSelectionChange={enableMultiSelect ? handleAlbumSelect : undefined}
        selectedItems={enableMultiSelect ? gridItems.filter(item =>
          selectedAlbums.some(selected => selected.id === item.id)
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

export default AlbumGrid;