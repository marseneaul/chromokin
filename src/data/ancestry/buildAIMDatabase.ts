/**
 * Build expanded AIM database
 *
 * This script fetches population allele frequencies from Ensembl
 * and builds a comprehensive AIM database for ancestry inference.
 *
 * Run with: npx tsx src/data/ancestry/buildAIMDatabase.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensembl REST API endpoint
const ENSEMBL_API = 'https://rest.ensembl.org';

// Population mapping from 1000 Genomes to our categories
const POPULATION_MAPPING: Record<string, string> = {
  // European
  CEU: 'EUR',
  GBR: 'EUR',
  FIN: 'EUR',
  IBS: 'EUR',
  TSI: 'EUR',
  // African
  YRI: 'AFR',
  LWK: 'AFR',
  GWD: 'AFR',
  MSL: 'AFR',
  ESN: 'AFR',
  ASW: 'AFR',
  ACB: 'AFR',
  // East Asian
  CHB: 'EAS',
  JPT: 'EAS',
  CHS: 'EAS',
  CDX: 'EAS',
  KHV: 'EAS',
  // South Asian
  GIH: 'SAS',
  PJL: 'SAS',
  BEB: 'SAS',
  STU: 'SAS',
  ITU: 'SAS',
  // Americas
  MXL: 'AMR',
  PUR: 'AMR',
  CLM: 'AMR',
  PEL: 'AMR',
};

// Superpopulation mapping (1000 Genomes uses these)
const SUPERPOP_MAPPING: Record<string, string> = {
  EUR: 'EUR',
  AFR: 'AFR',
  EAS: 'EAS',
  SAS: 'SAS',
  AMR: 'AMR',
};

// gnomAD population mapping (Ensembl returns these)
const GNOMAD_MAPPING: Record<string, string> = {
  // gnomAD exomes
  'gnomADe:nfe': 'EUR',
  'gnomADe:fin': 'EUR',
  'gnomADe:afr': 'AFR',
  'gnomADe:eas': 'EAS',
  'gnomADe:sas': 'SAS',
  'gnomADe:amr': 'AMR',
  // gnomAD genomes
  'gnomADg:nfe': 'EUR',
  'gnomADg:fin': 'EUR',
  'gnomADg:afr': 'AFR',
  'gnomADg:eas': 'EAS',
  'gnomADg:sas': 'SAS',
  'gnomADg:amr': 'AMR',
};

interface EnsemblPopulation {
  population: string;
  frequency: number;
  allele?: string;
}

interface EnsemblVariant {
  name: string;
  mappings: Array<{
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
  source: string;
}

/**
 * Fetch variant info from Ensembl
 */
async function fetchVariantInfo(rsid: string): Promise<EnsemblVariant | null> {
  try {
    const response = await fetch(
      `${ENSEMBL_API}/variation/human/${rsid}?content-type=application/json&pops=1`
    );

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait and retry
        await sleep(1000);
        return fetchVariantInfo(rsid);
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${rsid}:`, error);
    return null;
  }
}

/**
 * Extract population frequencies from Ensembl response
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
    // Filter by allele if specified (gnomAD data includes allele field)
    if (pop.allele && pop.allele !== altAllele) {
      continue;
    }

    // Check gnomAD populations first (most common in Ensembl response)
    const gnomadPop = GNOMAD_MAPPING[pop.population];
    if (gnomadPop) {
      freqs[gnomadPop].push(pop.frequency);
      continue;
    }

    // Check if it's a superpopulation
    const superPop = SUPERPOP_MAPPING[pop.population];
    if (superPop) {
      freqs[superPop].push(pop.frequency);
      continue;
    }

    // Check if it's a subpopulation
    const mappedPop = POPULATION_MAPPING[pop.population];
    if (mappedPop) {
      freqs[mappedPop].push(pop.frequency);
    }
  }

  // Average frequencies for each superpopulation
  const result: Record<string, number> = {};
  let hasData = false;

  for (const [pop, values] of Object.entries(freqs)) {
    if (values.length > 0) {
      result[pop] = values.reduce((a, b) => a + b, 0) / values.length;
      hasData = true;
    } else {
      result[pop] = 0.5; // Default if no data
    }
  }

  return hasData ? result : null;
}

/**
 * Calculate informativeness (Fst-like metric)
 * Higher values = more discriminating between populations
 */
function calculateInformativeness(frequencies: Record<string, number>): number {
  const freqs = Object.values(frequencies);
  const mean = freqs.reduce((a, b) => a + b, 0) / freqs.length;
  const variance =
    freqs.reduce((sum, f) => sum + (f - mean) ** 2, 0) / freqs.length;
  return Math.sqrt(variance);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load existing AIMs
 */
function loadExistingAIMs(): Set<string> {
  const aimsPath = path.join(__dirname, 'ancestryAIMs.json');
  const data = JSON.parse(fs.readFileSync(aimsPath, 'utf-8'));
  return new Set(data.markers.map((m: { rsid: string }) => m.rsid));
}

/**
 * Comprehensive AIMs from multiple published sources:
 * - Kidd et al. 2014 (55-AISNP panel)
 * - Kosoy et al. 2009 (128 AIMs)
 * - Phillips et al. 2007 (34 SNPs)
 * - EUROFORGEN consortium
 * - Illumina ancestry panels
 * - 1000 Genomes high-Fst variants
 * - Pigmentation/phenotype genes
 */
const KNOWN_AIMS = [
  // ===== Kidd et al. 55-AISNP Panel (validated global ancestry) =====
  'rs1876482',
  'rs2814778',
  'rs3827760',
  'rs1426654',
  'rs16891982',
  'rs12913832',
  'rs2228479',
  'rs1393350',
  'rs4778138',
  'rs12203592',
  'rs1800407',
  'rs2402130',
  'rs260690',
  'rs2378249',
  'rs1408799',
  'rs2789823',
  'rs1545397',
  'rs6003',
  'rs2733832',
  'rs1871534',
  'rs1834640',
  'rs917115',
  'rs3784230',
  'rs4540055',
  'rs2065160',
  'rs1079597',
  'rs2816905',
  'rs1990567',
  'rs1335873',
  'rs1040404',
  'rs2077681',
  'rs1478785',
  'rs1858465',
  'rs952718',
  'rs1007819',
  'rs7226659',
  'rs6451722',
  'rs7554936',
  'rs7689609',
  'rs798443',
  'rs730570',
  'rs4746136',
  'rs6811238',
  'rs881929',
  'rs870347',
  'rs818386',
  'rs8113143',
  'rs8034191',
  'rs772262',
  'rs9522149',
  'rs9845457',
  'rs2196051',
  'rs1369290',
  'rs671',
  'rs1229984',

  // ===== Phillips et al. 34-plex SNaPshot (ancestry) =====
  'rs3737576',
  'rs6754311',
  'rs10843344',
  'rs1907702',
  'rs1015362',
  'rs10954737',
  'rs10962599',
  'rs1924381',
  'rs722869',
  'rs7657799',
  'rs11153271',
  'rs10806303',
  'rs2166624',
  'rs3823159',
  'rs1415878',
  'rs11780978',
  'rs10497191',
  'rs7494942',
  'rs10305315',
  'rs10790313',
  'rs10108270',
  'rs10509954',
  'rs1024116',
  'rs2024566',
  'rs1448484',
  'rs12439433',
  'rs12498138',
  'rs12594536',
  'rs4959270',
  'rs7803075',
  'rs10255669',
  'rs1029688',
  'rs10498919',
  'rs12621550',

  // ===== Additional Kosoy et al. AIMs =====
  'rs4778137',
  'rs4778232',
  'rs4778241',
  'rs4842602',
  'rs4911442',
  'rs1485175',
  'rs1498519',
  'rs1572018',
  'rs1575537',
  'rs1724630',
  'rs1900758',
  'rs1922982',
  'rs2125739',
  'rs2238151',
  'rs2240203',
  'rs2250072',
  'rs2470102',
  'rs2594935',
  'rs2835630',
  'rs28777',
  'rs2899398',
  'rs2946788',
  'rs2967807',
  'rs3088053',
  'rs310644',
  'rs3212345',
  'rs3768641',
  'rs3794606',
  'rs3809761',
  'rs3845466',
  'rs4411548',
  'rs4552364',
  'rs4681509',
  'rs4713858',
  'rs4722253',
  'rs502843',
  'rs506426',
  'rs6058017',
  'rs6119471',
  'rs6497268',
  'rs6510760',
  'rs6548616',
  'rs6583859',
  'rs6600528',
  'rs660339',
  'rs6652555',
  'rs683',
  'rs6867641',
  'rs6897932',
  'rs6918152',
  'rs6950754',
  'rs7170852',
  'rs7183877',
  'rs7737033',
  'rs7948623',
  'rs7959442',
  'rs8024564',
  'rs8031960',
  'rs8192678',
  'rs895828',
  'rs895829',
  'rs9282541',
  'rs9378805',
  'rs9530435',
  'rs11085824',
  'rs12402499',
  'rs12629457',
  'rs12644747',
  'rs12678919',
  'rs1344870',
  'rs1471939',
  'rs10511685',
  'rs10512572',
  'rs10513300',
  'rs10514099',
  'rs1058083',
  'rs1129038',
  'rs11547464',
  'rs116359',
  'rs1170676',

  // ===== Pigmentation genes (highly ancestry-informative) =====
  'rs1426654',
  'rs16891982',
  'rs12913832',
  'rs1800407',
  'rs12896399',
  'rs1393350',
  'rs12203592',
  'rs1800401',
  'rs2424984',
  'rs1800414',
  'rs74653330',
  'rs885479',
  'rs1805005',
  'rs1805006',
  'rs1805007',
  'rs1805008',
  'rs1805009',
  'rs1800404',
  'rs17822931',
  'rs4988235',
  'rs182549',
  'rs13289',

  // ===== EUROFORGEN panel additions =====
  'rs310644',
  'rs316598',
  'rs459920',
  'rs560681',
  'rs714857',
  'rs727811',
  'rs826472',
  'rs870347',
  'rs917118',
  'rs939013',
  'rs950286',
  'rs951545',
  'rs973770',
  'rs10007810',
  'rs10022457',
  'rs10034228',
  'rs10037475',
  'rs10048146',
  'rs10069050',
  'rs10082197',
  'rs10096633',
  'rs10119736',
  'rs10132404',
  'rs10139035',
  'rs10188577',
  'rs10204524',
  'rs10217743',
  'rs10236187',
  'rs10266101',
  'rs10268813',
  'rs10269718',
  'rs10272438',
  'rs10496971',
  'rs10497393',
  'rs10508372',
  'rs10516002',
  'rs10767681',
  'rs10774065',
  'rs10779329',
  'rs10792106',
  'rs10843344',
  'rs10872311',
  'rs10881272',
  'rs10953455',
  'rs1106634',
  'rs1110052',
  'rs11115339',
  'rs11153271',
  'rs1116736',
  'rs1129038',
  'rs11548949',
  'rs1158110',
  'rs116359',
  'rs1165870',
  'rs11652805',
  'rs11657295',
  'rs11679041',
  'rs1167932',
  'rs11691517',
  'rs11693661',
  'rs11693828',
  'rs11721618',
  'rs11780978',
  'rs11785991',
  'rs11789924',
  'rs11790689',
  'rs11797886',
  'rs11799093',
  'rs11799672',
  'rs11803287',

  // ===== 1000 Genomes high-Fst variants (EUR vs AFR) =====
  'rs1800498',
  'rs3750344',
  'rs1801133',
  'rs1805087',
  'rs1048661',
  'rs699517',
  'rs1800896',
  'rs763110',
  'rs4880',
  'rs1801131',
  'rs4646903',
  'rs1799971',
  'rs6280',
  'rs4986790',
  'rs1800795',
  'rs2234693',
  'rs1805007',
  'rs1800012',
  'rs28363170',
  'rs6311',
  'rs4680',
  'rs7903146',
  'rs12255372',
  'rs1799883',
  'rs1800497',
  'rs9939609',
  'rs17782313',
  'rs1801282',
  'rs8050136',
  'rs7566605',
  'rs4994',
  'rs1042713',
  'rs1042714',
  'rs5443',
  'rs1801260',
  'rs2267668',
  'rs2016520',
  'rs3135718',
  'rs2229616',
  'rs324420',
  'rs1800629',
  'rs361525',
  'rs1143627',
  'rs1800872',
  'rs1799724',

  // ===== Additional high-delta SNPs (AFR vs non-AFR) =====
  'rs722098',
  'rs7689609',
  'rs7554936',
  'rs6451722',
  'rs2814778',
  'rs12913832',
  'rs1426654',
  'rs16891982',
  'rs2069945',
  'rs2240203',
  'rs2789823',
  'rs3827760',
  'rs1545397',
  'rs1834640',
  'rs1042602',
  'rs1800401',
  'rs1079597',
  'rs1871534',
  'rs2065160',
  'rs2077681',
  'rs2816905',
  'rs2835630',
  'rs3088053',
  'rs4540055',
  'rs4746136',
  'rs6003',
  'rs6811238',
  'rs7226659',
  'rs7494942',
  'rs730570',
  'rs772262',
  'rs7803075',
  'rs798443',
  'rs8034191',
  'rs8113143',
  'rs818386',
  'rs870347',
  'rs881929',
  'rs9522149',
  'rs9845457',

  // ===== East Asian specific high-delta SNPs =====
  'rs3827760',
  'rs671',
  'rs1229984',
  'rs17822931',
  'rs1800414',
  'rs3811801',
  'rs17401966',
  'rs2069945',
  'rs1800497',
  'rs4680',
  'rs1042602',
  'rs1800401',
  'rs2279744',
  'rs361525',
  'rs2228478',
  'rs11803731',
  'rs11280056',
  'rs7495174',
  'rs2292239',
  'rs2292832',
  'rs4646994',
  'rs13306510',
  'rs2835286',
  'rs4713858',
  'rs2070600',

  // ===== South Asian distinguishing markers =====
  'rs1426654',
  'rs12913832',
  'rs16891982',
  'rs1393350',
  'rs1408799',
  'rs10843344',
  'rs4778138',
  'rs1545397',
  'rs2402130',
  'rs2378249',
  'rs7657799',
  'rs10962599',
  'rs12498138',
  'rs1024116',
  'rs2024566',
  'rs10255669',
  'rs1029688',
  'rs12439433',
  'rs10508372',
  'rs714857',

  // ===== Native American / AMR markers =====
  'rs3827760',
  'rs1426654',
  'rs16891982',
  'rs12913832',
  'rs671',
  'rs1229984',
  'rs17822931',
  'rs1801282',
  'rs7903146',
  'rs12255372',
  'rs9939609',
  'rs17782313',
  'rs1800497',
  'rs4680',
  'rs1042602',
  'rs1800401',
  'rs2279744',
  'rs1800795',
  'rs2234693',
  'rs1800012',

  // ===== Additional chromosome-distributed markers =====
  // Chromosome 1
  'rs2494752',
  'rs3737576',
  'rs1801133',
  'rs6754311',
  'rs3753242',
  'rs2794520',
  'rs3798220',
  'rs12040273',
  'rs1799945',
  'rs1800562',
  // Chromosome 2
  'rs6728178',
  'rs4668123',
  'rs13387042',
  'rs2943641',
  'rs2069418',
  'rs4988235',
  'rs182549',
  'rs4954',
  'rs7349332',
  'rs1260326',
  // Chromosome 3
  'rs4973768',
  'rs9818870',
  'rs1800255',
  'rs2069945',
  'rs2305619',
  'rs1052133',
  'rs1799977',
  'rs2066844',
  'rs2066845',
  'rs2066847',
  // Chromosome 4
  'rs13146272',
  'rs1229984',
  'rs4977574',
  'rs6837671',
  'rs6535454',
  'rs4132601',
  'rs4693075',
  'rs4148323',
  'rs10516526',
  'rs1800795',
  // Chromosome 5
  'rs16891982',
  'rs17185536',
  'rs10065172',
  'rs16903574',
  'rs12521868',
  'rs7715399',
  'rs2180439',
  'rs10077199',
  'rs4957014',
  'rs11168036',
  // Chromosome 6
  'rs6903823',
  'rs2187668',
  'rs3117582',
  'rs3129882',
  'rs7758128',
  'rs6910071',
  'rs3132451',
  'rs9272346',
  'rs2395175',
  'rs2395163',
  // Chromosome 7
  'rs2066827',
  'rs10259255',
  'rs17563986',
  'rs6969036',
  'rs7798167',
  'rs2682818',
  'rs10237911',
  'rs3807306',
  'rs17169633',
  'rs4947296',
  // Chromosome 8
  'rs13252298',
  'rs2943634',
  'rs10505477',
  'rs4871180',
  'rs7828742',
  'rs6994076',
  'rs7824877',
  'rs4735552',
  'rs11249433',
  'rs6473227',
  // Chromosome 9
  'rs10811661',
  'rs1333049',
  'rs7865618',
  'rs9411489',
  'rs4129267',
  'rs7041',
  'rs10757274',
  'rs2891168',
  'rs10116277',
  'rs7866036',
  // Chromosome 10
  'rs10509681',
  'rs7903146',
  'rs12255372',
  'rs4506565',
  'rs7901695',
  'rs10885122',
  'rs11191454',
  'rs7072268',
  'rs10509940',
  'rs7899106',
  // Chromosome 11
  'rs4963128',
  'rs7107785',
  'rs4977756',
  'rs10896449',
  'rs7928842',
  'rs10829156',
  'rs174547',
  'rs174546',
  'rs102275',
  'rs174537',
  // Chromosome 12
  'rs671',
  'rs11066001',
  'rs2259816',
  'rs11057401',
  'rs3741293',
  'rs2338104',
  'rs3184504',
  'rs11066015',
  'rs11066280',
  'rs11065987',
  // Chromosome 13
  'rs9533090',
  'rs9569826',
  'rs7997012',
  'rs7329174',
  'rs4769613',
  'rs1800061',
  'rs3742207',
  'rs3742214',
  'rs1878022',
  'rs9568046',
  // Chromosome 14
  'rs2236212',
  'rs4902774',
  'rs10498633',
  'rs8007267',
  'rs10145335',
  'rs11622883',
  'rs3783550',
  'rs2027432',
  'rs17105554',
  'rs7144481',
  // Chromosome 15
  'rs1426654',
  'rs12913832',
  'rs1129038',
  'rs12896399',
  'rs1805005',
  'rs1805006',
  'rs1805007',
  'rs1805008',
  'rs1805009',
  'rs4778138',
  // Chromosome 16
  'rs12918952',
  'rs4889606',
  'rs4566903',
  'rs7194923',
  'rs6500380',
  'rs8049607',
  'rs3785579',
  'rs9927317',
  'rs16947',
  'rs1065852',
  // Chromosome 17
  'rs4925386',
  'rs4430796',
  'rs8064821',
  'rs9894429',
  'rs2233142',
  'rs1800469',
  'rs1801516',
  'rs1052440',
  'rs1801131',
  'rs4646903',
  // Chromosome 18
  'rs9958506',
  'rs7227694',
  'rs8089866',
  'rs11660445',
  'rs11877716',
  'rs12456663',
  'rs1805165',
  'rs688034',
  'rs9957280',
  'rs9949457',
  // Chromosome 19
  'rs429358',
  'rs7412',
  'rs2075650',
  'rs769449',
  'rs10401969',
  'rs7255436',
  'rs3826782',
  'rs2230926',
  'rs601338',
  'rs4925386',
  // Chromosome 20
  'rs6060535',
  'rs6040450',
  'rs6011779',
  'rs1799998',
  'rs4810424',
  'rs4813846',
  'rs6060369',
  'rs6101936',
  'rs6091909',
  'rs6091329',
  // Chromosome 22
  'rs4820268',
  'rs5754217',
  'rs4675095',
  'rs376251',
  'rs738722',
  'rs2298428',
  'rs915894',
  'rs9608380',
  'rs8141347',
  'rs16996148',
];

/**
 * Main function to build expanded database
 */
async function main() {
  console.log('Building expanded AIM database...\n');

  const existingAIMs = loadExistingAIMs();
  console.log(`Existing AIMs: ${existingAIMs.size}`);

  // Filter to AIMs we don't already have
  const newAIMs = KNOWN_AIMS.filter(rsid => !existingAIMs.has(rsid));
  console.log(`New AIMs to fetch: ${newAIMs.length}\n`);

  const markers: AIMMarker[] = [];
  let processed = 0;
  let successful = 0;

  for (const rsid of newAIMs) {
    processed++;
    process.stdout.write(
      `\rProcessing ${processed}/${newAIMs.length}: ${rsid}...`
    );

    const variant = await fetchVariantInfo(rsid);
    if (!variant) {
      continue;
    }

    // Get mapping info
    const mapping = variant.mappings?.[0];
    if (!mapping) continue;

    const alleles = mapping.allele_string.split('/');
    if (alleles.length !== 2) continue;

    const [ref, alt] = alleles;

    // Extract frequencies
    const frequencies = extractFrequencies(variant, alt);
    if (!frequencies) continue;

    const informativeness = calculateInformativeness(frequencies);

    // Only include if reasonably informative
    if (informativeness < 0.05) continue;

    markers.push({
      rsid,
      chromosome: mapping.seq_region_name,
      position: mapping.start,
      ref,
      alt,
      frequencies,
      informativeness,
      source: 'ensembl',
    });

    successful++;

    // Rate limiting
    await sleep(100);
  }

  console.log(`\n\nSuccessfully fetched ${successful} new AIMs`);

  // Load existing database
  const aimsPath = path.join(__dirname, 'ancestryAIMs.json');
  const existingData = JSON.parse(fs.readFileSync(aimsPath, 'utf-8'));

  // Merge with existing
  const allMarkers = [
    ...existingData.markers,
    ...markers.map(m => ({
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
      description:
        'Expanded AIM database with markers from literature and Ensembl',
    },
    markers: uniqueMarkers,
  };

  const outputPath = path.join(__dirname, 'ancestryAIMs_expanded.json');
  fs.writeFileSync(outputPath, JSON.stringify(expandedData, null, 2));

  console.log(`\nSaved ${uniqueMarkers.length} total markers to ${outputPath}`);

  // Print summary
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
