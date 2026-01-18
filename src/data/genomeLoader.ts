/**
 * Genome metadata loader
 * Loads cytobands and chromosome data from genome_metadata.json
 */

import type { Cytoband, CytobandStain } from '@/types/genome';
import genomeMetadata from './genome_metadata.json';

interface RawCytoband {
  chrom: string;
  chromStart: number;
  chromEnd: number;
  name: string;
  stain: string;
}

interface GenomeMetadata {
  hg38: {
    chromosomes: Array<{ chromosome: string; length: number }>;
    cytobands: RawCytoband[];
  };
}

// Type assertion for the imported JSON
const metadata = genomeMetadata as GenomeMetadata;

// Indexed cytobands by chromosome
let cytobandsByChromosome: Map<string, Cytoband[]> | null = null;
let chromosomeLengths: Map<string, number> | null = null;

/**
 * Initialize the cytoband index
 */
function initializeCytobands(): void {
  if (cytobandsByChromosome) return;

  cytobandsByChromosome = new Map();
  chromosomeLengths = new Map();

  // Index chromosome lengths
  for (const chr of metadata.hg38.chromosomes) {
    chromosomeLengths.set(chr.chromosome, chr.length);
  }

  // Index cytobands by chromosome
  for (const band of metadata.hg38.cytobands) {
    // Normalize chromosome name (remove "chr" prefix)
    const chrom = band.chrom.replace('chr', '');

    const cytoband: Cytoband = {
      chrom: band.chrom,
      chromStart: band.chromStart,
      chromEnd: band.chromEnd,
      name: band.name,
      stain: band.stain as CytobandStain,
    };

    if (!cytobandsByChromosome.has(chrom)) {
      cytobandsByChromosome.set(chrom, []);
    }
    cytobandsByChromosome.get(chrom)!.push(cytoband);
  }

  // Sort each chromosome's bands by position
  for (const bands of cytobandsByChromosome.values()) {
    bands.sort((a, b) => a.chromStart - b.chromStart);
  }
}

/**
 * Get all cytobands for a chromosome
 */
export function getCytobandsForChromosome(chromosome: string): Cytoband[] {
  initializeCytobands();
  return cytobandsByChromosome?.get(chromosome) || [];
}

/**
 * Get cytobands in a specific range
 */
export function getCytobandsInRange(
  chromosome: string,
  start: number,
  end: number
): Cytoband[] {
  const bands = getCytobandsForChromosome(chromosome);
  return bands.filter(band => band.chromEnd > start && band.chromStart < end);
}

/**
 * Get chromosome length
 */
export function getChromosomeLength(chromosome: string): number {
  initializeCytobands();
  return chromosomeLengths?.get(chromosome) || 0;
}

/**
 * Get all chromosome names
 */
export function getChromosomeNames(): string[] {
  initializeCytobands();
  return Array.from(chromosomeLengths?.keys() || []);
}

/**
 * Find the centromere position for a chromosome
 * Returns the start and end of the centromere region
 */
export function getCentromerePosition(
  chromosome: string
): { start: number; end: number } | null {
  const bands = getCytobandsForChromosome(chromosome);
  const centromeres = bands.filter(b => b.stain === 'acen');

  if (centromeres.length === 0) return null;

  return {
    start: Math.min(...centromeres.map(b => b.chromStart)),
    end: Math.max(...centromeres.map(b => b.chromEnd)),
  };
}

/**
 * Get the arm (p or q) for a position on a chromosome
 */
export function getChromosomeArm(
  chromosome: string,
  position: number
): 'p' | 'q' | 'centromere' {
  const centromere = getCentromerePosition(chromosome);

  if (!centromere) return 'q'; // Default if no centromere found

  if (position < centromere.start) return 'p';
  if (position > centromere.end) return 'q';
  return 'centromere';
}

/**
 * Get cytoband name for a position (e.g., "1p36.33")
 */
export function getCytobandAtPosition(
  chromosome: string,
  position: number
): string | null {
  const bands = getCytobandsForChromosome(chromosome);
  const band = bands.find(
    b => position >= b.chromStart && position < b.chromEnd
  );

  return band ? `${chromosome}${band.name}` : null;
}
