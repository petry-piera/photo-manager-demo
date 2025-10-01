/**
 * PhotoService implementation for photo management operations
 */

import { storageService } from './StorageService';
import { exifService } from './ExifService';
import type { Photo, PhotoCreateData, PhotoUpdateData } from '@/models/Photo';
import { PhotoUtils } from '@/models/Photo';
import type { ExifData } from './ExifService';
import {
  validatePhotoFiles,
  processFilesInBatches,
  generateUniqueFilename,
  sanitizeFilename,
  type FileProgressCallback
} from '@/utils/file-utils';

/**
 * Photo import error types
 */
export class PhotoImportError extends Error {
  constructor(message: string, public fileName?: string, public cause?: Error) {
    super(message);
    this.name = 'PhotoImportError';
  }
}

export class PhotoNotFoundError extends Error {
  constructor(id: string) {
    super(`Photo with ID '${id}' not found`);
    this.name = 'PhotoNotFoundError';
  }
}

export class PhotoValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'PhotoValidationError';
  }
}

/**
 * Photo import options
 */
export interface PhotoImportOptions {
  batchSize?: number;
  generateThumbnails?: boolean;
  extractFullExif?: boolean;
  autoCreateAlbums?: boolean;
  duplicateHandling?: 'skip' | 'rename' | 'replace';
  onProgress?: FileProgressCallback;
  onPhotoImported?: (photo: Photo, index: number, total: number) => void;
  onError?: (error: PhotoImportError, file: File) => void;
}

/**
 * Photo import result
 */
export interface PhotoImportResult {
  imported: Photo[];
  errors: Array<{ file: File; error: PhotoImportError }>;
  skipped: Array<{ file: File; reason: string }>;
  summary: {
    totalFiles: number;
    imported: number;
    errors: number;
    skipped: number;
    albumsCreated: string[];
    processingTimeMs: number;
  };
}

/**
 * Thumbnail generation options
 */
export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
  maintainAspectRatio?: boolean;
}

/**
 * Photo search options
 */
export interface PhotoSearchOptions {
  query?: string;
  tags?: string[];
  albumIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: 'dateTaken' | 'dateAdded' | 'fileName' | 'fileSize';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * PhotoService implementation
 */
export class PhotoService {
  private existingFileNames = new Set<string>();

  /**
   * Initialize photo service
   */
  async initialize(): Promise<void> {
    await storageService.initialize();
    await this.loadExistingFileNames();
  }

  /**
   * Import photos from files
   */
  async importPhotos(
    files: File[],
    options: PhotoImportOptions = {}
  ): Promise<PhotoImportResult> {
    const startTime = Date.now();
    const {
      batchSize = 5,
      generateThumbnails = true,
      extractFullExif = true,
      autoCreateAlbums = true,
      duplicateHandling = 'rename',
      onProgress,
      onPhotoImported,
      onError
    } = options;

    // Validate files first
    const validation = validatePhotoFiles(files);
    const imported: Photo[] = [];
    const errors: Array<{ file: File; error: PhotoImportError }> = [];
    const skipped: Array<{ file: File; reason: string }> = [];
    const albumsCreated = new Set<string>();

    // Skip invalid files
    for (const invalidResult of validation.invalid) {
      const file = files.find(f => f.name === invalidResult.fileInfo.name);
      if (file) {
        skipped.push({
          file,
          reason: `Invalid file: ${invalidResult.errors.join(', ')}`
        });
      }
    }

    const validFiles = validation.valid.map(v =>
      files.find(f => f.name === v.fileInfo.name)!
    );

    if (validFiles.length === 0) {
      return {
        imported: [],
        errors: [],
        skipped,
        summary: {
          totalFiles: files.length,
          imported: 0,
          errors: 0,
          skipped: skipped.length,
          albumsCreated: [],
          processingTimeMs: Date.now() - startTime
        }
      };
    }

    // Process files in batches
    await processFilesInBatches(
      validFiles,
      async (file, index) => {
        try {
          if (onProgress) {
            onProgress({
              current: index + 1,
              total: validFiles.length,
              currentFileName: file.name,
              stage: 'processing',
              percentage: ((index + 1) / validFiles.length) * 100
            });
          }

          const photo = await this.importSinglePhoto(file, {
            generateThumbnails,
            extractFullExif,
            autoCreateAlbums,
            duplicateHandling
          });

          imported.push(photo);

          // Track created albums
          for (const albumId of photo.albumIds) {
            albumsCreated.add(albumId);
          }

          if (onPhotoImported) {
            onPhotoImported(photo, index, validFiles.length);
          }

        } catch (error) {
          const photoError = error instanceof PhotoImportError
            ? error
            : new PhotoImportError(
                `Failed to import ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                file.name,
                error instanceof Error ? error : undefined
              );

          errors.push({ file, error: photoError });

          if (onError) {
            onError(photoError, file);
          }
        }
      },
      { batchSize, onProgress }
    );

    return {
      imported,
      errors,
      skipped,
      summary: {
        totalFiles: files.length,
        imported: imported.length,
        errors: errors.length,
        skipped: skipped.length,
        albumsCreated: Array.from(albumsCreated),
        processingTimeMs: Date.now() - startTime
      }
    };
  }

  /**
   * Import a single photo
   */
  private async importSinglePhoto(
    file: File,
    options: {
      generateThumbnails: boolean;
      extractFullExif: boolean;
      autoCreateAlbums: boolean;
      duplicateHandling: 'skip' | 'rename' | 'replace';
    }
  ): Promise<Photo> {
    const { generateThumbnails, extractFullExif, autoCreateAlbums, duplicateHandling } = options;

    // Extract EXIF data
    console.log(`📸 Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);
    const exifData = extractFullExif
      ? await exifService.extractExifData(file)
      : await exifService.extractQuickMetadata(file);
    console.log('📋 EXIF data extracted:', exifData);

    // Generate safe filename
    let fileName = sanitizeFilename(file.name);
    if (duplicateHandling === 'rename') {
      fileName = generateUniqueFilename(fileName, this.existingFileNames);
    } else if (duplicateHandling === 'skip' && this.existingFileNames.has(fileName)) {
      throw new PhotoImportError(`File already exists: ${fileName}`, fileName);
    }

    // Generate thumbnail if requested
    let thumbnailDataUrl: string | undefined;
    if (generateThumbnails) {
      thumbnailDataUrl = await this.generateThumbnail(file);
    }

    // Get image dimensions if not available from EXIF
    // Note: extractQuickMetadata returns width/height directly, not in dimensions object
    let width = exifData.width || exifData.dimensions?.width;
    let height = exifData.height || exifData.dimensions?.height;
    console.log(`🖼️  Dimensions from EXIF: ${width}x${height}`);

    if (!width || !height) {
      console.log('🔍 Extracting dimensions from image...');
      const dimensions = await this.getImageDimensions(file);
      width = dimensions.width;
      height = dimensions.height;
      console.log(`✅ Extracted dimensions: ${width}x${height}`);
    }

    // Create photo object with all required fields
    const photoData: Photo = {
      id: crypto.randomUUID(), // Generate UUID for id
      fileName,
      filePath: `local://photos/${fileName}`, // Virtual path for browser storage
      fileSize: file.size,
      mimeType: file.type,
      width,
      height,
      dateTaken: exifData.dateTaken || new Date(), // Use current date if no EXIF date
      dateAdded: new Date(),
      dateModified: new Date(),
      thumbnailDataUrl,
      caption: exifData.description || '',
      tags: exifData.keywords || [],
      albumIds: [],
      camera: exifData.camera ? `${exifData.camera.make || ''} ${exifData.camera.model || ''}`.trim() : undefined,
      location: exifData.location
    };

    console.log('📦 Photo data created:', photoData);
    console.log('🔍 Validation check - ID:', photoData.id, 'UUID valid:', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(photoData.id));
    console.log('🔍 Validation check - dimensions:', `${photoData.width}x${photoData.height}`, 'valid:', typeof photoData.width === 'number' && photoData.width > 0 && typeof photoData.height === 'number' && photoData.height > 0);

    // Store photo directly since we have all required fields
    const photo = await storageService.storePhoto(photoData);

    // Auto-create and assign to date album if enabled
    if (autoCreateAlbums && exifData.dateTaken) {
      const albumInfo = exifService.generateAlbumFromExif(exifData);
      if (albumInfo) {
        const albumId = await this.ensureDateAlbum(albumInfo.year, albumInfo.month, albumInfo.name);
        photo.albumIds.push(albumId);

        // Update photo with album assignment
        await storageService.updatePhoto(photo.id, { albumIds: photo.albumIds });
      }
    }

    // Track filename for duplicate detection
    this.existingFileNames.add(fileName);

    return photo;
  }

  /**
   * Get photo by ID
   */
  async getPhoto(id: string): Promise<Photo> {
    try {
      return await storageService.getPhoto(id);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new PhotoNotFoundError(id);
      }
      throw error;
    }
  }

  /**
   * Update photo
   */
  async updatePhoto(id: string, updates: PhotoUpdateData): Promise<Photo> {
    // Validate updates
    if (updates.tags) {
      const { TagValidation } = await import('@/models/Tag');
      for (const tag of updates.tags) {
        const validation = TagValidation.validateName(tag);
        if (!validation.valid) {
          throw new PhotoValidationError(
            `Invalid tag: ${tag}`,
            validation.errors
          );
        }
      }
    }

    return await storageService.updatePhoto(id, updates);
  }

  /**
   * Delete photo
   */
  async deletePhoto(id: string): Promise<void> {
    const photo = await this.getPhoto(id);
    await storageService.deletePhoto(id);

    // Remove from filename tracking
    this.existingFileNames.delete(photo.fileName);
  }

  /**
   * Search photos
   */
  async searchPhotos(options: PhotoSearchOptions = {}): Promise<Photo[]> {
    return await storageService.queryPhotos({
      searchText: options.query,
      tags: options.tags,
      albumIds: options.albumIds,
      dateRange: options.dateRange,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * Get photos in album
   */
  async getPhotosInAlbum(albumId: string): Promise<Photo[]> {
    return await storageService.queryPhotos({
      albumIds: [albumId],
      sortBy: 'dateTaken',
      sortOrder: 'asc'
    });
  }

  /**
   * Add photos to album
   */
  async addPhotosToAlbum(photoIds: string[], albumId: string): Promise<void> {
    for (const photoId of photoIds) {
      const photo = await this.getPhoto(photoId);
      if (!photo.albumIds.includes(albumId)) {
        const updatedAlbumIds = [...photo.albumIds, albumId];
        await storageService.updatePhoto(photoId, { albumIds: updatedAlbumIds });
      }
    }
  }

  /**
   * Remove photos from album
   */
  async removePhotosFromAlbum(photoIds: string[], albumId: string): Promise<void> {
    for (const photoId of photoIds) {
      const photo = await this.getPhoto(photoId);
      const updatedAlbumIds = photo.albumIds.filter(id => id !== albumId);
      await storageService.updatePhoto(photoId, { albumIds: updatedAlbumIds });
    }
  }

  /**
   * Get image dimensions from file
   */
  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for dimension extraction'));
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate thumbnail for photo
   */
  async generateThumbnail(
    file: File,
    options: ThumbnailOptions = {}
  ): Promise<string> {
    const {
      width = 300,
      height = 300,
      quality = 0.8,
      format = 'jpeg',
      maintainAspectRatio = true
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          let { width: imgWidth, height: imgHeight } = img;

          // Calculate dimensions maintaining aspect ratio
          if (maintainAspectRatio) {
            const aspectRatio = imgWidth / imgHeight;
            if (imgWidth > imgHeight) {
              imgWidth = width;
              imgHeight = width / aspectRatio;
            } else {
              imgHeight = height;
              imgWidth = height * aspectRatio;
            }
          } else {
            imgWidth = width;
            imgHeight = height;
          }

          canvas.width = imgWidth;
          canvas.height = imgHeight;

          // Draw and compress image
          ctx?.drawImage(img, 0, 0, imgWidth, imgHeight);

          const mimeType = format === 'png' ? 'image/png' :
                          format === 'webp' ? 'image/webp' : 'image/jpeg';

          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve(dataUrl);

          // Cleanup
          URL.revokeObjectURL(img.src);
        } catch (error) {
          reject(new Error(`Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`));
          URL.revokeObjectURL(img.src);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for thumbnail generation'));
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Re-process photo metadata (useful for fixing imports)
   */
  async reprocessPhotoMetadata(id: string, file?: File): Promise<Photo> {
    const photo = await this.getPhoto(id);

    if (!file) {
      throw new PhotoImportError('File required for metadata reprocessing');
    }

    // Extract fresh EXIF data
    const exifData = await exifService.extractExifData(file);

    // Update photo with new metadata
    const updates: PhotoUpdateData = {
      dateTaken: exifData.dateTaken,
      width: exifData.width,
      height: exifData.height,
      exifData,
      caption: exifData.description || photo.caption,
      tags: exifData.keywords?.length ? exifData.keywords : photo.tags
    };

    return await this.updatePhoto(id, updates);
  }

  /**
   * Get photo statistics
   */
  async getPhotoStatistics(): Promise<{
    totalPhotos: number;
    totalSize: number;
    averageSize: number;
    oldestPhoto?: Date;
    newestPhoto?: Date;
    topTags: Array<{ tag: string; count: number }>;
    photosByYear: Array<{ year: number; count: number }>;
  }> {
    const photos = await storageService.queryPhotos({});

    if (photos.length === 0) {
      return {
        totalPhotos: 0,
        totalSize: 0,
        averageSize: 0,
        topTags: [],
        photosByYear: []
      };
    }

    const totalSize = photos.reduce((sum, photo) => sum + (photo.fileSize || 0), 0);
    const averageSize = totalSize / photos.length;

    const dates = photos
      .map(photo => photo.dateTaken || photo.dateAdded)
      .sort((a, b) => a.getTime() - b.getTime());

    const oldestPhoto = dates[0];
    const newestPhoto = dates[dates.length - 1];

    // Count tags
    const tagCounts = new Map<string, number>();
    for (const photo of photos) {
      for (const tag of photo.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Count by year
    const yearCounts = new Map<number, number>();
    for (const photo of photos) {
      const year = (photo.dateTaken || photo.dateAdded).getFullYear();
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }

    const photosByYear = Array.from(yearCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count }));

    return {
      totalPhotos: photos.length,
      totalSize,
      averageSize,
      oldestPhoto,
      newestPhoto,
      topTags,
      photosByYear
    };
  }

  /**
   * Ensure date album exists, create if not
   */
  private async ensureDateAlbum(year: number, month: number, name: string): Promise<string> {
    // Check if album already exists
    const existingAlbums = await storageService.queryAlbums({
      type: 'date',
      year,
      month
    });

    if (existingAlbums.length > 0) {
      return existingAlbums[0].id;
    }

    // Create new date album
    const album = await storageService.createAlbum({
      name,
      type: 'date',
      year,
      month,
      position: year * 100 + month // Sort by date
    });

    return album.id;
  }

  /**
   * Load existing filenames for duplicate detection
   */
  private async loadExistingFileNames(): Promise<void> {
    const photos = await storageService.queryPhotos({});
    this.existingFileNames.clear();

    for (const photo of photos) {
      this.existingFileNames.add(photo.fileName);
    }
  }

  /**
   * Batch update photo tags
   */
  async batchUpdateTags(
    photoIds: string[],
    operation: 'add' | 'remove' | 'replace',
    tags: string[]
  ): Promise<void> {
    for (const photoId of photoIds) {
      const photo = await this.getPhoto(photoId);
      let updatedTags: string[];

      switch (operation) {
        case 'add':
          updatedTags = [...new Set([...photo.tags, ...tags])];
          break;
        case 'remove':
          updatedTags = photo.tags.filter(tag => !tags.includes(tag));
          break;
        case 'replace':
          updatedTags = [...tags];
          break;
      }

      await this.updatePhoto(photoId, { tags: updatedTags });
    }
  }

  /**
   * Duplicate detection based on file content
   */
  async findDuplicatePhotos(): Promise<Array<{
    original: Photo;
    duplicates: Photo[];
    confidence: number;
  }>> {
    const photos = await storageService.queryPhotos({});
    const duplicateGroups: Array<{
      original: Photo;
      duplicates: Photo[];
      confidence: number;
    }> = [];

    // Group by file size first (fast filter)
    const sizeGroups = new Map<number, Photo[]>();
    for (const photo of photos) {
      if (photo.fileSize) {
        const group = sizeGroups.get(photo.fileSize) || [];
        group.push(photo);
        sizeGroups.set(photo.fileSize, group);
      }
    }

    // Check groups with multiple photos
    for (const [size, group] of sizeGroups) {
      if (group.length > 1) {
        // For now, simple matching by size and dimensions
        // Could be enhanced with perceptual hashing
        const dimensionGroups = new Map<string, Photo[]>();

        for (const photo of group) {
          const key = `${photo.width}x${photo.height}`;
          const dimensionGroup = dimensionGroups.get(key) || [];
          dimensionGroup.push(photo);
          dimensionGroups.set(key, dimensionGroup);
        }

        for (const [dimensions, dimensionGroup] of dimensionGroups) {
          if (dimensionGroup.length > 1) {
            const [original, ...duplicates] = dimensionGroup.sort(
              (a, b) => a.dateAdded.getTime() - b.dateAdded.getTime()
            );

            duplicateGroups.push({
              original,
              duplicates,
              confidence: 0.8 // Basic confidence based on size + dimensions
            });
          }
        }
      }
    }

    return duplicateGroups;
  }
}

/**
 * Singleton photo service instance
 */
export const photoService = new PhotoService();

/**
 * Default export
 */
export default photoService;