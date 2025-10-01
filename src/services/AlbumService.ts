/**
 * AlbumService implementation for album management operations
 */

import { storageService } from './StorageService';
import { photoService } from './PhotoService';
import type { Album, AlbumCreateData, AlbumUpdateData, AlbumType } from '@/models/Album';
import type { Photo } from '@/models/Photo';

/**
 * Album error types
 */
export class AlbumNotFoundError extends Error {
  constructor(id: string) {
    super(`Album with ID '${id}' not found`);
    this.name = 'AlbumNotFoundError';
  }
}

export class AlbumNameConflictError extends Error {
  constructor(name: string) {
    super(`Album with name '${name}' already exists`);
    this.name = 'AlbumNameConflictError';
  }
}

export class AlbumValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'AlbumValidationError';
  }
}

export class AlbumOperationError extends Error {
  constructor(message: string, public operation: string) {
    super(message);
    this.name = 'AlbumOperationError';
  }
}

/**
 * Photo move operation for reordering
 */
export interface PhotoMoveOperation {
  photoId: string;
  fromIndex: number;
  toIndex: number;
}

/**
 * Album creation options
 */
export interface AlbumCreationOptions {
  autoGeneratePosition?: boolean;
  validatePhotos?: boolean;
}

/**
 * Album query options
 */
export interface AlbumQueryOptions {
  type?: AlbumType;
  year?: number;
  month?: number;
  includeEmpty?: boolean;
  sortBy?: 'position' | 'name' | 'dateCreated' | 'photoCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Album statistics
 */
export interface AlbumStatistics {
  totalAlbums: number;
  customAlbums: number;
  dateAlbums: number;
  emptyAlbums: number;
  totalPhotos: number;
  averagePhotosPerAlbum: number;
  largestAlbum: {
    album: Album;
    photoCount: number;
  } | null;
  oldestAlbum?: Album;
  newestAlbum?: Album;
  albumsByYear: Array<{ year: number; count: number }>;
}

/**
 * AlbumService implementation
 */
export class AlbumService {
  /**
   * Initialize album service
   */
  async initialize(): Promise<void> {
    await storageService.initialize();
  }

  /**
   * Create a new album
   */
  async createAlbum(
    albumData: AlbumCreateData,
    options: AlbumCreationOptions = {}
  ): Promise<Album> {
    const { autoGeneratePosition = true, validatePhotos = true } = options;

    // Validate album data
    const { AlbumValidation } = await import('@/models/Album');
    const validation = AlbumValidation.validate(albumData);
    if (!validation.isValid) {
      throw new AlbumValidationError(
        `Invalid album data: ${validation.errors.join(', ')}`,
        validation.errors
      );
    }

    // Auto-generate position if not provided
    if (autoGeneratePosition && albumData.position === undefined) {
      albumData.position = await this.getNextPosition(albumData.type);
    }

    try {
      const album = await storageService.createAlbum(albumData);
      return album;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new AlbumNameConflictError(albumData.name);
      }
      throw new AlbumOperationError(
        `Failed to create album: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'create'
      );
    }
  }

  /**
   * Get album by ID
   */
  async getAlbum(id: string): Promise<Album> {
    try {
      return await storageService.getAlbum(id);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new AlbumNotFoundError(id);
      }
      throw error;
    }
  }

  /**
   * Update album
   */
  async updateAlbum(id: string, updates: AlbumUpdateData): Promise<Album> {
    // Validate updates
    if (updates.name || updates.type || updates.year || updates.month) {
      const existingAlbum = await this.getAlbum(id);
      const updatedAlbum = { ...existingAlbum, ...updates };

      const { AlbumValidation } = await import('@/models/Album');
      const validation = AlbumValidation.validate(updatedAlbum);
      if (!validation.isValid) {
        throw new AlbumValidationError(
          `Invalid album update data: ${validation.errors.join(', ')}`,
          validation.errors
        );
      }
    }

    try {
      return await storageService.updateAlbum(id, updates);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new AlbumNameConflictError(updates.name || '');
      }
      throw new AlbumOperationError(
        `Failed to update album: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'update'
      );
    }
  }

  /**
   * Delete album
   */
  async deleteAlbum(id: string, options: { preservePhotos?: boolean } = {}): Promise<void> {
    const { preservePhotos = true } = options;

    const album = await this.getAlbum(id);

    // Prevent deletion of date albums if they have photos (unless explicitly allowed)
    if (album.type === 'date' && album.photoCount > 0 && preservePhotos) {
      throw new AlbumOperationError(
        'Cannot delete date album with photos. Remove photos first or set preservePhotos to false.',
        'delete'
      );
    }

    try {
      await storageService.deleteAlbum(id);
    } catch (error) {
      throw new AlbumOperationError(
        `Failed to delete album: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'delete'
      );
    }
  }

  /**
   * Query albums with options
   */
  async queryAlbums(options: AlbumQueryOptions = {}): Promise<Album[]> {
    const albums = await storageService.queryAlbums({
      type: options.type,
      year: options.year,
      month: options.month,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      limit: options.limit,
      offset: options.offset
    });

    // Filter empty albums if requested
    if (options.includeEmpty === false) {
      return albums.filter(album => album.photoCount > 0);
    }

    return albums;
  }

  /**
   * Get all albums (convenience method)
   */
  async getAllAlbums(): Promise<Album[]> {
    return await this.queryAlbums({
      sortBy: 'position',
      sortOrder: 'asc'
    });
  }

  /**
   * Get custom albums only
   */
  async getCustomAlbums(): Promise<Album[]> {
    return await this.queryAlbums({
      type: 'custom',
      sortBy: 'position',
      sortOrder: 'asc'
    });
  }

  /**
   * Get date albums for a specific year
   */
  async getDateAlbumsForYear(year: number): Promise<Album[]> {
    return await this.queryAlbums({
      type: 'date',
      year,
      sortBy: 'position',
      sortOrder: 'asc'
    });
  }

  /**
   * Get photos in album
   */
  async getPhotosInAlbum(albumId: string): Promise<Photo[]> {
    await this.getAlbum(albumId); // Verify album exists
    return await photoService.getPhotosInAlbum(albumId);
  }

  /**
   * Add photos to album
   */
  async addPhotosToAlbum(albumId: string, photoIds: string[]): Promise<void> {
    await this.getAlbum(albumId); // Verify album exists

    // Validate all photos exist
    for (const photoId of photoIds) {
      await photoService.getPhoto(photoId);
    }

    try {
      await photoService.addPhotosToAlbum(photoIds, albumId);
    } catch (error) {
      throw new AlbumOperationError(
        `Failed to add photos to album: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'addPhotos'
      );
    }
  }

  /**
   * Remove photos from album
   */
  async removePhotosFromAlbum(albumId: string, photoIds: string[]): Promise<void> {
    await this.getAlbum(albumId); // Verify album exists

    try {
      await photoService.removePhotosFromAlbum(photoIds, albumId);
    } catch (error) {
      throw new AlbumOperationError(
        `Failed to remove photos from album: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'removePhotos'
      );
    }
  }

  /**
   * Reorder photos within album
   */
  async reorderPhotosInAlbum(albumId: string, moves: PhotoMoveOperation[]): Promise<void> {
    const album = await this.getAlbum(albumId);
    const photos = await this.getPhotosInAlbum(albumId);

    // Create a working copy of photo IDs in current order
    let photoIds = photos
      .sort((a, b) => (a.dateTaken || a.dateAdded).getTime() - (b.dateTaken || b.dateAdded).getTime())
      .map(photo => photo.id);

    // Validate moves
    for (const move of moves) {
      if (!photos.find(p => p.id === move.photoId)) {
        throw new AlbumOperationError(
          `Photo ${move.photoId} not found in album ${albumId}`,
          'reorderPhotos'
        );
      }

      if (move.fromIndex < 0 || move.fromIndex >= photoIds.length ||
          move.toIndex < 0 || move.toIndex >= photoIds.length) {
        throw new AlbumOperationError(
          `Invalid move operation: ${move.fromIndex} -> ${move.toIndex}`,
          'reorderPhotos'
        );
      }
    }

    // Apply moves in order
    for (const move of moves) {
      const currentIndex = photoIds.indexOf(move.photoId);
      if (currentIndex !== -1) {
        // Remove from current position
        const [photoId] = photoIds.splice(currentIndex, 1);
        // Insert at new position
        photoIds.splice(move.toIndex, 0, photoId);
      }
    }

    // Update photo layout to reflect new order
    const photoLayout = await storageService.getPhotoLayout(albumId);
    await storageService.updatePhotoLayout(albumId, {
      ...photoLayout,
      customOrder: photoIds
    });
  }

  /**
   * Reorder albums
   */
  async reorderAlbums(albumMoves: Array<{ albumId: string; newPosition: number }>): Promise<void> {
    // Validate all albums exist
    const albums = new Map<string, Album>();
    for (const move of albumMoves) {
      const album = await this.getAlbum(move.albumId);
      albums.set(move.albumId, album);
    }

    // Update positions
    for (const move of albumMoves) {
      await storageService.updateAlbum(move.albumId, {
        position: move.newPosition
      });
    }
  }

  /**
   * Create date album automatically from photo date
   */
  async createDateAlbumFromPhoto(photo: Photo): Promise<Album> {
    const date = photo.dateTaken || photo.dateAdded;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const albumName = `${monthNames[month - 1]} ${year}`;

    // Check if album already exists
    const existingAlbums = await this.queryAlbums({
      type: 'date',
      year,
      month
    });

    if (existingAlbums.length > 0) {
      return existingAlbums[0];
    }

    // Create new date album
    return await this.createAlbum({
      name: albumName,
      type: 'date',
      year,
      month,
      position: year * 100 + month
    });
  }

  /**
   * Auto-organize photos into date albums
   */
  async autoOrganizePhotosByDate(photoIds?: string[]): Promise<{
    albumsCreated: Album[];
    photosOrganized: number;
    errors: string[];
  }> {
    const albumsCreated: Album[] = [];
    const errors: string[] = [];
    let photosOrganized = 0;

    // Get photos to organize
    const photos = photoIds
      ? await Promise.all(photoIds.map(id => photoService.getPhoto(id)))
      : await photoService.searchPhotos({});

    for (const photo of photos) {
      try {
        const album = await this.createDateAlbumFromPhoto(photo);

        // Check if album was newly created
        if (!albumsCreated.find(a => a.id === album.id)) {
          const isNew = album.dateCreated.getTime() > Date.now() - 1000; // Created within last second
          if (isNew) {
            albumsCreated.push(album);
          }
        }

        // Add photo to album if not already there
        if (!photo.albumIds.includes(album.id)) {
          await this.addPhotosToAlbum(album.id, [photo.id]);
          photosOrganized++;
        }

      } catch (error) {
        errors.push(`Failed to organize photo ${photo.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      albumsCreated,
      photosOrganized,
      errors
    };
  }

  /**
   * Get album cover photo (first photo by date taken)
   */
  async getAlbumCover(albumId: string): Promise<Photo | null> {
    const photos = await this.getPhotosInAlbum(albumId);

    if (photos.length === 0) {
      return null;
    }

    // Sort by date taken, then by date added
    const sortedPhotos = photos.sort((a, b) => {
      const dateA = a.dateTaken || a.dateAdded;
      const dateB = b.dateTaken || b.dateAdded;
      return dateA.getTime() - dateB.getTime();
    });

    return sortedPhotos[0];
  }

  /**
   * Set custom album cover
   */
  async setAlbumCover(albumId: string, photoId: string): Promise<void> {
    const album = await this.getAlbum(albumId);
    const photo = await photoService.getPhoto(photoId);

    // Verify photo is in album
    if (!photo.albumIds.includes(albumId)) {
      throw new AlbumOperationError(
        `Photo ${photoId} is not in album ${albumId}`,
        'setCover'
      );
    }

    await storageService.updateAlbum(albumId, {
      coverPhotoId: photoId
    });
  }

  /**
   * Get album statistics
   */
  async getAlbumStatistics(): Promise<AlbumStatistics> {
    const albums = await this.getAllAlbums();

    if (albums.length === 0) {
      return {
        totalAlbums: 0,
        customAlbums: 0,
        dateAlbums: 0,
        emptyAlbums: 0,
        totalPhotos: 0,
        averagePhotosPerAlbum: 0,
        largestAlbum: null,
        albumsByYear: []
      };
    }

    const customAlbums = albums.filter(a => a.type === 'custom').length;
    const dateAlbums = albums.filter(a => a.type === 'date').length;
    const emptyAlbums = albums.filter(a => a.photoCount === 0).length;
    const totalPhotos = albums.reduce((sum, album) => sum + album.photoCount, 0);
    const averagePhotosPerAlbum = totalPhotos / albums.length;

    // Find largest album
    const largestAlbum = albums.reduce((largest, album) => {
      return (largest?.photoCount || 0) < album.photoCount ? album : largest;
    }, albums[0]);

    // Sort by creation date
    const sortedByDate = albums.sort((a, b) => a.dateCreated.getTime() - b.dateCreated.getTime());
    const oldestAlbum = sortedByDate[0];
    const newestAlbum = sortedByDate[sortedByDate.length - 1];

    // Count albums by year
    const yearCounts = new Map<number, number>();
    for (const album of albums) {
      const year = album.year || album.dateCreated.getFullYear();
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }

    const albumsByYear = Array.from(yearCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count }));

    return {
      totalAlbums: albums.length,
      customAlbums,
      dateAlbums,
      emptyAlbums,
      totalPhotos,
      averagePhotosPerAlbum,
      largestAlbum: largestAlbum ? {
        album: largestAlbum,
        photoCount: largestAlbum.photoCount
      } : null,
      oldestAlbum,
      newestAlbum,
      albumsByYear
    };
  }

  /**
   * Cleanup empty albums
   */
  async cleanupEmptyAlbums(options: { excludeDate?: boolean } = {}): Promise<{
    deletedAlbums: Album[];
    errors: string[];
  }> {
    const { excludeDate = true } = options;
    const deletedAlbums: Album[] = [];
    const errors: string[] = [];

    const emptyAlbums = await this.queryAlbums({
      includeEmpty: true,
      type: excludeDate ? 'custom' : undefined
    });

    const actuallyEmpty = emptyAlbums.filter(album => album.photoCount === 0);

    for (const album of actuallyEmpty) {
      try {
        await this.deleteAlbum(album.id);
        deletedAlbums.push(album);
      } catch (error) {
        errors.push(`Failed to delete album ${album.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      deletedAlbums,
      errors
    };
  }

  /**
   * Merge albums
   */
  async mergeAlbums(
    sourceAlbumIds: string[],
    targetAlbumId: string,
    deleteSourceAlbums: boolean = true
  ): Promise<void> {
    const targetAlbum = await this.getAlbum(targetAlbumId);
    const sourceAlbums = await Promise.all(
      sourceAlbumIds.map(id => this.getAlbum(id))
    );

    // Get all photos from source albums
    const allPhotoIds = new Set<string>();
    for (const sourceAlbum of sourceAlbums) {
      const photos = await this.getPhotosInAlbum(sourceAlbum.id);
      photos.forEach(photo => allPhotoIds.add(photo.id));
    }

    // Add all photos to target album
    if (allPhotoIds.size > 0) {
      await this.addPhotosToAlbum(targetAlbumId, Array.from(allPhotoIds));
    }

    // Delete source albums if requested
    if (deleteSourceAlbums) {
      for (const sourceAlbum of sourceAlbums) {
        await this.deleteAlbum(sourceAlbum.id);
      }
    }
  }

  /**
   * Get next position for album ordering
   */
  private async getNextPosition(type: AlbumType): Promise<number> {
    const albums = await this.queryAlbums({
      type,
      sortBy: 'position',
      sortOrder: 'desc',
      limit: 1
    });

    if (albums.length === 0) {
      return type === 'date' ? 100000 : 1000; // Start date albums at higher numbers
    }

    return albums[0].position + 1;
  }

  /**
   * Duplicate album detection
   */
  async findDuplicateAlbums(): Promise<Array<{
    albums: Album[];
    reason: string;
    confidence: number;
  }>> {
    const albums = await this.getAllAlbums();
    const duplicateGroups: Array<{
      albums: Album[];
      reason: string;
      confidence: number;
    }> = [];

    // Group by name (case-insensitive)
    const nameGroups = new Map<string, Album[]>();
    for (const album of albums) {
      const normalizedName = album.name.toLowerCase().trim();
      const group = nameGroups.get(normalizedName) || [];
      group.push(album);
      nameGroups.set(normalizedName, group);
    }

    for (const [name, group] of nameGroups) {
      if (group.length > 1) {
        duplicateGroups.push({
          albums: group,
          reason: `Albums with identical name: "${name}"`,
          confidence: 0.9
        });
      }
    }

    // Check date albums for same year/month
    const dateAlbums = albums.filter(a => a.type === 'date');
    const dateGroups = new Map<string, Album[]>();

    for (const album of dateAlbums) {
      if (album.year && album.month) {
        const key = `${album.year}-${album.month}`;
        const group = dateGroups.get(key) || [];
        group.push(album);
        dateGroups.set(key, group);
      }
    }

    for (const [dateKey, group] of dateGroups) {
      if (group.length > 1) {
        duplicateGroups.push({
          albums: group,
          reason: `Multiple date albums for ${dateKey}`,
          confidence: 1.0
        });
      }
    }

    return duplicateGroups;
  }
}

/**
 * Singleton album service instance
 */
export const albumService = new AlbumService();

/**
 * Default export
 */
export default albumService;