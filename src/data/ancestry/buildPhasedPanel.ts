/**
 * Build Phased Reference Panel for Statistical Phasing
 *
 * Fetches phased haplotype data from Ensembl REST API for AIMs to create
 * a reference panel for Li & Stephens haplotype phasing.
 *
 * The Ensembl API returns genotypes in format "A|G" (phased) or "A/G" (unphased).
 * We extract phased data and store as separate haplotype strings.
 *
 * Run with: npx tsx src/data/ancestry/buildPhasedPanel.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import aimsData from './ancestryAIMs_expanded.json';

// 1000 Genomes Phase 3 population codes and their super-populations
const POPULATIONS: Record<
  string,
  { code: string; superPop: string; description: string }
> = {
  // European (EUR)
  CEU: {
    code: 'CEU',
    superPop: 'EUR',
    description:
      'Utah residents (CEPH) with Northern and Western European ancestry',
  },
  TSI: { code: 'TSI', superPop: 'EUR', description: 'Toscani in Italia' },
  FIN: { code: 'FIN', superPop: 'EUR', description: 'Finnish in Finland' },
  GBR: {
    code: 'GBR',
    superPop: 'EUR',
    description: 'British in England and Scotland',
  },
  IBS: {
    code: 'IBS',
    superPop: 'EUR',
    description: 'Iberian populations in Spain',
  },

  // African (AFR)
  YRI: {
    code: 'YRI',
    superPop: 'AFR',
    description: 'Yoruba in Ibadan, Nigeria',
  },
  LWK: { code: 'LWK', superPop: 'AFR', description: 'Luhya in Webuye, Kenya' },
  GWD: {
    code: 'GWD',
    superPop: 'AFR',
    description: 'Gambian in Western Division, The Gambia',
  },
  MSL: { code: 'MSL', superPop: 'AFR', description: 'Mende in Sierra Leone' },
  ESN: { code: 'ESN', superPop: 'AFR', description: 'Esan in Nigeria' },
  ASW: {
    code: 'ASW',
    superPop: 'AFR',
    description: 'African Ancestry in Southwest US',
  },
  ACB: {
    code: 'ACB',
    superPop: 'AFR',
    description: 'African Caribbean in Barbados',
  },

  // East Asian (EAS)
  CHB: {
    code: 'CHB',
    superPop: 'EAS',
    description: 'Han Chinese in Beijing, China',
  },
  JPT: {
    code: 'JPT',
    superPop: 'EAS',
    description: 'Japanese in Tokyo, Japan',
  },
  CHS: { code: 'CHS', superPop: 'EAS', description: 'Southern Han Chinese' },
  CDX: {
    code: 'CDX',
    superPop: 'EAS',
    description: 'Chinese Dai in Xishuangbanna, China',
  },
  KHV: {
    code: 'KHV',
    superPop: 'EAS',
    description: 'Kinh in Ho Chi Minh City, Vietnam',
  },

  // South Asian (SAS)
  GIH: {
    code: 'GIH',
    superPop: 'SAS',
    description: 'Gujarati Indians in Houston, Texas',
  },
  PJL: {
    code: 'PJL',
    superPop: 'SAS',
    description: 'Punjabi in Lahore, Pakistan',
  },
  BEB: { code: 'BEB', superPop: 'SAS', description: 'Bengali in Bangladesh' },
  STU: {
    code: 'STU',
    superPop: 'SAS',
    description: 'Sri Lankan Tamil in the UK',
  },
  ITU: { code: 'ITU', superPop: 'SAS', description: 'Indian Telugu in the UK' },

  // Americas (AMR)
  MXL: {
    code: 'MXL',
    superPop: 'AMR',
    description: 'Mexican Ancestry in Los Angeles, California',
  },
  PUR: {
    code: 'PUR',
    superPop: 'AMR',
    description: 'Puerto Ricans in Puerto Rico',
  },
  CLM: {
    code: 'CLM',
    superPop: 'AMR',
    description: 'Colombians in Medellin, Colombia',
  },
  PEL: { code: 'PEL', superPop: 'AMR', description: 'Peruvians in Lima, Peru' },
};

interface EnsemblGenotype {
  sample: string;
  genotype: string;
  gender?: string;
}

interface EnsemblVariationResponse {
  name: string;
  mappings: Array<{
    allele_string: string;
    location: string;
    ancestral_allele?: string;
  }>;
  genotypes?: EnsemblGenotype[];
}

/**
 * Phased Reference Panel structure
 *
 * Each marker has a haplotype string where each character represents an allele.
 * Characters alternate: hap1[ind0], hap2[ind0], hap1[ind1], hap2[ind1], ...
 * '0' = reference allele, '1' = alternate allele, '9' = missing
 *
 * With 2504 individuals, each haplotype string has 5008 characters.
 */
export interface PhasedReferencePanel {
  metadata: {
    version: string;
    buildDate: string;
    totalIndividuals: number;
    totalHaplotypes: number;
    populations: Record<
      string,
      { code: string; superPop: string; count: number }
    >;
    sampleIds: string[];
    rsids: string[];
    totalMarkers: number;
  };
  // Haplotypes encoded as string: "01100110..." (5008 chars)
  // Each pair of chars is [hap1, hap2] for one individual
  // '0' = ref allele, '1' = alt allele, '9' = missing
  haplotypes: Record<string, string>;
}

export interface PhasedReferenceMetadata {
  version: string;
  buildDate: string;
  totalIndividuals: number;
  totalHaplotypes: number;
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
    haplotypeIndices: [number, number];
  }>;
}

// Rate limiting
const BASE_DELAY_MS = 50;
const MAX_RETRIES = 3;
const PROGRESS_INTERVAL = 50;

// 1000 Genomes sample panel URL
const SAMPLE_PANEL_URL =
  'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/integrated_call_samples_v3.20130502.ALL.panel';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch and parse the 1000 Genomes sample panel to get sample -> population mapping
 */
async function fetchSamplePanel(): Promise<Map<string, string>> {
  console.log('Fetching 1000 Genomes sample panel...');

  const response = await fetch(SAMPLE_PANEL_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch sample panel: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n');

  const sampleToPopulation = new Map<string, string>();

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length >= 2) {
      const sampleId = parts[0].trim();
      const population = parts[1].trim();

      // Only include samples from populations we care about
      if (POPULATIONS[population]) {
        sampleToPopulation.set(sampleId, population);
      }
    }
  }

  console.log(`Loaded ${sampleToPopulation.size} samples from panel\n`);
  return sampleToPopulation;
}

/**
 * Extract sample ID from Ensembl's full sample string
 * e.g., "1000GENOMES:phase_3:HG00096" -> "HG00096"
 */
function extractSampleId(fullSampleString: string): string {
  const parts = fullSampleString.split(':');
  return parts[parts.length - 1];
}

async function fetchWithRetry(
  url: string,
  retries: number = MAX_RETRIES
): Promise<EnsemblVariationResponse | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (response.status === 429) {
        const backoffMs = BASE_DELAY_MS * Math.pow(2, attempt + 1);
        console.log(`  Rate limited, waiting ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as EnsemblVariationResponse;
    } catch (err) {
      if (attempt === retries) {
        console.error(`  Failed after ${retries} retries:`, err);
        return null;
      }
      const backoffMs = BASE_DELAY_MS * Math.pow(2, attempt);
      console.log(
        `  Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`
      );
      await delay(backoffMs);
    }
  }
  return null;
}

/**
 * Encode phased genotype to haplotype pair
 * Returns [hap1, hap2] where each is '0' (ref), '1' (alt), or '9' (missing)
 */
function encodePhasedGenotype(
  genotype: string,
  refAllele: string,
  altAllele: string
): [string, string] {
  // Check for missing data
  if (
    !genotype ||
    genotype === '.' ||
    genotype === './.' ||
    genotype === '.|.'
  ) {
    return ['9', '9'];
  }

  // Check if phased (contains |) or unphased (contains /)
  const isPhased = genotype.includes('|');
  const separator = isPhased ? '|' : '/';
  const alleles = genotype.split(separator);

  if (alleles.length !== 2) {
    return ['9', '9'];
  }

  // Encode each allele
  const encodeAllele = (allele: string): string => {
    if (allele === refAllele) return '0';
    if (allele === altAllele) return '1';
    return '9'; // Unknown allele
  };

  return [encodeAllele(alleles[0]), encodeAllele(alleles[1])];
}

async function buildPhasedPanel(): Promise<void> {
  console.log('Building Phased Reference Panel for Li & Stephens Phasing');
  console.log('=========================================================\n');

  // Fetch the sample panel
  const sampleToPopulation = await fetchSamplePanel();

  const markers = aimsData.markers as Array<{
    rsid: string;
    chromosome: string;
    position: number;
    ref: string;
    alt: string;
  }>;

  console.log(`Total markers to fetch: ${markers.length}`);
  console.log(`Ensembl REST API: https://rest.ensembl.org\n`);

  // Track all unique sample IDs and their populations
  const samplePopulations: Map<string, string> = new Map();
  // rsid -> sampleId -> [hap1, hap2]
  const haplotypes: Map<string, Map<string, [string, string]>> = new Map();
  const successfulMarkers: string[] = [];
  const failedMarkers: string[] = [];
  let phasedCount = 0;
  let unphasedCount = 0;

  console.log('Fetching phased genotype data from Ensembl...\n');

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];

    // Progress reporting
    if ((i + 1) % PROGRESS_INTERVAL === 0 || i === markers.length - 1) {
      console.log(
        `Progress: ${i + 1}/${markers.length} markers (${Math.round(((i + 1) / markers.length) * 100)}%) - ` +
          `Success: ${successfulMarkers.length}, Failed: ${failedMarkers.length}`
      );
    }

    const url = `https://rest.ensembl.org/variation/human/${marker.rsid}?genotypes=1`;
    const data = await fetchWithRetry(url);

    if (!data || !data.genotypes || data.genotypes.length === 0) {
      failedMarkers.push(marker.rsid);
      await delay(BASE_DELAY_MS);
      continue;
    }

    // Extract haplotypes for 1000 Genomes samples
    const markerHaplotypes: Map<string, [string, string]> = new Map();

    for (const gt of data.genotypes) {
      const sampleId = extractSampleId(gt.sample);
      const population = sampleToPopulation.get(sampleId);

      if (population && POPULATIONS[population]) {
        const [hap1, hap2] = encodePhasedGenotype(
          gt.genotype,
          marker.ref,
          marker.alt
        );

        // Track phasing status
        if (gt.genotype.includes('|')) {
          phasedCount++;
        } else if (gt.genotype.includes('/')) {
          unphasedCount++;
        }

        markerHaplotypes.set(sampleId, [hap1, hap2]);

        if (!samplePopulations.has(sampleId)) {
          samplePopulations.set(sampleId, population);
        }
      }
    }

    if (markerHaplotypes.size > 0) {
      haplotypes.set(marker.rsid, markerHaplotypes);
      successfulMarkers.push(marker.rsid);
    } else {
      failedMarkers.push(marker.rsid);
    }

    await delay(BASE_DELAY_MS);
  }

  console.log('\n\nProcessing complete!');
  console.log(`Successful markers: ${successfulMarkers.length}`);
  console.log(`Failed markers: ${failedMarkers.length}`);
  console.log(`Unique samples: ${samplePopulations.size}`);
  console.log(
    `Phased genotypes: ${phasedCount}, Unphased: ${unphasedCount} (${((phasedCount / (phasedCount + unphasedCount)) * 100).toFixed(1)}% phased)`
  );

  if (successfulMarkers.length === 0) {
    console.error('No markers were successfully fetched. Aborting.');
    process.exit(1);
  }

  // Build ordered sample list
  const sampleIds = Array.from(samplePopulations.keys()).sort();

  // Count populations
  const populationCounts: Record<string, number> = {};
  for (const pop of samplePopulations.values()) {
    populationCounts[pop] = (populationCounts[pop] || 0) + 1;
  }

  console.log('\nPopulation breakdown:');
  for (const [pop, count] of Object.entries(populationCounts).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(`  ${pop}: ${count} individuals (${count * 2} haplotypes)`);
  }

  // Build haplotype strings
  // Each string is 5008 chars (2 per individual): hap1[0], hap2[0], hap1[1], hap2[1], ...
  console.log('\nBuilding haplotype strings...');
  const haplotypeStrings: Record<string, string> = {};

  for (const rsid of successfulMarkers) {
    const markerHaplotypes = haplotypes.get(rsid)!;
    let hapStr = '';

    for (const sampleId of sampleIds) {
      const [hap1, hap2] = markerHaplotypes.get(sampleId) ?? ['9', '9'];
      hapStr += hap1 + hap2;
    }

    haplotypeStrings[rsid] = hapStr;
  }

  // Build metadata
  const populationMetadata: Record<
    string,
    { code: string; superPop: string; count: number }
  > = {};

  for (const [pop, popInfo] of Object.entries(POPULATIONS)) {
    populationMetadata[pop] = {
      code: popInfo.code,
      superPop: popInfo.superPop,
      count: populationCounts[pop] || 0,
    };
  }

  // Build panel JSON
  const panel: PhasedReferencePanel = {
    metadata: {
      version: '1.0',
      buildDate: new Date().toISOString(),
      totalIndividuals: sampleIds.length,
      totalHaplotypes: sampleIds.length * 2,
      populations: populationMetadata,
      sampleIds,
      rsids: successfulMarkers,
      totalMarkers: successfulMarkers.length,
    },
    haplotypes: haplotypeStrings,
  };

  // Build separate metadata file
  const superPopulations: Record<
    string,
    { code: string; populations: string[]; totalCount: number }
  > = {
    EUR: { code: 'EUR', populations: [], totalCount: 0 },
    AFR: { code: 'AFR', populations: [], totalCount: 0 },
    EAS: { code: 'EAS', populations: [], totalCount: 0 },
    SAS: { code: 'SAS', populations: [], totalCount: 0 },
    AMR: { code: 'AMR', populations: [], totalCount: 0 },
  };

  for (const [pop, info] of Object.entries(POPULATIONS)) {
    superPopulations[info.superPop].populations.push(pop);
    superPopulations[info.superPop].totalCount += populationCounts[pop] || 0;
  }

  const sampleInfo = sampleIds.map((id, index) => ({
    id,
    population: samplePopulations.get(id)!,
    superPopulation: POPULATIONS[samplePopulations.get(id)!].superPop,
    index,
    haplotypeIndices: [index * 2, index * 2 + 1] as [number, number],
  }));

  const metadata: PhasedReferenceMetadata = {
    version: '1.0',
    buildDate: new Date().toISOString(),
    totalIndividuals: sampleIds.length,
    totalHaplotypes: sampleIds.length * 2,
    totalMarkers: successfulMarkers.length,
    populations: Object.fromEntries(
      Object.entries(POPULATIONS).map(([code, info]) => [
        code,
        {
          code: info.code,
          superPop: info.superPop,
          count: populationCounts[code] || 0,
          description: info.description,
        },
      ])
    ),
    superPopulations,
    sampleInfo,
  };

  // Write files
  const outputDir = path.dirname(new URL(import.meta.url).pathname);

  const panelPath = path.join(outputDir, 'referencePhasedPanel.json');
  console.log(`\nWriting phased panel to ${panelPath}...`);
  fs.writeFileSync(panelPath, JSON.stringify(panel));

  const metadataPath = path.join(outputDir, 'referencePhasedMetadata.json');
  console.log(`Writing phased metadata to ${metadataPath}...`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Report file sizes
  const panelStats = fs.statSync(panelPath);
  const metadataStats = fs.statSync(metadataPath);
  console.log(`\nFile sizes:`);
  console.log(
    `  referencePhasedPanel.json: ${(panelStats.size / 1024 / 1024).toFixed(2)} MB`
  );
  console.log(
    `  referencePhasedMetadata.json: ${(metadataStats.size / 1024).toFixed(2)} KB`
  );

  console.log('\nDone!');

  // Write failed markers list for debugging
  if (failedMarkers.length > 0) {
    const failedPath = path.join(outputDir, 'failedPhasedMarkers.txt');
    fs.writeFileSync(failedPath, failedMarkers.join('\n'));
    console.log(`\nFailed markers written to ${failedPath}`);
  }
}

// Run the build
buildPhasedPanel().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
