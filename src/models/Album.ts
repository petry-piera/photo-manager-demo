/**
 * Album model representing a collection of photos
 */

export type AlbumType = 'date' | 'custom';

export interface Album {
  // Core Identification
  id: string; // UUID v4
  name: string; // User-defined or auto-generated name
  type: AlbumType; // Album type

  // Date Albums (type: 'date')
  year?: number; // Year for date-based albums
  month?: number; // Month (1-12) for date-based albums

  // Organization
  coverPhotoId?: string; // Photo ID for album thumbnail
  photoIds: string[]; // Ordered list of photo IDs
  position: number; // Display order in album grid

  // Metadata
  dateCreated: Date;
  dateModified: Date;
  photoCount: number; // Computed field
}

/**
 * Validation rules for Album model
 */
export class AlbumValidation {
  private static readonly MAX_NAME_LENGTH = 100;
  private static readonly MIN_NAME_LENGTH = 1;
  private static readonly CURRENT_YEAR = new Date().getFullYear();
  private static readonly MIN_YEAR = 1900;

  /**
   * Validate an album object against business rules
   */
  static validate(album: Partial<Album>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!album.id || !this.isValidUUID(album.id)) {
      errors.push('ID is required and must be a valid UUID');
    }

    if (!album.name || album.name.trim().length === 0) {
      errors.push('Album name is required');
    } else if (album.name.length < this.MIN_NAME_LENGTH) {
      errors.push(`Album name must be at least ${this.MIN_NAME_LENGTH} character`);
    } else if (album.name.length > this.MAX_NAME_LENGTH) {
      errors.push(`Album name must not exceed ${this.MAX_NAME_LENGTH} characters`);
    }

    if (!album.type || !['date', 'custom'].includes(album.type)) {
      errors.push('Album type must be either "date" or "custom"');
    }

    if (typeof album.position !== 'number' || album.position < 0) {
      errors.push('Position must be a non-negative number');
    }

    if (!album.dateCreated || !(album.dateCreated instanceof Date)) {
      errors.push('Date created is required and must be a valid Date');
    }

    if (!album.photoIds || !Array.isArray(album.photoIds)) {
      errors.push('Photo IDs must be an array');
    }

    if (typeof album.photoCount !== 'number' || album.photoCount < 0) {
      errors.push('Photo count must be a non-negative number');
    }

    // Type-specific validation
    if (album.type === 'date') {
      if (typeof album.year !== 'number') {
        errors.push('Date albums must have a valid year');
      } else if (album.year < this.MIN_YEAR || album.year > this.CURRENT_YEAR + 1) {
        errors.push(`Year must be between ${this.MIN_YEAR} and ${this.CURRENT_YEAR + 1}`);
      }

      if (album.month !== undefined) {
        if (typeof album.month !== 'number' || album.month < 1 || album.month > 12) {
          errors.push('Month must be between 1 and 12');
        }
      }
    }

    // Optional fields validation
    if (album.coverPhotoId && !this.isValidUUID(album.coverPhotoId)) {
      errors.push('Cover photo ID must be a valid UUID');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if string is a valid UUID v4
   */
  private static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate album name for uniqueness (requires external validation)
   */
  static isValidName(name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length >= this.MIN_NAME_LENGTH && trimmed.length <= this.MAX_NAME_LENGTH;
  }

  /**
   * Sanitize album name
   */
  static sanitizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Helper functions for Album model
 */
export class AlbumUtils {
  /**
   * Generate a new UUID v4
   */
  static generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new custom album
   */
  static createCustom(data: {
    name: string;
    position?: number;
    coverPhotoId?: string;
  }): Album {
    const now = new Date();

    return {
      id: this.generateId(),
      name: AlbumValidation.sanitizeName(data.name),
      type: 'custom',
      photoIds: [],
      position: data.position ?? 0,
      coverPhotoId: data.coverPhotoId,
      dateCreated: now,
      dateModified: now,
      photoCount: 0,
    };
  }

  /**
   * Create a new date album
   */
  static createDate(data: {
    year: number;
    month?: number;
    position?: number;
  }): Album {
    const now = new Date();
    const name = this.generateDateAlbumName(data.year, data.month);

    return {
      id: this.generateId(),
      name,
      type: 'date',
      year: data.year,
      month: data.month,
      photoIds: [],
      position: data.position ?? 0,
      dateCreated: now,
      dateModified: now,
      photoCount: 0,
    };
  }

  /**
   * Generate standardized name for date albums
   */
  static generateDateAlbumName(year: number, month?: number): string {
    if (month) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${monthNames[month - 1]} ${year}`;
    }
    return `${year}`;
  }

  /**
   * Generate unique ID for date albums
   */
  static generateDateAlbumId(year: number, month?: number): string {
    return month ? `date-${year}-${month.toString().padStart(2, '0')}` : `date-${year}`;
  }

  /**
   * Check if album is a date album
   */
  static isDateAlbum(album: Album): boolean {
    return album.type === 'date';
  }

  /**
   * Check if album is a custom album
   */
  static isCustomAlbum(album: Album): boolean {
    return album.type === 'custom';
  }

  /**
   * Add photos to album
   */
  static addPhotos(album: Album, photoIds: string[], position?: number): Album {
    const newPhotoIds = [...album.photoIds];
    const insertIndex = position ?? newPhotoIds.length;

    // Insert photos at specified position
    newPhotoIds.splice(insertIndex, 0, ...photoIds);

    return {
      ...album,
      photoIds: newPhotoIds,
      photoCount: newPhotoIds.length,
      dateModified: new Date(),
    };
  }

  /**
   * Remove photos from album
   */
  static removePhotos(album: Album, photoIds: string[]): Album {
    const newPhotoIds = album.photoIds.filter(id => !photoIds.includes(id));

    return {
      ...album,
      photoIds: newPhotoIds,
      photoCount: newPhotoIds.length,
      dateModified: new Date(),
    };
  }

  /**
   * Reorder photos within album
   */
  static reorderPhotos(album: Album, moves: Array<{ photoId: string; fromPosition: number; toPosition: number }>): Album {
    const newPhotoIds = [...album.photoIds];

    // Process moves in order to maintain consistency
    for (const move of moves) {
      const fromIndex = newPhotoIds.indexOf(move.photoId);
      if (fromIndex !== -1 && move.toPosition >= 0 && move.toPosition < newPhotoIds.length) {
        // Remove from current position
        const [photoId] = newPhotoIds.splice(fromIndex, 1);
        // Insert at new position
        newPhotoIds.splice(move.toPosition, 0, photoId);
      }
    }

    return {
      ...album,
      photoIds: newPhotoIds,
      dateModified: new Date(),
    };
  }

  /**
   * Set cover photo for album
   */
  static setCoverPhoto(album: Album, photoId?: string): Album {
    // Validate that photo exists in album
    if (photoId && !album.photoIds.includes(photoId)) {
      throw new Error('Cover photo must be in the album');
    }

    return {
      ...album,
      coverPhotoId: photoId,
      dateModified: new Date(),
    };
  }

  /**
   * Auto-select cover photo (first photo in album)
   */
  static autoSelectCoverPhoto(album: Album): Album {
    const coverPhotoId = album.photoIds.length > 0 ? album.photoIds[0] : undefined;
    return this.setCoverPhoto(album, coverPhotoId);
  }

  /**
   * Update album metadata
   */
  static updateMetadata(album: Album, updates: {
    name?: string;
    position?: number;
    coverPhotoId?: string;
  }): Album {
    const updatedAlbum = { ...album };

    if (updates.name !== undefined) {
      updatedAlbum.name = AlbumValidation.sanitizeName(updates.name);
    }

    if (updates.position !== undefined) {
      updatedAlbum.position = updates.position;
    }

    if (updates.coverPhotoId !== undefined) {
      updatedAlbum.coverPhotoId = updates.coverPhotoId;
    }

    updatedAlbum.dateModified = new Date();

    return updatedAlbum;
  }

  /**
   * Calculate album statistics
   */
  static calculateStats(album: Album, photos: Array<{ fileSize: number; dateTaken: Date }>): {
    photoCount: number;
    totalFileSize: number;
    dateRange: { earliest: Date; latest: Date } | null;
  } {
    const photoCount = photos.length;
    const totalFileSize = photos.reduce((sum, photo) => sum + photo.fileSize, 0);

    let dateRange: { earliest: Date; latest: Date } | null = null;
    if (photos.length > 0) {
      const dates = photos.map(p => p.dateTaken).sort((a, b) => a.getTime() - b.getTime());
      dateRange = {
        earliest: dates[0],
        latest: dates[dates.length - 1],
      };
    }

    return {
      photoCount,
      totalFileSize,
      dateRange,
    };
  }

  /**
   * Deep clone album object
   */
  static clone(album: Album): Album {
    return {
      ...album,
      photoIds: [...album.photoIds],
    };
  }

  /**
   * Sort albums by various criteria
   */
  static sortAlbums(albums: Album[], sortBy: 'name' | 'dateCreated' | 'photoCount' | 'position', order: 'asc' | 'desc' = 'asc'): Album[] {
    const sorted = [...albums].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'dateCreated':
          comparison = a.dateCreated.getTime() - b.dateCreated.getTime();
          break;
        case 'photoCount':
          comparison = a.photoCount - b.photoCount;
          break;
        case 'position':
          comparison = a.position - b.position;
          break;
      }

      return order === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Filter albums by criteria
   */
  static filterAlbums(albums: Album[], filters: {
    type?: AlbumType;
    year?: number;
    month?: number;
    minPhotoCount?: number;
  }): Album[] {
    return albums.filter(album => {
      if (filters.type && album.type !== filters.type) {
        return false;
      }

      if (filters.year && album.year !== filters.year) {
        return false;
      }

      if (filters.month && album.month !== filters.month) {
        return false;
      }

      if (filters.minPhotoCount && album.photoCount < filters.minPhotoCount) {
        return false;
      }

      return true;
    });
  }
}

/**
 * Export types for external use
 */
export type AlbumCreateData = Parameters<typeof AlbumUtils.createCustom>[0];
export type DateAlbumCreateData = Parameters<typeof AlbumUtils.createDate>[0];
export type AlbumUpdateData = Parameters<typeof AlbumUtils.updateMetadata>[1];
export type PhotoMoveOperation = Parameters<typeof AlbumUtils.reorderPhotos>[1][0];

/**
 * Default export
 */
export default Album;