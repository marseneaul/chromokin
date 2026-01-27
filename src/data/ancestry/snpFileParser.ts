/**
 * SNP file parser for 23andMe and AncestryDNA raw data files
 *
 * Supports:
 * - 23andMe format: rsid, chromosome, position, genotype (4 columns)
 * - AncestryDNA format: rsid, chromosome, position, allele1, allele2 (5 columns)
 *
 * Both use GRCh37 coordinates.
 */

import type { SNPGenotype } from '@/types/genome';

export type SNPFileSource = '23andme' | 'ancestry' | 'unknown';

export interface ParsedSNPFile {
  source: SNPFileSource;
  buildVersion: 'GRCh37' | 'GRCh38';
  snpCount: number;
  snps: Map<string, SNPGenotype>;
  metadata: {
    generatedAt?: string;
    arrayVersion?: string;
  };
}

export interface ParseProgress {
  totalLines: number;
  processedLines: number;
  validSnps: number;
  skippedLines: number;
}

/**
 * Detect the source format from file content
 */
export function detectFileSource(content: string): SNPFileSource {
  const firstLines = content.slice(0, 2000).toLowerCase();

  if (firstLines.includes('23andme')) {
    return '23andme';
  }
  if (
    firstLines.includes('ancestrydna') ||
    firstLines.includes('ancestry.com')
  ) {
    return 'ancestry';
  }

  // Try to detect by column count in first data line
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const columns = line.split('\t');
    if (columns.length === 4) return '23andme';
    if (columns.length === 5) return 'ancestry';
    break;
  }

  return 'unknown';
}

/**
 * Parse a 23andMe genotype string
 * Examples: "AA", "AG", "GG", "--", "A", "D", "I"
 */
function parse23andMeGenotype(genotype: string): string {
  const gt = genotype.trim().toUpperCase();

  // No-call
  if (gt === '--' || gt === '00' || gt === '') {
    return '--';
  }

  // Single allele (X/Y chromosomes in males, or indels)
  if (gt.length === 1) {
    return gt;
  }

  // Standard diploid genotype
  if (gt.length === 2) {
    // Sort alleles for consistent representation (e.g., GA -> AG)
    const alleles = gt.split('').sort();
    return alleles.join('');
  }

  // Indel notation
  if (gt === 'DD' || gt === 'DI' || gt === 'II') {
    return gt;
  }

  return gt;
}

/**
 * Parse Ancestry allele columns into genotype string
 */
function parseAncestryGenotype(allele1: string, allele2: string): string {
  const a1 = allele1.trim().toUpperCase();
  const a2 = allele2.trim().toUpperCase();

  // No-call
  if (a1 === '0' || a2 === '0' || a1 === '' || a2 === '') {
    return '--';
  }

  // Sort alleles for consistent representation
  const alleles = [a1, a2].sort();
  return alleles.join('');
}

/**
 * Normalize chromosome name
 * Handles: "1", "chr1", "23" (X), "24" (Y), "25" (MT)
 */
function normalizeChromosome(chr: string): string {
  const normalized = chr.trim().toLowerCase().replace('chr', '');

  // Handle numeric sex chromosomes
  if (normalized === '23') return 'X';
  if (normalized === '24') return 'Y';
  if (normalized === '25' || normalized === '26' || normalized === 'mt')
    return 'MT';

  return normalized.toUpperCase();
}

/**
 * Parse a 23andMe format file
 */
function parse23andMeFile(
  content: string,
  onProgress?: (progress: ParseProgress) => void
): ParsedSNPFile {
  const lines = content.split('\n');
  const snps = new Map<string, SNPGenotype>();
  const metadata: ParsedSNPFile['metadata'] = {};

  let processedLines = 0;
  let skippedLines = 0;

  for (const line of lines) {
    processedLines++;

    // Extract metadata from comments
    if (line.startsWith('#')) {
      if (line.includes('generated')) {
        const match = line.match(/at:\s*(.+)/i);
        if (match) metadata.generatedAt = match[1].trim();
      }
      continue;
    }

    // Skip empty lines and header
    if (line.trim() === '' || line.startsWith('rsid')) {
      continue;
    }

    const columns = line.split('\t');
    if (columns.length < 4) {
      skippedLines++;
      continue;
    }

    const [rsid, chromosome, position, genotype] = columns;

    // Skip internal IDs (start with 'i') for ancestry inference
    // but we still include them in the full parse
    const normalizedChr = normalizeChromosome(chromosome);
    const pos = parseInt(position, 10);

    if (isNaN(pos)) {
      skippedLines++;
      continue;
    }

    const snp: SNPGenotype = {
      rsid: rsid.trim(),
      chromosome: normalizedChr,
      position: pos,
      genotype: parse23andMeGenotype(genotype),
    };

    snps.set(snp.rsid, snp);

    // Report progress every 50k lines
    if (onProgress && processedLines % 50000 === 0) {
      onProgress({
        totalLines: lines.length,
        processedLines,
        validSnps: snps.size,
        skippedLines,
      });
    }
  }

  return {
    source: '23andme',
    buildVersion: 'GRCh37',
    snpCount: snps.size,
    snps,
    metadata,
  };
}

/**
 * Parse an AncestryDNA format file
 */
function parseAncestryFile(
  content: string,
  onProgress?: (progress: ParseProgress) => void
): ParsedSNPFile {
  const lines = content.split('\n');
  const snps = new Map<string, SNPGenotype>();
  const metadata: ParsedSNPFile['metadata'] = {};

  let processedLines = 0;
  let skippedLines = 0;

  for (const line of lines) {
    processedLines++;

    // Extract metadata from comments
    if (line.startsWith('#')) {
      if (line.includes('generated')) {
        const match = line.match(/at:\s*(.+)/i);
        if (match) metadata.generatedAt = match[1].trim();
      }
      if (line.includes('array version')) {
        const match = line.match(/version:\s*(.+)/i);
        if (match) metadata.arrayVersion = match[1].trim();
      }
      continue;
    }

    // Skip empty lines and header
    if (line.trim() === '' || line.startsWith('rsid')) {
      continue;
    }

    const columns = line.split('\t');
    if (columns.length < 5) {
      skippedLines++;
      continue;
    }

    const [rsid, chromosome, position, allele1, allele2] = columns;

    const normalizedChr = normalizeChromosome(chromosome);
    const pos = parseInt(position, 10);

    if (isNaN(pos)) {
      skippedLines++;
      continue;
    }

    const snp: SNPGenotype = {
      rsid: rsid.trim(),
      chromosome: normalizedChr,
      position: pos,
      genotype: parseAncestryGenotype(allele1, allele2),
    };

    snps.set(snp.rsid, snp);

    // Report progress every 50k lines
    if (onProgress && processedLines % 50000 === 0) {
      onProgress({
        totalLines: lines.length,
        processedLines,
        validSnps: snps.size,
        skippedLines,
      });
    }
  }

  return {
    source: 'ancestry',
    buildVersion: 'GRCh37',
    snpCount: snps.size,
    snps,
    metadata,
  };
}

/**
 * Parse a SNP file (auto-detects format)
 */
export function parseSNPFile(
  content: string,
  onProgress?: (progress: ParseProgress) => void
): ParsedSNPFile {
  const source = detectFileSource(content);

  if (source === '23andme') {
    return parse23andMeFile(content, onProgress);
  }

  if (source === 'ancestry') {
    return parseAncestryFile(content, onProgress);
  }

  // Try 23andMe format as default (4 columns)
  return parse23andMeFile(content, onProgress);
}

/**
 * Parse a file asynchronously using streaming for large files
 * This is a wrapper that can be used with File objects from file input
 */
export async function parseSNPFileAsync(
  file: File,
  onProgress?: (progress: ParseProgress) => void
): Promise<ParsedSNPFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        const result = parseSNPFile(content, onProgress);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
