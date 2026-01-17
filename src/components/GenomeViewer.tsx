import { type JSX, useState, useRef, useEffect } from 'react';
import { Dna, Info } from 'lucide-react';
import { type Chromosome, type TrackSpec } from '@/types';
import { formatChromosomeName } from '@/lib/utils';
import { Ruler } from '@/components/Ruler';
import { ChromosomeGrid } from '@/components/ChromosomeGrid';
import { ZoomControls } from '@/components/ZoomControls';
import { TrackContainer } from '@/components/tracks/TrackContainer';
import { Tooltip } from '@/components/interaction/Tooltip';
import { DetailPanel } from '@/components/interaction/DetailPanel';
import { useZoomState, useAppStore } from '@/state/appState';
import { CHROMOSOME_LENGTHS } from '@/types/core';

interface GenomeViewerProps {
  chromosomes: Chromosome[];
  selectedChromosome: string | null;
  tracks: TrackSpec[];
}

export function GenomeViewer({
  chromosomes,
  selectedChromosome,
  tracks,
}: GenomeViewerProps): JSX.Element {
  const selectedChr = chromosomes.find(chr => chr.id === selectedChromosome);
  const zoomState = useZoomState();
  const globalBpPerPx = useAppStore(state => state.globalBpPerPx);

  // Container width ref for responsive track rendering
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Get chromosome length for the selected chromosome
  const chromosomeLength = selectedChromosome
    ? CHROMOSOME_LENGTHS[
        selectedChromosome as keyof typeof CHROMOSOME_LENGTHS
      ] || 0
    : 0;

  // Create a default zoom state if none exists
  const effectiveZoomState = zoomState || {
    bpPerPx: globalBpPerPx,
    centerPosition: chromosomeLength / 2,
    chromosome: selectedChromosome || '',
  };

  if (!selectedChr) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-4">
          <Dna className="h-16 w-16 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              Welcome to ChromoKin
            </h3>
            <p className="text-muted-foreground max-w-md">
              Select a chromosome from the sidebar to begin exploring the
              genome. Each chromosome contains thousands of genes and genetic
              information.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Chromosome Header */}
      <div className="p-6 border-b border-border bg-card">
        <div className="flex items-start gap-4">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0"
            style={{ backgroundColor: selectedChr.color }}
          />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">
              {formatChromosomeName(selectedChr.name)}
            </h2>
            {selectedChr.displayName && (
              <h3 className="text-xl font-semibold text-primary mt-1">
                {selectedChr.displayName}
              </h3>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              Length: {Math.round(selectedChr.length / 1000000)}M base pairs
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Chromosome Overview */}
          <div className="chromosome-column p-6">
            <div className="flex items-center gap-2 mb-4">
              <Dna className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Chromosome Overview</h3>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                This chromosome contains approximately{' '}
                <span className="font-medium text-foreground">
                  {Math.round(selectedChr.length / 1000)}K
                </span>{' '}
                base pairs of DNA.
              </p>
              {selectedChr.description ? (
                <p>{selectedChr.description}</p>
              ) : (
                <p>
                  It includes genes, regulatory regions, and other functional
                  elements that are essential for life.
                </p>
              )}
            </div>
          </div>

          {/* Chromosome Visualization */}
          <div className="chromosome-column" ref={containerRef}>
            <div className="border border-border rounded-lg overflow-hidden bg-background">
              {/* Zoom Controls */}
              <div className="p-4 border-b border-border bg-muted/20">
                <ZoomControls />
              </div>

              {/* Ruler */}
              <Ruler width={containerWidth} height={50} />

              {/* Trait-associated Genes and Traits Tracks */}
              {selectedChromosome && (
                <div className="border-b border-border">
                  <TrackContainer
                    chromosome={selectedChromosome}
                    chromosomeLength={chromosomeLength}
                    zoomState={effectiveZoomState}
                    containerWidth={containerWidth}
                    tracks={tracks}
                  />
                </div>
              )}

              {/* Grid and Chromosome Visualization */}
              <div className="relative">
                <ChromosomeGrid width={containerWidth} height={300} />
              </div>
            </div>
          </div>

          {/* Track Legend */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Active Tracks</h3>
            </div>

            <div className="flex flex-wrap gap-3">
              {tracks
                .filter(t => t.visible)
                .map(track => (
                  <div
                    key={track.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: track.color }}
                    />
                    <span className="text-sm font-medium">{track.name}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip for hover info */}
      <Tooltip />

      {/* Detail Panel for click info */}
      <DetailPanel />
    </div>
  );
}
