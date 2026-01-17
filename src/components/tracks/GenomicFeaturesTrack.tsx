/**
 * GenomicFeaturesTrack - Renders quirky genomic features (HERVs, transposons, pseudogenes)
 */

import { type JSX, useMemo, useEffect } from 'react';
import { Scale } from '@/scales/scale';
import { GenomicFeature } from './GenomicFeature';
import { getFeaturesInRange } from '@/data/genomicFeaturesLoader';
import {
  useGenomicFeaturesDatabase,
  useGenomicFeaturesLoaded,
  useLoadGenomicFeatures,
} from '@/state/appState';
import type { ViewMode } from '@/types/core';
import type { GenomicFeature as GenomicFeatureType } from '@/types/genomicFeatures';

interface GenomicFeaturesTrackProps {
  chromosome: string;
  visibleRange: { start: number; end: number };
  scale: Scale;
  height: number;
  viewMode: ViewMode;
}

/**
 * Assign features to tiers to prevent overlap
 * Returns a map of feature ID to tier index
 */
function assignTiers(
  features: GenomicFeatureType[],
  scale: Scale,
  minGap: number = 5
): Map<string, number> {
  const tiers = new Map<string, number>();
  const tierEnds: number[] = []; // Track the end position of each tier

  // Sort features by start position
  const sortedFeatures = [...features].sort((a, b) => a.start - b.start);

  for (const feature of sortedFeatures) {
    const featureStart = scale.scale(feature.start);
    const featureEnd = scale.scale(feature.end);

    // Find the first tier where this feature fits
    let assignedTier = -1;
    for (let i = 0; i < tierEnds.length; i++) {
      if (tierEnds[i] + minGap <= featureStart) {
        assignedTier = i;
        tierEnds[i] = featureEnd;
        break;
      }
    }

    // If no existing tier works, create a new one
    if (assignedTier === -1) {
      assignedTier = tierEnds.length;
      tierEnds.push(featureEnd);
    }

    tiers.set(feature.id, assignedTier);
  }

  return tiers;
}

/**
 * Get display name for feature type
 */
function getFeatureTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    herv: 'Virus DNA',
    line: 'LINEs',
    sine: 'Alu/SINEs',
    pseudogene: 'Fossil Genes',
    dna_transposon: 'Transposons',
    satellite: 'Satellites',
    segmental_duplication: 'Duplications',
  };
  return labels[type] || type;
}

export function GenomicFeaturesTrack({
  chromosome,
  visibleRange,
  scale,
  height,
  viewMode,
}: GenomicFeaturesTrackProps): JSX.Element {
  const genomicFeaturesDatabase = useGenomicFeaturesDatabase();
  const genomicFeaturesLoaded = useGenomicFeaturesLoaded();
  const loadGenomicFeatures = useLoadGenomicFeatures();

  // Load features on mount
  useEffect(() => {
    if (!genomicFeaturesLoaded) {
      loadGenomicFeatures();
    }
  }, [genomicFeaturesLoaded, loadGenomicFeatures]);

  // Get features in the visible range
  const visibleFeatures = useMemo(() => {
    if (!genomicFeaturesDatabase) return [];
    return getFeaturesInRange(chromosome, visibleRange.start, visibleRange.end);
  }, [chromosome, visibleRange, genomicFeaturesDatabase]);

  // Assign features to tiers for non-overlapping display
  const featureTiers = useMemo(() => {
    return assignTiers(visibleFeatures, scale);
  }, [visibleFeatures, scale]);

  // Calculate tier height
  const numTiers = Math.max(1, ...Array.from(featureTiers.values())) + 1;
  const tierHeight = Math.min(20, (height - 20) / numTiers);
  const featureHeight = tierHeight - 4;

  // Group features by type for legend
  const featuresByType = useMemo(() => {
    const groups = new Map<string, GenomicFeatureType[]>();
    for (const feature of visibleFeatures) {
      const typeFeatures = groups.get(feature.type) || [];
      typeFeatures.push(feature);
      groups.set(feature.type, typeFeatures);
    }
    return groups;
  }, [visibleFeatures]);

  // If no features found, show placeholder
  if (visibleFeatures.length === 0) {
    return (
      <g className="genomic-features-track">
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
          {genomicFeaturesDatabase
            ? 'No genomic features in this region (zoom to see specific features)'
            : 'Loading features...'}
        </text>
      </g>
    );
  }

  return (
    <g className="genomic-features-track">
      {/* Background with slight tint to differentiate from genes track */}
      <rect x={0} y={0} width={scale.range[1]} height={height} fill="#fef3f3" />

      {/* Track label */}
      <text x={4} y={12} fill="#6b7280" fontSize={10} fontWeight={500}>
        Genomic Oddities ({visibleFeatures.length})
      </text>

      {/* Feature type legend (small inline) */}
      <g transform="translate(150, 3)">
        {Array.from(featuresByType.entries())
          .slice(0, 4)
          .map(([type, features], i) => {
            const color = features[0]?.color || '#6b7280';
            return (
              <g key={type} transform={`translate(${i * 70}, 0)`}>
                <rect
                  x={0}
                  y={2}
                  width={8}
                  height={8}
                  rx={1}
                  fill={color}
                  opacity={0.8}
                />
                <text x={12} y={10} fill="#9ca3af" fontSize={8}>
                  {getFeatureTypeLabel(type)} ({features.length})
                </text>
              </g>
            );
          })}
      </g>

      {/* Feature elements */}
      <g transform="translate(0, 20)">
        {visibleFeatures.map(feature => {
          const tier = featureTiers.get(feature.id) || 0;
          const x = scale.scale(feature.start);
          const width = Math.max(4, scale.scale(feature.end) - x);
          const y = tier * tierHeight;

          return (
            <GenomicFeature
              key={feature.id}
              feature={feature}
              x={x}
              y={y}
              width={width}
              height={featureHeight}
              viewMode={viewMode}
            />
          );
        })}
      </g>
    </g>
  );
}
