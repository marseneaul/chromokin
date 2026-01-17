/**
 * Traits database loader and indexing utilities
 * Provides efficient lookup for trait and gene data
 */

import traitsData from './traits.json';
import type {
  TraitsDatabase,
  TraitsDataFile,
  EnhancedTraitRecord,
  TraitGeneRecord,
  TraitCategory,
} from '@/types/traits';

// Type assertion for imported JSON
const data = traitsData as TraitsDataFile;

/**
 * Load and index the traits database from bundled JSON
 */
function loadTraitsDatabase(): TraitsDatabase {
  const traits = new Map<string, EnhancedTraitRecord>();
  const genes = new Map<string, TraitGeneRecord>();
  const traitsByChromosome = new Map<string, EnhancedTraitRecord[]>();
  const genesByChromosome = new Map<string, TraitGeneRecord[]>();
  const traitsByCategory = new Map<TraitCategory, EnhancedTraitRecord[]>();

  // Index traits
  for (const trait of data.traits) {
    traits.set(trait.id, trait);

    // Index by category
    const categoryTraits = traitsByCategory.get(trait.category) || [];
    categoryTraits.push(trait);
    traitsByCategory.set(trait.category, categoryTraits);

    // Index by chromosome (from associated genes)
    for (const geneAssoc of trait.genes) {
      const chrTraits = traitsByChromosome.get(geneAssoc.chromosome) || [];
      if (!chrTraits.find(t => t.id === trait.id)) {
        chrTraits.push(trait);
        traitsByChromosome.set(geneAssoc.chromosome, chrTraits);
      }
    }
  }

  // Index genes
  for (const gene of data.genes) {
    genes.set(gene.id, gene);

    // Also index by symbol for convenience
    genes.set(gene.symbol, gene);

    const chrGenes = genesByChromosome.get(gene.chromosome) || [];
    chrGenes.push(gene);
    genesByChromosome.set(gene.chromosome, chrGenes);
  }

  return {
    traits,
    genes,
    traitsByChromosome,
    genesByChromosome,
    traitsByCategory,
  };
}

// Singleton instance
let database: TraitsDatabase | null = null;

/**
 * Get the traits database singleton
 * Loads and indexes data on first call
 */
export function getTraitsDatabase(): TraitsDatabase {
  if (!database) {
    database = loadTraitsDatabase();
  }
  return database;
}

/**
 * Get all traits for a specific chromosome
 */
export function getTraitsForChromosome(
  chromosome: string
): EnhancedTraitRecord[] {
  const db = getTraitsDatabase();
  return db.traitsByChromosome.get(chromosome) || [];
}

/**
 * Get all genes for a specific chromosome
 */
export function getGenesForChromosome(chromosome: string): TraitGeneRecord[] {
  const db = getTraitsDatabase();
  return db.genesByChromosome.get(chromosome) || [];
}

/**
 * Get genes within a specific genomic range
 */
export function getGenesInRange(
  chromosome: string,
  start: number,
  end: number
): TraitGeneRecord[] {
  const genes = getGenesForChromosome(chromosome);
  return genes.filter(gene => gene.start <= end && gene.end >= start);
}

/**
 * Get a trait by ID
 */
export function getTraitById(id: string): EnhancedTraitRecord | undefined {
  const db = getTraitsDatabase();
  return db.traits.get(id);
}

/**
 * Get a gene by ID or symbol
 */
export function getGeneById(idOrSymbol: string): TraitGeneRecord | undefined {
  const db = getTraitsDatabase();
  return db.genes.get(idOrSymbol);
}

/**
 * Get all traits in a category
 */
export function getTraitsByCategory(
  category: TraitCategory
): EnhancedTraitRecord[] {
  const db = getTraitsDatabase();
  return db.traitsByCategory.get(category) || [];
}

/**
 * Get all chromosomes that have trait-associated genes
 */
export function getChromosomesWithTraits(): string[] {
  const db = getTraitsDatabase();
  return Array.from(db.genesByChromosome.keys()).sort((a, b) => {
    // Sort numerically, with X, Y, MT at end
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Get traits associated with a specific gene
 */
export function getTraitsForGene(
  geneIdOrSymbol: string
): EnhancedTraitRecord[] {
  const db = getTraitsDatabase();
  const gene = db.genes.get(geneIdOrSymbol);
  if (!gene) return [];

  return gene.traitIds
    .map(id => db.traits.get(id))
    .filter((t): t is EnhancedTraitRecord => t !== undefined);
}

/**
 * Search traits by name or tag
 */
export function searchTraits(query: string): EnhancedTraitRecord[] {
  const db = getTraitsDatabase();
  const lowerQuery = query.toLowerCase();

  return Array.from(db.traits.values()).filter(trait => {
    return (
      trait.name.toLowerCase().includes(lowerQuery) ||
      trait.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      trait.category.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Get database metadata
 */
export function getDatabaseMetadata(): {
  version: string;
  build: string;
  lastUpdated: string;
  traitCount: number;
  geneCount: number;
} {
  const db = getTraitsDatabase();
  return {
    version: data.version,
    build: data.build,
    lastUpdated: data.lastUpdated,
    traitCount: db.traits.size,
    geneCount: data.genes.length, // Use original count, not map size (which includes symbol aliases)
  };
}
