/**
 * Local Ancestry Inference
 *
 * Assigns ancestry to chromosomal segments using a sliding window approach.
 * This is a simplified version of methods like RFMix/LAMP, suitable for
 * unphased consumer genotyping data.
 *
 * Algorithm:
 * 1. For each chromosome, get AIMs sorted by position
 * 2. Slide a window across the chromosome
 * 3. Calculate ancestry likelihood for AIMs in each window
 * 4. Assign most likely ancestry to segment
 * 5. Merge adjacent segments with same ancestry
 * 6. Filter out small segments (noise)
 */

import type {
  SNPGenotype,
  AncestrySegment,
  AncestryCategory,
} from '@/types/genome';
import type { ParsedSNPFile } from './snpFileParser';
import type { InferencePopulation } from './ancestryInference';
import aimsData from './ancestryAIMs_expanded.json';

// Chromosome lengths in GRCh37 (bp)
const CHROMOSOME_LENGTHS_GRCH37: Record<string, number> = {
  '1': 249250621,
  '2': 243199373,
  '3': 198022430,
  '4': 191154276,
  '5': 180915260,
  '6': 171115067,
  '7': 159138663,
  '8': 146364022,
  '9': 141213431,
  '10': 135534747,
  '11': 135006516,
  '12': 133851895,
  '13': 115169878,
  '14': 107349540,
  '15': 102531392,
  '16': 90354753,
  '17': 81195210,
  '18': 78077248,
  '19': 59128983,
  '20': 63025520,
  '21': 48129895,
  '22': 51304566,
  X: 155270560,
  Y: 59373566,
};

// Map inference populations to ancestry categories
const POPULATION_TO_CATEGORY: Record<InferencePopulation, AncestryCategory> = {
  EUR: 'european',
  AFR: 'african',
  EAS: 'east_asian',
  SAS: 'south_asian',
  AMR: 'native_american',
};

// Map inference populations to display-friendly population names
const POPULATION_TO_NAME: Record<InferencePopulation, string> = {
  EUR: 'european_other',
  AFR: 'african_other',
  EAS: 'east_asian_other',
  SAS: 'south_asian',
  AMR: 'native_american',
};

interface AIMMarker {
  rsid: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  frequencies: Record<InferencePopulation, number>;
}

interface WindowResult {
  start: number;
  end: number;
  ancestry: InferencePopulation;
  confidence: number;
  markerCount: number;
  logLikelihoods: Record<InferencePopulation, number>;
}

interface LocalAncestryOptions {
  windowSize?: number; // Window size in bp (default: 5Mb)
  stepSize?: number; // Step size in bp (default: 2.5Mb)
  minMarkersPerWindow?: number; // Minimum AIMs required (default: 3)
  minSegmentSize?: number; // Minimum segment size in bp (default: 1Mb)
  minConfidence?: number; // Minimum confidence to assign ancestry (default: 0.5)
}

const DEFAULT_OPTIONS: Required<LocalAncestryOptions> = {
  windowSize: 25_000_000, // 25 Mb - larger to capture sparse markers
  stepSize: 10_000_000, // 10 Mb step
  minMarkersPerWindow: 1, // Allow single marker windows with sparse data
  minSegmentSize: 5_000_000, // 5 Mb minimum segment
  minConfidence: 0.3, // Lower threshold for sparse data
};

// Type the imported JSON
const aims = aimsData as {
  metadata: Record<string, unknown>;
  markers: AIMMarker[];
};

// Index AIMs by chromosome for fast lookup
let aimsByChromosome: Map<string, AIMMarker[]> | null = null;

function getAIMsByChromosome(): Map<string, AIMMarker[]> {
  if (aimsByChromosome) return aimsByChromosome;

  aimsByChromosome = new Map();

  for (const marker of aims.markers) {
    const chr = marker.chromosome.toUpperCase();
    if (!aimsByChromosome.has(chr)) {
      aimsByChromosome.set(chr, []);
    }
    aimsByChromosome.get(chr)!.push(marker);
  }

  // Sort by position within each chromosome
  for (const markers of aimsByChromosome.values()) {
    markers.sort((a, b) => a.position - b.position);
  }

  return aimsByChromosome;
}

/**
 * Calculate genotype likelihood given population frequency
 * Handles both diploid (XX, autosomal) and hemizygous (male X) genotypes
 */
function genotypeLikelihood(
  genotype: string,
  refAllele: string,
  altAllele: string,
  altFrequency: number
): number {
  if (
    genotype === '--' ||
    genotype === '00' ||
    genotype.includes('0') ||
    genotype === '-'
  ) {
    return 1.0; // Uninformative
  }

  const alleles = genotype.split('');

  // Bound frequency
  const q = Math.max(0.001, Math.min(0.999, altFrequency));
  const p = 1 - q;

  // Handle hemizygous calls (single allele, e.g., male X chromosome)
  if (alleles.length === 1) {
    const allele = alleles[0];
    if (allele === refAllele) {
      return p; // P(ref) = p
    } else if (allele === altAllele) {
      return q; // P(alt) = q
    } else {
      return 1.0; // Unknown allele
    }
  }

  // Handle diploid calls
  if (alleles.length !== 2) {
    return 1.0;
  }

  const [a1, a2] = alleles;

  // Count alleles
  let refCount = 0;
  let altCount = 0;
  if (a1 === refAllele) refCount++;
  if (a2 === refAllele) refCount++;
  if (a1 === altAllele) altCount++;
  if (a2 === altAllele) altCount++;

  if (refCount + altCount !== 2) {
    return 1.0; // Doesn't match expected alleles
  }

  if (refCount === 2) {
    return p * p;
  } else if (refCount === 1) {
    return 2 * p * q;
  } else {
    return q * q;
  }
}

/**
 * Calculate ancestry likelihoods for a set of markers
 */
function calculateWindowLikelihoods(
  markers: AIMMarker[],
  userSNPs: Map<string, SNPGenotype>
): {
  logLikelihoods: Record<InferencePopulation, number>;
  usedMarkers: number;
} {
  const populations: InferencePopulation[] = [
    'EUR',
    'AFR',
    'EAS',
    'SAS',
    'AMR',
  ];
  const logLikelihoods: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  let usedMarkers = 0;

  for (const marker of markers) {
    const userSNP = userSNPs.get(marker.rsid);
    if (!userSNP || userSNP.genotype === '--') continue;

    let isInformative = false;

    for (const pop of populations) {
      const altFreq = marker.frequencies[pop];
      const likelihood = genotypeLikelihood(
        userSNP.genotype,
        marker.ref,
        marker.alt,
        altFreq
      );

      if (likelihood > 0 && likelihood < 1) {
        logLikelihoods[pop] += Math.log(likelihood);
        isInformative = true;
      }
    }

    if (isInformative) {
      usedMarkers++;
    }
  }

  return { logLikelihoods, usedMarkers };
}

/**
 * Convert log-likelihoods to normalized probabilities
 */
function normalizeLikelihoods(
  logLikelihoods: Record<InferencePopulation, number>
): {
  ancestry: InferencePopulation;
  confidence: number;
  probabilities: Record<InferencePopulation, number>;
} {
  const populations: InferencePopulation[] = [
    'EUR',
    'AFR',
    'EAS',
    'SAS',
    'AMR',
  ];

  // Find max for numerical stability
  const maxLL = Math.max(...Object.values(logLikelihoods));

  // Convert to probabilities via softmax
  const expValues: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  let total = 0;
  for (const pop of populations) {
    expValues[pop] = Math.exp(logLikelihoods[pop] - maxLL);
    total += expValues[pop];
  }

  const probabilities: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  let maxProb = 0;
  let bestAncestry: InferencePopulation = 'EUR';

  for (const pop of populations) {
    probabilities[pop] = expValues[pop] / total;
    if (probabilities[pop] > maxProb) {
      maxProb = probabilities[pop];
      bestAncestry = pop;
    }
  }

  return {
    ancestry: bestAncestry,
    confidence: maxProb,
    probabilities,
  };
}

/**
 * Infer local ancestry for a single chromosome
 * Uses adaptive approach: window-based when markers are dense enough,
 * falls back to whole-chromosome inference when sparse.
 */
function inferChromosomeAncestry(
  chromosome: string,
  userSNPs: Map<string, SNPGenotype>,
  options: Required<LocalAncestryOptions>
): WindowResult[] {
  const aimsByChr = getAIMsByChromosome();
  const chrAIMs = aimsByChr.get(chromosome.toUpperCase()) || [];

  if (chrAIMs.length === 0) {
    return [];
  }

  const chrLength = CHROMOSOME_LENGTHS_GRCH37[chromosome] || 250_000_000;
  const windows: WindowResult[] = [];

  // Try window-based approach first
  for (let start = 0; start < chrLength; start += options.stepSize) {
    const end = Math.min(start + options.windowSize, chrLength);

    // Get AIMs in this window
    const windowAIMs = chrAIMs.filter(
      m => m.position >= start && m.position < end
    );

    if (windowAIMs.length < options.minMarkersPerWindow) {
      continue; // Not enough markers
    }

    // Calculate likelihoods
    const { logLikelihoods, usedMarkers } = calculateWindowLikelihoods(
      windowAIMs,
      userSNPs
    );

    if (usedMarkers < options.minMarkersPerWindow) {
      continue;
    }

    // Normalize to get ancestry call
    const { ancestry, confidence } = normalizeLikelihoods(logLikelihoods);

    windows.push({
      start,
      end,
      ancestry,
      confidence,
      markerCount: usedMarkers,
      logLikelihoods,
    });
  }

  // If window-based approach yielded poor coverage, try whole-chromosome approach
  // This uses all markers on the chromosome to make a single call
  if (windows.length === 0 && chrAIMs.length >= 1) {
    const { logLikelihoods, usedMarkers } = calculateWindowLikelihoods(
      chrAIMs,
      userSNPs
    );
    if (usedMarkers >= 1) {
      const { ancestry, confidence } = normalizeLikelihoods(logLikelihoods);
      // Create a single segment for the whole chromosome
      // Lower the effective confidence threshold for whole-chromosome fallback
      // since we want to show something even with sparse markers
      const adjustedConfidence = confidence * (usedMarkers >= 3 ? 1.0 : 0.7);
      windows.push({
        start: 0,
        end: chrLength,
        ancestry,
        confidence: adjustedConfidence,
        markerCount: usedMarkers,
        logLikelihoods,
      });
    }
  }

  return windows;
}

/**
 * Merge adjacent windows with same ancestry into segments
 */
function mergeWindows(
  windows: WindowResult[],
  minSegmentSize: number,
  minConfidence: number
): Array<{
  start: number;
  end: number;
  ancestry: InferencePopulation;
  confidence: number;
}> {
  if (windows.length === 0) return [];

  // Filter by confidence
  const confidentWindows = windows.filter(w => w.confidence >= minConfidence);
  if (confidentWindows.length === 0) return [];

  // Sort by position
  confidentWindows.sort((a, b) => a.start - b.start);

  // Merge adjacent windows with same ancestry
  const segments: Array<{
    start: number;
    end: number;
    ancestry: InferencePopulation;
    confidenceSum: number;
    count: number;
  }> = [];

  let current = {
    start: confidentWindows[0].start,
    end: confidentWindows[0].end,
    ancestry: confidentWindows[0].ancestry,
    confidenceSum: confidentWindows[0].confidence,
    count: 1,
  };

  for (let i = 1; i < confidentWindows.length; i++) {
    const window = confidentWindows[i];

    // Check if this window continues the current segment
    // (same ancestry and overlapping/adjacent)
    if (
      window.ancestry === current.ancestry &&
      window.start <= current.end + 1_000_000 // Allow 1Mb gap
    ) {
      // Extend current segment
      current.end = Math.max(current.end, window.end);
      current.confidenceSum += window.confidence;
      current.count++;
    } else {
      // Save current segment and start new one
      segments.push(current);
      current = {
        start: window.start,
        end: window.end,
        ancestry: window.ancestry,
        confidenceSum: window.confidence,
        count: 1,
      };
    }
  }

  // Don't forget the last segment
  segments.push(current);

  // Filter by minimum size and calculate average confidence
  return segments
    .filter(s => s.end - s.start >= minSegmentSize)
    .map(s => ({
      start: s.start,
      end: s.end,
      ancestry: s.ancestry,
      confidence: s.confidenceSum / s.count,
    }));
}

/**
 * Fill gaps between segments
 */
function fillGaps(
  segments: Array<{
    start: number;
    end: number;
    ancestry: InferencePopulation;
    confidence: number;
  }>,
  chromosomeLength: number
): Array<{
  start: number;
  end: number;
  ancestry: InferencePopulation;
  confidence: number;
}> {
  if (segments.length === 0) return [];

  const result: typeof segments = [];

  // Sort by position
  segments.sort((a, b) => a.start - b.start);

  // Handle gap at start
  if (segments[0].start > 0) {
    result.push({
      start: 0,
      end: segments[0].start,
      ancestry: segments[0].ancestry, // Extend first segment backward
      confidence: segments[0].confidence * 0.5, // Lower confidence for extrapolation
    });
  }

  // Add segments and fill gaps
  for (let i = 0; i < segments.length; i++) {
    result.push(segments[i]);

    if (i < segments.length - 1) {
      const gap = segments[i + 1].start - segments[i].end;
      if (gap > 0) {
        // Fill gap - assign to whichever neighbor has higher confidence
        const prevConf = segments[i].confidence;
        const nextConf = segments[i + 1].confidence;
        const ancestry =
          prevConf >= nextConf
            ? segments[i].ancestry
            : segments[i + 1].ancestry;

        result.push({
          start: segments[i].end,
          end: segments[i + 1].start,
          ancestry,
          confidence: Math.min(prevConf, nextConf) * 0.5,
        });
      }
    }
  }

  // Handle gap at end
  const lastSegment = segments[segments.length - 1];
  if (lastSegment.end < chromosomeLength) {
    result.push({
      start: lastSegment.end,
      end: chromosomeLength,
      ancestry: lastSegment.ancestry,
      confidence: lastSegment.confidence * 0.5,
    });
  }

  // Merge any adjacent segments with same ancestry that resulted from gap filling
  return mergeAdjacentSameAncestry(result);
}

/**
 * Merge adjacent segments with same ancestry
 */
function mergeAdjacentSameAncestry(
  segments: Array<{
    start: number;
    end: number;
    ancestry: InferencePopulation;
    confidence: number;
  }>
): Array<{
  start: number;
  end: number;
  ancestry: InferencePopulation;
  confidence: number;
}> {
  if (segments.length <= 1) return segments;

  const result: typeof segments = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    if (segments[i].ancestry === current.ancestry) {
      // Merge
      current.end = segments[i].end;
      current.confidence = (current.confidence + segments[i].confidence) / 2;
    } else {
      result.push(current);
      current = { ...segments[i] };
    }
  }

  result.push(current);
  return result;
}

/**
 * Convert internal segment format to AncestrySegment type
 */
function toAncestrySegments(
  chromosome: string,
  segments: Array<{
    start: number;
    end: number;
    ancestry: InferencePopulation;
    confidence: number;
  }>
): AncestrySegment[] {
  return segments.map(seg => ({
    chromosome,
    start: seg.start,
    end: seg.end,
    population: POPULATION_TO_NAME[
      seg.ancestry
    ] as AncestrySegment['population'],
    category: POPULATION_TO_CATEGORY[seg.ancestry],
    confidence: seg.confidence,
    parent: 'unphased' as const, // We can't determine parent without phased data
  }));
}

export interface LocalAncestryResult {
  segments: AncestrySegment[];
  segmentsByChromosome: Map<string, AncestrySegment[]>;
  summary: {
    totalSegments: number;
    chromosomesProcessed: number;
    averageConfidence: number;
    ancestryBreakdown: Record<InferencePopulation, number>; // Percentage by genome length
  };
}

/**
 * Infer local ancestry across all chromosomes
 */
export function inferLocalAncestry(
  parsedFile: ParsedSNPFile,
  options: LocalAncestryOptions = {}
): LocalAncestryResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chromosomes = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    'X',
  ];

  const allSegments: AncestrySegment[] = [];
  const segmentsByChromosome = new Map<string, AncestrySegment[]>();

  let totalConfidence = 0;
  let segmentCount = 0;
  const ancestryLengths: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };
  let totalLength = 0;

  for (const chr of chromosomes) {
    const chrLength = CHROMOSOME_LENGTHS_GRCH37[chr];
    if (!chrLength) continue;

    // Get window results
    const windows = inferChromosomeAncestry(chr, parsedFile.snps, opts);

    // Merge into segments
    let segments = mergeWindows(
      windows,
      opts.minSegmentSize,
      opts.minConfidence
    );

    // If no segments after merging (all below confidence threshold),
    // take the best window and use it for the whole chromosome
    if (segments.length === 0 && windows.length > 0) {
      // Find window with highest confidence
      const bestWindow = windows.reduce(
        (best, w) => (w.confidence > best.confidence ? w : best),
        windows[0]
      );

      segments = [
        {
          start: 0,
          end: chrLength,
          ancestry: bestWindow.ancestry,
          confidence: bestWindow.confidence * 0.8, // Slightly lower confidence for fallback
        },
      ];
    }

    // Fill gaps to cover entire chromosome
    segments = fillGaps(segments, chrLength);

    // Convert to AncestrySegment format
    const ancestrySegments = toAncestrySegments(chr, segments);

    segmentsByChromosome.set(chr, ancestrySegments);
    allSegments.push(...ancestrySegments);

    // Update stats
    for (const seg of segments) {
      totalConfidence += seg.confidence;
      segmentCount++;
      ancestryLengths[seg.ancestry] += seg.end - seg.start;
      totalLength += seg.end - seg.start;
    }
  }

  // Calculate ancestry breakdown as percentages
  const ancestryBreakdown: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  if (totalLength > 0) {
    for (const pop of Object.keys(ancestryLengths) as InferencePopulation[]) {
      ancestryBreakdown[pop] = (ancestryLengths[pop] / totalLength) * 100;
    }
  }

  return {
    segments: allSegments,
    segmentsByChromosome,
    summary: {
      totalSegments: segmentCount,
      chromosomesProcessed: segmentsByChromosome.size,
      averageConfidence: segmentCount > 0 ? totalConfidence / segmentCount : 0,
      ancestryBreakdown,
    },
  };
}

/**
 * Convenience function to infer local ancestry from SNP map
 */
export function inferLocalAncestryFromSNPs(
  snps: Map<string, SNPGenotype>,
  options: LocalAncestryOptions = {}
): LocalAncestryResult {
  const parsedFile: ParsedSNPFile = {
    source: 'unknown',
    buildVersion: 'GRCh37',
    snpCount: snps.size,
    snps,
    metadata: {},
  };

  return inferLocalAncestry(parsedFile, options);
}
