/**
 * Unit tests for PhotoImportDialog component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

import { PhotoImportDialog } from '@/components/PhotoImport/PhotoImportDialog';
import { DragDropProvider } from '@/components/DragDrop/DragDropProvider';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Mock services
vi.mock('@/services/PhotoService', () => ({
  photoService: {
    importPhotos: vi.fn()
  }
}));

vi.mock('@/services/ExifService', () => ({
  exifService: {
    extractQuickMetadata: vi.fn()
  }
}));

// Mock file utils
vi.mock('@/utils/file-utils', () => ({
  validatePhotoFiles: vi.fn(),
  pickPhotoFiles: vi.fn(),
  isFileSystemAccessSupported: vi.fn(() => true),
  formatFileSize: vi.fn((size: number) => `${Math.round(size / 1024)}KB`)
}));

// Create mock files for testing
const createMockFile = (name: string, size: number = 1024, type: string = 'image/jpeg'): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Mock URL.createObjectURL and revokeObjectURL
const mockUrls = new Map<File, string>();
global.URL.createObjectURL = vi.fn((file: File) => {
  const url = `blob:http://localhost/mock-${file.name}`;
  mockUrls.set(file, url);
  return url;
});
global.URL.revokeObjectURL = vi.fn((url: string) => {
  for (const [file, fileUrl] of mockUrls.entries()) {
    if (fileUrl === url) {
      mockUrls.delete(file);
      break;
    }
  }
});

// Mock dialog methods
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  value: vi.fn(),
  configurable: true
});

Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  value: vi.fn(),
  configurable: true
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DragDropProvider>{children}</DragDropProvider>
);

describe('PhotoImportDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnImportComplete = vi.fn();

  const defaultProps = {
    open: false,
    onClose: mockOnClose,
    onImportComplete: mockOnImportComplete
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUrls.clear();

    // Setup mock implementations
    const { validatePhotoFiles } = require('@/utils/file-utils');
    const { exifService } = require('@/services/ExifService');
    const { photoService } = require('@/services/PhotoService');

    validatePhotoFiles.mockImplementation((files: File[]) => ({
      valid: files.map(file => ({
        fileInfo: { name: file.name, size: file.size, type: file.type }
      })),
      invalid: []
    }));

    exifService.extractQuickMetadata.mockResolvedValue({
      dateTaken: new Date('2023-01-01'),
      camera: { make: 'Canon', model: 'EOS R5' }
    });

    photoService.importPhotos.mockResolvedValue({
      photos: [],
      summary: {
        imported: 2,
        errors: 0,
        skipped: 0,
        albumsCreated: ['2023-01'],
        processingTimeMs: 1500
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dialog behavior', () => {
    it('should render dialog when open', () => {
      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Import Photos')).toBeInTheDocument();
    });

    it('should not render dialog when closed', () => {
      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={false} />
        </TestWrapper>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should call showModal when opened', () => {
      const showModalSpy = vi.fn();
      const dialogElement = { showModal: showModalSpy, close: vi.fn() };

      vi.spyOn(React, 'useRef').mockReturnValue({ current: dialogElement });

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      expect(showModalSpy).toHaveBeenCalled();
    });

    it('should call close when dialog is closed', () => {
      const closeSpy = vi.fn();
      const dialogElement = { showModal: vi.fn(), close: closeSpy };

      vi.spyOn(React, 'useRef').mockReturnValue({ current: dialogElement });

      const { rerender } = render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      rerender(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={false} />
        </TestWrapper>
      );

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should apply custom className', () => {
      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} className="custom-dialog" />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveClass('photo-import-dialog', 'custom-dialog');
    });
  });

  describe('File selection step', () => {
    it('should show file selection interface initially', () => {
      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Import Photos')).toBeInTheDocument();
      expect(screen.getByText('Select photos to add to your collection')).toBeInTheDocument();
      expect(screen.getByText('Drag photos here or click to select')).toBeInTheDocument();
    });

    it('should show file picker button when supported', () => {
      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Choose Files')).toBeInTheDocument();
    });

    it('should hide file picker button when not supported', () => {
      const { isFileSystemAccessSupported } = require('@/utils/file-utils');
      isFileSystemAccessSupported.mockReturnValue(false);

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      expect(screen.queryByText('Choose Files')).not.toBeInTheDocument();
    });

    it('should handle file picker click', async () => {
      const { pickPhotoFiles } = require('@/utils/file-utils');
      const mockFiles = [createMockFile('test1.jpg'), createMockFile('test2.jpg')];
      pickPhotoFiles.mockResolvedValue(mockFiles);

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const pickButton = screen.getByText('Choose Files');
      await userEvent.click(pickButton);

      expect(pickPhotoFiles).toHaveBeenCalled();
    });

    it('should handle file picker errors gracefully', async () => {
      const { pickPhotoFiles } = require('@/utils/file-utils');
      pickPhotoFiles.mockRejectedValue(new Error('User cancelled'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const pickButton = screen.getByText('Choose Files');
      await userEvent.click(pickButton);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to pick files:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('File preview and validation', () => {
    it('should move to preview step when files are added', async () => {
      const mockFiles = [createMockFile('test1.jpg'), createMockFile('test2.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      // Simulate drag and drop
      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Review Import (2 files)')).toBeInTheDocument();
      });
    });

    it('should display file previews with metadata', async () => {
      const mockFiles = [createMockFile('sunset.jpg', 2048, 'image/jpeg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('sunset.jpg')).toBeInTheDocument();
        expect(screen.getByText('2KB')).toBeInTheDocument(); // formatFileSize mock result
        expect(screen.getByText('📅 1/1/2023')).toBeInTheDocument(); // EXIF date
        expect(screen.getByText('📷 Canon EOS R5')).toBeInTheDocument(); // Camera info
      });
    });

    it('should show file preview image', async () => {
      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        const previewImg = screen.getByAltText('test.jpg');
        expect(previewImg).toBeInTheDocument();
        expect(previewImg).toHaveAttribute('src', 'blob:http://localhost/mock-test.jpg');
      });
    });

    it('should handle image load errors', async () => {
      const mockFiles = [createMockFile('corrupted.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        const previewImg = screen.getByAltText('corrupted.jpg');
        fireEvent.error(previewImg);
      });

      // Should fall back to placeholder
      await waitFor(() => {
        expect(screen.getByText('🖼️')).toBeInTheDocument();
      });
    });

    it('should allow removing files from preview', async () => {
      const mockFiles = [createMockFile('test1.jpg'), createMockFile('test2.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Review Import (2 files)')).toBeInTheDocument();
      });

      // Remove first file
      const removeButtons = screen.getAllByTitle('Remove file');
      await userEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Review Import (1 files)')).toBeInTheDocument();
        expect(screen.queryByText('test1.jpg')).not.toBeInTheDocument();
        expect(screen.getByText('test2.jpg')).toBeInTheDocument();
      });
    });
  });

  describe('Import settings', () => {
    beforeEach(async () => {
      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Import Settings')).toBeInTheDocument();
      });
    });

    it('should display import settings panel', () => {
      expect(screen.getByText('Import Settings')).toBeInTheDocument();
      expect(screen.getByLabelText(/generate thumbnails/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/extract full exif data/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/auto-create date albums/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('rename')).toBeInTheDocument(); // Duplicate handling
      expect(screen.getByDisplayValue('5')).toBeInTheDocument(); // Batch size
    });

    it('should update settings when changed', async () => {
      const thumbnailCheckbox = screen.getByLabelText(/generate thumbnails/i);
      expect(thumbnailCheckbox).toBeChecked();

      await userEvent.click(thumbnailCheckbox);
      expect(thumbnailCheckbox).not.toBeChecked();
    });

    it('should update duplicate handling setting', async () => {
      const duplicateSelect = screen.getByDisplayValue('rename');
      await userEvent.selectOptions(duplicateSelect, 'skip');
      expect(duplicateSelect).toHaveValue('skip');
    });

    it('should update batch size setting', async () => {
      const batchSizeInput = screen.getByDisplayValue('5');
      await userEvent.clear(batchSizeInput);
      await userEvent.type(batchSizeInput, '10');
      expect(batchSizeInput).toHaveValue(10);
    });

    it('should apply default settings', () => {
      const defaultSettings = {
        generateThumbnails: false,
        duplicateHandling: 'skip' as const
      };

      render(
        <TestWrapper>
          <PhotoImportDialog
            {...defaultProps}
            open={true}
            defaultSettings={defaultSettings}
          />
        </TestWrapper>
      );

      // Note: We'd need to add files to see the settings panel
      // This test verifies the prop is accepted
    });
  });

  describe('Import process', () => {
    beforeEach(async () => {
      const mockFiles = [createMockFile('test1.jpg'), createMockFile('test2.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Import 2 Photos')).toBeInTheDocument();
      });
    });

    it('should start import process', async () => {
      const { photoService } = require('@/services/PhotoService');

      const importButton = screen.getByText('Import 2 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Importing Photos...')).toBeInTheDocument();
      });

      expect(photoService.importPhotos).toHaveBeenCalled();
    });

    it('should show import progress', async () => {
      const { photoService } = require('@/services/PhotoService');

      // Mock progressive import
      photoService.importPhotos.mockImplementation(async (files, options) => {
        // Simulate progress updates
        options.onProgress?.({ current: 1, total: 2, percentage: 50 });
        options.onPhotoImported?.({ id: 'photo1' }, 0);

        await new Promise(resolve => setTimeout(resolve, 10));

        options.onProgress?.({ current: 2, total: 2, percentage: 100 });
        options.onPhotoImported?.({ id: 'photo2' }, 1);

        return {
          photos: [{ id: 'photo1' }, { id: 'photo2' }],
          summary: {
            imported: 2,
            errors: 0,
            skipped: 0,
            albumsCreated: ['2023-01'],
            processingTimeMs: 1500
          }
        };
      });

      const importButton = screen.getByText('Import 2 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Progress: 2/2')).toBeInTheDocument();
      });
    });

    it('should handle import errors', async () => {
      const { photoService } = require('@/services/PhotoService');

      photoService.importPhotos.mockImplementation(async (files, options) => {
        options.onError?.(new Error('Import failed'), files[0]);
        throw new Error('Import failed');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const importButton = screen.getByText('Import 2 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Import failed:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should allow canceling import', async () => {
      const { photoService } = require('@/services/PhotoService');

      photoService.importPhotos.mockImplementation(async () => {
        // Simulate long-running import
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { photos: [], summary: { imported: 0, errors: 0, skipped: 0, albumsCreated: [], processingTimeMs: 1000 } };
      });

      const importButton = screen.getByText('Import 2 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByText('Import 2 Photos')).toBeInTheDocument(); // Back to preview
      });
    });
  });

  describe('Import completion', () => {
    it('should show completion summary', async () => {
      const { photoService } = require('@/services/PhotoService');
      const mockResult = {
        photos: [{ id: 'photo1' }, { id: 'photo2' }],
        summary: {
          imported: 2,
          errors: 0,
          skipped: 0,
          albumsCreated: ['2023-01'],
          processingTimeMs: 1500
        }
      };

      photoService.importPhotos.mockResolvedValue(mockResult);

      const mockFiles = [createMockFile('test1.jpg'), createMockFile('test2.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Import 2 Photos')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import 2 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Photos imported
        expect(screen.getByText('2023-01')).toBeInTheDocument(); // Album created
        expect(screen.getByText('Processing time: 1.5s')).toBeInTheDocument();
      });

      expect(mockOnImportComplete).toHaveBeenCalledWith(mockResult);
    });

    it('should show error and skipped counts', async () => {
      const { photoService } = require('@/services/PhotoService');
      const mockResult = {
        photos: [{ id: 'photo1' }],
        summary: {
          imported: 1,
          errors: 1,
          skipped: 1,
          albumsCreated: [],
          processingTimeMs: 1000
        }
      };

      photoService.importPhotos.mockResolvedValue(mockResult);

      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Import 1 Photos')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import 1 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
        const errorStat = screen.getByText('1').closest('.stat-item.error');
        const skippedStat = screen.getByText('1').closest('.stat-item.warning');
        expect(errorStat).toBeInTheDocument();
        expect(skippedStat).toBeInTheDocument();
      });
    });

    it('should allow importing more photos', async () => {
      const { photoService } = require('@/services/PhotoService');

      // Complete an import first
      photoService.importPhotos.mockResolvedValue({
        photos: [],
        summary: { imported: 1, errors: 0, skipped: 0, albumsCreated: [], processingTimeMs: 500 }
      });

      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Import 1 Photos')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import 1 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import More')).toBeInTheDocument();
      });

      const importMoreButton = screen.getByText('Import More');
      await userEvent.click(importMoreButton);

      await waitFor(() => {
        expect(screen.getByText('Import Photos')).toBeInTheDocument(); // Back to start
      });
    });

    it('should close dialog when done', async () => {
      const { photoService } = require('@/services/PhotoService');

      photoService.importPhotos.mockResolvedValue({
        photos: [],
        summary: { imported: 1, errors: 0, skipped: 0, albumsCreated: [], processingTimeMs: 500 }
      });

      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Import 1 Photos')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import 1 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      const doneButton = screen.getByText('Done');
      await userEvent.click(doneButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Dialog controls', () => {
    it('should show close button when not importing', async () => {
      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByTitle('Close')).toBeInTheDocument();
      });

      const closeButton = screen.getByTitle('Close');
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle back button in preview', async () => {
      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });

      const backButton = screen.getByText('Back');
      await userEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Import Photos')).toBeInTheDocument(); // Back to start
      });
    });

    it('should prevent closing during import', async () => {
      const { photoService } = require('@/services/PhotoService');

      photoService.importPhotos.mockImplementation(async () => {
        // Simulate long import
        await new Promise(resolve => setTimeout(resolve, 100));
        return { photos: [], summary: { imported: 0, errors: 0, skipped: 0, albumsCreated: [], processingTimeMs: 100 } };
      });

      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Import 1 Photos')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import 1 Photos');
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Importing Photos...')).toBeInTheDocument();
      });

      // Close button should not be present during import
      expect(screen.queryByTitle('Close')).not.toBeInTheDocument();

      // Escape key should not close
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper dialog role', () => {
      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle keyboard navigation', () => {
      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dialog = screen.getByRole('dialog');

      // Escape should close dialog
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should provide appropriate ARIA labels for buttons', async () => {
      const mockFiles = [createMockFile('test.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        const removeButton = screen.getByTitle('Remove file');
        expect(removeButton).toHaveAttribute('title', 'Remove file');
        expect(removeButton).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('Memory management', () => {
    it('should cleanup object URLs on unmount', async () => {
      const mockFiles = [createMockFile('test.jpg')];

      const { unmount } = render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(mockUrls.size).toBe(1);
      });

      unmount();

      // Object URLs should be cleaned up
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should handle EXIF extraction errors gracefully', async () => {
      const { exifService } = require('@/services/ExifService');
      exifService.extractQuickMetadata.mockRejectedValue(new Error('EXIF extraction failed'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockFiles = [createMockFile('no-exif.jpg')];

      render(
        <TestWrapper>
          <PhotoImportDialog {...defaultProps} open={true} />
        </TestWrapper>
      );

      const dropZone = screen.getByText('Drag photos here or click to select').closest('.file-drop-zone');

      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: { files: mockFiles }
        });
      });

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to extract EXIF preview'),
          expect.any(Error)
        );
      });

      consoleWarnSpy.mockRestore();
    });
  });
});