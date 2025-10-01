import { type JSX, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { GenomeViewer } from '@/components/GenomeViewer';
import {
  useAppStore,
  useSidePanel,
  useActiveChromosome,
  useConfig,
} from '@/state/appState';
import { CHROMOSOME_LENGTHS, CHROMOSOME_NAMES } from '@/types/core';

// Generate chromosome data from constants
const generateChromosomeData = () => {
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
    '#F8C471',
    '#82E0AA',
    '#F1948A',
    '#85C1E9',
    '#D7BDE2',
    '#F9E79F',
    '#AED6F1',
    '#A9DFBF',
    '#FADBD8',
    '#D5DBDB',
    '#FCF3CF',
    '#D6EAF8',
    '#E8DAEF',
    '#FADBD8',
  ];

  return Object.entries(CHROMOSOME_LENGTHS).map(([id, length], index) => ({
    id,
    name: CHROMOSOME_NAMES[id as keyof typeof CHROMOSOME_NAMES],
    length,
    color: colors[index % colors.length],
  }));
};

export function App(): JSX.Element {
  const sidePanel = useSidePanel();
  const activeChromosome = useActiveChromosome();
  const config = useConfig();
  const toggleSidePanel = useAppStore(state => state.toggleSidePanel);
  const setActiveChromosome = useAppStore(state => state.setActiveChromosome);

  const chromosomes = useMemo(() => generateChromosomeData(), []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        onToggleSidebar={toggleSidePanel}
        sidebarCollapsed={!sidePanel.isOpen}
      />
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar
          chromosomes={chromosomes}
          selectedChromosome={activeChromosome}
          onSelectChromosome={setActiveChromosome}
          collapsed={!sidePanel.isOpen}
        />
        <main className="flex-1 overflow-hidden">
          <GenomeViewer
            chromosomes={chromosomes}
            selectedChromosome={activeChromosome}
            tracks={config.tracks}
          />
        </main>
      </div>
    </div>
  );
}
