/**
 * StorageService implementation for photo and album data operations
 */

import { db } from './DatabaseService';
import type { Photo, PhotoCreateData, PhotoUpdateData } from '@/models/Photo';
import type { Album, AlbumCreateData, AlbumUpdateData } from '@/models/Album';
import type { Tag, TagCreateData, TagUpdateData } from '@/models/Tag';
import type { AlbumLayout, PhotoLayout } from '@/models/Layout';
import type { AppSettings, AppSettingsUpdateData } from '@/models/AppSettings';

/**
 * Storage error types
 */
export class StorageError extends Error {
  constructor(message: string, public code: string = 'STORAGE_ERROR') {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageQuotaExceededError extends StorageError {
  constructor(message: string = 'Storage quota exceeded') {
    super(message, 'QUOTA_EXCEEDED');
    this.name = 'StorageQuotaExceededError';
  }
}

export class DataNotFoundError extends StorageError {
  constructor(resource: string, id: string) {
    super(`${resource} with ID '${id}' not found`, 'NOT_FOUND');
    this.name = 'DataNotFoundError';
  }
}

export class DataConflictError extends StorageError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'DataConflictError';
  }
}

/**
 * Query options for photo searches
 */
export interface PhotoQueryOptions {
  albumIds?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchText?: string;
  sortBy?: 'dateTaken' | 'dateAdded' | 'fileName';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Query options for album searches
 */
export interface AlbumQueryOptions {
  type?: 'date' | 'custom';
  year?: number;
  month?: number;
  sortBy?: 'position' | 'name' | 'dateCreated';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalPhotos: number;
  totalAlbums: number;
  totalTags: number;
  totalSize: number;
  lastBackup?: Date;
  databaseVersion: number;
}

/**
 * StorageService implementation
 */
export class StorageService {
  /**
   * Initialize storage service
   */
  async initialize(): Promise<void> {
    try {
      await db.initialize();
    } catch (error) {
      throw new StorageError(
        `Failed to initialize storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Photo operations

  /**
   * Store a new photo
   */
  async storePhoto(photoData: PhotoCreateData): Promise<Photo> {
    try {
      const { PhotoValidation } = await import('@/models/Photo');

      // Validate photo data
      const validation = PhotoValidation.validate(photoData);
      if (!validation.valid) {
        throw new StorageError(`Invalid photo data: ${validation.errors.join(', ')}`);
      }

      // Generate ID if not provided
      const id = photoData.id || `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const photo: Photo = {
        ...photoData,
        id,
        dateAdded: photoData.dateAdded || new Date(),
        dateModified: new Date(),
        albumIds: photoData.albumIds || [],
        tags: photoData.tags || []
      };

      await db.photos.add(photo);

      // Update album photo counts
      if (photo.albumIds.length > 0) {
        await this.updateAlbumPhotoCounts(photo.albumIds);
      }

      // Update tag usage counts
      if (photo.tags.length > 0) {
        await this.updateTagUsageCounts(photo.tags);
      }

      return photo;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to store photo: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get photo by ID
   */
  async getPhoto(id: string): Promise<Photo> {
    try {
      const photo = await db.photos.get(id);
      if (!photo) {
        throw new DataNotFoundError('Photo', id);
      }
      return photo;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to get photo: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update photo
   */
  async updatePhoto(id: string, updates: PhotoUpdateData): Promise<Photo> {
    try {
      const existingPhoto = await this.getPhoto(id);
      const oldAlbumIds = [...existingPhoto.albumIds];
      const oldTags = [...existingPhoto.tags];

      const updatedPhoto = {
        ...existingPhoto,
        ...updates,
        id, // Ensure ID doesn't change
        dateModified: new Date()
      };

      const { PhotoValidation } = await import('@/models/Photo');
      const validation = PhotoValidation.validate(updatedPhoto);
      if (!validation.valid) {
        throw new StorageError(`Invalid photo update data: ${validation.errors.join(', ')}`);
      }

      await db.photos.update(id, updatedPhoto);

      // Update album counts if album memberships changed
      const albumChanges = this.getArrayDifferences(oldAlbumIds, updatedPhoto.albumIds);
      if (albumChanges.added.length > 0 || albumChanges.removed.length > 0) {
        await this.updateAlbumPhotoCounts([...albumChanges.added, ...albumChanges.removed]);
      }

      // Update tag counts if tags changed
      const tagChanges = this.getArrayDifferences(oldTags, updatedPhoto.tags);
      if (tagChanges.added.length > 0 || tagChanges.removed.length > 0) {
        await this.updateTagUsageCounts([...tagChanges.added, ...tagChanges.removed]);
      }

      return updatedPhoto;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to update photo: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete photo
   */
  async deletePhoto(id: string): Promise<void> {
    try {
      const photo = await this.getPhoto(id);

      await db.photos.delete(id);

      // Update album photo counts
      if (photo.albumIds.length > 0) {
        await this.updateAlbumPhotoCounts(photo.albumIds);
      }

      // Update tag usage counts
      if (photo.tags.length > 0) {
        await this.updateTagUsageCounts(photo.tags);
      }
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to delete photo: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query photos with options
   */
  async queryPhotos(options: PhotoQueryOptions = {}): Promise<Photo[]> {
    try {
      let query = db.photos.orderBy(options.sortBy || 'dateTaken');

      // Apply filters
      if (options.albumIds?.length) {
        query = query.filter(photo =>
          photo.albumIds.some(albumId => options.albumIds!.includes(albumId))
        );
      }

      if (options.tags?.length) {
        query = query.filter(photo =>
          photo.tags.some(tag => options.tags!.includes(tag))
        );
      }

      if (options.dateRange) {
        query = query.filter(photo => {
          const photoDate = photo.dateTaken || photo.dateAdded;
          return photoDate >= options.dateRange!.start && photoDate <= options.dateRange!.end;
        });
      }

      if (options.searchText) {
        const searchLower = options.searchText.toLowerCase();
        query = query.filter(photo =>
          photo.fileName.toLowerCase().includes(searchLower) ||
          (photo.caption && photo.caption.toLowerCase().includes(searchLower)) ||
          photo.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      // Apply sorting
      if (options.sortOrder === 'desc') {
        query = query.reverse();
      }

      // Apply pagination
      if (options.offset) {
        query = query.offset(options.offset);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      return await query.toArray();
    } catch (error) {
      throw new StorageError(
        `Failed to query photos: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Album operations

  /**
   * Create album
   */
  async createAlbum(albumData: AlbumCreateData): Promise<Album> {
    try {
      const { AlbumValidation } = await import('@/models/Album');

      // Validate album data
      const validation = AlbumValidation.validate(albumData);
      if (!validation.valid) {
        throw new StorageError(`Invalid album data: ${validation.errors.join(', ')}`);
      }

      // Check for name conflicts in custom albums
      if (albumData.type === 'custom') {
        const existing = await db.albums.where('name').equals(albumData.name).first();
        if (existing) {
          throw new DataConflictError(`Album with name '${albumData.name}' already exists`);
        }
      }

      const id = albumData.id || `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const album: Album = {
        ...albumData,
        id,
        dateCreated: albumData.dateCreated || new Date(),
        dateModified: new Date(),
        photoCount: 0,
        photoIds: []
      };

      await db.albums.add(album);
      return album;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to create album: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get album by ID
   */
  async getAlbum(id: string): Promise<Album> {
    try {
      const album = await db.albums.get(id);
      if (!album) {
        throw new DataNotFoundError('Album', id);
      }
      return album;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to get album: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update album
   */
  async updateAlbum(id: string, updates: AlbumUpdateData): Promise<Album> {
    try {
      const existingAlbum = await this.getAlbum(id);

      const updatedAlbum = {
        ...existingAlbum,
        ...updates,
        id, // Ensure ID doesn't change
        dateModified: new Date()
      };

      const { AlbumValidation } = await import('@/models/Album');
      const validation = AlbumValidation.validate(updatedAlbum);
      if (!validation.valid) {
        throw new StorageError(`Invalid album update data: ${validation.errors.join(', ')}`);
      }

      // Check for name conflicts if name is being changed
      if (updates.name && updates.name !== existingAlbum.name && updatedAlbum.type === 'custom') {
        const existing = await db.albums.where('name').equals(updates.name).first();
        if (existing && existing.id !== id) {
          throw new DataConflictError(`Album with name '${updates.name}' already exists`);
        }
      }

      await db.albums.update(id, updatedAlbum);
      return updatedAlbum;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to update album: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete album
   */
  async deleteAlbum(id: string): Promise<void> {
    try {
      const album = await this.getAlbum(id);

      // Remove album reference from all photos
      const photos = await db.photos.where('albumIds').anyOf([id]).toArray();
      for (const photo of photos) {
        const updatedAlbumIds = photo.albumIds.filter(albumId => albumId !== id);
        await db.photos.update(photo.id, { albumIds: updatedAlbumIds });
      }

      // Delete associated photo layout
      await db.photoLayouts.delete(id);

      await db.albums.delete(id);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to delete album: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query albums with options
   */
  async queryAlbums(options: AlbumQueryOptions = {}): Promise<Album[]> {
    try {
      let query = db.albums.orderBy(options.sortBy || 'position');

      // Apply filters
      if (options.type) {
        query = query.filter(album => album.type === options.type);
      }

      if (options.year !== undefined) {
        query = query.filter(album => album.year === options.year);
      }

      if (options.month !== undefined) {
        query = query.filter(album => album.month === options.month);
      }

      // Apply sorting
      if (options.sortOrder === 'desc') {
        query = query.reverse();
      }

      // Apply pagination
      if (options.offset) {
        query = query.offset(options.offset);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      return await query.toArray();
    } catch (error) {
      throw new StorageError(
        `Failed to query albums: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Tag operations

  /**
   * Create or get tag
   */
  async createTag(tagData: TagCreateData): Promise<Tag> {
    try {
      // Check if tag already exists (case-insensitive)
      const existing = await db.tags.where('name').equalsIgnoreCase(tagData.name).first();
      if (existing) {
        return existing;
      }

      const { TagValidation } = await import('@/models/Tag');

      // Validate tag data
      const validation = TagValidation.validate(tagData);
      if (!validation.valid) {
        throw new StorageError(`Invalid tag data: ${validation.errors.join(', ')}`);
      }

      const id = tagData.id || `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const tag: Tag = {
        ...tagData,
        id,
        dateCreated: tagData.dateCreated || new Date(),
        dateLastUsed: new Date(),
        photoCount: 0
      };

      await db.tags.add(tag);
      return tag;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all tags
   */
  async getAllTags(): Promise<Tag[]> {
    try {
      return await db.tags.orderBy('name').toArray();
    } catch (error) {
      throw new StorageError(
        `Failed to get tags: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update tag usage counts
   */
  private async updateTagUsageCounts(tagNames: string[]): Promise<void> {
    for (const tagName of tagNames) {
      const count = await db.photos.where('tags').anyOf([tagName]).count();
      const tag = await db.tags.where('name').equalsIgnoreCase(tagName).first();

      if (tag) {
        await db.tags.update(tag.id, {
          photoCount: count,
          dateLastUsed: count > 0 ? new Date() : tag.dateLastUsed
        });
      }
    }
  }

  /**
   * Update album photo counts
   */
  private async updateAlbumPhotoCounts(albumIds: string[]): Promise<void> {
    for (const albumId of albumIds) {
      const count = await db.photos.where('albumIds').anyOf([albumId]).count();
      await db.albums.update(albumId, { photoCount: count });
    }
  }

  /**
   * Get array differences (added/removed items)
   */
  private getArrayDifferences<T>(oldArray: T[], newArray: T[]): { added: T[]; removed: T[] } {
    const added = newArray.filter(item => !oldArray.includes(item));
    const removed = oldArray.filter(item => !newArray.includes(item));
    return { added, removed };
  }

  // Layout operations

  /**
   * Get album layout
   */
  async getAlbumLayout(id: string): Promise<AlbumLayout> {
    try {
      const layout = await db.albumLayouts.get(id);
      if (!layout) {
        // Create default layout
        const { LayoutUtils } = await import('@/models/Layout');
        const defaultLayout = LayoutUtils.createDefaultAlbumLayout(id);
        await db.albumLayouts.add(defaultLayout);
        return defaultLayout;
      }
      return layout;
    } catch (error) {
      throw new StorageError(
        `Failed to get album layout: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update album layout
   */
  async updateAlbumLayout(id: string, updates: Partial<AlbumLayout>): Promise<AlbumLayout> {
    try {
      const existingLayout = await this.getAlbumLayout(id);
      const updatedLayout = {
        ...existingLayout,
        ...updates,
        id,
        dateModified: new Date()
      };

      await db.albumLayouts.update(id, updatedLayout);
      return updatedLayout;
    } catch (error) {
      throw new StorageError(
        `Failed to update album layout: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get photo layout for album
   */
  async getPhotoLayout(albumId: string): Promise<PhotoLayout> {
    try {
      const layout = await db.photoLayouts.get(albumId);
      if (!layout) {
        // Create default layout
        const { LayoutUtils } = await import('@/models/Layout');
        const defaultLayout = LayoutUtils.createDefaultPhotoLayout(albumId);
        await db.photoLayouts.add(defaultLayout);
        return defaultLayout;
      }
      return layout;
    } catch (error) {
      throw new StorageError(
        `Failed to get photo layout: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update photo layout
   */
  async updatePhotoLayout(albumId: string, updates: Partial<PhotoLayout>): Promise<PhotoLayout> {
    try {
      const existingLayout = await this.getPhotoLayout(albumId);
      const updatedLayout = {
        ...existingLayout,
        ...updates,
        albumId,
        dateModified: new Date()
      };

      await db.photoLayouts.update(albumId, updatedLayout);
      return updatedLayout;
    } catch (error) {
      throw new StorageError(
        `Failed to update photo layout: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Settings operations

  /**
   * Get app settings
   */
  async getAppSettings(): Promise<AppSettings> {
    try {
      const settings = await db.appSettings.get('main');
      if (!settings) {
        const { DEFAULT_SETTINGS } = await import('@/models/AppSettings');
        await db.appSettings.add(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
      return settings;
    } catch (error) {
      throw new StorageError(
        `Failed to get app settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update app settings
   */
  async updateAppSettings(updates: AppSettingsUpdateData): Promise<AppSettings> {
    try {
      const existingSettings = await this.getAppSettings();
      const updatedSettings = {
        ...existingSettings,
        ...updates,
        id: 'main',
        dateModified: new Date()
      };

      const { AppSettingsValidation } = await import('@/models/AppSettings');
      const validation = AppSettingsValidation.validate(updatedSettings);
      if (!validation.valid) {
        throw new StorageError(`Invalid settings data: ${validation.errors.join(', ')}`);
      }

      await db.appSettings.update('main', updatedSettings);
      return updatedSettings;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to update app settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Utility operations

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const stats = await db.getUsageStats();
      const dbInfo = await db.getDatabaseInfo();

      return {
        totalPhotos: stats.photosCount,
        totalAlbums: stats.albumsCount,
        totalTags: stats.tagsCount,
        totalSize: stats.estimatedSize,
        databaseVersion: dbInfo.version
      };
    } catch (error) {
      throw new StorageError(
        `Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cleanup orphaned data
   */
  async cleanup(): Promise<{ orphanedPhotos: number; orphanedTags: number; orphanedLayouts: number }> {
    try {
      return await db.cleanup();
    } catch (error) {
      throw new StorageError(
        `Failed to cleanup storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    try {
      const result = await db.healthCheck();
      return {
        healthy: result.healthy,
        issues: result.issues
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [`Storage health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

/**
 * Singleton storage service instance
 */
export const storageService = new StorageService();

/**
 * Default export
 */
export default storageService;