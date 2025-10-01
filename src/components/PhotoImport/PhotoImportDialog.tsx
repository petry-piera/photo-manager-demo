/**
 * PhotoImportDialog component for importing photos with progress tracking
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FileDropZone } from '@/components/DragDrop/DragDropProvider';
import { photoService, type PhotoImportOptions, type PhotoImportResult } from '@/services/PhotoService';
import { exifService } from '@/services/ExifService';
import '@/styles/components/photo-import-dialog.css';
import {
  validatePhotoFiles,
  pickPhotoFiles,
  isFileSystemAccessSupported,
  formatFileSize,
  type FileProgressCallback
} from '@/utils/file-utils';
import type { Photo } from '@/models/Photo';
import type { ExifData } from '@/services/ExifService';

/**
 * Import status for individual files
 */
interface FileImportStatus {
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'skipped';
  progress: number;
  photo?: Photo;
  error?: string;
  exifData?: ExifData;
}

/**
 * Import settings
 */
interface ImportSettings {
  generateThumbnails: boolean;
  extractFullExif: boolean;
  autoCreateAlbums: boolean;
  duplicateHandling: 'skip' | 'rename' | 'replace';
  batchSize: number;
}

/**
 * Photo import dialog props
 */
export interface PhotoImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (result: PhotoImportResult) => void;
  defaultSettings?: Partial<ImportSettings>;
  className?: string;
}

/**
 * File preview component
 */
const FilePreview: React.FC<{
  fileStatus: FileImportStatus;
  onRemove?: () => void;
}> = ({ fileStatus, onRemove }) => {
  const { file, status, progress, error, exifData } = fileStatus;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [file]);

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      case 'skipped':
        return '⏭️';
      default:
        return '📄';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Waiting';
      case 'processing':
        return `Processing ${progress}%`;
      case 'completed':
        return 'Imported';
      case 'error':
        return error || 'Error';
      case 'skipped':
        return 'Skipped';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`file-preview ${status}`}>
      <div className="file-preview-image">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            onError={() => setPreviewUrl(null)}
          />
        ) : (
          <div className="file-preview-placeholder">🖼️</div>
        )}
      </div>

      <div className="file-preview-info">
        <div className="file-preview-name" title={file.name}>
          {file.name}
        </div>
        <div className="file-preview-meta">
          <span className="file-size">{formatFileSize(file.size)}</span>
          {exifData?.dateTaken && (
            <span className="file-date">
              📅 {exifData.dateTaken.toLocaleDateString()}
            </span>
          )}
          {exifData?.camera?.make && exifData?.camera?.model && (
            <span className="file-camera">
              📷 {exifData.camera.make} {exifData.camera.model}
            </span>
          )}
        </div>
        <div className="file-preview-status">
          <span className="status-icon">{getStatusIcon()}</span>
          <span className="status-text">{getStatusText()}</span>
        </div>
        {status === 'processing' && (
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {onRemove && (status === 'pending' || status === 'error') && (
        <button
          className="file-preview-remove"
          onClick={onRemove}
          title="Remove file"
          type="button"
        >
          ❌
        </button>
      )}
    </div>
  );
};

/**
 * Import settings component
 */
const ImportSettingsPanel: React.FC<{
  settings: ImportSettings;
  onChange: (settings: ImportSettings) => void;
}> = ({ settings, onChange }) => {
  const handleSettingChange = useCallback((key: keyof ImportSettings, value: any) => {
    onChange({
      ...settings,
      [key]: value
    });
  }, [settings, onChange]);

  return (
    <div className="import-settings">
      <h3>Import Settings</h3>

      <div className="setting-group">
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.generateThumbnails}
            onChange={(e) => handleSettingChange('generateThumbnails', e.target.checked)}
          />
          Generate thumbnails
          <span className="setting-description">
            Create thumbnail images for better performance
          </span>
        </label>

        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.extractFullExif}
            onChange={(e) => handleSettingChange('extractFullExif', e.target.checked)}
          />
          Extract full EXIF data
          <span className="setting-description">
            Extract complete metadata (slower but more detailed)
          </span>
        </label>

        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.autoCreateAlbums}
            onChange={(e) => handleSettingChange('autoCreateAlbums', e.target.checked)}
          />
          Auto-create date albums
          <span className="setting-description">
            Automatically organize photos by date
          </span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          Duplicate handling:
          <select
            value={settings.duplicateHandling}
            onChange={(e) => handleSettingChange('duplicateHandling', e.target.value)}
          >
            <option value="skip">Skip duplicates</option>
            <option value="rename">Rename duplicates</option>
            <option value="replace">Replace duplicates</option>
          </select>
        </label>

        <label className="setting-label">
          Batch size:
          <input
            type="number"
            min="1"
            max="20"
            value={settings.batchSize}
            onChange={(e) => handleSettingChange('batchSize', parseInt(e.target.value, 10))}
          />
          <span className="setting-description">
            Number of files to process simultaneously
          </span>
        </label>
      </div>
    </div>
  );
};

/**
 * PhotoImportDialog component
 */
export const PhotoImportDialog: React.FC<PhotoImportDialogProps> = ({
  open,
  onClose,
  onImportComplete,
  defaultSettings = {},
  className = ''
}) => {
  const [files, setFiles] = useState<FileImportStatus[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<PhotoImportResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'select' | 'preview' | 'importing' | 'complete'>('select');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [settings, setSettings] = useState<ImportSettings>({
    generateThumbnails: true,
    extractFullExif: true,
    autoCreateAlbums: true,
    duplicateHandling: 'rename',
    batchSize: 5,
    ...defaultSettings
  });

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  // Handle escape key and backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (!importing) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !importing) {
        handleClose();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('keydown', handleKeyDown);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('keydown', handleKeyDown);
    };
  }, [importing, onClose]);

  // Handle file selection from file picker
  const handleFilePickerClick = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      return;
    }

    try {
      const selectedFiles = await pickPhotoFiles();
      if (selectedFiles.length > 0) {
        handleFilesAdded(selectedFiles);
      }
    } catch (error) {
      console.error('Failed to pick files:', error);
    }
  }, []);

  // Handle files added via drag-drop or file picker
  const handleFilesAdded = useCallback((newFiles: File[]) => {
    const validation = validatePhotoFiles(newFiles);

    const fileStatuses: FileImportStatus[] = validation.valid.map(validationResult => {
      const file = newFiles.find(f => f.name === validationResult.fileInfo.name)!;
      return {
        file,
        status: 'pending',
        progress: 0
      };
    });

    setFiles(prev => [...prev, ...fileStatuses]);

    if (fileStatuses.length > 0) {
      setCurrentStep('preview');
      // Extract EXIF data preview
      extractPreviewData(fileStatuses);
    }
  }, []);

  // Extract EXIF data for preview
  const extractPreviewData = useCallback(async (fileStatuses: FileImportStatus[]) => {
    const updatedFiles = [...fileStatuses];

    for (let i = 0; i < updatedFiles.length; i++) {
      const fileStatus = updatedFiles[i];
      if (!fileStatus) continue;

      try {
        const exifData = await exifService.extractQuickMetadata(fileStatus.file);
        fileStatus.exifData = exifData;
      } catch (error) {
        console.warn(`Failed to extract EXIF preview for ${fileStatus.file.name}:`, error);
      }
    }

    setFiles(prev => prev.map(existing => {
      const updated = updatedFiles.find(u => u.file.name === existing.file.name);
      return updated || existing;
    }));
  }, []);

  // Remove file from import queue
  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Start import process
  const handleStartImport = useCallback(async () => {
    if (files.length === 0) return;

    setImporting(true);
    setCurrentStep('importing');
    abortControllerRef.current = new AbortController();

    const filesToImport = files.map(f => f.file);

    const importOptions: PhotoImportOptions = {
      ...settings,
      onProgress: ((progress) => {
        // Update individual file progress
        setFiles(prev => prev.map((fileStatus, index) => {
          if (index === progress.current - 1) {
            return {
              ...fileStatus,
              status: 'processing',
              progress: progress.percentage
            };
          }
          return fileStatus;
        }));
      }) as FileProgressCallback,
      onPhotoImported: (photo, index) => {
        setFiles(prev => prev.map((fileStatus, i) => {
          if (i === index) {
            return {
              ...fileStatus,
              status: 'completed',
              progress: 100,
              photo
            };
          }
          return fileStatus;
        }));
      },
      onError: (error, file) => {
        setFiles(prev => prev.map(fileStatus => {
          if (fileStatus.file.name === file.name) {
            return {
              ...fileStatus,
              status: 'error',
              error: error.message
            };
          }
          return fileStatus;
        }));
      }
    };

    try {
      const result = await photoService.importPhotos(filesToImport, importOptions);
      setImportResult(result);
      setCurrentStep('complete');
      onImportComplete?.(result);
    } catch (error) {
      console.error('Import failed:', error);
      setCurrentStep('preview');
    } finally {
      setImporting(false);
      abortControllerRef.current = null;
    }
  }, [files, settings, onImportComplete]);

  // Cancel import
  const handleCancelImport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setImporting(false);
    setCurrentStep('preview');
  }, []);

  // Reset dialog
  const handleReset = useCallback(() => {
    setFiles([]);
    setImportResult(null);
    setCurrentStep('select');
  }, []);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (!importing) {
      handleReset();
      onClose();
    }
  }, [importing, onClose, handleReset]);

  // Render content based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 'select':
        return (
          <div className="import-step-select">
            <h2>Import Photos</h2>
            <p>Select photos to add to your collection</p>

            <FileDropZone
              onDrop={handleFilesAdded}
              accept={['image/*']}
              multiple
              className="import-drop-zone"
            >
              <div className="drop-zone-content">
                <div className="drop-zone-icon">📁</div>
                <div className="drop-zone-text">
                  Drag photos here or click to select
                </div>
                <div className="drop-zone-subtext">
                  Supports JPEG, PNG, WebP, HEIC, and TIFF files
                </div>
                {isFileSystemAccessSupported() && (
                  <button
                    className="btn btn-primary"
                    onClick={handleFilePickerClick}
                    type="button"
                  >
                    Choose Files
                  </button>
                )}
              </div>
            </FileDropZone>
          </div>
        );

      case 'preview':
        return (
          <div className="import-step-preview">
            <h2>Review Import ({files.length} files)</h2>

            <div className="import-content">
              <div className="import-files">
                <div className="file-list">
                  {files.map((fileStatus, index) => (
                    <FilePreview
                      key={`${fileStatus.file.name}-${index}`}
                      fileStatus={fileStatus}
                      onRemove={() => handleRemoveFile(index)}
                    />
                  ))}
                </div>
              </div>

              <ImportSettingsPanel
                settings={settings}
                onChange={setSettings}
              />
            </div>

            <div className="import-actions">
              <button
                className="btn btn-secondary"
                onClick={handleReset}
                type="button"
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleStartImport}
                disabled={files.length === 0}
                type="button"
              >
                Import {files.length} Photos
              </button>
            </div>
          </div>
        );

      case 'importing':
        const completedCount = files.filter(f => f.status === 'completed').length;
        const errorCount = files.filter(f => f.status === 'error').length;
        const progress = files.length > 0 ? (completedCount / files.length) * 100 : 0;

        return (
          <div className="import-step-importing">
            <h2>Importing Photos...</h2>

            <div className="import-progress">
              <div className="progress-stats">
                <span>Progress: {completedCount}/{files.length}</span>
                {errorCount > 0 && <span className="error-count">{errorCount} errors</span>}
              </div>

              <div className="progress-bar-large">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="file-list importing">
              {files.map((fileStatus, index) => (
                <FilePreview
                  key={`${fileStatus.file.name}-${index}`}
                  fileStatus={fileStatus}
                />
              ))}
            </div>

            <div className="import-actions">
              <button
                className="btn btn-secondary"
                onClick={handleCancelImport}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="import-step-complete">
            <h2>Import Complete!</h2>

            {importResult && (
              <div className="import-summary">
                <div className="summary-stats">
                  <div className="stat-item success">
                    <span className="stat-number">{importResult.summary.imported}</span>
                    <span className="stat-label">Photos Imported</span>
                  </div>
                  {importResult.summary.errors > 0 && (
                    <div className="stat-item error">
                      <span className="stat-number">{importResult.summary.errors}</span>
                      <span className="stat-label">Errors</span>
                    </div>
                  )}
                  {importResult.summary.skipped > 0 && (
                    <div className="stat-item warning">
                      <span className="stat-number">{importResult.summary.skipped}</span>
                      <span className="stat-label">Skipped</span>
                    </div>
                  )}
                </div>

                {importResult.summary.albumsCreated.length > 0 && (
                  <div className="albums-created">
                    <h4>Albums Created:</h4>
                    <ul>
                      {importResult.summary.albumsCreated.map(albumId => (
                        <li key={albumId}>{albumId}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="processing-time">
                  Processing time: {(importResult.summary.processingTimeMs / 1000).toFixed(1)}s
                </div>
              </div>
            )}

            <div className="import-actions">
              <button
                className="btn btn-secondary"
                onClick={handleReset}
                type="button"
              >
                Import More
              </button>
              <button
                className="btn btn-primary"
                onClick={handleClose}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`photo-import-dialog ${className}`}
      onCancel={(e) => {
        if (!importing) {
          e.preventDefault();
          handleClose();
        }
      }}
    >
      <div className="dialog-content">
        {renderContent()}
      </div>

      {!importing && currentStep !== 'select' && (
        <button
          className="dialog-close"
          onClick={handleClose}
          title="Close"
          type="button"
        >
          ✕
        </button>
      )}
    </dialog>
  );
};

export default PhotoImportDialog;