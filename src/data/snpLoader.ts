/**
 * SNP data loader
 * Loads and indexes annotated SNP data for display
 */

import type { AnnotatedSNP, SNPCategory } from '@/types/genome';
import snpData from './snpDemo.json';

interface SNPDataFile {
  metadata: {
    source: string;
    buildVersion: string;
    totalSnps: number;
    description: string;
  };
  snps: Array<{
    rsid: string;
    chromosome: string;
    position: number;
    genotype: string;
    name?: string;
    gene?: string;
    category: string;
    traitAssociation?: string;
    riskAllele?: string;
    effectAllele?: string;
    hasRiskAllele?: boolean;
    isHomozygous?: boolean;
    globalFrequency?: number;
    isRare?: boolean;
    funFact?: string;
    clinicalSignificance?: string;
    confidence: string;
    source?: string;
  }>;
}

// Type assertion for imported JSON
const rawData = snpData as SNPDataFile;

// Indexed data
let snpsByChromosome: Map<string, AnnotatedSNP[]> | null = null;
let snpsByRsid: Map<string, AnnotatedSNP> | null = null;
let snpsByCategory: Map<SNPCategory, AnnotatedSNP[]> | null = null;
let allSnps: AnnotatedSNP[] | null = null;

/**
 * Initialize the SNP data indexes
 */
function initializeSNPs(): void {
  if (allSnps) return;

  // Parse SNPs
  allSnps = rawData.snps.map(snp => {
    const annotated: AnnotatedSNP = {
      rsid: snp.rsid,
      chromosome: snp.chromosome,
      position: snp.position,
      genotype: snp.genotype,
      category: snp.category as SNPCategory,
      confidence: snp.confidence as 'high' | 'moderate' | 'low',
    };

    // Add optional fields only if defined
    if (snp.name) annotated.name = snp.name;
    if (snp.gene) annotated.gene = snp.gene;
    if (snp.traitAssociation) annotated.traitAssociation = snp.traitAssociation;
    if (snp.riskAllele) annotated.riskAllele = snp.riskAllele;
    if (snp.effectAllele) annotated.effectAllele = snp.effectAllele;
    if (snp.hasRiskAllele !== undefined)
      annotated.hasRiskAllele = snp.hasRiskAllele;
    if (snp.isHomozygous !== undefined)
      annotated.isHomozygous = snp.isHomozygous;
    if (snp.globalFrequency !== undefined)
      annotated.globalFrequency = snp.globalFrequency;
    annotated.isRare =
      snp.isRare ?? (snp.globalFrequency ? snp.globalFrequency < 0.01 : false);
    if (snp.funFact) annotated.funFact = snp.funFact;
    if (snp.clinicalSignificance)
      annotated.clinicalSignificance = snp.clinicalSignificance;
    if (snp.source) annotated.source = snp.source;

    return annotated;
  });

  // Index by chromosome
  snpsByChromosome = new Map();
  for (const snp of allSnps) {
    if (!snpsByChromosome.has(snp.chromosome)) {
      snpsByChromosome.set(snp.chromosome, []);
    }
    snpsByChromosome.get(snp.chromosome)!.push(snp);
  }

  // Sort by position within each chromosome
  for (const snps of snpsByChromosome.values()) {
    snps.sort((a, b) => a.position - b.position);
  }

  // Index by rsid
  snpsByRsid = new Map();
  for (const snp of allSnps) {
    snpsByRsid.set(snp.rsid, snp);
  }

  // Index by category
  snpsByCategory = new Map();
  for (const snp of allSnps) {
    if (!snpsByCategory.has(snp.category)) {
      snpsByCategory.set(snp.category, []);
    }
    snpsByCategory.get(snp.category)!.push(snp);
  }
}

/**
 * Get all SNPs
 */
export function getAllSNPs(): AnnotatedSNP[] {
  initializeSNPs();
  return allSnps || [];
}

/**
 * Get SNPs for a specific chromosome
 */
export function getSNPsForChromosome(chromosome: string): AnnotatedSNP[] {
  initializeSNPs();
  return snpsByChromosome?.get(chromosome) || [];
}

/**
 * Get SNPs in a specific range
 */
export function getSNPsInRange(
  chromosome: string,
  start: number,
  end: number
): AnnotatedSNP[] {
  const snps = getSNPsForChromosome(chromosome);
  return snps.filter(snp => snp.position >= start && snp.position <= end);
}

/**
 * Get a SNP by rsid
 */
export function getSNPByRsid(rsid: string): AnnotatedSNP | null {
  initializeSNPs();
  return snpsByRsid?.get(rsid) || null;
}

/**
 * Get SNPs by category
 */
export function getSNPsByCategory(category: SNPCategory): AnnotatedSNP[] {
  initializeSNPs();
  return snpsByCategory?.get(category) || [];
}

/**
 * Get SNPs where user has risk/effect allele
 */
export function getSNPsWithRiskAllele(): AnnotatedSNP[] {
  return getAllSNPs().filter(snp => snp.hasRiskAllele);
}

/**
 * Get interesting SNPs (has risk allele or rare)
 */
export function getInterestingSNPs(): AnnotatedSNP[] {
  return getAllSNPs().filter(snp => snp.hasRiskAllele || snp.isRare);
}

/**
 * Get SNP count by category
 */
export function getSNPCountByCategory(): Map<SNPCategory, number> {
  initializeSNPs();
  const counts = new Map<SNPCategory, number>();
  if (snpsByCategory) {
    for (const [category, snps] of snpsByCategory) {
      counts.set(category, snps.length);
    }
  }
  return counts;
}

/**
 * Get total SNP count
 */
export function getTotalSNPCount(): number {
  return getAllSNPs().length;
}

/**
 * Search SNPs by gene name or rsid
 */
export function searchSNPs(query: string): AnnotatedSNP[] {
  const lowerQuery = query.toLowerCase();
  return getAllSNPs().filter(
    snp =>
      snp.rsid.toLowerCase().includes(lowerQuery) ||
      snp.gene?.toLowerCase().includes(lowerQuery) ||
      snp.name?.toLowerCase().includes(lowerQuery) ||
      snp.traitAssociation?.toLowerCase().includes(lowerQuery)
  );
}
