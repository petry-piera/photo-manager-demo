/**
 * Application settings model for user preferences and configuration
 */

export type Theme = 'light' | 'dark' | 'system';
export type DuplicateHandling = 'skip' | 'rename' | 'ask';

export interface AppSettings {
  id: 'main'; // Singleton settings

  // UI Preferences
  theme: Theme;
  language: string; // ISO language code

  // Performance Settings
  maxThumbnailSize: number; // Max thumbnail dimension
  thumbnailQuality: number; // JPEG quality (0-1)
  maxConcurrentLoads: number; // Concurrent image loads

  // Import Settings
  autoOrganizeByDate: boolean; // Auto-create date albums
  duplicateHandling: DuplicateHandling;
  supportedFormats: string[]; // Supported MIME types

  // Storage
  maxStorageUsage: number; // Max IndexedDB usage in bytes

  dateModified: Date;
}

/**
 * Default settings configuration
 */
export const DEFAULT_SETTINGS: AppSettings = {
  id: 'main',
  theme: 'system',
  language: 'en',
  maxThumbnailSize: 200,
  thumbnailQuality: 0.8,
  maxConcurrentLoads: 5,
  autoOrganizeByDate: true,
  duplicateHandling: 'ask',
  supportedFormats: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
  ],
  maxStorageUsage: 2 * 1024 * 1024 * 1024, // 2GB
  dateModified: new Date(),
};

/**
 * Validation rules for AppSettings model
 */
export class AppSettingsValidation {
  private static readonly VALID_THEMES: Theme[] = ['light', 'dark', 'system'];
  private static readonly VALID_DUPLICATE_HANDLING: DuplicateHandling[] = ['skip', 'rename', 'ask'];
  private static readonly MIN_THUMBNAIL_SIZE = 50;
  private static readonly MAX_THUMBNAIL_SIZE = 500;
  private static readonly MIN_THUMBNAIL_QUALITY = 0.1;
  private static readonly MAX_THUMBNAIL_QUALITY = 1.0;
  private static readonly MIN_CONCURRENT_LOADS = 1;
  private static readonly MAX_CONCURRENT_LOADS = 20;
  private static readonly MIN_STORAGE_USAGE = 100 * 1024 * 1024; // 100MB
  private static readonly MAX_STORAGE_USAGE = 10 * 1024 * 1024 * 1024; // 10GB

  /**
   * Validate settings object against business rules
   */
  static validate(settings: Partial<AppSettings>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (settings.id !== 'main') {
      errors.push('Settings ID must be "main"');
    }

    if (!settings.theme || !this.VALID_THEMES.includes(settings.theme)) {
      errors.push(`Theme must be one of: ${this.VALID_THEMES.join(', ')}`);
    }

    if (!settings.language || typeof settings.language !== 'string' || settings.language.length < 2) {
      errors.push('Language must be a valid ISO language code');
    }

    // Performance settings
    if (typeof settings.maxThumbnailSize !== 'number' ||
        settings.maxThumbnailSize < this.MIN_THUMBNAIL_SIZE ||
        settings.maxThumbnailSize > this.MAX_THUMBNAIL_SIZE) {
      errors.push(`Max thumbnail size must be between ${this.MIN_THUMBNAIL_SIZE} and ${this.MAX_THUMBNAIL_SIZE}`);
    }

    if (typeof settings.thumbnailQuality !== 'number' ||
        settings.thumbnailQuality < this.MIN_THUMBNAIL_QUALITY ||
        settings.thumbnailQuality > this.MAX_THUMBNAIL_QUALITY) {
      errors.push(`Thumbnail quality must be between ${this.MIN_THUMBNAIL_QUALITY} and ${this.MAX_THUMBNAIL_QUALITY}`);
    }

    if (typeof settings.maxConcurrentLoads !== 'number' ||
        settings.maxConcurrentLoads < this.MIN_CONCURRENT_LOADS ||
        settings.maxConcurrentLoads > this.MAX_CONCURRENT_LOADS) {
      errors.push(`Max concurrent loads must be between ${this.MIN_CONCURRENT_LOADS} and ${this.MAX_CONCURRENT_LOADS}`);
    }

    // Import settings
    if (typeof settings.autoOrganizeByDate !== 'boolean') {
      errors.push('Auto organize by date must be a boolean');
    }

    if (!settings.duplicateHandling || !this.VALID_DUPLICATE_HANDLING.includes(settings.duplicateHandling)) {
      errors.push(`Duplicate handling must be one of: ${this.VALID_DUPLICATE_HANDLING.join(', ')}`);
    }

    if (!settings.supportedFormats || !Array.isArray(settings.supportedFormats)) {
      errors.push('Supported formats must be an array');
    } else if (settings.supportedFormats.length === 0) {
      errors.push('At least one supported format is required');
    }

    // Storage settings
    if (typeof settings.maxStorageUsage !== 'number' ||
        settings.maxStorageUsage < this.MIN_STORAGE_USAGE ||
        settings.maxStorageUsage > this.MAX_STORAGE_USAGE) {
      errors.push(`Max storage usage must be between ${this.formatBytes(this.MIN_STORAGE_USAGE)} and ${this.formatBytes(this.MAX_STORAGE_USAGE)}`);
    }

    if (!settings.dateModified || !(settings.dateModified instanceof Date)) {
      errors.push('Date modified is required and must be a valid Date');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Validate language code format
   */
  static isValidLanguageCode(code: string): boolean {
    // Simple validation for ISO 639-1 or 639-2 codes
    return /^[a-z]{2}(-[A-Z]{2})?$/.test(code);
  }

  /**
   * Validate MIME type format
   */
  static isValidMimeType(mimeType: string): boolean {
    return /^[a-z]+\/[a-z0-9\-\+]+$/.test(mimeType);
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
 * Helper functions for AppSettings model
 */
export class AppSettingsUtils {
  /**
   * Create settings with defaults
   */
  static createDefault(): AppSettings {
    return {
      ...DEFAULT_SETTINGS,
      dateModified: new Date(),
    };
  }

  /**
   * Update settings with validation
   */
  static update(settings: AppSettings, updates: Partial<Omit<AppSettings, 'id' | 'dateModified'>>): AppSettings {
    const updated: AppSettings = {
      ...settings,
      ...updates,
      id: 'main', // Always enforce singleton ID
      dateModified: new Date(),
    };

    // Validate updated settings
    const validation = AppSettingsValidation.validate(updated);
    if (!validation.isValid) {
      throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
    }

    return updated;
  }

  /**
   * Reset to defaults
   */
  static reset(): AppSettings {
    return this.createDefault();
  }

  /**
   * Merge settings (for import/migration)
   */
  static merge(base: AppSettings, overlay: Partial<AppSettings>): AppSettings {
    // Only merge valid properties
    const validUpdates: Partial<AppSettings> = {};

    // UI Preferences
    if (overlay.theme && AppSettingsValidation.validate({ ...base, theme: overlay.theme }).isValid) {
      validUpdates.theme = overlay.theme;
    }

    if (overlay.language && AppSettingsValidation.isValidLanguageCode(overlay.language)) {
      validUpdates.language = overlay.language;
    }

    // Performance Settings
    if (typeof overlay.maxThumbnailSize === 'number' && overlay.maxThumbnailSize >= 50 && overlay.maxThumbnailSize <= 500) {
      validUpdates.maxThumbnailSize = overlay.maxThumbnailSize;
    }

    if (typeof overlay.thumbnailQuality === 'number' && overlay.thumbnailQuality >= 0.1 && overlay.thumbnailQuality <= 1.0) {
      validUpdates.thumbnailQuality = overlay.thumbnailQuality;
    }

    if (typeof overlay.maxConcurrentLoads === 'number' && overlay.maxConcurrentLoads >= 1 && overlay.maxConcurrentLoads <= 20) {
      validUpdates.maxConcurrentLoads = overlay.maxConcurrentLoads;
    }

    // Import Settings
    if (typeof overlay.autoOrganizeByDate === 'boolean') {
      validUpdates.autoOrganizeByDate = overlay.autoOrganizeByDate;
    }

    if (overlay.duplicateHandling && ['skip', 'rename', 'ask'].includes(overlay.duplicateHandling)) {
      validUpdates.duplicateHandling = overlay.duplicateHandling;
    }

    if (Array.isArray(overlay.supportedFormats) && overlay.supportedFormats.length > 0) {
      // Validate each MIME type
      const validFormats = overlay.supportedFormats.filter(AppSettingsValidation.isValidMimeType);
      if (validFormats.length > 0) {
        validUpdates.supportedFormats = validFormats;
      }
    }

    // Storage Settings
    if (typeof overlay.maxStorageUsage === 'number' &&
        overlay.maxStorageUsage >= 100 * 1024 * 1024 &&
        overlay.maxStorageUsage <= 10 * 1024 * 1024 * 1024) {
      validUpdates.maxStorageUsage = overlay.maxStorageUsage;
    }

    return this.update(base, validUpdates);
  }

  /**
   * Export settings for backup
   */
  static export(settings: AppSettings): string {
    const exportData = {
      ...settings,
      version: '1.0.0',
      exportDate: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import settings from backup
   */
  static import(jsonData: string): AppSettings {
    try {
      const data = JSON.parse(jsonData);

      // Convert date strings back to Date objects
      if (data.dateModified) {
        data.dateModified = new Date(data.dateModified);
      }

      // Merge with defaults to ensure all required fields exist
      return this.merge(this.createDefault(), data);
    } catch (error) {
      throw new Error(`Failed to import settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get theme preference
   */
  static getTheme(settings: AppSettings): 'light' | 'dark' {
    if (settings.theme === 'system') {
      // Check system preference
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light'; // Default fallback
    }
    return settings.theme;
  }

  /**
   * Calculate storage usage percentage
   */
  static getStorageUsagePercentage(usedBytes: number, settings: AppSettings): number {
    return Math.min(100, (usedBytes / settings.maxStorageUsage) * 100);
  }

  /**
   * Check if storage is near limit
   */
  static isStorageNearLimit(usedBytes: number, settings: AppSettings, threshold: number = 80): boolean {
    return this.getStorageUsagePercentage(usedBytes, settings) >= threshold;
  }

  /**
   * Get localized settings
   */
  static getLocalizedSettings(settings: AppSettings): AppSettings & { resolvedTheme: 'light' | 'dark' } {
    return {
      ...settings,
      resolvedTheme: this.getTheme(settings),
    };
  }

  /**
   * Validate settings compatibility
   */
  static isCompatible(settings: AppSettings): { compatible: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check browser capabilities
    if (typeof window !== 'undefined') {
      // Check File System Access API support
      if (!('showOpenFilePicker' in window)) {
        issues.push('File System Access API not supported - will fall back to drag-and-drop');
      }

      // Check IndexedDB support
      if (!('indexedDB' in window)) {
        issues.push('IndexedDB not supported - application will not work');
      }

      // Check WebP support for thumbnails
      const canvas = document.createElement('canvas');
      const webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      if (!webpSupported && settings.supportedFormats.includes('image/webp')) {
        issues.push('WebP format not supported in this browser');
      }
    }

    // Check memory constraints
    const estimatedMemoryUsage = settings.maxThumbnailSize * settings.maxThumbnailSize * 4 * settings.maxConcurrentLoads;
    if (estimatedMemoryUsage > 100 * 1024 * 1024) { // 100MB
      issues.push('High memory usage settings may cause performance issues');
    }

    return {
      compatible: issues.length === 0 || !issues.some(issue => issue.includes('will not work')),
      issues,
    };
  }

  /**
   * Clone settings object
   */
  static clone(settings: AppSettings): AppSettings {
    return {
      ...settings,
      supportedFormats: [...settings.supportedFormats],
    };
  }

  /**
   * Compare settings for changes
   */
  static hasChanges(current: AppSettings, previous: AppSettings): boolean {
    // Compare all fields except dateModified
    const { dateModified: currentDate, ...currentData } = current;
    const { dateModified: previousDate, ...previousData } = previous;

    return JSON.stringify(currentData) !== JSON.stringify(previousData);
  }

  /**
   * Get settings summary for display
   */
  static getSummary(settings: AppSettings): {
    theme: string;
    thumbnailSize: string;
    storageLimit: string;
    autoOrganize: boolean;
    supportedFormatsCount: number;
  } {
    return {
      theme: settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1),
      thumbnailSize: `${settings.maxThumbnailSize}px`,
      storageLimit: this.formatStorageSize(settings.maxStorageUsage),
      autoOrganize: settings.autoOrganizeByDate,
      supportedFormatsCount: settings.supportedFormats.length,
    };
  }

  private static formatStorageSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)}GB`;
  }
}

/**
 * Export types for external use
 */
export type AppSettingsUpdateData = Parameters<typeof AppSettingsUtils.update>[1];

/**
 * Default export
 */
export default AppSettings;