/**
 * Ancestry Inference Engine
 *
 * Estimates continental ancestry proportions from SNP genotype data
 * using Ancestry Informative Markers (AIMs) and a likelihood-based approach.
 *
 * Populations:
 * - EUR: European
 * - AFR: African
 * - EAS: East Asian
 * - SAS: South Asian
 * - AMR: Native American / Indigenous Americas
 */

import type {
  SNPGenotype,
  AncestryCategory,
  AncestryComposition,
} from '@/types/genome';
import type { ParsedSNPFile } from './snpFileParser';
import aimsData from './ancestryAIMs_expanded.json';
import {
  inferWithReferencePanel,
  isReferencePanelAvailable,
  type ReferencePanelResult,
} from './referenceBasedInference';

// Population codes used in inference
export type InferencePopulation = 'EUR' | 'AFR' | 'EAS' | 'SAS' | 'AMR';

// Marker from AIM reference data
interface AIMMarker {
  rsid: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  frequencies: Record<InferencePopulation, number>;
  note?: string;
}

// Result of ancestry inference
export interface AncestryInferenceResult {
  // Estimated proportions (sum to 1.0)
  proportions: Record<InferencePopulation, number>;

  // Confidence metrics
  confidence: 'high' | 'moderate' | 'low';
  markersUsed: number;
  markersAvailable: number;

  // Per-marker details (for debugging/visualization)
  markerDetails?: MarkerInferenceDetail[];

  // Human-readable composition
  composition: AncestryComposition[];
}

export interface MarkerInferenceDetail {
  rsid: string;
  chromosome: string;
  position: number;
  userGenotype: string;
  likelihoods: Record<InferencePopulation, number>;
  informativeness: number; // How much this marker discriminates between populations
}

// Map inference populations to display categories
const POPULATION_TO_CATEGORY: Record<InferencePopulation, AncestryCategory> = {
  EUR: 'european',
  AFR: 'african',
  EAS: 'east_asian',
  SAS: 'south_asian',
  AMR: 'native_american',
};

const POPULATION_DISPLAY_NAMES: Record<InferencePopulation, string> = {
  EUR: 'European',
  AFR: 'African',
  EAS: 'East Asian',
  SAS: 'South Asian',
  AMR: 'Native American',
};

// Type the imported JSON
const aims = aimsData as {
  metadata: {
    description: string;
    source: string;
    buildVersion: string;
    populations: Record<string, string>;
    totalMarkers: number;
  };
  markers: AIMMarker[];
};

/**
 * Calculate the likelihood of observing a genotype given population allele frequency
 *
 * For a biallelic SNP with ref allele frequency p:
 * - P(ref/ref) = p²
 * - P(ref/alt) = 2p(1-p)
 * - P(alt/alt) = (1-p)²
 *
 * For hemizygous calls (e.g., male X chromosome):
 * - P(ref) = p
 * - P(alt) = 1-p
 */
function genotypeLikelihood(
  genotype: string,
  refAllele: string,
  altAllele: string,
  refFrequency: number
): number {
  // Handle no-calls
  if (
    genotype === '--' ||
    genotype === '00' ||
    genotype.includes('0') ||
    genotype === '-'
  ) {
    return 1.0; // Uninformative
  }

  const alleles = genotype.split('');

  // Bound frequency to avoid log(0)
  const p = Math.max(0.001, Math.min(0.999, refFrequency));
  const q = 1 - p;

  // Handle hemizygous calls (single allele, e.g., male X chromosome)
  if (alleles.length === 1) {
    const allele = alleles[0];
    if (allele === refAllele) {
      return p; // P(ref)
    } else if (allele === altAllele) {
      return q; // P(alt)
    } else {
      return 1.0; // Unknown allele
    }
  }

  // Handle diploid calls
  if (alleles.length !== 2) {
    return 1.0; // Uninformative (unusual)
  }

  const [a1, a2] = alleles;

  // Count reference alleles
  let refCount = 0;
  if (a1 === refAllele) refCount++;
  if (a2 === refAllele) refCount++;

  // Count alt alleles
  let altCount = 0;
  if (a1 === altAllele) altCount++;
  if (a2 === altAllele) altCount++;

  // If genotype doesn't match expected alleles, it's uninformative
  if (refCount + altCount !== 2) {
    return 1.0;
  }

  if (refCount === 2) {
    return p * p; // Homozygous reference
  } else if (refCount === 1) {
    return 2 * p * q; // Heterozygous
  } else {
    return q * q; // Homozygous alternate
  }
}

/**
 * Calculate how informative a marker is for ancestry discrimination
 * Higher values mean the marker better distinguishes between populations
 */
function calculateInformativeness(
  frequencies: Record<InferencePopulation, number>
): number {
  const freqs = Object.values(frequencies);
  const mean = freqs.reduce((a, b) => a + b, 0) / freqs.length;
  const variance =
    freqs.reduce((sum, f) => sum + (f - mean) ** 2, 0) / freqs.length;
  return Math.sqrt(variance); // Standard deviation as informativeness measure
}

/**
 * Infer ancestry proportions from parsed SNP data
 */
export function inferAncestry(
  parsedFile: ParsedSNPFile,
  options: {
    includeMarkerDetails?: boolean;
    minInformativeness?: number;
  } = {}
): AncestryInferenceResult {
  const { includeMarkerDetails = false, minInformativeness = 0.1 } = options;

  const populations: InferencePopulation[] = [
    'EUR',
    'AFR',
    'EAS',
    'SAS',
    'AMR',
  ];

  // Initialize log-likelihoods (using log to avoid underflow)
  const logLikelihoods: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  const markerDetails: MarkerInferenceDetail[] = [];
  let markersUsed = 0;

  // Process each AIM
  for (const marker of aims.markers) {
    const userSNP = parsedFile.snps.get(marker.rsid);

    if (!userSNP || userSNP.genotype === '--') {
      continue; // User doesn't have this marker
    }

    // Check if marker is informative enough
    const informativeness = calculateInformativeness(marker.frequencies);
    if (informativeness < minInformativeness) {
      continue;
    }

    // Calculate likelihood for each population
    const markerLikelihoods: Record<InferencePopulation, number> = {
      EUR: 0,
      AFR: 0,
      EAS: 0,
      SAS: 0,
      AMR: 0,
    };

    let isInformative = false;

    for (const pop of populations) {
      // In our data, frequencies are for the ALT allele
      // So ref frequency = 1 - alt frequency
      const altFreq = marker.frequencies[pop];
      const refFreq = 1 - altFreq;

      const likelihood = genotypeLikelihood(
        userSNP.genotype,
        marker.ref,
        marker.alt,
        refFreq
      );

      markerLikelihoods[pop] = likelihood;

      // Add log-likelihood (avoiding log(0))
      if (likelihood > 0) {
        logLikelihoods[pop] += Math.log(likelihood);
        isInformative = true;
      }
    }

    if (isInformative) {
      markersUsed++;

      if (includeMarkerDetails) {
        markerDetails.push({
          rsid: marker.rsid,
          chromosome: marker.chromosome,
          position: marker.position,
          userGenotype: userSNP.genotype,
          likelihoods: markerLikelihoods,
          informativeness,
        });
      }
    }
  }

  // Convert log-likelihoods to proportions using softmax-like approach
  // First, normalize by subtracting max to prevent overflow
  const maxLogLikelihood = Math.max(...Object.values(logLikelihoods));
  const normalizedLikelihoods: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  let totalLikelihood = 0;
  for (const pop of populations) {
    normalizedLikelihoods[pop] = Math.exp(
      logLikelihoods[pop] - maxLogLikelihood
    );
    totalLikelihood += normalizedLikelihoods[pop];
  }

  // Calculate final proportions
  const proportions: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  for (const pop of populations) {
    proportions[pop] = normalizedLikelihoods[pop] / totalLikelihood;
  }

  // Determine confidence based on markers used
  let confidence: 'high' | 'moderate' | 'low';
  if (markersUsed >= 80) {
    confidence = 'high';
  } else if (markersUsed >= 40) {
    confidence = 'moderate';
  } else {
    confidence = 'low';
  }

  // Create human-readable composition
  const composition: AncestryComposition[] = populations
    .map(pop => ({
      population: pop.toLowerCase() as never, // Will be mapped properly
      category: POPULATION_TO_CATEGORY[pop],
      percentage: Math.round(proportions[pop] * 1000) / 10, // Round to 1 decimal
      displayName: POPULATION_DISPLAY_NAMES[pop],
    }))
    .filter(c => c.percentage >= 0.5) // Only include if >= 0.5%
    .sort((a, b) => b.percentage - a.percentage);

  const result: AncestryInferenceResult = {
    proportions,
    confidence,
    markersUsed,
    markersAvailable: aims.markers.length,
    composition,
  };

  if (includeMarkerDetails) {
    result.markerDetails = markerDetails;
  }

  return result;
}

/**
 * Admixture inference using Expectation-Maximization (EM) algorithm
 *
 * Unlike maximum likelihood which assigns 100% to most likely population,
 * this estimates mixture proportions (e.g., 85% EUR, 10% AMR, 5% AFR).
 *
 * Algorithm:
 * 1. Initialize with uniform proportions (20% each)
 * 2. E-step: For each marker, compute P(ancestry | genotype, current proportions)
 * 3. M-step: Update proportions = average of expected ancestries across markers
 * 4. Repeat until convergence
 */
export function inferAdmixture(
  parsedFile: ParsedSNPFile,
  options: {
    maxIterations?: number;
    convergenceThreshold?: number;
    minInformativeness?: number;
  } = {}
): AncestryInferenceResult {
  const {
    maxIterations = 100,
    convergenceThreshold = 0.0001,
    minInformativeness = 0.05,
  } = options;

  const populations: InferencePopulation[] = [
    'EUR',
    'AFR',
    'EAS',
    'SAS',
    'AMR',
  ];
  const K = populations.length;

  // Collect usable markers
  const usableMarkers: Array<{
    marker: AIMMarker;
    genotype: string;
    likelihoods: number[];
  }> = [];

  for (const marker of aims.markers) {
    const userSNP = parsedFile.snps.get(marker.rsid);
    if (!userSNP || userSNP.genotype === '--') continue;

    const informativeness = calculateInformativeness(marker.frequencies);
    if (informativeness < minInformativeness) continue;

    // Pre-compute likelihoods for each population
    const likelihoods: number[] = [];
    for (const pop of populations) {
      const altFreq = marker.frequencies[pop];
      const refFreq = 1 - altFreq;
      const likelihood = genotypeLikelihood(
        userSNP.genotype,
        marker.ref,
        marker.alt,
        refFreq
      );
      likelihoods.push(likelihood);
    }

    // Only use if at least one population has non-trivial likelihood
    if (likelihoods.some(l => l > 0.01)) {
      usableMarkers.push({ marker, genotype: userSNP.genotype, likelihoods });
    }
  }

  const M = usableMarkers.length;
  if (M === 0) {
    // No usable markers, return uniform
    const uniformProp = 1 / K;
    return {
      proportions: {
        EUR: uniformProp,
        AFR: uniformProp,
        EAS: uniformProp,
        SAS: uniformProp,
        AMR: uniformProp,
      },
      confidence: 'low',
      markersUsed: 0,
      markersAvailable: aims.markers.length,
      composition: [],
    };
  }

  // Initialize proportions uniformly
  let proportions = new Float64Array(K).fill(1 / K);

  // EM iterations
  const responsibilities = new Float64Array(K);

  for (let iter = 0; iter < maxIterations; iter++) {
    // E-step: compute expected ancestries (responsibilities) for each marker
    const newProportions = new Float64Array(K).fill(0);

    for (const { likelihoods } of usableMarkers) {
      // Compute P(ancestry_k | genotype) ∝ P(genotype | ancestry_k) * P(ancestry_k)
      let totalResponsibility = 0;
      for (let k = 0; k < K; k++) {
        responsibilities[k] = likelihoods[k] * proportions[k];
        totalResponsibility += responsibilities[k];
      }

      // Normalize and accumulate
      if (totalResponsibility > 0) {
        for (let k = 0; k < K; k++) {
          newProportions[k] += responsibilities[k] / totalResponsibility;
        }
      }
    }

    // M-step: update proportions (average of responsibilities)
    let totalProp = 0;
    for (let k = 0; k < K; k++) {
      newProportions[k] /= M;
      totalProp += newProportions[k];
    }

    // Normalize to ensure sum = 1
    for (let k = 0; k < K; k++) {
      newProportions[k] /= totalProp;
    }

    // Check convergence
    let maxDiff = 0;
    for (let k = 0; k < K; k++) {
      maxDiff = Math.max(maxDiff, Math.abs(newProportions[k] - proportions[k]));
    }

    proportions = newProportions;

    if (maxDiff < convergenceThreshold) {
      break;
    }
  }

  // Convert to result format
  const proportionRecord: Record<InferencePopulation, number> = {
    EUR: proportions[0],
    AFR: proportions[1],
    EAS: proportions[2],
    SAS: proportions[3],
    AMR: proportions[4],
  };

  // Determine confidence based on markers used
  let confidence: 'high' | 'moderate' | 'low';
  if (M >= 500) {
    confidence = 'high';
  } else if (M >= 100) {
    confidence = 'moderate';
  } else {
    confidence = 'low';
  }

  // Create human-readable composition
  const composition: AncestryComposition[] = populations
    .map((pop, idx) => ({
      population: pop.toLowerCase() as never,
      category: POPULATION_TO_CATEGORY[pop],
      percentage: Math.round(proportions[idx] * 1000) / 10,
      displayName: POPULATION_DISPLAY_NAMES[pop],
    }))
    .filter(c => c.percentage >= 0.5)
    .sort((a, b) => b.percentage - a.percentage);

  return {
    proportions: proportionRecord,
    confidence,
    markersUsed: M,
    markersAvailable: aims.markers.length,
    composition,
  };
}

/**
 * Infer ancestry from a Map of SNPs (convenience function)
 */
export function inferAncestryFromSNPs(
  snps: Map<string, SNPGenotype>,
  options: {
    includeMarkerDetails?: boolean;
    minInformativeness?: number;
  } = {}
): AncestryInferenceResult {
  // Create a minimal ParsedSNPFile structure
  const parsedFile: ParsedSNPFile = {
    source: 'unknown',
    buildVersion: 'GRCh37',
    snpCount: snps.size,
    snps,
    metadata: {},
  };

  return inferAncestry(parsedFile, options);
}

/**
 * Get the list of AIMs used for inference
 */
export function getAIMMarkers(): AIMMarker[] {
  return aims.markers;
}

/**
 * Check how many AIMs are present in a user's data
 */
export function countAvailableAIMs(snps: Map<string, SNPGenotype>): {
  total: number;
  available: number;
  missing: string[];
} {
  const missing: string[] = [];
  let available = 0;

  for (const marker of aims.markers) {
    const userSNP = snps.get(marker.rsid);
    if (userSNP && userSNP.genotype !== '--') {
      available++;
    } else {
      missing.push(marker.rsid);
    }
  }

  return {
    total: aims.markers.length,
    available,
    missing,
  };
}

/**
 * Format ancestry result for display
 */
export function formatAncestryResult(result: AncestryInferenceResult): string {
  const lines: string[] = [
    'Ancestry Inference Results',
    '==========================',
    '',
    `Confidence: ${result.confidence}`,
    `Markers used: ${result.markersUsed} of ${result.markersAvailable}`,
    '',
    'Estimated Ancestry:',
  ];

  for (const comp of result.composition) {
    const bar = '█'.repeat(Math.round(comp.percentage / 2));
    lines.push(
      `  ${comp.displayName.padEnd(20)} ${comp.percentage.toFixed(1).padStart(5)}% ${bar}`
    );
  }

  return lines.join('\n');
}

/**
 * Smart inference that uses 1000 Genomes reference panel if available,
 * otherwise falls back to EM admixture algorithm.
 *
 * The reference panel provides more accurate results by:
 * 1. Using k-NN to find similar individuals in reference database
 * 2. Using empirical genotype frequencies instead of Hardy-Weinberg assumptions
 * 3. Providing detailed 26 sub-population breakdown (not just 5 super-populations)
 */
export async function inferAdmixtureWithReferencePanel(
  parsedFile: ParsedSNPFile,
  options: {
    preferReferencePanel?: boolean;
    k?: number;
  } = {}
): Promise<AncestryInferenceResult | ReferencePanelResult> {
  const { preferReferencePanel = true, k = 100 } = options;

  if (preferReferencePanel) {
    try {
      const panelAvailable = await isReferencePanelAvailable();
      if (panelAvailable) {
        return await inferWithReferencePanel(parsedFile, {
          k,
          method: 'hybrid',
        });
      }
    } catch {
      // Fall through to EM
    }
  }

  // Fallback to standard EM admixture
  return inferAdmixture(parsedFile);
}

/**
 * Check if enhanced reference panel inference is available
 */
export async function checkReferencePanelAvailable(): Promise<boolean> {
  return isReferencePanelAvailable();
}
