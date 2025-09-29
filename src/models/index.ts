/**
 * Models barrel export
 * Provides centralized access to all data models
 */

// Photo model exports
export type { Photo, PhotoLocation, PhotoCreateData, PhotoUpdateData } from './Photo';
export { PhotoValidation, PhotoUtils } from './Photo';
export { default as PhotoModel } from './Photo';

// Album model exports
export type { Album, AlbumType, AlbumCreateData, DateAlbumCreateData, AlbumUpdateData, PhotoMoveOperation } from './Album';
export { AlbumValidation, AlbumUtils } from './Album';
export { default as AlbumModel } from './Album';

// Tag model exports
export type { Tag, TagCreateData, TagUpdateData } from './Tag';
export { TagValidation, TagUtils } from './Tag';
export { default as TagModel } from './Tag';

// Layout model exports
export type {
  AlbumLayout,
  PhotoLayout,
  ViewMode,
  SortBy,
  SortOrder,
  AlbumLayoutUpdateData,
  PhotoLayoutUpdateData
} from './Layout';
export { LayoutValidation, LayoutUtils } from './Layout';
export { default as LayoutModel } from './Layout';
export type { PhotoLayout as PhotoLayoutModel } from './Layout';

// AppSettings model exports
export type { AppSettings, Theme, DuplicateHandling, AppSettingsUpdateData } from './AppSettings';
export { DEFAULT_SETTINGS, AppSettingsValidation, AppSettingsUtils } from './AppSettings';
export { default as AppSettingsModel } from './AppSettings';

// Common validation interface
export type { ValidationResult } from './Photo'; // All models share the same ValidationResult interface

/**
 * Re-export commonly used types for convenience
 */
export type { Photo as IPhoto } from './Photo';
export type { Album as IAlbum } from './Album';
export type { Tag as ITag } from './Tag';
export type { AlbumLayout as IAlbumLayout } from './Layout';
export type { PhotoLayout as IPhotoLayout } from './Layout';
export type { AppSettings as IAppSettings } from './AppSettings';