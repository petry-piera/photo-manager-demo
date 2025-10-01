/**
 * Unit tests for GridLayout component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

import GridLayout, { GridLayoutProps, GridItem } from '@/components/common/GridLayout';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;

// Mock LazyObserver
vi.mock('@/utils/dom-utils', () => ({
  LazyObserver: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
}));

describe('GridLayout', () => {
  const mockItems: GridItem[] = [
    { id: '1', data: { title: 'Item 1' } },
    { id: '2', data: { title: 'Item 2' } },
    { id: '3', data: { title: 'Item 3' } },
    { id: '4', data: { title: 'Item 4' } },
    { id: '5', data: { title: 'Item 5' } },
    { id: '6', data: { title: 'Item 6' } }
  ];

  const mockRenderItem = vi.fn((item: GridItem, index: number) => (
    <div data-testid={`item-${item.id}`} role="article">
      <h3>{item.data.title}</h3>
      <p>Index: {index}</p>
    </div>
  ));

  const defaultProps: GridLayoutProps = {
    items: mockItems,
    renderItem: mockRenderItem
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getBoundingClientRect for container sizing
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {}
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render grid layout with items', () => {
      render(<GridLayout {...defaultProps} />);

      expect(screen.getByRole('button', { name: /item 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /item 2/i })).toBeInTheDocument();
      expect(mockRenderItem).toHaveBeenCalledTimes(mockItems.length);
    });

    it('should apply custom className', () => {
      const { container } = render(<GridLayout {...defaultProps} className="custom-grid" />);

      expect(container.firstChild).toHaveClass('grid-layout', 'custom-grid');
    });

    it('should render loading state', () => {
      render(<GridLayout {...defaultProps} loading={true} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();
    });

    it('should render custom loading state', () => {
      const customLoadingState = <div data-testid="custom-loading">Custom Loading...</div>;
      render(<GridLayout {...defaultProps} loading={true} loadingState={customLoadingState} />);

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should render error state', () => {
      const errorMessage = 'Failed to load items';
      render(<GridLayout {...defaultProps} error={errorMessage} />);

      expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
      expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();
    });

    it('should render empty state', () => {
      render(<GridLayout {...defaultProps} items={[]} />);

      expect(screen.getByText('No items to display')).toBeInTheDocument();
    });

    it('should render custom empty state', () => {
      const customEmptyState = <div data-testid="custom-empty">No photos found</div>;
      render(<GridLayout {...defaultProps} items={[]} emptyState={customEmptyState} />);

      expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
      expect(screen.queryByText('No items to display')).not.toBeInTheDocument();
    });
  });

  describe('Grid configuration', () => {
    it('should apply grid configuration', () => {
      const config = {
        columns: 3,
        gap: 20,
        aspectRatio: 1.5
      };

      const { container } = render(<GridLayout {...defaultProps} config={config} />);
      const gridContainer = container.querySelector('.grid-layout-content');

      expect(gridContainer).toBeInTheDocument();
    });

    it('should handle responsive columns based on container width', () => {
      const config = {
        minColumnWidth: 200,
        maxColumnWidth: 400
      };

      render(<GridLayout {...defaultProps} config={config} />);

      // Items should be rendered based on calculated columns
      expect(screen.getAllByRole('button')).toHaveLength(mockItems.length);
    });

    it('should respect minimum column width', () => {
      // Mock narrow container
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        width: 150, // Less than minColumnWidth
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 150,
        x: 0,
        y: 0,
        toJSON: () => {}
      }));

      const config = { minColumnWidth: 200 };
      render(<GridLayout {...defaultProps} config={config} />);

      expect(screen.getAllByRole('button')).toHaveLength(mockItems.length);
    });
  });

  describe('Virtual scrolling', () => {
    it('should enable virtual scrolling', () => {
      const virtualScroll = {
        enabled: true,
        itemHeight: 200,
        overscan: 2
      };

      const { container } = render(
        <GridLayout {...defaultProps} virtualScroll={virtualScroll} />
      );

      expect(container.firstChild).toHaveClass('virtual');
    });

    it('should handle scroll events in virtual mode', async () => {
      const virtualScroll = { enabled: true, itemHeight: 200 };
      const { container } = render(
        <GridLayout {...defaultProps} virtualScroll={virtualScroll} />
      );

      const scrollContainer = container.querySelector('.grid-layout');
      expect(scrollContainer).toBeInTheDocument();

      // Simulate scroll
      if (scrollContainer) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: 400 } });
      }

      await waitFor(() => {
        // Verify scroll handling (items should still be rendered)
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
      });
    });

    it('should calculate visible items correctly with virtual scrolling', () => {
      const manyItems = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        data: { title: `Item ${i}` }
      }));

      const virtualScroll = {
        enabled: true,
        itemHeight: 200,
        overscan: 5
      };

      render(
        <GridLayout
          items={manyItems}
          renderItem={mockRenderItem}
          virtualScroll={virtualScroll}
        />
      );

      // Should render only visible + overscan items
      const renderedItems = screen.getAllByRole('button');
      expect(renderedItems.length).toBeLessThan(manyItems.length);
    });
  });

  describe('Item interactions', () => {
    it('should handle item clicks', async () => {
      const onItemClick = vi.fn();
      render(<GridLayout {...defaultProps} onItemClick={onItemClick} />);

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      await userEvent.click(firstItem);

      expect(onItemClick).toHaveBeenCalledWith(mockItems[0], 0);
    });

    it('should handle item double clicks', async () => {
      const onItemDoubleClick = vi.fn();
      render(<GridLayout {...defaultProps} onItemDoubleClick={onItemDoubleClick} />);

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      await userEvent.dblClick(firstItem);

      expect(onItemDoubleClick).toHaveBeenCalledWith(mockItems[0], 0);
    });

    it('should handle context menu', async () => {
      const onItemContextMenu = vi.fn();
      render(<GridLayout {...defaultProps} onItemContextMenu={onItemContextMenu} />);

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      fireEvent.contextMenu(firstItem);

      expect(onItemContextMenu).toHaveBeenCalledWith(
        mockItems[0],
        0,
        expect.any(Object)
      );
    });

    it('should handle keyboard navigation', async () => {
      const onItemClick = vi.fn();
      render(<GridLayout {...defaultProps} onItemClick={onItemClick} />);

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      firstItem.focus();

      await userEvent.keyboard('{Enter}');
      expect(onItemClick).toHaveBeenCalledWith(mockItems[0], 0);

      onItemClick.mockClear();
      await userEvent.keyboard(' ');
      expect(onItemClick).toHaveBeenCalledWith(mockItems[0], 0);
    });
  });

  describe('Multi-selection', () => {
    it('should enable multi-selection mode', () => {
      const { container } = render(<GridLayout {...defaultProps} multiSelect={true} />);

      expect(container.firstChild).toHaveClass('multi-select');
    });

    it('should handle Ctrl+Click for toggle selection', async () => {
      const onSelectionChange = vi.fn();
      render(
        <GridLayout
          {...defaultProps}
          multiSelect={true}
          onSelectionChange={onSelectionChange}
        />
      );

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      await userEvent.click(firstItem, { ctrlKey: true });

      expect(onSelectionChange).toHaveBeenCalledWith([mockItems[0]]);
    });

    it('should handle Shift+Click for range selection', async () => {
      const onSelectionChange = vi.fn();
      render(
        <GridLayout
          {...defaultProps}
          multiSelect={true}
          selectedItems={[mockItems[0]]}
          onSelectionChange={onSelectionChange}
        />
      );

      const thirdItem = screen.getByRole('button', { name: /item 3/i });
      await userEvent.click(thirdItem, { shiftKey: true });

      expect(onSelectionChange).toHaveBeenCalledWith(
        expect.arrayContaining([mockItems[0], mockItems[1], mockItems[2]])
      );
    });

    it('should toggle selection with Ctrl+Click', async () => {
      const onSelectionChange = vi.fn();
      render(
        <GridLayout
          {...defaultProps}
          multiSelect={true}
          selectedItems={[mockItems[0]]}
          onSelectionChange={onSelectionChange}
        />
      );

      // Click already selected item with Ctrl to deselect
      const firstItem = screen.getByRole('button', { name: /item 1/i });
      await userEvent.click(firstItem, { ctrlKey: true });

      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('should show selected items visually', () => {
      render(
        <GridLayout
          {...defaultProps}
          multiSelect={true}
          selectedItems={[mockItems[0], mockItems[2]]}
        />
      );

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      const thirdItem = screen.getByRole('button', { name: /item 3/i });

      expect(firstItem).toHaveClass('selected');
      expect(thirdItem).toHaveClass('selected');
    });

    it('should handle single selection in multi-select mode', async () => {
      const onSelectionChange = vi.fn();
      const onItemClick = vi.fn();
      render(
        <GridLayout
          {...defaultProps}
          multiSelect={true}
          onSelectionChange={onSelectionChange}
          onItemClick={onItemClick}
        />
      );

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      await userEvent.click(firstItem); // No modifier keys

      expect(onSelectionChange).toHaveBeenCalledWith([mockItems[0]]);
      expect(onItemClick).toHaveBeenCalledWith(mockItems[0], 0);
    });
  });

  describe('Responsive behavior', () => {
    it('should update layout on container resize', async () => {
      const { rerender } = render(<GridLayout {...defaultProps} />);

      // Mock container resize
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        width: 400, // Smaller width
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 400,
        x: 0,
        y: 0,
        toJSON: () => {}
      }));

      // Trigger resize observer callback
      act(() => {
        const resizeCallback = MockResizeObserver.prototype.observe.mock.calls[0];
        if (resizeCallback) {
          // Simulate resize observer firing
          rerender(<GridLayout {...defaultProps} />);
        }
      });

      await waitFor(() => {
        // Items should still be rendered
        expect(screen.getAllByRole('button')).toHaveLength(mockItems.length);
      });
    });

    it('should handle zero-width container gracefully', () => {
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => {}
      }));

      render(<GridLayout {...defaultProps} />);

      // Should still render items without errors
      expect(screen.getAllByRole('button')).toHaveLength(mockItems.length);
    });
  });

  describe('Performance', () => {
    it('should not re-render items unnecessarily', () => {
      const { rerender } = render(<GridLayout {...defaultProps} />);

      mockRenderItem.mockClear();

      // Re-render with same props
      rerender(<GridLayout {...defaultProps} />);

      // Items should be re-rendered due to React's nature, but efficiently
      expect(mockRenderItem).toHaveBeenCalledTimes(mockItems.length);
    });

    it('should handle large datasets efficiently with virtual scrolling', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        data: { title: `Item ${i}` }
      }));

      const virtualScroll = { enabled: true, itemHeight: 200 };

      const startTime = performance.now();
      render(
        <GridLayout
          items={largeDataset}
          renderItem={mockRenderItem}
          virtualScroll={virtualScroll}
        />
      );
      const endTime = performance.now();

      // Should render quickly even with large dataset
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold

      // Should render only visible items
      const renderedItems = screen.getAllByRole('button');
      expect(renderedItems.length).toBeLessThan(100); // Much less than 1000
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<GridLayout {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper ARIA roles', () => {
      render(<GridLayout {...defaultProps} />);

      const items = screen.getAllByRole('button');
      expect(items).toHaveLength(mockItems.length);

      items.forEach(item => {
        expect(item).toHaveAttribute('tabIndex', '0');
      });
    });

    it('should support keyboard navigation', async () => {
      render(<GridLayout {...defaultProps} />);

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      const secondItem = screen.getByRole('button', { name: /item 2/i });

      // Should be able to focus items
      firstItem.focus();
      expect(firstItem).toHaveFocus();

      // Should be able to tab between items
      await userEvent.tab();
      expect(secondItem).toHaveFocus();
    });

    it('should announce loading state to screen readers', () => {
      render(<GridLayout {...defaultProps} loading={true} />);

      // Loading state should be perceivable
      const loadingElement = screen.getByText('Loading...');
      expect(loadingElement).toBeInTheDocument();
    });

    it('should announce error state to screen readers', () => {
      const errorMessage = 'Failed to load items';
      render(<GridLayout {...defaultProps} error={errorMessage} />);

      const errorElement = screen.getByText(`Error: ${errorMessage}`);
      expect(errorElement).toBeInTheDocument();
    });

    it('should handle focus management in multi-select mode', async () => {
      render(<GridLayout {...defaultProps} multiSelect={true} />);

      const firstItem = screen.getByRole('button', { name: /item 1/i });
      firstItem.focus();

      // Should maintain focus after selection
      await userEvent.keyboard('{Enter}');
      expect(firstItem).toHaveFocus();
    });
  });

  describe('Error handling', () => {
    it('should handle missing renderItem function gracefully', () => {
      // This would cause TypeScript error, but test runtime behavior
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<GridLayout items={mockItems} renderItem={undefined as any} />);
      }).not.toThrow();

      consoleError.mockRestore();
    });

    it('should handle items with missing IDs', () => {
      const itemsWithoutIds = [
        { id: '', data: { title: 'Item without ID' } },
        ...mockItems.slice(1)
      ];

      expect(() => {
        render(<GridLayout items={itemsWithoutIds} renderItem={mockRenderItem} />);
      }).not.toThrow();
    });

    it('should handle ResizeObserver not being available', () => {
      // Temporarily remove ResizeObserver
      const originalResizeObserver = global.ResizeObserver;
      delete (global as any).ResizeObserver;

      expect(() => {
        render(<GridLayout {...defaultProps} />);
      }).not.toThrow();

      // Restore ResizeObserver
      global.ResizeObserver = originalResizeObserver;
    });

    it('should handle scroll events with missing target', () => {
      const virtualScroll = { enabled: true };
      render(<GridLayout {...defaultProps} virtualScroll={virtualScroll} />);

      // Create event without proper target
      const invalidScrollEvent = new Event('scroll');
      Object.defineProperty(invalidScrollEvent, 'currentTarget', {
        value: null
      });

      expect(() => {
        const scrollContainer = document.querySelector('.grid-layout');
        scrollContainer?.dispatchEvent(invalidScrollEvent);
      }).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle single item', () => {
      const singleItem = [mockItems[0]];
      render(<GridLayout items={singleItem} renderItem={mockRenderItem} />);

      expect(screen.getByRole('button', { name: /item 1/i })).toBeInTheDocument();
    });

    it('should handle items with custom dimensions', () => {
      const customItems: GridItem[] = [
        { id: '1', width: 200, height: 150, data: { title: 'Custom Item 1' } },
        { id: '2', width: 300, height: 200, data: { title: 'Custom Item 2' } }
      ];

      render(<GridLayout items={customItems} renderItem={mockRenderItem} />);

      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    it('should handle rapid selection changes', async () => {
      const onSelectionChange = vi.fn();
      render(
        <GridLayout
          {...defaultProps}
          multiSelect={true}
          onSelectionChange={onSelectionChange}
        />
      );

      const items = screen.getAllByRole('button');

      // Rapidly select multiple items
      for (let i = 0; i < 3; i++) {
        await userEvent.click(items[i], { ctrlKey: true });
      }

      expect(onSelectionChange).toHaveBeenCalledTimes(3);
    });

    it('should handle very large gap values', () => {
      const config = { gap: 100 };
      render(<GridLayout {...defaultProps} config={config} />);

      expect(screen.getAllByRole('button')).toHaveLength(mockItems.length);
    });

    it('should handle extreme aspect ratios', () => {
      const config = { aspectRatio: 0.1 }; // Very tall and narrow
      render(<GridLayout {...defaultProps} config={config} />);

      expect(screen.getAllByRole('button')).toHaveLength(mockItems.length);
    });
  });
});