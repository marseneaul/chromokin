import React from 'react';
import { Dna, Info } from 'lucide-react';
import { type Chromosome, type Track } from '@/types';
import { formatChromosomeName } from '@/lib/utils';

interface GenomeViewerProps {
  chromosomes: Chromosome[];
  selectedChromosome: string | null;
  tracks: Track[];
}

export function GenomeViewer({
  chromosomes,
  selectedChromosome,
  tracks,
}: GenomeViewerProps): JSX.Element {
  const selectedChr = chromosomes.find(chr => chr.id === selectedChromosome);

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
              Select a chromosome from the sidebar to begin exploring the genome.
              Each chromosome contains thousands of genes and genetic information.
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
        <div className="flex items-center gap-4">
          <div
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: selectedChr.color }}
          />
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {formatChromosomeName(selectedChr.name)}
            </h2>
            <p className="text-muted-foreground">
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
              <p>
                It includes genes, regulatory regions, and other functional elements
                that are essential for life.
              </p>
            </div>
          </div>

          {/* Tracks Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Data Tracks</h3>
            </div>
            
            {tracks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No tracks loaded yet.</p>
                <p className="text-sm mt-1">
                  Tracks will appear here when data is loaded.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tracks.map((track) => (
                  <div key={track.id} className="track-item">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: track.color }}
                      />
                      <span className="font-medium">{track.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({track.type})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Placeholder for future chromosome visualization */}
          <div className="chromosome-column p-6">
            <div className="text-center space-y-4">
              <div className="w-full h-32 bg-gradient-to-r from-sky-100 to-sky-200 rounded-lg flex items-center justify-center">
                <div className="text-muted-foreground">
                  <Dna className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Chromosome visualization will appear here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
