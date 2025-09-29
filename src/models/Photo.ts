/**
 * Photo model representing an individual image file with metadata
 */

export interface PhotoLocation {
  latitude: number;
  longitude: number;
}

export interface Photo {
  // Core Identification
  id: string; // UUID v4
  fileName: string; // Original filename
  filePath: string; // File system path or handle reference
  fileSize: number; // File size in bytes
  mimeType: string; // MIME type (image/jpeg, image/png, etc.)
  width: number; // Image width in pixels
  height: number; // Image height in pixels

  // Metadata
  dateTaken: Date; // From EXIF or file creation date
  dateAdded: Date; // When added to PhotoManager
  dateModified: Date; // Last modification timestamp

  // EXIF Data (optional)
  camera?: string; // Camera make/model
  location?: PhotoLocation; // GPS coordinates

  // User Data
  caption?: string; // User-added description
  tags: string[]; // User-added tags

  // Computed Properties
  thumbnailDataUrl?: string; // Cached thumbnail (base64)
  albumIds: string[]; // Albums containing this photo
}

/**
 * Validation rules for Photo model
 */
export class PhotoValidation {
  private static readonly SUPPORTED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
  ];

  private static readonly MAX_CAPTION_LENGTH = 1000;
  private static readonly MAX_FILENAME_LENGTH = 255;

  /**
   * Validate a photo object against business rules
   */
  static validate(photo: Partial<Photo>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!photo.id || !this.isValidUUID(photo.id)) {
      errors.push('ID is required and must be a valid UUID');
    }

    if (!photo.fileName || photo.fileName.trim().length === 0) {
      errors.push('File name is required');
    } else if (photo.fileName.length > this.MAX_FILENAME_LENGTH) {
      errors.push(`File name must not exceed ${this.MAX_FILENAME_LENGTH} characters`);
    }

    if (!photo.filePath || photo.filePath.trim().length === 0) {
      errors.push('File path is required');
    }

    if (typeof photo.fileSize !== 'number' || photo.fileSize <= 0) {
      errors.push('File size must be a positive number');
    }

    if (!photo.mimeType || !this.SUPPORTED_MIME_TYPES.includes(photo.mimeType)) {
      errors.push(`MIME type must be one of: ${this.SUPPORTED_MIME_TYPES.join(', ')}`);
    }

    if (typeof photo.width !== 'number' || photo.width <= 0) {
      errors.push('Width must be a positive number');
    }

    if (typeof photo.height !== 'number' || photo.height <= 0) {
      errors.push('Height must be a positive number');
    }

    if (!photo.dateTaken || !(photo.dateTaken instanceof Date)) {
      errors.push('Date taken is required and must be a valid Date');
    }

    // Optional fields validation
    if (photo.caption && photo.caption.length > this.MAX_CAPTION_LENGTH) {
      errors.push(`Caption must not exceed ${this.MAX_CAPTION_LENGTH} characters`);
    }

    if (photo.tags && !Array.isArray(photo.tags)) {
      errors.push('Tags must be an array');
    } else if (photo.tags) {
      const invalidTags = photo.tags.filter(tag => !tag || typeof tag !== 'string' || tag.trim().length === 0);
      if (invalidTags.length > 0) {
        errors.push('All tags must be non-empty strings');
      }
    }

    if (photo.albumIds && !Array.isArray(photo.albumIds)) {
      errors.push('Album IDs must be an array');
    }

    if (photo.location) {
      if (typeof photo.location.latitude !== 'number' || typeof photo.location.longitude !== 'number') {
        errors.push('Location coordinates must be numbers');
      }
      if (photo.location.latitude < -90 || photo.location.latitude > 90) {
        errors.push('Latitude must be between -90 and 90');
      }
      if (photo.location.longitude < -180 || photo.location.longitude > 180) {
        errors.push('Longitude must be between -180 and 180');
      }
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
   * Check if MIME type is supported
   */
  static isSupportedMimeType(mimeType: string): boolean {
    return this.SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase());
  }

  /**
   * Normalize tag name (lowercase, trim)
   */
  static normalizeTag(tag: string): string {
    return tag.toLowerCase().trim().replace(/\s+/g, '-');
  }

  /**
   * Sanitize caption text
   */
  static sanitizeCaption(caption: string): string {
    return caption.trim().replace(/\s+/g, ' ');
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
 * Helper functions for Photo model
 */
export class PhotoUtils {
  /**
   * Generate a new UUID v4
   */
  static generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new Photo with default values
   */
  static create(data: {
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    width: number;
    height: number;
    dateTaken: Date;
    camera?: string;
    location?: PhotoLocation;
  }): Photo {
    const now = new Date();

    return {
      id: this.generateId(),
      fileName: data.fileName,
      filePath: data.filePath,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      width: data.width,
      height: data.height,
      dateTaken: data.dateTaken,
      dateAdded: now,
      dateModified: now,
      camera: data.camera,
      location: data.location,
      caption: '',
      tags: [],
      albumIds: [],
    };
  }

  /**
   * Calculate aspect ratio
   */
  static getAspectRatio(photo: Photo): number {
    return photo.width / photo.height;
  }

  /**
   * Check if photo is landscape orientation
   */
  static isLandscape(photo: Photo): boolean {
    return photo.width > photo.height;
  }

  /**
   * Check if photo is portrait orientation
   */
  static isPortrait(photo: Photo): boolean {
    return photo.height > photo.width;
  }

  /**
   * Check if photo is square
   */
  static isSquare(photo: Photo): boolean {
    return photo.width === photo.height;
  }

  /**
   * Get file extension from filename
   */
  static getFileExtension(photo: Photo): string {
    const lastDot = photo.fileName.lastIndexOf('.');
    return lastDot !== -1 ? photo.fileName.substring(lastDot + 1).toLowerCase() : '';
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Update photo metadata while preserving ID and core data
   */
  static updateMetadata(photo: Photo, updates: {
    caption?: string;
    tags?: string[];
    location?: PhotoLocation;
  }): Photo {
    return {
      ...photo,
      caption: updates.caption !== undefined ? PhotoValidation.sanitizeCaption(updates.caption) : photo.caption,
      tags: updates.tags !== undefined ? updates.tags.map(PhotoValidation.normalizeTag) : photo.tags,
      location: updates.location !== undefined ? updates.location : photo.location,
      dateModified: new Date(),
    };
  }

  /**
   * Add photo to album
   */
  static addToAlbum(photo: Photo, albumId: string): Photo {
    if (photo.albumIds.includes(albumId)) {
      return photo; // Already in album
    }

    return {
      ...photo,
      albumIds: [...photo.albumIds, albumId],
      dateModified: new Date(),
    };
  }

  /**
   * Remove photo from album
   */
  static removeFromAlbum(photo: Photo, albumId: string): Photo {
    return {
      ...photo,
      albumIds: photo.albumIds.filter(id => id !== albumId),
      dateModified: new Date(),
    };
  }

  /**
   * Deep clone photo object
   */
  static clone(photo: Photo): Photo {
    return {
      ...photo,
      tags: [...photo.tags],
      albumIds: [...photo.albumIds],
      location: photo.location ? { ...photo.location } : undefined,
    };
  }
}

/**
 * Export types for external use
 */
export type PhotoCreateData = Parameters<typeof PhotoUtils.create>[0];
export type PhotoUpdateData = Parameters<typeof PhotoUtils.updateMetadata>[1];

/**
 * Default export
 */
export default Photo;