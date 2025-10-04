import { type JSX } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore, useActiveChromosome } from '@/state/appState';
import { CHROMOSOME_LENGTHS } from '@/types/core';

interface ZoomControlsProps {
  className?: string;
}

export function ZoomControls({
  className = '',
}: ZoomControlsProps): JSX.Element {
  const activeChromosome = useActiveChromosome();
  const setChromosomeZoom = useAppStore(state => state.setChromosomeZoom);
  const resetZoom = useAppStore(state => state.resetZoom);
  const zoomToRange = useAppStore(state => state.zoomToRange);

  const handleZoomIn = (): void => {
    if (!activeChromosome) return;

    const currentZoom =
      useAppStore.getState().chromosomeZoomStates[activeChromosome];
    if (!currentZoom) return;

    const newBpPerPx = currentZoom.bpPerPx * 0.5; // Zoom in by 2x
    setChromosomeZoom(activeChromosome, {
      ...currentZoom,
      bpPerPx: newBpPerPx,
    });
  };

  const handleZoomOut = (): void => {
    if (!activeChromosome) return;

    const currentZoom =
      useAppStore.getState().chromosomeZoomStates[activeChromosome];
    if (!currentZoom) return;

    const newBpPerPx = currentZoom.bpPerPx * 2; // Zoom out by 2x
    setChromosomeZoom(activeChromosome, {
      ...currentZoom,
      bpPerPx: newBpPerPx,
    });
  };

  const handleResetZoom = (): void => {
    if (!activeChromosome) return;
    resetZoom(activeChromosome);
  };

  const handleCenterChromosome = (): void => {
    if (!activeChromosome) return;

    const chromosomeLength =
      CHROMOSOME_LENGTHS[activeChromosome as keyof typeof CHROMOSOME_LENGTHS];
    if (!chromosomeLength) return;

    const currentZoom =
      useAppStore.getState().chromosomeZoomStates[activeChromosome];
    if (!currentZoom) return;

    setChromosomeZoom(activeChromosome, {
      ...currentZoom,
      centerPosition: chromosomeLength / 2,
    });
  };

  const handleZoomToStart = (): void => {
    if (!activeChromosome) return;

    const currentZoom =
      useAppStore.getState().chromosomeZoomStates[activeChromosome];
    if (!currentZoom) return;

    // Zoom to first 1M bp
    zoomToRange(activeChromosome, 0, 1000000, 800);
  };

  const handleZoomToEnd = (): void => {
    if (!activeChromosome) return;

    const chromosomeLength =
      CHROMOSOME_LENGTHS[activeChromosome as keyof typeof CHROMOSOME_LENGTHS];
    if (!chromosomeLength) return;

    const currentZoom =
      useAppStore.getState().chromosomeZoomStates[activeChromosome];
    if (!currentZoom) return;

    // Zoom to last 1M bp
    zoomToRange(
      activeChromosome,
      chromosomeLength - 1000000,
      chromosomeLength,
      800
    );
  };

  if (!activeChromosome) {
    return <div />;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-background">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          className="h-8 w-8"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          className="h-8 w-8"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleResetZoom}
          className="h-8 w-8"
          title="Reset zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-background">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomToStart}
          className="h-8 px-3 text-xs"
          title="Go to start"
        >
          Start
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleCenterChromosome}
          className="h-8 w-8"
          title="Center chromosome"
        >
          <Move className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomToEnd}
          className="h-8 px-3 text-xs"
          title="Go to end"
        >
          End
        </Button>
      </div>
    </div>
  );
}
