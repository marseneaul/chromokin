/**
 * CytobandTooltip - Tooltip for cytoband hover
 * Shows band info with layman-friendly explanations
 */

import { type JSX, useMemo, useEffect, useState } from 'react';
import type { Cytoband } from '@/types/genome';
import type { CopyLevel, ViewMode } from '@/types/core';
import {
  getCytobandAnnotation,
  type NotableBandInfo,
} from '@/data/cytobandAnnotationLoader';
import { getContentForLevel } from '@/lib/content';

interface CytobandTooltipProps {
  band: Cytoband;
  position: { x: number; y: number };
  copyLevel: CopyLevel;
  viewMode: ViewMode;
}

export function CytobandTooltip({
  band,
  position,
  copyLevel,
  viewMode,
}: CytobandTooltipProps): JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Get annotation data
  const annotation = useMemo(() => {
    return getCytobandAnnotation(band, copyLevel);
  }, [band, copyLevel]);

  // Debounce tooltip visibility and calculate position
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);

      const tooltipWidth = 300;
      const tooltipHeight = annotation.notable ? 220 : 140;
      const padding = 10;

      let x = position.x - tooltipWidth / 2;
      let y = position.y - tooltipHeight - 20;

      // Keep within viewport horizontally
      if (x < padding) x = padding;
      if (x + tooltipWidth > window.innerWidth - padding) {
        x = window.innerWidth - tooltipWidth - padding;
      }

      // If would go off top, position below cursor
      if (y < padding) {
        y = position.y + 20;
      }

      setAdjustedPosition({ x, y });
    }, 100); // Shorter delay for cytobands

    return () => clearTimeout(timer);
  }, [position, annotation.notable]);

  if (!isVisible || !adjustedPosition) {
    return null;
  }

  const bgClass =
    viewMode === 'play'
      ? 'bg-gradient-to-br from-sky-50 to-white border-sky-200'
      : viewMode === 'explorer'
        ? 'bg-white border-gray-200'
        : 'bg-gray-900 border-gray-700';

  const textClass = viewMode === 'pro' ? 'text-white' : 'text-gray-900';
  const subtextClass = viewMode === 'pro' ? 'text-gray-400' : 'text-gray-500';
  const descClass = viewMode === 'pro' ? 'text-gray-300' : 'text-gray-600';
  const hintClass = viewMode === 'pro' ? 'text-gray-500' : 'text-gray-400';

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <div
        className={`max-w-[300px] rounded-lg shadow-lg border p-3 ${bgClass}`}
      >
        {/* Header with band name */}
        <div className="flex items-start gap-2 mb-2">
          <div
            className="w-3 h-3 rounded mt-0.5 flex-shrink-0 border"
            style={{
              backgroundColor:
                band.stain === 'acen' ? '#cc3333' : getStainColor(band.stain),
              borderColor:
                band.stain === 'gneg'
                  ? '#ccc'
                  : band.stain === 'acen'
                    ? '#991b1b'
                    : 'transparent',
            }}
          />
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold text-sm ${textClass}`}>
              {annotation.notable
                ? annotation.notable.name
                : `Band ${annotation.bandName}`}
            </h4>
            <p className={`text-xs ${subtextClass}`}>
              Chr{annotation.chromosome} {annotation.armInfo.description}
            </p>
          </div>
        </div>

        {/* Stain info */}
        <div className="mb-2">
          <p className={`text-xs font-medium ${subtextClass}`}>
            {annotation.stainName}
          </p>
          <p className={`text-xs ${descClass}`}>
            {annotation.stainDescription}
          </p>
        </div>

        {/* Position and size */}
        <p className={`text-xs font-mono ${hintClass}`}>
          {annotation.position} ({annotation.size})
        </p>

        {/* Notable band info */}
        {annotation.notable && (
          <NotableBandSection
            notable={annotation.notable}
            copyLevel={copyLevel}
            viewMode={viewMode}
          />
        )}

        {/* Click hint */}
        <p className={`text-xs mt-2 ${hintClass}`}>
          Click to zoom to this region
        </p>
      </div>
    </div>
  );
}

interface NotableBandSectionProps {
  notable: NotableBandInfo;
  copyLevel: CopyLevel;
  viewMode: ViewMode;
}

function NotableBandSection({
  notable,
  copyLevel,
  viewMode,
}: NotableBandSectionProps): JSX.Element {
  const descClass = viewMode === 'pro' ? 'text-gray-300' : 'text-gray-600';
  const tagBgClass =
    viewMode === 'pro'
      ? 'bg-gray-700 text-gray-300'
      : 'bg-blue-100 text-blue-700';
  const geneBgClass =
    viewMode === 'pro'
      ? 'bg-gray-700 text-gray-300'
      : 'bg-green-100 text-green-700';

  const description = getContentForLevel(notable.shortDescription, copyLevel);
  const funFact =
    viewMode === 'play' ? getContentForLevel(notable.funFact, copyLevel) : null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
      {/* Description */}
      <p className={`text-sm leading-snug ${descClass}`}>{description}</p>

      {/* Associated conditions */}
      {notable.associatedConditions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {notable.associatedConditions.slice(0, 2).map(condition => (
            <span
              key={condition}
              className={`text-xs px-2 py-0.5 rounded-full ${tagBgClass}`}
            >
              {condition}
            </span>
          ))}
        </div>
      )}

      {/* Notable genes */}
      {notable.notableGenes.length > 0 && viewMode !== 'play' && (
        <div className="mt-1 flex flex-wrap gap-1">
          {notable.notableGenes.slice(0, 3).map(gene => (
            <span
              key={gene}
              className={`text-xs px-1.5 py-0.5 rounded font-mono ${geneBgClass}`}
            >
              {gene}
            </span>
          ))}
          {notable.notableGenes.length > 3 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${viewMode === 'pro' ? 'text-gray-500' : 'text-gray-400'}`}
            >
              +{notable.notableGenes.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Fun fact in play mode */}
      {funFact && (
        <p className="text-xs mt-2 italic text-amber-600">{funFact}</p>
      )}
    </div>
  );
}

function getStainColor(stain: string): string {
  const colors: Record<string, string> = {
    gneg: '#ffffff',
    gpos25: '#c0c0c0',
    gpos50: '#808080',
    gpos75: '#404040',
    gpos100: '#000000',
    acen: '#cc3333',
    gvar: '#dcdcdc',
    stalk: '#708090',
  };
  return colors[stain] || '#808080';
}
