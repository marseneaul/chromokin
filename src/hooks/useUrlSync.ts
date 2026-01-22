/**
 * URL sync hook
 * Syncs app state with browser URL for shareable links
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/state/appState';
import {
  parseUrl,
  buildUrl,
  calculateVisibleRange,
  type UrlState,
} from '@/lib/urlCodec';

// Default container width for zoom calculations when actual width unknown
const DEFAULT_CONTAINER_WIDTH = 1200;

// Debounce delay for URL updates during zoom/pan
const URL_UPDATE_DEBOUNCE_MS = 300;

/**
 * Hook to sync URL with app state
 * - Parses URL on mount and initializes state
 * - Updates URL when state changes (debounced)
 * - Handles browser back/forward navigation
 */
export function useUrlSync(): void {
  const isInitializedRef = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get state setters from store
  const setCurrentPage = useAppStore(state => state.setCurrentPage);
  const setActiveChromosome = useAppStore(state => state.setActiveChromosome);
  const setViewMode = useAppStore(state => state.setViewMode);
  const zoomToRange = useAppStore(state => state.zoomToRange);
  const selectGene = useAppStore(state => state.selectGene);
  const selectVariant = useAppStore(state => state.selectVariant);
  const selectTrait = useAppStore(state => state.selectTrait);
  const selectFeature = useAppStore(state => state.selectFeature);

  /**
   * Apply URL state to app state
   */
  const applyUrlState = useCallback(
    (urlState: UrlState) => {
      // Set page
      setCurrentPage(urlState.page);

      // Set chromosome
      if (urlState.chromosome) {
        setActiveChromosome(urlState.chromosome);

        // Set zoom if range provided
        if (urlState.start != null && urlState.end != null) {
          zoomToRange(
            urlState.chromosome,
            urlState.start,
            urlState.end,
            DEFAULT_CONTAINER_WIDTH
          );
        }
      }

      // Set view mode
      if (urlState.viewMode) {
        setViewMode(urlState.viewMode);
      }

      // Set selections
      if (urlState.selectedGene) {
        selectGene(urlState.selectedGene);
      }
      if (urlState.selectedSnp) {
        selectVariant(urlState.selectedSnp);
      }
      if (urlState.selectedTrait) {
        selectTrait(urlState.selectedTrait);
      }
      if (urlState.selectedFeature) {
        selectFeature(urlState.selectedFeature);
      }
    },
    [
      setCurrentPage,
      setActiveChromosome,
      setViewMode,
      zoomToRange,
      selectGene,
      selectVariant,
      selectTrait,
      selectFeature,
    ]
  );

  /**
   * Get current state for URL
   */
  const getCurrentUrlState = useCallback((): Partial<UrlState> => {
    const state = useAppStore.getState();

    const urlState: Partial<UrlState> = {
      page: state.currentPage,
      chromosome: state.activeChromosome,
      selectedGene: state.selectedGeneId,
      selectedSnp: state.selectedVariantId,
      selectedTrait: state.selectedTraitId,
      selectedFeature: state.selectedFeatureId,
      viewMode: state.viewMode !== 'play' ? state.viewMode : null,
    };

    // Calculate visible range from zoom state
    if (state.activeChromosome) {
      const zoomState = state.chromosomeZoomStates[state.activeChromosome];
      if (zoomState) {
        const range = calculateVisibleRange(
          zoomState.centerPosition,
          zoomState.bpPerPx,
          DEFAULT_CONTAINER_WIDTH
        );
        urlState.start = range.start;
        urlState.end = range.end;
      }
    }

    return urlState;
  }, []);

  /**
   * Update browser URL from current state
   */
  const updateUrl = useCallback(
    (replace: boolean = true) => {
      const urlState = getCurrentUrlState();
      const newUrl = buildUrl(urlState);
      const currentPath = window.location.pathname + window.location.search;

      // Only update if URL changed
      if (newUrl !== currentPath) {
        if (replace) {
          window.history.replaceState(null, '', newUrl);
        } else {
          window.history.pushState(null, '', newUrl);
        }
      }
    },
    [getCurrentUrlState]
  );

  /**
   * Debounced URL update
   */
  const debouncedUpdateUrl = useCallback(
    (replace: boolean = true) => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        updateUrl(replace);
      }, URL_UPDATE_DEBOUNCE_MS);
    },
    [updateUrl]
  );

  // Initialize from URL on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const urlState = parseUrl();

    // Only apply if URL has meaningful state (not just root)
    if (
      urlState.page === 'browser' ||
      urlState.chromosome ||
      urlState.selectedGene ||
      urlState.selectedSnp ||
      urlState.selectedTrait ||
      urlState.selectedFeature
    ) {
      applyUrlState(urlState);
    }
  }, [applyUrlState]);

  // Subscribe to state changes and update URL
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(
      state => ({
        page: state.currentPage,
        chr: state.activeChromosome,
        zoom: state.activeChromosome
          ? state.chromosomeZoomStates[state.activeChromosome]
          : null,
        gene: state.selectedGeneId,
        snp: state.selectedVariantId,
        trait: state.selectedTraitId,
        feature: state.selectedFeatureId,
        mode: state.viewMode,
      }),
      (current, prev) => {
        // Skip during initialization
        if (!isInitializedRef.current) return;

        // Determine if this is a navigation change (use pushState) or zoom/pan (use replaceState)
        const isNavigation =
          current.page !== prev.page ||
          current.chr !== prev.chr ||
          current.gene !== prev.gene ||
          current.snp !== prev.snp ||
          current.trait !== prev.trait ||
          current.feature !== prev.feature;

        if (isNavigation) {
          // Navigation changes: push to history immediately
          updateUrl(false);
        } else {
          // Zoom/pan changes: debounce and replace
          debouncedUpdateUrl(true);
        }
      },
      { fireImmediately: false }
    );

    return () => {
      unsubscribe();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateUrl, debouncedUpdateUrl]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const urlState = parseUrl();
      applyUrlState(urlState);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyUrlState]);
}
