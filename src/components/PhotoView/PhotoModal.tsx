/**
 * PhotoModal component for viewing and editing photo details
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { photoService } from '@/services/PhotoService';
import { albumService } from '@/services/AlbumService';
import { KeyboardUtils, FocusManager } from '@/utils/dom-utils';
import { formatFileSize } from '@/utils/file-utils';
import type { Photo } from '@/models/Photo';
import type { Album } from '@/models/Album';

/**
 * Photo editing data
 */
interface PhotoEditData {
  caption?: string;
  tags: string[];
}

/**
 * Photo modal props
 */
export interface PhotoModalProps {
  photo?: Photo | null;
  albumId?: string;
  photos?: Photo[];
  currentIndex?: number;
  open: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onPhotoUpdate?: (photo: Photo) => void;
  onPhotoDelete?: (photo: Photo) => void;
  className?: string;
}

/**
 * EXIF data display component
 */
const ExifDataDisplay: React.FC<{ photo: Photo }> = ({ photo }) => {
  const { exifData } = photo;

  if (!exifData) {
    return (
      <div className="exif-data">
        <h4>Technical Details</h4>
        <p className="no-exif">No EXIF data available</p>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="exif-data">
      <h4>Technical Details</h4>

      <div className="exif-section">
        <h5>Basic Info</h5>
        <dl className="exif-list">
          {photo.dateTaken && (
            <>
              <dt>Date Taken</dt>
              <dd>{formatDate(photo.dateTaken)}</dd>
            </>
          )}
          {photo.width && photo.height && (
            <>
              <dt>Dimensions</dt>
              <dd>{photo.width} × {photo.height} pixels</dd>
            </>
          )}
          {photo.fileSize && (
            <>
              <dt>File Size</dt>
              <dd>{formatFileSize(photo.fileSize)}</dd>
            </>
          )}
          <dt>File Name</dt>
          <dd>{photo.fileName}</dd>
        </dl>
      </div>

      {exifData.camera && (
        <div className="exif-section">
          <h5>Camera</h5>
          <dl className="exif-list">
            {exifData.camera.make && (
              <>
                <dt>Make</dt>
                <dd>{exifData.camera.make}</dd>
              </>
            )}
            {exifData.camera.model && (
              <>
                <dt>Model</dt>
                <dd>{exifData.camera.model}</dd>
              </>
            )}
            {exifData.camera.lens && (
              <>
                <dt>Lens</dt>
                <dd>{exifData.camera.lens}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {exifData.technical && (
        <div className="exif-section">
          <h5>Settings</h5>
          <dl className="exif-list">
            {exifData.technical.iso && (
              <>
                <dt>ISO</dt>
                <dd>{exifData.technical.iso}</dd>
              </>
            )}
            {exifData.technical.aperture && (
              <>
                <dt>Aperture</dt>
                <dd>{exifData.technical.aperture}</dd>
              </>
            )}
            {exifData.technical.shutterSpeed && (
              <>
                <dt>Shutter Speed</dt>
                <dd>{exifData.technical.shutterSpeed}</dd>
              </>
            )}
            {exifData.technical.focalLength && (
              <>
                <dt>Focal Length</dt>
                <dd>{exifData.technical.focalLength}</dd>
              </>
            )}
            {exifData.technical.flash !== undefined && (
              <>
                <dt>Flash</dt>
                <dd>{exifData.technical.flash ? 'Yes' : 'No'}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {exifData.location && (
        <div className="exif-section">
          <h5>Location</h5>
          <dl className="exif-list">
            {exifData.location.latitude && exifData.location.longitude && (
              <>
                <dt>Coordinates</dt>
                <dd>
                  {exifData.location.latitude.toFixed(6)}, {exifData.location.longitude.toFixed(6)}
                </dd>
              </>
            )}
            {exifData.location.altitude && (
              <>
                <dt>Altitude</dt>
                <dd>{exifData.location.altitude.toFixed(1)}m</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {(exifData.software || exifData.artist || exifData.copyright) && (
        <div className="exif-section">
          <h5>Metadata</h5>
          <dl className="exif-list">
            {exifData.software && (
              <>
                <dt>Software</dt>
                <dd>{exifData.software}</dd>
              </>
            )}
            {exifData.artist && (
              <>
                <dt>Artist</dt>
                <dd>{exifData.artist}</dd>
              </>
            )}
            {exifData.copyright && (
              <>
                <dt>Copyright</dt>
                <dd>{exifData.copyright}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
};

/**
 * Photo editing form component
 */
const PhotoEditForm: React.FC<{
  photo: Photo;
  onSave: (data: PhotoEditData) => void;
  onCancel: () => void;
}> = ({ photo, onSave, onCancel }) => {
  const [editData, setEditData] = useState<PhotoEditData>({
    caption: photo.caption || '',
    tags: [...photo.tags]
  });
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !editData.tags.includes(trimmedTag)) {
      setEditData(prev => ({
        ...prev,
        tags: [...prev.tags, trimmedTag]
      }));
    }
    setTagInput('');
  }, [editData.tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setEditData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  }, []);

  const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  }, [tagInput, handleAddTag]);

  const handleSave = useCallback(() => {
    onSave(editData);
  }, [editData, onSave]);

  return (
    <div className="photo-edit-form">
      <h4>Edit Photo</h4>

      <div className="form-group">
        <label htmlFor="photo-caption">Caption:</label>
        <textarea
          id="photo-caption"
          value={editData.caption}
          onChange={(e) => setEditData(prev => ({ ...prev, caption: e.target.value }))}
          placeholder="Add a caption..."
          rows={3}
          className="caption-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="photo-tags">Tags:</label>
        <div className="tag-editor">
          <div className="current-tags">
            {editData.tags.map(tag => (
              <span key={tag} className="tag-chip">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="tag-remove"
                  title={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            id="photo-tags"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            placeholder="Add tag and press Enter..."
            className="tag-input"
          />
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="btn btn-primary"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

/**
 * PhotoModal component
 */
export const PhotoModal: React.FC<PhotoModalProps> = ({
  photo,
  albumId,
  photos = [],
  currentIndex = 0,
  open,
  onClose,
  onNext,
  onPrevious,
  onPhotoUpdate,
  onPhotoDelete,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [albumInfo, setAlbumInfo] = useState<Album | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const hasNavigation = photos.length > 1;
  const canGoPrevious = hasNavigation && currentIndex > 0;
  const canGoNext = hasNavigation && currentIndex < photos.length - 1;

  // Load album info if albumId is provided
  useEffect(() => {
    if (albumId && open) {
      albumService.getAlbum(albumId)
        .then(setAlbumInfo)
        .catch(err => console.error('Failed to load album info:', err));
    }
  }, [albumId, open]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const cleanup = KeyboardUtils.onArrowKeys({
      left: canGoPrevious ? onPrevious : undefined,
      right: canGoNext ? onNext : undefined
    });

    const escapeCleanup = KeyboardUtils.onEscape(() => {
      if (!isEditing) {
        onClose();
      }
    });

    return () => {
      cleanup();
      escapeCleanup();
    };
  }, [open, isEditing, canGoPrevious, canGoNext, onPrevious, onNext, onClose]);

  // Focus management
  useEffect(() => {
    if (open && modalRef.current) {
      const focusCleanup = FocusManager.trapFocus(modalRef.current);
      return focusCleanup;
    }
  }, [open]);

  // Handle photo edit save
  const handleEditSave = useCallback(async (editData: PhotoEditData) => {
    if (!photo) return;

    setLoading(true);
    setError(null);

    try {
      const updatedPhoto = await photoService.updatePhoto(photo.id, {
        caption: editData.caption,
        tags: editData.tags
      });

      onPhotoUpdate?.(updatedPhoto);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update photo');
    } finally {
      setLoading(false);
    }
  }, [photo, onPhotoUpdate]);

  // Handle photo delete
  const handleDelete = useCallback(async () => {
    if (!photo) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${photo.fileName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      await photoService.deletePhoto(photo.id);
      onPhotoDelete?.(photo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
    } finally {
      setLoading(false);
    }
  }, [photo, onPhotoDelete, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isEditing) {
      onClose();
    }
  }, [isEditing, onClose]);

  if (!open || !photo) return null;

  return (
    <div
      className={`photo-modal-overlay ${className}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-modal-title"
    >
      <div
        ref={modalRef}
        className="photo-modal"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="photo-modal-header">
          <div className="photo-modal-title">
            <h2 id="photo-modal-title">{photo.fileName}</h2>
            {albumInfo && (
              <span className="album-name">in {albumInfo.name}</span>
            )}
            {hasNavigation && (
              <span className="photo-position">
                {currentIndex + 1} of {photos.length}
              </span>
            )}
          </div>

          <div className="photo-modal-actions">
            {!isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="btn btn-secondary"
                  title="Edit photo"
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn btn-danger"
                  title="Delete photo"
                  disabled={loading}
                >
                  🗑️ Delete
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary close-btn"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="photo-modal-error">
            <p>Error: {error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="btn btn-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        <div className="photo-modal-content">
          {/* Image section */}
          <div className="photo-modal-image-section">
            {/* Navigation buttons */}
            {hasNavigation && (
              <>
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!canGoPrevious}
                  className="nav-btn nav-prev"
                  title="Previous photo"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!canGoNext}
                  className="nav-btn nav-next"
                  title="Next photo"
                >
                  ▶
                </button>
              </>
            )}

            {/* Main image */}
            <div className="photo-display">
              <img
                ref={imageRef}
                src={photo.thumbnailDataUrl || ''}
                alt={photo.caption || photo.fileName}
                className="photo-main-image"
                onClick={() => {
                  // TODO: Implement full-screen view
                }}
              />
            </div>
          </div>

          {/* Info section */}
          <div className="photo-modal-info-section">
            {isEditing ? (
              <PhotoEditForm
                photo={photo}
                onSave={handleEditSave}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <>
                {/* Basic info */}
                <div className="photo-basic-info">
                  {photo.caption && (
                    <div className="photo-caption">
                      <h4>Caption</h4>
                      <p>{photo.caption}</p>
                    </div>
                  )}

                  {photo.tags.length > 0 && (
                    <div className="photo-tags">
                      <h4>Tags</h4>
                      <div className="tag-list">
                        {photo.tags.map(tag => (
                          <span key={tag} className="tag-chip readonly">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* EXIF data */}
                <ExifDataDisplay photo={photo} />
              </>
            )}
          </div>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="photo-modal-loading">
            <div className="loading-spinner" />
            <p>Please wait...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoModal;