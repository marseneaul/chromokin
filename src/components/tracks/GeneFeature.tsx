/**
 * GeneFeature - Individual gene visualization with interactivity
 */

import { type JSX, useCallback, useState } from 'react';
import {
  useSetHoveredGene,
  useSelectGene,
  useHoveredGeneId,
  useSelectedGeneId,
} from '@/state/appState';
import { getGeneDisplayName } from '@/lib/content';
import type { ViewMode } from '@/types/core';
import type { TraitGeneRecord } from '@/types/traits';

interface GeneFeatureProps {
  gene: TraitGeneRecord;
  x: number;
  y: number;
  width: number;
  height: number;
  viewMode: ViewMode;
}

export function GeneFeature({
  gene,
  x,
  y,
  width,
  height,
  viewMode,
}: GeneFeatureProps): JSX.Element {
  const setHoveredGene = useSetHoveredGene();
  const selectGene = useSelectGene();
  const hoveredGeneId = useHoveredGeneId();
  const selectedGeneId = useSelectedGeneId();

  const [localHover, setLocalHover] = useState(false);

  const isHovered = hoveredGeneId === gene.id || localHover;
  const isSelected = selectedGeneId === gene.id;

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      setLocalHover(true);
      const rect = (e.target as SVGElement).getBoundingClientRect();
      setHoveredGene(gene.id, {
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    [gene.id, setHoveredGene]
  );

  const handleMouseLeave = useCallback(() => {
    setLocalHover(false);
    setHoveredGene(null);
  }, [setHoveredGene]);

  const handleClick = useCallback(() => {
    selectGene(gene.id);
  }, [gene.id, selectGene]);

  // Get display name based on view mode
  const displayName = getGeneDisplayName(gene.symbol, gene.nickname, viewMode);

  // Determine if we should show the label
  const showLabel = width > 30;
  const fontSize = Math.min(10, Math.max(8, width / 6));

  // Gene color - use gene's color or default blue
  const geneColor = gene.color || '#3b82f6';

  return (
    <g
      className="gene-feature cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Gene ${gene.symbol}: ${gene.name}`}
    >
      {/* Gene body */}
      <rect
        x={x}
        y={y}
        width={Math.max(width, 2)}
        height={height}
        rx={2}
        fill={geneColor}
        opacity={isHovered || isSelected ? 1 : 0.75}
        stroke={isSelected ? '#1d4ed8' : isHovered ? '#60a5fa' : 'none'}
        strokeWidth={isSelected ? 2 : isHovered ? 1 : 0}
        className="transition-all duration-150"
      />

      {/* Strand direction indicator */}
      {width > 15 && (
        <path
          d={
            gene.strand === '+'
              ? `M${x + width - 6} ${y + height / 2 - 3} l4 3 l-4 3`
              : `M${x + 6} ${y + height / 2 - 3} l-4 3 l4 3`
          }
          fill="white"
          opacity={0.7}
        />
      )}

      {/* Gene label */}
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={fontSize}
          fontWeight={500}
          className="pointer-events-none select-none"
          style={{
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          {displayName.length > width / 6
            ? displayName.slice(0, Math.floor(width / 6)) + '…'
            : displayName}
        </text>
      )}
    </g>
  );
}
