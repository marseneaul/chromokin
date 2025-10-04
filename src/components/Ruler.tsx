import { type JSX, useMemo } from 'react';
import { useZoomState, useActiveChromosome } from '@/state/appState';
import { CHROMOSOME_LENGTHS } from '@/types/core';

interface RulerProps {
  width: number;
  height?: number;
  className?: string;
}

export function Ruler({
  width,
  height = 40,
  className = '',
}: RulerProps): JSX.Element {
  const zoomState = useZoomState();
  const activeChromosome = useActiveChromosome();

  const rulerData = useMemo(() => {
    if (!zoomState || !activeChromosome) {
      return { ticks: [], labels: [] };
    }

    const chromosomeLength =
      CHROMOSOME_LENGTHS[activeChromosome as keyof typeof CHROMOSOME_LENGTHS];
    if (!chromosomeLength) {
      return { ticks: [], labels: [] };
    }

    // Ensure zoomState has required properties
    if (!zoomState.bpPerPx || !zoomState.centerPosition) {
      return { ticks: [], labels: [] };
    }

    const { bpPerPx, centerPosition } = zoomState;
    const visibleStart = Math.max(0, centerPosition - (width * bpPerPx) / 2);
    const visibleEnd = Math.min(
      chromosomeLength,
      centerPosition + (width * bpPerPx) / 2
    );
    // const visibleRange = visibleEnd - visibleStart; // For future use

    // Calculate appropriate tick spacing based on zoom level
    let tickSpacing: number;
    let labelFormat: (bp: number) => string;

    if (bpPerPx > 1000000) {
      // Very zoomed out - show major regions (10M bp)
      tickSpacing = 10000000;
      labelFormat = bp => `${Math.round(bp / 1000000)}M`;
    } else if (bpPerPx > 100000) {
      // Zoomed out - show 1M bp intervals
      tickSpacing = 1000000;
      labelFormat = bp => `${Math.round(bp / 1000000)}M`;
    } else if (bpPerPx > 10000) {
      // Medium zoom - show 100K bp intervals
      tickSpacing = 100000;
      labelFormat = bp => `${Math.round(bp / 1000)}K`;
    } else if (bpPerPx > 1000) {
      // Zoomed in - show 10K bp intervals
      tickSpacing = 10000;
      labelFormat = bp => `${Math.round(bp / 1000)}K`;
    } else {
      // Very zoomed in - show 1K bp intervals
      tickSpacing = 1000;
      labelFormat = bp => `${bp}`;
    }

    // Generate ticks
    const ticks: Array<{ position: number; bp: number; isMajor: boolean }> = [];
    const labels: Array<{ position: number; text: string }> = [];

    const startTick = Math.ceil(visibleStart / tickSpacing) * tickSpacing;
    const endTick = Math.floor(visibleEnd / tickSpacing) * tickSpacing;

    for (let bp = startTick; bp <= endTick; bp += tickSpacing) {
      const position = (bp - visibleStart) / bpPerPx;

      if (position >= 0 && position <= width) {
        const isMajor =
          bp % (tickSpacing * 5) === 0 || bp === startTick || bp === endTick;
        ticks.push({ position, bp, isMajor });

        if (isMajor) {
          labels.push({ position, text: labelFormat(bp) });
        }
      }
    }

    return { ticks, labels };
  }, [zoomState, activeChromosome, width]);

  if (!activeChromosome) {
    return (
      <div
        className={`bg-muted/20 border-b border-border ${className}`}
        style={{ width, height }}
      >
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Select a chromosome to view coordinates
        </div>
      </div>
    );
  }

  if (!zoomState) {
    return (
      <div
        className={`bg-muted/20 border-b border-border ${className}`}
        style={{ width, height }}
      >
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Loading chromosome view...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-background border-b border-border relative ${className}`}
      style={{ width, height }}
    >
      {/* Ruler background */}
      <div className="absolute inset-0 bg-gradient-to-r from-muted/10 to-muted/5" />

      {/* Ticks */}
      <svg className="absolute inset-0 w-full h-full" style={{ width, height }}>
        {rulerData.ticks.map((tick, index) => (
          <line
            key={index}
            x1={tick.position}
            y1={tick.isMajor ? 0 : height * 0.6}
            x2={tick.position}
            y2={height}
            stroke="currentColor"
            strokeWidth={tick.isMajor ? 1.5 : 1}
            className={
              tick.isMajor ? 'text-foreground' : 'text-muted-foreground/60'
            }
          />
        ))}
      </svg>

      {/* Labels */}
      <div className="absolute inset-0 flex items-start pt-1">
        {rulerData.labels.map((label, index) => (
          <div
            key={index}
            className="absolute text-xs text-foreground font-mono"
            style={{
              left: label.position - 20, // Center the label
              transform: 'translateX(50%)',
            }}
          >
            {label.text}
          </div>
        ))}
      </div>

      {/* Chromosome info */}
      <div className="absolute top-1 left-2 text-xs text-muted-foreground font-medium">
        Chr {activeChromosome} • GRCh38
      </div>

      {/* Scale indicator */}
      <div className="absolute top-1 right-2 text-xs text-muted-foreground">
        {zoomState.bpPerPx > 1000000
          ? `${Math.round(zoomState.bpPerPx / 1000000)}M bp/px`
          : zoomState.bpPerPx > 1000
            ? `${Math.round(zoomState.bpPerPx / 1000)}K bp/px`
            : `${Math.round(zoomState.bpPerPx)} bp/px`}
      </div>
    </div>
  );
}
