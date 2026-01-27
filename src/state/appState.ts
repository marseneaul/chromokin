/**
 * App state management using Zustand
 * Centralized state for ChromoKin genome browser
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import {
  type AppState,
  type ChromoKinConfig,
  type ViewMode,
  type CopyLevel,
  type ZoomState,
  type SidePanelState,
  CHROMOSOME_LENGTHS,
  CHROMOSOME_NAMES,
} from '@/types/core';
import type { TraitsDatabase } from '@/types/traits';
import type { GenomicFeaturesDatabase } from '@/types/genomicFeatures';
import type { AncestryComposition, AncestrySegment } from '@/types/genome';
import { getTraitsDatabase } from '@/data/traitsLoader';
import { getGenomicFeaturesDatabase } from '@/data/genomicFeaturesLoader';

/**
 * User ancestry data from uploaded file
 */
export interface UserAncestryData {
  source: '23andme' | 'ancestry' | 'unknown';
  fileName: string;
  snpCount: number;
  buildVersion: string;
  composition: AncestryComposition[];
  segments: AncestrySegment[];
  segmentsByChromosome: Map<string, AncestrySegment[]>;
  globalConfidence: 'high' | 'moderate' | 'low';
  markersUsed: number;
  processedAt: string;
}

/**
 * Page types for navigation
 */
export type PageType = 'overview' | 'browser';

/**
 * Trait interaction state for hover/select behaviors
 */
interface TraitInteractionState {
  traitsLoaded: boolean;
  traitsDatabase: TraitsDatabase | null;
  genomicFeaturesLoaded: boolean;
  genomicFeaturesDatabase: GenomicFeaturesDatabase | null;
  hoveredGeneId: string | null;
  hoveredTraitId: string | null;
  hoveredFeatureId: string | null;
  tooltipPosition: { x: number; y: number } | null;
  selectedGeneId: string | null;
  selectedTraitId: string | null;
  selectedFeatureId: string | null;
  selectedVariantId: string | null;
  detailPanelOpen: boolean;
  // User ancestry data
  userAncestryData: UserAncestryData | null;
  userAncestryLoading: boolean;
  userAncestryError: string | null;
}

// Default configuration
const defaultConfig: ChromoKinConfig = {
  build: 'GRCh38',
  chromosomes: [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    'X',
    'Y',
  ],
  viewMode: 'play',
  copyLevel: 5,
  tracks: [
    {
      id: 'genes',
      type: 'genes',
      name: 'Genes',
      heightPx: 100,
      visible: true,
      color: '#3b82f6',
      description: 'Protein-coding genes',
    },
    {
      id: 'variants',
      type: 'userVariants',
      name: 'Your Variants',
      heightPx: 80,
      visible: true,
      color: '#ef4444',
      description: 'Your genetic variants',
    },
    {
      id: 'traits',
      type: 'traits',
      name: 'Traits',
      heightPx: 60,
      visible: true,
      color: '#10b981',
      description: 'Fun traits and characteristics',
    },
  ],
  dataSources: {
    genes: {
      source: 'ensembl',
      version: '109',
    },
    variants: {
      source: 'clinvar',
      version: '2024-01',
    },
  },
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
  },
};

// Default side panel state
const defaultSidePanel: SidePanelState = {
  isOpen: true,
  activeTab: 'chromosomes',
  width: 256,
};

// Default trait interaction state
const defaultTraitInteraction: TraitInteractionState = {
  traitsLoaded: false,
  traitsDatabase: null,
  genomicFeaturesLoaded: false,
  genomicFeaturesDatabase: null,
  hoveredGeneId: null,
  hoveredTraitId: null,
  hoveredFeatureId: null,
  tooltipPosition: null,
  selectedGeneId: null,
  selectedTraitId: null,
  selectedFeatureId: null,
  selectedVariantId: null,
  detailPanelOpen: false,
  userAncestryData: null,
  userAncestryLoading: false,
  userAncestryError: null,
};

// Initial state
const initialState: AppState &
  TraitInteractionState & { currentPage: PageType } = {
  config: defaultConfig,
  viewMode: 'play',
  copyLevel: 5,
  activeChromosome: null,
  globalBpPerPx: 1000000, // 1M bp per pixel
  chromosomeZoomStates: {},
  sidePanel: defaultSidePanel,
  isLoading: false,
  error: null,
  currentPage: 'overview',
  ...defaultTraitInteraction,
};

// State store interface
interface AppStore extends AppState, TraitInteractionState {
  // Page navigation
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCopyLevel: (level: CopyLevel) => void;
  setActiveChromosome: (chromosome: string | null) => void;
  setGlobalBpPerPx: (bpPerPx: number) => void;
  setChromosomeZoom: (chromosome: string, zoomState: ZoomState) => void;
  setSidePanel: (updates: Partial<SidePanelState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateConfig: (updates: Partial<ChromoKinConfig>) => void;

  // Computed getters
  getCurrentZoomState: () => ZoomState | null;
  getChromosomeLength: (chromosome: string) => number;
  getChromosomeName: (chromosome: string) => string;

  // Utility actions
  resetZoom: (chromosome?: string) => void;
  zoomToRange: (
    chromosome: string,
    start: number,
    end: number,
    containerWidth: number
  ) => void;
  toggleSidePanel: () => void;
  resetToDefaults: () => void;

  // Trait interaction actions
  loadTraits: () => void;
  loadGenomicFeatures: () => void;
  setHoveredGene: (
    geneId: string | null,
    position?: { x: number; y: number }
  ) => void;
  setHoveredTrait: (
    traitId: string | null,
    position?: { x: number; y: number }
  ) => void;
  setHoveredFeature: (
    featureId: string | null,
    position?: { x: number; y: number }
  ) => void;
  selectGene: (geneId: string | null) => void;
  selectTrait: (traitId: string | null) => void;
  selectFeature: (featureId: string | null) => void;
  selectVariant: (variantId: string | null) => void;
  closeDetailPanel: () => void;
  clearInteractions: () => void;

  // User ancestry actions
  setUserAncestryLoading: (loading: boolean) => void;
  setUserAncestryData: (data: UserAncestryData) => void;
  setUserAncestryError: (error: string | null) => void;
  clearUserAncestryData: () => void;
}

// Create the store
export const useAppStore = create<AppStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // Page navigation
      setCurrentPage: (page: PageType) =>
        set({ currentPage: page }, false, 'setCurrentPage'),

      // Basic setters
      setViewMode: (mode: ViewMode) =>
        set({ viewMode: mode }, false, 'setViewMode'),

      setCopyLevel: (level: CopyLevel) =>
        set({ copyLevel: level }, false, 'setCopyLevel'),

      setActiveChromosome: (chromosome: string | null) =>
        set(
          state => {
            // Initialize zoom state for new chromosome if it doesn't exist
            if (chromosome && !state.chromosomeZoomStates[chromosome]) {
              const chromosomeLength =
                CHROMOSOME_LENGTHS[
                  chromosome as keyof typeof CHROMOSOME_LENGTHS
                ];
              const defaultCenterPosition = chromosomeLength
                ? chromosomeLength / 2
                : 0;

              return {
                activeChromosome: chromosome,
                chromosomeZoomStates: {
                  ...state.chromosomeZoomStates,
                  [chromosome]: {
                    bpPerPx: state.globalBpPerPx,
                    centerPosition: defaultCenterPosition,
                    chromosome: chromosome,
                  },
                },
              };
            }

            return { activeChromosome: chromosome };
          },
          false,
          'setActiveChromosome'
        ),

      setGlobalBpPerPx: (bpPerPx: number) =>
        set({ globalBpPerPx: bpPerPx }, false, 'setGlobalBpPerPx'),

      setChromosomeZoom: (chromosome: string, zoomState: ZoomState) =>
        set(
          state => ({
            chromosomeZoomStates: {
              ...state.chromosomeZoomStates,
              [chromosome]: zoomState,
            },
          }),
          false,
          'setChromosomeZoom'
        ),

      setSidePanel: (updates: Partial<SidePanelState>) =>
        set(
          state => ({
            sidePanel: { ...state.sidePanel, ...updates },
          }),
          false,
          'setSidePanel'
        ),

      setLoading: (loading: boolean) =>
        set({ isLoading: loading }, false, 'setLoading'),

      setError: (error: string | null) => set({ error }, false, 'setError'),

      updateConfig: (updates: Partial<ChromoKinConfig>) =>
        set(
          state => ({
            config: { ...state.config, ...updates },
          }),
          false,
          'updateConfig'
        ),

      // Computed getters
      getCurrentZoomState: () => {
        const state = get();
        if (!state.activeChromosome) return null;
        return (
          state.chromosomeZoomStates[state.activeChromosome] || {
            bpPerPx: state.globalBpPerPx,
            centerPosition: 0,
            chromosome: state.activeChromosome,
          }
        );
      },

      getChromosomeLength: (chromosome: string) => {
        return (
          CHROMOSOME_LENGTHS[chromosome as keyof typeof CHROMOSOME_LENGTHS] || 0
        );
      },

      getChromosomeName: (chromosome: string) => {
        return (
          CHROMOSOME_NAMES[chromosome as keyof typeof CHROMOSOME_NAMES] ||
          `Chromosome ${chromosome}`
        );
      },

      // Utility actions
      resetZoom: (chromosome?: string) => {
        const state = get();
        const targetChromosome = chromosome || state.activeChromosome;
        if (!targetChromosome) return;

        set(
          state => ({
            chromosomeZoomStates: {
              ...state.chromosomeZoomStates,
              [targetChromosome]: {
                bpPerPx: state.globalBpPerPx,
                centerPosition: 0,
                chromosome: targetChromosome,
              },
            },
          }),
          false,
          'resetZoom'
        );
      },

      zoomToRange: (
        chromosome: string,
        start: number,
        end: number,
        containerWidth: number
      ) => {
        const range = end - start;
        const bpPerPx = range / containerWidth;
        const centerPosition = start + range / 2;

        set(
          state => ({
            chromosomeZoomStates: {
              ...state.chromosomeZoomStates,
              [chromosome]: {
                bpPerPx,
                centerPosition,
                chromosome,
              },
            },
          }),
          false,
          'zoomToRange'
        );
      },

      toggleSidePanel: () =>
        set(
          state => ({
            sidePanel: {
              ...state.sidePanel,
              isOpen: !state.sidePanel.isOpen,
            },
          }),
          false,
          'toggleSidePanel'
        ),

      resetToDefaults: () => set(initialState, false, 'resetToDefaults'),

      // Trait interaction actions
      loadTraits: () => {
        const traitsDatabase = getTraitsDatabase();
        set({ traitsLoaded: true, traitsDatabase }, false, 'loadTraits');
      },

      loadGenomicFeatures: () => {
        const genomicFeaturesDatabase = getGenomicFeaturesDatabase();
        set(
          { genomicFeaturesLoaded: true, genomicFeaturesDatabase },
          false,
          'loadGenomicFeatures'
        );
      },

      setHoveredGene: (
        geneId: string | null,
        position?: { x: number; y: number }
      ) =>
        set(
          {
            hoveredGeneId: geneId,
            tooltipPosition: geneId && position ? position : null,
          },
          false,
          'setHoveredGene'
        ),

      setHoveredTrait: (
        traitId: string | null,
        position?: { x: number; y: number }
      ) =>
        set(
          {
            hoveredTraitId: traitId,
            tooltipPosition: traitId && position ? position : null,
          },
          false,
          'setHoveredTrait'
        ),

      setHoveredFeature: (
        featureId: string | null,
        position?: { x: number; y: number }
      ) =>
        set(
          {
            hoveredFeatureId: featureId,
            tooltipPosition: featureId && position ? position : null,
          },
          false,
          'setHoveredFeature'
        ),

      selectGene: (geneId: string | null) =>
        set(
          {
            selectedGeneId: geneId,
            detailPanelOpen: geneId !== null,
          },
          false,
          'selectGene'
        ),

      selectTrait: (traitId: string | null) =>
        set(
          {
            selectedTraitId: traitId,
            detailPanelOpen: traitId !== null,
          },
          false,
          'selectTrait'
        ),

      selectFeature: (featureId: string | null) =>
        set(
          {
            selectedFeatureId: featureId,
            detailPanelOpen: featureId !== null,
          },
          false,
          'selectFeature'
        ),

      selectVariant: (variantId: string | null) =>
        set(
          {
            selectedVariantId: variantId,
            detailPanelOpen: variantId !== null,
          },
          false,
          'selectVariant'
        ),

      closeDetailPanel: () =>
        set(
          {
            selectedGeneId: null,
            selectedTraitId: null,
            selectedFeatureId: null,
            selectedVariantId: null,
            detailPanelOpen: false,
          },
          false,
          'closeDetailPanel'
        ),

      clearInteractions: () =>
        set(
          {
            hoveredGeneId: null,
            hoveredTraitId: null,
            hoveredFeatureId: null,
            tooltipPosition: null,
            selectedGeneId: null,
            selectedTraitId: null,
            selectedFeatureId: null,
            selectedVariantId: null,
            detailPanelOpen: false,
          },
          false,
          'clearInteractions'
        ),

      // User ancestry actions
      setUserAncestryLoading: (loading: boolean) =>
        set({ userAncestryLoading: loading }, false, 'setUserAncestryLoading'),

      setUserAncestryData: (data: UserAncestryData) =>
        set(
          {
            userAncestryData: data,
            userAncestryLoading: false,
            userAncestryError: null,
          },
          false,
          'setUserAncestryData'
        ),

      setUserAncestryError: (error: string | null) =>
        set(
          { userAncestryError: error, userAncestryLoading: false },
          false,
          'setUserAncestryError'
        ),

      clearUserAncestryData: () =>
        set(
          {
            userAncestryData: null,
            userAncestryLoading: false,
            userAncestryError: null,
          },
          false,
          'clearUserAncestryData'
        ),
    })),
    {
      name: 'chromokin-app-store',
      partialize: (state: AppStore) => ({
        config: state.config,
        viewMode: state.viewMode,
        copyLevel: state.copyLevel,
        sidePanel: state.sidePanel,
      }),
    }
  )
);

// Selectors for common use cases
export const useViewMode = () => useAppStore(state => state.viewMode);
export const useCopyLevel = () => useAppStore(state => state.copyLevel);
export const useActiveChromosome = () =>
  useAppStore(state => state.activeChromosome);
export const useSidePanel = () => useAppStore(state => state.sidePanel);
export const useConfig = () => useAppStore(state => state.config);
export const useTracks = () => useAppStore(state => state.config.tracks);
export const useCurrentPage = () => useAppStore(state => state.currentPage);
export const useSetCurrentPage = () =>
  useAppStore(state => state.setCurrentPage);
export const useZoomState = () =>
  useAppStore(state => {
    if (!state.activeChromosome) return null;
    return state.chromosomeZoomStates[state.activeChromosome] || null;
  });

// Individual action selectors to prevent object recreation
export const useSetViewMode = () => useAppStore(state => state.setViewMode);
export const useSetCopyLevel = () => useAppStore(state => state.setCopyLevel);
export const useSetActiveChromosome = () =>
  useAppStore(state => state.setActiveChromosome);
export const useSetGlobalBpPerPx = () =>
  useAppStore(state => state.setGlobalBpPerPx);
export const useSetChromosomeZoom = () =>
  useAppStore(state => state.setChromosomeZoom);
export const useSetSidePanel = () => useAppStore(state => state.setSidePanel);
export const useSetLoading = () => useAppStore(state => state.setLoading);
export const useSetError = () => useAppStore(state => state.setError);
export const useUpdateConfig = () => useAppStore(state => state.updateConfig);
export const useResetZoom = () => useAppStore(state => state.resetZoom);
export const useZoomToRange = () => useAppStore(state => state.zoomToRange);
export const useToggleSidePanel = () =>
  useAppStore(state => state.toggleSidePanel);
export const useResetToDefaults = () =>
  useAppStore(state => state.resetToDefaults);

// Utility hooks - individual selectors to prevent object recreation
export const useChromosomeName = (chromosome: string) =>
  useAppStore(state => state.getChromosomeName(chromosome));
export const useChromosomeLength = (chromosome: string) =>
  useAppStore(state => state.getChromosomeLength(chromosome));
export const useChromosomeZoomState = (chromosome: string) =>
  useAppStore(state => state.chromosomeZoomStates[chromosome]);

export const useTrackById = (trackId: string) =>
  useAppStore(state => state.config.tracks.find(track => track.id === trackId));

export const useVisibleTracks = () =>
  useAppStore(state => state.config.tracks.filter(track => track.visible));

// Trait interaction selectors
export const useTraitsLoaded = () => useAppStore(state => state.traitsLoaded);
export const useTraitsDatabase = () =>
  useAppStore(state => state.traitsDatabase);
export const useGenomicFeaturesLoaded = () =>
  useAppStore(state => state.genomicFeaturesLoaded);
export const useGenomicFeaturesDatabase = () =>
  useAppStore(state => state.genomicFeaturesDatabase);
export const useHoveredGeneId = () => useAppStore(state => state.hoveredGeneId);
export const useHoveredTraitId = () =>
  useAppStore(state => state.hoveredTraitId);
export const useHoveredFeatureId = () =>
  useAppStore(state => state.hoveredFeatureId);
export const useTooltipPosition = () =>
  useAppStore(state => state.tooltipPosition);
export const useSelectedGeneId = () =>
  useAppStore(state => state.selectedGeneId);
export const useSelectedTraitId = () =>
  useAppStore(state => state.selectedTraitId);
export const useSelectedFeatureId = () =>
  useAppStore(state => state.selectedFeatureId);
export const useSelectedVariantId = () =>
  useAppStore(state => state.selectedVariantId);
export const useDetailPanelOpen = () =>
  useAppStore(state => state.detailPanelOpen);

// Trait interaction action selectors
export const useLoadTraits = () => useAppStore(state => state.loadTraits);
export const useLoadGenomicFeatures = () =>
  useAppStore(state => state.loadGenomicFeatures);
export const useSetHoveredGene = () =>
  useAppStore(state => state.setHoveredGene);
export const useSetHoveredTrait = () =>
  useAppStore(state => state.setHoveredTrait);
export const useSetHoveredFeature = () =>
  useAppStore(state => state.setHoveredFeature);
export const useSelectGene = () => useAppStore(state => state.selectGene);
export const useSelectTrait = () => useAppStore(state => state.selectTrait);
export const useSelectFeature = () => useAppStore(state => state.selectFeature);
export const useSelectVariant = () => useAppStore(state => state.selectVariant);
export const useCloseDetailPanel = () =>
  useAppStore(state => state.closeDetailPanel);
export const useClearInteractions = () =>
  useAppStore(state => state.clearInteractions);

// User ancestry selectors
export const useUserAncestryData = () =>
  useAppStore(state => state.userAncestryData);
export const useUserAncestryLoading = () =>
  useAppStore(state => state.userAncestryLoading);
export const useUserAncestryError = () =>
  useAppStore(state => state.userAncestryError);
export const useSetUserAncestryData = () =>
  useAppStore(state => state.setUserAncestryData);
export const useSetUserAncestryLoading = () =>
  useAppStore(state => state.setUserAncestryLoading);
export const useSetUserAncestryError = () =>
  useAppStore(state => state.setUserAncestryError);
export const useClearUserAncestryData = () =>
  useAppStore(state => state.clearUserAncestryData);

// Development helpers
if (process.env.NODE_ENV === 'development') {
  // Expose store to window for debugging
  (
    window as unknown as { __CHROMOKIN_STORE__: typeof useAppStore }
  ).__CHROMOKIN_STORE__ = useAppStore;
}
