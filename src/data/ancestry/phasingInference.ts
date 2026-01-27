/**
 * Statistical Phasing using Li & Stephens Haplotype Copying Model
 *
 * This module implements phasing to determine which alleles are on the
 * same chromosome (haplotype). For a heterozygous genotype "AG", phasing
 * determines if A is on haplotype 1 (maternal) and G on haplotype 2 (paternal),
 * or vice versa.
 *
 * Algorithm:
 * The Li & Stephens model treats each haplotype as a mosaic of reference
 * haplotypes. At each position, we're "copying" from one reference haplotype,
 * with occasional switches (recombination events).
 *
 * Hidden States: Each state represents copying from a specific reference haplotype
 * Transitions: P(switch) ≈ 1 - exp(-ρd) where ρ = recombination rate, d = distance
 * Emissions: P(observed allele | copied haplotype) with error rate ε
 *
 * Optimizations for browser:
 * - Log-space arithmetic throughout
 * - Limit reference haplotypes to reduce state space
 * - Pre-compute transition probabilities
 * - Process chromosomes independently
 */

import type { ParsedSNPFile } from './snpFileParser';
import type {
  PhasedReferencePanel,
  PhasedReferenceMetadata,
} from './buildPhasedPanel';
import aimsData from './ancestryAIMs_expanded.json';

// Recombination rate: ~1 cM per Mb = 0.01 recombinations per Mb
const RECOMB_RATE_PER_BP = 1e-8;

// Error rate for allele copying (accounts for mutations and genotyping errors)
const COPY_ERROR_RATE = 0.001;

// Log of minimum probability to prevent -Infinity
const LOG_MIN_PROB = -50;

// Maximum number of reference haplotypes to use (for computational efficiency)
const MAX_REF_HAPLOTYPES = 500;

// Type the imported JSON
const aims = aimsData as {
  metadata: Record<string, unknown>;
  markers: Array<{
    rsid: string;
    chromosome: string;
    position: number;
    ref: string;
    alt: string;
    frequencies: Record<string, number>;
  }>;
};

// Cached markers by chromosome
let markersByChromosome: Map<
  string,
  Array<{
    rsid: string;
    chromosome: string;
    position: number;
    ref: string;
    alt: string;
  }>
> | null = null;

// Lazy-loaded phased reference panel
let phasedPanel: PhasedReferencePanel | null = null;
let phasedMetadata: PhasedReferenceMetadata | null = null;
let panelLoadPromise: Promise<void> | null = null;

/**
 * Result of phasing a user's genotypes
 */
export interface PhasingResult {
  // Phased genotypes: rsid -> [hap1_allele, hap2_allele]
  phasedGenotypes: Map<string, [string, string]>;

  // Confidence per marker (0-1, based on posterior probability)
  phaseConfidence: Map<string, number>;

  // Summary statistics
  markersPhased: number;
  homozygousMarkers: number;
  heterozygousMarkers: number;
  averageConfidence: number;
  estimatedSwitchErrorRate: number;

  // Per-chromosome results
  chromosomeResults: Map<
    string,
    {
      markersPhased: number;
      averageConfidence: number;
    }
  >;
}

/**
 * Check if phased reference panel is available
 */
export async function isPhasedPanelAvailable(): Promise<boolean> {
  try {
    const panelModule = await import('./referencePhasedPanel.json');
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
 * Load the phased reference panel
 */
export async function loadPhasedPanel(): Promise<{
  panel: PhasedReferencePanel;
  metadata: PhasedReferenceMetadata;
}> {
  if (phasedPanel && phasedMetadata) {
    return { panel: phasedPanel, metadata: phasedMetadata };
  }

  if (panelLoadPromise) {
    await panelLoadPromise;
    return { panel: phasedPanel!, metadata: phasedMetadata! };
  }

  panelLoadPromise = (async () => {
    try {
      const [panelModule, metadataModule] = await Promise.all([
        import('./referencePhasedPanel.json'),
        import('./referencePhasedMetadata.json'),
      ]);

      phasedPanel = panelModule.default as PhasedReferencePanel;
      phasedMetadata = metadataModule.default as PhasedReferenceMetadata;

      if (phasedPanel.metadata.version === 'PLACEHOLDER') {
        panelLoadPromise = null;
        throw new Error(
          'Phased panel not built. Run: npx tsx src/data/ancestry/buildPhasedPanel.ts'
        );
      }
    } catch (_err) {
      panelLoadPromise = null;
      throw new Error(
        'Phased panel not found. Run: npx tsx src/data/ancestry/buildPhasedPanel.ts'
      );
    }
  })();

  await panelLoadPromise;
  return { panel: phasedPanel!, metadata: phasedMetadata! };
}

function getMarkersByChromosome(): Map<
  string,
  Array<{
    rsid: string;
    chromosome: string;
    position: number;
    ref: string;
    alt: string;
  }>
> {
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
 * Safe log function that clamps to LOG_MIN_PROB
 */
function safeLog(x: number): number {
  return x > 0 ? Math.log(x) : LOG_MIN_PROB;
}

/**
 * Log-sum-exp for numerical stability
 */
function logSumExp(arr: Float64Array): number {
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
 * Log-sum-exp for two values
 */
function logSumExp2(a: number, b: number): number {
  if (a === LOG_MIN_PROB) return b;
  if (b === LOG_MIN_PROB) return a;
  const max = Math.max(a, b);
  return max + Math.log(Math.exp(a - max) + Math.exp(b - max));
}

/**
 * Select a subset of reference haplotypes for efficiency
 * Prioritizes diversity across populations
 */
function selectReferenceHaplotypes(
  metadata: PhasedReferenceMetadata,
  maxHaplotypes: number
): number[] {
  const selected: number[] = [];
  const { sampleInfo } = metadata;

  // Group samples by super-population
  const samplesByPop: Map<string, number[]> = new Map();
  for (const info of sampleInfo) {
    if (!samplesByPop.has(info.superPopulation)) {
      samplesByPop.set(info.superPopulation, []);
    }
    // Add both haplotype indices
    samplesByPop.get(info.superPopulation)!.push(...info.haplotypeIndices);
  }

  // Allocate haplotypes proportionally to population size
  const totalHaplotypes = metadata.totalHaplotypes;
  for (const [_pop, hapIndices] of samplesByPop.entries()) {
    const proportion = hapIndices.length / totalHaplotypes;
    const numToSelect = Math.max(10, Math.floor(proportion * maxHaplotypes));

    // Randomly sample (using deterministic sampling for reproducibility)
    const step = Math.max(1, Math.floor(hapIndices.length / numToSelect));
    for (
      let i = 0;
      i < hapIndices.length && selected.length < maxHaplotypes;
      i += step
    ) {
      selected.push(hapIndices[i]);
    }
  }

  return selected.slice(0, maxHaplotypes);
}

/**
 * Extract reference haplotypes for a set of markers
 * Returns array of haplotype strings (one char per marker position)
 */
function extractReferenceHaplotypes(
  panel: PhasedReferencePanel,
  markerRsids: string[],
  haplotypeIndices: number[]
): string[] {
  const numHaps = haplotypeIndices.length;

  // Initialize haplotype strings
  const haplotypes: string[] = new Array(numHaps).fill('');

  for (const rsid of markerRsids) {
    const hapStr = panel.haplotypes[rsid];
    if (!hapStr) {
      // Missing marker - add '9' for all haplotypes
      for (let h = 0; h < numHaps; h++) {
        haplotypes[h] += '9';
      }
      continue;
    }

    for (let h = 0; h < numHaps; h++) {
      const hapIdx = haplotypeIndices[h];
      haplotypes[h] += hapStr[hapIdx] ?? '9';
    }
  }

  return haplotypes;
}

/**
 * Phase a single chromosome using Li & Stephens HMM
 *
 * For each heterozygous site, we determine which phase configuration
 * is most likely given the reference panel.
 */
function phaseChromosome(
  markers: Array<{ rsid: string; position: number; ref: string; alt: string }>,
  userGenotypes: Map<string, { genotype: string; rsid: string }>,
  refHaplotypes: string[],
  _haplotypeIndices: number[]
): {
  phasedGenotypes: Map<string, [string, string]>;
  phaseConfidence: Map<string, number>;
  heterozygousCount: number;
} {
  const numMarkers = markers.length;
  const numRefHaps = refHaplotypes.length;

  if (numMarkers === 0 || numRefHaps === 0) {
    return {
      phasedGenotypes: new Map(),
      phaseConfidence: new Map(),
      heterozygousCount: 0,
    };
  }

  // Extract user alleles and identify heterozygous sites
  const userAlleles: Array<{
    rsid: string;
    allele1: string;
    allele2: string;
    isHet: boolean;
    ref: string;
    alt: string;
  }> = [];

  for (const marker of markers) {
    const snp = userGenotypes.get(marker.rsid);
    if (!snp || !snp.genotype || snp.genotype === '--') {
      userAlleles.push({
        rsid: marker.rsid,
        allele1: '9',
        allele2: '9',
        isHet: false,
        ref: marker.ref,
        alt: marker.alt,
      });
      continue;
    }

    const alleles = snp.genotype.split('');
    if (alleles.length !== 2) {
      userAlleles.push({
        rsid: marker.rsid,
        allele1: '9',
        allele2: '9',
        isHet: false,
        ref: marker.ref,
        alt: marker.alt,
      });
      continue;
    }

    userAlleles.push({
      rsid: marker.rsid,
      allele1: alleles[0],
      allele2: alleles[1],
      isHet: alleles[0] !== alleles[1],
      ref: marker.ref,
      alt: marker.alt,
    });
  }

  // Count heterozygous sites
  const heterozygousCount = userAlleles.filter(a => a.isHet).length;

  if (heterozygousCount === 0) {
    // All homozygous - trivial phasing
    const phasedGenotypes = new Map<string, [string, string]>();
    const phaseConfidence = new Map<string, number>();

    for (const ua of userAlleles) {
      if (ua.allele1 !== '9') {
        phasedGenotypes.set(ua.rsid, [ua.allele1, ua.allele2]);
        phaseConfidence.set(ua.rsid, 1.0);
      }
    }

    return { phasedGenotypes, phaseConfidence, heterozygousCount };
  }

  // Li & Stephens HMM
  // State: (refHap1, refHap2, phase) where phase is 0 or 1
  // We simplify by considering pairs of reference haplotypes
  //
  // For efficiency, we use a reduced model:
  // - Track copying state for each user haplotype independently
  // - Then combine to determine phase at heterozygous sites

  // Forward algorithm for haplotype 1 (assuming phase 0: allele1 on hap1)
  // and haplotype 2 (allele2 on hap1)
  // Compare likelihoods to determine most likely phase

  const logPrior = safeLog(1 / numRefHaps);

  // Compute emission probability (log)
  const logEmission = (userAllele: string, refAllele: string): number => {
    if (userAllele === '9' || refAllele === '9') {
      return 0; // Uninformative
    }

    // Convert to 0/1 encoding
    const userIsAlt = userAllele !== userAlleles[0]?.ref ? 1 : 0;
    const refIsAlt = refAllele === '1' ? 1 : 0;

    if (userIsAlt === refIsAlt) {
      return safeLog(1 - COPY_ERROR_RATE);
    } else {
      return safeLog(COPY_ERROR_RATE);
    }
  };

  // Simplified forward algorithm for one haplotype
  const forwardOneHaplotype = (
    userAlleleSequence: string[]
  ): Float64Array[] => {
    const logAlpha: Float64Array[] = [];

    // Initialize
    const alpha0 = new Float64Array(numRefHaps);
    for (let k = 0; k < numRefHaps; k++) {
      const refAllele = refHaplotypes[k][0];
      alpha0[k] = logPrior + logEmission(userAlleleSequence[0], refAllele);
    }
    logAlpha.push(alpha0);

    // Forward pass
    for (let t = 1; t < numMarkers; t++) {
      const alphaT = new Float64Array(numRefHaps);
      const geneticDist = markers[t].position - markers[t - 1].position;
      const recombProb = Math.min(0.5, geneticDist * RECOMB_RATE_PER_BP);
      const logRecomb = safeLog(recombProb);
      const log1MinusRecomb = safeLog(1 - recombProb);

      // Sum over previous states
      const logSumPrev = logSumExp(logAlpha[t - 1]);

      for (let k = 0; k < numRefHaps; k++) {
        const refAllele = refHaplotypes[k][t];
        const emission = logEmission(userAlleleSequence[t], refAllele);

        // Transition: stay or switch
        const logStay = log1MinusRecomb + logAlpha[t - 1][k];
        const logSwitch = logRecomb + logPrior + logSumPrev;

        alphaT[k] = emission + logSumExp2(logStay, logSwitch);
      }

      logAlpha.push(alphaT);
    }

    return logAlpha;
  };

  // Compute forward probabilities for both phase configurations
  // Phase 0: haplotype1 gets allele1, haplotype2 gets allele2
  // Phase 1: haplotype1 gets allele2, haplotype2 gets allele1

  const allele1Seq = userAlleles.map(ua => {
    if (ua.allele1 === '9') return '9';
    return ua.allele1 === ua.alt ? '1' : '0';
  });

  const allele2Seq = userAlleles.map(ua => {
    if (ua.allele2 === '9') return '9';
    return ua.allele2 === ua.alt ? '1' : '0';
  });

  // Phase 0: hap1 = allele1, hap2 = allele2
  const alpha1_phase0 = forwardOneHaplotype(allele1Seq);
  const alpha2_phase0 = forwardOneHaplotype(allele2Seq);

  // Phase 1: hap1 = allele2, hap2 = allele1
  const alpha1_phase1 = forwardOneHaplotype(allele2Seq);
  const alpha2_phase1 = forwardOneHaplotype(allele1Seq);

  // Determine phase at each heterozygous site based on local likelihood
  const phasedGenotypes = new Map<string, [string, string]>();
  const phaseConfidence = new Map<string, number>();

  // Track phase switches to estimate switch error rate
  let currentPhase = 0;

  for (let t = 0; t < numMarkers; t++) {
    const ua = userAlleles[t];

    if (ua.allele1 === '9') {
      continue; // Skip missing
    }

    if (!ua.isHet) {
      // Homozygous - no phasing needed
      phasedGenotypes.set(ua.rsid, [ua.allele1, ua.allele2]);
      phaseConfidence.set(ua.rsid, 1.0);
      continue;
    }

    // Heterozygous - compare phase likelihoods
    const logL_phase0 =
      logSumExp(alpha1_phase0[t]) + logSumExp(alpha2_phase0[t]);
    const logL_phase1 =
      logSumExp(alpha1_phase1[t]) + logSumExp(alpha2_phase1[t]);

    // Posterior probability of phase 0
    const maxLogL = Math.max(logL_phase0, logL_phase1);
    const prob0 =
      Math.exp(logL_phase0 - maxLogL) /
      (Math.exp(logL_phase0 - maxLogL) + Math.exp(logL_phase1 - maxLogL));

    const phase = prob0 >= 0.5 ? 0 : 1;
    const confidence = phase === 0 ? prob0 : 1 - prob0;

    if (phase === 0) {
      phasedGenotypes.set(ua.rsid, [ua.allele1, ua.allele2]);
    } else {
      phasedGenotypes.set(ua.rsid, [ua.allele2, ua.allele1]);
    }
    phaseConfidence.set(ua.rsid, confidence);

    // Track phase changes for switch error estimation
    if (t > 0 && phase !== currentPhase) {
      // This could be a true recombination or a phase error
      // We'll use this for switch error rate estimation
    }
    currentPhase = phase;
  }

  return { phasedGenotypes, phaseConfidence, heterozygousCount };
}

/**
 * Phase user genotypes using Li & Stephens HMM
 *
 * @param parsedFile - Parsed SNP file with user genotypes
 * @returns Phasing result with phased genotypes and confidence scores
 */
export async function phaseUserGenotypes(
  parsedFile: ParsedSNPFile
): Promise<PhasingResult> {
  // Check if panel is available
  const available = await isPhasedPanelAvailable();
  if (!available) {
    throw new Error(
      'Phased reference panel not available. Run: npx tsx src/data/ancestry/buildPhasedPanel.ts'
    );
  }

  const { panel, metadata } = await loadPhasedPanel();
  const markersByChr = getMarkersByChromosome();

  // Select subset of reference haplotypes for efficiency
  const selectedHapIndices = selectReferenceHaplotypes(
    metadata,
    MAX_REF_HAPLOTYPES
  );

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

  const allPhasedGenotypes = new Map<string, [string, string]>();
  const allPhaseConfidence = new Map<string, number>();
  const chromosomeResults = new Map<
    string,
    { markersPhased: number; averageConfidence: number }
  >();

  let totalMarkersPhased = 0;
  let totalHomozygous = 0;
  let totalHeterozygous = 0;
  let totalConfidence = 0;

  for (const chr of chromosomes) {
    const chrMarkers = markersByChr.get(chr);
    if (!chrMarkers || chrMarkers.length === 0) {
      continue;
    }

    // Get available markers (those present in both user data and panel)
    const availableMarkers = chrMarkers.filter(
      m => parsedFile.snps.has(m.rsid) && panel.haplotypes[m.rsid]
    );

    if (availableMarkers.length < 2) {
      continue;
    }

    // Extract reference haplotypes for this chromosome's markers
    const markerRsids = availableMarkers.map(m => m.rsid);
    const refHaplotypes = extractReferenceHaplotypes(
      panel,
      markerRsids,
      selectedHapIndices
    );

    // Build user genotype map for this chromosome
    const userGenotypes = new Map<string, { genotype: string; rsid: string }>();
    for (const marker of availableMarkers) {
      const snp = parsedFile.snps.get(marker.rsid);
      if (snp) {
        userGenotypes.set(marker.rsid, {
          genotype: snp.genotype,
          rsid: marker.rsid,
        });
      }
    }

    // Phase this chromosome
    const result = phaseChromosome(
      availableMarkers,
      userGenotypes,
      refHaplotypes,
      selectedHapIndices
    );

    // Merge results
    for (const [rsid, phased] of result.phasedGenotypes) {
      allPhasedGenotypes.set(rsid, phased);
    }
    for (const [rsid, confidence] of result.phaseConfidence) {
      allPhaseConfidence.set(rsid, confidence);
      totalConfidence += confidence;
    }

    const markersPhased = result.phasedGenotypes.size;
    const avgConfidence =
      markersPhased > 0
        ? Array.from(result.phaseConfidence.values()).reduce(
            (a, b) => a + b,
            0
          ) / markersPhased
        : 0;

    chromosomeResults.set(chr, {
      markersPhased,
      averageConfidence: avgConfidence,
    });

    totalMarkersPhased += markersPhased;
    totalHeterozygous += result.heterozygousCount;
    totalHomozygous += markersPhased - result.heterozygousCount;
  }

  // Estimate switch error rate (based on average heterozygous confidence)
  const avgHetConfidence =
    totalHeterozygous > 0
      ? (totalConfidence - totalHomozygous) / totalHeterozygous
      : 1.0;
  const estimatedSwitchErrorRate = 1 - avgHetConfidence;

  return {
    phasedGenotypes: allPhasedGenotypes,
    phaseConfidence: allPhaseConfidence,
    markersPhased: totalMarkersPhased,
    homozygousMarkers: totalHomozygous,
    heterozygousMarkers: totalHeterozygous,
    averageConfidence:
      totalMarkersPhased > 0 ? totalConfidence / totalMarkersPhased : 0,
    estimatedSwitchErrorRate,
    chromosomeResults,
  };
}
