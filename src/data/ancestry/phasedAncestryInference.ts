/**
 * Phased Ancestry Inference
 *
 * After phasing, this module runs ancestry inference separately on each
 * haplotype (Haplotype A and Haplotype B). This enables chromosome painting
 * similar to 23andMe, showing ancestry composition for each parental chromosome.
 *
 * Note: Without parental data, we cannot determine which haplotype is maternal
 * vs paternal. We label them as "Haplotype A" and "Haplotype B".
 */

import type {
  AncestrySegment,
  AncestryCategory,
  AncestryPopulation,
  AncestryComposition,
} from '@/types/genome';
import type { ParsedSNPFile } from './snpFileParser';
import type { PhasingResult } from './phasingInference';
import type {
  AncestryInferenceResult,
  InferencePopulation,
} from './ancestryInference';
import aimsData from './ancestryAIMs_expanded.json';

// Population codes
const POPULATIONS: InferencePopulation[] = ['EUR', 'AFR', 'EAS', 'SAS', 'AMR'];
const K = POPULATIONS.length;

// Recombination rate
const RECOMB_RATE_PER_BP = 1e-8;

// Log min probability
const LOG_MIN_PROB = -30;

// Map populations to display names and categories
const POPULATION_TO_CATEGORY: Record<InferencePopulation, AncestryCategory> = {
  EUR: 'european',
  AFR: 'african',
  EAS: 'east_asian',
  SAS: 'south_asian',
  AMR: 'native_american',
};

const POPULATION_TO_NAME: Record<InferencePopulation, AncestryPopulation> = {
  EUR: 'european_other',
  AFR: 'african_other',
  EAS: 'east_asian_other',
  SAS: 'south_asian',
  AMR: 'native_american',
};

// Type the imported JSON
const aims = aimsData as {
  metadata: Record<string, unknown>;
  markers: Array<{
    rsid: string;
    chromosome: string;
    position: number;
    ref: string;
    alt: string;
    frequencies: Record<InferencePopulation, number>;
  }>;
};

// Marker interface
interface AIMMarker {
  rsid: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  frequencies: Record<InferencePopulation, number>;
}

// Cached markers by chromosome
let markersByChromosome: Map<string, AIMMarker[]> | null = null;

// Chromosome lengths in GRCh37
const CHROMOSOME_LENGTHS: Record<string, number> = {
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

/**
 * Result of phased ancestry inference
 */
export interface PhasedAncestryResult {
  // Segments for each haplotype (labeled A and B since we can't determine maternal/paternal)
  haplotypeASegments: AncestrySegment[];
  haplotypeBSegments: AncestrySegment[];

  // Combined segments (for backward compatibility with unphased display)
  combinedSegments: AncestrySegment[];

  // Ancestry composition per haplotype
  haplotypeAComposition: AncestryComposition[];
  haplotypeBComposition: AncestryComposition[];

  // Combined composition
  combinedComposition: AncestryComposition[];

  // Segments organized by chromosome
  haplotypeAByChromosome: Map<string, AncestrySegment[]>;
  haplotypeBByChromosome: Map<string, AncestrySegment[]>;

  // Summary statistics
  summary: {
    totalSegmentsA: number;
    totalSegmentsB: number;
    chromosomesProcessed: number;
    markersUsed: number;
    phasingConfidence: number;
  };
}

function getMarkersByChromosome(): Map<string, AIMMarker[]> {
  if (markersByChromosome) return markersByChromosome;

  markersByChromosome = new Map();
  for (const marker of aims.markers) {
    const chr = marker.chromosome.toUpperCase();
    if (!markersByChromosome.has(chr)) {
      markersByChromosome.set(chr, []);
    }
    markersByChromosome.get(chr)!.push(marker);
  }

  // Sort by position
  for (const markers of markersByChromosome.values()) {
    markers.sort((a, b) => a.position - b.position);
  }

  return markersByChromosome;
}

function safeLog(x: number): number {
  return x > 0 ? Math.log(x) : LOG_MIN_PROB;
}

function logSumExp(a: number, b: number): number {
  if (a === LOG_MIN_PROB) return b;
  if (b === LOG_MIN_PROB) return a;
  const max = Math.max(a, b);
  return max + Math.log(Math.exp(a - max) + Math.exp(b - max));
}

function logSumExpArray(arr: Float64Array): number {
  let max = LOG_MIN_PROB;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  if (max === LOG_MIN_PROB) return LOG_MIN_PROB;

  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += Math.exp(arr[i] - max);
  }
  return max + Math.log(sum);
}

/**
 * Calculate log emission probability for a single haplotype allele
 */
function logEmissionProbabilityHaploid(
  allele: string,
  marker: AIMMarker,
  population: InferencePopulation
): number {
  if (!allele || allele === '9' || allele === '-') {
    return 0; // Uninformative
  }

  const altFreq = marker.frequencies[population];
  const p = Math.max(0.001, Math.min(0.999, 1 - altFreq)); // ref freq
  const q = 1 - p; // alt freq

  // Haploid probability
  if (allele === marker.ref) {
    return safeLog(p);
  } else if (allele === marker.alt) {
    return safeLog(q);
  }

  return 0; // Unknown allele
}

/**
 * Compute log transition matrix
 */
function computeLogTransitionMatrix(
  geneticDistance: number,
  logPriorProbs: Float64Array,
  out: Float64Array
): void {
  const recombProb = Math.min(0.5, geneticDistance * RECOMB_RATE_PER_BP);
  const logRecomb = safeLog(recombProb);
  const log1MinusRecomb = safeLog(1 - recombProb);

  for (let i = 0; i < K; i++) {
    for (let j = 0; j < K; j++) {
      if (i === j) {
        out[i * K + j] = logSumExp(
          log1MinusRecomb,
          logRecomb + logPriorProbs[j]
        );
      } else {
        out[i * K + j] = logRecomb + logPriorProbs[j];
      }
    }
  }
}

/**
 * Forward algorithm for a single haplotype
 */
function forwardLogHaploid(
  markers: AIMMarker[],
  alleles: string[],
  logPriorProbs: Float64Array
): Float64Array[] {
  const T = markers.length;
  const logAlpha: Float64Array[] = new Array(T);
  const transMatrix = new Float64Array(K * K);

  // Initialize
  logAlpha[0] = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    logAlpha[0][k] =
      logPriorProbs[k] +
      logEmissionProbabilityHaploid(alleles[0], markers[0], POPULATIONS[k]);
  }

  // Forward pass
  for (let t = 1; t < T; t++) {
    logAlpha[t] = new Float64Array(K);
    const geneticDistance = markers[t].position - markers[t - 1].position;

    computeLogTransitionMatrix(geneticDistance, logPriorProbs, transMatrix);

    for (let k = 0; k < K; k++) {
      let logSum = LOG_MIN_PROB;
      for (let j = 0; j < K; j++) {
        logSum = logSumExp(logSum, logAlpha[t - 1][j] + transMatrix[j * K + k]);
      }
      logAlpha[t][k] =
        logSum +
        logEmissionProbabilityHaploid(alleles[t], markers[t], POPULATIONS[k]);
    }
  }

  return logAlpha;
}

/**
 * Backward algorithm for a single haplotype
 */
function backwardLogHaploid(
  markers: AIMMarker[],
  alleles: string[],
  logPriorProbs: Float64Array
): Float64Array[] {
  const T = markers.length;
  const logBeta: Float64Array[] = new Array(T);
  const transMatrix = new Float64Array(K * K);

  // Initialize
  logBeta[T - 1] = new Float64Array(K);

  // Backward pass
  for (let t = T - 2; t >= 0; t--) {
    logBeta[t] = new Float64Array(K);
    const geneticDistance = markers[t + 1].position - markers[t].position;

    computeLogTransitionMatrix(geneticDistance, logPriorProbs, transMatrix);

    for (let k = 0; k < K; k++) {
      let logSum = LOG_MIN_PROB;
      for (let j = 0; j < K; j++) {
        logSum = logSumExp(
          logSum,
          transMatrix[k * K + j] +
            logEmissionProbabilityHaploid(
              alleles[t + 1],
              markers[t + 1],
              POPULATIONS[j]
            ) +
            logBeta[t + 1][j]
        );
      }
      logBeta[t][k] = logSum;
    }
  }

  return logBeta;
}

/**
 * Compute posteriors from forward-backward
 */
function computePosteriorsFromLog(
  logAlpha: Float64Array[],
  logBeta: Float64Array[]
): Float64Array[] {
  const T = logAlpha.length;
  const posteriors: Float64Array[] = new Array(T);
  const tempLog = new Float64Array(K);

  for (let t = 0; t < T; t++) {
    posteriors[t] = new Float64Array(K);

    for (let k = 0; k < K; k++) {
      tempLog[k] = logAlpha[t][k] + logBeta[t][k];
    }

    const logNorm = logSumExpArray(tempLog);
    for (let k = 0; k < K; k++) {
      posteriors[t][k] = Math.exp(tempLog[k] - logNorm);
    }
  }

  return posteriors;
}

/**
 * Convert posteriors to segments for a single haplotype
 */
function posteriorsToSegments(
  chromosome: string,
  markers: AIMMarker[],
  posteriors: Float64Array[],
  chromosomeLength: number,
  haplotypeLabel: 'haplotypeA' | 'haplotypeB'
): AncestrySegment[] {
  if (markers.length === 0) return [];

  const segments: AncestrySegment[] = [];
  let segmentStart = 0;
  let currentAncestry = -1;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (let t = 0; t < markers.length; t++) {
    let maxProb = 0;
    let maxState = 0;
    for (let k = 0; k < K; k++) {
      if (posteriors[t][k] > maxProb) {
        maxProb = posteriors[t][k];
        maxState = k;
      }
    }

    if (currentAncestry === -1) {
      currentAncestry = maxState;
      segmentStart = 0;
      confidenceSum = maxProb;
      confidenceCount = 1;
    } else if (maxState !== currentAncestry) {
      const segmentEnd = Math.round(
        (markers[t - 1].position + markers[t].position) / 2
      );

      segments.push({
        chromosome,
        start: segmentStart,
        end: segmentEnd,
        population: POPULATION_TO_NAME[POPULATIONS[currentAncestry]],
        category: POPULATION_TO_CATEGORY[POPULATIONS[currentAncestry]],
        confidence: confidenceSum / confidenceCount,
        parent: haplotypeLabel,
      });

      currentAncestry = maxState;
      segmentStart = segmentEnd;
      confidenceSum = maxProb;
      confidenceCount = 1;
    } else {
      confidenceSum += maxProb;
      confidenceCount++;
    }
  }

  // Final segment
  if (currentAncestry !== -1) {
    segments.push({
      chromosome,
      start: segmentStart,
      end: chromosomeLength,
      population: POPULATION_TO_NAME[POPULATIONS[currentAncestry]],
      category: POPULATION_TO_CATEGORY[POPULATIONS[currentAncestry]],
      confidence: confidenceSum / confidenceCount,
      parent: haplotypeLabel,
    });
  }

  return segments;
}

/**
 * Calculate ancestry composition from segments
 */
function calculateComposition(
  segments: AncestrySegment[]
): AncestryComposition[] {
  const totalLength = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  if (totalLength === 0) return [];

  const categoryLengths: Record<AncestryCategory, number> = {
    european: 0,
    african: 0,
    east_asian: 0,
    south_asian: 0,
    native_american: 0,
    middle_eastern: 0,
    oceanian: 0,
    archaic: 0,
    unassigned: 0,
  };

  for (const seg of segments) {
    const length = seg.end - seg.start;
    categoryLengths[seg.category] += length;
  }

  const displayNames: Record<AncestryCategory, string> = {
    european: 'European',
    african: 'African',
    east_asian: 'East Asian',
    south_asian: 'South Asian',
    native_american: 'Native American',
    middle_eastern: 'Middle Eastern',
    oceanian: 'Oceanian',
    archaic: 'Archaic',
    unassigned: 'Unassigned',
  };

  return Object.entries(categoryLengths)
    .filter(([_, length]) => length > 0)
    .map(([category, length]) => ({
      population: category as AncestryPopulation,
      category: category as AncestryCategory,
      percentage: Math.round((length / totalLength) * 1000) / 10,
      displayName: displayNames[category as AncestryCategory],
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Run ancestry inference on phased haplotypes
 *
 * @param parsedFile - Original parsed SNP file
 * @param phasingResult - Result from phaseUserGenotypes()
 * @param globalResult - Global ancestry result for prior
 */
export function inferPhasedAncestry(
  _parsedFile: ParsedSNPFile,
  phasingResult: PhasingResult,
  globalResult: AncestryInferenceResult
): PhasedAncestryResult {
  const markersByChr = getMarkersByChromosome();
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
  ];

  // Use global ancestry as prior
  const priorProbs = POPULATIONS.map(pop => globalResult.proportions[pop]);
  const priorSum = priorProbs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < priorProbs.length; i++) {
    priorProbs[i] = priorProbs[i] / priorSum;
  }

  const logPriorProbs = new Float64Array(K);
  for (let i = 0; i < K; i++) {
    logPriorProbs[i] = safeLog(priorProbs[i]);
  }

  const haplotypeASegments: AncestrySegment[] = [];
  const haplotypeBSegments: AncestrySegment[] = [];
  const combinedSegments: AncestrySegment[] = [];

  const haplotypeAByChromosome = new Map<string, AncestrySegment[]>();
  const haplotypeBByChromosome = new Map<string, AncestrySegment[]>();

  let totalMarkersUsed = 0;

  for (const chr of chromosomes) {
    const chrMarkers = markersByChr.get(chr) || [];
    const chrLength = CHROMOSOME_LENGTHS[chr] || 150000000;

    // Get available markers with phased genotypes
    const availableMarkers: AIMMarker[] = [];
    const allelesA: string[] = [];
    const allelesB: string[] = [];

    for (const m of chrMarkers) {
      const phased = phasingResult.phasedGenotypes.get(m.rsid);
      if (phased) {
        availableMarkers.push(m);
        allelesA.push(phased[0]);
        allelesB.push(phased[1]);
      }
    }

    if (availableMarkers.length < 2) {
      // Not enough markers - create single segment based on global ancestry
      const maxPriorIdx = priorProbs.indexOf(Math.max(...priorProbs));
      const defaultSegmentA: AncestrySegment = {
        chromosome: chr,
        start: 0,
        end: chrLength,
        population: POPULATION_TO_NAME[POPULATIONS[maxPriorIdx]],
        category: POPULATION_TO_CATEGORY[POPULATIONS[maxPriorIdx]],
        confidence: priorProbs[maxPriorIdx],
        parent: 'haplotypeA',
      };
      const defaultSegmentB: AncestrySegment = {
        ...defaultSegmentA,
        parent: 'haplotypeB',
      };
      const defaultCombined: AncestrySegment = {
        ...defaultSegmentA,
        parent: 'unphased',
      };

      haplotypeAByChromosome.set(chr, [defaultSegmentA]);
      haplotypeBByChromosome.set(chr, [defaultSegmentB]);
      haplotypeASegments.push(defaultSegmentA);
      haplotypeBSegments.push(defaultSegmentB);
      combinedSegments.push(defaultCombined);
      continue;
    }

    totalMarkersUsed += availableMarkers.length;

    // Run HMM on haplotype A
    const logAlphaA = forwardLogHaploid(
      availableMarkers,
      allelesA,
      logPriorProbs
    );
    const logBetaA = backwardLogHaploid(
      availableMarkers,
      allelesA,
      logPriorProbs
    );
    const posteriorsA = computePosteriorsFromLog(logAlphaA, logBetaA);
    const segmentsA = posteriorsToSegments(
      chr,
      availableMarkers,
      posteriorsA,
      chrLength,
      'haplotypeA'
    );

    // Run HMM on haplotype B
    const logAlphaB = forwardLogHaploid(
      availableMarkers,
      allelesB,
      logPriorProbs
    );
    const logBetaB = backwardLogHaploid(
      availableMarkers,
      allelesB,
      logPriorProbs
    );
    const posteriorsB = computePosteriorsFromLog(logAlphaB, logBetaB);
    const segmentsB = posteriorsToSegments(
      chr,
      availableMarkers,
      posteriorsB,
      chrLength,
      'haplotypeB'
    );

    haplotypeAByChromosome.set(chr, segmentsA);
    haplotypeBByChromosome.set(chr, segmentsB);
    haplotypeASegments.push(...segmentsA);
    haplotypeBSegments.push(...segmentsB);

    // Create combined segments (merge A and B as unphased)
    // For combined view, we just mark them all as unphased
    const combinedChrSegments = [
      ...segmentsA.map(s => ({ ...s, parent: 'unphased' as const })),
    ];
    combinedSegments.push(...combinedChrSegments);
  }

  // Calculate compositions
  const haplotypeAComposition = calculateComposition(haplotypeASegments);
  const haplotypeBComposition = calculateComposition(haplotypeBSegments);
  const combinedComposition = calculateComposition([
    ...haplotypeASegments,
    ...haplotypeBSegments,
  ]);

  return {
    haplotypeASegments,
    haplotypeBSegments,
    combinedSegments,
    haplotypeAComposition,
    haplotypeBComposition,
    combinedComposition,
    haplotypeAByChromosome,
    haplotypeBByChromosome,
    summary: {
      totalSegmentsA: haplotypeASegments.length,
      totalSegmentsB: haplotypeBSegments.length,
      chromosomesProcessed: haplotypeAByChromosome.size,
      markersUsed: totalMarkersUsed,
      phasingConfidence: phasingResult.averageConfidence,
    },
  };
}
