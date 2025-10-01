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
  theme: 'light',
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

// Initial state
const initialState: AppState = {
  config: defaultConfig,
  viewMode: 'play',
  copyLevel: 5,
  activeChromosome: null,
  globalBpPerPx: 1000000, // 1M bp per pixel
  chromosomeZoomStates: {},
  sidePanel: defaultSidePanel,
  isLoading: false,
  error: null,
};

// State store interface
interface AppStore extends AppState {
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
}

// Create the store
export const useAppStore = create<AppStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // Basic setters
      setViewMode: (mode: ViewMode) =>
        set({ viewMode: mode }, false, 'setViewMode'),

      setCopyLevel: (level: CopyLevel) =>
        set({ copyLevel: level }, false, 'setCopyLevel'),

      setActiveChromosome: (chromosome: string | null) =>
        set({ activeChromosome: chromosome }, false, 'setActiveChromosome'),

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
export const useZoomState = () =>
  useAppStore(state => {
    if (!state.activeChromosome) return null;
    return (
      state.chromosomeZoomStates[state.activeChromosome] || {
        bpPerPx: state.globalBpPerPx,
        centerPosition: 0,
        chromosome: state.activeChromosome,
      }
    );
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

// Development helpers
if (process.env.NODE_ENV === 'development') {
  // Expose store to window for debugging
  (
    window as unknown as { __CHROMOKIN_STORE__: typeof useAppStore }
  ).__CHROMOKIN_STORE__ = useAppStore;
}
