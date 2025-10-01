/**
 * File handling utilities for photo import and management
 */

/**
 * Supported image file types
 */
export const SUPPORTED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
  'image/tiff': ['.tiff', '.tif'],
  'image/bmp': ['.bmp'],
  'image/gif': ['.gif'] // For viewing, not typically for photography
} as const;

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    name: string;
    size: number;
    type: string;
    extension: string;
    isSupported: boolean;
  };
}

/**
 * File import progress callback
 */
export type FileProgressCallback = (progress: {
  current: number;
  total: number;
  currentFileName: string;
  stage: 'validation' | 'reading' | 'processing' | 'storing';
  percentage: number;
}) => void;

/**
 * File System Access API support detection
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'FileSystemFileHandle' in window;
}

/**
 * File picker options for photo import
 */
export const PHOTO_PICKER_OPTIONS = {
  multiple: true,
  excludeAcceptAllOption: true,
  types: [
    {
      description: 'Image files',
      accept: {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        'image/heic': ['.heic'],
        'image/heif': ['.heif'],
        'image/tiff': ['.tiff', '.tif']
      }
    }
  ]
};

/**
 * File picker using File System Access API
 */
export async function pickPhotoFiles(): Promise<File[]> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API not supported. Use drag and drop instead.');
  }

  try {
    const fileHandles = await (window as any).showOpenFilePicker(PHOTO_PICKER_OPTIONS);
    const files: File[] = [];

    for (const handle of fileHandles) {
      const file = await handle.getFile();
      files.push(file);
    }

    return files;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return []; // User cancelled
    }
    throw new Error(`Failed to pick files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate a single file for photo import
 */
export function validatePhotoFile(file: File): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase() || '';

  // Check if file type is supported
  const isSupported = Object.keys(SUPPORTED_IMAGE_TYPES).includes(file.type) ||
                     Object.values(SUPPORTED_IMAGE_TYPES).flat().includes(extension);

  if (!isSupported) {
    errors.push(`Unsupported file type: ${file.type || 'unknown'} (${extension})`);
  }

  // Check file size (max 100MB for safety)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    errors.push(`File too large: ${formatFileSize(file.size)} (max: ${formatFileSize(maxSize)})`);
  }

  // Check for very small files that might be corrupted
  const minSize = 1024; // 1KB
  if (file.size < minSize) {
    warnings.push(`File is very small: ${formatFileSize(file.size)} - might be corrupted`);
  }

  // Check file name
  if (!file.name || file.name.trim().length === 0) {
    errors.push('File has no name');
  }

  // Warn about very long filenames
  if (file.name.length > 255) {
    warnings.push('Filename is very long and might cause issues');
  }

  // Check for special characters that might cause issues
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(file.name)) {
    warnings.push('Filename contains special characters that might cause issues');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      extension,
      isSupported
    }
  };
}

/**
 * Validate multiple files for batch import
 */
export function validatePhotoFiles(files: File[]): {
  valid: FileValidationResult[];
  invalid: FileValidationResult[];
  totalSize: number;
  summary: {
    totalFiles: number;
    validFiles: number;
    invalidFiles: number;
    warnings: number;
    supportedTypes: string[];
  };
} {
  const valid: FileValidationResult[] = [];
  const invalid: FileValidationResult[] = [];
  let totalSize = 0;
  let warningsCount = 0;
  const foundTypes = new Set<string>();

  for (const file of files) {
    const validation = validatePhotoFile(file);
    totalSize += file.size;
    warningsCount += validation.warnings.length;
    foundTypes.add(file.type);

    if (validation.valid) {
      valid.push(validation);
    } else {
      invalid.push(validation);
    }
  }

  return {
    valid,
    invalid,
    totalSize,
    summary: {
      totalFiles: files.length,
      validFiles: valid.length,
      invalidFiles: invalid.length,
      warnings: warningsCount,
      supportedTypes: Array.from(foundTypes)
    }
  };
}

/**
 * Read file as ArrayBuffer with progress tracking
 */
export function readFileAsArrayBuffer(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result instanceof ArrayBuffer) {
        resolve(event.target.result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
    };

    reader.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read file as Data URL for thumbnails
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        resolve(event.target.result);
      } else {
        reject(new Error('Failed to read file as Data URL'));
      }
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Process files in batches to avoid memory issues
 */
export async function processFilesInBatches<T>(
  files: File[],
  processor: (file: File, index: number) => Promise<T>,
  options: {
    batchSize?: number;
    onProgress?: FileProgressCallback;
    onBatchComplete?: (batchIndex: number, totalBatches: number) => void;
  } = {}
): Promise<T[]> {
  const { batchSize = 5, onProgress, onBatchComplete } = options;
  const results: T[] = [];
  const totalFiles = files.length;
  const totalBatches = Math.ceil(totalFiles / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, totalFiles);
    const batch = files.slice(startIndex, endIndex);

    // Process batch in parallel
    const batchPromises = batch.map(async (file, batchFileIndex) => {
      const globalIndex = startIndex + batchFileIndex;

      if (onProgress) {
        onProgress({
          current: globalIndex + 1,
          total: totalFiles,
          currentFileName: file.name,
          stage: 'processing',
          percentage: ((globalIndex + 1) / totalFiles) * 100
        });
      }

      return processor(file, globalIndex);
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (onBatchComplete) {
      onBatchComplete(batchIndex + 1, totalBatches);
    }

    // Allow UI to update between batches
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return results;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Ensure we don't go beyond our sizes array
  const sizeIndex = Math.min(i, sizes.length - 1);

  return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
}

/**
 * Get file extension from filename or MIME type
 */
export function getFileExtension(filename: string, mimeType?: string): string {
  // Try to get extension from filename first
  const filenameExt = filename.split('.').pop()?.toLowerCase();
  if (filenameExt) {
    return '.' + filenameExt;
  }

  // Fallback to MIME type
  if (mimeType) {
    const typeExtensions = Object.entries(SUPPORTED_IMAGE_TYPES).find(
      ([type]) => type === mimeType
    );
    if (typeExtensions) {
      return typeExtensions[1][0];
    }
  }

  return '.jpg'; // Default fallback
}

/**
 * Generate unique filename to avoid conflicts
 */
export function generateUniqueFilename(
  originalName: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(originalName)) {
    return originalName;
  }

  const nameParts = originalName.split('.');
  const extension = nameParts.length > 1 ? '.' + nameParts.pop() : '';
  const baseName = nameParts.join('.');

  let counter = 1;
  let newName: string;

  do {
    newName = `${baseName}_${counter}${extension}`;
    counter++;
  } while (existingNames.has(newName));

  return newName;
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Replace invalid characters with underscores
  const sanitized = filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Ensure it's not empty
  return sanitized || 'untitled';
}

/**
 * Check if drag and drop is supported
 */
export function isDragDropSupported(): boolean {
  return 'FileReader' in window && 'File' in window && 'FileList' in window;
}

/**
 * Extract files from drag and drop event
 */
export function extractFilesFromDrop(event: DragEvent): File[] {
  const files: File[] = [];

  if (event.dataTransfer?.files) {
    for (let i = 0; i < event.dataTransfer.files.length; i++) {
      const file = event.dataTransfer.files[i];
      if (file) {
        files.push(file);
      }
    }
  }

  // Filter to only image files
  return files.filter(file => file.type.startsWith('image/'));
}

/**
 * Check browser storage quota
 */
export async function checkStorageQuota(): Promise<{
  available: number;
  used: number;
  quota: number;
  percentage: number;
  hasQuota: boolean;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const used = estimate.usage || 0;
      const available = quota - used;
      const percentage = quota > 0 ? (used / quota) * 100 : 0;

      return {
        available,
        used,
        quota,
        percentage,
        hasQuota: quota > 0
      };
    } catch (error) {
      console.warn('Failed to estimate storage quota:', error);
    }
  }

  return {
    available: 0,
    used: 0,
    quota: 0,
    percentage: 0,
    hasQuota: false
  };
}

/**
 * Estimate file processing memory requirements
 */
export function estimateMemoryRequirement(files: File[]): {
  estimatedMemoryMB: number;
  recommendedBatchSize: number;
  canProcessAll: boolean;
} {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  // Rough estimate: file size + thumbnail generation + EXIF parsing overhead
  const estimatedMemoryMB = (totalSize * 2.5) / (1024 * 1024);

  // Available memory estimate (conservative)
  const availableMemoryMB = 1024; // 1GB conservative estimate

  const canProcessAll = estimatedMemoryMB < availableMemoryMB * 0.8; // Use max 80%

  // Recommend batch size based on memory
  const recommendedBatchSize = canProcessAll
    ? files.length
    : Math.max(1, Math.floor((availableMemoryMB * 0.2) / (estimatedMemoryMB / files.length)));

  return {
    estimatedMemoryMB,
    recommendedBatchSize,
    canProcessAll
  };
}

/**
 * Create file input element for fallback file selection
 */
export function createFileInput(
  accept?: string,
  multiple?: boolean,
  onChange?: (files: FileList | null) => void
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept || Object.keys(SUPPORTED_IMAGE_TYPES).join(',');
  input.multiple = multiple ?? true;
  input.style.display = 'none';

  if (onChange) {
    input.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      onChange(target.files);
    });
  }

  return input;
}

/**
 * Trigger file selection using hidden input (fallback method)
 */
export function triggerFileSelection(
  accept?: string,
  multiple?: boolean
): Promise<File[]> {
  return new Promise((resolve) => {
    const input = createFileInput(accept, multiple, (fileList) => {
      const files = fileList ? Array.from(fileList) : [];
      resolve(files);
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Check if file is likely to be a RAW image format
 */
export function isRawImageFile(file: File): boolean {
  const rawExtensions = [
    '.raw', '.cr2', '.cr3', '.nef', '.arw', '.orf', '.rw2', '.dng',
    '.raf', '.pef', '.srw', '.x3f', '.mrw', '.erf', '.3fr', '.fff'
  ];

  const extension = getFileExtension(file.name).toLowerCase();
  return rawExtensions.includes(extension);
}

/**
 * Get human-readable file type description
 */
export function getFileTypeDescription(file: File): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'image/webp': 'WebP Image',
    'image/heic': 'HEIC Image',
    'image/heif': 'HEIF Image',
    'image/tiff': 'TIFF Image',
    'image/bmp': 'Bitmap Image',
    'image/gif': 'GIF Image'
  };

  return typeMap[file.type] || file.type || 'Unknown Image';
}