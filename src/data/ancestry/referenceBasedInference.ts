/**
 * Reference-Based Ancestry Inference
 *
 * Uses 1000 Genomes Phase 3 individual-level genotype data (2,504 individuals
 * from 26 populations) to perform k-NN + empirical EM hybrid ancestry inference.
 *
 * Algorithm:
 * 1. k-NN Phase: Find most similar reference individuals via IBS similarity
 * 2. Empirical EM: Use genotype counts from reference panel instead of HWE
 * 3. Combine: Use k-NN distribution as prior, refine with EM
 */

import type { ParsedSNPFile } from './snpFileParser';
import type { AncestryComposition } from '@/types/genome';
import type {
  InferencePopulation,
  AncestryInferenceResult,
} from './ancestryInference';
import aimsData from './ancestryAIMs_expanded.json';

// 26 sub-populations in 1000 Genomes Phase 3
export type SubPopulation =
  // EUR
  | 'CEU'
  | 'TSI'
  | 'FIN'
  | 'GBR'
  | 'IBS'
  // AFR
  | 'YRI'
  | 'LWK'
  | 'GWD'
  | 'MSL'
  | 'ESN'
  | 'ASW'
  | 'ACB'
  // EAS
  | 'CHB'
  | 'JPT'
  | 'CHS'
  | 'CDX'
  | 'KHV'
  // SAS
  | 'GIH'
  | 'PJL'
  | 'BEB'
  | 'STU'
  | 'ITU'
  // AMR
  | 'MXL'
  | 'PUR'
  | 'CLM'
  | 'PEL';

// Map sub-populations to super-populations
export const SUB_TO_SUPER_POP: Record<SubPopulation, InferencePopulation> = {
  CEU: 'EUR',
  TSI: 'EUR',
  FIN: 'EUR',
  GBR: 'EUR',
  IBS: 'EUR',
  YRI: 'AFR',
  LWK: 'AFR',
  GWD: 'AFR',
  MSL: 'AFR',
  ESN: 'AFR',
  ASW: 'AFR',
  ACB: 'AFR',
  CHB: 'EAS',
  JPT: 'EAS',
  CHS: 'EAS',
  CDX: 'EAS',
  KHV: 'EAS',
  GIH: 'SAS',
  PJL: 'SAS',
  BEB: 'SAS',
  STU: 'SAS',
  ITU: 'SAS',
  MXL: 'AMR',
  PUR: 'AMR',
  CLM: 'AMR',
  PEL: 'AMR',
};

// Display names for sub-populations
export const SUB_POP_NAMES: Record<SubPopulation, string> = {
  CEU: 'Utah European (CEU)',
  TSI: 'Tuscan Italian (TSI)',
  FIN: 'Finnish (FIN)',
  GBR: 'British (GBR)',
  IBS: 'Iberian Spanish (IBS)',
  YRI: 'Yoruba Nigerian (YRI)',
  LWK: 'Luhya Kenyan (LWK)',
  GWD: 'Gambian (GWD)',
  MSL: 'Mende Sierra Leonean (MSL)',
  ESN: 'Esan Nigerian (ESN)',
  ASW: 'African American SW (ASW)',
  ACB: 'African Caribbean (ACB)',
  CHB: 'Han Chinese Beijing (CHB)',
  JPT: 'Japanese (JPT)',
  CHS: 'Han Chinese South (CHS)',
  CDX: 'Dai Chinese (CDX)',
  KHV: 'Vietnamese (KHV)',
  GIH: 'Gujarati Indian (GIH)',
  PJL: 'Punjabi Pakistani (PJL)',
  BEB: 'Bengali (BEB)',
  STU: 'Sri Lankan Tamil (STU)',
  ITU: 'Telugu Indian (ITU)',
  MXL: 'Mexican (MXL)',
  PUR: 'Puerto Rican (PUR)',
  CLM: 'Colombian (CLM)',
  PEL: 'Peruvian (PEL)',
};

// Nearest neighbor info
export interface NearestNeighbor {
  id: string;
  population: SubPopulation;
  superPopulation: InferencePopulation;
  similarity: number;
}

// Extended result type with sub-population detail
export interface ReferencePanelResult extends AncestryInferenceResult {
  // Detailed 26 sub-population proportions
  subPopulationProportions: Record<SubPopulation, number>;

  // Top k nearest neighbors
  nearestNeighbors: NearestNeighbor[];

  // Method used
  method: 'knn' | 'empirical-em' | 'hybrid';
}

// Reference panel data structures
interface Reference1000GPanel {
  metadata: {
    version: string;
    buildDate: string;
    totalIndividuals: number;
    populations: Record<
      string,
      { code: string; superPop: string; count: number }
    >;
    sampleIds: string[];
    rsids: string[];
    totalMarkers: number;
  };
  genotypes: Record<string, string>;
}

interface ReferenceMetadata {
  version: string;
  buildDate: string;
  totalIndividuals: number;
  totalMarkers: number;
  populations: Record<
    string,
    { code: string; superPop: string; count: number; description: string }
  >;
  superPopulations: Record<
    string,
    { code: string; populations: string[]; totalCount: number }
  >;
  sampleInfo: Array<{
    id: string;
    population: string;
    superPopulation: string;
    index: number;
  }>;
}

// Lazy-loaded reference panel
let referencePanel: Reference1000GPanel | null = null;
let referenceMetadata: ReferenceMetadata | null = null;
let panelLoadPromise: Promise<void> | null = null;

// Type the AIMs data
const aims = aimsData as {
  metadata: {
    description: string;
    source: string;
    buildVersion: string;
    populations: Record<string, string>;
    totalMarkers: number;
  };
  markers: Array<{
    rsid: string;
    chromosome: string;
    position: number;
    ref: string;
    alt: string;
    frequencies: Record<InferencePopulation, number>;
  }>;
};

/**
 * Check if reference panel is available (non-placeholder)
 */
export async function isReferencePanelAvailable(): Promise<boolean> {
  try {
    // Check if panel has real data (not just the placeholder)
    const panelModule = await import('./reference1000G.json');
    return (
      panelModule &&
      panelModule.default &&
      panelModule.default.metadata &&
      panelModule.default.metadata.version !== 'PLACEHOLDER' &&
      panelModule.default.metadata.totalMarkers > 0
    );
  } catch {
    return false;
  }
}

/**
 * Load reference panel data (lazy loading)
 */
export async function loadReferencePanel(): Promise<{
  panel: Reference1000GPanel;
  metadata: ReferenceMetadata;
}> {
  if (referencePanel && referenceMetadata) {
    return { panel: referencePanel, metadata: referenceMetadata };
  }

  if (panelLoadPromise) {
    await panelLoadPromise;
    return { panel: referencePanel!, metadata: referenceMetadata! };
  }

  panelLoadPromise = (async () => {
    try {
      const [panelModule, metadataModule] = await Promise.all([
        import('./reference1000G.json'),
        import('./referenceMetadata.json'),
      ]);

      referencePanel = panelModule.default as Reference1000GPanel;
      referenceMetadata = metadataModule.default as ReferenceMetadata;

      // Check if this is a placeholder file
      if (referencePanel.metadata.version === 'PLACEHOLDER') {
        panelLoadPromise = null;
        throw new Error(
          'Reference panel not built. Run: npx tsx src/data/ancestry/build1000GenomesPanel.ts'
        );
      }
    } catch (_err) {
      panelLoadPromise = null;
      throw new Error(
        'Reference panel not found. Run: npx tsx src/data/ancestry/build1000GenomesPanel.ts'
      );
    }
  })();

  await panelLoadPromise;
  return { panel: referencePanel!, metadata: referenceMetadata! };
}

/**
 * Convert user genotype to dosage (0, 1, 2, or -1 for missing)
 */
function userGenotypeToDosage(
  genotype: string,
  refAllele: string,
  altAllele: string
): number {
  if (!genotype || genotype === '--' || genotype.includes('0')) {
    return -1; // Missing
  }

  const alleles = genotype.split('');
  if (alleles.length !== 2) {
    return -1;
  }

  let altCount = 0;
  for (const allele of alleles) {
    if (allele === altAllele) {
      altCount++;
    } else if (allele !== refAllele) {
      return -1; // Unknown allele
    }
  }

  return altCount;
}

/**
 * Calculate IBS (Identity-By-State) similarity between user and reference individual
 * Returns a weighted similarity score where informative markers count more
 */
function calculateIBSSimilarity(
  userDosages: Int8Array,
  refDosages: Int8Array,
  weights: Float32Array
): number {
  let similarity = 0;
  let totalWeight = 0;

  for (let i = 0; i < userDosages.length; i++) {
    const userDosage = userDosages[i];
    const refDosage = refDosages[i];

    if (userDosage < 0 || refDosage < 0 || refDosage > 2) {
      continue; // Skip missing data
    }

    const weight = weights[i];
    totalWeight += weight;

    // IBS score: 2 - |user - ref|
    // Perfect match = 2, heterozygote/homozygote mismatch = 1, opposite homozygotes = 0
    const diff = Math.abs(userDosage - refDosage);
    similarity += weight * (2 - diff);
  }

  if (totalWeight === 0) return 0;
  return similarity / (2 * totalWeight); // Normalize to [0, 1]
}

/**
 * Calculate informativeness weight for a marker based on frequency variance
 */
function calculateMarkerWeights(rsids: string[]): {
  weights: Float32Array;
  rsidToIndex: Map<string, number>;
} {
  const weights = new Float32Array(rsids.length);
  const rsidToIndex = new Map<string, number>();

  // Create marker lookup
  const markerMap = new Map<string, (typeof aims.markers)[0]>();
  for (const marker of aims.markers) {
    markerMap.set(marker.rsid, marker);
  }

  for (let i = 0; i < rsids.length; i++) {
    rsidToIndex.set(rsids[i], i);

    const marker = markerMap.get(rsids[i]);
    if (!marker) {
      weights[i] = 1.0;
      continue;
    }

    // Calculate variance of frequencies across populations
    const freqs = Object.values(marker.frequencies);
    const mean = freqs.reduce((a, b) => a + b, 0) / freqs.length;
    const variance =
      freqs.reduce((sum, f) => sum + (f - mean) ** 2, 0) / freqs.length;

    // Weight is standard deviation, capped at reasonable range
    weights[i] = Math.max(0.05, Math.min(0.5, Math.sqrt(variance)));
  }

  return { weights, rsidToIndex };
}

/**
 * Find k nearest neighbors using IBS similarity
 */
function findNearestNeighbors(
  userDosages: Int8Array,
  panel: Reference1000GPanel,
  metadata: ReferenceMetadata,
  weights: Float32Array,
  k: number
): NearestNeighbor[] {
  const { sampleIds, rsids } = panel.metadata;
  const n = sampleIds.length;

  // Calculate similarity to each reference individual
  const similarities: Array<{ index: number; similarity: number }> = [];

  for (let i = 0; i < n; i++) {
    // Extract reference individual's dosages
    const refDosages = new Int8Array(rsids.length);
    for (let j = 0; j < rsids.length; j++) {
      const genotypeStr = panel.genotypes[rsids[j]];
      const dosageChar = genotypeStr?.[i] ?? '9';
      refDosages[j] = dosageChar === '9' ? -1 : parseInt(dosageChar, 10);
    }

    const similarity = calculateIBSSimilarity(userDosages, refDosages, weights);
    similarities.push({ index: i, similarity });
  }

  // Sort by similarity (descending) and take top k
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, k).map(s => {
    const sampleId = sampleIds[s.index];
    const sampleInfo = metadata.sampleInfo.find(info => info.id === sampleId)!;

    return {
      id: sampleId,
      population: sampleInfo.population as SubPopulation,
      superPopulation: sampleInfo.superPopulation as InferencePopulation,
      similarity: s.similarity,
    };
  });
}

/**
 * Calculate sub-population proportions from k-NN results
 */
function knnProportions(
  neighbors: NearestNeighbor[]
): Record<SubPopulation, number> {
  const counts: Record<string, number> = {};
  let totalWeight = 0;

  for (const neighbor of neighbors) {
    // Weight by similarity (higher similarity = more influence)
    const weight = neighbor.similarity ** 2;
    counts[neighbor.population] = (counts[neighbor.population] || 0) + weight;
    totalWeight += weight;
  }

  // Initialize all populations to 0
  const proportions: Record<SubPopulation, number> = {} as Record<
    SubPopulation,
    number
  >;
  for (const pop of Object.keys(SUB_TO_SUPER_POP) as SubPopulation[]) {
    proportions[pop] = 0;
  }

  // Normalize
  if (totalWeight > 0) {
    for (const [pop, count] of Object.entries(counts)) {
      proportions[pop as SubPopulation] = count / totalWeight;
    }
  }

  return proportions;
}

/**
 * Aggregate sub-population proportions to super-populations
 */
function aggregateToSuperPop(
  subProps: Record<SubPopulation, number>
): Record<InferencePopulation, number> {
  const superProps: Record<InferencePopulation, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  for (const [subPop, prop] of Object.entries(subProps) as [
    SubPopulation,
    number,
  ][]) {
    superProps[SUB_TO_SUPER_POP[subPop]] += prop;
  }

  return superProps;
}

/**
 * Empirical EM algorithm using reference panel genotype counts
 * instead of Hardy-Weinberg equilibrium assumptions
 */
function empiricalEM(
  userDosages: Int8Array,
  panel: Reference1000GPanel,
  metadata: ReferenceMetadata,
  rsidToIndex: Map<string, number>,
  _weights: Float32Array,
  options: {
    maxIterations?: number;
    convergenceThreshold?: number;
    priorProportions?: Record<SubPopulation, number>;
  } = {}
): Record<SubPopulation, number> {
  const {
    maxIterations = 100,
    convergenceThreshold = 0.0001,
    priorProportions,
  } = options;

  const populations = Object.keys(SUB_TO_SUPER_POP) as SubPopulation[];
  const K = populations.length;

  // Build population indices for each sample
  const popIndices: Map<SubPopulation, number[]> = new Map();
  for (const pop of populations) {
    popIndices.set(pop, []);
  }

  for (const sampleInfo of metadata.sampleInfo) {
    const pop = sampleInfo.population as SubPopulation;
    popIndices.get(pop)?.push(sampleInfo.index);
  }

  // Identify usable markers (user has genotype)
  const usableMarkers: Array<{ rsid: string; markerIndex: number }> = [];
  for (const [rsid, markerIndex] of rsidToIndex.entries()) {
    if (userDosages[markerIndex] >= 0) {
      usableMarkers.push({ rsid, markerIndex });
    }
  }

  if (usableMarkers.length === 0) {
    // Return uniform if no markers
    const uniformProp = 1 / K;
    const result: Record<SubPopulation, number> = {} as Record<
      SubPopulation,
      number
    >;
    for (const pop of populations) {
      result[pop] = uniformProp;
    }
    return result;
  }

  // Pre-compute empirical genotype probabilities for each marker and population
  // P(genotype | population) = (count + 0.5) / (n + 1.5) (Laplace smoothing)
  const markerLikelihoods: Array<Float32Array> = [];

  for (const { rsid, markerIndex } of usableMarkers) {
    const userDosage = userDosages[markerIndex];
    const genotypeStr = panel.genotypes[rsid];
    const popLikelihoods = new Float32Array(K);

    for (let k = 0; k < K; k++) {
      const pop = populations[k];
      const indices = popIndices.get(pop)!;
      const n = indices.length;

      if (n === 0) {
        popLikelihoods[k] = 1 / 3; // Uniform if no samples
        continue;
      }

      // Count how many reference individuals have user's genotype
      let matchCount = 0;
      for (const idx of indices) {
        const refDosageChar = genotypeStr?.[idx] ?? '9';
        if (
          refDosageChar !== '9' &&
          parseInt(refDosageChar, 10) === userDosage
        ) {
          matchCount++;
        }
      }

      // Laplace smoothed probability
      popLikelihoods[k] = (matchCount + 0.5) / (n + 1.5);
    }

    markerLikelihoods.push(popLikelihoods);
  }

  // Initialize proportions (from prior or uniform)
  let proportions = new Float64Array(K);
  if (priorProportions) {
    for (let k = 0; k < K; k++) {
      proportions[k] = priorProportions[populations[k]] || 1 / K;
    }
  } else {
    proportions.fill(1 / K);
  }

  // EM iterations
  const responsibilities = new Float64Array(K);

  for (let iter = 0; iter < maxIterations; iter++) {
    const newProportions = new Float64Array(K).fill(0);

    for (const popLikelihoods of markerLikelihoods) {
      // E-step: compute responsibilities
      let totalResp = 0;
      for (let k = 0; k < K; k++) {
        responsibilities[k] = popLikelihoods[k] * proportions[k];
        totalResp += responsibilities[k];
      }

      // Normalize and accumulate
      if (totalResp > 0) {
        for (let k = 0; k < K; k++) {
          newProportions[k] += responsibilities[k] / totalResp;
        }
      }
    }

    // M-step: normalize
    let total = 0;
    for (let k = 0; k < K; k++) {
      total += newProportions[k];
    }
    for (let k = 0; k < K; k++) {
      newProportions[k] /= total;
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

  // Convert to record
  const result: Record<SubPopulation, number> = {} as Record<
    SubPopulation,
    number
  >;
  for (let k = 0; k < K; k++) {
    result[populations[k]] = proportions[k];
  }

  return result;
}

/**
 * Main inference function using reference panel
 */
export async function inferWithReferencePanel(
  parsedFile: ParsedSNPFile,
  options: {
    k?: number;
    method?: 'knn' | 'empirical-em' | 'hybrid';
  } = {}
): Promise<ReferencePanelResult> {
  const { k = 100, method = 'hybrid' } = options;

  // Load reference panel
  const { panel, metadata } = await loadReferencePanel();
  const { rsids } = panel.metadata;

  // Calculate marker weights and build index
  const { weights, rsidToIndex } = calculateMarkerWeights(rsids);

  // Build marker lookup
  const markerMap = new Map<string, (typeof aims.markers)[0]>();
  for (const marker of aims.markers) {
    markerMap.set(marker.rsid, marker);
  }

  // Convert user genotypes to dosage array
  const userDosages = new Int8Array(rsids.length);
  let usableCount = 0;

  for (let i = 0; i < rsids.length; i++) {
    const rsid = rsids[i];
    const userSNP = parsedFile.snps.get(rsid);
    const marker = markerMap.get(rsid);

    if (userSNP && marker) {
      const dosage = userGenotypeToDosage(
        userSNP.genotype,
        marker.ref,
        marker.alt
      );
      userDosages[i] = dosage;
      if (dosage >= 0) usableCount++;
    } else {
      userDosages[i] = -1;
    }
  }

  // Find nearest neighbors
  const nearestNeighbors = findNearestNeighbors(
    userDosages,
    panel,
    metadata,
    weights,
    k
  );

  // Calculate proportions based on method
  let subPopulationProportions: Record<SubPopulation, number>;

  if (method === 'knn') {
    subPopulationProportions = knnProportions(nearestNeighbors);
  } else if (method === 'empirical-em') {
    subPopulationProportions = empiricalEM(
      userDosages,
      panel,
      metadata,
      rsidToIndex,
      weights
    );
  } else {
    // Hybrid: use k-NN as prior for EM
    const knnPrior = knnProportions(nearestNeighbors);
    subPopulationProportions = empiricalEM(
      userDosages,
      panel,
      metadata,
      rsidToIndex,
      weights,
      { priorProportions: knnPrior }
    );
  }

  // Aggregate to super-populations for backward compatibility
  const superPopProportions = aggregateToSuperPop(subPopulationProportions);

  // Determine confidence
  let confidence: 'high' | 'moderate' | 'low';
  if (usableCount >= 500) {
    confidence = 'high';
  } else if (usableCount >= 100) {
    confidence = 'moderate';
  } else {
    confidence = 'low';
  }

  // Build composition for display
  const composition: AncestryComposition[] = (
    Object.entries(superPopProportions) as [InferencePopulation, number][]
  )
    .map(([pop, proportion]) => ({
      population: pop.toLowerCase() as never,
      category: {
        EUR: 'european',
        AFR: 'african',
        EAS: 'east_asian',
        SAS: 'south_asian',
        AMR: 'native_american',
      }[pop] as AncestryComposition['category'],
      percentage: Math.round(proportion * 1000) / 10,
      displayName: {
        EUR: 'European',
        AFR: 'African',
        EAS: 'East Asian',
        SAS: 'South Asian',
        AMR: 'Native American',
      }[pop],
    }))
    .filter(c => c.percentage >= 0.5)
    .sort((a, b) => b.percentage - a.percentage);

  return {
    proportions: superPopProportions,
    subPopulationProportions,
    nearestNeighbors,
    confidence,
    markersUsed: usableCount,
    markersAvailable: rsids.length,
    composition,
    method,
  };
}

/**
 * Get detailed sub-population composition for display
 */
export function getSubPopulationComposition(
  subProps: Record<SubPopulation, number>
): Array<{
  population: SubPopulation;
  superPopulation: InferencePopulation;
  percentage: number;
  displayName: string;
}> {
  return (Object.entries(subProps) as [SubPopulation, number][])
    .filter(([_, prop]) => prop >= 0.005) // At least 0.5%
    .map(([pop, prop]) => ({
      population: pop,
      superPopulation: SUB_TO_SUPER_POP[pop],
      percentage: Math.round(prop * 1000) / 10,
      displayName: SUB_POP_NAMES[pop],
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

// Map super-populations to their sub-populations
const SUPER_TO_SUB_POPS: Record<InferencePopulation, SubPopulation[]> = {
  EUR: ['CEU', 'TSI', 'FIN', 'GBR', 'IBS'],
  AFR: ['YRI', 'LWK', 'GWD', 'MSL', 'ESN', 'ASW', 'ACB'],
  EAS: ['CHB', 'JPT', 'CHS', 'CDX', 'KHV'],
  SAS: ['GIH', 'PJL', 'BEB', 'STU', 'ITU'],
  AMR: ['MXL', 'PUR', 'CLM', 'PEL'],
};

// Map category names to super-populations
const CATEGORY_TO_SUPER_POP: Record<string, InferencePopulation> = {
  european: 'EUR',
  african: 'AFR',
  east_asian: 'EAS',
  south_asian: 'SAS',
  native_american: 'AMR',
};

/**
 * Pre-computed sub-population allele frequencies for likelihood-based inference.
 * Lazily initialized on first use.
 */
let subPopFrequencyCache: Map<
  string,
  Map<SubPopulation, { freq: number; count: number }>
> | null = null;

/**
 * Compute and cache sub-population allele frequencies from the reference panel.
 */
async function getSubPopFrequencies(): Promise<
  Map<string, Map<SubPopulation, { freq: number; count: number }>>
> {
  if (subPopFrequencyCache) {
    return subPopFrequencyCache;
  }

  const { panel, metadata } = await loadReferencePanel();
  const { rsids } = panel.metadata;

  // Group samples by sub-population
  const samplesBySubPop = new Map<SubPopulation, number[]>();
  for (const info of metadata.sampleInfo) {
    const pop = info.population as SubPopulation;
    if (!samplesBySubPop.has(pop)) {
      samplesBySubPop.set(pop, []);
    }
    samplesBySubPop.get(pop)!.push(info.index);
  }

  // Calculate frequencies for each marker and sub-population
  const freqs = new Map<
    string,
    Map<SubPopulation, { freq: number; count: number }>
  >();

  for (const rsid of rsids) {
    const genotypeStr = panel.genotypes[rsid];
    if (!genotypeStr) continue;

    const markerFreqs = new Map<
      SubPopulation,
      { freq: number; count: number }
    >();

    for (const [subPop, samples] of samplesBySubPop.entries()) {
      let altCount = 0;
      let totalAlleles = 0;

      for (const idx of samples) {
        const d = genotypeStr[idx];
        if (d !== '9') {
          altCount += parseInt(d, 10);
          totalAlleles += 2;
        }
      }

      if (totalAlleles > 0) {
        markerFreqs.set(subPop, {
          freq: altCount / totalAlleles,
          count: totalAlleles / 2,
        });
      }
    }

    freqs.set(rsid, markerFreqs);
  }

  subPopFrequencyCache = freqs;
  return freqs;
}

/**
 * Refine ancestry segments with sub-population assignments using likelihood-based inference.
 * Uses sub-population-specific allele frequencies to compute the most likely sub-population
 * for each segment, which is more accurate than simple IBS similarity.
 */
export async function refineSegmentsWithSubPopulations(
  segments: import('@/types/genome').AncestrySegment[],
  parsedFile: import('./snpFileParser').ParsedSNPFile
): Promise<import('@/types/genome').AncestrySegment[]> {
  // Check if reference panel is available
  const panelAvailable = await isReferencePanelAvailable();
  if (!panelAvailable) {
    return segments; // Return unchanged if no panel
  }

  const { panel } = await loadReferencePanel();
  const { rsids } = panel.metadata;

  // Get pre-computed sub-population frequencies
  const subPopFreqs = await getSubPopFrequencies();

  // Build marker lookup by chromosome and position
  const markersByChrom = new Map<string, typeof aims.markers>();

  for (const marker of aims.markers) {
    if (!markersByChrom.has(marker.chromosome)) {
      markersByChrom.set(marker.chromosome, []);
    }
    markersByChrom.get(marker.chromosome)!.push(marker);
  }

  // Sort markers by position within each chromosome
  for (const markers of markersByChrom.values()) {
    markers.sort((a, b) => a.position - b.position);
  }

  // Build rsid to index mapping
  const rsidToIndex = new Map<string, number>();
  for (let i = 0; i < rsids.length; i++) {
    rsidToIndex.set(rsids[i], i);
  }

  // Process each segment
  const refinedSegments: import('@/types/genome').AncestrySegment[] = [];

  for (const segment of segments) {
    // Get the super-population for this segment
    const superPop = CATEGORY_TO_SUPER_POP[segment.category];
    if (!superPop) {
      refinedSegments.push(segment);
      continue;
    }

    // Get sub-populations to compare against
    const subPops = SUPER_TO_SUB_POPS[superPop];
    if (!subPops || subPops.length === 0) {
      refinedSegments.push(segment);
      continue;
    }

    // Find markers in this segment's region
    const chromMarkers = markersByChrom.get(segment.chromosome) || [];
    const segmentMarkers = chromMarkers.filter(
      m => m.position >= segment.start && m.position <= segment.end
    );

    if (segmentMarkers.length < 3) {
      // Not enough markers to refine
      refinedSegments.push(segment);
      continue;
    }

    // Get user dosages for segment markers
    const userGenotypes: Array<{ rsid: string; dosage: number }> = [];

    for (const marker of segmentMarkers) {
      const userSNP = parsedFile.snps.get(marker.rsid);
      const panelIndex = rsidToIndex.get(marker.rsid);

      if (userSNP && panelIndex !== undefined) {
        const dosage = userGenotypeToDosage(
          userSNP.genotype,
          marker.ref,
          marker.alt
        );
        if (dosage >= 0) {
          userGenotypes.push({ rsid: marker.rsid, dosage });
        }
      }
    }

    if (userGenotypes.length < 3) {
      refinedSegments.push(segment);
      continue;
    }

    // Calculate log-likelihood for each sub-population using allele frequencies
    const logLikelihoods: Map<SubPopulation, number> = new Map();
    for (const subPop of subPops) {
      logLikelihoods.set(subPop, 0);
    }

    for (const { rsid, dosage } of userGenotypes) {
      const markerFreqs = subPopFreqs.get(rsid);
      if (!markerFreqs) continue;

      for (const subPop of subPops) {
        const freqData = markerFreqs.get(subPop);
        if (!freqData || freqData.count < 5) continue;

        // Add small pseudocount to avoid log(0)
        const p = Math.max(0.001, Math.min(0.999, freqData.freq));

        // P(genotype | allele freq) under Hardy-Weinberg equilibrium
        let prob: number;
        if (dosage === 0) {
          prob = (1 - p) * (1 - p);
        } else if (dosage === 1) {
          prob = 2 * p * (1 - p);
        } else {
          prob = p * p;
        }

        logLikelihoods.set(
          subPop,
          (logLikelihoods.get(subPop) || 0) + Math.log(prob)
        );
      }
    }

    // Convert log-likelihoods to probabilities using softmax
    const maxLL = Math.max(...logLikelihoods.values());
    const expScores: Map<SubPopulation, number> = new Map();
    let totalExp = 0;

    for (const subPop of subPops) {
      const ll = logLikelihoods.get(subPop) || -Infinity;
      const expScore = Math.exp(ll - maxLL);
      expScores.set(subPop, expScore);
      totalExp += expScore;
    }

    // Find best sub-population
    let bestPop: SubPopulation | null = null;
    let bestProb = 0;
    let secondBestProb = 0;

    for (const subPop of subPops) {
      const prob = (expScores.get(subPop) || 0) / totalExp;
      if (prob > bestProb) {
        secondBestProb = bestProb;
        bestProb = prob;
        bestPop = subPop;
      } else if (prob > secondBestProb) {
        secondBestProb = prob;
      }
    }

    if (bestPop) {
      // Confidence based on how much better the best is than second best
      const confidence = bestProb - secondBestProb;

      refinedSegments.push({
        ...segment,
        subPopulation: bestPop,
        subPopulationName: SUB_POP_NAMES[bestPop],
        subPopulationConfidence: Math.min(1, Math.max(0, confidence * 2 + 0.5)),
      });
    } else {
      refinedSegments.push(segment);
    }
  }

  return refinedSegments;
}
