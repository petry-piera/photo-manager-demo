/**
 * Unit tests for DragDropProvider component
 */

import React, { useRef, useEffect } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

import {
  DragDropProvider,
  DropZone,
  SortableContainer,
  FileDropZone,
  useDragDrop
} from '@/components/DragDrop/DragDropProvider';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Mock file utils
vi.mock('@/utils/file-utils', () => ({
  extractFilesFromDrop: vi.fn((event: DragEvent) => {
    // Mock file extraction
    if (event.dataTransfer?.files) {
      return Array.from(event.dataTransfer.files);
    }
    return [];
  }),
  validatePhotoFiles: vi.fn((files: File[]) => ({
    valid: files.map(file => ({
      fileInfo: { name: file.name, size: file.size, type: file.type }
    })),
    invalid: []
  }))
}));

// Mock dom utils
vi.mock('@/utils/dom-utils', () => ({
  ResponsiveUtils: {
    isTouchDevice: vi.fn(() => false)
  }
}));

// Create mock files for testing
const createMockFile = (name: string, size: number = 1024, type: string = 'image/jpeg'): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Helper component to test drag drop context
const TestContextConsumer: React.FC<{
  onContextReceived?: (context: any) => void;
}> = ({ onContextReceived }) => {
  try {
    const context = useDragDrop();
    useEffect(() => {
      onContextReceived?.(context);
    }, [context, onContextReceived]);

    return (
      <div data-testid="context-consumer">
        <span>isDragging: {context.isDragging.toString()}</span>
        <span>draggedItems: {context.draggedItems.length}</span>
      </div>
    );
  } catch (error) {
    return <div data-testid="context-error">{(error as Error).message}</div>;
  }
};

// Helper component for sortable testing
const TestSortableContainer: React.FC<{
  id: string;
  onStart?: () => void;
  onEnd?: () => void;
}> = ({ id, onStart, onEnd }) => {
  return (
    <SortableContainer
      id={id}
      config={{
        group: 'test-group',
        onStart: onStart,
        onEnd: onEnd
      }}
    >
      <div data-testid={`sortable-item-1`}>Item 1</div>
      <div data-testid={`sortable-item-2`}>Item 2</div>
      <div data-testid={`sortable-item-3`}>Item 3</div>
    </SortableContainer>
  );
};

describe('DragDropProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should render children correctly', () => {
      render(
        <DragDropProvider>
          <div data-testid="child">Test Content</div>
        </DragDropProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <DragDropProvider className="custom-provider">
          <div>Content</div>
        </DragDropProvider>
      );

      expect(container.firstChild).toHaveClass('drag-drop-provider', 'custom-provider');
    });

    it('should provide context to children', () => {
      const onContextReceived = vi.fn();

      render(
        <DragDropProvider>
          <TestContextConsumer onContextReceived={onContextReceived} />
        </DragDropProvider>
      );

      expect(onContextReceived).toHaveBeenCalled();
      expect(onContextReceived.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          isDragging: false,
          draggedItems: [],
          setDraggedItems: expect.any(Function),
          registerDropZone: expect.any(Function),
          unregisterDropZone: expect.any(Function),
          registerSortable: expect.any(Function),
          unregisterSortable: expect.any(Function)
        })
      );
    });

    it('should throw error when useDragDrop is used outside provider', () => {
      render(<TestContextConsumer />);

      expect(screen.getByTestId('context-error')).toHaveTextContent(
        'useDragDrop must be used within a DragDropProvider'
      );
    });
  });

  describe('Drag state management', () => {
    it('should update dragging state on global drag events', async () => {
      render(
        <DragDropProvider>
          <TestContextConsumer />
        </DragDropProvider>
      );

      expect(screen.getByText('isDragging: false')).toBeInTheDocument();

      // Simulate drag enter
      act(() => {
        fireEvent.dragEnter(document, {
          dataTransfer: { files: [createMockFile('test.jpg')] }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('isDragging: true')).toBeInTheDocument();
      });

      // Simulate drag leave
      act(() => {
        fireEvent.dragLeave(document, {
          dataTransfer: { files: [createMockFile('test.jpg')] }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('isDragging: false')).toBeInTheDocument();
      });
    });

    it('should handle nested drag enter/leave correctly', async () => {
      render(
        <DragDropProvider>
          <TestContextConsumer />
        </DragDropProvider>
      );

      // Multiple drag enters
      act(() => {
        fireEvent.dragEnter(document);
        fireEvent.dragEnter(document);
      });

      await waitFor(() => {
        expect(screen.getByText('isDragging: true')).toBeInTheDocument();
      });

      // First drag leave - should still be dragging
      act(() => {
        fireEvent.dragLeave(document);
      });

      await waitFor(() => {
        expect(screen.getByText('isDragging: true')).toBeInTheDocument();
      });

      // Second drag leave - should stop dragging
      act(() => {
        fireEvent.dragLeave(document);
      });

      await waitFor(() => {
        expect(screen.getByText('isDragging: false')).toBeInTheDocument();
      });
    });

    it('should apply dragging class when dragging', async () => {
      const { container } = render(
        <DragDropProvider>
          <div>Content</div>
        </DragDropProvider>
      );

      // Start dragging
      act(() => {
        fireEvent.dragEnter(document);
      });

      await waitFor(() => {
        expect(container.firstChild).toHaveClass('dragging');
      });

      // Stop dragging
      act(() => {
        fireEvent.dragLeave(document);
      });

      await waitFor(() => {
        expect(container.firstChild).not.toHaveClass('dragging');
      });
    });
  });

  describe('Drop zone registration', () => {
    it('should register and unregister drop zones', () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <DropZone
            id="test-drop-zone"
            config={{ onDrop }}
          >
            <div>Drop Zone Content</div>
          </DropZone>
        </DragDropProvider>
      );

      expect(screen.getByText('Drop Zone Content')).toBeInTheDocument();
    });

    it('should handle file drops on registered drop zones', async () => {
      const onDrop = vi.fn();
      const mockFile = createMockFile('test.jpg');

      render(
        <DragDropProvider>
          <DropZone
            id="test-drop-zone"
            config={{ onDrop }}
          >
            <div>Drop Zone Content</div>
          </DropZone>
        </DragDropProvider>
      );

      const dropZone = screen.getByText('Drop Zone Content').parentElement;

      // Simulate drop event
      act(() => {
        fireEvent.drop(dropZone!, {
          dataTransfer: {
            files: [mockFile]
          }
        });
      });

      await waitFor(() => {
        expect(onDrop).toHaveBeenCalledWith([mockFile]);
      });
    });

    it('should handle drag enter/leave events on drop zones', async () => {
      const onDragEnter = vi.fn();
      const onDragLeave = vi.fn();

      render(
        <DragDropProvider>
          <DropZone
            id="test-drop-zone"
            config={{
              onDrop: vi.fn(),
              onDragEnter,
              onDragLeave
            }}
          >
            <div>Drop Zone Content</div>
          </DropZone>
        </DragDropProvider>
      );

      // Simulate global drag enter
      act(() => {
        fireEvent.dragEnter(document);
      });

      await waitFor(() => {
        expect(onDragEnter).toHaveBeenCalled();
      });

      // Simulate global drag leave
      act(() => {
        fireEvent.dragLeave(document);
      });

      await waitFor(() => {
        expect(onDragLeave).toHaveBeenCalled();
      });
    });

    it('should apply appropriate classes to drop zone', async () => {
      render(
        <DragDropProvider>
          <DropZone
            id="test-drop-zone"
            config={{ onDrop: vi.fn() }}
            className="custom-drop-zone"
          >
            <div>Drop Zone Content</div>
          </DropZone>
        </DragDropProvider>
      );

      const dropZone = document.getElementById('test-drop-zone');
      expect(dropZone).toHaveClass('drop-zone', 'custom-drop-zone');

      // Start global dragging
      act(() => {
        fireEvent.dragEnter(document);
      });

      await waitFor(() => {
        expect(dropZone).toHaveClass('global-drag');
      });
    });
  });

  describe('Sortable containers', () => {
    it('should register sortable containers', () => {
      const onStart = vi.fn();
      const onEnd = vi.fn();

      render(
        <DragDropProvider>
          <TestSortableContainer
            id="test-sortable"
            onStart={onStart}
            onEnd={onEnd}
          />
        </DragDropProvider>
      );

      expect(screen.getByTestId('sortable-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('sortable-item-2')).toBeInTheDocument();
      expect(screen.getByTestId('sortable-item-3')).toBeInTheDocument();
    });

    it('should handle custom tag for sortable container', () => {
      render(
        <DragDropProvider>
          <SortableContainer
            id="test-sortable-ul"
            config={{ group: 'test' }}
            tag="ul"
            className="custom-sortable"
          >
            <li>Item 1</li>
            <li>Item 2</li>
          </SortableContainer>
        </DragDropProvider>
      );

      const container = document.getElementById('test-sortable-ul');
      expect(container?.tagName).toBe('UL');
      expect(container).toHaveClass('sortable-container', 'custom-sortable');
    });

    it('should cleanup sortable instances on unmount', () => {
      const { unmount } = render(
        <DragDropProvider>
          <TestSortableContainer
            id="test-sortable"
            onStart={vi.fn()}
            onEnd={vi.fn()}
          />
        </DragDropProvider>
      );

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('FileDropZone component', () => {
    it('should render file drop zone with default content', () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <FileDropZone onDrop={onDrop} />
        </DragDropProvider>
      );

      expect(screen.getByText(/click to select or drag files here/i)).toBeInTheDocument();
      expect(screen.getByText(/supports: image/i)).toBeInTheDocument();
    });

    it('should render custom children', () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <FileDropZone onDrop={onDrop}>
            <div data-testid="custom-content">Custom Drop Zone</div>
          </FileDropZone>
        </DragDropProvider>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.queryByText(/click to select/)).not.toBeInTheDocument();
    });

    it('should handle file selection via click', async () => {
      const onDrop = vi.fn();
      const mockFile = createMockFile('test.jpg');

      render(
        <DragDropProvider>
          <FileDropZone onDrop={onDrop} />
        </DragDropProvider>
      );

      const dropZone = screen.getByRole('button');
      const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;

      // Mock file input change
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });

      await userEvent.click(dropZone);
      fireEvent.change(fileInput);

      expect(onDrop).toHaveBeenCalledWith([mockFile]);
    });

    it('should handle keyboard interaction', async () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <FileDropZone onDrop={onDrop} />
        </DragDropProvider>
      );

      const dropZone = screen.getByRole('button');
      dropZone.focus();

      await userEvent.keyboard('{Enter}');
      // File input click should be triggered (though we can't easily test the file dialog)
      expect(dropZone).toHaveFocus();

      await userEvent.keyboard(' ');
      // Space key should also trigger file selection
      expect(dropZone).toHaveFocus();
    });

    it('should apply file size limits', async () => {
      const onDrop = vi.fn();
      const smallFile = createMockFile('small.jpg', 1024);
      const largeFile = createMockFile('large.jpg', 2048);

      render(
        <DragDropProvider>
          <FileDropZone
            onDrop={onDrop}
            maxSize={1500} // 1.5KB limit
          />
        </DragDropProvider>
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Mock multiple files with different sizes
      Object.defineProperty(fileInput, 'files', {
        value: [smallFile, largeFile],
        writable: false
      });

      fireEvent.change(fileInput);

      // Only the small file should be passed to onDrop
      expect(onDrop).toHaveBeenCalledWith([smallFile]);
    });

    it('should apply file count limits', async () => {
      const onDrop = vi.fn();
      const files = [
        createMockFile('file1.jpg'),
        createMockFile('file2.jpg'),
        createMockFile('file3.jpg'),
        createMockFile('file4.jpg')
      ];

      render(
        <DragDropProvider>
          <FileDropZone
            onDrop={onDrop}
            maxFiles={2}
          />
        </DragDropProvider>
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false
      });

      fireEvent.change(fileInput);

      // Only first 2 files should be passed
      expect(onDrop).toHaveBeenCalledWith([files[0], files[1]]);
    });

    it('should handle disabled state', async () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <FileDropZone onDrop={onDrop} disabled={true} />
        </DragDropProvider>
      );

      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('tabIndex', '-1');
      expect(dropZone.parentElement).toHaveClass('disabled');

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeDisabled();

      // Click should not trigger anything
      await userEvent.click(dropZone);
      expect(onDrop).not.toHaveBeenCalled();
    });

    it('should show limits in subtext', () => {
      render(
        <DragDropProvider>
          <FileDropZone
            onDrop={vi.fn()}
            maxFiles={50}
            maxSize={10 * 1024 * 1024} // 10MB
          />
        </DragDropProvider>
      );

      expect(screen.getByText(/max 50 files/i)).toBeInTheDocument();
      expect(screen.getByText(/max 10mb per file/i)).toBeInTheDocument();
    });

    it('should reset file input value after selection', async () => {
      const onDrop = vi.fn();
      const mockFile = createMockFile('test.jpg');

      render(
        <DragDropProvider>
          <FileDropZone onDrop={onDrop} />
        </DragDropProvider>
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });

      fireEvent.change(fileInput);

      expect(fileInput.value).toBe('');
    });
  });

  describe('Disabled state', () => {
    it('should not register event listeners when disabled', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      render(
        <DragDropProvider disabled={true}>
          <div>Content</div>
        </DragDropProvider>
      );

      // Should not add drag event listeners
      expect(addEventListenerSpy).not.toHaveBeenCalledWith('dragenter', expect.any(Function));
      expect(addEventListenerSpy).not.toHaveBeenCalledWith('dragleave', expect.any(Function));
      expect(addEventListenerSpy).not.toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(addEventListenerSpy).not.toHaveBeenCalledWith('drop', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should not register sortable when disabled', () => {
      render(
        <DragDropProvider disabled={true}>
          <TestSortableContainer
            id="disabled-sortable"
            onStart={vi.fn()}
            onEnd={vi.fn()}
          />
        </DragDropProvider>
      );

      // Should still render content but not be sortable
      expect(screen.getByTestId('sortable-item-1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <DragDropProvider>
          <FileDropZone onDrop={vi.fn()} />
          <DropZone id="test-drop" config={{ onDrop: vi.fn() }}>
            <div>Drop Zone</div>
          </DropZone>
        </DragDropProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper ARIA attributes for file drop zone', () => {
      render(
        <DragDropProvider>
          <FileDropZone onDrop={vi.fn()} />
        </DragDropProvider>
      );

      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('tabIndex', '0');
      expect(dropZone).toHaveAttribute('role', 'button');
    });

    it('should handle keyboard navigation properly', async () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <FileDropZone onDrop={onDrop} />
        </DragDropProvider>
      );

      const dropZone = screen.getByRole('button');

      // Should be focusable
      dropZone.focus();
      expect(dropZone).toHaveFocus();

      // Keyboard events should be handled
      const preventDefaultSpy = vi.fn();
      fireEvent.keyDown(dropZone, {
        key: 'Enter',
        preventDefault: preventDefaultSpy
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle drops on non-existent drop zones gracefully', async () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <DropZone id="test-drop" config={{ onDrop }}>
            <div>Drop Zone</div>
          </DropZone>
        </DragDropProvider>
      );

      // Simulate drop on body (outside drop zone)
      act(() => {
        fireEvent.drop(document.body, {
          dataTransfer: { files: [createMockFile('test.jpg')] },
          target: document.body
        });
      });

      // Should still call onDrop because it falls back to first available drop zone
      await waitFor(() => {
        expect(onDrop).toHaveBeenCalled();
      });
    });

    it('should handle empty file drops', async () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <DropZone id="test-drop" config={{ onDrop }}>
            <div>Drop Zone</div>
          </DropZone>
        </DragDropProvider>
      );

      // Drop with no files
      act(() => {
        fireEvent.drop(document, {
          dataTransfer: { files: [] }
        });
      });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it('should handle missing dataTransfer', async () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <DropZone id="test-drop" config={{ onDrop }}>
            <div>Drop Zone</div>
          </DropZone>
        </DragDropProvider>
      );

      // Drop event without dataTransfer
      act(() => {
        fireEvent.drop(document);
      });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it('should handle file input without files', async () => {
      const onDrop = vi.fn();

      render(
        <DragDropProvider>
          <FileDropZone onDrop={onDrop} />
        </DragDropProvider>
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Change event without files
      Object.defineProperty(fileInput, 'files', {
        value: null,
        writable: false
      });

      fireEvent.change(fileInput);

      expect(onDrop).not.toHaveBeenCalled();
    });

    it('should handle rapid drag enter/leave events', async () => {
      render(
        <DragDropProvider>
          <TestContextConsumer />
        </DragDropProvider>
      );

      // Rapid fire drag events
      for (let i = 0; i < 10; i++) {
        act(() => {
          fireEvent.dragEnter(document);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('isDragging: true')).toBeInTheDocument();
      });

      // Rapid fire drag leave events
      for (let i = 0; i < 10; i++) {
        act(() => {
          fireEvent.dragLeave(document);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('isDragging: false')).toBeInTheDocument();
      });
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <DragDropProvider>
          <div>Content</div>
        </DragDropProvider>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('dragenter', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('dragleave', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('drop', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});