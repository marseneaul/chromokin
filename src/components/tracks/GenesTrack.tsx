/**
 * GenesTrack - Renders gene features on the chromosome
 */

import { type JSX, useMemo } from 'react';
import { Scale } from '@/scales/scale';
import { GeneFeature } from './GeneFeature';
import { getGenesInRange } from '@/data/traitsLoader';
import { useTraitsDatabase } from '@/state/appState';
import type { ViewMode } from '@/types/core';
import type { TraitGeneRecord } from '@/types/traits';

interface GenesTrackProps {
  chromosome: string;
  visibleRange: { start: number; end: number };
  scale: Scale;
  height: number;
  viewMode: ViewMode;
}

/**
 * Assign genes to tiers to prevent overlap
 * Returns a map of gene ID to tier index
 */
function assignTiers(
  genes: TraitGeneRecord[],
  scale: Scale,
  minGap: number = 5
): Map<string, number> {
  const tiers = new Map<string, number>();
  const tierEnds: number[] = []; // Track the end position of each tier

  // Sort genes by start position
  const sortedGenes = [...genes].sort((a, b) => a.start - b.start);

  for (const gene of sortedGenes) {
    const geneStart = scale.scale(gene.start);
    const geneEnd = scale.scale(gene.end);

    // Find the first tier where this gene fits
    let assignedTier = -1;
    for (let i = 0; i < tierEnds.length; i++) {
      if (tierEnds[i] + minGap <= geneStart) {
        assignedTier = i;
        tierEnds[i] = geneEnd;
        break;
      }
    }

    // If no existing tier works, create a new one
    if (assignedTier === -1) {
      assignedTier = tierEnds.length;
      tierEnds.push(geneEnd);
    }

    tiers.set(gene.id, assignedTier);
  }

  return tiers;
}

export function GenesTrack({
  chromosome,
  visibleRange,
  scale,
  height,
  viewMode,
}: GenesTrackProps): JSX.Element {
  const traitsDatabase = useTraitsDatabase();

  // Get genes in the visible range
  const visibleGenes = useMemo(() => {
    if (!traitsDatabase) return [];
    return getGenesInRange(chromosome, visibleRange.start, visibleRange.end);
  }, [chromosome, visibleRange, traitsDatabase]);

  // Assign genes to tiers for non-overlapping display
  const geneTiers = useMemo(() => {
    return assignTiers(visibleGenes, scale);
  }, [visibleGenes, scale]);

  // Calculate tier height
  const numTiers = Math.max(1, ...Array.from(geneTiers.values())) + 1;
  const tierHeight = Math.min(24, (height - 10) / numTiers);
  const geneHeight = tierHeight - 4;

  // If no genes found, show placeholder
  if (visibleGenes.length === 0) {
    return (
      <g className="genes-track">
        <rect
          x={0}
          y={0}
          width={scale.range[1]}
          height={height}
          fill="transparent"
        />
        <text
          x={scale.range[1] / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#9ca3af"
          fontSize={12}
        >
          {traitsDatabase
            ? 'No trait-associated genes in this region'
            : 'Loading genes...'}
        </text>
      </g>
    );
  }

  return (
    <g className="genes-track">
      {/* Background */}
      <rect x={0} y={0} width={scale.range[1]} height={height} fill="#fafafa" />

      {/* Track label */}
      <text x={4} y={12} fill="#6b7280" fontSize={10} fontWeight={500}>
        Genes ({visibleGenes.length})
      </text>

      {/* Gene features */}
      <g transform="translate(0, 16)">
        {visibleGenes.map(gene => {
          const tier = geneTiers.get(gene.id) || 0;
          const x = scale.scale(gene.start);
          const width = Math.max(2, scale.scale(gene.end) - x);
          const y = tier * tierHeight;

          return (
            <GeneFeature
              key={gene.id}
              gene={gene}
              x={x}
              y={y}
              width={width}
              height={geneHeight}
              viewMode={viewMode}
            />
          );
        })}
      </g>
    </g>
  );
}
