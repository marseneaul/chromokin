/**
 * GenomicFeature - Individual genomic feature visualization (HERVs, transposons, etc.)
 */

import { type JSX, useCallback, useState } from 'react';
import {
  useSetHoveredFeature,
  useSelectFeature,
  useHoveredFeatureId,
  useSelectedFeatureId,
} from '@/state/appState';
import type { ViewMode } from '@/types/core';
import type { GenomicFeature as GenomicFeatureType } from '@/types/genomicFeatures';

interface GenomicFeatureProps {
  feature: GenomicFeatureType;
  x: number;
  y: number;
  width: number;
  height: number;
  viewMode: ViewMode;
}

export function GenomicFeature({
  feature,
  x,
  y,
  width,
  height,
  viewMode,
}: GenomicFeatureProps): JSX.Element {
  const setHoveredFeature = useSetHoveredFeature();
  const selectFeature = useSelectFeature();
  const hoveredFeatureId = useHoveredFeatureId();
  const selectedFeatureId = useSelectedFeatureId();

  const [localHover, setLocalHover] = useState(false);

  const isHovered = hoveredFeatureId === feature.id || localHover;
  const isSelected = selectedFeatureId === feature.id;

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      setLocalHover(true);
      const rect = (e.target as SVGElement).getBoundingClientRect();
      setHoveredFeature(feature.id, {
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    [feature.id, setHoveredFeature]
  );

  const handleMouseLeave = useCallback(() => {
    setLocalHover(false);
    setHoveredFeature(null);
  }, [setHoveredFeature]);

  const handleClick = useCallback(() => {
    selectFeature(feature.id);
  }, [feature.id, selectFeature]);

  // Get display name based on view mode
  const displayName =
    viewMode === 'play' && feature.nickname ? feature.nickname : feature.name;

  // Determine if we should show the label
  const showLabel = width > 40;
  const fontSize = Math.min(10, Math.max(8, width / 8));

  // Get feature type icon/pattern
  const getFeaturePattern = () => {
    switch (feature.type) {
      case 'herv':
        return 'virus'; // Virus-like pattern
      case 'line':
        return 'repeat'; // Repeat arrows
      case 'sine':
        return 'dots'; // Dotted pattern
      case 'pseudogene':
        return 'striped'; // Striped (broken look)
      case 'dna_transposon':
        return 'scissors'; // Cut pattern
      case 'satellite':
        return 'solid'; // Solid
      default:
        return 'solid';
    }
  };

  const pattern = getFeaturePattern();

  // Pattern definitions for different feature types
  const renderPatternDef = () => {
    const patternId = `pattern-${feature.id}`;

    if (pattern === 'striped') {
      return (
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke={feature.color}
            strokeWidth="4"
          />
        </pattern>
      );
    }

    if (pattern === 'dots') {
      return (
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="4"
          height="4"
        >
          <rect width="4" height="4" fill={feature.color} opacity="0.6" />
          <circle cx="2" cy="2" r="1" fill="white" opacity="0.4" />
        </pattern>
      );
    }

    return null;
  };

  const getFill = () => {
    const patternId = `pattern-${feature.id}`;
    if (pattern === 'striped' || pattern === 'dots') {
      return `url(#${patternId})`;
    }
    return feature.color;
  };

  return (
    <g
      className="genomic-feature cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${feature.type}: ${feature.name}`}
    >
      {/* Pattern definitions */}
      <defs>{renderPatternDef()}</defs>

      {/* Feature body */}
      <rect
        x={x}
        y={y}
        width={Math.max(width, 4)}
        height={height}
        rx={feature.type === 'herv' ? 0 : 2}
        fill={getFill()}
        opacity={isHovered || isSelected ? 1 : 0.7}
        stroke={isSelected ? '#1d4ed8' : isHovered ? '#60a5fa' : 'none'}
        strokeWidth={isSelected ? 2 : isHovered ? 1 : 0}
        className="transition-all duration-150"
      />

      {/* HERV-specific virus-like ends */}
      {feature.type === 'herv' && width > 12 && (
        <>
          {/* Left LTR */}
          <rect
            x={x}
            y={y}
            width={Math.min(4, width * 0.15)}
            height={height}
            fill={feature.color}
            opacity={0.9}
          />
          {/* Right LTR */}
          <rect
            x={x + width - Math.min(4, width * 0.15)}
            y={y}
            width={Math.min(4, width * 0.15)}
            height={height}
            fill={feature.color}
            opacity={0.9}
          />
        </>
      )}

      {/* LINE repeat arrow indicator */}
      {feature.type === 'line' && width > 20 && (
        <path
          d={`M${x + width - 8} ${y + height / 2 - 3} l5 3 l-5 3`}
          fill="white"
          opacity={0.6}
        />
      )}

      {/* Pseudogene X mark */}
      {feature.type === 'pseudogene' && width > 15 && (
        <g opacity={0.5}>
          <line
            x1={x + 3}
            y1={y + 3}
            x2={x + Math.min(10, width - 3)}
            y2={y + height - 3}
            stroke="white"
            strokeWidth={1.5}
          />
          <line
            x1={x + Math.min(10, width - 3)}
            y1={y + 3}
            x2={x + 3}
            y2={y + height - 3}
            stroke="white"
            strokeWidth={1.5}
          />
        </g>
      )}

      {/* DNA transposon scissors indicator */}
      {feature.type === 'dna_transposon' && width > 15 && (
        <>
          <line
            x1={x + 2}
            y1={y}
            x2={x + 2}
            y2={y + height}
            stroke="white"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
          <line
            x1={x + width - 2}
            y1={y}
            x2={x + width - 2}
            y2={y + height}
            stroke="white"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        </>
      )}

      {/* Feature label */}
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
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
        >
          {displayName.length > width / 6
            ? displayName.slice(0, Math.floor(width / 6)) + '...'
            : displayName}
        </text>
      )}
    </g>
  );
}
