/**
 * Type definitions for quirky genomic features:
 * - HERVs (Human Endogenous Retroviruses)
 * - Transposable elements (LINEs, SINEs, Alu)
 * - Pseudogenes
 * - Other fun genomic oddities
 */

import type { CopyLevel } from './core';
import type { CopyLevelContent } from './traits';

/**
 * Categories of genomic features for display
 */
export type GenomicFeatureType =
  | 'herv' // Human Endogenous Retrovirus
  | 'line' // Long Interspersed Nuclear Element
  | 'sine' // Short Interspersed Nuclear Element (includes Alu)
  | 'dna_transposon' // DNA transposons
  | 'pseudogene' // Non-functional gene copies
  | 'satellite' // Repetitive DNA at centromeres
  | 'segmental_duplication' // Large duplicated regions
  | 'numt' // Nuclear mitochondrial DNA segment
  | 'har' // Human Accelerated Region
  | 'neanderthal' // Neanderthal introgression region
  | 'denisovan' // Denisovan introgression region
  | 'archaic' // Both Neanderthal and Denisovan DNA
  | 'fusion' // Chromosomal fusion site
  | 'disease_gene' // Well-known disease genes
  | 'human_specific' // Human-specific features
  | 'longevity' // Longevity-associated regions
  | 'gene_desert' // Large regions with no genes
  | 'other'; // Other interesting features

/**
 * A single genomic feature record
 */
export interface GenomicFeature {
  id: string;
  name: string;
  type: GenomicFeatureType;
  subtype?: string; // e.g., "HERV-K", "Alu", "LINE-1"

  // Location (GRCh38)
  chromosome: string;
  start: number;
  end: number;
  strand?: '+' | '-' | '.';

  // Display
  nickname?: string; // e.g., "Ancient Virus DNA"
  color: string;
  icon?: string; // Lucide icon name

  // Multi-level descriptions
  shortDescription: CopyLevelContent;
  funFact?: CopyLevelContent;

  // Additional info
  ageEstimate?: string; // e.g., "~25 million years old"
  percentOfGenome?: number; // What % of genome this type represents
  isActive?: boolean; // Can it still "jump"?
  functionKnown?: string; // Any known function

  // Display control
  kidFriendly: boolean;
  minCopyLevel: CopyLevel;
  tags: string[];
}

/**
 * Summary info for each feature type (for legends and info panels)
 */
export interface FeatureTypeSummary {
  type: GenomicFeatureType;
  displayName: string;
  description: CopyLevelContent;
  color: string;
  icon: string;
  percentOfGenome: number;
  count?: number; // Approximate count in genome
}

/**
 * JSON structure for the genomic features data file
 */
export interface GenomicFeaturesDataFile {
  version: string;
  build: 'GRCh38' | 'GRCh37';
  lastUpdated: string;
  typeSummaries: FeatureTypeSummary[];
  features: GenomicFeature[];
}

/**
 * Indexed database for efficient lookups
 */
export interface GenomicFeaturesDatabase {
  features: Map<string, GenomicFeature>;
  featuresByChromosome: Map<string, GenomicFeature[]>;
  featuresByType: Map<GenomicFeatureType, GenomicFeature[]>;
  typeSummaries: Map<GenomicFeatureType, FeatureTypeSummary>;
}
