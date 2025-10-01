/**
 * Unit tests for file handling utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatFileSize,
  validatePhotoFile,
  getFileExtension,
  processFilesInBatches,
  SUPPORTED_IMAGE_TYPES
} from '@/utils/file-utils';

// Mock File System Access API
const mockShowOpenFilePicker = vi.fn();
const mockShowSaveFilePicker = vi.fn();
const mockShowDirectoryPicker = vi.fn();

Object.assign(window, {
  showOpenFilePicker: mockShowOpenFilePicker,
  showSaveFilePicker: mockShowSaveFilePicker,
  showDirectoryPicker: mockShowDirectoryPicker
});

// Mock file for testing
function createMockFile(name: string, size: number, type: string): File {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('File Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(512)).toBe('512 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should handle edge cases', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should use default decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('validatePhotoFile', () => {
    it('should validate supported file types', () => {
      const jpegFile = createMockFile('test.jpg', 1000, 'image/jpeg');
      const result = validatePhotoFile(jpegFile);
      expect(result.valid).toBe(true);
      expect(result.fileInfo.isSupported).toBe(true);

      const pngFile = createMockFile('test.png', 1000, 'image/png');
      const result2 = validatePhotoFile(pngFile);
      expect(result2.valid).toBe(true);
    });

    it('should reject unsupported file types', () => {
      const textFile = createMockFile('test.txt', 1000, 'text/plain');
      const result = validatePhotoFile(textFile);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const videoFile = createMockFile('test.mp4', 1000, 'video/mp4');
      const result2 = validatePhotoFile(videoFile);
      expect(result2.valid).toBe(false);
    });

    it('should handle empty MIME type', () => {
      const unknownFile = createMockFile('test', 1000, '');
      const result = validatePhotoFile(unknownFile);
      expect(result.valid).toBe(false);
    });

    it('should validate by extension fallback', () => {
      const jpegFile = createMockFile('test.jpg', 1000, '');
      const result = validatePhotoFile(jpegFile);
      expect(result.valid).toBe(true);

      const unknownFile = createMockFile('test.xyz', 1000, '');
      const result2 = validatePhotoFile(unknownFile);
      expect(result2.valid).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extensions correctly', () => {
      expect(getFileExtension('test.jpg')).toBe('.jpg');
      expect(getFileExtension('test.jpeg')).toBe('.jpeg');
      expect(getFileExtension('test.PNG')).toBe('.png');
      expect(getFileExtension('archive.tar.gz')).toBe('.gz');
    });

    it('should handle files without extensions', () => {
      expect(getFileExtension('README')).toBe('.readme'); // Takes last part as extension
      expect(getFileExtension('.gitignore')).toBe('.gitignore');
      expect(getFileExtension('')).toBe('.jpg'); // Empty string fallback
    });

    it('should handle MIME type fallback', () => {
      expect(getFileExtension('test', 'image/jpeg')).toBe('.test'); // Filename takes priority
      expect(getFileExtension('', 'image/jpeg')).toBe('.jpg'); // MIME fallback when no filename
    });
  });



  describe('processFilesInBatches', () => {
    it('should process files in batches', async () => {
      const files = [
        createMockFile('file1.jpg', 1000, 'image/jpeg'),
        createMockFile('file2.jpg', 2000, 'image/jpeg'),
        createMockFile('file3.jpg', 3000, 'image/jpeg')
      ];

      const processFile = vi.fn().mockImplementation(async (file: File) => {
        return { file, processed: true };
      });

      const onProgress = vi.fn();

      const result = await processFilesInBatches(files, processFile, {
        batchSize: 2,
        onProgress
      });

      expect(result).toHaveLength(3);
      expect(processFile).toHaveBeenCalledTimes(3);
    });

    it('should handle processing with progress callback', async () => {
      const files = [
        createMockFile('file1.jpg', 1000, 'image/jpeg'),
        createMockFile('file2.jpg', 2000, 'image/jpeg')
      ];

      const processFile = vi.fn().mockResolvedValue({ processed: true });
      const onProgress = vi.fn();

      await processFilesInBatches(files, processFile, {
        batchSize: 1,
        onProgress
      });

      expect(onProgress).toHaveBeenCalledWith({
        current: 1,
        total: 2,
        currentFileName: 'file1.jpg',
        stage: 'processing',
        percentage: 50
      });
    });
  });


  describe('Edge cases and error conditions', () => {
    it('should handle very large files', () => {
      const largeSize = 1024 * 1024 * 1024 * 1024; // 1TB
      const formatted = formatFileSize(largeSize);

      expect(formatted).toContain('TB'); // Should show in TB
    });

    it('should handle files with unusual names', () => {
      expect(getFileExtension('file.with.many.dots.jpg')).toBe('.jpg');
      expect(getFileExtension('no-extension')).toBe('.no-extension'); // Takes last part
      expect(getFileExtension('.hidden')).toBe('.hidden');
    });

    it('should validate file size limits', () => {
      const validFile = createMockFile('normal.jpg', 100 * 1024 * 1024, 'image/jpeg'); // 100MB (should pass)
      const result1 = validatePhotoFile(validFile);
      expect(result1.valid).toBe(true); // Should pass at exactly 100MB

      const tooLargeFile = createMockFile('huge.jpg', 101 * 1024 * 1024, 'image/jpeg'); // 101MB (should fail)
      const result2 = validatePhotoFile(tooLargeFile);
      expect(result2.valid).toBe(false); // Should fail due to size limit
      expect(result2.errors.some(e => e.includes('too large'))).toBe(true);
    });
  });
});