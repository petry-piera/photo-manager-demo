/**
 * Tag model representing a user-defined label for photos
 */

export interface Tag {
  // Core Identification
  id: string; // UUID v4
  name: string; // Tag name (normalized, lowercase)
  displayName: string; // Original case tag name

  // Optional Customization
  color?: string; // Optional color for UI (hex)

  // Usage Statistics
  photoCount: number; // Number of photos with this tag

  // Metadata
  dateCreated: Date;
  dateLastUsed: Date;
}

/**
 * Validation rules for Tag model
 */
export class TagValidation {
  private static readonly MAX_NAME_LENGTH = 50;
  private static readonly MIN_NAME_LENGTH = 1;
  private static readonly VALID_NAME_PATTERN = /^[a-z0-9\-_]+$/;
  private static readonly HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

  /**
   * Validate a tag object against business rules
   */
  static validate(tag: Partial<Tag>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!tag.id || !this.isValidUUID(tag.id)) {
      errors.push('ID is required and must be a valid UUID');
    }

    if (!tag.name || tag.name.trim().length === 0) {
      errors.push('Tag name is required');
    } else if (tag.name.length < this.MIN_NAME_LENGTH) {
      errors.push(`Tag name must be at least ${this.MIN_NAME_LENGTH} character`);
    } else if (tag.name.length > this.MAX_NAME_LENGTH) {
      errors.push(`Tag name must not exceed ${this.MAX_NAME_LENGTH} characters`);
    } else if (!this.VALID_NAME_PATTERN.test(tag.name)) {
      errors.push('Tag name must contain only lowercase letters, numbers, hyphens, and underscores');
    }

    if (!tag.displayName || tag.displayName.trim().length === 0) {
      errors.push('Display name is required');
    } else if (tag.displayName.length > this.MAX_NAME_LENGTH) {
      errors.push(`Display name must not exceed ${this.MAX_NAME_LENGTH} characters`);
    }

    if (typeof tag.photoCount !== 'number' || tag.photoCount < 0) {
      errors.push('Photo count must be a non-negative number');
    }

    if (!tag.dateCreated || !(tag.dateCreated instanceof Date)) {
      errors.push('Date created is required and must be a valid Date');
    }

    if (!tag.dateLastUsed || !(tag.dateLastUsed instanceof Date)) {
      errors.push('Date last used is required and must be a valid Date');
    }

    // Optional fields validation
    if (tag.color && !this.HEX_COLOR_PATTERN.test(tag.color)) {
      errors.push('Color must be a valid hex color code (e.g., #FF5733)');
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
   * Normalize tag name (lowercase, alphanumeric + hyphens/underscores only)
   */
  static normalizeName(displayName: string): string {
    return displayName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9\-_]/g, '') // Remove invalid characters
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Validate display name format
   */
  static isValidDisplayName(displayName: string): boolean {
    const trimmed = displayName.trim();
    return trimmed.length >= this.MIN_NAME_LENGTH &&
           trimmed.length <= this.MAX_NAME_LENGTH &&
           /^[a-zA-Z0-9\s\-_]+$/.test(trimmed);
  }

  /**
   * Validate hex color format
   */
  static isValidColor(color: string): boolean {
    return this.HEX_COLOR_PATTERN.test(color);
  }

  /**
   * Sanitize display name
   */
  static sanitizeDisplayName(displayName: string): string {
    return displayName.trim().replace(/\s+/g, ' ');
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
 * Helper functions for Tag model
 */
export class TagUtils {
  /**
   * Generate a new UUID v4
   */
  static generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new tag
   */
  static create(data: {
    displayName: string;
    color?: string;
  }): Tag {
    const now = new Date();
    const sanitizedDisplayName = TagValidation.sanitizeDisplayName(data.displayName);
    const normalizedName = TagValidation.normalizeName(sanitizedDisplayName);

    if (!normalizedName) {
      throw new Error('Invalid tag name: must contain at least one valid character');
    }

    return {
      id: this.generateId(),
      name: normalizedName,
      displayName: sanitizedDisplayName,
      color: data.color,
      photoCount: 0,
      dateCreated: now,
      dateLastUsed: now,
    };
  }

  /**
   * Update tag metadata
   */
  static updateMetadata(tag: Tag, updates: {
    displayName?: string;
    color?: string;
  }): Tag {
    const updatedTag = { ...tag };

    if (updates.displayName !== undefined) {
      const sanitizedDisplayName = TagValidation.sanitizeDisplayName(updates.displayName);
      const normalizedName = TagValidation.normalizeName(sanitizedDisplayName);

      if (!normalizedName) {
        throw new Error('Invalid tag name: must contain at least one valid character');
      }

      updatedTag.displayName = sanitizedDisplayName;
      updatedTag.name = normalizedName;
    }

    if (updates.color !== undefined) {
      updatedTag.color = updates.color;
    }

    return updatedTag;
  }

  /**
   * Increment photo count and update last used date
   */
  static incrementUsage(tag: Tag): Tag {
    return {
      ...tag,
      photoCount: tag.photoCount + 1,
      dateLastUsed: new Date(),
    };
  }

  /**
   * Decrement photo count
   */
  static decrementUsage(tag: Tag): Tag {
    return {
      ...tag,
      photoCount: Math.max(0, tag.photoCount - 1),
    };
  }

  /**
   * Update photo count to specific value
   */
  static setPhotoCount(tag: Tag, count: number): Tag {
    return {
      ...tag,
      photoCount: Math.max(0, count),
      dateLastUsed: count > 0 ? new Date() : tag.dateLastUsed,
    };
  }

  /**
   * Generate tag color automatically based on name
   */
  static generateColor(tagName: string): string {
    // Simple hash function to generate consistent colors
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert hash to HSL color (fixed saturation and lightness for consistency)
    const hue = Math.abs(hash) % 360;
    return this.hslToHex(hue, 70, 50); // 70% saturation, 50% lightness
  }

  /**
   * Convert HSL to hex color
   */
  private static hslToHex(h: number, s: number, l: number): string {
    const sNorm = s / 100;
    const lNorm = l / 100;

    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = lNorm - c / 2;

    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }

    const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  }

  /**
   * Sort tags by various criteria
   */
  static sortTags(tags: Tag[], sortBy: 'name' | 'displayName' | 'photoCount' | 'dateCreated' | 'dateLastUsed', order: 'asc' | 'desc' = 'asc'): Tag[] {
    const sorted = [...tags].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'displayName':
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case 'photoCount':
          comparison = a.photoCount - b.photoCount;
          break;
        case 'dateCreated':
          comparison = a.dateCreated.getTime() - b.dateCreated.getTime();
          break;
        case 'dateLastUsed':
          comparison = a.dateLastUsed.getTime() - b.dateLastUsed.getTime();
          break;
      }

      return order === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Filter tags by criteria
   */
  static filterTags(tags: Tag[], filters: {
    minPhotoCount?: number;
    maxPhotoCount?: number;
    hasColor?: boolean;
    nameContains?: string;
  }): Tag[] {
    return tags.filter(tag => {
      if (filters.minPhotoCount !== undefined && tag.photoCount < filters.minPhotoCount) {
        return false;
      }

      if (filters.maxPhotoCount !== undefined && tag.photoCount > filters.maxPhotoCount) {
        return false;
      }

      if (filters.hasColor !== undefined) {
        const hasColor = !!tag.color;
        if (filters.hasColor !== hasColor) {
          return false;
        }
      }

      if (filters.nameContains !== undefined) {
        const searchTerm = filters.nameContains.toLowerCase();
        if (!tag.displayName.toLowerCase().includes(searchTerm) &&
            !tag.name.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get popular tags (by photo count)
   */
  static getPopularTags(tags: Tag[], limit: number = 10): Tag[] {
    return this.sortTags(tags, 'photoCount', 'desc').slice(0, limit);
  }

  /**
   * Get recently used tags
   */
  static getRecentTags(tags: Tag[], limit: number = 10): Tag[] {
    return this.sortTags(tags, 'dateLastUsed', 'desc').slice(0, limit);
  }

  /**
   * Search tags by name or display name
   */
  static searchTags(tags: Tag[], query: string, limit?: number): Tag[] {
    const lowerQuery = query.toLowerCase();

    // Score tags by relevance
    const scored = tags
      .map(tag => {
        let score = 0;
        const lowerDisplayName = tag.displayName.toLowerCase();
        const lowerName = tag.name.toLowerCase();

        // Exact match scores highest
        if (lowerDisplayName === lowerQuery || lowerName === lowerQuery) {
          score = 1000;
        }
        // Starts with query scores high
        else if (lowerDisplayName.startsWith(lowerQuery) || lowerName.startsWith(lowerQuery)) {
          score = 500;
        }
        // Contains query scores medium
        else if (lowerDisplayName.includes(lowerQuery) || lowerName.includes(lowerQuery)) {
          score = 100;
        }

        // Boost score based on usage
        score += tag.photoCount;

        return { tag, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.tag);

    return limit ? scored.slice(0, limit) : scored;
  }

  /**
   * Merge duplicate tags (same normalized name)
   */
  static mergeDuplicates(tags: Tag[]): Tag[] {
    const tagMap = new Map<string, Tag>();

    for (const tag of tags) {
      const existing = tagMap.get(tag.name);
      if (existing) {
        // Merge photo counts and keep most recent metadata
        const merged: Tag = {
          ...existing,
          photoCount: existing.photoCount + tag.photoCount,
          dateLastUsed: existing.dateLastUsed > tag.dateLastUsed ? existing.dateLastUsed : tag.dateLastUsed,
          color: existing.color || tag.color, // Prefer existing color if present
        };
        tagMap.set(tag.name, merged);
      } else {
        tagMap.set(tag.name, { ...tag });
      }
    }

    return Array.from(tagMap.values());
  }

  /**
   * Deep clone tag object
   */
  static clone(tag: Tag): Tag {
    return { ...tag };
  }

  /**
   * Check if tag is unused (no photos)
   */
  static isUnused(tag: Tag): boolean {
    return tag.photoCount === 0;
  }

  /**
   * Get tag display color (auto-generate if not set)
   */
  static getDisplayColor(tag: Tag): string {
    return tag.color || this.generateColor(tag.name);
  }
}

/**
 * Export types for external use
 */
export type TagCreateData = Parameters<typeof TagUtils.create>[0];
export type TagUpdateData = Parameters<typeof TagUtils.updateMetadata>[1];

/**
 * Default export
 */
export default Tag;