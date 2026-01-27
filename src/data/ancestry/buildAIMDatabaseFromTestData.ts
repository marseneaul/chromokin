/**
 * Build expanded AIM database from test data
 *
 * This script:
 * 1. Reads rsids from the test SNP file
 * 2. Queries Ensembl for population frequencies (in batches)
 * 3. Calculates Fst/informativeness for each
 * 4. Keeps the most informative markers
 *
 * This ensures markers are both informative AND present on consumer arrays.
 *
 * Run with: npx tsx src/data/ancestry/buildAIMDatabaseFromTestData.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensembl REST API endpoint
const ENSEMBL_API = 'https://rest.ensembl.org';

// gnomAD population mapping
const GNOMAD_MAPPING: Record<string, string> = {
  'gnomADe:nfe': 'EUR',
  'gnomADe:fin': 'EUR',
  'gnomADe:afr': 'AFR',
  'gnomADe:eas': 'EAS',
  'gnomADe:sas': 'SAS',
  'gnomADe:amr': 'AMR',
  'gnomADg:nfe': 'EUR',
  'gnomADg:fin': 'EUR',
  'gnomADg:afr': 'AFR',
  'gnomADg:eas': 'EAS',
  'gnomADg:sas': 'SAS',
  'gnomADg:amr': 'AMR',
};

// 1000 Genomes population mapping
const POP_1KG_MAPPING: Record<string, string> = {
  CEU: 'EUR',
  GBR: 'EUR',
  FIN: 'EUR',
  IBS: 'EUR',
  TSI: 'EUR',
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
  EUR: 'EUR',
  AFR: 'AFR',
  EAS: 'EAS',
  SAS: 'SAS',
  AMR: 'AMR',
};

interface EnsemblPopulation {
  population: string;
  frequency: number;
  allele?: string;
}

interface EnsemblVariant {
  name: string;
  mappings?: Array<{
    seq_region_name: string;
    start: number;
    end: number;
    allele_string: string;
  }>;
  populations?: EnsemblPopulation[];
}

interface AIMMarker {
  rsid: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  frequencies: Record<string, number>;
  informativeness: number;
}

/**
 * Load rsids from test file
 */
function loadTestFileRsids(filename: string): string[] {
  const filepath = path.join(__dirname, '../test-data', filename);

  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    return [];
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  const rsids: string[] = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const parts = line.split('\t');
    if (parts[0]?.startsWith('rs')) {
      rsids.push(parts[0]);
    }
  }

  return rsids;
}

/**
 * Load existing markers to avoid duplicates
 */
function loadExistingMarkers(): Set<string> {
  const aimsPath = path.join(__dirname, 'ancestryAIMs_expanded.json');
  if (!fs.existsSync(aimsPath)) {
    return new Set();
  }
  const data = JSON.parse(fs.readFileSync(aimsPath, 'utf-8'));
  return new Set(data.markers.map((m: { rsid: string }) => m.rsid));
}

/**
 * Fetch variants in batch from Ensembl POST endpoint
 */
async function fetchVariantsBatch(
  rsids: string[]
): Promise<Map<string, EnsemblVariant>> {
  const results = new Map<string, EnsemblVariant>();

  try {
    const response = await fetch(`${ENSEMBL_API}/variation/human?pops=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ids: rsids }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait and retry
        console.log('  Rate limited, waiting 5s...');
        await sleep(5000);
        return fetchVariantsBatch(rsids);
      }
      console.error(`  Batch request failed: ${response.status}`);
      return results;
    }

    const data = (await response.json()) as Record<string, EnsemblVariant>;

    for (const [rsid, variant] of Object.entries(data)) {
      if (variant) {
        results.set(rsid, variant);
      }
    }
  } catch (error) {
    console.error('  Batch request error:', error);
  }

  return results;
}

/**
 * Extract population frequencies from variant data
 */
function extractFrequencies(
  variant: EnsemblVariant,
  altAllele: string
): Record<string, number> | null {
  if (!variant.populations) return null;

  const freqs: Record<string, number[]> = {
    EUR: [],
    AFR: [],
    EAS: [],
    SAS: [],
    AMR: [],
  };

  for (const pop of variant.populations) {
    // Filter by alt allele if specified
    if (pop.allele && pop.allele !== altAllele) {
      continue;
    }

    // Check gnomAD populations
    const gnomadPop = GNOMAD_MAPPING[pop.population];
    if (gnomadPop) {
      freqs[gnomadPop].push(pop.frequency);
      continue;
    }

    // Check 1000 Genomes populations
    const kgPop = POP_1KG_MAPPING[pop.population];
    if (kgPop) {
      freqs[kgPop].push(pop.frequency);
    }
  }

  // Average frequencies for each population
  const result: Record<string, number> = {};
  let hasData = false;
  let popCount = 0;

  for (const [pop, values] of Object.entries(freqs)) {
    if (values.length > 0) {
      result[pop] = values.reduce((a, b) => a + b, 0) / values.length;
      hasData = true;
      popCount++;
    }
  }

  // Need data for at least 4 populations
  if (!hasData || popCount < 4) return null;

  // Fill missing with average
  const avg = Object.values(result).reduce((a, b) => a + b, 0) / popCount;
  for (const pop of ['EUR', 'AFR', 'EAS', 'SAS', 'AMR']) {
    if (result[pop] === undefined) {
      result[pop] = avg;
    }
  }

  return result;
}

/**
 * Calculate Weir-Cockerham Fst (simplified)
 * Higher values = more ancestry-informative
 */
function calculateFst(frequencies: Record<string, number>): number {
  const freqs = Object.values(frequencies);
  const n = freqs.length;
  if (n < 2) return 0;

  const pBar = freqs.reduce((a, b) => a + b, 0) / n;
  if (pBar === 0 || pBar === 1) return 0;

  const variance = freqs.reduce((sum, p) => sum + (p - pBar) ** 2, 0) / n;
  const fst = variance / (pBar * (1 - pBar));

  return Math.min(1, Math.max(0, fst));
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Main function
 */
async function main() {
  console.log('Building expanded AIM database from test data...\n');

  // Load existing markers
  const existingMarkers = loadExistingMarkers();
  console.log(`Existing markers: ${existingMarkers.size}`);

  // Load rsids from test file
  const testRsids = loadTestFileRsids('ancestry.txt');
  console.log(`Test file rsids: ${testRsids.length}`);

  // Filter out existing markers
  const newRsids = testRsids.filter(rsid => !existingMarkers.has(rsid));
  console.log(`New rsids to check: ${newRsids.length}`);

  // Shuffle and limit to a reasonable number for API calls
  const MAX_TO_CHECK = 50000; // Check up to 50k variants
  const BATCH_SIZE = 200; // Ensembl accepts up to 200 per batch
  const MIN_FST = 0.08; // Minimum Fst to be considered informative

  const shuffled = shuffle(newRsids).slice(0, MAX_TO_CHECK);
  console.log(
    `Will check ${shuffled.length} variants in batches of ${BATCH_SIZE}\n`
  );

  const newMarkers: AIMMarker[] = [];
  let processed = 0;
  let found = 0;

  // Process in batches
  for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
    const batch = shuffled.slice(i, i + BATCH_SIZE);
    processed += batch.length;

    process.stdout.write(
      `\rProcessed ${processed}/${shuffled.length} | Found ${found} informative markers...`
    );

    const variants = await fetchVariantsBatch(batch);

    for (const [rsid, variant] of variants) {
      // Get mapping info
      const mapping = variant.mappings?.[0];
      if (!mapping) continue;

      const alleles = mapping.allele_string.split('/');
      if (alleles.length !== 2) continue;

      const [ref, alt] = alleles;
      if (ref.length > 1 || alt.length > 1) continue; // Skip indels

      // Extract frequencies
      const frequencies = extractFrequencies(variant, alt);
      if (!frequencies) continue;

      // Calculate Fst
      const fst = calculateFst(frequencies);
      if (fst < MIN_FST) continue;

      newMarkers.push({
        rsid,
        chromosome: mapping.seq_region_name,
        position: mapping.start,
        ref,
        alt,
        frequencies,
        informativeness: fst,
      });

      found++;
    }

    // Rate limiting - be nice to Ensembl
    await sleep(100);

    // Early stop if we have enough markers
    if (found >= 5000) {
      console.log('\n\nReached 5000 markers, stopping early.');
      break;
    }
  }

  console.log(`\n\nFound ${newMarkers.length} new informative markers`);

  if (newMarkers.length === 0) {
    console.log('No new markers found.');
    return;
  }

  // Sort by informativeness
  newMarkers.sort((a, b) => b.informativeness - a.informativeness);

  // Print top markers
  console.log('\nTop 20 most informative new markers:');
  for (const m of newMarkers.slice(0, 20)) {
    console.log(
      `  ${m.rsid} (chr${m.chromosome}:${m.position}) Fst=${m.informativeness.toFixed(3)}`
    );
  }

  // Load existing database
  const aimsPath = path.join(__dirname, 'ancestryAIMs_expanded.json');
  const existingData = JSON.parse(fs.readFileSync(aimsPath, 'utf-8'));

  // Merge with existing
  const allMarkers = [
    ...existingData.markers,
    ...newMarkers.map(m => ({
      rsid: m.rsid,
      chromosome: m.chromosome,
      position: m.position,
      ref: m.ref,
      alt: m.alt,
      frequencies: m.frequencies,
    })),
  ];

  // Deduplicate
  const seen = new Set<string>();
  const uniqueMarkers = allMarkers.filter(m => {
    if (seen.has(m.rsid)) return false;
    seen.add(m.rsid);
    return true;
  });

  // Sort by chromosome and position
  uniqueMarkers.sort((a, b) => {
    const chrA =
      a.chromosome === 'X'
        ? 23
        : a.chromosome === 'Y'
          ? 24
          : parseInt(a.chromosome);
    const chrB =
      b.chromosome === 'X'
        ? 23
        : b.chromosome === 'Y'
          ? 24
          : parseInt(b.chromosome);
    if (chrA !== chrB) return chrA - chrB;
    return a.position - b.position;
  });

  // Save expanded database
  const expandedData = {
    metadata: {
      ...existingData.metadata,
      totalMarkers: uniqueMarkers.length,
      lastUpdated: new Date().toISOString(),
      description: 'Expanded AIM database with markers from test data analysis',
    },
    markers: uniqueMarkers,
  };

  fs.writeFileSync(aimsPath, JSON.stringify(expandedData, null, 2));

  console.log(`\nSaved ${uniqueMarkers.length} total markers to ${aimsPath}`);

  // Print chromosome distribution
  const byChr: Record<string, number> = {};
  for (const m of uniqueMarkers) {
    byChr[m.chromosome] = (byChr[m.chromosome] || 0) + 1;
  }
  console.log('\nMarkers by chromosome:');
  for (const [chr, count] of Object.entries(byChr).sort((a, b) => {
    const chrA = a[0] === 'X' ? 23 : a[0] === 'Y' ? 24 : parseInt(a[0]);
    const chrB = b[0] === 'X' ? 23 : b[0] === 'Y' ? 24 : parseInt(b[0]);
    return chrA - chrB;
  })) {
    console.log(`  chr${chr}: ${count}`);
  }
}

main().catch(console.error);
