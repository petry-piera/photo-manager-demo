/**
 * GridLayout component with responsive design and virtual scrolling
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { LazyObserver } from '@/utils/dom-utils';

/**
 * Grid layout configuration
 */
export interface GridConfig {
  columns?: number;
  minColumnWidth?: number;
  maxColumnWidth?: number;
  gap?: number;
  aspectRatio?: number;
  maintainAspectRatio?: boolean;
}

/**
 * Grid item interface
 */
export interface GridItem {
  id: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  data?: any;
}

/**
 * Virtual scrolling options
 */
export interface VirtualScrollOptions {
  enabled?: boolean;
  itemHeight?: number;
  overscan?: number;
  threshold?: number;
}

/**
 * Grid layout props
 */
export interface GridLayoutProps {
  items: GridItem[];
  config?: GridConfig;
  virtualScroll?: VirtualScrollOptions;
  className?: string;
  renderItem: (item: GridItem, index: number) => React.ReactNode;
  onItemClick?: (item: GridItem, index: number) => void;
  onItemDoubleClick?: (item: GridItem, index: number) => void;
  onItemContextMenu?: (item: GridItem, index: number, event: React.MouseEvent) => void;
  onSelectionChange?: (selectedItems: GridItem[]) => void;
  loading?: boolean;
  error?: string | null;
  emptyState?: React.ReactNode;
  loadingState?: React.ReactNode;
  multiSelect?: boolean;
  selectedItems?: GridItem[];
}

/**
 * Grid layout calculation result
 */
interface GridCalculation {
  columns: number;
  columnWidth: number;
  rowHeight: number;
  totalRows: number;
  itemsPerRow: number;
}

/**
 * Virtual scroll state
 */
interface VirtualScrollState {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  totalHeight: number;
}

/**
 * GridLayout component
 */
export const GridLayout: React.FC<GridLayoutProps> = ({
  items,
  config = {},
  virtualScroll = {},
  className = '',
  renderItem,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
  onSelectionChange,
  loading = false,
  error = null,
  emptyState,
  loadingState,
  multiSelect = false,
  selectedItems = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lazyObserverRef = useRef<LazyObserver>();

  const {
    columns,
    minColumnWidth = 200,
    maxColumnWidth = 400,
    gap = 16,
    aspectRatio = 1,
    maintainAspectRatio = true
  } = config;

  const {
    enabled: virtualScrollEnabled = false,
    itemHeight = 200,
    overscan = 5,
    threshold = 100
  } = virtualScroll;

  // Calculate grid layout
  const gridCalculation = useMemo((): GridCalculation => {
    if (containerSize.width === 0) {
      return {
        columns: 1,
        columnWidth: minColumnWidth,
        rowHeight: itemHeight,
        totalRows: 0,
        itemsPerRow: 1
      };
    }

    let calculatedColumns: number;
    let columnWidth: number;

    if (columns) {
      // Fixed columns
      calculatedColumns = columns;
      columnWidth = (containerSize.width - gap * (calculatedColumns - 1)) / calculatedColumns;
    } else {
      // Auto-fit columns based on min/max width
      const availableWidth = containerSize.width;
      calculatedColumns = Math.floor((availableWidth + gap) / (minColumnWidth + gap));
      calculatedColumns = Math.max(1, calculatedColumns);

      columnWidth = (availableWidth - gap * (calculatedColumns - 1)) / calculatedColumns;

      // Respect max width
      if (columnWidth > maxColumnWidth) {
        columnWidth = maxColumnWidth;
        calculatedColumns = Math.floor((availableWidth + gap) / (columnWidth + gap));
      }
    }

    const rowHeight = maintainAspectRatio ? columnWidth / aspectRatio : itemHeight;
    const totalRows = Math.ceil(items.length / calculatedColumns);

    return {
      columns: calculatedColumns,
      columnWidth,
      rowHeight,
      totalRows,
      itemsPerRow: calculatedColumns
    };
  }, [containerSize.width, columns, minColumnWidth, maxColumnWidth, gap, aspectRatio, maintainAspectRatio, itemHeight, items.length]);

  // Calculate virtual scroll state
  const virtualScrollState = useMemo((): VirtualScrollState => {
    if (!virtualScrollEnabled) {
      return {
        startIndex: 0,
        endIndex: items.length - 1,
        offsetY: 0,
        totalHeight: 0
      };
    }

    const { rowHeight, totalRows, itemsPerRow } = gridCalculation;
    const totalHeight = totalRows * (rowHeight + gap) - gap;

    const viewportHeight = containerSize.height;
    const startRow = Math.floor(Math.max(0, scrollTop - threshold) / (rowHeight + gap));
    const endRow = Math.min(
      totalRows - 1,
      Math.ceil((scrollTop + viewportHeight + threshold) / (rowHeight + gap))
    );

    const startIndex = Math.max(0, startRow * itemsPerRow - overscan);
    const endIndex = Math.min(items.length - 1, (endRow + 1) * itemsPerRow + overscan);
    const offsetY = startRow * (rowHeight + gap);

    return {
      startIndex,
      endIndex,
      offsetY,
      totalHeight
    };
  }, [virtualScrollEnabled, gridCalculation, containerSize.height, scrollTop, threshold, overscan, items.length, gap]);

  // Get visible items
  const visibleItems = useMemo(() => {
    if (!virtualScrollEnabled) {
      return items.map((item, index) => ({ item, index }));
    }

    return items
      .slice(virtualScrollState.startIndex, virtualScrollState.endIndex + 1)
      .map((item, relativeIndex) => ({
        item,
        index: virtualScrollState.startIndex + relativeIndex
      }));
  }, [items, virtualScrollEnabled, virtualScrollState.startIndex, virtualScrollState.endIndex]);

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Handle scroll for virtual scrolling
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (virtualScrollEnabled) {
      setScrollTop(event.currentTarget.scrollTop);
    }
  }, [virtualScrollEnabled]);

  // Initialize lazy loading observer
  useEffect(() => {
    if (!virtualScrollEnabled) {
      lazyObserverRef.current = new LazyObserver({
        rootMargin: '50px',
        threshold: 0.1
      });

      return () => {
        lazyObserverRef.current?.disconnect();
      };
    }
  }, [virtualScrollEnabled]);

  // Update selected items state
  useEffect(() => {
    setSelectedIds(new Set(selectedItems.map(item => item.id)));
  }, [selectedItems]);

  // Handle item selection
  const handleItemClick = useCallback((item: GridItem, index: number, event: React.MouseEvent) => {
    if (multiSelect && (event.ctrlKey || event.metaKey)) {
      // Toggle selection
      const newSelectedIds = new Set(selectedIds);
      if (newSelectedIds.has(item.id)) {
        newSelectedIds.delete(item.id);
      } else {
        newSelectedIds.add(item.id);
      }

      const newSelectedItems = items.filter(i => newSelectedIds.has(i.id));
      onSelectionChange?.(newSelectedItems);
    } else if (multiSelect && event.shiftKey && selectedItems.length > 0) {
      // Range selection
      const lastSelectedIndex = items.findIndex(i => i.id === selectedItems[selectedItems.length - 1].id);
      const startIndex = Math.min(lastSelectedIndex, index);
      const endIndex = Math.max(lastSelectedIndex, index);

      const rangeItems = items.slice(startIndex, endIndex + 1);
      const newSelectedItems = [...selectedItems, ...rangeItems.filter(i => !selectedIds.has(i.id))];
      onSelectionChange?.(newSelectedItems);
    } else {
      // Single selection
      if (multiSelect) {
        onSelectionChange?.([item]);
      }
      onItemClick?.(item, index);
    }
  }, [multiSelect, selectedIds, selectedItems, items, onSelectionChange, onItemClick]);

  // Get item position
  const getItemPosition = useCallback((index: number) => {
    const { columnWidth, rowHeight, itemsPerRow } = gridCalculation;
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;

    return {
      x: col * (columnWidth + gap),
      y: row * (rowHeight + gap),
      width: columnWidth,
      height: rowHeight
    };
  }, [gridCalculation, gap]);

  // Render grid item
  const renderGridItem = useCallback((item: GridItem, index: number) => {
    const position = getItemPosition(index);
    const isSelected = selectedIds.has(item.id);

    const itemStyle: React.CSSProperties = virtualScrollEnabled ? {
      position: 'absolute',
      left: position.x,
      top: position.y,
      width: position.width,
      height: position.height
    } : {
      width: position.width,
      height: position.height
    };

    return (
      <div
        key={item.id}
        className={`grid-item ${isSelected ? 'selected' : ''}`}
        style={itemStyle}
        onClick={(e) => handleItemClick(item, index, e)}
        onDoubleClick={() => onItemDoubleClick?.(item, index)}
        onContextMenu={(e) => onItemContextMenu?.(item, index, e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleItemClick(item, index, e as any);
          }
        }}
      >
        {renderItem(item, index)}
      </div>
    );
  }, [getItemPosition, selectedIds, virtualScrollEnabled, renderItem, handleItemClick, onItemDoubleClick, onItemContextMenu]);

  // Render loading state
  if (loading) {
    return (
      <div className={`grid-layout loading ${className}`} ref={containerRef}>
        {loadingState || (
          <div className="grid-layout-loading">
            <div className="loading-spinner" />
            <p>Loading...</p>
          </div>
        )}
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`grid-layout error ${className}`} ref={containerRef}>
        <div className="grid-layout-error">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  // Render empty state
  if (items.length === 0) {
    return (
      <div className={`grid-layout empty ${className}`} ref={containerRef}>
        {emptyState || (
          <div className="grid-layout-empty">
            <p>No items to display</p>
          </div>
        )}
      </div>
    );
  }

  // Render grid
  const containerStyle: React.CSSProperties = virtualScrollEnabled ? {
    height: '100%',
    overflow: 'auto'
  } : {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridCalculation.columns}, 1fr)`,
    gap: `${gap}px`,
    alignItems: 'start'
  };

  const contentStyle: React.CSSProperties = virtualScrollEnabled ? {
    position: 'relative',
    height: virtualScrollState.totalHeight,
    paddingTop: virtualScrollState.offsetY
  } : {};

  return (
    <div
      ref={containerRef}
      className={`grid-layout ${virtualScrollEnabled ? 'virtual' : ''} ${multiSelect ? 'multi-select' : ''} ${className}`}
      style={containerStyle}
      onScroll={handleScroll}
    >
      <div
        ref={scrollerRef}
        className="grid-layout-content"
        style={contentStyle}
      >
        {visibleItems.map(({ item, index }) => renderGridItem(item, index))}
      </div>
    </div>
  );
};

export default GridLayout;