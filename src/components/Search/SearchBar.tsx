/**
 * SearchBar component with advanced filtering capabilities
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { photoService } from '@/services/PhotoService';
import { storageService } from '@/services/StorageService';
import { debouncedListener } from '@/utils/dom-utils';
import type { Photo } from '@/models/Photo';
import type { Tag } from '@/models/Tag';

/**
 * Search filters interface
 */
export interface SearchFilters {
  query?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  albumIds?: string[];
  fileTypes?: string[];
  hasLocation?: boolean;
  hasCamera?: boolean;
}

/**
 * Search suggestions
 */
export interface SearchSuggestion {
  type: 'tag' | 'filename' | 'camera' | 'location' | 'date';
  value: string;
  count?: number;
  icon?: string;
}

/**
 * Search preset
 */
export interface SearchPreset {
  id: string;
  name: string;
  filters: SearchFilters;
  icon?: string;
}

/**
 * Search bar props
 */
export interface SearchBarProps {
  filters?: SearchFilters;
  onFiltersChange?: (filters: SearchFilters) => void;
  onSearch?: (results: Photo[]) => void;
  placeholder?: string;
  showAdvancedFilters?: boolean;
  showPresets?: boolean;
  enableSuggestions?: boolean;
  className?: string;
}

/**
 * Tag input component
 */
const TagInput: React.FC<{
  selectedTags: string[];
  availableTags: Tag[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}> = ({ selectedTags, availableTags, onChange, placeholder = 'Add tags...' }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);

    if (value.length > 0) {
      const filtered = availableTags.filter(tag =>
        tag.name.toLowerCase().includes(value.toLowerCase()) &&
        !selectedTags.includes(tag.name)
      );
      setSuggestions(filtered.slice(0, 10));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [availableTags, selectedTags]);

  const handleTagAdd = useCallback((tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      onChange([...selectedTags, tagName]);
    }
    setInputValue('');
    setShowSuggestions(false);
  }, [selectedTags, onChange]);

  const handleTagRemove = useCallback((tagName: string) => {
    onChange(selectedTags.filter(tag => tag !== tagName));
  }, [selectedTags, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleTagAdd(inputValue.trim());
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      handleTagRemove(selectedTags[selectedTags.length - 1]);
    }
  }, [inputValue, selectedTags, handleTagAdd, handleTagRemove]);

  return (
    <div className="tag-input">
      <div className="tag-input-container">
        <div className="selected-tags">
          {selectedTags.map(tag => (
            <span key={tag} className="tag-chip">
              {tag}
              <button
                type="button"
                onClick={() => handleTagRemove(tag)}
                className="tag-remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(inputValue.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          className="tag-input-field"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagAdd(tag.name)}
              className="tag-suggestion"
            >
              <span className="tag-name">{tag.name}</span>
              <span className="tag-count">({tag.photoCount})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Date range picker component
 */
const DateRangePicker: React.FC<{
  dateRange?: { start: Date; end: Date };
  onChange: (dateRange?: { start: Date; end: Date }) => void;
}> = ({ dateRange, onChange }) => {
  const [startDate, setStartDate] = useState(
    dateRange?.start ? dateRange.start.toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    dateRange?.end ? dateRange.end.toISOString().split('T')[0] : ''
  );

  const handleStartDateChange = useCallback((value: string) => {
    setStartDate(value);
    if (value && endDate) {
      onChange({
        start: new Date(value),
        end: new Date(endDate)
      });
    } else if (!value && !endDate) {
      onChange(undefined);
    }
  }, [endDate, onChange]);

  const handleEndDateChange = useCallback((value: string) => {
    setEndDate(value);
    if (startDate && value) {
      onChange({
        start: new Date(startDate),
        end: new Date(value)
      });
    } else if (!startDate && !value) {
      onChange(undefined);
    }
  }, [startDate, onChange]);

  const clearDates = useCallback(() => {
    setStartDate('');
    setEndDate('');
    onChange(undefined);
  }, [onChange]);

  return (
    <div className="date-range-picker">
      <div className="date-inputs">
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          className="date-input"
          placeholder="Start date"
        />
        <span className="date-separator">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => handleEndDateChange(e.target.value)}
          className="date-input"
          placeholder="End date"
        />
      </div>
      {(startDate || endDate) && (
        <button
          type="button"
          onClick={clearDates}
          className="clear-dates"
          title="Clear dates"
        >
          ✕
        </button>
      )}
    </div>
  );
};

/**
 * SearchBar component
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  filters = {},
  onFiltersChange,
  onSearch,
  placeholder = 'Search photos...',
  showAdvancedFilters = true,
  showPresets = true,
  enableSuggestions = true,
  className = ''
}) => {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Default search presets
  const defaultPresets: SearchPreset[] = useMemo(() => [
    {
      id: 'recent',
      name: 'Recent Photos',
      icon: '🕒',
      filters: {
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          end: new Date()
        }
      }
    },
    {
      id: 'no-albums',
      name: 'Unorganized',
      icon: '📂',
      filters: {
        albumIds: []
      }
    },
    {
      id: 'with-location',
      name: 'With Location',
      icon: '📍',
      filters: {
        hasLocation: true
      }
    },
    {
      id: 'portraits',
      name: 'Portraits',
      icon: '👤',
      filters: {
        tags: ['portrait', 'person', 'people']
      }
    }
  ], []);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await storageService.getAllTags();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };

    loadTags();
  }, []);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Debounced search function
  const performSearch = useCallback(async (searchFilters: SearchFilters) => {
    if (!onSearch) return;

    setIsSearching(true);

    try {
      const results = await photoService.searchPhotos({
        query: searchFilters.query,
        tags: searchFilters.tags,
        albumIds: searchFilters.albumIds,
        dateRange: searchFilters.dateRange
      });

      onSearch(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [onSearch]);

  // Update filters and trigger search
  const updateFilters = useCallback((newFilters: SearchFilters) => {
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(newFilters);
    }, 300);
  }, [onFiltersChange, performSearch]);

  // Handle query input change
  const handleQueryChange = useCallback((query: string) => {
    updateFilters({ ...localFilters, query });

    // Generate suggestions
    if (enableSuggestions && query.length > 1) {
      const queryLower = query.toLowerCase();
      const tagSuggestions: SearchSuggestion[] = availableTags
        .filter(tag => tag.name.toLowerCase().includes(queryLower))
        .slice(0, 5)
        .map(tag => ({
          type: 'tag',
          value: tag.name,
          count: tag.photoCount,
          icon: '🏷️'
        }));

      setSuggestions(tagSuggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [localFilters, updateFilters, enableSuggestions, availableTags]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.type === 'tag') {
      const currentTags = localFilters.tags || [];
      if (!currentTags.includes(suggestion.value)) {
        updateFilters({
          ...localFilters,
          tags: [...currentTags, suggestion.value]
        });
      }
    }
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  }, [localFilters, updateFilters]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: SearchPreset) => {
    updateFilters(preset.filters);
    setShowAdvanced(false);
  }, [updateFilters]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    updateFilters({});
    setShowAdvanced(false);
  }, [updateFilters]);

  // Get active filter count
  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (localFilters.query) count++;
    if (localFilters.tags?.length) count++;
    if (localFilters.dateRange) count++;
    if (localFilters.albumIds?.length) count++;
    if (localFilters.hasLocation) count++;
    if (localFilters.hasCamera) count++;
    return count;
  }, [localFilters]);

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className={`search-bar ${className}`}>
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <input
            ref={searchInputRef}
            type="text"
            value={localFilters.query || ''}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSuggestions(enableSuggestions && suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={placeholder}
            className="search-input"
          />
          <div className="search-input-icons">
            {isSearching && <span className="search-loading">⏳</span>}
            <button
              type="button"
              className="search-icon"
              onClick={() => performSearch(localFilters)}
              title="Search"
            >
              🔍
            </button>
          </div>
        </div>

        {/* Search suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="search-suggestions">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.value}-${index}`}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                className="search-suggestion"
              >
                <span className="suggestion-icon">{suggestion.icon}</span>
                <span className="suggestion-value">{suggestion.value}</span>
                {suggestion.count !== undefined && (
                  <span className="suggestion-count">({suggestion.count})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="search-controls">
        {showAdvancedFilters && (
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`btn btn-secondary ${showAdvanced ? 'active' : ''}`}
            title="Advanced filters"
          >
            ⚙️ Filters
            {activeFilterCount > 0 && (
              <span className="filter-count">{activeFilterCount}</span>
            )}
          </button>
        )}

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="btn btn-secondary"
            title="Clear all filters"
          >
            Clear
          </button>
        )}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && showAdvancedFilters && (
        <div className="advanced-filters">
          <div className="filter-section">
            <label className="filter-label">Tags:</label>
            <TagInput
              selectedTags={localFilters.tags || []}
              availableTags={availableTags}
              onChange={(tags) => updateFilters({ ...localFilters, tags })}
            />
          </div>

          <div className="filter-section">
            <label className="filter-label">Date Range:</label>
            <DateRangePicker
              dateRange={localFilters.dateRange}
              onChange={(dateRange) => updateFilters({ ...localFilters, dateRange })}
            />
          </div>

          <div className="filter-section">
            <label className="filter-label">Options:</label>
            <div className="filter-checkboxes">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={localFilters.hasLocation || false}
                  onChange={(e) => updateFilters({
                    ...localFilters,
                    hasLocation: e.target.checked || undefined
                  })}
                />
                Has GPS location
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={localFilters.hasCamera || false}
                  onChange={(e) => updateFilters({
                    ...localFilters,
                    hasCamera: e.target.checked || undefined
                  })}
                />
                Has camera info
              </label>
            </div>
          </div>

          {showPresets && (
            <div className="filter-section">
              <label className="filter-label">Quick Filters:</label>
              <div className="search-presets">
                {defaultPresets.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className="preset-button"
                    title={preset.name}
                  >
                    <span className="preset-icon">{preset.icon}</span>
                    <span className="preset-name">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;