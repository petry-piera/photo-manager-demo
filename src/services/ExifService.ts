/**
 * EXIF service for photo metadata extraction using ExifReader
 */

import ExifReader from 'exifreader';

/**
 * EXIF data interface
 */
export interface ExifData {
  dateTaken?: Date;
  camera?: {
    make?: string;
    model?: string;
    lens?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
  technical?: {
    iso?: number;
    aperture?: string;
    shutterSpeed?: string;
    focalLength?: string;
    flash?: boolean;
    orientation?: number;
  };
  dimensions?: {
    width?: number;
    height?: number;
  };
  software?: string;
  copyright?: string;
  artist?: string;
  description?: string;
  keywords?: string[];
}

/**
 * EXIF extraction options
 */
export interface ExifExtractionOptions {
  includeLocation?: boolean;
  includeTechnical?: boolean;
  includeCamera?: boolean;
  includeDimensions?: boolean;
  includeMetadata?: boolean;
}

/**
 * EXIF service implementation
 */
export class ExifService {
  /**
   * Extract EXIF data from file
   */
  async extractExifData(
    file: File,
    options: ExifExtractionOptions = {}
  ): Promise<ExifData> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const tags = ExifReader.load(arrayBuffer, {
        expanded: true,
        includeUnknown: false
      });

      const exifData: ExifData = {};

      // Extract date taken
      exifData.dateTaken = this.extractDateTaken(tags, file);

      // Extract camera information
      if (options.includeCamera !== false) {
        exifData.camera = this.extractCameraInfo(tags);
      }

      // Extract location data
      if (options.includeLocation !== false) {
        exifData.location = this.extractLocationData(tags);
      }

      // Extract technical settings
      if (options.includeTechnical !== false) {
        exifData.technical = this.extractTechnicalData(tags);
      }

      // Extract image dimensions
      if (options.includeDimensions !== false) {
        exifData.dimensions = this.extractDimensions(tags);
      }

      // Extract metadata
      if (options.includeMetadata !== false) {
        const metadata = this.extractMetadata(tags);
        exifData.software = metadata.software;
        exifData.copyright = metadata.copyright;
        exifData.artist = metadata.artist;
        exifData.description = metadata.description;
        exifData.keywords = metadata.keywords;
      }

      return exifData;
    } catch (error) {
      console.warn('Failed to extract EXIF data:', error);

      // Return fallback data with file modification date
      return {
        dateTaken: this.getFileFallbackDate(file),
        dimensions: await this.getDimensionsFromImage(file)
      };
    }
  }

  /**
   * Extract date taken with multiple fallbacks
   */
  private extractDateTaken(tags: any, file: File): Date {
    // Try various EXIF date fields in order of preference
    const dateFields = [
      'exif.DateTimeOriginal',
      'exif.DateTime',
      'exif.DateTimeDigitized',
      'ifd0.DateTime',
      'xmp.DateTimeOriginal',
      'xmp.CreateDate'
    ];

    for (const field of dateFields) {
      const dateValue = this.getNestedProperty(tags, field);
      if (dateValue) {
        const date = this.parseExifDate(dateValue);
        if (date && date.getTime() > 0) {
          return date;
        }
      }
    }

    // Fallback to file modification date
    return this.getFileFallbackDate(file);
  }

  /**
   * Extract camera information
   */
  private extractCameraInfo(tags: any): ExifData['camera'] {
    const camera: ExifData['camera'] = {};

    const make = this.getNestedProperty(tags, 'ifd0.Make') || this.getNestedProperty(tags, 'exif.Make');
    const model = this.getNestedProperty(tags, 'ifd0.Model') || this.getNestedProperty(tags, 'exif.Model');
    const lens = this.getNestedProperty(tags, 'exif.LensModel') || this.getNestedProperty(tags, 'exif.LensMake');

    if (make?.description) camera.make = make.description.trim();
    if (model?.description) camera.model = model.description.trim();
    if (lens?.description) camera.lens = lens.description.trim();

    return Object.keys(camera).length > 0 ? camera : undefined;
  }

  /**
   * Extract GPS location data
   */
  private extractLocationData(tags: any): ExifData['location'] {
    const location: ExifData['location'] = {};

    const gpsLat = this.getNestedProperty(tags, 'gps.GPSLatitude');
    const gpsLatRef = this.getNestedProperty(tags, 'gps.GPSLatitudeRef');
    const gpsLng = this.getNestedProperty(tags, 'gps.GPSLongitude');
    const gpsLngRef = this.getNestedProperty(tags, 'gps.GPSLongitudeRef');
    const gpsAlt = this.getNestedProperty(tags, 'gps.GPSAltitude');

    if (gpsLat && gpsLatRef && gpsLng && gpsLngRef) {
      location.latitude = this.convertDMSToDD(gpsLat.description, gpsLatRef.description);
      location.longitude = this.convertDMSToDD(gpsLng.description, gpsLngRef.description);
    }

    if (gpsAlt?.description) {
      location.altitude = parseFloat(gpsAlt.description);
    }

    return Object.keys(location).length > 0 ? location : undefined;
  }

  /**
   * Extract technical camera settings
   */
  private extractTechnicalData(tags: any): ExifData['technical'] {
    const technical: ExifData['technical'] = {};

    const iso = this.getNestedProperty(tags, 'exif.ISOSpeedRatings') || this.getNestedProperty(tags, 'exif.PhotographicSensitivity');
    const aperture = this.getNestedProperty(tags, 'exif.FNumber') || this.getNestedProperty(tags, 'exif.ApertureValue');
    const shutterSpeed = this.getNestedProperty(tags, 'exif.ExposureTime') || this.getNestedProperty(tags, 'exif.ShutterSpeedValue');
    const focalLength = this.getNestedProperty(tags, 'exif.FocalLength');
    const flash = this.getNestedProperty(tags, 'exif.Flash');
    const orientation = this.getNestedProperty(tags, 'ifd0.Orientation') || this.getNestedProperty(tags, 'exif.Orientation');

    if (iso?.description) {
      technical.iso = parseInt(iso.description, 10);
    }

    if (aperture?.description) {
      technical.aperture = `f/${aperture.description}`;
    }

    if (shutterSpeed?.description) {
      technical.shutterSpeed = this.formatShutterSpeed(shutterSpeed.description);
    }

    if (focalLength?.description) {
      technical.focalLength = `${focalLength.description}mm`;
    }

    if (flash?.description) {
      technical.flash = !flash.description.toLowerCase().includes('no flash');
    }

    if (orientation?.value) {
      technical.orientation = orientation.value;
    }

    return Object.keys(technical).length > 0 ? technical : undefined;
  }

  /**
   * Extract image dimensions
   */
  private extractDimensions(tags: any): ExifData['dimensions'] {
    const dimensions: ExifData['dimensions'] = {};

    const width = this.getNestedProperty(tags, 'file.ImageWidth') ||
                 this.getNestedProperty(tags, 'exif.PixelXDimension') ||
                 this.getNestedProperty(tags, 'ifd0.ImageWidth');

    const height = this.getNestedProperty(tags, 'file.ImageHeight') ||
                  this.getNestedProperty(tags, 'exif.PixelYDimension') ||
                  this.getNestedProperty(tags, 'ifd0.ImageLength');

    if (width?.value) dimensions.width = width.value;
    if (height?.value) dimensions.height = height.value;

    return Object.keys(dimensions).length > 0 ? dimensions : undefined;
  }

  /**
   * Extract metadata fields
   */
  private extractMetadata(tags: any): {
    software?: string;
    copyright?: string;
    artist?: string;
    description?: string;
    keywords?: string[];
  } {
    const metadata: any = {};

    const software = this.getNestedProperty(tags, 'ifd0.Software') || this.getNestedProperty(tags, 'exif.Software');
    const copyright = this.getNestedProperty(tags, 'ifd0.Copyright') || this.getNestedProperty(tags, 'exif.Copyright');
    const artist = this.getNestedProperty(tags, 'ifd0.Artist') || this.getNestedProperty(tags, 'exif.Artist');
    const description = this.getNestedProperty(tags, 'ifd0.ImageDescription') ||
                       this.getNestedProperty(tags, 'exif.ImageDescription') ||
                       this.getNestedProperty(tags, 'xmp.Description');
    const keywords = this.getNestedProperty(tags, 'iptc.Keywords') || this.getNestedProperty(tags, 'xmp.Subject');

    if (software?.description) metadata.software = software.description.trim();
    if (copyright?.description) metadata.copyright = copyright.description.trim();
    if (artist?.description) metadata.artist = artist.description.trim();
    if (description?.description) metadata.description = description.description.trim();

    if (keywords) {
      if (Array.isArray(keywords)) {
        metadata.keywords = keywords.map((k: any) => k.description || k).filter(Boolean);
      } else if (keywords.description) {
        metadata.keywords = [keywords.description];
      }
    }

    return metadata;
  }

  /**
   * Get nested property from object using dot notation
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Parse EXIF date string to Date object
   */
  private parseExifDate(dateValue: any): Date | null {
    if (!dateValue) return null;

    let dateString = dateValue.description || dateValue;

    if (typeof dateString !== 'string') {
      return null;
    }

    // EXIF dates are typically in format "YYYY:MM:DD HH:MM:SS"
    dateString = dateString.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Get fallback date from file
   */
  private getFileFallbackDate(file: File): Date {
    // Use file last modified date as fallback
    return new Date(file.lastModified);
  }

  /**
   * Convert GPS DMS (Degrees, Minutes, Seconds) to DD (Decimal Degrees)
   */
  private convertDMSToDD(dms: string, ref: string): number {
    if (!dms || !ref) return 0;

    // Parse DMS format like "40° 42′ 51″" or "40,42.85"
    const parts = dms.match(/(\d+).*?(\d+).*?(\d+\.?\d*)/);
    if (!parts) {
      // Try decimal format
      const decimal = parseFloat(dms.replace(/[^\d.-]/g, ''));
      if (!isNaN(decimal)) {
        return ref.toUpperCase() === 'S' || ref.toUpperCase() === 'W' ? -decimal : decimal;
      }
      return 0;
    }

    const degrees = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const seconds = parseFloat(parts[3]);

    let dd = degrees + minutes / 60 + seconds / 3600;

    // Apply hemisphere reference
    if (ref.toUpperCase() === 'S' || ref.toUpperCase() === 'W') {
      dd = -dd;
    }

    return dd;
  }

  /**
   * Format shutter speed for display
   */
  private formatShutterSpeed(speed: string): string {
    const num = parseFloat(speed);
    if (isNaN(num)) return speed;

    if (num >= 1) {
      return `${num}s`;
    } else {
      return `1/${Math.round(1 / num)}s`;
    }
  }

  /**
   * Get image dimensions from file using canvas (fallback method)
   */
  private async getDimensionsFromImage(file: File): Promise<ExifData['dimensions']> {
    if (!file.type.startsWith('image/')) {
      return undefined;
    }

    try {
      return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight
          });
          URL.revokeObjectURL(img.src);
        };

        img.onerror = () => {
          resolve(undefined);
          URL.revokeObjectURL(img.src);
        };

        img.src = URL.createObjectURL(file);
      });
    } catch {
      return undefined;
    }
  }

  /**
   * Check if file format is supported for EXIF extraction
   */
  isSupportedFormat(file: File): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/tiff',
      'image/tif',
      'image/png', // PNG can have limited EXIF
      'image/webp', // WebP can have EXIF
      'image/heic',
      'image/heif'
    ];

    return supportedTypes.includes(file.type.toLowerCase());
  }

  /**
   * Extract quick metadata for thumbnails (lighter extraction)
   */
  async extractQuickMetadata(file: File): Promise<{
    dateTaken?: Date;
    width?: number;
    height?: number;
    orientation?: number;
  }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const tags = ExifReader.load(arrayBuffer, {
        expanded: true,
        includeUnknown: false
      });

      return {
        dateTaken: this.extractDateTaken(tags, file),
        ...this.extractDimensions(tags),
        orientation: this.getNestedProperty(tags, 'ifd0.Orientation')?.value ||
                    this.getNestedProperty(tags, 'exif.Orientation')?.value
      };
    } catch (error) {
      console.warn('Failed to extract quick metadata:', error);

      return {
        dateTaken: this.getFileFallbackDate(file),
        ...await this.getDimensionsFromImage(file)
      };
    }
  }

  /**
   * Generate photo filename from EXIF date
   */
  generateFilenameFromExif(exifData: ExifData, originalFilename: string): string {
    if (!exifData.dateTaken) {
      return originalFilename;
    }

    const date = exifData.dateTaken;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    const extension = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';

    return `${year}${month}${day}_${hour}${minute}${second}.${extension}`;
  }

  /**
   * Determine album name from EXIF date
   */
  generateAlbumFromExif(exifData: ExifData): { year: number; month: number; name: string } | null {
    if (!exifData.dateTaken) {
      return null;
    }

    const date = exifData.dateTaken;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return {
      year,
      month,
      name: `${monthNames[month - 1]} ${year}`
    };
  }
}

/**
 * Singleton EXIF service instance
 */
export const exifService = new ExifService();

/**
 * Default export
 */
export default exifService;