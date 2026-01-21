/**
 * Content utilities for multi-level text and view mode settings
 */

import type { CopyLevel, ViewMode } from '@/types/core';
import type { CopyLevelContent } from '@/types/traits';

/**
 * Get content appropriate for the current copy level
 * Falls back to closest available level if exact level not found
 */
export function getContentForLevel(
  content: CopyLevelContent,
  level: CopyLevel
): string {
  const key = `level${level}` as keyof CopyLevelContent;
  if (content[key]) {
    return content[key];
  }

  // Fallback to closest lower level
  for (let l = level - 1; l >= 3; l--) {
    const fallbackKey = `level${l}` as keyof CopyLevelContent;
    if (content[fallbackKey]) {
      return content[fallbackKey];
    }
  }

  // Fallback to highest level if nothing lower exists
  for (let l = level + 1; l <= 8; l++) {
    const fallbackKey = `level${l}` as keyof CopyLevelContent;
    if (content[fallbackKey]) {
      return content[fallbackKey];
    }
  }

  return '';
}

/**
 * Display settings that vary by view mode
 */
export interface ViewModeSettings {
  /** Use kid-friendly nicknames instead of gene symbols */
  useNicknames: boolean;
  /** Show genomic coordinates */
  showCoordinates: boolean;
  /** Show detailed variant information */
  showVariantDetails: boolean;
  /** Enable animations */
  animationsEnabled: boolean;
  /** Panel display style */
  panelStyle: 'modal' | 'slideout' | 'compact';
  /** Tooltip complexity */
  tooltipLevel: 'simple' | 'standard' | 'detailed';
}

/**
 * Get display settings based on view mode
 */
export function getViewModeSettings(viewMode: ViewMode): ViewModeSettings {
  switch (viewMode) {
    case 'play':
      return {
        useNicknames: true,
        showCoordinates: false,
        showVariantDetails: false,
        animationsEnabled: true,
        panelStyle: 'modal',
        tooltipLevel: 'simple',
      };
    case 'pro':
      return {
        useNicknames: false,
        showCoordinates: true,
        showVariantDetails: true,
        animationsEnabled: false,
        panelStyle: 'compact',
        tooltipLevel: 'detailed',
      };
  }
}

/**
 * Format a genomic position for display
 */
export function formatPosition(position: number, viewMode: ViewMode): string {
  if (viewMode === 'play') {
    // Simplified for kids
    if (position >= 1_000_000) {
      return `${(position / 1_000_000).toFixed(1)}M`;
    } else if (position >= 1_000) {
      return `${(position / 1_000).toFixed(0)}K`;
    }
    return position.toLocaleString();
  }

  // Standard formatting with commas
  return position.toLocaleString();
}

/**
 * Format a genomic range for display
 */
export function formatRange(
  start: number,
  end: number,
  viewMode: ViewMode
): string {
  if (viewMode === 'play') {
    return `${formatPosition(start, viewMode)} - ${formatPosition(end, viewMode)}`;
  }

  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

/**
 * Get the appropriate gene name for display
 */
export function getGeneDisplayName(
  symbol: string,
  nickname: string | undefined,
  viewMode: ViewMode
): string {
  const settings = getViewModeSettings(viewMode);
  if (settings.useNicknames && nickname) {
    return nickname;
  }
  return symbol;
}

/**
 * Get copy level description
 */
export function getCopyLevelLabel(level: CopyLevel): string {
  const labels: Record<CopyLevel, string> = {
    3: 'Simple',
    4: 'Basic',
    5: 'Intermediate',
    6: 'Advanced',
    7: 'Scientific',
    8: 'Professional',
  };
  return labels[level];
}

/**
 * Get age range for a copy level
 */
export function getCopyLevelAgeRange(level: CopyLevel): string {
  const ranges: Record<CopyLevel, string> = {
    3: 'Ages 8-9',
    4: 'Ages 9-10',
    5: 'Ages 10-11',
    6: 'Ages 11-12',
    7: 'Ages 12-13',
    8: 'Ages 13+',
  };
  return ranges[level];
}
