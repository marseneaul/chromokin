import { type JSX, useMemo } from 'react';
import { useZoomState, useActiveChromosome } from '@/state/appState';
import { CHROMOSOME_LENGTHS } from '@/types/core';

interface ChromosomeGridProps {
  width: number;
  height: number;
  className?: string;
}

export function ChromosomeGrid({
  width,
  height,
  className = '',
}: ChromosomeGridProps): JSX.Element {
  const zoomState = useZoomState();
  const activeChromosome = useActiveChromosome();

  const gridData = useMemo(() => {
    if (!zoomState || !activeChromosome) {
      return { verticalLines: [], horizontalLines: [] };
    }

    const chromosomeLength =
      CHROMOSOME_LENGTHS[activeChromosome as keyof typeof CHROMOSOME_LENGTHS];
    if (!chromosomeLength) {
      return { verticalLines: [], horizontalLines: [] };
    }

    // Ensure zoomState has required properties
    if (!zoomState.bpPerPx || !zoomState.centerPosition) {
      return { verticalLines: [], horizontalLines: [] };
    }

    const { bpPerPx, centerPosition } = zoomState;
    const visibleStart = Math.max(0, centerPosition - (width * bpPerPx) / 2);
    const visibleEnd = Math.min(
      chromosomeLength,
      centerPosition + (width * bpPerPx) / 2
    );

    // Calculate grid spacing based on zoom level
    let gridSpacing: number;

    if (bpPerPx > 1000000) {
      // Very zoomed out - 10M bp grid
      gridSpacing = 10000000;
    } else if (bpPerPx > 100000) {
      // Zoomed out - 1M bp grid
      gridSpacing = 1000000;
    } else if (bpPerPx > 10000) {
      // Medium zoom - 100K bp grid
      gridSpacing = 100000;
    } else if (bpPerPx > 1000) {
      // Zoomed in - 10K bp grid
      gridSpacing = 10000;
    } else {
      // Very zoomed in - 1K bp grid
      gridSpacing = 1000;
    }

    // Generate vertical grid lines
    const verticalLines: Array<{ position: number; isMajor: boolean }> = [];
    const startGrid = Math.ceil(visibleStart / gridSpacing) * gridSpacing;
    const endGrid = Math.floor(visibleEnd / gridSpacing) * gridSpacing;

    for (let bp = startGrid; bp <= endGrid; bp += gridSpacing) {
      const position = (bp - visibleStart) / bpPerPx;

      if (position >= 0 && position <= width) {
        const isMajor = bp % (gridSpacing * 5) === 0;
        verticalLines.push({ position, isMajor });
      }
    }

    // Generate horizontal grid lines (every 20px)
    const horizontalLines: Array<{ position: number }> = [];
    const horizontalSpacing = 20;

    for (let y = horizontalSpacing; y < height; y += horizontalSpacing) {
      horizontalLines.push({ position: y });
    }

    return { verticalLines, horizontalLines };
  }, [zoomState, activeChromosome, width, height]);

  if (!activeChromosome) {
    return (
      <div className={`bg-muted/10 ${className}`} style={{ width, height }} />
    );
  }

  if (!zoomState) {
    return (
      <div className={`bg-muted/10 ${className}`} style={{ width, height }}>
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Loading chromosome grid...
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Grid background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 to-muted/5" />

      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full" style={{ width, height }}>
        {/* Vertical grid lines */}
        {gridData.verticalLines.map((line, index) => (
          <line
            key={`v-${index}`}
            x1={line.position}
            y1={0}
            x2={line.position}
            y2={height}
            stroke="currentColor"
            strokeWidth={line.isMajor ? 0.5 : 0.25}
            className={
              line.isMajor
                ? 'text-muted-foreground/40'
                : 'text-muted-foreground/20'
            }
          />
        ))}

        {/* Horizontal grid lines */}
        {gridData.horizontalLines.map((line, index) => (
          <line
            key={`h-${index}`}
            x1={0}
            y1={line.position}
            x2={width}
            y2={line.position}
            stroke="currentColor"
            strokeWidth={0.25}
            className="text-muted-foreground/15"
          />
        ))}
      </svg>

      {/* Chromosome representation */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="bg-primary/10 border border-primary/20 rounded-lg shadow-sm"
          style={{
            width: Math.min(width * 0.8, 400),
            height: Math.min(height * 0.3, 60),
          }}
        >
          <div className="flex items-center justify-center h-full text-primary/70 text-sm font-medium">
            Chromosome {activeChromosome}
          </div>
        </div>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/60 bg-background/80 px-2 py-1 rounded">
        {zoomState.bpPerPx > 1000000
          ? `${Math.round(zoomState.bpPerPx / 1000000)}M bp/px`
          : zoomState.bpPerPx > 1000
            ? `${Math.round(zoomState.bpPerPx / 1000)}K bp/px`
            : `${Math.round(zoomState.bpPerPx)} bp/px`}
      </div>
    </div>
  );
}
