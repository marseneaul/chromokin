/**
 * Test script for ancestry inference
 *
 * Run with: npx tsx src/data/ancestry/testInference.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  parseSNPFile,
  inferAncestry,
  countAvailableAIMs,
  formatAncestryResult,
  inferLocalAncestry,
  inferLocalAncestryHMM,
} from './index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.join(__dirname, '../test-data');

async function testFile(filename: string) {
  const filepath = path.join(TEST_DATA_DIR, filename);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${filename}`);
  console.log('='.repeat(60));

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    console.log(`File not found: ${filepath}`);
    return;
  }

  // Read and parse file
  console.log('\nParsing file...');
  const content = fs.readFileSync(filepath, 'utf-8');
  const startParse = Date.now();
  const parsed = parseSNPFile(content);
  const parseTime = Date.now() - startParse;

  console.log(`  Source detected: ${parsed.source}`);
  console.log(`  Build version: ${parsed.buildVersion}`);
  console.log(`  Total SNPs: ${parsed.snpCount.toLocaleString()}`);
  console.log(`  Parse time: ${parseTime}ms`);

  if (parsed.metadata.generatedAt) {
    console.log(`  Generated: ${parsed.metadata.generatedAt}`);
  }

  // Check AIM availability
  console.log('\nChecking AIMs...');
  const aimStats = countAvailableAIMs(parsed.snps);
  console.log(`  Available: ${aimStats.available} of ${aimStats.total}`);
  console.log(
    `  Coverage: ${((aimStats.available / aimStats.total) * 100).toFixed(1)}%`
  );

  if (aimStats.missing.length > 0 && aimStats.missing.length <= 20) {
    console.log(`  Missing: ${aimStats.missing.join(', ')}`);
  }

  // Run ancestry inference
  console.log('\nRunning ancestry inference...');
  const startInfer = Date.now();
  const result = inferAncestry(parsed, { includeMarkerDetails: true });
  const inferTime = Date.now() - startInfer;

  console.log(`  Inference time: ${inferTime}ms`);
  console.log(`  Markers used: ${result.markersUsed}`);
  console.log(`  Confidence: ${result.confidence}`);

  // Display results
  console.log('\n' + formatAncestryResult(result));

  // Show raw proportions
  console.log('\nRaw proportions:');
  for (const [pop, prop] of Object.entries(result.proportions)) {
    console.log(`  ${pop}: ${(prop * 100).toFixed(2)}%`);
  }

  // Show most informative markers if available
  if (result.markerDetails && result.markerDetails.length > 0) {
    console.log('\nTop 10 most informative markers used:');
    const topMarkers = result.markerDetails
      .sort((a, b) => b.informativeness - a.informativeness)
      .slice(0, 10);

    for (const marker of topMarkers) {
      console.log(
        `  ${marker.rsid} (chr${marker.chromosome}): ${marker.userGenotype} - informativeness: ${marker.informativeness.toFixed(3)}`
      );
    }
  }

  // Run local ancestry inference (chromosomal segments)
  console.log('\n' + '-'.repeat(60));
  console.log('Running LOCAL ANCESTRY inference (chromosomal segments)...');
  const startLocal = Date.now();
  const localResult = inferLocalAncestry(parsed);
  const localTime = Date.now() - startLocal;

  console.log(`  Inference time: ${localTime}ms`);
  console.log(`  Total segments: ${localResult.summary.totalSegments}`);
  console.log(
    `  Chromosomes processed: ${localResult.summary.chromosomesProcessed}`
  );
  console.log(
    `  Average confidence: ${(localResult.summary.averageConfidence * 100).toFixed(1)}%`
  );

  console.log('\nAncestry breakdown by genome length:');
  for (const [pop, pct] of Object.entries(
    localResult.summary.ancestryBreakdown
  )) {
    if (pct >= 0.1) {
      const bar = '█'.repeat(Math.round(pct / 2));
      console.log(`  ${pop.padEnd(5)} ${pct.toFixed(1).padStart(5)}% ${bar}`);
    }
  }

  // Show segments for a few chromosomes (window-based)
  console.log('\nWindow-based sample segments (chr1, chr2, chrX):');
  for (const chr of ['1', '2', 'X']) {
    const chrSegs = localResult.segmentsByChromosome.get(chr) || [];
    console.log(`\n  Chromosome ${chr} (${chrSegs.length} segments):`);
    for (const seg of chrSegs.slice(0, 5)) {
      const startMb = (seg.start / 1_000_000).toFixed(1);
      const endMb = (seg.end / 1_000_000).toFixed(1);
      const conf = ((seg.confidence || 0) * 100).toFixed(0);
      console.log(
        `    ${startMb.padStart(6)}Mb - ${endMb.padStart(6)}Mb: ${seg.category} (${conf}% conf)`
      );
    }
    if (chrSegs.length > 5) {
      console.log(`    ... and ${chrSegs.length - 5} more segments`);
    }
  }

  // Run HMM-based local ancestry inference
  console.log('\n' + '-'.repeat(60));
  console.log('Running HMM-based LOCAL ANCESTRY inference...');
  const startHMM = Date.now();
  const hmmResult = inferLocalAncestryHMM(parsed, result);
  const hmmTime = Date.now() - startHMM;

  console.log(`  Inference time: ${hmmTime}ms`);
  console.log(`  Total segments: ${hmmResult.summary.totalSegments}`);
  console.log(
    `  Chromosomes processed: ${hmmResult.summary.chromosomesProcessed}`
  );
  console.log(`  Markers used: ${hmmResult.summary.markersUsed}`);

  console.log('\nHMM Ancestry breakdown by genome length:');
  for (const [pop, pct] of Object.entries(
    hmmResult.summary.ancestryBreakdown
  )) {
    if (pct >= 0.1) {
      const bar = '█'.repeat(Math.round(pct / 2));
      console.log(`  ${pop.padEnd(5)} ${pct.toFixed(1).padStart(5)}% ${bar}`);
    }
  }

  // Show HMM segments for a few chromosomes
  console.log('\nHMM sample segments (chr1, chr2, chrX):');
  for (const chr of ['1', '2', 'X']) {
    const chrSegs = hmmResult.segmentsByChromosome.get(chr) || [];
    console.log(`\n  Chromosome ${chr} (${chrSegs.length} segments):`);
    for (const seg of chrSegs.slice(0, 5)) {
      const startMb = (seg.start / 1_000_000).toFixed(1);
      const endMb = (seg.end / 1_000_000).toFixed(1);
      const conf = ((seg.confidence || 0) * 100).toFixed(0);
      console.log(
        `    ${startMb.padStart(6)}Mb - ${endMb.padStart(6)}Mb: ${seg.category} (${conf}% conf)`
      );
    }
    if (chrSegs.length > 5) {
      console.log(`    ... and ${chrSegs.length - 5} more segments`);
    }
  }
}

async function main() {
  console.log('Ancestry Inference Test');
  console.log('=======================\n');

  // Test both files
  await testFile('23andme.txt');
  await testFile('ancestry.txt');

  console.log('\n\nTest complete!');
}

main().catch(console.error);
