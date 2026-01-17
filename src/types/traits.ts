/**
 * Type definitions for trait-gene associations in ChromoKin
 * Supports multi-level content adaptation for different reading levels
 */

import type { CopyLevel } from './core';

/**
 * Content at multiple reading levels (grades 3-8)
 */
export interface CopyLevelContent {
  level3: string; // Simple words, short sentences (ages 8-9)
  level4: string; // Basic vocabulary with explanations (ages 9-10)
  level5: string; // Intermediate terms with context (ages 10-11)
  level6: string; // Advanced vocabulary with definitions (ages 11-12)
  level7: string; // Scientific terms with full explanations (ages 12-13)
  level8: string; // Professional terminology (ages 13+)
}

/**
 * Gene association within a trait record
 */
export interface TraitGeneAssociation {
  geneId: string;
  geneSymbol: string;
  chromosome: string;
  start: number; // GRCh38 coordinates
  end: number;
  strand: '+' | '-';
  contributionType: 'primary' | 'modifier' | 'associated';
  evidenceLevel: 'high' | 'medium' | 'low';
}

/**
 * Variant association within a trait record
 */
export interface TraitVariantAssociation {
  variantId: string;
  rsId: string;
  chromosome: string;
  position: number;
  referenceAllele: string;
  alternateAllele: string;
  effect: string; // e.g., "Blue eyes more likely"
  frequency: number; // Population frequency 0-1
}

/**
 * Trait categories for filtering and display
 */
export type TraitCategory = 'physical' | 'sensory' | 'health' | 'fun';

/**
 * Inheritance patterns for educational display
 */
export type InheritancePattern =
  | 'dominant'
  | 'recessive'
  | 'codominant'
  | 'polygenic'
  | 'complex';

/**
 * Enhanced trait record with multi-level content
 */
export interface EnhancedTraitRecord {
  id: string;
  name: string;
  category: TraitCategory;
  subcategory?: string; // e.g., "pigmentation", "taste", "sleep"

  // Visual representation
  icon: string; // Lucide icon name
  color: string; // Hex color for visual grouping

  // Descriptions at multiple reading levels
  shortDescription: CopyLevelContent;
  longDescription: CopyLevelContent;
  funFact: CopyLevelContent;

  // Gene and variant associations
  genes: TraitGeneAssociation[];
  variants: TraitVariantAssociation[];

  // Inheritance pattern
  inheritancePattern: InheritancePattern;
  inheritanceExplanation: CopyLevelContent;

  // Metadata
  prevalence?: string; // e.g., "About 2% of people worldwide"
  relatedTraits?: string[];

  // Display control
  kidFriendly: boolean;
  minCopyLevel: CopyLevel;
  tags: string[];
}

/**
 * Gene record for trait visualization
 */
export interface TraitGeneRecord {
  id: string;
  symbol: string;
  name: string;
  chromosome: string;
  start: number;
  end: number;
  strand: '+' | '-';

  // Kid-friendly content
  nickname?: string; // e.g., "The Eye Color Gene"
  shortDescription: CopyLevelContent;

  // Visual properties
  color?: string;
  displayPriority: number;

  // Associated traits (for reverse lookup)
  traitIds: string[];
}

/**
 * JSON structure for bundled traits data file
 */
export interface TraitsDataFile {
  version: string;
  build: 'GRCh38' | 'GRCh37';
  lastUpdated: string;
  traits: EnhancedTraitRecord[];
  genes: TraitGeneRecord[];
}

/**
 * Indexed database for efficient lookups
 */
export interface TraitsDatabase {
  traits: Map<string, EnhancedTraitRecord>;
  genes: Map<string, TraitGeneRecord>;
  traitsByChromosome: Map<string, EnhancedTraitRecord[]>;
  genesByChromosome: Map<string, TraitGeneRecord[]>;
  traitsByCategory: Map<TraitCategory, EnhancedTraitRecord[]>;
}
