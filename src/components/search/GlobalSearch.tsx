/**
 * Global search container component
 * Orchestrates search input, results dropdown, and navigation
 */

import React, { useRef, useCallback, useEffect, type JSX } from 'react';
import { cn } from '@/lib/utils';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';
import { useGlobalSearch } from './useGlobalSearch';
import {
  useSetActiveChromosome,
  useSetCurrentPage,
  useZoomToRange,
  useSelectGene,
  useSelectTrait,
  useSelectFeature,
  useSelectVariant,
} from '@/state/appState';
import type { SearchResult } from '@/types/search';

interface GlobalSearchProps {
  className?: string;
}

// Default container width for zoom calculations
const DEFAULT_CONTAINER_WIDTH = 1000;

export function GlobalSearch({ className }: GlobalSearchProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    results,
    isSearching,
    selectedIndex,
    setSelectedIndex,
    flatResults,
    clearSearch,
    isOpen,
    setIsOpen,
  } = useGlobalSearch();

  // Navigation actions
  const setActiveChromosome = useSetActiveChromosome();
  const setCurrentPage = useSetCurrentPage();
  const zoomToRange = useZoomToRange();
  const selectGene = useSelectGene();
  const selectTrait = useSelectTrait();
  const selectFeature = useSelectFeature();
  const selectVariant = useSelectVariant();

  /**
   * Handle selecting a search result
   */
  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      // Navigate to chromosome
      setActiveChromosome(result.chromosome);
      setCurrentPage('browser');

      // Calculate zoom with padding
      const range = result.end - result.start;
      const padding = Math.max(10000, range * 2);
      const zoomedStart = Math.max(0, result.start - padding);
      const zoomedEnd = result.end + padding;

      // Zoom to region
      zoomToRange(
        result.chromosome,
        zoomedStart,
        zoomedEnd,
        DEFAULT_CONTAINER_WIDTH
      );

      // Open detail panel based on type
      switch (result.type) {
        case 'gene':
          selectGene(result.id);
          break;
        case 'snp':
          selectVariant(result.id);
          break;
        case 'trait':
          selectTrait(result.id);
          break;
        case 'feature':
          selectFeature(result.id);
          break;
        case 'cytoband':
          // No detail panel for cytobands, just navigate
          break;
      }

      // Clear search and close dropdown
      clearSearch();
    },
    [
      setActiveChromosome,
      setCurrentPage,
      zoomToRange,
      selectGene,
      selectTrait,
      selectFeature,
      selectVariant,
      clearSearch,
    ]
  );

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || flatResults.length === 0) {
        if (e.key === 'Escape') {
          clearSearch();
          inputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(Math.min(selectedIndex + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(Math.max(selectedIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            handleSelectResult(flatResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          clearSearch();
          inputRef.current?.blur();
          break;
      }
    },
    [
      isOpen,
      flatResults,
      selectedIndex,
      setSelectedIndex,
      handleSelectResult,
      clearSearch,
    ]
  );

  /**
   * Handle click outside to close dropdown
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  /**
   * Handle focus to open dropdown if there are results
   */
  const handleFocus = useCallback(() => {
    if (results && results.totalCount > 0) {
      setIsOpen(true);
    }
  }, [results, setIsOpen]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <SearchInput
        ref={inputRef}
        value={query}
        onChange={setQuery}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onClear={clearSearch}
        isSearching={isSearching}
      />

      {isOpen && results && (
        <SearchResults
          results={results}
          selectedIndex={selectedIndex}
          onSelect={handleSelectResult}
          onHover={setSelectedIndex}
        />
      )}
    </div>
  );
}
