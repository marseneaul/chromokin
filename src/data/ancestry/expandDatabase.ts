/**
 * Expand AIM database by finding high-Fst markers from test data
 *
 * Uses sequential API calls with robust error handling.
 * Run with: npx tsx src/data/ancestry/expandDatabase.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENSEMBL_API = 'https://rest.ensembl.org';

// Population mapping
const POP_MAPPING: Record<string, string> = {
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

interface AIMMarker {
  rsid: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  frequencies: Record<string, number>;
  fst: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateFst(freqs: Record<string, number>): number {
  const vals = Object.values(freqs);
  const n = vals.length;
  if (n < 2) return 0;

  const pBar = vals.reduce((a, b) => a + b, 0) / n;
  if (pBar === 0 || pBar === 1) return 0;

  const variance = vals.reduce((sum, p) => sum + (p - pBar) ** 2, 0) / n;
  return Math.min(1, variance / (pBar * (1 - pBar)));
}

async function fetchVariant(
  rsid: string,
  retries = 3
): Promise<AIMMarker | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        `${ENSEMBL_API}/variation/human/${rsid}?content-type=application/json&pops=1`
      );

      if (response.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }

      if (!response.ok) return null;

      const data = await response.json();

      // Get mapping
      const mapping = data.mappings?.[0];
      if (!mapping) return null;

      const alleles = mapping.allele_string?.split('/');
      if (!alleles || alleles.length < 2) return null;

      const [ref, alt] = alleles;
      if (!ref || !alt || ref.length > 1 || alt.length > 1) return null;

      // Extract frequencies for alt allele
      const populations = data.populations;
      if (!populations || !Array.isArray(populations)) return null;

      const freqs: Record<string, number[]> = {
        EUR: [],
        AFR: [],
        EAS: [],
        SAS: [],
        AMR: [],
      };

      for (const pop of populations) {
        if (pop.allele !== alt) continue;

        const mapped = POP_MAPPING[pop.population];
        if (mapped && typeof pop.frequency === 'number') {
          freqs[mapped].push(pop.frequency);
        }
      }

      // Average and check coverage
      const avgFreqs: Record<string, number> = {};
      let popCount = 0;

      for (const [p, vals] of Object.entries(freqs)) {
        if (vals.length > 0) {
          avgFreqs[p] = vals.reduce((a, b) => a + b, 0) / vals.length;
          popCount++;
        }
      }

      if (popCount < 4) return null;

      // Fill missing with average
      const avg = Object.values(avgFreqs).reduce((a, b) => a + b, 0) / popCount;
      for (const p of ['EUR', 'AFR', 'EAS', 'SAS', 'AMR']) {
        if (avgFreqs[p] === undefined) avgFreqs[p] = avg;
      }

      const fst = calculateFst(avgFreqs);
      if (fst < 0.05) return null;

      return {
        rsid,
        chromosome: mapping.seq_region_name,
        position: mapping.start,
        ref,
        alt,
        frequencies: avgFreqs,
        fst,
      };
    } catch {
      if (attempt < retries - 1) await sleep(1000);
    }
  }
  return null;
}

async function main() {
  console.log('Expanding AIM database...\n');

  // Load existing
  const aimsPath = path.join(__dirname, 'ancestryAIMs_expanded.json');
  const existing = JSON.parse(fs.readFileSync(aimsPath, 'utf-8'));
  const existingSet = new Set(
    existing.markers.map((m: { rsid: string }) => m.rsid)
  );
  console.log(`Existing markers: ${existingSet.size}`);

  // Load test file rsids
  const testPath = path.join(__dirname, '../test-data/ancestry.txt');
  const content = fs.readFileSync(testPath, 'utf-8');
  const lines = content.split('\n');

  const testRsids: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    const parts = line.split('\t');
    if (parts[0]?.startsWith('rs') && !existingSet.has(parts[0])) {
      testRsids.push(parts[0]);
    }
  }
  console.log(`New rsids to check: ${testRsids.length}`);

  // Shuffle and limit
  const shuffled = testRsids.sort(() => Math.random() - 0.5);
  const toCheck = shuffled.slice(0, 15000); // Check 15k variants
  console.log(`Will check: ${toCheck.length}\n`);

  const newMarkers: AIMMarker[] = [];
  let checked = 0;

  for (const rsid of toCheck) {
    checked++;
    if (checked % 50 === 0) {
      process.stdout.write(
        `\rChecked ${checked}/${toCheck.length} | Found ${newMarkers.length} markers`
      );
    }

    const marker = await fetchVariant(rsid);
    if (marker) {
      newMarkers.push(marker);
    }

    // Stop if we have enough
    if (newMarkers.length >= 3000) {
      console.log('\n\nReached 3000 new markers!');
      break;
    }

    await sleep(50); // Rate limit
  }

  console.log(`\n\nFound ${newMarkers.length} new informative markers`);

  if (newMarkers.length === 0) {
    console.log('No new markers found.');
    return;
  }

  // Sort by Fst
  newMarkers.sort((a, b) => b.fst - a.fst);

  console.log('\nTop 10 by Fst:');
  for (const m of newMarkers.slice(0, 10)) {
    console.log(
      `  ${m.rsid} chr${m.chromosome}:${m.position} Fst=${m.fst.toFixed(3)}`
    );
  }

  // Merge
  const allMarkers = [
    ...existing.markers,
    ...newMarkers.map(m => ({
      rsid: m.rsid,
      chromosome: m.chromosome,
      position: m.position,
      ref: m.ref,
      alt: m.alt,
      frequencies: m.frequencies,
    })),
  ];

  // Sort
  allMarkers.sort((a, b) => {
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
    return chrA !== chrB ? chrA - chrB : a.position - b.position;
  });

  // Save
  const output = {
    metadata: {
      ...existing.metadata,
      totalMarkers: allMarkers.length,
      lastUpdated: new Date().toISOString(),
    },
    markers: allMarkers,
  };

  fs.writeFileSync(aimsPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${allMarkers.length} total markers`);

  // Stats
  const byChr: Record<string, number> = {};
  for (const m of allMarkers) {
    byChr[m.chromosome] = (byChr[m.chromosome] || 0) + 1;
  }
  console.log('\nBy chromosome:');
  Object.entries(byChr)
    .sort((a, b) => {
      const chrA = a[0] === 'X' ? 23 : a[0] === 'Y' ? 24 : parseInt(a[0]);
      const chrB = b[0] === 'X' ? 23 : b[0] === 'Y' ? 24 : parseInt(b[0]);
      return chrA - chrB;
    })
    .forEach(([chr, n]) => console.log(`  chr${chr}: ${n}`));
}

main().catch(console.error);
