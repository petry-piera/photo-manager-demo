/**
 * PhotoService Contract
 * Defines the interface for photo management operations
 */

import { Photo } from '../data-model';

export interface PhotoImportOptions {
  autoOrganizeByDate?: boolean;
  duplicateHandling?: 'skip' | 'rename' | 'ask';
  generateThumbnails?: boolean;
}

export interface PhotoSearchCriteria {
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  caption?: string;
  albumId?: string;
}

export interface PhotoUpdateData {
  caption?: string;
  tags?: string[];
}

export interface ExifData {
  dateTaken?: Date;
  camera?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  width?: number;
  height?: number;
}

export interface PhotoService {
  /**
   * Import photos from file handles
   * @param fileHandles - Array of file system handles or File objects
   * @param options - Import configuration options
   * @returns Promise resolving to array of imported photo IDs
   * @throws PhotoImportError when files cannot be processed
   */
  importPhotos(fileHandles: FileSystemFileHandle[] | File[], options?: PhotoImportOptions): Promise<string[]>;

  /**
   * Get photo by ID
   * @param photoId - Unique photo identifier
   * @returns Promise resolving to photo data or null if not found
   */
  getPhoto(photoId: string): Promise<Photo | null>;

  /**
   * Get multiple photos by IDs
   * @param photoIds - Array of photo identifiers
   * @returns Promise resolving to array of photos (nulls for not found)
   */
  getPhotos(photoIds: string[]): Promise<(Photo | null)[]>;

  /**
   * Search photos by criteria
   * @param criteria - Search parameters
   * @returns Promise resolving to array of matching photos
   */
  searchPhotos(criteria: PhotoSearchCriteria): Promise<Photo[]>;

  /**
   * Update photo metadata
   * @param photoId - Photo identifier
   * @param updateData - Fields to update
   * @returns Promise resolving to updated photo
   * @throws PhotoNotFoundError if photo doesn't exist
   */
  updatePhoto(photoId: string, updateData: PhotoUpdateData): Promise<Photo>;

  /**
   * Delete photo and remove from all albums
   * @param photoId - Photo identifier
   * @returns Promise resolving when deletion complete
   * @throws PhotoNotFoundError if photo doesn't exist
   */
  deletePhoto(photoId: string): Promise<void>;

  /**
   * Generate thumbnail for photo
   * @param photoId - Photo identifier
   * @param maxSize - Maximum dimension in pixels
   * @param quality - JPEG quality (0-1)
   * @returns Promise resolving to thumbnail data URL
   */
  generateThumbnail(photoId: string, maxSize?: number, quality?: number): Promise<string>;

  /**
   * Extract EXIF data from photo file
   * @param fileHandle - File system handle or File object
   * @returns Promise resolving to extracted EXIF data
   */
  extractExifData(fileHandle: FileSystemFileHandle | File): Promise<ExifData>;

  /**
   * Get photo file data for display
   * @param photoId - Photo identifier
   * @returns Promise resolving to file data URL or blob URL
   */
  getPhotoFileData(photoId: string): Promise<string>;

  /**
   * Validate photo file format
   * @param file - File to validate
   * @returns Boolean indicating if format is supported
   */
  isValidPhotoFormat(file: File): boolean;
}

export class PhotoImportError extends Error {
  constructor(message: string, public readonly failedFiles: string[]) {
    super(message);
    this.name = 'PhotoImportError';
  }
}

export class PhotoNotFoundError extends Error {
  constructor(photoId: string) {
    super(`Photo not found: ${photoId}`);
    this.name = 'PhotoNotFoundError';
  }
}