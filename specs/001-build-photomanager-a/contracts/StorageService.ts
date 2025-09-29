/**
 * StorageService Contract
 * Defines the interface for local data persistence operations
 */

import { Photo, Album, Tag, AlbumLayout, PhotoLayout, AppSettings } from '../data-model';

export interface StorageStats {
  totalSize: number;
  photosCount: number;
  albumsCount: number;
  tagsCount: number;
  thumbnailsCacheSize: number;
}

export interface DatabaseBackup {
  version: string;
  timestamp: Date;
  photos: Photo[];
  albums: Album[];
  tags: Tag[];
  layouts: {
    albumLayouts: AlbumLayout[];
    photoLayouts: PhotoLayout[];
  };
  settings: AppSettings;
}

export interface StorageService {
  /**
   * Initialize the storage system
   * @returns Promise resolving when initialization complete
   * @throws StorageInitializationError if setup fails
   */
  initialize(): Promise<void>;

  /**
   * Store a photo record
   * @param photo - Photo data to store
   * @returns Promise resolving when storage complete
   * @throws StorageError if operation fails
   */
  storePhoto(photo: Photo): Promise<void>;

  /**
   * Retrieve photo by ID
   * @param photoId - Photo identifier
   * @returns Promise resolving to photo or null if not found
   */
  getPhoto(photoId: string): Promise<Photo | null>;

  /**
   * Retrieve multiple photos by IDs
   * @param photoIds - Array of photo identifiers
   * @returns Promise resolving to array of photos (with nulls for not found)
   */
  getPhotos(photoIds: string[]): Promise<(Photo | null)[]>;

  /**
   * Update photo record
   * @param photoId - Photo identifier
   * @param updates - Partial photo data to update
   * @returns Promise resolving when update complete
   * @throws PhotoNotFoundError if photo doesn't exist
   */
  updatePhoto(photoId: string, updates: Partial<Photo>): Promise<void>;

  /**
   * Delete photo record
   * @param photoId - Photo identifier
   * @returns Promise resolving when deletion complete
   */
  deletePhoto(photoId: string): Promise<void>;

  /**
   * Query photos with filters
   * @param filters - Query filters and sorting options
   * @returns Promise resolving to matching photos
   */
  queryPhotos(filters: {
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    albumId?: string;
    sortBy?: 'dateTaken' | 'dateAdded' | 'fileName';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<Photo[]>;

  /**
   * Store album record
   * @param album - Album data to store
   * @returns Promise resolving when storage complete
   */
  storeAlbum(album: Album): Promise<void>;

  /**
   * Retrieve album by ID
   * @param albumId - Album identifier
   * @returns Promise resolving to album or null if not found
   */
  getAlbum(albumId: string): Promise<Album | null>;

  /**
   * Retrieve all albums with optional filtering
   * @param filters - Query filters (optional)
   * @returns Promise resolving to array of albums
   */
  getAlbums(filters?: {
    type?: 'date' | 'custom';
    sortBy?: 'name' | 'dateCreated' | 'position';
    sortOrder?: 'asc' | 'desc';
  }): Promise<Album[]>;

  /**
   * Update album record
   * @param albumId - Album identifier
   * @param updates - Partial album data to update
   * @returns Promise resolving when update complete
   */
  updateAlbum(albumId: string, updates: Partial<Album>): Promise<void>;

  /**
   * Delete album record
   * @param albumId - Album identifier
   * @returns Promise resolving when deletion complete
   */
  deleteAlbum(albumId: string): Promise<void>;

  /**
   * Store tag record
   * @param tag - Tag data to store
   * @returns Promise resolving when storage complete
   */
  storeTag(tag: Tag): Promise<void>;

  /**
   * Retrieve tag by name
   * @param tagName - Tag name (normalized)
   * @returns Promise resolving to tag or null if not found
   */
  getTag(tagName: string): Promise<Tag | null>;

  /**
   * Retrieve all tags
   * @param sortBy - Sort criteria (optional)
   * @returns Promise resolving to array of tags
   */
  getTags(sortBy?: 'name' | 'photoCount' | 'dateLastUsed'): Promise<Tag[]>;

  /**
   * Update tag record
   * @param tagId - Tag identifier
   * @param updates - Partial tag data to update
   * @returns Promise resolving when update complete
   */
  updateTag(tagId: string, updates: Partial<Tag>): Promise<void>;

  /**
   * Delete tag record
   * @param tagId - Tag identifier
   * @returns Promise resolving when deletion complete
   */
  deleteTag(tagId: string): Promise<void>;

  /**
   * Store album layout configuration
   * @param layout - Layout data to store
   * @returns Promise resolving when storage complete
   */
  storeAlbumLayout(layout: AlbumLayout): Promise<void>;

  /**
   * Retrieve album layout
   * @param layoutId - Layout identifier
   * @returns Promise resolving to layout or null if not found
   */
  getAlbumLayout(layoutId: string): Promise<AlbumLayout | null>;

  /**
   * Store photo layout configuration
   * @param layout - Layout data to store
   * @returns Promise resolving when storage complete
   */
  storePhotoLayout(layout: PhotoLayout): Promise<void>;

  /**
   * Retrieve photo layout
   * @param albumId - Album identifier
   * @returns Promise resolving to layout or null if not found
   */
  getPhotoLayout(albumId: string): Promise<PhotoLayout | null>;

  /**
   * Store application settings
   * @param settings - Settings data to store
   * @returns Promise resolving when storage complete
   */
  storeSettings(settings: AppSettings): Promise<void>;

  /**
   * Retrieve application settings
   * @returns Promise resolving to settings or default settings
   */
  getSettings(): Promise<AppSettings>;

  /**
   * Get storage usage statistics
   * @returns Promise resolving to storage stats
   */
  getStorageStats(): Promise<StorageStats>;

  /**
   * Cleanup orphaned data and optimize storage
   * @returns Promise resolving when cleanup complete
   */
  cleanup(): Promise<void>;

  /**
   * Create full database backup
   * @returns Promise resolving to backup data
   */
  createBackup(): Promise<DatabaseBackup>;

  /**
   * Restore from database backup
   * @param backup - Backup data to restore
   * @param options - Restore options
   * @returns Promise resolving when restore complete
   */
  restoreBackup(backup: DatabaseBackup, options?: {
    clearExisting?: boolean;
    validateData?: boolean;
  }): Promise<void>;

  /**
   * Clear all data (reset application)
   * @returns Promise resolving when clear complete
   */
  clearAllData(): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageInitializationError';
  }
}

export class StorageQuotaExceededError extends Error {
  constructor() {
    super('Storage quota exceeded');
    this.name = 'StorageQuotaExceededError';
  }
}