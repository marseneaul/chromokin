export interface Gene {
  id: string;
  name: string;
  symbol: string;
  start: number;
  end: number;
  strand: '+' | '-';
  description?: string;
  function?: string;
  // Ancestry and family-friendly fields
  ancestryRelevant?: boolean;
  simpleDescription?: string;
  familyFriendlyName?: string;
  traits?: string[];
  ethnicAssociations?: string[];
}

export interface Variant {
  id: string;
  position: number;
  reference: string;
  alternate: string;
  type: 'SNP' | 'INDEL' | 'CNV';
  significance?: 'benign' | 'likely_benign' | 'uncertain' | 'likely_pathogenic' | 'pathogenic';
  clinicalSignificance?: string;
  frequency?: number;
  // Ancestry-specific fields
  ancestryRelevant?: boolean;
  ethnicOrigin?: string;
  haplogroup?: string;
  populationFrequency?: { [population: string]: number };
  simpleExplanation?: string;
}

export interface ChromosomeSegment {
  start: number;
  end: number;
  ancestry: string;
  confidence: number; // 0-1
  population?: string;
  color?: string;
}

export interface Chromosome {
  id: string;
  name: string;
  length: number;
  genes: Gene[];
  variants: Variant[];
  segments?: ChromosomeSegment[]; // Ancestry segments
  type?: 'autosomal' | 'sex' | 'mitochondrial';
}

export interface GenomeData {
  chromosomes: Chromosome[];
  metadata?: {
    species?: string;
    assembly?: string;
    version?: string;
    build?: string;
    release?: string;
  };
}

export interface GenomeBrowserOptions {
  width?: number;
  height?: number;
  showGenes?: boolean;
  showVariants?: boolean;
  showTooltips?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  theme?: 'light' | 'dark';
  // New ancestry and user-friendly features
  showAncestryTrack?: boolean;
  showEthnicityTrack?: boolean;
  showTutorial?: boolean;
  simpleMode?: boolean; // Hide complex scientific terms
  showFamilyTree?: boolean;
  enableTutorial?: boolean;
  showAncestrySegments?: boolean; // Show ancestry segments on chromosomes
  showAllChromosomes?: boolean; // Show all 24 chromosomes
  showMitochondrialDNA?: boolean; // Show mitochondrial DNA
  professionalMode?: boolean; // Enhanced professional styling
  colors?: {
    chromosome?: string;
    gene?: string;
    variant?: string;
    pathogenic?: string;
    benign?: string;
    background?: string;
    ancestry?: string;
    ethnicity?: string;
    tutorial?: string;
  };
}

export interface AncestryData {
  ethnicity: {
    [region: string]: number; // percentage
  };
  haplogroups: {
    maternal?: string;
    paternal?: string;
  };
  populationMatches: {
    [population: string]: number; // similarity score
  };
  migrationPath?: string[];
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface GenomeBrowserEvents {
  onGeneClick?: (gene: Gene) => void;
  onVariantClick?: (variant: Variant) => void;
  onChromosomeClick?: (chromosome: Chromosome) => void;
  onZoom?: (scale: number) => void;
  onPan?: (x: number, y: number) => void;
  onTutorialStep?: (step: TutorialStep) => void;
  onAncestryClick?: (ancestryData: AncestryData) => void;
}
