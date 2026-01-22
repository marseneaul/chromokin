/**
 * Custom hook for global search functionality
 * Handles debounced search, keyboard navigation, and result management
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { globalSearch } from '@/data/globalSearchService';
import type { SearchResults, SearchResult } from '@/types/search';

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

interface UseGlobalSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResults | null;
  isSearching: boolean;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  flatResults: SearchResult[];
  clearSearch: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function useGlobalSearch(): UseGlobalSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Debounce timer ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle query changes with debounce
  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (query.length >= MIN_QUERY_LENGTH) {
      setIsSearching(true);

      // Set new timer
      timerRef.current = setTimeout(() => {
        const searchResults = globalSearch(query);
        setResults(searchResults);
        setIsOpen(searchResults.totalCount > 0);
        setIsSearching(false);
      }, DEBOUNCE_MS);
    } else {
      setResults(null);
      setIsSearching(false);
      if (query.length === 0) {
        setIsOpen(false);
      }
    }
    setSelectedIndex(0);

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query]);

  // Flatten results for keyboard navigation
  const flatResults = useMemo((): SearchResult[] => {
    if (!results) return [];
    return [
      ...results.genes,
      ...results.snps,
      ...results.traits,
      ...results.features,
      ...results.cytobands,
    ];
  }, [results]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults(null);
    setSelectedIndex(0);
    setIsOpen(false);
    setIsSearching(false);
  }, []);

  return {
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
  };
}
