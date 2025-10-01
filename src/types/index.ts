export interface Chromosome {
  id: string;
  name: string;
  length: number;
  color: string;
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

export interface AppState {
  genomeViewer: GenomeViewerState;
  theme: 'light' | 'dark';
  isLoading: boolean;
}
