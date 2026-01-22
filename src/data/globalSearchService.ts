/**
 * Global search service
 * Unified search across genes, SNPs, traits, features, and cytobands
 */

import { getTraitsDatabase } from './traitsLoader';
import { getAllSNPs } from './snpLoader';
import { getGenomicFeaturesDatabase } from './genomicFeaturesLoader';
import { getCytobandsForChromosome, getChromosomeNames } from './genomeLoader';
import type {
  SearchResults,
  GeneSearchResult,
  SNPSearchResult,
  TraitSearchResult,
  FeatureSearchResult,
  CytobandSearchResult,
} from '@/types/search';

/**
 * Calculate relevance score for a match
 */
function calculateScore(
  text: string,
  query: string,
  fieldWeight: number = 1
): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (lowerText === lowerQuery) return 100 * fieldWeight; // Exact match
  if (lowerText.startsWith(lowerQuery)) return 80 * fieldWeight; // Starts with
  if (lowerText.includes(lowerQuery)) return 50 * fieldWeight; // Contains
  return 0;
}

/**
 * Get max score across multiple fields
 */
function getMaxScore(
  fields: Array<{ value: string | undefined; weight: number }>,
  query: string
): number {
  return Math.max(
    0,
    ...fields
      .filter(f => f.value)
      .map(f => calculateScore(f.value!, query, f.weight))
  );
}

/**
 * Search genes
 */
export function searchGenes(query: string): GeneSearchResult[] {
  const db = getTraitsDatabase();
  const lowerQuery = query.toLowerCase();
  const results: GeneSearchResult[] = [];
  const seenIds = new Set<string>();

  for (const gene of db.genes.values()) {
    // Skip if we've already added this gene (it's indexed by both id and symbol)
    if (seenIds.has(gene.id)) continue;
    seenIds.add(gene.id);

    const score = getMaxScore(
      [
        { value: gene.symbol, weight: 1.5 }, // Higher weight for symbol
        { value: gene.nickname, weight: 1.2 },
        { value: gene.name, weight: 1 },
      ],
      lowerQuery
    );

    if (score > 0) {
      results.push({
        id: gene.id,
        type: 'gene',
        primaryText: gene.symbol,
        secondaryText: gene.nickname || gene.name,
        chromosome: gene.chromosome,
        start: gene.start,
        end: gene.end,
        score,
        gene,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Search SNPs
 */
export function searchSNPs(query: string): SNPSearchResult[] {
  const snps = getAllSNPs();
  const lowerQuery = query.toLowerCase();
  const results: SNPSearchResult[] = [];

  for (const snp of snps) {
    const score = getMaxScore(
      [
        { value: snp.rsid, weight: 1.5 }, // Higher weight for rsid
        { value: snp.gene, weight: 1.2 },
        { value: snp.name, weight: 1 },
        { value: snp.traitAssociation, weight: 0.8 },
      ],
      lowerQuery
    );

    if (score > 0) {
      const secondaryText = snp.name || snp.traitAssociation || snp.gene;
      const result: SNPSearchResult = {
        id: snp.rsid,
        type: 'snp',
        primaryText: snp.rsid,
        chromosome: snp.chromosome,
        start: snp.position,
        end: snp.position,
        score,
        snp,
      };
      if (secondaryText) {
        result.secondaryText = secondaryText;
      }
      results.push(result);
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Search traits
 */
export function searchTraits(query: string): TraitSearchResult[] {
  const db = getTraitsDatabase();
  const lowerQuery = query.toLowerCase();
  const results: TraitSearchResult[] = [];

  for (const trait of db.traits.values()) {
    const tagScore = trait.tags.some(tag =>
      tag.toLowerCase().includes(lowerQuery)
    )
      ? 40
      : 0;

    const score = Math.max(
      getMaxScore(
        [
          { value: trait.name, weight: 1.5 },
          { value: trait.category, weight: 0.8 },
        ],
        lowerQuery
      ),
      tagScore
    );

    if (score > 0) {
      // Use first gene's location for navigation
      const firstGene = trait.genes[0];
      const chromosome = firstGene?.chromosome || '1';
      const start = firstGene?.start || 0;
      const end = firstGene?.end || 0;

      results.push({
        id: trait.id,
        type: 'trait',
        primaryText: trait.name,
        secondaryText: trait.category,
        chromosome,
        start,
        end,
        score,
        trait,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Search genomic features
 */
export function searchFeatures(query: string): FeatureSearchResult[] {
  const db = getGenomicFeaturesDatabase();
  const lowerQuery = query.toLowerCase();
  const results: FeatureSearchResult[] = [];

  for (const feature of db.features.values()) {
    const tagScore = feature.tags.some(tag =>
      tag.toLowerCase().includes(lowerQuery)
    )
      ? 40
      : 0;

    const score = Math.max(
      getMaxScore(
        [
          { value: feature.name, weight: 1.2 },
          { value: feature.nickname, weight: 1.5 },
          { value: feature.type, weight: 0.8 },
          { value: feature.subtype, weight: 1 },
        ],
        lowerQuery
      ),
      tagScore
    );

    if (score > 0) {
      results.push({
        id: feature.id,
        type: 'feature',
        primaryText: feature.nickname || feature.name,
        secondaryText: feature.type,
        chromosome: feature.chromosome,
        start: feature.start,
        end: feature.end,
        score,
        feature,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Search cytobands
 */
export function searchCytobands(query: string): CytobandSearchResult[] {
  const lowerQuery = query.toLowerCase();
  const results: CytobandSearchResult[] = [];
  const chromosomes = getChromosomeNames();

  for (const chr of chromosomes) {
    const bands = getCytobandsForChromosome(chr);

    for (const band of bands) {
      // Create full band name (e.g., "1p36.33")
      const fullName = `${chr}${band.name}`;

      const score = getMaxScore(
        [
          { value: fullName, weight: 1.5 },
          { value: band.name, weight: 1 },
        ],
        lowerQuery
      );

      if (score > 0) {
        results.push({
          id: `${chr}-${band.name}`,
          type: 'cytoband',
          primaryText: fullName,
          secondaryText: `${band.chromStart.toLocaleString()} - ${band.chromEnd.toLocaleString()}`,
          chromosome: chr,
          start: band.chromStart,
          end: band.chromEnd,
          score,
          cytoband: band,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Global search across all entity types
 */
export function globalSearch(query: string, limit: number = 5): SearchResults {
  const trimmedQuery = query.trim();

  // Require at least 2 characters
  if (trimmedQuery.length < 2) {
    return {
      genes: [],
      snps: [],
      traits: [],
      features: [],
      cytobands: [],
      totalCount: 0,
    };
  }

  const genes = searchGenes(trimmedQuery).slice(0, limit);
  const snps = searchSNPs(trimmedQuery).slice(0, limit);
  const traits = searchTraits(trimmedQuery).slice(0, limit);
  const features = searchFeatures(trimmedQuery).slice(0, limit);
  const cytobands = searchCytobands(trimmedQuery).slice(0, limit);

  return {
    genes,
    snps,
    traits,
    features,
    cytobands,
    totalCount:
      genes.length +
      snps.length +
      traits.length +
      features.length +
      cytobands.length,
  };
}
