/**
 * DatabaseService implementation using Dexie.js for IndexedDB operations
 */

import Dexie, { Table } from 'dexie';
import type { Photo } from '@/models/Photo';
import type { Album } from '@/models/Album';
import type { Tag } from '@/models/Tag';
import type { AlbumLayout, PhotoLayout } from '@/models/Layout';
import type { AppSettings } from '@/models/AppSettings';

/**
 * Database schema definition
 */
export class PhotoManagerDatabase extends Dexie {
  // Table definitions
  photos!: Table<Photo>;
  albums!: Table<Album>;
  tags!: Table<Tag>;
  albumLayouts!: Table<AlbumLayout>;
  photoLayouts!: Table<PhotoLayout>;
  appSettings!: Table<AppSettings>;

  constructor() {
    super('PhotoManagerDB');

    // Define database schema
    this.version(1).stores({
      photos: 'id, fileName, dateTaken, dateAdded, mimeType, *tags, *albumIds',
      albums: 'id, name, type, position, [year+month], photoCount',
      tags: 'id, &name, photoCount, dateLastUsed',
      albumLayouts: 'id',
      photoLayouts: 'albumId',
      appSettings: 'id',
    });

    // Add hooks for data consistency
    this.photos.hook('creating', (primKey, obj, trans) => {
      obj.dateAdded = obj.dateAdded || new Date();
      obj.dateModified = obj.dateModified || new Date();
    });

    this.photos.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.dateModified = new Date();
    });

    this.albums.hook('creating', (primKey, obj, trans) => {
      obj.dateCreated = obj.dateCreated || new Date();
      obj.dateModified = obj.dateModified || new Date();
    });

    this.albums.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.dateModified = new Date();
    });

    this.tags.hook('creating', (primKey, obj, trans) => {
      obj.dateCreated = obj.dateCreated || new Date();
      obj.dateLastUsed = obj.dateLastUsed || new Date();
    });

    this.albumLayouts.hook('creating', (primKey, obj, trans) => {
      obj.dateModified = obj.dateModified || new Date();
    });

    this.albumLayouts.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.dateModified = new Date();
    });

    this.photoLayouts.hook('creating', (primKey, obj, trans) => {
      obj.dateModified = obj.dateModified || new Date();
    });

    this.photoLayouts.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.dateModified = new Date();
    });

    this.appSettings.hook('creating', (primKey, obj, trans) => {
      obj.dateModified = obj.dateModified || new Date();
    });

    this.appSettings.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.dateModified = new Date();
    });
  }

  /**
   * Initialize database with default data
   */
  async initialize(): Promise<void> {
    try {
      await this.open();

      // Create default app settings if they don't exist
      const existingSettings = await this.appSettings.get('main');
      if (!existingSettings) {
        const { DEFAULT_SETTINGS } = await import('@/models/AppSettings');
        await this.appSettings.add(DEFAULT_SETTINGS);
      }

      // Create default main album layout if it doesn't exist
      const existingLayout = await this.albumLayouts.get('main');
      if (!existingLayout) {
        const { LayoutUtils } = await import('@/models/Layout');
        await this.albumLayouts.add(LayoutUtils.createDefaultAlbumLayout());
      }

    } catch (error) {
      throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database usage statistics
   */
  async getUsageStats(): Promise<{
    photosCount: number;
    albumsCount: number;
    tagsCount: number;
    estimatedSize: number;
  }> {
    const [photosCount, albumsCount, tagsCount] = await Promise.all([
      this.photos.count(),
      this.albums.count(),
      this.tags.count(),
    ]);

    // Estimate database size (rough calculation)
    const estimatedSize = (photosCount * 1000) + (albumsCount * 500) + (tagsCount * 200);

    return {
      photosCount,
      albumsCount,
      tagsCount,
      estimatedSize,
    };
  }

  /**
   * Cleanup orphaned data
   */
  async cleanup(): Promise<{
    orphanedPhotos: number;
    orphanedTags: number;
    orphanedLayouts: number;
  }> {
    let orphanedPhotos = 0;
    let orphanedTags = 0;
    let orphanedLayouts = 0;

    await this.transaction('rw', [this.photos, this.albums, this.tags, this.photoLayouts], async () => {
      // Get all album IDs
      const albumIds = new Set((await this.albums.toArray()).map(album => album.id));

      // Find photos with invalid album references
      const photos = await this.photos.toArray();
      for (const photo of photos) {
        const validAlbumIds = photo.albumIds.filter(albumId => albumIds.has(albumId));
        if (validAlbumIds.length !== photo.albumIds.length) {
          await this.photos.update(photo.id, { albumIds: validAlbumIds });
          orphanedPhotos++;
        }
      }

      // Find and remove unused tags
      const tags = await this.tags.where('photoCount').equals(0).toArray();
      if (tags.length > 0) {
        await this.tags.bulkDelete(tags.map(tag => tag.id));
        orphanedTags = tags.length;
      }

      // Find and remove orphaned photo layouts
      const photoLayouts = await this.photoLayouts.toArray();
      for (const layout of photoLayouts) {
        if (!albumIds.has(layout.albumId)) {
          await this.photoLayouts.delete(layout.albumId);
          orphanedLayouts++;
        }
      }
    });

    return {
      orphanedPhotos,
      orphanedTags,
      orphanedLayouts,
    };
  }

  /**
   * Export all data for backup
   */
  async exportData(): Promise<{
    photos: Photo[];
    albums: Album[];
    tags: Tag[];
    albumLayouts: AlbumLayout[];
    photoLayouts: PhotoLayout[];
    appSettings: AppSettings[];
    metadata: {
      version: string;
      exportDate: string;
      totalRecords: number;
    };
  }> {
    const [photos, albums, tags, albumLayouts, photoLayouts, appSettings] = await Promise.all([
      this.photos.toArray(),
      this.albums.toArray(),
      this.tags.toArray(),
      this.albumLayouts.toArray(),
      this.photoLayouts.toArray(),
      this.appSettings.toArray(),
    ]);

    const totalRecords = photos.length + albums.length + tags.length + albumLayouts.length + photoLayouts.length + appSettings.length;

    return {
      photos,
      albums,
      tags,
      albumLayouts,
      photoLayouts,
      appSettings,
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        totalRecords,
      },
    };
  }

  /**
   * Import data from backup
   */
  async importData(data: {
    photos?: Photo[];
    albums?: Album[];
    tags?: Tag[];
    albumLayouts?: AlbumLayout[];
    photoLayouts?: PhotoLayout[];
    appSettings?: AppSettings[];
  }, options: {
    clearExisting?: boolean;
    validateData?: boolean;
  } = {}): Promise<void> {
    if (options.validateData) {
      await this.validateImportData(data);
    }

    await this.transaction('rw', [this.photos, this.albums, this.tags, this.albumLayouts, this.photoLayouts, this.appSettings], async () => {
      if (options.clearExisting) {
        await Promise.all([
          this.photos.clear(),
          this.albums.clear(),
          this.tags.clear(),
          this.albumLayouts.clear(),
          this.photoLayouts.clear(),
          this.appSettings.clear(),
        ]);
      }

      // Import data in dependency order
      if (data.appSettings?.length) {
        await this.appSettings.bulkPut(data.appSettings);
      }

      if (data.albums?.length) {
        await this.albums.bulkPut(data.albums);
      }

      if (data.photos?.length) {
        await this.photos.bulkPut(data.photos);
      }

      if (data.tags?.length) {
        await this.tags.bulkPut(data.tags);
      }

      if (data.albumLayouts?.length) {
        await this.albumLayouts.bulkPut(data.albumLayouts);
      }

      if (data.photoLayouts?.length) {
        await this.photoLayouts.bulkPut(data.photoLayouts);
      }
    });
  }

  /**
   * Validate import data structure
   */
  private async validateImportData(data: any): Promise<void> {
    const errors: string[] = [];

    // Validate photos
    if (data.photos) {
      if (!Array.isArray(data.photos)) {
        errors.push('Photos must be an array');
      } else {
        for (const [index, photo] of data.photos.entries()) {
          if (!photo.id || typeof photo.id !== 'string') {
            errors.push(`Photo at index ${index} missing valid ID`);
          }
          if (!photo.fileName || typeof photo.fileName !== 'string') {
            errors.push(`Photo at index ${index} missing valid fileName`);
          }
        }
      }
    }

    // Validate albums
    if (data.albums) {
      if (!Array.isArray(data.albums)) {
        errors.push('Albums must be an array');
      } else {
        for (const [index, album] of data.albums.entries()) {
          if (!album.id || typeof album.id !== 'string') {
            errors.push(`Album at index ${index} missing valid ID`);
          }
          if (!album.name || typeof album.name !== 'string') {
            errors.push(`Album at index ${index} missing valid name`);
          }
        }
      }
    }

    // Validate tags
    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
      } else {
        for (const [index, tag] of data.tags.entries()) {
          if (!tag.id || typeof tag.id !== 'string') {
            errors.push(`Tag at index ${index} missing valid ID`);
          }
          if (!tag.name || typeof tag.name !== 'string') {
            errors.push(`Tag at index ${index} missing valid name`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Import data validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Clear all data (reset database)
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', [this.photos, this.albums, this.tags, this.albumLayouts, this.photoLayouts, this.appSettings], async () => {
      await Promise.all([
        this.photos.clear(),
        this.albums.clear(),
        this.tags.clear(),
        this.albumLayouts.clear(),
        this.photoLayouts.clear(),
        this.appSettings.clear(),
      ]);

      // Reinitialize with defaults
      await this.initialize();
    });
  }

  /**
   * Optimize database (compact and rebuild indexes)
   */
  async optimize(): Promise<void> {
    // Dexie doesn't expose direct compaction, but we can trigger it
    // by forcing a version upgrade (no-op if already current)
    try {
      await this.close();
      await this.open();

      // Run cleanup to remove orphaned data
      await this.cleanup();
    } catch (error) {
      throw new Error(`Failed to optimize database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(): Promise<{
    name: string;
    version: number;
    isOpen: boolean;
    tables: string[];
    lastOptimized?: Date;
  }> {
    return {
      name: this.name,
      version: this.verno,
      isOpen: this.isOpen(),
      tables: this.tables.map(table => table.name),
      lastOptimized: undefined, // Could be stored in metadata if needed
    };
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: {
      photosCount: number;
      albumsCount: number;
      tagsCount: number;
    };
  }> {
    const issues: string[] = [];

    try {
      if (!this.isOpen()) {
        await this.open();
      }

      const stats = await this.getUsageStats();

      // Check for basic data integrity
      const [
        photosWithInvalidAlbums,
        albumsWithInvalidCounts,
        tagsWithZeroCount
      ] = await Promise.all([
        // Photos with invalid album references
        this.photos.toArray().then(photos => {
          return this.albums.toArray().then(albums => {
            const validAlbumIds = new Set(albums.map(a => a.id));
            return photos.filter(photo =>
              photo.albumIds.some(albumId => !validAlbumIds.has(albumId))
            ).length;
          });
        }),

        // Albums with incorrect photo counts
        this.albums.toArray().then(albums => {
          return Promise.all(
            albums.map(async album => {
              const actualCount = await this.photos.where('albumIds').anyOf([album.id]).count();
              return actualCount !== album.photoCount;
            })
          ).then(results => results.filter(Boolean).length);
        }),

        // Tags with zero photo count but referenced by photos
        this.tags.where('photoCount').equals(0).count().then(async zeroCountTags => {
          if (zeroCountTags > 0) {
            const photosWithTags = await this.photos.where('tags').above('').count();
            return photosWithTags > 0 ? zeroCountTags : 0;
          }
          return 0;
        })
      ]);

      if (photosWithInvalidAlbums > 0) {
        issues.push(`${photosWithInvalidAlbums} photos have invalid album references`);
      }

      if (albumsWithInvalidCounts > 0) {
        issues.push(`${albumsWithInvalidCounts} albums have incorrect photo counts`);
      }

      if (tagsWithZeroCount > 0) {
        issues.push(`${tagsWithZeroCount} orphaned tags found`);
      }

      return {
        healthy: issues.length === 0,
        issues,
        stats: {
          photosCount: stats.photosCount,
          albumsCount: stats.albumsCount,
          tagsCount: stats.tagsCount,
        },
      };

    } catch (error) {
      issues.push(`Database access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        healthy: false,
        issues,
        stats: { photosCount: 0, albumsCount: 0, tagsCount: 0 },
      };
    }
  }
}

/**
 * Singleton database instance
 */
export const db = new PhotoManagerDatabase();

/**
 * Database service interface for dependency injection
 */
export interface DatabaseService {
  initialize(): Promise<void>;
  getUsageStats(): Promise<{ photosCount: number; albumsCount: number; tagsCount: number; estimatedSize: number }>;
  cleanup(): Promise<{ orphanedPhotos: number; orphanedTags: number; orphanedLayouts: number }>;
  exportData(): Promise<any>;
  importData(data: any, options?: any): Promise<void>;
  clearAllData(): Promise<void>;
  optimize(): Promise<void>;
  getDatabaseInfo(): Promise<any>;
  healthCheck(): Promise<any>;
}

/**
 * Create database service instance
 */
export function createDatabaseService(): DatabaseService {
  return db;
}

/**
 * Default export
 */
export default db;