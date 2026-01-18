/**
 * Ancestry data loader
 * Loads and indexes ancestry composition and segment data
 */

import type {
  AncestrySegment,
  AncestryComposition,
  GeneticProfile,
  AncestryCategory,
  AncestryPopulation,
  ParentOfOrigin,
} from '@/types/genome';
import ancestryData from './ancestryDemo.json';

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
  segmentsByParent.set('unphased', []);

  for (const segment of segments) {
    segmentsByParent.get(segment.parent)!.push(segment);
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
 */
export function getAncestryComposition(): AncestryComposition[] {
  initializeAncestry();
  return profile?.ancestryComposition || [];
}

/**
 * Get all ancestry segments for a chromosome
 */
export function getAncestrySegmentsForChromosome(
  chromosome: string
): AncestrySegment[] {
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
 */
export function isPhased(): boolean {
  initializeAncestry();
  return profile?.isPhased || false;
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
