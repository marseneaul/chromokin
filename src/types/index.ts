// Re-export all types from core
export * from './core';

// Legacy types for backward compatibility (can be removed later)
export interface Chromosome {
  id: string;
  name: string;
  length: number;
  color: string;
  displayName?: string; // Friendly name like "The Small But Mighty"
  description?: string; // Description of the chromosome
}

export interface Track {
  id: string;
  name: string;
  type: 'gene' | 'variant' | 'annotation' | 'custom';
  visible: boolean;
  color: string;
  data: TrackData[];
}

export interface TrackData {
  id: string;
  start: number;
  end: number;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface GenomeViewerState {
  chromosomes: Chromosome[];
  tracks: Track[];
  selectedChromosome: string | null;
  zoomLevel: number;
  viewStart: number;
  viewEnd: number;
  sidebarCollapsed: boolean;
}

export interface LegacyAppState {
  genomeViewer: GenomeViewerState;
  theme: 'light' | 'dark';
  isLoading: boolean;
}
