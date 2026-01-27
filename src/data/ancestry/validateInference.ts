/**
 * Validation script for ancestry inference
 *
 * Tests our inference algorithm against known 1000 Genomes samples.
 * Since we know the true population of each reference individual,
 * we can measure accuracy by running inference on their genotypes.
 *
 * Run with: npx tsx src/data/ancestry/validateInference.ts
 */

import { fileURLToPath as _fileURLToPath } from 'url';

// Load reference panel data
import panelData from './reference1000G.json';
import metadataData from './referenceMetadata.json';

interface Panel {
  metadata: {
    version: string;
    totalIndividuals: number;
    totalMarkers: number;
    rsids: string[];
    sampleIds: string[];
  };
  genotypes: Record<string, string>;
}

interface Metadata {
  populations: Record<
    string,
    { code: string; superPop: string; count: number; description: string }
  >;
  sampleInfo: Array<{
    id: string;
    population: string;
    superPopulation: string;
    index: number;
  }>;
}

const panel = panelData as Panel;
const metadata = metadataData as Metadata;

type SuperPop = 'EUR' | 'AFR' | 'EAS' | 'SAS' | 'AMR';
const SUPER_POPS: SuperPop[] = ['EUR', 'AFR', 'EAS', 'SAS', 'AMR'];

/**
 * Run EM-based admixture inference on a single sample's genotypes
 */
function inferAdmixtureForSample(
  sampleIdx: number,
  excludeSample: boolean = true
): Record<SuperPop, number> {
  const { rsids } = panel.metadata;

  // Initialize proportions uniformly
  let proportions: Record<SuperPop, number> = {
    EUR: 0.2,
    AFR: 0.2,
    EAS: 0.2,
    SAS: 0.2,
    AMR: 0.2,
  };

  // Get sample's dosages
  const sampleDosages: number[] = [];
  const validMarkerIndices: number[] = [];

  for (let i = 0; i < rsids.length; i++) {
    const rsid = rsids[i];
    const genotypeStr = panel.genotypes[rsid];
    if (!genotypeStr) continue;

    const dosageChar = genotypeStr[sampleIdx];
    if (dosageChar === '9') continue; // Missing

    sampleDosages.push(parseInt(dosageChar, 10));
    validMarkerIndices.push(i);
  }

  if (sampleDosages.length < 100) {
    console.warn(
      `Sample ${sampleIdx} has only ${sampleDosages.length} valid markers`
    );
    return proportions;
  }

  // Build population allele frequencies from reference panel (excluding this sample if requested)
  const popFreqs: Record<SuperPop, number[]> = {
    EUR: [],
    AFR: [],
    EAS: [],
    SAS: [],
    AMR: [],
  };

  // Count samples per population
  const popSamples: Record<SuperPop, number[]> = {
    EUR: [],
    AFR: [],
    EAS: [],
    SAS: [],
    AMR: [],
  };

  for (const info of metadata.sampleInfo) {
    if (excludeSample && info.index === sampleIdx) continue;
    const superPop = info.superPopulation as SuperPop;
    if (SUPER_POPS.includes(superPop)) {
      popSamples[superPop].push(info.index);
    }
  }

  // Calculate allele frequencies for each valid marker
  for (const markerIdx of validMarkerIndices) {
    const rsid = rsids[markerIdx];
    const genotypeStr = panel.genotypes[rsid];

    for (const pop of SUPER_POPS) {
      let altCount = 0;
      let totalAlleles = 0;

      for (const idx of popSamples[pop]) {
        const dosage = genotypeStr[idx];
        if (dosage !== '9') {
          altCount += parseInt(dosage, 10);
          totalAlleles += 2;
        }
      }

      // Add pseudocount to avoid zero frequencies
      const freq =
        totalAlleles > 0 ? (altCount + 0.5) / (totalAlleles + 1) : 0.5;
      popFreqs[pop].push(freq);
    }
  }

  // EM algorithm
  const maxIter = 50;
  const tolerance = 1e-6;

  for (let iter = 0; iter < maxIter; iter++) {
    // E-step: calculate responsibilities
    const responsibilities: number[][] = [];

    for (let i = 0; i < sampleDosages.length; i++) {
      const dosage = sampleDosages[i];
      const resp: number[] = [];
      let total = 0;

      for (const pop of SUPER_POPS) {
        const p = popFreqs[pop][i];
        // P(genotype | pop) under HWE
        let prob: number;
        if (dosage === 0) {
          prob = (1 - p) * (1 - p);
        } else if (dosage === 1) {
          prob = 2 * p * (1 - p);
        } else {
          prob = p * p;
        }
        const weighted = prob * proportions[pop];
        resp.push(weighted);
        total += weighted;
      }

      // Normalize
      responsibilities.push(resp.map(r => (total > 0 ? r / total : 0.2)));
    }

    // M-step: update proportions
    const newProportions: Record<SuperPop, number> = {
      EUR: 0,
      AFR: 0,
      EAS: 0,
      SAS: 0,
      AMR: 0,
    };

    for (let i = 0; i < responsibilities.length; i++) {
      for (let k = 0; k < SUPER_POPS.length; k++) {
        newProportions[SUPER_POPS[k]] += responsibilities[i][k];
      }
    }

    // Normalize
    const totalResp = Object.values(newProportions).reduce((a, b) => a + b, 0);
    for (const pop of SUPER_POPS) {
      newProportions[pop] /= totalResp;
    }

    // Check convergence
    let maxDiff = 0;
    for (const pop of SUPER_POPS) {
      maxDiff = Math.max(
        maxDiff,
        Math.abs(newProportions[pop] - proportions[pop])
      );
    }

    proportions = newProportions;

    if (maxDiff < tolerance) {
      break;
    }
  }

  return proportions;
}

/**
 * Run k-NN inference on a single sample
 */
function inferKNNForSample(
  sampleIdx: number,
  k: number = 20
): Record<SuperPop, number> {
  const { rsids, sampleIds: _sampleIds } = panel.metadata;

  // Calculate similarity to all other samples
  const similarities: Array<{
    idx: number;
    pop: SuperPop;
    similarity: number;
  }> = [];

  for (const info of metadata.sampleInfo) {
    if (info.index === sampleIdx) continue;

    let matches = 0;
    let comparisons = 0;

    for (const rsid of rsids) {
      const genotypeStr = panel.genotypes[rsid];
      if (!genotypeStr) continue;

      const d1 = genotypeStr[sampleIdx];
      const d2 = genotypeStr[info.index];

      if (d1 !== '9' && d2 !== '9') {
        // IBS similarity
        matches += 2 - Math.abs(parseInt(d1, 10) - parseInt(d2, 10));
        comparisons += 2;
      }
    }

    if (comparisons > 0) {
      similarities.push({
        idx: info.index,
        pop: info.superPopulation as SuperPop,
        similarity: matches / comparisons,
      });
    }
  }

  // Sort by similarity and take top k
  similarities.sort((a, b) => b.similarity - a.similarity);
  const topK = similarities.slice(0, k);

  // Count populations in top k
  const counts: Record<SuperPop, number> = {
    EUR: 0,
    AFR: 0,
    EAS: 0,
    SAS: 0,
    AMR: 0,
  };

  for (const neighbor of topK) {
    if (SUPER_POPS.includes(neighbor.pop)) {
      counts[neighbor.pop]++;
    }
  }

  // Convert to proportions
  const proportions: Record<SuperPop, number> = {
    EUR: counts.EUR / k,
    AFR: counts.AFR / k,
    EAS: counts.EAS / k,
    SAS: counts.SAS / k,
    AMR: counts.AMR / k,
  };

  return proportions;
}

/**
 * Main validation function
 */
async function runValidation() {
  console.log('Ancestry Inference Validation');
  console.log('=============================\n');
  console.log(
    `Reference panel: ${panel.metadata.totalIndividuals} individuals, ${panel.metadata.totalMarkers} markers\n`
  );

  // Sample a subset of individuals from each population for testing
  const samplesPerPop = 10;
  const testSamples: Array<{ idx: number; truePop: SuperPop; subPop: string }> =
    [];

  for (const pop of SUPER_POPS) {
    const popSamples = metadata.sampleInfo.filter(
      s => s.superPopulation === pop
    );
    // Take evenly spaced samples
    const step = Math.floor(popSamples.length / samplesPerPop);
    for (let i = 0; i < samplesPerPop && i * step < popSamples.length; i++) {
      const sample = popSamples[i * step];
      testSamples.push({
        idx: sample.index,
        truePop: pop,
        subPop: sample.population,
      });
    }
  }

  console.log(
    `Testing ${testSamples.length} samples (${samplesPerPop} per super-population)\n`
  );

  // Run inference on each test sample
  let emCorrect = 0;
  let knnCorrect = 0;
  const emConfusionMatrix: Record<SuperPop, Record<SuperPop, number>> = {
    EUR: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
    AFR: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
    EAS: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
    SAS: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
    AMR: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
  };

  const knnConfusionMatrix: Record<SuperPop, Record<SuperPop, number>> = {
    EUR: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
    AFR: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
    EAS: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
    SAS: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
    AMR: { EUR: 0, AFR: 0, EAS: 0, SAS: 0, AMR: 0 },
  };

  console.log('Running inference...\n');

  for (let i = 0; i < testSamples.length; i++) {
    const sample = testSamples[i];

    // EM inference
    const emResult = inferAdmixtureForSample(sample.idx, true);
    const emPredicted = SUPER_POPS.reduce((a, b) =>
      emResult[a] > emResult[b] ? a : b
    );

    // k-NN inference
    const knnResult = inferKNNForSample(sample.idx, 20);
    const knnPredicted = SUPER_POPS.reduce((a, b) =>
      knnResult[a] > knnResult[b] ? a : b
    );

    if (emPredicted === sample.truePop) emCorrect++;
    if (knnPredicted === sample.truePop) knnCorrect++;

    emConfusionMatrix[sample.truePop][emPredicted]++;
    knnConfusionMatrix[sample.truePop][knnPredicted]++;

    // Show progress
    if ((i + 1) % 10 === 0) {
      process.stdout.write(
        `\rProcessed ${i + 1}/${testSamples.length} samples...`
      );
    }
  }

  console.log('\n\n');

  // Print results
  console.log('=== EM ADMIXTURE RESULTS ===');
  console.log(
    `Accuracy: ${emCorrect}/${testSamples.length} (${((emCorrect / testSamples.length) * 100).toFixed(1)}%)\n`
  );

  console.log('Confusion Matrix (rows=true, cols=predicted):');
  console.log('      ' + SUPER_POPS.map(p => p.padStart(5)).join(' '));
  for (const truePop of SUPER_POPS) {
    const row = SUPER_POPS.map(predPop =>
      emConfusionMatrix[truePop][predPop].toString().padStart(5)
    ).join(' ');
    console.log(`${truePop}   ${row}`);
  }

  console.log('\n=== k-NN RESULTS (k=20) ===');
  console.log(
    `Accuracy: ${knnCorrect}/${testSamples.length} (${((knnCorrect / testSamples.length) * 100).toFixed(1)}%)\n`
  );

  console.log('Confusion Matrix (rows=true, cols=predicted):');
  console.log('      ' + SUPER_POPS.map(p => p.padStart(5)).join(' '));
  for (const truePop of SUPER_POPS) {
    const row = SUPER_POPS.map(predPop =>
      knnConfusionMatrix[truePop][predPop].toString().padStart(5)
    ).join(' ');
    console.log(`${truePop}   ${row}`);
  }

  // Per-population accuracy
  console.log('\n=== PER-POPULATION ACCURACY ===');
  console.log('Pop    EM     k-NN');
  for (const pop of SUPER_POPS) {
    const emAcc = emConfusionMatrix[pop][pop] / samplesPerPop;
    const knnAcc = knnConfusionMatrix[pop][pop] / samplesPerPop;
    console.log(
      `${pop}   ${(emAcc * 100).toFixed(0).padStart(4)}%  ${(knnAcc * 100).toFixed(0).padStart(4)}%`
    );
  }

  // Show some example predictions with confidence
  console.log('\n=== SAMPLE PREDICTIONS ===');
  console.log('Showing 3 samples per population:\n');

  for (const pop of SUPER_POPS) {
    console.log(`--- ${pop} samples ---`);
    const popSamples = testSamples.filter(s => s.truePop === pop).slice(0, 3);

    for (const sample of popSamples) {
      const emResult = inferAdmixtureForSample(sample.idx, true);
      const knnResult = inferKNNForSample(sample.idx, 20);

      console.log(`  ${sample.subPop}:`);
      console.log(
        `    EM:  ${SUPER_POPS.map(p => `${p}:${(emResult[p] * 100).toFixed(0)}%`).join(' ')}`
      );
      console.log(
        `    kNN: ${SUPER_POPS.map(p => `${p}:${(knnResult[p] * 100).toFixed(0)}%`).join(' ')}`
      );
    }
    console.log();
  }
}

/**
 * Calculate FST between two sub-populations for a marker
 */
function calculateFst(
  freq1: number,
  freq2: number,
  n1: number,
  n2: number
): number {
  const pBar = (freq1 * n1 + freq2 * n2) / (n1 + n2);
  if (pBar === 0 || pBar === 1) return 0;

  const hT = 2 * pBar * (1 - pBar);
  const hS =
    (n1 * 2 * freq1 * (1 - freq1) + n2 * 2 * freq2 * (1 - freq2)) / (n1 + n2);

  if (hT === 0) return 0;
  return (hT - hS) / hT;
}

/**
 * Pre-compute allele frequencies for each sub-population
 */
function computeSubPopFrequencies(): Record<
  string,
  Record<string, { freq: number; count: number }>
> {
  const { rsids } = panel.metadata;
  const freqs: Record<
    string,
    Record<string, { freq: number; count: number }>
  > = {};

  // Group samples by sub-population
  const samplesBySubPop: Record<string, number[]> = {};
  for (const info of metadata.sampleInfo) {
    if (!samplesBySubPop[info.population]) {
      samplesBySubPop[info.population] = [];
    }
    samplesBySubPop[info.population].push(info.index);
  }

  // Calculate frequencies for each marker and sub-population
  for (const rsid of rsids) {
    freqs[rsid] = {};
    const genotypeStr = panel.genotypes[rsid];
    if (!genotypeStr) continue;

    for (const [subPop, samples] of Object.entries(samplesBySubPop)) {
      let altCount = 0;
      let totalAlleles = 0;

      for (const idx of samples) {
        const d = genotypeStr[idx];
        if (d !== '9') {
          altCount += parseInt(d, 10);
          totalAlleles += 2;
        }
      }

      freqs[rsid][subPop] = {
        freq: totalAlleles > 0 ? altCount / totalAlleles : 0.5,
        count: totalAlleles / 2,
      };
    }
  }

  return freqs;
}

/**
 * Find markers most informative within a super-population (high FST between sub-pops)
 */
function findInformativeMarkers(
  _superPop: SuperPop,
  subPops: string[],
  subPopFreqs: Record<string, Record<string, { freq: number; count: number }>>,
  topN: number = 500
): string[] {
  const { rsids } = panel.metadata;

  const markerScores: Array<{ rsid: string; avgFst: number }> = [];

  for (const rsid of rsids) {
    const freqData = subPopFreqs[rsid];
    if (!freqData) continue;

    // Calculate average pairwise FST between sub-populations
    let totalFst = 0;
    let pairs = 0;

    for (let i = 0; i < subPops.length; i++) {
      for (let j = i + 1; j < subPops.length; j++) {
        const data1 = freqData[subPops[i]];
        const data2 = freqData[subPops[j]];
        if (data1 && data2 && data1.count > 10 && data2.count > 10) {
          const fst = calculateFst(
            data1.freq,
            data2.freq,
            data1.count,
            data2.count
          );
          if (fst > 0) {
            totalFst += fst;
            pairs++;
          }
        }
      }
    }

    if (pairs > 0) {
      markerScores.push({ rsid, avgFst: totalFst / pairs });
    }
  }

  // Sort by FST and return top markers
  markerScores.sort((a, b) => b.avgFst - a.avgFst);
  return markerScores.slice(0, topN).map(m => m.rsid);
}

/**
 * Likelihood-based sub-population inference
 */
function inferSubPopLikelihood(
  sampleIdx: number,
  subPops: string[],
  subPopFreqs: Record<string, Record<string, { freq: number; count: number }>>,
  markerSubset?: string[]
): Record<string, number> {
  const { rsids } = panel.metadata;
  const markersToUse = markerSubset || rsids;

  // Calculate log-likelihood for each sub-population
  const logLikelihoods: Record<string, number> = {};
  for (const sp of subPops) {
    logLikelihoods[sp] = 0;
  }

  for (const rsid of markersToUse) {
    const genotypeStr = panel.genotypes[rsid];
    if (!genotypeStr) continue;

    const d = genotypeStr[sampleIdx];
    if (d === '9') continue;

    const dosage = parseInt(d, 10);
    const freqData = subPopFreqs[rsid];
    if (!freqData) continue;

    for (const sp of subPops) {
      const data = freqData[sp];
      if (!data || data.count < 5) continue;

      // Add small pseudocount to avoid log(0)
      const p = Math.max(0.001, Math.min(0.999, data.freq));

      // P(genotype | allele freq) under HWE
      let prob: number;
      if (dosage === 0) {
        prob = (1 - p) * (1 - p);
      } else if (dosage === 1) {
        prob = 2 * p * (1 - p);
      } else {
        prob = p * p;
      }

      logLikelihoods[sp] += Math.log(prob);
    }
  }

  // Convert to probabilities (softmax)
  const maxLL = Math.max(...Object.values(logLikelihoods));
  const expScores: Record<string, number> = {};
  let totalExp = 0;

  for (const sp of subPops) {
    expScores[sp] = Math.exp(logLikelihoods[sp] - maxLL);
    totalExp += expScores[sp];
  }

  const probs: Record<string, number> = {};
  for (const sp of subPops) {
    probs[sp] = expScores[sp] / totalExp;
  }

  return probs;
}

/**
 * Weighted k-NN sub-population inference
 */
function inferSubPopWeightedKNN(
  sampleIdx: number,
  subPops: string[],
  samplesBySubPop: Record<string, number[]>,
  k: number = 50,
  markerSubset?: string[]
): Record<string, number> {
  const { rsids } = panel.metadata;
  const markersToUse = markerSubset || rsids;

  // Calculate similarity to all samples in the relevant sub-populations
  const similarities: Array<{
    idx: number;
    subPop: string;
    similarity: number;
  }> = [];

  for (const subPop of subPops) {
    for (const refIdx of samplesBySubPop[subPop] || []) {
      if (refIdx === sampleIdx) continue;

      let matches = 0;
      let comparisons = 0;

      for (const rsid of markersToUse) {
        const genotypeStr = panel.genotypes[rsid];
        if (!genotypeStr) continue;

        const d1 = genotypeStr[sampleIdx];
        const d2 = genotypeStr[refIdx];

        if (d1 !== '9' && d2 !== '9') {
          matches += 2 - Math.abs(parseInt(d1, 10) - parseInt(d2, 10));
          comparisons += 2;
        }
      }

      if (comparisons > 0) {
        similarities.push({
          idx: refIdx,
          subPop,
          similarity: matches / comparisons,
        });
      }
    }
  }

  // Sort by similarity and take top k
  similarities.sort((a, b) => b.similarity - a.similarity);
  const topK = similarities.slice(0, k);

  // Weight votes by similarity (use exponential weighting)
  const weights: Record<string, number> = {};
  for (const sp of subPops) {
    weights[sp] = 0;
  }

  // Use the min similarity as baseline
  const minSim = topK.length > 0 ? topK[topK.length - 1].similarity : 0;

  for (const neighbor of topK) {
    // Exponential weight based on similarity difference from minimum
    const weight = Math.exp(100 * (neighbor.similarity - minSim));
    weights[neighbor.subPop] += weight;
  }

  // Normalize
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const probs: Record<string, number> = {};
  for (const sp of subPops) {
    probs[sp] = total > 0 ? weights[sp] / total : 1 / subPops.length;
  }

  return probs;
}

/**
 * Combined inference: likelihood + weighted k-NN
 */
function inferSubPopCombined(
  sampleIdx: number,
  subPops: string[],
  samplesBySubPop: Record<string, number[]>,
  subPopFreqs: Record<string, Record<string, { freq: number; count: number }>>,
  informativeMarkers: string[]
): Record<string, number> {
  // Get predictions from both methods using informative markers
  const llProbs = inferSubPopLikelihood(
    sampleIdx,
    subPops,
    subPopFreqs,
    informativeMarkers
  );
  const knnProbs = inferSubPopWeightedKNN(
    sampleIdx,
    subPops,
    samplesBySubPop,
    30,
    informativeMarkers
  );

  // Combine with geometric mean (equivalent to log-linear combination)
  const combined: Record<string, number> = {};
  let total = 0;

  for (const sp of subPops) {
    combined[sp] = Math.sqrt(llProbs[sp] * knnProbs[sp]);
    total += combined[sp];
  }

  // Normalize
  for (const sp of subPops) {
    combined[sp] /= total;
  }

  return combined;
}

/**
 * Validate sub-population accuracy within each super-population
 */
async function runSubPopValidation() {
  console.log('\n\n========================================');
  console.log('SUB-POPULATION VALIDATION (IMPROVED)');
  console.log('========================================\n');

  console.log('Pre-computing sub-population allele frequencies...');
  const subPopFreqs = computeSubPopFrequencies();
  console.log('Done.\n');

  const subPopsBySuperPop: Record<SuperPop, string[]> = {
    EUR: ['CEU', 'TSI', 'FIN', 'GBR', 'IBS'],
    AFR: ['YRI', 'LWK', 'GWD', 'MSL', 'ESN', 'ASW', 'ACB'],
    EAS: ['CHB', 'JPT', 'CHS', 'CDX', 'KHV'],
    SAS: ['GIH', 'PJL', 'BEB', 'STU', 'ITU'],
    AMR: ['MXL', 'PUR', 'CLM', 'PEL'],
  };

  // Test sub-population classification within each super-population
  for (const superPop of SUPER_POPS) {
    const subPops = subPopsBySuperPop[superPop];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${superPop} Sub-populations: ${subPops.join(', ')}`);
    console.log('='.repeat(60));

    // Get samples for each sub-population
    const samplesBySubPop: Record<string, number[]> = {};
    for (const subPop of subPops) {
      samplesBySubPop[subPop] = metadata.sampleInfo
        .filter(s => s.population === subPop)
        .map(s => s.index);
    }

    // Find informative markers for this super-population
    console.log(
      '\nFinding informative markers within this super-population...'
    );
    const informativeMarkers = findInformativeMarkers(
      superPop,
      subPops,
      subPopFreqs,
      500
    );
    console.log(
      `Found ${informativeMarkers.length} informative markers (top by FST)\n`
    );

    // Test samples
    const samplesPerSubPop = 5;

    // Track results for each method
    const methods = [
      'Basic k-NN',
      'Likelihood',
      'Weighted k-NN',
      'Combined',
    ] as const;
    const results: Record<
      string,
      { correct: number; confusion: Record<string, Record<string, number>> }
    > = {};

    for (const method of methods) {
      results[method] = {
        correct: 0,
        confusion: {},
      };
      for (const sp of subPops) {
        results[method].confusion[sp] = {};
        for (const sp2 of subPops) {
          results[method].confusion[sp][sp2] = 0;
        }
      }
    }

    let totalTested = 0;

    for (const trueSubPop of subPops) {
      const samples = samplesBySubPop[trueSubPop].slice(0, samplesPerSubPop);

      for (const sampleIdx of samples) {
        totalTested++;

        // Method 1: Basic k-NN (original)
        const basicScores: Record<string, number> = {};
        for (const targetSubPop of subPops) {
          const targetSamples = samplesBySubPop[targetSubPop].filter(
            idx => idx !== sampleIdx
          );
          if (targetSamples.length === 0) continue;
          const samplesToCompare = targetSamples.slice(0, 20);
          let totalSimilarity = 0;
          for (const refIdx of samplesToCompare) {
            let matches = 0;
            let comparisons = 0;
            for (const rsid of panel.metadata.rsids) {
              const genotypeStr = panel.genotypes[rsid];
              if (!genotypeStr) continue;
              const d1 = genotypeStr[sampleIdx];
              const d2 = genotypeStr[refIdx];
              if (d1 !== '9' && d2 !== '9') {
                matches += 2 - Math.abs(parseInt(d1, 10) - parseInt(d2, 10));
                comparisons += 2;
              }
            }
            if (comparisons > 0) totalSimilarity += matches / comparisons;
          }
          basicScores[targetSubPop] = totalSimilarity / samplesToCompare.length;
        }
        const basicPred = subPops.reduce((a, b) =>
          (basicScores[a] || 0) > (basicScores[b] || 0) ? a : b
        );
        results['Basic k-NN'].confusion[trueSubPop][basicPred]++;
        if (basicPred === trueSubPop) results['Basic k-NN'].correct++;

        // Method 2: Likelihood with informative markers
        const llProbs = inferSubPopLikelihood(
          sampleIdx,
          subPops,
          subPopFreqs,
          informativeMarkers
        );
        const llPred = subPops.reduce((a, b) =>
          llProbs[a] > llProbs[b] ? a : b
        );
        results['Likelihood'].confusion[trueSubPop][llPred]++;
        if (llPred === trueSubPop) results['Likelihood'].correct++;

        // Method 3: Weighted k-NN with informative markers
        const wknnProbs = inferSubPopWeightedKNN(
          sampleIdx,
          subPops,
          samplesBySubPop,
          50,
          informativeMarkers
        );
        const wknnPred = subPops.reduce((a, b) =>
          wknnProbs[a] > wknnProbs[b] ? a : b
        );
        results['Weighted k-NN'].confusion[trueSubPop][wknnPred]++;
        if (wknnPred === trueSubPop) results['Weighted k-NN'].correct++;

        // Method 4: Combined
        const combProbs = inferSubPopCombined(
          sampleIdx,
          subPops,
          samplesBySubPop,
          subPopFreqs,
          informativeMarkers
        );
        const combPred = subPops.reduce((a, b) =>
          combProbs[a] > combProbs[b] ? a : b
        );
        results['Combined'].confusion[trueSubPop][combPred]++;
        if (combPred === trueSubPop) results['Combined'].correct++;
      }
    }

    // Print comparison of methods
    console.log('Method Comparison:');
    console.log('-'.repeat(40));
    for (const method of methods) {
      const acc = ((results[method].correct / totalTested) * 100).toFixed(1);
      console.log(
        `${method.padEnd(15)} ${results[method].correct}/${totalTested} (${acc}%)`
      );
    }

    // Print detailed results for best method (Combined)
    const bestMethod = 'Combined';
    console.log(`\nDetailed results for ${bestMethod}:`);

    const colWidth = 5;
    console.log('\nConfusion Matrix (rows=true, cols=predicted):');
    console.log('     ' + subPops.map(p => p.padStart(colWidth)).join(' '));
    for (const truePop of subPops) {
      const row = subPops
        .map(predPop =>
          results[bestMethod].confusion[truePop][predPop]
            .toString()
            .padStart(colWidth)
        )
        .join(' ');
      console.log(`${truePop.padEnd(4)} ${row}`);
    }

    console.log('\nPer sub-population accuracy:');
    for (const sp of subPops) {
      const correct = results[bestMethod].confusion[sp][sp];
      const total = Object.values(results[bestMethod].confusion[sp]).reduce(
        (a, b) => a + b,
        0
      );
      const acc = total > 0 ? ((correct / total) * 100).toFixed(0) : 'N/A';
      console.log(`  ${sp}: ${correct}/${total} (${acc}%)`);
    }
  }

  // Summary comparison
  console.log('\n\n' + '='.repeat(60));
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(60));
  console.log('\nKey improvements:');
  console.log(
    '1. Marker filtering: Select top 500 markers with highest within-group FST'
  );
  console.log(
    '2. Likelihood-based: Use actual allele frequencies per sub-population'
  );
  console.log('3. Weighted k-NN: Weight neighbors by similarity (exponential)');
  console.log('4. Combined: Geometric mean of likelihood and weighted k-NN');
}

async function main() {
  await runValidation();
  await runSubPopValidation();
}

main().catch(console.error);
