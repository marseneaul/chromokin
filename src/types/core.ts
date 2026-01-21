/**
 * Core types for ChromoKin genome browser
 * Two modes: simplified Play and full Pro
 */

// View modes for different user experiences
export type ViewMode = 'play' | 'pro';

// Reading level for kid-friendly content (3-8 grade levels)
export type CopyLevel = 3 | 4 | 5 | 6 | 7 | 8;

// Track types for different data visualization
export type TrackType =
  | 'genes'
  | 'userVariants'
  | 'traits'
  | 'clin'
  | 'ancestry'
  | 'neanderthal'
  | 'haplogroup'
  | 'coverage'
  | 'custom';

// Data sources configuration
export interface DataSources {
  genes?: {
    source: 'ensembl' | 'refseq' | 'custom';
    version?: string;
  };
  variants?: {
    source: 'clinvar' | 'gnomad' | 'custom';
    version?: string;
  };
  ancestry?: {
    source: '23andme' | 'ancestry' | 'custom';
    version?: string;
  };
}

// Track specification for visualization
export interface TrackSpec {
  id: string;
  type: TrackType;
  name: string;
  heightPx?: number;
  visible?: boolean;
  options?: Record<string, unknown>;
  color?: string;
  description?: string;
}

// Main configuration interface
export interface ChromoKinConfig {
  build: 'GRCh38' | 'GRCh37';
  chromosomes: string[];
  viewMode: ViewMode;
  tracks: TrackSpec[];
  dataSources: DataSources;
  copyLevel: CopyLevel;
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
  };
}

// Genomic coordinate system
export interface GenomicPosition {
  chromosome: string;
  position: number; // 1-based position
}

export interface GenomicRange {
  chromosome: string;
  start: number; // 1-based start
  end: number; // 1-based end
}

// Variant record (minimal for now)
export interface VariantRecord {
  id: string;
  chromosome: string;
  position: number;
  reference: string;
  alternate: string;
  type: 'SNP' | 'INDEL' | 'CNV' | 'SV';
  clinicalSignificance?:
    | 'benign'
    | 'likely_benign'
    | 'uncertain'
    | 'likely_pathogenic'
    | 'pathogenic';
  frequency?: number; // Population frequency 0-1
  quality?: number; // Quality score
  metadata?: Record<string, unknown>;
}

// Gene record (minimal for now)
export interface GeneRecord {
  id: string;
  symbol: string;
  name: string;
  chromosome: string;
  start: number;
  end: number;
  strand: '+' | '-';
  biotype: string;
  description?: string;
  transcripts?: TranscriptRecord[];
  metadata?: Record<string, unknown>;
}

// Transcript record
export interface TranscriptRecord {
  id: string;
  geneId: string;
  start: number;
  end: number;
  strand: '+' | '-';
  exons: ExonRecord[];
  cdsStart?: number;
  cdsEnd?: number;
  metadata?: Record<string, unknown>;
}

// Exon record
export interface ExonRecord {
  id: string;
  transcriptId: string;
  start: number;
  end: number;
  rank: number;
  phase?: number;
}

// Ancestry segment
export interface AncestrySegment {
  id: string;
  chromosome: string;
  start: number;
  end: number;
  population: string;
  confidence: number; // 0-1
  color: string;
  metadata?: Record<string, unknown>;
}

// Trait record for kid-friendly traits
export interface TraitRecord {
  id: string;
  name: string;
  category: 'physical' | 'behavioral' | 'health' | 'fun';
  description: string;
  variants: string[]; // Variant IDs
  kidFriendly: boolean;
  copyLevel: CopyLevel;
  icon?: string;
  metadata?: Record<string, unknown>;
}

// Zoom and view state
export interface ZoomState {
  bpPerPx: number; // Base pairs per pixel
  centerPosition: number; // Center position in bp
  chromosome: string;
}

// Side panel state
export interface SidePanelState {
  isOpen: boolean;
  activeTab: 'chromosomes' | 'tracks' | 'info' | 'settings';
  width: number;
}

// App state interface
export interface AppState {
  config: ChromoKinConfig;
  viewMode: ViewMode;
  copyLevel: CopyLevel;
  activeChromosome: string | null;
  globalBpPerPx: number;
  chromosomeZoomStates: Record<string, ZoomState>;
  sidePanel: SidePanelState;
  isLoading: boolean;
  error: string | null;
}

// Action types for state updates
export type AppAction =
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_COPY_LEVEL'; payload: CopyLevel }
  | { type: 'SET_ACTIVE_CHROMOSOME'; payload: string | null }
  | { type: 'SET_GLOBAL_BP_PER_PX'; payload: number }
  | {
      type: 'SET_CHROMOSOME_ZOOM';
      payload: { chromosome: string; zoomState: ZoomState };
    }
  | { type: 'SET_SIDE_PANEL'; payload: Partial<SidePanelState> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_CONFIG'; payload: Partial<ChromoKinConfig> };

// Utility types
export type ChromosomeId =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'
  | '21'
  | '22'
  | 'X'
  | 'Y'
  | 'MT';

export type PopulationId =
  | 'AFR'
  | 'AMR'
  | 'EAS'
  | 'EUR'
  | 'SAS'
  | 'MIXED'
  | 'NEANDERTHAL'
  | 'DENISOVAN'
  | 'AFRICAN'
  | 'EUROPEAN'
  | 'ASIAN'
  | 'NATIVE_AMERICAN'
  | 'OCEANIAN';

// Constants
export const CHROMOSOME_NAMES: Record<ChromosomeId, string> = {
  '1': 'Chromosome 1',
  '2': 'Chromosome 2',
  '3': 'Chromosome 3',
  '4': 'Chromosome 4',
  '5': 'Chromosome 5',
  '6': 'Chromosome 6',
  '7': 'Chromosome 7',
  '8': 'Chromosome 8',
  '9': 'Chromosome 9',
  '10': 'Chromosome 10',
  '11': 'Chromosome 11',
  '12': 'Chromosome 12',
  '13': 'Chromosome 13',
  '14': 'Chromosome 14',
  '15': 'Chromosome 15',
  '16': 'Chromosome 16',
  '17': 'Chromosome 17',
  '18': 'Chromosome 18',
  '19': 'Chromosome 19',
  '20': 'Chromosome 20',
  '21': 'Chromosome 21',
  '22': 'Chromosome 22',
  X: 'X Chromosome',
  Y: 'Y Chromosome',
  MT: 'Mitochondrial DNA',
};

export const CHROMOSOME_LENGTHS: Record<ChromosomeId, number> = {
  '1': 248956422,
  '2': 242193529,
  '3': 198295559,
  '4': 190214555,
  '5': 181538259,
  '6': 170805979,
  '7': 159345973,
  '8': 145138636,
  '9': 138394717,
  '10': 133797422,
  '11': 135086622,
  '12': 133275309,
  '13': 114364328,
  '14': 107043718,
  '15': 101991189,
  '16': 90338345,
  '17': 83257441,
  '18': 80373285,
  '19': 58617616,
  '20': 64444167,
  '21': 46709983,
  '22': 50818468,
  X: 156040895,
  Y: 57227415,
  MT: 16569,
};

export const COPY_LEVEL_DESCRIPTIONS: Record<CopyLevel, string> = {
  3: 'Simple words and short sentences',
  4: 'Basic vocabulary with explanations',
  5: 'Intermediate terms with context',
  6: 'Advanced vocabulary with definitions',
  7: 'Scientific terms with full explanations',
  8: 'Professional terminology',
};
