/**
 * Layout models for organizing albums and photos display
 */

export type ViewMode = 'grid' | 'list';
export type SortBy = 'name' | 'date' | 'photoCount' | 'custom';
export type SortOrder = 'asc' | 'desc';

/**
 * Album layout configuration for main grid view
 */
export interface AlbumLayout {
  id: string; // 'main' or album ID
  albumIds: string[]; // Ordered list for main grid
  gridColumns: number; // Number of columns
  viewMode: ViewMode; // Display mode
  sortBy: SortBy; // Sorting criteria
  sortOrder: SortOrder; // Sort direction
  dateModified: Date;
}

/**
 * Photo layout configuration within albums
 */
export interface PhotoLayout {
  albumId: string; // Parent album ID
  photoIds: string[]; // Ordered list of photos
  gridColumns: number; // Number of columns
  viewMode: ViewMode; // Display mode
  sortBy: 'name' | 'date' | 'custom'; // Photo-specific sorting
  sortOrder: SortOrder; // Sort direction
  dateModified: Date;
}

/**
 * Validation rules for Layout models
 */
export class LayoutValidation {
  private static readonly MIN_COLUMNS = 1;
  private static readonly MAX_COLUMNS = 10;
  private static readonly VALID_VIEW_MODES: ViewMode[] = ['grid', 'list'];
  private static readonly VALID_ALBUM_SORT_BY: SortBy[] = ['name', 'date', 'photoCount', 'custom'];
  private static readonly VALID_PHOTO_SORT_BY = ['name', 'date', 'custom'];
  private static readonly VALID_SORT_ORDERS: SortOrder[] = ['asc', 'desc'];

  /**
   * Validate album layout
   */
  static validateAlbumLayout(layout: Partial<AlbumLayout>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!layout.id || layout.id.trim().length === 0) {
      errors.push('Layout ID is required');
    }

    if (!layout.albumIds || !Array.isArray(layout.albumIds)) {
      errors.push('Album IDs must be an array');
    }

    if (typeof layout.gridColumns !== 'number' ||
        layout.gridColumns < this.MIN_COLUMNS ||
        layout.gridColumns > this.MAX_COLUMNS) {
      errors.push(`Grid columns must be between ${this.MIN_COLUMNS} and ${this.MAX_COLUMNS}`);
    }

    if (!layout.viewMode || !this.VALID_VIEW_MODES.includes(layout.viewMode)) {
      errors.push(`View mode must be one of: ${this.VALID_VIEW_MODES.join(', ')}`);
    }

    if (!layout.sortBy || !this.VALID_ALBUM_SORT_BY.includes(layout.sortBy)) {
      errors.push(`Sort by must be one of: ${this.VALID_ALBUM_SORT_BY.join(', ')}`);
    }

    if (!layout.sortOrder || !this.VALID_SORT_ORDERS.includes(layout.sortOrder)) {
      errors.push(`Sort order must be one of: ${this.VALID_SORT_ORDERS.join(', ')}`);
    }

    if (!layout.dateModified || !(layout.dateModified instanceof Date)) {
      errors.push('Date modified is required and must be a valid Date');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate photo layout
   */
  static validatePhotoLayout(layout: Partial<PhotoLayout>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!layout.albumId || layout.albumId.trim().length === 0) {
      errors.push('Album ID is required');
    }

    if (!layout.photoIds || !Array.isArray(layout.photoIds)) {
      errors.push('Photo IDs must be an array');
    }

    if (typeof layout.gridColumns !== 'number' ||
        layout.gridColumns < this.MIN_COLUMNS ||
        layout.gridColumns > this.MAX_COLUMNS) {
      errors.push(`Grid columns must be between ${this.MIN_COLUMNS} and ${this.MAX_COLUMNS}`);
    }

    if (!layout.viewMode || !this.VALID_VIEW_MODES.includes(layout.viewMode)) {
      errors.push(`View mode must be one of: ${this.VALID_VIEW_MODES.join(', ')}`);
    }

    if (!layout.sortBy || !this.VALID_PHOTO_SORT_BY.includes(layout.sortBy)) {
      errors.push(`Sort by must be one of: ${this.VALID_PHOTO_SORT_BY.join(', ')}`);
    }

    if (!layout.sortOrder || !this.VALID_SORT_ORDERS.includes(layout.sortOrder)) {
      errors.push(`Sort order must be one of: ${this.VALID_SORT_ORDERS.join(', ')}`);
    }

    if (!layout.dateModified || !(layout.dateModified instanceof Date)) {
      errors.push('Date modified is required and must be a valid Date');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
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
 * Helper functions for Layout models
 */
export class LayoutUtils {
  /**
   * Create default album layout
   */
  static createDefaultAlbumLayout(id: string = 'main'): AlbumLayout {
    return {
      id,
      albumIds: [],
      gridColumns: 4,
      viewMode: 'grid',
      sortBy: 'date',
      sortOrder: 'desc',
      dateModified: new Date(),
    };
  }

  /**
   * Create default photo layout for album
   */
  static createDefaultPhotoLayout(albumId: string): PhotoLayout {
    return {
      albumId,
      photoIds: [],
      gridColumns: 5,
      viewMode: 'grid',
      sortBy: 'date',
      sortOrder: 'desc',
      dateModified: new Date(),
    };
  }

  /**
   * Update album layout
   */
  static updateAlbumLayout(layout: AlbumLayout, updates: {
    albumIds?: string[];
    gridColumns?: number;
    viewMode?: ViewMode;
    sortBy?: SortBy;
    sortOrder?: SortOrder;
  }): AlbumLayout {
    return {
      ...layout,
      albumIds: updates.albumIds !== undefined ? updates.albumIds : layout.albumIds,
      gridColumns: updates.gridColumns !== undefined ? updates.gridColumns : layout.gridColumns,
      viewMode: updates.viewMode !== undefined ? updates.viewMode : layout.viewMode,
      sortBy: updates.sortBy !== undefined ? updates.sortBy : layout.sortBy,
      sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : layout.sortOrder,
      dateModified: new Date(),
    };
  }

  /**
   * Update photo layout
   */
  static updatePhotoLayout(layout: PhotoLayout, updates: {
    photoIds?: string[];
    gridColumns?: number;
    viewMode?: ViewMode;
    sortBy?: 'name' | 'date' | 'custom';
    sortOrder?: SortOrder;
  }): PhotoLayout {
    return {
      ...layout,
      photoIds: updates.photoIds !== undefined ? updates.photoIds : layout.photoIds,
      gridColumns: updates.gridColumns !== undefined ? updates.gridColumns : layout.gridColumns,
      viewMode: updates.viewMode !== undefined ? updates.viewMode : layout.viewMode,
      sortBy: updates.sortBy !== undefined ? updates.sortBy : layout.sortBy,
      sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : layout.sortOrder,
      dateModified: new Date(),
    };
  }

  /**
   * Reorder albums in layout
   */
  static reorderAlbums(layout: AlbumLayout, albumIds: string[]): AlbumLayout {
    // Validate that all provided album IDs exist in current layout
    const currentSet = new Set(layout.albumIds);
    const newSet = new Set(albumIds);

    // Check for missing or extra albums
    const missingAlbums = layout.albumIds.filter(id => !newSet.has(id));
    const extraAlbums = albumIds.filter(id => !currentSet.has(id));

    let finalAlbumIds = albumIds;

    // Add back any missing albums at the end
    if (missingAlbums.length > 0) {
      finalAlbumIds = [...albumIds, ...missingAlbums];
    }

    // Remove any extra albums that weren't in original layout
    if (extraAlbums.length > 0) {
      finalAlbumIds = finalAlbumIds.filter(id => currentSet.has(id) || !extraAlbums.includes(id));
    }

    return this.updateAlbumLayout(layout, { albumIds: finalAlbumIds });
  }

  /**
   * Reorder photos in layout
   */
  static reorderPhotos(layout: PhotoLayout, photoIds: string[]): PhotoLayout {
    // Similar validation as reorderAlbums
    const currentSet = new Set(layout.photoIds);
    const newSet = new Set(photoIds);

    const missingPhotos = layout.photoIds.filter(id => !newSet.has(id));
    const extraPhotos = photoIds.filter(id => !currentSet.has(id));

    let finalPhotoIds = photoIds;

    if (missingPhotos.length > 0) {
      finalPhotoIds = [...photoIds, ...missingPhotos];
    }

    if (extraPhotos.length > 0) {
      finalPhotoIds = finalPhotoIds.filter(id => currentSet.has(id) || !extraPhotos.includes(id));
    }

    return this.updatePhotoLayout(layout, { photoIds: finalPhotoIds });
  }

  /**
   * Add album to layout
   */
  static addAlbumToLayout(layout: AlbumLayout, albumId: string, position?: number): AlbumLayout {
    if (layout.albumIds.includes(albumId)) {
      return layout; // Already in layout
    }

    const newAlbumIds = [...layout.albumIds];
    const insertIndex = position ?? newAlbumIds.length;
    newAlbumIds.splice(insertIndex, 0, albumId);

    return this.updateAlbumLayout(layout, { albumIds: newAlbumIds });
  }

  /**
   * Remove album from layout
   */
  static removeAlbumFromLayout(layout: AlbumLayout, albumId: string): AlbumLayout {
    const newAlbumIds = layout.albumIds.filter(id => id !== albumId);
    return this.updateAlbumLayout(layout, { albumIds: newAlbumIds });
  }

  /**
   * Add photos to layout
   */
  static addPhotosToLayout(layout: PhotoLayout, photoIds: string[], position?: number): PhotoLayout {
    const existingSet = new Set(layout.photoIds);
    const newPhotos = photoIds.filter(id => !existingSet.has(id));

    if (newPhotos.length === 0) {
      return layout; // No new photos to add
    }

    const newPhotoIds = [...layout.photoIds];
    const insertIndex = position ?? newPhotoIds.length;
    newPhotoIds.splice(insertIndex, 0, ...newPhotos);

    return this.updatePhotoLayout(layout, { photoIds: newPhotoIds });
  }

  /**
   * Remove photos from layout
   */
  static removePhotosFromLayout(layout: PhotoLayout, photoIds: string[]): PhotoLayout {
    const removeSet = new Set(photoIds);
    const newPhotoIds = layout.photoIds.filter(id => !removeSet.has(id));
    return this.updatePhotoLayout(layout, { photoIds: newPhotoIds });
  }

  /**
   * Calculate optimal grid columns based on container width
   */
  static calculateOptimalColumns(containerWidth: number, itemMinWidth: number = 200): number {
    const columns = Math.floor(containerWidth / itemMinWidth);
    return Math.max(1, Math.min(10, columns)); // Clamp between 1 and 10
  }

  /**
   * Get responsive grid columns based on screen size
   */
  static getResponsiveColumns(screenWidth: number): number {
    if (screenWidth < 640) return 2; // Mobile
    if (screenWidth < 768) return 3; // Small tablet
    if (screenWidth < 1024) return 4; // Tablet
    if (screenWidth < 1280) return 5; // Small desktop
    return 6; // Large desktop
  }

  /**
   * Clone album layout
   */
  static cloneAlbumLayout(layout: AlbumLayout): AlbumLayout {
    return {
      ...layout,
      albumIds: [...layout.albumIds],
    };
  }

  /**
   * Clone photo layout
   */
  static clonePhotoLayout(layout: PhotoLayout): PhotoLayout {
    return {
      ...layout,
      photoIds: [...layout.photoIds],
    };
  }

  /**
   * Check if layout needs update (has unsaved changes)
   */
  static needsUpdate(layout: AlbumLayout | PhotoLayout, lastSaved: Date): boolean {
    return layout.dateModified > lastSaved;
  }

  /**
   * Merge layout configurations (for settings import/export)
   */
  static mergeAlbumLayouts(base: AlbumLayout, overlay: Partial<AlbumLayout>): AlbumLayout {
    return {
      ...base,
      ...overlay,
      dateModified: new Date(),
      // Always preserve the base album IDs unless explicitly overridden
      albumIds: overlay.albumIds !== undefined ? overlay.albumIds : base.albumIds,
    };
  }

  /**
   * Get layout statistics
   */
  static getAlbumLayoutStats(layout: AlbumLayout): {
    totalAlbums: number;
    lastModified: Date;
    viewMode: ViewMode;
    gridColumns: number;
  } {
    return {
      totalAlbums: layout.albumIds.length,
      lastModified: layout.dateModified,
      viewMode: layout.viewMode,
      gridColumns: layout.gridColumns,
    };
  }

  /**
   * Get photo layout statistics
   */
  static getPhotoLayoutStats(layout: PhotoLayout): {
    totalPhotos: number;
    lastModified: Date;
    viewMode: ViewMode;
    gridColumns: number;
  } {
    return {
      totalPhotos: layout.photoIds.length,
      lastModified: layout.dateModified,
      viewMode: layout.viewMode,
      gridColumns: layout.gridColumns,
    };
  }
}

/**
 * Export types for external use
 */
export type AlbumLayoutUpdateData = Parameters<typeof LayoutUtils.updateAlbumLayout>[1];
export type PhotoLayoutUpdateData = Parameters<typeof LayoutUtils.updatePhotoLayout>[1];

/**
 * Default exports
 */
export { AlbumLayout as default };
export { PhotoLayout };