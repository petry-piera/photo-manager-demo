/**
 * Settings management service for PhotoManager
 * - Settings persistence and synchronization
 * - Import/export preferences
 * - Performance tuning options
 * - Backup and restore functionality
 */

import { storageService } from './StorageService';
import { errorService } from './ErrorService';
import type { AppSettings } from '@/models/AppSettings';

/**
 * Settings change event
 */
export interface SettingsChangeEvent {
  key: keyof AppSettings;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

/**
 * Settings export format
 */
export interface SettingsExport {
  version: string;
  timestamp: number;
  settings: AppSettings;
  metadata: {
    userAgent: string;
    url: string;
    exportedBy: string;
  };
}

/**
 * Settings validation result
 */
export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Settings backup entry
 */
export interface SettingsBackup {
  id: string;
  timestamp: number;
  settings: AppSettings;
  reason: string;
  automatic: boolean;
}

/**
 * Settings service class
 */
export class SettingsService {
  private settings: AppSettings;
  private defaultSettings: AppSettings;
  private listeners = new Set<(event: SettingsChangeEvent) => void>();
  private backups: SettingsBackup[] = [];
  private maxBackups = 10;
  private autoBackupInterval = 24 * 60 * 60 * 1000; // 24 hours
  private lastAutoBackup = 0;

  constructor() {
    this.defaultSettings = {
      theme: 'auto',
      enableAnimations: true,
      reduceMotion: false,
      defaultThumbnailSize: 'normal',
      photosPerPage: 50,
      enableVirtualScrolling: true,
      autoCreateDateAlbums: true,
      preserveOriginalFiles: true,
      duplicateHandling: 'ask'
    };

    this.settings = { ...this.defaultSettings };
  }

  /**
   * Initialize settings service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      this.loadBackups();
      this.setupAutoBackup();
      console.log('⚙️ Settings service initialized');
    } catch (error) {
      errorService.handleError(error, 'medium', 'storage', {
        component: 'SettingsService',
        action: 'initialize'
      });
    }
  }

  /**
   * Get all settings
   */
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Get a specific setting
   */
  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  /**
   * Set a specific setting
   */
  async setSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
    skipValidation = false
  ): Promise<void> {
    if (!skipValidation) {
      const validation = this.validateSetting(key, value);
      if (!validation.valid) {
        throw new Error(`Invalid setting value for ${key}: ${validation.errors.join(', ')}`);
      }
    }

    const oldValue = this.settings[key];
    this.settings[key] = value;

    try {
      await this.saveSettings();

      // Notify listeners
      const event: SettingsChangeEvent = {
        key,
        oldValue,
        newValue: value,
        timestamp: Date.now()
      };

      this.notifyListeners(event);

      // Apply setting immediately if it affects the UI
      this.applySettingImmediately(key, value);

    } catch (error) {
      // Rollback on save failure
      this.settings[key] = oldValue;
      throw error;
    }
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(
    newSettings: Partial<AppSettings>,
    skipValidation = false
  ): Promise<void> {
    if (!skipValidation) {
      const validation = this.validateSettings({ ...this.settings, ...newSettings });
      if (!validation.valid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }
    }

    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };

    try {
      await this.saveSettings();

      // Notify listeners for each changed setting
      Object.entries(newSettings).forEach(([key, value]) => {
        if (oldSettings[key as keyof AppSettings] !== value) {
          const event: SettingsChangeEvent = {
            key: key as keyof AppSettings,
            oldValue: oldSettings[key as keyof AppSettings],
            newValue: value,
            timestamp: Date.now()
          };

          this.notifyListeners(event);
          this.applySettingImmediately(key as keyof AppSettings, value);
        }
      });

    } catch (error) {
      // Rollback on save failure
      this.settings = oldSettings;
      throw error;
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<void> {
    await this.createBackup('Manual reset to defaults', false);

    const oldSettings = { ...this.settings };
    this.settings = { ...this.defaultSettings };

    try {
      await this.saveSettings();

      // Notify listeners for all changed settings
      Object.keys(this.defaultSettings).forEach(key => {
        const settingKey = key as keyof AppSettings;
        if (oldSettings[settingKey] !== this.settings[settingKey]) {
          const event: SettingsChangeEvent = {
            key: settingKey,
            oldValue: oldSettings[settingKey],
            newValue: this.settings[settingKey],
            timestamp: Date.now()
          };

          this.notifyListeners(event);
          this.applySettingImmediately(settingKey, this.settings[settingKey]);
        }
      });

    } catch (error) {
      // Rollback on save failure
      this.settings = oldSettings;
      throw error;
    }
  }

  /**
   * Export settings to JSON
   */
  exportSettings(): SettingsExport {
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      settings: { ...this.settings },
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        exportedBy: 'PhotoManager Settings Service'
      }
    };
  }

  /**
   * Import settings from export data
   */
  async importSettings(
    exportData: SettingsExport,
    mergeMode = false
  ): Promise<void> {
    // Validate export data
    if (!exportData.settings) {
      throw new Error('Invalid export data: missing settings');
    }

    const validation = this.validateSettings(exportData.settings);
    if (!validation.valid) {
      throw new Error(`Invalid imported settings: ${validation.errors.join(', ')}`);
    }

    // Create backup before import
    await this.createBackup('Before settings import', false);

    try {
      if (mergeMode) {
        // Merge with existing settings
        await this.updateSettings(exportData.settings);
      } else {
        // Replace all settings
        const oldSettings = { ...this.settings };
        this.settings = { ...exportData.settings };

        await this.saveSettings();

        // Notify listeners for all settings
        Object.keys(this.settings).forEach(key => {
          const settingKey = key as keyof AppSettings;
          const event: SettingsChangeEvent = {
            key: settingKey,
            oldValue: oldSettings[settingKey],
            newValue: this.settings[settingKey],
            timestamp: Date.now()
          };

          this.notifyListeners(event);
          this.applySettingImmediately(settingKey, this.settings[settingKey]);
        });
      }

    } catch (error) {
      errorService.handleError(error, 'medium', 'storage', {
        component: 'SettingsService',
        action: 'importSettings'
      });
      throw error;
    }
  }

  /**
   * Create settings backup
   */
  async createBackup(reason: string, automatic = false): Promise<string> {
    const backup: SettingsBackup = {
      id: this.generateBackupId(),
      timestamp: Date.now(),
      settings: { ...this.settings },
      reason,
      automatic
    };

    this.backups.push(backup);

    // Maintain backup limit
    if (this.backups.length > this.maxBackups) {
      this.backups.splice(0, this.backups.length - this.maxBackups);
    }

    try {
      await this.saveBackups();
      return backup.id;
    } catch (error) {
      // Remove backup from memory if save failed
      const index = this.backups.findIndex(b => b.id === backup.id);
      if (index >= 0) {
        this.backups.splice(index, 1);
      }
      throw error;
    }
  }

  /**
   * Restore settings from backup
   */
  async restoreFromBackup(backupId: string): Promise<void> {
    const backup = this.backups.find(b => b.id === backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Create current backup before restore
    await this.createBackup(`Before restore from backup ${backupId}`, false);

    const oldSettings = { ...this.settings };
    this.settings = { ...backup.settings };

    try {
      await this.saveSettings();

      // Notify listeners for all settings
      Object.keys(this.settings).forEach(key => {
        const settingKey = key as keyof AppSettings;
        if (oldSettings[settingKey] !== this.settings[settingKey]) {
          const event: SettingsChangeEvent = {
            key: settingKey,
            oldValue: oldSettings[settingKey],
            newValue: this.settings[settingKey],
            timestamp: Date.now()
          };

          this.notifyListeners(event);
          this.applySettingImmediately(settingKey, this.settings[settingKey]);
        }
      });

    } catch (error) {
      // Rollback on save failure
      this.settings = oldSettings;
      throw error;
    }
  }

  /**
   * Get all backups
   */
  getBackups(): SettingsBackup[] {
    return [...this.backups].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const index = this.backups.findIndex(b => b.id === backupId);
    if (index >= 0) {
      this.backups.splice(index, 1);
      await this.saveBackups();
    }
  }

  /**
   * Listen to settings changes
   */
  onChange(listener: (event: SettingsChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Validate a single setting
   */
  validateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (key) {
      case 'theme':
        if (!['light', 'dark', 'auto'].includes(value as string)) {
          errors.push('Theme must be "light", "dark", or "auto"');
        }
        break;

      case 'enableAnimations':
      case 'reduceMotion':
      case 'enableVirtualScrolling':
      case 'autoCreateDateAlbums':
      case 'preserveOriginalFiles':
        if (typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`);
        }
        break;

      case 'defaultThumbnailSize':
        if (!['compact', 'normal', 'large'].includes(value as string)) {
          errors.push('Thumbnail size must be "compact", "normal", or "large"');
        }
        break;

      case 'photosPerPage':
        const photosPerPage = value as number;
        if (!Number.isInteger(photosPerPage) || photosPerPage < 10 || photosPerPage > 500) {
          errors.push('Photos per page must be an integer between 10 and 500');
        } else if (photosPerPage > 200) {
          warnings.push('High photos per page may impact performance');
        }
        break;

      case 'duplicateHandling':
        if (!['skip', 'rename', 'replace', 'ask'].includes(value as string)) {
          errors.push('Duplicate handling must be "skip", "rename", "replace", or "ask"');
        }
        break;

      default:
        warnings.push(`Unknown setting: ${key}`);
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate all settings
   */
  validateSettings(settings: Partial<AppSettings>): SettingsValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    Object.entries(settings).forEach(([key, value]) => {
      const result = this.validateSetting(key as keyof AppSettings, value);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      // Try to load from IndexedDB first
      const stored = await storageService.getAppSettings();
      if (stored) {
        // Merge with defaults to ensure all properties exist
        this.settings = { ...this.defaultSettings, ...stored };
        return;
      }

      // Fallback to localStorage
      const localStored = localStorage.getItem('photoManager_settings');
      if (localStored) {
        const parsed = JSON.parse(localStored);
        this.settings = { ...this.defaultSettings, ...parsed };
      }

    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
      this.settings = { ...this.defaultSettings };
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      // Save to IndexedDB
      await storageService.saveAppSettings(this.settings);

      // Also save to localStorage as backup
      localStorage.setItem('photoManager_settings', JSON.stringify(this.settings));

    } catch (error) {
      errorService.handleError(error, 'medium', 'storage', {
        component: 'SettingsService',
        action: 'saveSettings'
      });
      throw error;
    }
  }

  /**
   * Load backups from storage
   */
  private loadBackups(): void {
    try {
      const stored = localStorage.getItem('photoManager_settingsBackups');
      if (stored) {
        this.backups = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load settings backups:', error);
      this.backups = [];
    }
  }

  /**
   * Save backups to storage
   */
  private async saveBackups(): Promise<void> {
    try {
      localStorage.setItem('photoManager_settingsBackups', JSON.stringify(this.backups));
    } catch (error) {
      console.warn('Failed to save settings backups:', error);
    }
  }

  /**
   * Apply setting immediately to UI
   */
  private applySettingImmediately<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): void {
    switch (key) {
      case 'theme':
        this.applyTheme(value as AppSettings['theme']);
        break;

      case 'reduceMotion':
        this.applyReducedMotion(value as boolean);
        break;

      case 'enableAnimations':
        this.applyAnimations(value as boolean);
        break;
    }
  }

  /**
   * Apply theme setting
   */
  private applyTheme(theme: AppSettings['theme']): void {
    let appliedTheme = theme;

    if (theme === 'auto') {
      appliedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', appliedTheme);
  }

  /**
   * Apply reduced motion setting
   */
  private applyReducedMotion(reduce: boolean): void {
    if (reduce) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }

  /**
   * Apply animations setting
   */
  private applyAnimations(enable: boolean): void {
    if (!enable) {
      document.documentElement.classList.add('no-animations');
    } else {
      document.documentElement.classList.remove('no-animations');
    }
  }

  /**
   * Setup automatic backup
   */
  private setupAutoBackup(): void {
    const now = Date.now();
    if (now - this.lastAutoBackup > this.autoBackupInterval) {
      this.createBackup('Automatic backup', true);
      this.lastAutoBackup = now;
    }

    // Schedule next automatic backup
    setInterval(() => {
      this.createBackup('Automatic backup', true);
      this.lastAutoBackup = Date.now();
    }, this.autoBackupInterval);
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify all listeners of settings change
   */
  private notifyListeners(event: SettingsChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Settings change listener error:', error);
      }
    });
  }

  /**
   * Cleanup settings service
   */
  destroy(): void {
    this.listeners.clear();
  }
}

// Create singleton instance
export const settingsService = new SettingsService();