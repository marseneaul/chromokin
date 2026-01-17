/**
 * Tooltip - Hover tooltip with brief information
 * Adapts content based on CopyLevel and ViewMode
 */

import { type JSX, useMemo, useEffect, useState } from 'react';
import {
  useTooltipPosition,
  useHoveredGeneId,
  useHoveredTraitId,
  useCopyLevel,
  useViewMode,
  useTraitsDatabase,
} from '@/state/appState';
import {
  getContentForLevel,
  formatPosition,
  getGeneDisplayName,
} from '@/lib/content';
import { getTraitsForGene } from '@/data/traitsLoader';

export function Tooltip(): JSX.Element | null {
  const position = useTooltipPosition();
  const hoveredGeneId = useHoveredGeneId();
  const hoveredTraitId = useHoveredTraitId();
  const copyLevel = useCopyLevel();
  const viewMode = useViewMode();
  const traitsDatabase = useTraitsDatabase();

  const [isVisible, setIsVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Debounce tooltip visibility
  useEffect(() => {
    if (position && (hoveredGeneId || hoveredTraitId)) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        // Adjust position to stay in viewport
        const tooltipWidth = 280;
        const tooltipHeight = 120;
        const padding = 10;

        let x = position.x - tooltipWidth / 2;
        let y = position.y - tooltipHeight - padding;

        // Keep within viewport horizontally
        if (x < padding) x = padding;
        if (x + tooltipWidth > window.innerWidth - padding) {
          x = window.innerWidth - tooltipWidth - padding;
        }

        // Flip below if not enough space above
        if (y < padding) {
          y = position.y + padding + 20;
        }

        setAdjustedPosition({ x, y });
      }, 150);

      return () => clearTimeout(timer);
    }

    setIsVisible(false);
    setAdjustedPosition(null);
    return undefined;
  }, [position, hoveredGeneId, hoveredTraitId]);

  // Get content for tooltip
  const content = useMemo(() => {
    if (!traitsDatabase) return null;

    if (hoveredGeneId) {
      const gene = traitsDatabase.genes.get(hoveredGeneId);
      if (!gene) return null;

      const traits = getTraitsForGene(hoveredGeneId);
      const displayName = getGeneDisplayName(
        gene.symbol,
        gene.nickname,
        viewMode
      );
      const description = getContentForLevel(gene.shortDescription, copyLevel);

      return {
        type: 'gene' as const,
        title: displayName,
        subtitle: viewMode !== 'play' ? gene.symbol : undefined,
        description,
        details:
          viewMode !== 'play'
            ? `chr${gene.chromosome}:${formatPosition(gene.start, viewMode)}-${formatPosition(gene.end, viewMode)}`
            : undefined,
        traits: traits.map(t => t.name),
        color: gene.color || '#3b82f6',
      };
    }

    if (hoveredTraitId) {
      const trait = traitsDatabase.traits.get(hoveredTraitId);
      if (!trait) return null;

      const description = getContentForLevel(trait.shortDescription, copyLevel);

      return {
        type: 'trait' as const,
        title: trait.name,
        subtitle: trait.category,
        description,
        details: undefined,
        traits: [],
        color: getCategoryColor(trait.category),
      };
    }

    return null;
  }, [hoveredGeneId, hoveredTraitId, traitsDatabase, copyLevel, viewMode]);

  if (!isVisible || !adjustedPosition || !content) {
    return null;
  }

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <div
        className={`
          max-w-[280px] rounded-lg shadow-lg border p-3
          ${
            viewMode === 'play'
              ? 'bg-gradient-to-br from-sky-50 to-white border-sky-200'
              : viewMode === 'explorer'
                ? 'bg-white border-gray-200'
                : 'bg-gray-900 border-gray-700 text-white'
          }
        `}
      >
        {/* Header */}
        <div className="flex items-start gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
            style={{ backgroundColor: content.color }}
          />
          <div className="flex-1 min-w-0">
            <h4
              className={`font-semibold text-sm ${
                viewMode === 'pro' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {content.title}
            </h4>
            {content.subtitle && (
              <p
                className={`text-xs ${
                  viewMode === 'pro' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {content.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <p
          className={`text-sm leading-snug ${
            viewMode === 'pro' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          {content.description}
        </p>

        {/* Details (coordinates) */}
        {content.details && (
          <p
            className={`text-xs mt-2 font-mono ${
              viewMode === 'pro' ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {content.details}
          </p>
        )}

        {/* Associated traits */}
        {content.traits.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {content.traits.slice(0, 3).map(trait => (
              <span
                key={trait}
                className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${
                    viewMode === 'pro'
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-green-100 text-green-700'
                  }
                `}
              >
                {trait}
              </span>
            ))}
            {content.traits.length > 3 && (
              <span
                className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${
                    viewMode === 'pro'
                      ? 'bg-gray-700 text-gray-400'
                      : 'bg-gray-100 text-gray-500'
                  }
                `}
              >
                +{content.traits.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Click hint */}
        <p
          className={`text-xs mt-2 ${
            viewMode === 'pro' ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          Click for details
        </p>
      </div>
    </div>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    physical: '#3b82f6',
    sensory: '#8b5cf6',
    health: '#10b981',
    fun: '#f59e0b',
  };
  return colors[category] || '#6b7280';
}
