/**
 * HMM-based Local Ancestry Inference (Optimized for Browser)
 *
 * Uses a Hidden Markov Model to infer ancestry along chromosomes.
 * This provides smoother, more consistent results than window-based approaches.
 *
 * Model:
 * - Hidden states: K ancestry populations (EUR, AFR, EAS, SAS, AMR)
 * - Observations: Genotypes at each marker position
 * - Emissions: P(genotype | ancestry) using Hardy-Weinberg equilibrium
 * - Transitions: Based on recombination rate (~1 cM/Mb)
 *
 * Optimizations:
 * - Log-space arithmetic to prevent underflow without scaling
 * - Pre-computed transition matrices for common distances
 * - Reusable typed array buffers to reduce GC pressure
 * - Fast path for homogeneous ancestry (>95% single population)
 * - Batch marker lookups
 *
 * Algorithm: Forward-Backward for posterior probabilities
 */

import type {
  AncestrySegment,
  AncestryCategory,
  AncestryPopulation,
} from '@/types/genome';
import type { ParsedSNPFile } from './snpFileParser';
import type {
  InferencePopulation,
  AncestryInferenceResult,
} from './ancestryInference';
import aimsData from './ancestryAIMs_expanded.json';

// Population codes
const POPULATIONS: InferencePopulation[] = ['EUR', 'AFR', 'EAS', 'SAS', 'AMR'];
const K = POPULATIONS.length; // Number of states

// Recombination rate: ~1 cM per Mb = 0.01 per Mb
const RECOMB_RATE_PER_BP = 1e-8;

// Log of minimum probability (prevents -Infinity)
const LOG_MIN_PROB = -30;

// Threshold for fast path (skip HMM if dominant ancestry > this)
const HOMOGENEOUS_THRESHOLD = 0.95;

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

// Marker with frequency data
interface AIMMarker {
  rsid: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  frequencies: Record<InferencePopulation, number>;
}

// Type the imported JSON
const aims = aimsData as {
  metadata: Record<string, unknown>;
  markers: AIMMarker[];
};

// Cached markers by chromosome (lazy initialized)
let markersByChromosome: Map<string, AIMMarker[]> | null = null;

// Reusable buffers for HMM computations (reduces GC pressure)
const hmmBuffers = {
  tempK: new Float64Array(K),
  tempK2: new Float64Array(K),
  transitionMatrix: new Float64Array(K * K),
};

/**
 * Safe log that clamps to LOG_MIN_PROB to avoid -Infinity
 */
function safeLog(x: number): number {
  return x > 0 ? Math.log(x) : LOG_MIN_PROB;
}

/**
 * Log-sum-exp for numerical stability: log(exp(a) + exp(b))
 */
function logSumExp(a: number, b: number): number {
  if (a === LOG_MIN_PROB) return b;
  if (b === LOG_MIN_PROB) return a;
  const max = Math.max(a, b);
  return max + Math.log(Math.exp(a - max) + Math.exp(b - max));
}

/**
 * Log-sum-exp for an array
 */
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

/**
 * Calculate log emission probability: log P(genotype | ancestry)
 * Uses Hardy-Weinberg equilibrium
 */
function logEmissionProbability(
  genotype: string,
  marker: AIMMarker,
  population: InferencePopulation
): number {
  // Handle missing/no-call - uninformative (log(1) = 0)
  if (
    !genotype ||
    genotype === '--' ||
    genotype === '00' ||
    genotype.includes('0')
  ) {
    return 0;
  }

  const altFreq = marker.frequencies[population];
  // Bound frequencies to avoid log(0)
  const p = Math.max(0.001, Math.min(0.999, 1 - altFreq)); // ref freq
  const q = 1 - p; // alt freq

  const alleles = genotype.split('');

  // Handle hemizygous (single allele, e.g., male X)
  if (alleles.length === 1) {
    if (alleles[0] === marker.ref) return safeLog(p);
    if (alleles[0] === marker.alt) return safeLog(q);
    return 0; // Unknown allele
  }

  // Diploid genotype
  if (alleles.length !== 2) return 0;

  const [a1, a2] = alleles;
  let refCount = 0;
  let altCount = 0;

  if (a1 === marker.ref) refCount++;
  if (a2 === marker.ref) refCount++;
  if (a1 === marker.alt) altCount++;
  if (a2 === marker.alt) altCount++;

  if (refCount + altCount !== 2) return 0; // Alleles don't match

  // Hardy-Weinberg probabilities (in log space)
  if (refCount === 2) return 2 * safeLog(p);
  if (refCount === 1) return safeLog(2) + safeLog(p) + safeLog(q);
  return 2 * safeLog(q);
}

/**
 * Pre-compute log transition matrix for a given genetic distance
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
        // Stay: log((1-r) + r*prior[j]) ≈ log(1-r) for small r and small prior
        // More accurate: log-sum-exp
        out[i * K + j] = logSumExp(
          log1MinusRecomb,
          logRecomb + logPriorProbs[j]
        );
      } else {
        // Switch: log(r * prior[j])
        out[i * K + j] = logRecomb + logPriorProbs[j];
      }
    }
  }
}

/**
 * Forward algorithm in log space
 */
function forwardLog(
  markers: AIMMarker[],
  genotypes: string[],
  logPriorProbs: Float64Array
): Float64Array[] {
  const T = markers.length;
  const logAlpha: Float64Array[] = new Array(T);

  // Initialize
  logAlpha[0] = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    logAlpha[0][k] =
      logPriorProbs[k] +
      logEmissionProbability(genotypes[0], markers[0], POPULATIONS[k]);
  }

  // Forward pass
  const transMatrix = hmmBuffers.transitionMatrix;

  for (let t = 1; t < T; t++) {
    logAlpha[t] = new Float64Array(K);
    const geneticDistance = markers[t].position - markers[t - 1].position;

    computeLogTransitionMatrix(geneticDistance, logPriorProbs, transMatrix);

    for (let k = 0; k < K; k++) {
      // Sum over previous states (in log space)
      let logSum = LOG_MIN_PROB;
      for (let j = 0; j < K; j++) {
        logSum = logSumExp(logSum, logAlpha[t - 1][j] + transMatrix[j * K + k]);
      }
      logAlpha[t][k] =
        logSum +
        logEmissionProbability(genotypes[t], markers[t], POPULATIONS[k]);
    }
  }

  return logAlpha;
}

/**
 * Backward algorithm in log space
 */
function backwardLog(
  markers: AIMMarker[],
  genotypes: string[],
  logPriorProbs: Float64Array
): Float64Array[] {
  const T = markers.length;
  const logBeta: Float64Array[] = new Array(T);

  // Initialize (log(1) = 0)
  logBeta[T - 1] = new Float64Array(K);

  // Backward pass
  const transMatrix = hmmBuffers.transitionMatrix;

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
            logEmissionProbability(
              genotypes[t + 1],
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
 * Compute posterior probabilities from log alpha and beta
 */
function computePosteriorsFromLog(
  logAlpha: Float64Array[],
  logBeta: Float64Array[]
): Float64Array[] {
  const T = logAlpha.length;
  const posteriors: Float64Array[] = new Array(T);
  const tempLog = hmmBuffers.tempK;

  for (let t = 0; t < T; t++) {
    posteriors[t] = new Float64Array(K);

    // Compute log(alpha * beta) for each state
    for (let k = 0; k < K; k++) {
      tempLog[k] = logAlpha[t][k] + logBeta[t][k];
    }

    // Normalize: convert to probabilities
    const logNorm = logSumExpArray(tempLog);
    for (let k = 0; k < K; k++) {
      posteriors[t][k] = Math.exp(tempLog[k] - logNorm);
    }
  }

  return posteriors;
}

/**
 * Convert posteriors to ancestry segments
 */
function posteriorsToSegments(
  chromosome: string,
  markers: AIMMarker[],
  posteriors: Float64Array[],
  chromosomeLength: number
): AncestrySegment[] {
  if (markers.length === 0) return [];

  const segments: AncestrySegment[] = [];
  let segmentStart = 0;
  let currentAncestry = -1;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (let t = 0; t < markers.length; t++) {
    // Find most likely ancestry at this position
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
      // Ancestry changed - save current segment
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
        parent: 'unphased',
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
      parent: 'unphased',
    });
  }

  return segments;
}

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

export interface HMMLocalAncestryResult {
  segments: AncestrySegment[];
  segmentsByChromosome: Map<string, AncestrySegment[]>;
  posteriorsByChromosome: Map<
    string,
    { positions: number[]; posteriors: Float64Array[] }
  >;
  summary: {
    totalSegments: number;
    chromosomesProcessed: number;
    markersUsed: number;
    ancestryBreakdown: Record<InferencePopulation, number>;
  };
}

/**
 * Run HMM-based local ancestry inference (optimized)
 *
 * @param parsedFile - Parsed SNP file
 * @param globalResult - Global ancestry result to use as prior
 */
export function inferLocalAncestryHMM(
  parsedFile: ParsedSNPFile,
  globalResult: AncestryInferenceResult
): HMMLocalAncestryResult {
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
    'X',
  ];

  // Use global ancestry proportions as prior
  const priorProbs = POPULATIONS.map(pop => globalResult.proportions[pop]);
  const priorSum = priorProbs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < priorProbs.length; i++) {
    priorProbs[i] = priorProbs[i] / priorSum;
  }

  // Pre-compute log priors
  const logPriorProbs = new Float64Array(K);
  for (let i = 0; i < K; i++) {
    logPriorProbs[i] = safeLog(priorProbs[i]);
  }

  // Check for homogeneous ancestry (fast path)
  const maxPriorIdx = priorProbs.indexOf(Math.max(...priorProbs));
  const isHomogeneous = priorProbs[maxPriorIdx] >= HOMOGENEOUS_THRESHOLD;

  const allSegments: AncestrySegment[] = [];
  const segmentsByChromosome = new Map<string, AncestrySegment[]>();
  const posteriorsByChromosome = new Map<
    string,
    { positions: number[]; posteriors: Float64Array[] }
  >();

  let totalMarkersUsed = 0;
  const ancestryLengths: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };
  let totalLength = 0;

  for (const chr of chromosomes) {
    const chrMarkers = markersByChr.get(chr) || [];
    const chrLength = CHROMOSOME_LENGTHS[chr] || 150000000;

    // Batch lookup: get all genotypes for this chromosome at once
    const availableMarkers: AIMMarker[] = [];
    const genotypes: string[] = [];

    for (const m of chrMarkers) {
      const snp = parsedFile.snps.get(m.rsid);
      if (snp && snp.genotype && snp.genotype !== '--') {
        availableMarkers.push(m);
        genotypes.push(snp.genotype);
      }
    }

    // Fast path: assign whole chromosome to dominant ancestry
    if (isHomogeneous || availableMarkers.length < 2) {
      const segment: AncestrySegment = {
        chromosome: chr,
        start: 0,
        end: chrLength,
        population: POPULATION_TO_NAME[POPULATIONS[maxPriorIdx]],
        category: POPULATION_TO_CATEGORY[POPULATIONS[maxPriorIdx]],
        confidence: priorProbs[maxPriorIdx],
        parent: 'unphased',
      };
      segmentsByChromosome.set(chr, [segment]);
      allSegments.push(segment);
      ancestryLengths[POPULATIONS[maxPriorIdx]] += chrLength;
      totalLength += chrLength;

      // Store posteriors for visualization (uniform based on prior)
      if (availableMarkers.length > 0) {
        const posteriors: Float64Array[] = availableMarkers.map(() => {
          const p = new Float64Array(K);
          for (let k = 0; k < K; k++) p[k] = priorProbs[k];
          return p;
        });
        posteriorsByChromosome.set(chr, {
          positions: availableMarkers.map(m => m.position),
          posteriors,
        });
      }
      continue;
    }

    totalMarkersUsed += availableMarkers.length;

    // Run Forward-Backward in log space
    const logAlpha = forwardLog(availableMarkers, genotypes, logPriorProbs);
    const logBeta = backwardLog(availableMarkers, genotypes, logPriorProbs);
    const posteriors = computePosteriorsFromLog(logAlpha, logBeta);

    // Store posteriors for visualization
    posteriorsByChromosome.set(chr, {
      positions: availableMarkers.map(m => m.position),
      posteriors,
    });

    // Convert to segments
    const segments = posteriorsToSegments(
      chr,
      availableMarkers,
      posteriors,
      chrLength
    );
    segmentsByChromosome.set(chr, segments);
    allSegments.push(...segments);

    // Update ancestry breakdown
    for (const seg of segments) {
      const length = seg.end - seg.start;
      const pop = POPULATIONS.find(
        p => POPULATION_TO_NAME[p] === seg.population
      );
      if (pop) {
        ancestryLengths[pop] += length;
      }
      totalLength += length;
    }
  }

  // Calculate percentages
  const ancestryBreakdown: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };
  if (totalLength > 0) {
    for (const pop of POPULATIONS) {
      ancestryBreakdown[pop] = (ancestryLengths[pop] / totalLength) * 100;
    }
  }

  return {
    segments: allSegments,
    segmentsByChromosome,
    posteriorsByChromosome,
    summary: {
      totalSegments: allSegments.length,
      chromosomesProcessed: segmentsByChromosome.size,
      markersUsed: totalMarkersUsed,
      ancestryBreakdown,
    },
  };
}
