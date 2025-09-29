/**
 * AlbumService Contract
 * Defines the interface for album management operations
 */

import { Album, Photo } from '../data-model';

export interface AlbumCreateOptions {
  name: string;
  type: 'custom';
  coverPhotoId?: string;
}

export interface DateAlbumCreateOptions {
  year: number;
  month?: number;
  type: 'date';
}

export interface AlbumUpdateData {
  name?: string;
  coverPhotoId?: string;
  position?: number;
}

export interface AlbumSearchCriteria {
  type?: 'date' | 'custom';
  year?: number;
  month?: number;
  name?: string;
}

export interface AlbumSortOptions {
  sortBy: 'name' | 'date' | 'photoCount' | 'position';
  sortOrder: 'asc' | 'desc';
}

export interface PhotoMoveOperation {
  photoId: string;
  fromPosition: number;
  toPosition: number;
}

export interface AlbumService {
  /**
   * Create a new custom album
   * @param options - Album creation options
   * @returns Promise resolving to created album
   * @throws AlbumNameConflictError if name already exists
   */
  createAlbum(options: AlbumCreateOptions): Promise<Album>;

  /**
   * Create or get date-based album
   * @param options - Date album options
   * @returns Promise resolving to album (created or existing)
   */
  createDateAlbum(options: DateAlbumCreateOptions): Promise<Album>;

  /**
   * Get album by ID
   * @param albumId - Album identifier
   * @returns Promise resolving to album or null if not found
   */
  getAlbum(albumId: string): Promise<Album | null>;

  /**
   * Get all albums with optional filtering
   * @param criteria - Search criteria (optional)
   * @param sortOptions - Sorting options (optional)
   * @returns Promise resolving to array of albums
   */
  getAlbums(criteria?: AlbumSearchCriteria, sortOptions?: AlbumSortOptions): Promise<Album[]>;

  /**
   * Update album metadata
   * @param albumId - Album identifier
   * @param updateData - Fields to update
   * @returns Promise resolving to updated album
   * @throws AlbumNotFoundError if album doesn't exist
   * @throws AlbumNameConflictError if name conflicts
   */
  updateAlbum(albumId: string, updateData: AlbumUpdateData): Promise<Album>;

  /**
   * Delete album (photos remain in system)
   * @param albumId - Album identifier
   * @returns Promise resolving when deletion complete
   * @throws AlbumNotFoundError if album doesn't exist
   * @throws CannotDeleteDateAlbumError for date albums
   */
  deleteAlbum(albumId: string): Promise<void>;

  /**
   * Add photos to album
   * @param albumId - Album identifier
   * @param photoIds - Array of photo IDs to add
   * @param position - Insert position (optional, defaults to end)
   * @returns Promise resolving to updated album
   * @throws AlbumNotFoundError if album doesn't exist
   */
  addPhotosToAlbum(albumId: string, photoIds: string[], position?: number): Promise<Album>;

  /**
   * Remove photos from album
   * @param albumId - Album identifier
   * @param photoIds - Array of photo IDs to remove
   * @returns Promise resolving to updated album
   * @throws AlbumNotFoundError if album doesn't exist
   */
  removePhotosFromAlbum(albumId: string, photoIds: string[]): Promise<Album>;

  /**
   * Reorder photos within album
   * @param albumId - Album identifier
   * @param photoMoves - Array of move operations
   * @returns Promise resolving to updated album
   * @throws AlbumNotFoundError if album doesn't exist
   */
  reorderPhotosInAlbum(albumId: string, photoMoves: PhotoMoveOperation[]): Promise<Album>;

  /**
   * Get photos in album with pagination
   * @param albumId - Album identifier
   * @param offset - Starting position (default: 0)
   * @param limit - Maximum photos to return (default: 50)
   * @returns Promise resolving to array of photos
   */
  getAlbumPhotos(albumId: string, offset?: number, limit?: number): Promise<Photo[]>;

  /**
   * Reorder albums in main grid
   * @param albumIds - Array of album IDs in desired order
   * @returns Promise resolving when reorder complete
   */
  reorderAlbums(albumIds: string[]): Promise<void>;

  /**
   * Auto-organize photos into date albums
   * @param photoIds - Photos to organize (optional, defaults to all)
   * @returns Promise resolving to created/updated album IDs
   */
  autoOrganizeByDate(photoIds?: string[]): Promise<string[]>;

  /**
   * Get album statistics
   * @param albumId - Album identifier
   * @returns Promise resolving to album stats
   */
  getAlbumStats(albumId: string): Promise<{
    photoCount: number;
    totalFileSize: number;
    dateRange: { earliest: Date; latest: Date } | null;
  }>;
}

export class AlbumNotFoundError extends Error {
  constructor(albumId: string) {
    super(`Album not found: ${albumId}`);
    this.name = 'AlbumNotFoundError';
  }
}

export class AlbumNameConflictError extends Error {
  constructor(name: string) {
    super(`Album name already exists: ${name}`);
    this.name = 'AlbumNameConflictError';
  }
}

export class CannotDeleteDateAlbumError extends Error {
  constructor() {
    super('Cannot delete auto-generated date albums');
    this.name = 'CannotDeleteDateAlbumError';
  }
}