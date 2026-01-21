/**
 * Cytoband annotation loader
 * Loads layman-friendly annotations for cytobands
 */

import type { CytobandStain, Cytoband } from '@/types/genome';
import type { CopyLevel } from '@/types/core';
import type { CopyLevelContent } from '@/types/traits';
import annotationsData from './cytobandAnnotations.json';

interface StainDescription {
  name: string;
  color: string;
  description: CopyLevelContent;
}

export interface NotableBandInfo {
  name: string;
  chromosome: string;
  bandPattern: string;
  shortDescription: CopyLevelContent;
  associatedConditions: string[];
  notableGenes: string[];
  funFact: CopyLevelContent;
  kidFriendly: boolean;
  minCopyLevel: CopyLevel;
}

interface AnnotationsDataFile {
  version: string;
  stainDescriptions: Record<string, StainDescription>;
  notableBands: Record<string, NotableBandInfo>;
}

// Type assertion for imported JSON
const rawData = annotationsData as AnnotationsDataFile;

// Indexed data
let stainDescriptions: Map<CytobandStain, StainDescription> | null = null;
let notableBands: Map<string, NotableBandInfo> | null = null;

/**
 * Initialize the annotations
 */
function initializeAnnotations(): void {
  if (stainDescriptions) return;

  // Index stain descriptions
  stainDescriptions = new Map();
  for (const [stain, desc] of Object.entries(rawData.stainDescriptions)) {
    stainDescriptions.set(stain as CytobandStain, desc);
  }

  // Index notable bands
  notableBands = new Map();
  for (const [band, info] of Object.entries(rawData.notableBands)) {
    notableBands.set(band, info as NotableBandInfo);
  }
}

/**
 * Get description for a stain type
 */
export function getStainDescription(
  stain: CytobandStain
): StainDescription | null {
  initializeAnnotations();
  return stainDescriptions?.get(stain) || null;
}

/**
 * Get stain name for display
 */
export function getStainDisplayName(stain: CytobandStain): string {
  const desc = getStainDescription(stain);
  return desc?.name || stain;
}

/**
 * Get stain description text for a copy level
 */
export function getStainDescriptionText(
  stain: CytobandStain,
  copyLevel: CopyLevel
): string {
  const desc = getStainDescription(stain);
  if (!desc) return '';

  const levelKey = `level${copyLevel}` as keyof CopyLevelContent;
  return desc.description[levelKey] || desc.description.level5;
}

/**
 * Check if a band name matches a notable band pattern
 * Handles patterns like "15q11" matching "15q11.1", "15q11.2", etc.
 */
function matchesBandPattern(bandName: string, pattern: string): boolean {
  // Direct match
  if (bandName === pattern) return true;

  // Pattern match (e.g., "15q11" matches "15q11.1", "15q11.2")
  if (bandName.startsWith(pattern)) {
    const remainder = bandName.slice(pattern.length);
    // Ensure remainder starts with a dot or is empty
    return remainder === '' || remainder.startsWith('.');
  }

  return false;
}

/**
 * Get notable band info if this is a famous/interesting region
 */
export function getNotableBandInfo(bandName: string): NotableBandInfo | null {
  initializeAnnotations();
  if (!notableBands) return null;

  // Try direct match first
  const directMatch = notableBands.get(bandName);
  if (directMatch) return directMatch;

  // Try pattern matching (e.g., "15q11.2" should match "15q11" pattern)
  for (const [pattern, info] of notableBands.entries()) {
    if (matchesBandPattern(bandName, pattern)) {
      return info;
    }
  }

  return null;
}

/**
 * Get the arm name (p or q) with description
 */
export function getArmDescription(bandName: string): {
  arm: string;
  description: string;
} {
  if (bandName.includes('p')) {
    return {
      arm: 'p',
      description: 'short arm (from French "petit")',
    };
  } else if (bandName.includes('q')) {
    return {
      arm: 'q',
      description: 'long arm',
    };
  }
  return { arm: '', description: '' };
}

/**
 * Format position in megabases
 */
export function formatPosition(bp: number): string {
  const mb = bp / 1_000_000;
  if (mb >= 1) {
    return `${mb.toFixed(2)} Mb`;
  } else {
    const kb = bp / 1_000;
    return `${kb.toFixed(1)} kb`;
  }
}

/**
 * Format a range in megabases
 */
export function formatRange(start: number, end: number): string {
  const startMb = start / 1_000_000;
  const endMb = end / 1_000_000;
  return `${startMb.toFixed(2)}-${endMb.toFixed(2)} Mb`;
}

/**
 * Get size of a region formatted nicely
 */
export function formatSize(start: number, end: number): string {
  const size = end - start;
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(2)} Mb`;
  } else if (size >= 1_000) {
    return `${(size / 1_000).toFixed(1)} kb`;
  }
  return `${size} bp`;
}

/**
 * Build a complete cytoband annotation for display
 */
export function getCytobandAnnotation(
  band: Cytoband,
  copyLevel: CopyLevel
): {
  bandName: string;
  armInfo: { arm: string; description: string };
  stainName: string;
  stainDescription: string;
  position: string;
  size: string;
  notable: NotableBandInfo | null;
  chromosome: string;
} {
  const armInfo = getArmDescription(band.name);
  const notable = getNotableBandInfo(band.name);

  return {
    bandName: band.name,
    chromosome: band.chrom.replace('chr', ''),
    armInfo,
    stainName: getStainDisplayName(band.stain),
    stainDescription: getStainDescriptionText(band.stain, copyLevel),
    position: formatRange(band.chromStart, band.chromEnd),
    size: formatSize(band.chromStart, band.chromEnd),
    notable,
  };
}
