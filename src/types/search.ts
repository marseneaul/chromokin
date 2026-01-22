/**
 * Type definitions for global search functionality
 */

import type { TraitGeneRecord, EnhancedTraitRecord } from './traits';
import type { AnnotatedSNP, Cytoband } from './genome';
import type { GenomicFeature } from './genomicFeatures';

/**
 * Types of searchable entities
 */
export type SearchResultType =
  | 'gene'
  | 'snp'
  | 'trait'
  | 'feature'
  | 'cytoband';

/**
 * Base interface for all search results
 */
export interface BaseSearchResult {
  id: string;
  type: SearchResultType;
  primaryText: string; // Main display text (name/symbol)
  secondaryText?: string; // Subtitle (chromosome location, category, etc.)
  chromosome: string;
  start: number;
  end: number;
  score: number; // Relevance score for sorting (higher = more relevant)
}

/**
 * Gene search result
 */
export interface GeneSearchResult extends BaseSearchResult {
  type: 'gene';
  gene: TraitGeneRecord;
}

/**
 * SNP search result
 */
export interface SNPSearchResult extends BaseSearchResult {
  type: 'snp';
  snp: AnnotatedSNP;
}

/**
 * Trait search result
 */
export interface TraitSearchResult extends BaseSearchResult {
  type: 'trait';
  trait: EnhancedTraitRecord;
}

/**
 * Genomic feature search result
 */
export interface FeatureSearchResult extends BaseSearchResult {
  type: 'feature';
  feature: GenomicFeature;
}

/**
 * Cytoband search result
 */
export interface CytobandSearchResult extends BaseSearchResult {
  type: 'cytoband';
  cytoband: Cytoband;
}

/**
 * Union type for all search results
 */
export type SearchResult =
  | GeneSearchResult
  | SNPSearchResult
  | TraitSearchResult
  | FeatureSearchResult
  | CytobandSearchResult;

/**
 * Grouped search results by category
 */
export interface SearchResults {
  genes: GeneSearchResult[];
  snps: SNPSearchResult[];
  traits: TraitSearchResult[];
  features: FeatureSearchResult[];
  cytobands: CytobandSearchResult[];
  totalCount: number;
}

/**
 * Empty search results constant
 */
export const EMPTY_SEARCH_RESULTS: SearchResults = {
  genes: [],
  snps: [],
  traits: [],
  features: [],
  cytobands: [],
  totalCount: 0,
};
