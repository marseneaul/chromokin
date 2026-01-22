/**
 * URL encoding/decoding utilities for shareable URLs
 */

import type { ViewMode } from '@/types/core';

/**
 * State that can be serialized to/from URL
 */
export interface UrlState {
  page: 'overview' | 'browser';
  chromosome: string | null;
  start: number | null;
  end: number | null;
  selectedGene: string | null;
  selectedSnp: string | null;
  selectedTrait: string | null;
  selectedFeature: string | null;
  viewMode: ViewMode | null;
}

/**
 * Default URL state
 */
export const DEFAULT_URL_STATE: UrlState = {
  page: 'overview',
  chromosome: null,
  start: null,
  end: null,
  selectedGene: null,
  selectedSnp: null,
  selectedTrait: null,
  selectedFeature: null,
  viewMode: null,
};

/**
 * Parse the current URL into state
 */
export function parseUrl(url: string = window.location.href): UrlState {
  const parsed = new URL(url, window.location.origin);
  const pathname = parsed.pathname;
  const params = parsed.searchParams;

  const state: UrlState = { ...DEFAULT_URL_STATE };

  // Parse path: / or /browser/15
  if (pathname === '/' || pathname === '') {
    state.page = 'overview';
  } else {
    const match = pathname.match(/^\/browser\/([^/]+)\/?$/);
    if (match) {
      state.page = 'browser';
      state.chromosome = match[1];
    }
  }

  // Parse query params
  const startParam = params.get('start');
  const endParam = params.get('end');
  if (startParam && endParam) {
    const start = parseInt(startParam, 10);
    const end = parseInt(endParam, 10);
    if (!isNaN(start) && !isNaN(end) && start < end) {
      state.start = start;
      state.end = end;
    }
  }

  // Selection params
  const gene = params.get('gene');
  if (gene) state.selectedGene = gene;

  const snp = params.get('snp');
  if (snp) state.selectedSnp = snp;

  const trait = params.get('trait');
  if (trait) state.selectedTrait = trait;

  const feature = params.get('feature');
  if (feature) state.selectedFeature = feature;

  // View mode
  const mode = params.get('mode');
  if (mode === 'play' || mode === 'pro') {
    state.viewMode = mode;
  }

  return state;
}

/**
 * Build a URL string from state
 */
export function buildUrl(state: Partial<UrlState>): string {
  // Build path
  let path = '/';
  if (state.page === 'browser' && state.chromosome) {
    path = `/browser/${state.chromosome}`;
  }

  // Build query params
  const params = new URLSearchParams();

  if (state.start != null && state.end != null) {
    params.set('start', state.start.toString());
    params.set('end', state.end.toString());
  }

  if (state.selectedGene) {
    params.set('gene', state.selectedGene);
  }

  if (state.selectedSnp) {
    params.set('snp', state.selectedSnp);
  }

  if (state.selectedTrait) {
    params.set('trait', state.selectedTrait);
  }

  if (state.selectedFeature) {
    params.set('feature', state.selectedFeature);
  }

  if (state.viewMode && state.viewMode !== 'play') {
    params.set('mode', state.viewMode);
  }

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * Calculate visible range from zoom state
 */
export function calculateVisibleRange(
  centerPosition: number,
  bpPerPx: number,
  containerWidth: number
): { start: number; end: number } {
  const halfWidth = (containerWidth * bpPerPx) / 2;
  return {
    start: Math.max(0, Math.round(centerPosition - halfWidth)),
    end: Math.round(centerPosition + halfWidth),
  };
}

/**
 * Calculate zoom state from visible range
 */
export function calculateZoomFromRange(
  start: number,
  end: number,
  containerWidth: number
): { centerPosition: number; bpPerPx: number } {
  const range = end - start;
  return {
    centerPosition: start + range / 2,
    bpPerPx: range / containerWidth,
  };
}
