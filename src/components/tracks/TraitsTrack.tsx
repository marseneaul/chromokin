/**
 * TraitsTrack - Renders trait indicators linked to genes
 */

import { type JSX, useMemo, useCallback } from 'react';
import { Scale } from '@/scales/scale';
import { getTraitsForChromosome, getGenesInRange } from '@/data/traitsLoader';
import {
  useTraitsDatabase,
  useSetHoveredTrait,
  useSelectTrait,
  useHoveredTraitId,
  useSelectedTraitId,
} from '@/state/appState';
import type { ViewMode } from '@/types/core';
import type { EnhancedTraitRecord } from '@/types/traits';

interface TraitsTrackProps {
  chromosome: string;
  visibleRange: { start: number; end: number };
  scale: Scale;
  height: number;
  viewMode: ViewMode;
}

// Category colors for visual grouping
const categoryColors: Record<string, string> = {
  physical: '#3b82f6', // blue
  sensory: '#8b5cf6', // purple
  health: '#10b981', // green
  fun: '#f59e0b', // amber
};

interface TraitWithPosition {
  trait: EnhancedTraitRecord;
  position: number; // Average position of associated genes
  x: number; // Pixel position
}

export function TraitsTrack({
  chromosome,
  visibleRange,
  scale,
  height,
  viewMode,
}: TraitsTrackProps): JSX.Element {
  const traitsDatabase = useTraitsDatabase();
  const setHoveredTrait = useSetHoveredTrait();
  const selectTrait = useSelectTrait();
  const hoveredTraitId = useHoveredTraitId();
  const selectedTraitId = useSelectedTraitId();

  // Get traits with genes in the visible range
  const visibleTraits = useMemo((): TraitWithPosition[] => {
    if (!traitsDatabase) return [];

    const traits = getTraitsForChromosome(chromosome);
    const genesInRange = getGenesInRange(
      chromosome,
      visibleRange.start,
      visibleRange.end
    );
    const geneIdsInRange = new Set(genesInRange.map(g => g.id));

    const traitsWithPosition: TraitWithPosition[] = [];

    for (const trait of traits) {
      // Find genes for this trait that are in the visible range
      const traitGenes = trait.genes.filter(
        g =>
          g.chromosome === chromosome &&
          (geneIdsInRange.has(g.geneId) ||
            (g.start <= visibleRange.end && g.end >= visibleRange.start))
      );

      if (traitGenes.length > 0) {
        // Calculate average position
        const avgPosition =
          traitGenes.reduce((sum, g) => sum + (g.start + g.end) / 2, 0) /
          traitGenes.length;

        traitsWithPosition.push({
          trait,
          position: avgPosition,
          x: scale.scale(avgPosition),
        });
      }
    }

    // Sort by position
    return traitsWithPosition.sort((a, b) => a.position - b.position);
  }, [chromosome, visibleRange, scale, traitsDatabase]);

  const handleMouseEnter = useCallback(
    (trait: EnhancedTraitRecord, e: React.MouseEvent) => {
      const rect = (e.target as SVGElement).getBoundingClientRect();
      setHoveredTrait(trait.id, {
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    [setHoveredTrait]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredTrait(null);
  }, [setHoveredTrait]);

  const handleClick = useCallback(
    (trait: EnhancedTraitRecord) => {
      selectTrait(trait.id);
    },
    [selectTrait]
  );

  // If no traits found, show placeholder
  if (visibleTraits.length === 0) {
    return (
      <g className="traits-track">
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
          {traitsDatabase ? 'No traits in this region' : 'Loading traits...'}
        </text>
      </g>
    );
  }

  const iconSize = viewMode === 'play' ? 28 : 22;
  const iconY = (height - iconSize) / 2;

  return (
    <g className="traits-track">
      {/* Background */}
      <rect x={0} y={0} width={scale.range[1]} height={height} fill="#f9fafb" />

      {/* Track label */}
      <text x={4} y={12} fill="#6b7280" fontSize={10} fontWeight={500}>
        Traits ({visibleTraits.length})
      </text>

      {/* Trait indicators */}
      {visibleTraits.map(({ trait, x }) => {
        const isHovered = hoveredTraitId === trait.id;
        const isSelected = selectedTraitId === trait.id;
        const color = categoryColors[trait.category] || '#6b7280';

        return (
          <g
            key={trait.id}
            className="trait-indicator cursor-pointer"
            transform={`translate(${x - iconSize / 2}, ${iconY})`}
            onMouseEnter={e => handleMouseEnter(trait, e)}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleClick(trait)}
            role="button"
            tabIndex={0}
            aria-label={`Trait: ${trait.name}`}
          >
            {/* Badge background */}
            <rect
              x={0}
              y={0}
              width={iconSize}
              height={iconSize}
              rx={iconSize / 4}
              fill={color}
              opacity={isHovered || isSelected ? 1 : 0.8}
              stroke={isSelected ? '#1d4ed8' : isHovered ? '#60a5fa' : 'none'}
              strokeWidth={isSelected ? 2 : isHovered ? 1 : 0}
              className="transition-all duration-150"
            />

            {/* Trait icon/initial */}
            <text
              x={iconSize / 2}
              y={iconSize / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={viewMode === 'play' ? 14 : 11}
              fontWeight="bold"
            >
              {trait.name.charAt(0).toUpperCase()}
            </text>

            {/* Trait name (on hover or in play mode) */}
            {(isHovered || viewMode === 'play') && (
              <text
                x={iconSize / 2}
                y={iconSize + 10}
                textAnchor="middle"
                fill="#374151"
                fontSize={9}
                fontWeight={500}
                className="pointer-events-none"
              >
                {trait.name.length > 12
                  ? trait.name.slice(0, 10) + '…'
                  : trait.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
