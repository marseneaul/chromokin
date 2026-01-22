import { type JSX, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { GenomeBrowser } from '@/components/GenomeBrowser';
import { GenomeOverview } from '@/components/GenomeOverview';
import {
  useAppStore,
  useSidePanel,
  useActiveChromosome,
  useCurrentPage,
} from '@/state/appState';
import { useUrlSync } from '@/hooks/useUrlSync';
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

  // Filler names and descriptions for each chromosome
  const chromosomeInfo: Record<
    string,
    { displayName: string; description: string }
  > = {
    '1': {
      displayName: 'The Colossus',
      description:
        'Largest of the human chromosomes, a generalist stuffed with genes for brain development, metabolism, and cancer risk—your broad-shouldered utility player.',
    },
    '2': {
      displayName: 'The Body Blueprint',
      description:
        'Helps lay out the body plan: bones, limbs, and how the body is put together.',
    },
    '3': {
      displayName: 'The Infection Gatekeeper',
      description:
        'Includes switches that affect how some viruses and cancers get into or affect cells.',
    },
    '4': {
      displayName: 'The Choreographer',
      description:
        'Important for brain circuits that control movement and coordination.',
    },
    '5': {
      displayName: 'The Gut Guardian',
      description:
        'Helps keep cells in the intestine behaving, lowering colon cancer risk when working well.',
    },
    '6': {
      displayName: 'The Immune ID Card',
      description:
        'Houses the main “self vs. stranger” ID tags for the immune system (important for transplants and autoimmunity).',
    },
    '7': {
      displayName: 'The Lung and Mucus Manager',
      description:
        'Includes a key gene for salt and water balance in mucus, affecting lungs and digestion (cystic fibrosis).',
    },
    '8': {
      displayName: 'The Cell Accelerator',
      description:
        'Carries powerful growth-control switches that can make cells grow faster—especially in cancers.',
    },
    '9': {
      displayName: 'The Blood Type Controller',
      description:
        'Decides your A, B, AB, or O blood type for transfusions and some disease risks.',
    },
    '10': {
      displayName: 'The Nerve Wiring Guide',
      description:
        'Helps nerves and organs wire up correctly, especially in the gut and kidneys.',
    },
    '11': {
      displayName: 'The Metabolic Manager',
      description:
        'Holds insulin and major hemoglobin genes, key for blood sugar and oxygen transport.',
    },
    '12': {
      displayName: 'The Growth Switch',
      description:
        'Contains a master on/off switch for cell growth that often goes wrong in cancer.',
    },
    '13': {
      displayName: 'The DNA Repair Shop',
      description:
        'Important for fixing broken DNA; when it fails, risks for several cancers go up.',
    },
    '14': {
      displayName: 'The Antibody Factory',
      description:
        'Houses the main toolkit for building new antibodies to fight infections.',
    },
    '15': {
      displayName: 'The Elastic Architect',
      description:
        'Helps build stretchy connective tissue, affecting height, long limbs, and blood vessel strength.',
    },
    '16': {
      displayName: 'The Kidney Keeper',
      description:
        'Key for normal kidney tube structure; when broken, kidneys can fill with fluid-filled cysts.',
    },
    '17': {
      displayName: 'The Genome Guardian',
      description:
        'Home of famous tumor suppressors (like p53) that check damage and tell bad cells to self-destruct.',
    },
    '18': {
      displayName: 'The Growth Referee',
      description:
        'Helps decide when cells should grow, pause, or die—especially in the gut and other organs.',
    },
    '19': {
      displayName: 'The Crowded Metropolis',
      description:
        'Very gene-dense; includes APOE, which helps manage cholesterol and affects Alzheimer’s risk.',
    },
    '20': {
      displayName: 'The Hormone Tuner',
      description:
        'Adjusts how strongly cells respond to hormones and body-wide messenger signals.',
    },
    '21': {
      displayName: 'The Tiny But Mighty',
      description:
        'Smallest autosome; extra copies cause Down syndrome and affect brain development and memory.',
    },
    '22': {
      displayName: 'The Heart and Face Shaper',
      description:
        'Important in early development of the heart, immune system, and parts of the face.',
    },
    X: {
      displayName: 'The Double Trouble: Female Sex Chromosome',
      description:
        'Carries genes for muscle strength, blood clotting, color vision, and brain development.',
    },
    Y: {
      displayName: 'The Boy Switch: Male Sex Chromosome',
      description:
        'Tiny chromosome that flips the early embryo toward typical male development.',
    },
    MT: {
      displayName: 'The Powerhouse',
      description:
        'A small circular genome inside mitochondria that helps power cells by making energy (ATP), mostly inherited from mom.',
    },
  };

  return Object.entries(CHROMOSOME_LENGTHS).map(([id, length], index) => {
    const info = chromosomeInfo[id] || {
      displayName: `Chromosome ${id}`,
      description:
        'This chromosome contains important genetic information that helps your body function.',
    };
    return {
      id,
      name: CHROMOSOME_NAMES[id as keyof typeof CHROMOSOME_NAMES],
      length,
      color: colors[index % colors.length],
      displayName: info.displayName,
      description: info.description,
    };
  });
};

export function App(): JSX.Element {
  // Sync URL with app state for shareable links
  useUrlSync();

  const sidePanel = useSidePanel();
  const activeChromosome = useActiveChromosome();
  const currentPage = useCurrentPage();
  const toggleSidePanel = useAppStore(state => state.toggleSidePanel);
  const setActiveChromosome = useAppStore(state => state.setActiveChromosome);
  const setCurrentPage = useAppStore(state => state.setCurrentPage);

  const chromosomes = useMemo(() => generateChromosomeData(), []);

  // Handle chromosome selection - switches to browser and selects chromosome
  const handleSelectChromosome = useCallback(
    (chromosomeId: string) => {
      setActiveChromosome(chromosomeId);
      setCurrentPage('browser');
    },
    [setActiveChromosome, setCurrentPage]
  );

  // Handle overview navigation
  const handleNavigateToOverview = useCallback(() => {
    setCurrentPage('overview');
  }, [setCurrentPage]);

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
          onSelectChromosome={handleSelectChromosome}
          onNavigateToOverview={handleNavigateToOverview}
          currentPage={currentPage}
          collapsed={!sidePanel.isOpen}
        />
        <main className="flex-1 overflow-hidden">
          {currentPage === 'overview' ? (
            <GenomeOverview onNavigateToChromosome={handleSelectChromosome} />
          ) : (
            <GenomeBrowser className="h-full" />
          )}
        </main>
      </div>
    </div>
  );
}
