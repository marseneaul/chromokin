/**
 * Individual search result item
 */

import React, { type JSX } from 'react';
import { Dna, MapPin, Sparkles, Bug, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchResult, SearchResultType } from '@/types/search';

interface SearchResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

/**
 * Get icon and color for result type
 */
function getResultTypeConfig(type: SearchResultType): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
} {
  switch (type) {
    case 'gene':
      return {
        icon: Dna,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
      };
    case 'snp':
      return {
        icon: Sparkles,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
      };
    case 'trait':
      return {
        icon: Sparkles,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
      };
    case 'feature':
      return {
        icon: Bug,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
      };
    case 'cytoband':
      return {
        icon: Navigation,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
      };
  }
}

export function SearchResultItem({
  result,
  isSelected,
  onClick,
  onMouseEnter,
}: SearchResultItemProps): JSX.Element {
  const config = getResultTypeConfig(result.type);
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-left',
        'transition-colors',
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      {/* Type icon */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center',
          config.bgColor
        )}
      >
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{result.primaryText}</div>
        {result.secondaryText && (
          <div className="text-xs text-muted-foreground truncate">
            {result.secondaryText}
          </div>
        )}
      </div>

      {/* Location badge */}
      <div className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>chr{result.chromosome}</span>
      </div>
    </button>
  );
}
