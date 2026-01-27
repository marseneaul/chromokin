/**
 * Type definitions for genome data:
 * - Cytobands (chromosome banding patterns)
 * - Ancestry segments (23andMe-style chromosome painting)
 * - SNP genotypes
 */

/**
 * Cytoband stain types - determine the visual appearance
 * gneg = light (no Giemsa stain)
 * gpos = dark bands (25/50/75/100 = intensity)
 * acen = centromere (red)
 * gvar = variable heterochromatin
 * stalk = stalk regions (acrocentric chromosomes)
 */
export type CytobandStain =
  | 'gneg'
  | 'gpos25'
  | 'gpos50'
  | 'gpos75'
  | 'gpos100'
  | 'acen'
  | 'gvar'
  | 'stalk';

/**
 * Cytoband data from UCSC
 */
export interface Cytoband {
  chrom: string; // e.g., "chr1"
  chromStart: number;
  chromEnd: number;
  name: string; // e.g., "p36.33", "q21.1"
  stain: CytobandStain;
}

/**
 * Ancestry population categories
 * Based on typical 23andMe/AncestryDNA population groupings
 */
export type AncestryPopulation =
  // European
  | 'british_irish'
  | 'french_german'
  | 'scandinavian'
  | 'finnish'
  | 'eastern_european'
  | 'southern_european'
  | 'ashkenazi_jewish'
  | 'european_other'
  // East Asian
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'southeast_asian'
  | 'east_asian_other'
  // African
  | 'west_african'
  | 'east_african'
  | 'north_african'
  | 'african_other'
  // Americas
  | 'native_american'
  | 'mexican'
  | 'caribbean'
  | 'south_american'
  // Middle Eastern
  | 'middle_eastern'
  | 'north_african_middle_eastern'
  // South Asian
  | 'south_asian'
  | 'bengali'
  | 'punjabi'
  // Oceanian
  | 'melanesian'
  | 'polynesian'
  // Archaic
  | 'neanderthal'
  | 'denisovan'
  // Other
  | 'unassigned'
  | 'unknown';

/**
 * Broad ancestry category for grouping
 */
export type AncestryCategory =
  | 'european'
  | 'east_asian'
  | 'african'
  | 'native_american'
  | 'middle_eastern'
  | 'south_asian'
  | 'oceanian'
  | 'archaic'
  | 'unassigned';

/**
 * Parent of origin for phased data
 */
export type ParentOfOrigin = 'maternal' | 'paternal' | 'unphased';

/**
 * A single ancestry segment on a chromosome
 * Matches the format used by 23andMe chromosome painting
 */
export interface AncestrySegment {
  chromosome: string;
  start: number;
  end: number;
  population: AncestryPopulation;
  category: AncestryCategory;
  confidence: number; // 0-1
  parent: ParentOfOrigin;
  // Optional sub-population from 1000 Genomes reference panel (e.g., 'GBR', 'TSI')
  subPopulation?: string;
  subPopulationName?: string;
  subPopulationConfidence?: number;
}

/**
 * Overall ancestry composition percentages
 */
export interface AncestryComposition {
  population: AncestryPopulation;
  category: AncestryCategory;
  percentage: number;
  displayName: string;
}

/**
 * SNP genotype from raw data file (23andMe format)
 * Example: rs12345, 1, 752566, AG
 */
export interface SNPGenotype {
  rsid: string;
  chromosome: string;
  position: number;
  genotype: string; // e.g., "AA", "AG", "GG", "--" for no-call
}

/**
 * Category of SNP for display purposes
 */
export type SNPCategory =
  | 'trait' // Associated with physical traits
  | 'health' // Health/disease risk
  | 'pharmacogenomics' // Drug response
  | 'neanderthal' // Inherited from Neanderthals
  | 'ancestry' // Ancestry-informative marker
  | 'other'; // Other interesting variants

/**
 * Extended SNP with annotation data for display
 */
export interface AnnotatedSNP extends SNPGenotype {
  // Display info
  name?: string; // Friendly name, e.g., "Eye Color Variant"
  gene?: string; // Associated gene symbol
  category: SNPCategory;

  // What this variant means
  traitAssociation?: string; // e.g., "Blue eyes", "Increased caffeine metabolism"
  riskAllele?: string; // The allele associated with trait/risk
  effectAllele?: string; // Alternative name for risk allele

  // User's status
  hasRiskAllele?: boolean; // Does the user carry the effect allele?
  isHomozygous?: boolean; // Is user homozygous for effect?

  // Population info
  globalFrequency?: number; // How common is this variant globally (0-1)
  isRare?: boolean; // Is this variant rare (<1%)?

  // Additional context
  funFact?: string; // Interesting tidbit for laypeople
  clinicalSignificance?: string; // ClinVar significance if applicable

  // Source/confidence
  confidence: 'high' | 'moderate' | 'low';
  source?: string; // e.g., "GWAS Catalog", "ClinVar"
}

/**
 * SNP color scheme by category
 */
export const SNP_COLORS: Record<SNPCategory, string> = {
  trait: '#8b5cf6', // Purple - physical traits
  health: '#ef4444', // Red - health related
  pharmacogenomics: '#f59e0b', // Amber - drug response
  neanderthal: '#6b7280', // Gray - archaic
  ancestry: '#3b82f6', // Blue - ancestry markers
  other: '#10b981', // Green - other interesting
};

/**
 * A user's complete genetic profile
 */
export interface GeneticProfile {
  id: string;
  name: string;
  source: '23andme' | 'ancestry' | 'other';
  buildVersion: 'GRCh37' | 'GRCh38';

  // Ancestry data
  ancestryComposition: AncestryComposition[];
  ancestrySegments: AncestrySegment[];

  // Raw genotypes (optional, can be large)
  snpCount?: number;
  snps?: Map<string, SNPGenotype>; // keyed by rsid

  // Metadata
  isPhased: boolean;
  createdAt: string;
}

/**
 * Color palette for ancestry categories
 */
export const ANCESTRY_COLORS: Record<AncestryCategory, string> = {
  european: '#4f86c6', // Blue
  east_asian: '#f0b323', // Gold/Yellow
  african: '#2d8659', // Green
  native_american: '#c9462c', // Terracotta/Red
  middle_eastern: '#9b59b6', // Purple
  south_asian: '#e67e22', // Orange
  oceanian: '#1abc9c', // Teal
  archaic: '#7f8c8d', // Gray
  unassigned: '#bdc3c7', // Light gray
};

/**
 * More specific colors for detailed populations
 */
export const POPULATION_COLORS: Record<AncestryPopulation, string> = {
  // European - shades of blue
  british_irish: '#3498db',
  french_german: '#5dade2',
  scandinavian: '#85c1e9',
  finnish: '#aed6f1',
  eastern_european: '#2874a6',
  southern_european: '#1a5276',
  ashkenazi_jewish: '#6c8ebf',
  european_other: '#4f86c6',

  // East Asian - shades of gold/yellow
  chinese: '#f1c40f',
  japanese: '#f4d03f',
  korean: '#f7dc6f',
  southeast_asian: '#d4ac0d',
  east_asian_other: '#f0b323',

  // African - shades of green
  west_african: '#27ae60',
  east_african: '#2ecc71',
  north_african: '#58d68d',
  african_other: '#2d8659',

  // Americas - shades of red/terracotta
  native_american: '#c0392b',
  mexican: '#e74c3c',
  caribbean: '#ec7063',
  south_american: '#c9462c',

  // Middle Eastern - purple
  middle_eastern: '#8e44ad',
  north_african_middle_eastern: '#9b59b6',

  // South Asian - orange
  south_asian: '#d35400',
  bengali: '#e67e22',
  punjabi: '#f39c12',

  // Oceanian - teal
  melanesian: '#16a085',
  polynesian: '#1abc9c',

  // Archaic - gray
  neanderthal: '#5d6d7e',
  denisovan: '#7f8c8d',

  // Other
  unassigned: '#bdc3c7',
  unknown: '#95a5a6',
};

/**
 * Display names for populations
 */
export const POPULATION_DISPLAY_NAMES: Record<AncestryPopulation, string> = {
  british_irish: 'British & Irish',
  french_german: 'French & German',
  scandinavian: 'Scandinavian',
  finnish: 'Finnish',
  eastern_european: 'Eastern European',
  southern_european: 'Southern European',
  ashkenazi_jewish: 'Ashkenazi Jewish',
  european_other: 'Broadly European',

  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  southeast_asian: 'Southeast Asian',
  east_asian_other: 'Broadly East Asian',

  west_african: 'West African',
  east_african: 'East African',
  north_african: 'North African',
  african_other: 'Broadly African',

  native_american: 'Native American',
  mexican: 'Indigenous Mexican',
  caribbean: 'Caribbean',
  south_american: 'Indigenous South American',

  middle_eastern: 'Middle Eastern',
  north_african_middle_eastern: 'North African & Middle Eastern',

  south_asian: 'South Asian',
  bengali: 'Bengali',
  punjabi: 'Punjabi',

  melanesian: 'Melanesian',
  polynesian: 'Polynesian',

  neanderthal: 'Neanderthal',
  denisovan: 'Denisovan',

  unassigned: 'Unassigned',
  unknown: 'Unknown',
};

/**
 * Cytoband stain colors
 */
export const CYTOBAND_COLORS: Record<CytobandStain, string> = {
  gneg: '#ffffff', // White
  gpos25: '#c0c0c0', // Light gray
  gpos50: '#808080', // Medium gray
  gpos75: '#404040', // Dark gray
  gpos100: '#000000', // Black
  acen: '#cc3333', // Red (centromere)
  gvar: '#dcdcdc', // Variable (light)
  stalk: '#708090', // Slate gray (stalk)
};
