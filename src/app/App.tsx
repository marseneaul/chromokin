import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { GenomeViewer } from '@/components/GenomeViewer';
import { type AppState } from '@/types';

const initialAppState: AppState = {
  genomeViewer: {
    chromosomes: [
      { id: '1', name: '1', length: 248956422, color: '#FF6B6B' },
      { id: '2', name: '2', length: 242193529, color: '#4ECDC4' },
      { id: '3', name: '3', length: 198295559, color: '#45B7D1' },
      { id: '4', name: '4', length: 190214555, color: '#96CEB4' },
      { id: '5', name: '5', length: 181538259, color: '#FFEAA7' },
      { id: '6', name: '6', length: 170805979, color: '#DDA0DD' },
      { id: '7', name: '7', length: 159345973, color: '#98D8C8' },
      { id: '8', name: '8', length: 145138636, color: '#F7DC6F' },
      { id: '9', name: '9', length: 138394717, color: '#BB8FCE' },
      { id: '10', name: '10', length: 133797422, color: '#85C1E9' },
      { id: '11', name: '11', length: 135086622, color: '#F8C471' },
      { id: '12', name: '12', length: 133275309, color: '#82E0AA' },
      { id: '13', name: '13', length: 114364328, color: '#F1948A' },
      { id: '14', name: '14', length: 107043718, color: '#85C1E9' },
      { id: '15', name: '15', length: 101991189, color: '#D7BDE2' },
      { id: '16', name: '16', length: 90338345, color: '#F9E79F' },
      { id: '17', name: '17', length: 83257441, color: '#AED6F1' },
      { id: '18', name: '18', length: 80373285, color: '#A9DFBF' },
      { id: '19', name: '19', length: 58617616, color: '#FADBD8' },
      { id: '20', name: '20', length: 64444167, color: '#D5DBDB' },
      { id: '21', name: '21', length: 46709983, color: '#FCF3CF' },
      { id: '22', name: '22', length: 50818468, color: '#D6EAF8' },
      { id: 'X', name: 'X', length: 156040895, color: '#E8DAEF' },
      { id: 'Y', name: 'Y', length: 57227415, color: '#FADBD8' },
    ],
    tracks: [],
    selectedChromosome: null,
    zoomLevel: 1,
    viewStart: 0,
    viewEnd: 1000000,
    sidebarCollapsed: false,
  },
  theme: 'light',
  isLoading: false,
};

export function App(): JSX.Element {
  const [appState, setAppState] = useState<AppState>(initialAppState);

  const toggleSidebar = (): void => {
    setAppState(prev => ({
      ...prev,
      genomeViewer: {
        ...prev.genomeViewer,
        sidebarCollapsed: !prev.genomeViewer.sidebarCollapsed,
      },
    }));
  };

  const selectChromosome = (chromosomeId: string): void => {
    setAppState(prev => ({
      ...prev,
      genomeViewer: {
        ...prev.genomeViewer,
        selectedChromosome: chromosomeId,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        onToggleSidebar={toggleSidebar}
        sidebarCollapsed={appState.genomeViewer.sidebarCollapsed}
      />
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar
          chromosomes={appState.genomeViewer.chromosomes}
          selectedChromosome={appState.genomeViewer.selectedChromosome}
          onSelectChromosome={selectChromosome}
          collapsed={appState.genomeViewer.sidebarCollapsed}
        />
        <main className="flex-1 overflow-hidden">
          <GenomeViewer
            chromosomes={appState.genomeViewer.chromosomes}
            selectedChromosome={appState.genomeViewer.selectedChromosome}
            tracks={appState.genomeViewer.tracks}
          />
        </main>
      </div>
    </div>
  );
}
