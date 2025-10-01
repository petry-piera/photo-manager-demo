/**
 * DragDropProvider component with SortableJS integration
 */

import React, { useRef, useEffect, useState, useCallback, createContext, useContext } from 'react';
import { ResponsiveUtils } from '@/utils/dom-utils';
import { extractFilesFromDrop, validatePhotoFiles, type FileProgressCallback } from '@/utils/file-utils';

// Note: In a real implementation, you would install and import SortableJS
// For now, we'll create a mock interface
interface SortableJS {
  create(element: HTMLElement, options: any): any;
}

// Mock SortableJS for compilation
const Sortable: SortableJS = {
  create: () => ({ destroy: () => {} })
};

/**
 * Drag and drop configuration
 */
export interface DragDropConfig {
  accept?: string[];
  multiple?: boolean;
  disabled?: boolean;
  sortable?: boolean;
  sortableOptions?: any;
  onDrop?: (files: File[]) => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onDragOver?: (event: DragEvent) => void;
  onProgress?: FileProgressCallback;
}

/**
 * Sortable configuration
 */
export interface SortableConfig {
  group?: string;
  disabled?: boolean;
  animation?: number;
  ghostClass?: string;
  chosenClass?: string;
  dragClass?: string;
  forceFallback?: boolean;
  fallbackTolerance?: number;
  multiDrag?: boolean;
  selectedClass?: string;
  onStart?: (event: any) => void;
  onEnd?: (event: any) => void;
  onAdd?: (event: any) => void;
  onUpdate?: (event: any) => void;
  onRemove?: (event: any) => void;
  onSort?: (event: any) => void;
  onChange?: (event: any) => void;
}

/**
 * Drag and drop context
 */
interface DragDropContextValue {
  isDragging: boolean;
  draggedItems: any[];
  setDraggedItems: (items: any[]) => void;
  registerDropZone: (id: string, config: DragDropConfig) => void;
  unregisterDropZone: (id: string) => void;
  registerSortable: (id: string, element: HTMLElement, config: SortableConfig) => void;
  unregisterSortable: (id: string) => void;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

/**
 * Hook to access drag and drop context
 */
export const useDragDrop = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
};

/**
 * DragDropProvider props
 */
export interface DragDropProviderProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * DragDropProvider component
 */
export const DragDropProvider: React.FC<DragDropProviderProps> = ({
  children,
  className = '',
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItems, setDraggedItems] = useState<any[]>([]);
  const dropZonesRef = useRef<Map<string, DragDropConfig>>(new Map());
  const sortablesRef = useRef<Map<string, any>>(new Map());
  const dragCounterRef = useRef(0);

  // Register drop zone
  const registerDropZone = useCallback((id: string, config: DragDropConfig) => {
    dropZonesRef.current.set(id, config);
  }, []);

  // Unregister drop zone
  const unregisterDropZone = useCallback((id: string) => {
    dropZonesRef.current.delete(id);
  }, []);

  // Register sortable
  const registerSortable = useCallback((id: string, element: HTMLElement, config: SortableConfig) => {
    if (disabled || config.disabled) return;

    const sortableInstance = Sortable.create(element, {
      group: config.group || 'default',
      animation: config.animation || 150,
      ghostClass: config.ghostClass || 'sortable-ghost',
      chosenClass: config.chosenClass || 'sortable-chosen',
      dragClass: config.dragClass || 'sortable-drag',
      forceFallback: config.forceFallback || ResponsiveUtils.isTouchDevice(),
      fallbackTolerance: config.fallbackTolerance || 3,
      multiDrag: config.multiDrag || false,
      selectedClass: config.selectedClass || 'sortable-selected',

      onStart: (event: any) => {
        setIsDragging(true);
        const items = config.multiDrag && event.items ? event.items : [event.item];
        setDraggedItems(items);
        config.onStart?.(event);
      },

      onEnd: (event: any) => {
        setIsDragging(false);
        setDraggedItems([]);
        config.onEnd?.(event);
      },

      onAdd: config.onAdd,
      onUpdate: config.onUpdate,
      onRemove: config.onRemove,
      onSort: config.onSort,
      onChange: config.onChange
    });

    sortablesRef.current.set(id, sortableInstance);
  }, [disabled]);

  // Unregister sortable
  const unregisterSortable = useCallback((id: string) => {
    const sortableInstance = sortablesRef.current.get(id);
    if (sortableInstance) {
      sortableInstance.destroy();
      sortablesRef.current.delete(id);
    }
  }, []);

  // Global drag event handlers
  useEffect(() => {
    if (disabled) return;

    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current++;

      if (dragCounterRef.current === 1) {
        setIsDragging(true);
        // Notify all drop zones
        dropZonesRef.current.forEach((config) => {
          config.onDragEnter?.();
        });
      }
    };

    const handleDragLeave = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current--;

      if (dragCounterRef.current === 0) {
        setIsDragging(false);
        // Notify all drop zones
        dropZonesRef.current.forEach((config) => {
          config.onDragLeave?.();
        });
      }
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      // Notify all drop zones
      dropZonesRef.current.forEach((config) => {
        config.onDragOver?.(event);
      });
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = extractFilesFromDrop(event);
      if (files.length > 0) {
        // Find the most appropriate drop zone
        const target = event.target as Element;
        let dropZoneConfig: DragDropConfig | null = null;

        // Try to find a specific drop zone
        for (const [id, config] of dropZonesRef.current) {
          const element = document.getElementById(id);
          if (element && element.contains(target)) {
            dropZoneConfig = config;
            break;
          }
        }

        // If no specific zone found, use the first available one
        if (!dropZoneConfig && dropZonesRef.current.size > 0) {
          const zones = Array.from(dropZonesRef.current.values());
          dropZoneConfig = zones.length > 0 ? zones[0] : null;
        }

        if (dropZoneConfig) {
          // Validate files if accept types are specified
          if (dropZoneConfig.accept) {
            const validation = validatePhotoFiles(files);
            const validFiles = validation.valid.map(v =>
              files.find(f => f.name === v.fileInfo.name)!
            );

            if (validFiles.length > 0) {
              dropZoneConfig.onDrop?.(validFiles);
            }
          } else {
            dropZoneConfig.onDrop?.(files);
          }
        }
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [disabled]);

  // Cleanup sortables on unmount
  useEffect(() => {
    return () => {
      sortablesRef.current.forEach((sortable) => {
        sortable.destroy();
      });
      sortablesRef.current.clear();
    };
  }, []);

  const contextValue: DragDropContextValue = {
    isDragging,
    draggedItems,
    setDraggedItems,
    registerDropZone,
    unregisterDropZone,
    registerSortable,
    unregisterSortable
  };

  return (
    <DragDropContext.Provider value={contextValue}>
      <div className={`drag-drop-provider ${isDragging ? 'dragging' : ''} ${className}`}>
        {children}
      </div>
    </DragDropContext.Provider>
  );
};

/**
 * DropZone component
 */
export interface DropZoneProps {
  id: string;
  config: DragDropConfig;
  children: React.ReactNode;
  className?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({
  id,
  config,
  children,
  className = ''
}) => {
  const { registerDropZone, unregisterDropZone, isDragging } = useDragDrop();
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    registerDropZone(id, {
      ...config,
      onDragEnter: () => {
        setIsHovering(true);
        config.onDragEnter?.();
      },
      onDragLeave: () => {
        setIsHovering(false);
        config.onDragLeave?.();
      }
    });

    return () => {
      unregisterDropZone(id);
    };
  }, [id, config, registerDropZone, unregisterDropZone]);

  return (
    <div
      id={id}
      className={`drop-zone ${isDragging ? 'global-drag' : ''} ${isHovering ? 'hovering' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * SortableContainer component
 */
export interface SortableContainerProps {
  id: string;
  config: SortableConfig;
  children: React.ReactNode;
  className?: string;
  tag?: keyof React.JSX.IntrinsicElements;
}

export const SortableContainer: React.FC<SortableContainerProps> = ({
  id,
  config,
  children,
  className = '',
  tag: Tag = 'div'
}) => {
  const { registerSortable, unregisterSortable } = useDragDrop();
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      registerSortable(id, elementRef.current, config);
    }

    return () => {
      unregisterSortable(id);
    };
  }, [id, config, registerSortable, unregisterSortable]);

  return (
    <Tag
      ref={elementRef as any}
      id={id}
      className={`sortable-container ${className}`}
    >
      {children}
    </Tag>
  );
};

/**
 * FileDropZone component for file uploads
 */
export interface FileDropZoneProps {
  onDrop: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  maxFiles?: number;
  maxSize?: number;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onDrop,
  accept = ['image/*'],
  multiple = true,
  disabled = false,
  className = '',
  children,
  maxFiles = 100,
  maxSize = 100 * 1024 * 1024 // 100MB
}) => {
  const { isDragging } = useDragDrop();
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = useCallback((files: File[]) => {
    if (disabled) return;

    let filteredFiles = [...files];

    // Apply file count limit
    if (maxFiles && filteredFiles.length > maxFiles) {
      filteredFiles = filteredFiles.slice(0, maxFiles);
    }

    // Apply size limit
    if (maxSize) {
      filteredFiles = filteredFiles.filter(file => file.size <= maxSize);
    }

    if (filteredFiles.length > 0) {
      onDrop(filteredFiles);
    }
  }, [disabled, maxFiles, maxSize, onDrop]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      handleFilesSelected(files);
    }
    // Reset input value to allow selecting the same files again
    event.target.value = '';
  }, [handleFilesSelected]);

  return (
    <DropZone
      id={`file-drop-zone-${Math.random().toString(36).substr(2, 9)}`}
      config={{
        accept,
        multiple,
        disabled,
        onDrop: handleFilesSelected,
        onDragEnter: () => setIsHovering(true),
        onDragLeave: () => setIsHovering(false)
      }}
      className={`file-drop-zone ${isHovering ? 'hovering' : ''} ${disabled ? 'disabled' : ''} ${className}`}
    >
      <div
        className="file-drop-zone-content"
        onClick={handleClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept.join(',')}
          multiple={multiple}
          disabled={disabled}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        {children || (
          <>
            <div className="drop-zone-icon">📁</div>
            <div className="drop-zone-text">
              {isDragging ? 'Drop files here' : 'Click to select or drag files here'}
            </div>
            <div className="drop-zone-subtext">
              Supports: {accept.join(', ')}
              {maxFiles && ` • Max ${maxFiles} files`}
              {maxSize && ` • Max ${Math.round(maxSize / 1024 / 1024)}MB per file`}
            </div>
          </>
        )}
      </div>
    </DropZone>
  );
};

export default DragDropProvider;