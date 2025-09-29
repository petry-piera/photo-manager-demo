# Data Model Design

## Overview
Data model for PhotoManager defining entities, relationships, validation rules, and state transitions for local storage using IndexedDB.

## Core Entities

### Photo
```typescript
interface Photo {
  id: string;                    // UUID v4
  fileName: string;              // Original filename
  filePath: string;              // File system path or handle reference
  fileSize: number;              // File size in bytes
  mimeType: string;              // MIME type (image/jpeg, image/png, etc.)
  width: number;                 // Image width in pixels
  height: number;                // Image height in pixels

  // Metadata
  dateTaken: Date;               // From EXIF or file creation date
  dateAdded: Date;               // When added to PhotoManager
  dateModified: Date;            // Last modification timestamp

  // EXIF Data (optional)
  camera?: string;               // Camera make/model
  location?: {
    latitude: number;
    longitude: number;
  };

  // User Data
  caption?: string;              // User-added description
  tags: string[];                // User-added tags

  // Computed Properties
  thumbnailDataUrl?: string;     // Cached thumbnail (base64)
  albumIds: string[];            // Albums containing this photo
}
```

**Validation Rules**:
- `id`: Required, unique, UUID format
- `fileName`: Required, non-empty string
- `filePath`: Required, valid file path/handle
- `fileSize`: Required, positive number
- `mimeType`: Required, must be supported image type
- `width/height`: Required, positive integers
- `dateTaken`: Required, valid date
- `tags`: Array of trimmed, non-empty strings
- `caption`: Optional, max 1000 characters

### Album
```typescript
interface Album {
  id: string;                    // UUID v4
  name: string;                  // User-defined or auto-generated name
  type: 'date' | 'custom';       // Album type

  // Date Albums (type: 'date')
  year?: number;                 // Year for date-based albums
  month?: number;                // Month (1-12) for date-based albums

  // Organization
  coverPhotoId?: string;         // Photo ID for album thumbnail
  photoIds: string[];            // Ordered list of photo IDs
  position: number;              // Display order in album grid

  // Metadata
  dateCreated: Date;
  dateModified: Date;
  photoCount: number;            // Computed field
}
```

**Validation Rules**:
- `id`: Required, unique, UUID format
- `name`: Required, non-empty string, max 100 characters
- `type`: Required, enum value
- `year`: Required for date albums, 1900-current year
- `month`: Optional for date albums, 1-12
- `photoIds`: Array of valid photo IDs
- `position`: Non-negative integer

### Tag
```typescript
interface Tag {
  id: string;                    // UUID v4
  name: string;                  // Tag name (normalized, lowercase)
  displayName: string;           // Original case tag name
  color?: string;                // Optional color for UI (hex)
  photoCount: number;            // Number of photos with this tag
  dateCreated: Date;
  dateLastUsed: Date;
}
```

**Validation Rules**:
- `id`: Required, unique, UUID format
- `name`: Required, unique, lowercase, alphanumeric + hyphens
- `displayName`: Required, original case version
- `color`: Optional, valid hex color code
- `photoCount`: Non-negative integer

### AlbumLayout
```typescript
interface AlbumLayout {
  id: string;                    // 'main' or album ID
  albumIds: string[];            // Ordered list for main grid
  gridColumns: number;           // Number of columns
  viewMode: 'grid' | 'list';     // Display mode
  sortBy: 'name' | 'date' | 'photoCount' | 'custom';
  sortOrder: 'asc' | 'desc';
  dateModified: Date;
}
```

### PhotoLayout
```typescript
interface PhotoLayout {
  albumId: string;               // Parent album ID
  photoIds: string[];            // Ordered list of photos
  gridColumns: number;           // Number of columns
  viewMode: 'grid' | 'list';     // Display mode
  sortBy: 'name' | 'date' | 'custom';
  sortOrder: 'asc' | 'desc';
  dateModified: Date;
}
```

### AppSettings
```typescript
interface AppSettings {
  id: 'main';                    // Singleton settings

  // UI Preferences
  theme: 'light' | 'dark' | 'system';
  language: string;              // ISO language code

  // Performance Settings
  maxThumbnailSize: number;      // Max thumbnail dimension
  thumbnailQuality: number;      // JPEG quality (0-1)
  maxConcurrentLoads: number;    // Concurrent image loads

  // Import Settings
  autoOrganizeByDate: boolean;   // Auto-create date albums
  duplicateHandling: 'skip' | 'rename' | 'ask';
  supportedFormats: string[];    // Supported MIME types

  // Storage
  maxStorageUsage: number;       // Max IndexedDB usage in bytes

  dateModified: Date;
}
```

## Relationships

### Photo ↔ Album (Many-to-Many)
- Photos can belong to multiple albums
- Albums contain multiple photos
- Implemented via `photoIds` array in Album and `albumIds` array in Photo
- Date albums automatically include photos based on `dateTaken`

### Photo ↔ Tag (Many-to-Many)
- Photos can have multiple tags
- Tags can be applied to multiple photos
- Implemented via `tags` array in Photo
- Tag entity maintains `photoCount` for performance

### Album → Photo (Cover Photo)
- Each album can have one cover photo
- Implemented via `coverPhotoId` in Album
- Defaults to first photo if not set

## State Transitions

### Photo Lifecycle
1. **Import**: File selected → EXIF extracted → Thumbnail generated → Stored
2. **Organization**: Photo added/removed from albums
3. **Tagging**: Tags added/removed, tag entities updated
4. **Editing**: Caption modified, metadata updated
5. **Deletion**: Removed from all albums, tags updated, file reference cleared

### Album Lifecycle
1. **Creation**: Date albums auto-created, custom albums user-created
2. **Population**: Photos added via date matching or user action
3. **Organization**: Photo order changed, album position updated
4. **Modification**: Name changed, cover photo updated
5. **Deletion**: Photos removed (but not deleted), album removed from layouts

## Database Schema (IndexedDB)

### Object Stores
```typescript
// Photos store
photos: {
  keyPath: 'id',
  indexes: [
    { name: 'dateTaken', keyPath: 'dateTaken' },
    { name: 'dateAdded', keyPath: 'dateAdded' },
    { name: 'fileName', keyPath: 'fileName' },
    { name: 'tags', keyPath: 'tags', multiEntry: true }
  ]
}

// Albums store
albums: {
  keyPath: 'id',
  indexes: [
    { name: 'type', keyPath: 'type' },
    { name: 'position', keyPath: 'position' },
    { name: 'year-month', keyPath: ['year', 'month'] },
    { name: 'name', keyPath: 'name' }
  ]
}

// Tags store
tags: {
  keyPath: 'id',
  indexes: [
    { name: 'name', keyPath: 'name', unique: true },
    { name: 'photoCount', keyPath: 'photoCount' },
    { name: 'dateLastUsed', keyPath: 'dateLastUsed' }
  ]
}

// Layouts stores
albumLayouts: { keyPath: 'id' }
photoLayouts: { keyPath: 'albumId' }
appSettings: { keyPath: 'id' }
```

### Query Patterns
- **Find photos by date range**: Use `dateTaken` index
- **Find photos by tag**: Use `tags` multiEntry index
- **Find date albums**: Use `type` index with `year-month` compound index
- **Get album photos**: Direct lookup via `photoIds` array
- **Search by filename**: Use `fileName` index with prefix matching

## Performance Considerations

### Indexing Strategy
- Primary queries indexed for fast lookup
- Compound indexes for complex date queries
- MultiEntry index for tag searches

### Data Denormalization
- `photoCount` cached in Album and Tag entities
- `albumIds` cached in Photo entity
- Thumbnail data cached in Photo entity

### Batch Operations
- Import multiple photos in single transaction
- Update album photo counts in batch
- Clean up orphaned tags periodically

## Validation & Constraints

### Business Rules
1. Date albums must have unique year/month combinations
2. Custom album names must be unique within user's collection
3. Photo can't be in same album multiple times
4. Cover photo must be in the album
5. Tag names must be unique (case-insensitive)

### Data Integrity
1. Orphaned photo cleanup when album deleted
2. Tag photo count consistency maintenance
3. Album photo count consistency maintenance
4. File handle validation before access

### Error Handling
1. Invalid file formats rejected with clear messages
2. Storage quota exceeded handled gracefully
3. Corrupted data recovery via rebuild operations
4. Missing file references handled with placeholders