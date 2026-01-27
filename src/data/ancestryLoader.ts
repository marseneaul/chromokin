/**
 * Ancestry data loader
 * Loads and indexes ancestry composition and segment data
 * Supports both demo data and user-uploaded data
 */

import type {
  AncestrySegment,
  AncestryComposition,
  GeneticProfile,
  AncestryCategory,
  AncestryPopulation,
  ParentOfOrigin,
} from '@/types/genome';
import { useAppStore, type UserAncestryData } from '@/state/appState';
import ancestryData from './ancestryDemo.json';

/**
 * Get user ancestry data from app state (if available)
 */
function getUserAncestryData(): UserAncestryData | null {
  return useAppStore.getState().userAncestryData;
}

interface RawSegment {
  chromosome: string;
  start: number;
  end: number;
  population: string;
  category: string;
  confidence: number;
  parent: string;
}

interface RawComposition {
  population: string;
  category: string;
  percentage: number;
  displayName: string;
}

interface RawProfile {
  id: string;
  name: string;
  source: string;
  buildVersion: string;
  isPhased: boolean;
  createdAt: string;
}

interface AncestryDataFile {
  profile: RawProfile;
  composition: RawComposition[];
  segments: RawSegment[];
}

// Type assertion for imported JSON
const rawData = ancestryData as AncestryDataFile;

// Indexed data
let profile: GeneticProfile | null = null;
let segmentsByChromosome: Map<string, AncestrySegment[]> | null = null;
let segmentsByParent: Map<ParentOfOrigin, AncestrySegment[]> | null = null;

/**
 * Initialize the ancestry data
 */
function initializeAncestry(): void {
  if (profile) return;

  // Parse segments
  const segments: AncestrySegment[] = rawData.segments.map(seg => ({
    chromosome: seg.chromosome,
    start: seg.start,
    end: seg.end,
    population: seg.population as AncestryPopulation,
    category: seg.category as AncestryCategory,
    confidence: seg.confidence,
    parent: seg.parent as ParentOfOrigin,
  }));

  // Parse composition
  const composition: AncestryComposition[] = rawData.composition.map(comp => ({
    population: comp.population as AncestryPopulation,
    category: comp.category as AncestryCategory,
    percentage: comp.percentage,
    displayName: comp.displayName,
  }));

  // Create profile
  profile = {
    id: rawData.profile.id,
    name: rawData.profile.name,
    source: rawData.profile.source as '23andme' | 'ancestry' | 'other',
    buildVersion: rawData.profile.buildVersion as 'GRCh37' | 'GRCh38',
    ancestryComposition: composition,
    ancestrySegments: segments,
    isPhased: rawData.profile.isPhased,
    createdAt: rawData.profile.createdAt,
  };

  // Index by chromosome
  segmentsByChromosome = new Map();
  for (const segment of segments) {
    if (!segmentsByChromosome.has(segment.chromosome)) {
      segmentsByChromosome.set(segment.chromosome, []);
    }
    segmentsByChromosome.get(segment.chromosome)!.push(segment);
  }

  // Sort by position within each chromosome
  for (const segs of segmentsByChromosome.values()) {
    segs.sort((a, b) => a.start - b.start);
  }

  // Index by parent
  segmentsByParent = new Map();
  segmentsByParent.set('maternal', []);
  segmentsByParent.set('paternal', []);
  segmentsByParent.set('haplotypeA', []);
  segmentsByParent.set('haplotypeB', []);
  segmentsByParent.set('unphased', []);

  for (const segment of segments) {
    if (segmentsByParent.has(segment.parent)) {
      segmentsByParent.get(segment.parent)!.push(segment);
    }
  }
}

/**
 * Get the current genetic profile
 */
export function getGeneticProfile(): GeneticProfile | null {
  initializeAncestry();
  return profile;
}

/**
 * Get ancestry composition (overall percentages)
 * Returns user data if available, otherwise demo data
 */
export function getAncestryComposition(): AncestryComposition[] {
  const userData = getUserAncestryData();
  if (userData) {
    return userData.composition;
  }
  initializeAncestry();
  return profile?.ancestryComposition || [];
}

/**
 * Check if user ancestry data is loaded
 */
export function hasUserAncestryData(): boolean {
  return getUserAncestryData() !== null;
}

/**
 * Get all ancestry segments for a chromosome
 * Returns user data if available, otherwise demo data
 */
export function getAncestrySegmentsForChromosome(
  chromosome: string
): AncestrySegment[] {
  const userData = getUserAncestryData();
  if (userData) {
    return userData.segmentsByChromosome.get(chromosome) || [];
  }
  initializeAncestry();
  return segmentsByChromosome?.get(chromosome) || [];
}

/**
 * Get ancestry segments in a specific range
 */
export function getAncestrySegmentsInRange(
  chromosome: string,
  start: number,
  end: number,
  parent?: ParentOfOrigin
): AncestrySegment[] {
  const segments = getAncestrySegmentsForChromosome(chromosome);
  let filtered = segments.filter(seg => seg.end > start && seg.start < end);

  if (parent) {
    filtered = filtered.filter(seg => seg.parent === parent);
  }

  return filtered;
}

/**
 * Get maternal segments for a chromosome
 */
export function getMaternalSegments(chromosome: string): AncestrySegment[] {
  return getAncestrySegmentsForChromosome(chromosome).filter(
    seg => seg.parent === 'maternal'
  );
}

/**
 * Get paternal segments for a chromosome
 */
export function getPaternalSegments(chromosome: string): AncestrySegment[] {
  return getAncestrySegmentsForChromosome(chromosome).filter(
    seg => seg.parent === 'paternal'
  );
}

/**
 * Check if the data is phased
 * Returns true if user data has phased haplotypes or if demo profile is phased
 */
export function isPhased(): boolean {
  const userData = getUserAncestryData();
  if (userData) {
    return userData.isPhased || false;
  }
  initializeAncestry();
  return profile?.isPhased || false;
}

/**
 * Get haplotype A segments for a chromosome (phased data)
 */
export function getHaplotypeASegments(chromosome: string): AncestrySegment[] {
  const userData = getUserAncestryData();
  if (userData && userData.isPhased && userData.haplotypeAByChromosome) {
    return userData.haplotypeAByChromosome.get(chromosome) || [];
  }
  // Fall back to filtering from all segments
  return getAncestrySegmentsForChromosome(chromosome).filter(
    seg => seg.parent === 'haplotypeA'
  );
}

/**
 * Get haplotype B segments for a chromosome (phased data)
 */
export function getHaplotypeBSegments(chromosome: string): AncestrySegment[] {
  const userData = getUserAncestryData();
  if (userData && userData.isPhased && userData.haplotypeBByChromosome) {
    return userData.haplotypeBByChromosome.get(chromosome) || [];
  }
  // Fall back to filtering from all segments
  return getAncestrySegmentsForChromosome(chromosome).filter(
    seg => seg.parent === 'haplotypeB'
  );
}

/**
 * Get haplotype-specific ancestry composition
 */
export function getHaplotypeComposition(
  haplotype: 'A' | 'B'
): AncestryComposition[] {
  const userData = getUserAncestryData();
  if (userData && userData.isPhased) {
    if (haplotype === 'A' && userData.haplotypeAComposition) {
      return userData.haplotypeAComposition;
    }
    if (haplotype === 'B' && userData.haplotypeBComposition) {
      return userData.haplotypeBComposition;
    }
  }
  return [];
}

/**
 * Get ancestry at a specific position
 */
export function getAncestryAtPosition(
  chromosome: string,
  position: number,
  parent?: ParentOfOrigin
): AncestrySegment | null {
  const segments = getAncestrySegmentsForChromosome(chromosome);

  for (const segment of segments) {
    if (position >= segment.start && position < segment.end) {
      if (!parent || segment.parent === parent) {
        return segment;
      }
    }
  }

  return null;
}

/**
 * Calculate ancestry percentage for a specific chromosome
 */
export function getChromosomeAncestryBreakdown(
  chromosome: string
): Map<AncestryCategory, { maternal: number; paternal: number }> {
  const segments = getAncestrySegmentsForChromosome(chromosome);
  const breakdown = new Map<
    AncestryCategory,
    { maternal: number; paternal: number }
  >();

  // Calculate total length for each parent
  let maternalTotal = 0;
  let paternalTotal = 0;

  for (const segment of segments) {
    const length = segment.end - segment.start;
    if (segment.parent === 'maternal') {
      maternalTotal += length;
    } else if (segment.parent === 'paternal') {
      paternalTotal += length;
    }
  }

  // Calculate percentages
  for (const segment of segments) {
    const length = segment.end - segment.start;
    const category = segment.category;

    if (!breakdown.has(category)) {
      breakdown.set(category, { maternal: 0, paternal: 0 });
    }

    const entry = breakdown.get(category)!;
    if (segment.parent === 'maternal' && maternalTotal > 0) {
      entry.maternal += (length / maternalTotal) * 100;
    } else if (segment.parent === 'paternal' && paternalTotal > 0) {
      entry.paternal += (length / paternalTotal) * 100;
    }
  }

  return breakdown;
}

// Display name mapping for ancestry categories
const CATEGORY_DISPLAY_NAMES: Record<AncestryCategory, string> = {
  european: 'European',
  east_asian: 'East Asian',
  african: 'African',
  native_american: 'Native American',
  middle_eastern: 'Middle Eastern',
  south_asian: 'South Asian',
  oceanian: 'Oceanian',
  archaic: 'Archaic',
  unassigned: 'Unassigned',
};

/**
 * Get ancestry composition for a specific chromosome
 * Returns percentages based on segment lengths on that chromosome
 */
export function getChromosomeAncestryComposition(
  chromosome: string
): AncestryComposition[] {
  const segments = getAncestrySegmentsForChromosome(chromosome);

  if (segments.length === 0) {
    return [];
  }

  // Calculate total length and length per category
  let totalLength = 0;
  const categoryLengths = new Map<AncestryCategory, number>();

  for (const segment of segments) {
    const length = segment.end - segment.start;
    totalLength += length;

    const current = categoryLengths.get(segment.category) || 0;
    categoryLengths.set(segment.category, current + length);
  }

  if (totalLength === 0) {
    return [];
  }

  // Convert to AncestryComposition array
  const composition: AncestryComposition[] = [];

  for (const [category, length] of categoryLengths.entries()) {
    const percentage = (length / totalLength) * 100;
    if (percentage >= 0.5) {
      // Only include >= 0.5%
      composition.push({
        population: category as unknown as AncestryPopulation, // Use category as population for color mapping
        category,
        percentage,
        displayName: CATEGORY_DISPLAY_NAMES[category] || category,
      });
    }
  }

  // Sort by percentage descending
  return composition.sort((a, b) => b.percentage - a.percentage);
}
