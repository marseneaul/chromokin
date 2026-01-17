/**
 * Genomic features database loader and indexing utilities
 * Provides efficient lookup for HERVs, transposons, pseudogenes, etc.
 */

import featuresData from './genomicFeatures.json';
import type {
  GenomicFeaturesDatabase,
  GenomicFeaturesDataFile,
  GenomicFeature,
  GenomicFeatureType,
  FeatureTypeSummary,
} from '@/types/genomicFeatures';

// Type assertion for imported JSON
const data = featuresData as GenomicFeaturesDataFile;

/**
 * Load and index the genomic features database from bundled JSON
 */
function loadGenomicFeaturesDatabase(): GenomicFeaturesDatabase {
  const features = new Map<string, GenomicFeature>();
  const featuresByChromosome = new Map<string, GenomicFeature[]>();
  const featuresByType = new Map<GenomicFeatureType, GenomicFeature[]>();
  const typeSummaries = new Map<GenomicFeatureType, FeatureTypeSummary>();

  // Index type summaries
  for (const summary of data.typeSummaries) {
    typeSummaries.set(summary.type, summary);
  }

  // Index features
  for (const feature of data.features) {
    features.set(feature.id, feature);

    // Index by chromosome
    const chrFeatures = featuresByChromosome.get(feature.chromosome) || [];
    chrFeatures.push(feature);
    featuresByChromosome.set(feature.chromosome, chrFeatures);

    // Index by type
    const typeFeatures = featuresByType.get(feature.type) || [];
    typeFeatures.push(feature);
    featuresByType.set(feature.type, typeFeatures);
  }

  return {
    features,
    featuresByChromosome,
    featuresByType,
    typeSummaries,
  };
}

// Singleton instance
let database: GenomicFeaturesDatabase | null = null;

/**
 * Get the genomic features database singleton
 * Loads and indexes data on first call
 */
export function getGenomicFeaturesDatabase(): GenomicFeaturesDatabase {
  if (!database) {
    database = loadGenomicFeaturesDatabase();
  }
  return database;
}

/**
 * Get all features for a specific chromosome
 */
export function getFeaturesForChromosome(chromosome: string): GenomicFeature[] {
  const db = getGenomicFeaturesDatabase();
  return db.featuresByChromosome.get(chromosome) || [];
}

/**
 * Get features within a specific genomic range
 */
export function getFeaturesInRange(
  chromosome: string,
  start: number,
  end: number
): GenomicFeature[] {
  const features = getFeaturesForChromosome(chromosome);
  return features.filter(
    feature => feature.start <= end && feature.end >= start
  );
}

/**
 * Get features within range filtered by type
 */
export function getFeaturesInRangeByType(
  chromosome: string,
  start: number,
  end: number,
  types?: GenomicFeatureType[]
): GenomicFeature[] {
  const features = getFeaturesInRange(chromosome, start, end);
  if (!types || types.length === 0) return features;
  return features.filter(f => types.includes(f.type));
}

/**
 * Get a feature by ID
 */
export function getFeatureById(id: string): GenomicFeature | undefined {
  const db = getGenomicFeaturesDatabase();
  return db.features.get(id);
}

/**
 * Get all features of a specific type
 */
export function getFeaturesByType(type: GenomicFeatureType): GenomicFeature[] {
  const db = getGenomicFeaturesDatabase();
  return db.featuresByType.get(type) || [];
}

/**
 * Get type summary/metadata
 */
export function getTypeSummary(
  type: GenomicFeatureType
): FeatureTypeSummary | undefined {
  const db = getGenomicFeaturesDatabase();
  return db.typeSummaries.get(type);
}

/**
 * Get all type summaries
 */
export function getAllTypeSummaries(): FeatureTypeSummary[] {
  const db = getGenomicFeaturesDatabase();
  return Array.from(db.typeSummaries.values());
}

/**
 * Get all chromosomes that have genomic features
 */
export function getChromosomesWithFeatures(): string[] {
  const db = getGenomicFeaturesDatabase();
  return Array.from(db.featuresByChromosome.keys()).sort((a, b) => {
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
 * Search features by name or tag
 */
export function searchFeatures(query: string): GenomicFeature[] {
  const db = getGenomicFeaturesDatabase();
  const lowerQuery = query.toLowerCase();

  return Array.from(db.features.values()).filter(feature => {
    return (
      feature.name.toLowerCase().includes(lowerQuery) ||
      (feature.nickname?.toLowerCase().includes(lowerQuery) ?? false) ||
      feature.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      feature.type.toLowerCase().includes(lowerQuery) ||
      (feature.subtype?.toLowerCase().includes(lowerQuery) ?? false)
    );
  });
}

/**
 * Get database metadata
 */
export function getGenomicFeaturesMetadata(): {
  version: string;
  build: string;
  lastUpdated: string;
  featureCount: number;
  typeCount: number;
} {
  const db = getGenomicFeaturesDatabase();
  return {
    version: data.version,
    build: data.build,
    lastUpdated: data.lastUpdated,
    featureCount: db.features.size,
    typeCount: db.typeSummaries.size,
  };
}

/**
 * Get color for a feature type
 */
export function getFeatureTypeColor(type: GenomicFeatureType): string {
  const summary = getTypeSummary(type);
  return summary?.color || '#6b7280';
}

/**
 * Get display name for a feature type
 */
export function getFeatureTypeDisplayName(type: GenomicFeatureType): string {
  const summary = getTypeSummary(type);
  return summary?.displayName || type;
}
