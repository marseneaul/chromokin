/**
 * GenomeOverview - Dashboard view of user's genome
 * Shows stats, ancestry, traits, and entry points to browser
 */

import { type JSX, useEffect, useMemo } from 'react';
import { useAppStore, useCopyLevel } from '@/state/appState';
import { CHROMOSOME_LENGTHS } from '@/types/core';
import { getAncestryComposition } from '@/data/ancestryLoader';
import { getTraitsDatabase, getDatabaseMetadata } from '@/data/traitsLoader';
import { getGenomicFeaturesDatabase } from '@/data/genomicFeaturesLoader';
import type { AncestryComposition } from '@/types/genome';
import type { EnhancedTraitRecord } from '@/types/traits';

// Ancestry colors by category
const ANCESTRY_COLORS: Record<string, string> = {
  european: '#4B7BEC',
  african: '#F7B731',
  asian: '#26DE81',
  american: '#FC5C65',
  oceanian: '#A55EEA',
  archaic: '#778CA3',
};

interface GenomeOverviewProps {
  onNavigateToChromosome: (chromosome: string) => void;
}

export function GenomeOverview({
  onNavigateToChromosome,
}: GenomeOverviewProps): JSX.Element {
  const copyLevel = useCopyLevel();
  const loadTraits = useAppStore(state => state.loadTraits);
  const loadGenomicFeatures = useAppStore(state => state.loadGenomicFeatures);
  const traitsLoaded = useAppStore(state => state.traitsLoaded);
  const genomicFeaturesLoaded = useAppStore(
    state => state.genomicFeaturesLoaded
  );

  // Load data on mount
  useEffect(() => {
    if (!traitsLoaded) loadTraits();
    if (!genomicFeaturesLoaded) loadGenomicFeatures();
  }, [traitsLoaded, genomicFeaturesLoaded, loadTraits, loadGenomicFeatures]);

  // Get data
  const composition = useMemo(() => getAncestryComposition(), []);
  const traitsDb = useMemo(() => getTraitsDatabase(), []);
  const featuresDb = useMemo(() => getGenomicFeaturesDatabase(), []);
  const dbMeta = useMemo(() => getDatabaseMetadata(), []);

  // Calculate stats
  const stats = useMemo(() => {
    const totalTraits = traitsDb.traits.size;
    const totalGenes = dbMeta.geneCount;
    const totalFeatures = featuresDb.features.size;

    // Count archaic regions
    let archaicCount = 0;
    for (const feature of featuresDb.features.values()) {
      if (
        feature.type === 'neanderthal' ||
        feature.type === 'denisovan' ||
        feature.type === 'archaic'
      ) {
        archaicCount++;
      }
    }

    return {
      totalTraits,
      totalGenes,
      totalFeatures,
      archaicCount,
    };
  }, [traitsDb, featuresDb, dbMeta]);

  // Get featured traits (fun ones for the overview)
  const featuredTraits = useMemo(() => {
    const featured: EnhancedTraitRecord[] = [];
    const funTraitIds = [
      'eye_color',
      'caffeine',
      'cilantro',
      'bitter_taste',
      'lactose',
      'muscle_type',
      'earwax',
    ];

    for (const id of funTraitIds) {
      const trait = traitsDb.traits.get(id);
      if (trait) featured.push(trait);
    }

    return featured;
  }, [traitsDb]);

  // Calculate Neanderthal percentage from archaic composition
  const neanderthalPercent = useMemo(() => {
    const archaic = composition.find(c => c.category === 'archaic');
    return archaic?.percentage || 2.1; // Default for demo
  }, [composition]);

  const bgClass = 'bg-gray-50';

  return (
    <div className={`h-full overflow-y-auto ${bgClass}`}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Hero Section */}
        <HeroSection
          stats={stats}
          neanderthalPercent={neanderthalPercent}
          copyLevel={copyLevel}
        />

        {/* Ancestry Section */}
        <AncestrySection composition={composition} copyLevel={copyLevel} />

        {/* Traits Section */}
        <TraitsSection
          traits={featuredTraits}
          copyLevel={copyLevel}
          onNavigateToChromosome={onNavigateToChromosome}
        />

        {/* Chromosome Gallery */}
        <ChromosomeGallery onSelectChromosome={onNavigateToChromosome} />

        {/* Fun Facts */}
        <FunFactsSection copyLevel={copyLevel} />
      </div>
    </div>
  );
}

// Hero Section Component
interface HeroSectionProps {
  stats: {
    totalTraits: number;
    totalGenes: number;
    totalFeatures: number;
    archaicCount: number;
  };
  neanderthalPercent: number;
  copyLevel: number;
}

function HeroSection({
  stats,
  neanderthalPercent,
  copyLevel,
}: HeroSectionProps): JSX.Element {
  const textClass = 'text-gray-900';
  const subtextClass = 'text-gray-600';

  const heroTitle = copyLevel <= 5 ? 'Your Genome' : 'Genome Overview';

  return (
    <div className="text-center mb-8">
      <h1 className={`text-3xl font-bold mb-2 ${textClass}`}>{heroTitle}</h1>
      <p className={`text-lg ${subtextClass}`}>
        {copyLevel <= 5
          ? 'Explore the unique code that makes you, you'
          : 'Summary of your genetic data and annotations'}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatCard
          value={stats.totalGenes.toLocaleString()}
          label={copyLevel <= 5 ? 'Genes Mapped' : 'Annotated Genes'}
        />
        <StatCard
          value={stats.totalTraits.toLocaleString()}
          label={copyLevel <= 5 ? 'Fun Traits' : 'Trait Associations'}
        />
        <StatCard
          value={`${neanderthalPercent.toFixed(1)}%`}
          label={copyLevel <= 5 ? 'Ancient DNA' : 'Archaic Ancestry'}
        />
        <StatCard
          value={stats.archaicCount.toLocaleString()}
          label={copyLevel <= 5 ? 'Special Regions' : 'Genomic Features'}
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  value: string;
  label: string;
}

function StatCard({ value, label }: StatCardProps): JSX.Element {
  const cardClass = 'bg-white border-gray-200 shadow-sm';
  const valueClass = 'text-blue-600';
  const labelClass = 'text-gray-600';

  return (
    <div className={`p-4 rounded-lg border ${cardClass}`}>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className={`text-sm ${labelClass}`}>{label}</div>
    </div>
  );
}

// Ancestry Section Component
interface AncestrySectionProps {
  composition: AncestryComposition[];
  copyLevel: number;
}

function AncestrySection({
  composition,
  copyLevel,
}: AncestrySectionProps): JSX.Element {
  const cardClass = 'bg-white border-gray-200 shadow-sm';
  const textClass = 'text-gray-900';
  const subtextClass = 'text-gray-600';

  // Filter out archaic for the main display, sort by percentage
  const mainComposition = composition
    .filter(c => c.category !== 'archaic')
    .sort((a, b) => b.percentage - a.percentage);

  const sectionTitle =
    copyLevel <= 5 ? 'Where You Come From' : 'Ancestry Composition';

  return (
    <div className={`p-6 rounded-lg border ${cardClass}`}>
      <h2 className={`text-xl font-semibold mb-4 ${textClass}`}>
        {sectionTitle}
      </h2>

      <div className="space-y-3">
        {mainComposition.map(comp => (
          <div key={comp.population} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{
                backgroundColor: ANCESTRY_COLORS[comp.category] || '#888',
              }}
            />
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className={textClass}>{comp.displayName}</span>
                <span className={`font-medium ${textClass}`}>
                  {comp.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${comp.percentage}%`,
                    backgroundColor: ANCESTRY_COLORS[comp.category] || '#888',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {copyLevel <= 5 && (
        <p className={`mt-4 text-sm ${subtextClass}`}>
          Your DNA tells a story of where your ancestors traveled over thousands
          of years.
        </p>
      )}
    </div>
  );
}

// Traits Section Component
interface TraitsSectionProps {
  traits: EnhancedTraitRecord[];
  copyLevel: number;
  onNavigateToChromosome: (chromosome: string) => void;
}

function TraitsSection({
  traits,
  copyLevel,
  onNavigateToChromosome,
}: TraitsSectionProps): JSX.Element {
  const cardClass = 'bg-white border-gray-200 shadow-sm';
  const textClass = 'text-gray-900';
  const subtextClass = 'text-gray-600';

  const sectionTitle =
    copyLevel <= 5 ? 'What Makes You, You' : 'Trait Associations';

  // Trait icons mapping
  const traitIcons: Record<string, string> = {
    eye_color: '👁️',
    caffeine: '☕',
    cilantro: '🌿',
    bitter_taste: '😖',
    lactose: '🥛',
    muscle_type: '🏃',
    earwax: '👂',
  };

  return (
    <div className={`p-6 rounded-lg border ${cardClass}`}>
      <h2 className={`text-xl font-semibold mb-4 ${textClass}`}>
        {sectionTitle}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {traits.map(trait => {
          const chromosome = trait.genes[0]?.chromosome || '1';
          return (
            <button
              key={trait.id}
              onClick={() => onNavigateToChromosome(chromosome)}
              className="p-3 rounded-lg border text-left transition-all hover:scale-105 bg-gray-50 border-gray-200 hover:bg-gray-100"
            >
              <div className="text-2xl mb-1">
                {traitIcons[trait.id] || '🧬'}
              </div>
              <div className={`font-medium text-sm ${textClass}`}>
                {trait.name}
              </div>
              <div className={`text-xs ${subtextClass}`}>chr{chromosome}</div>
            </button>
          );
        })}
      </div>

      {copyLevel <= 5 && (
        <p className={`mt-4 text-sm ${subtextClass}`}>
          Click any trait to explore the genes behind it in the genome browser.
        </p>
      )}
    </div>
  );
}

// Chromosome Gallery Component
interface ChromosomeGalleryProps {
  onSelectChromosome: (chromosome: string) => void;
}

function ChromosomeGallery({
  onSelectChromosome,
}: ChromosomeGalleryProps): JSX.Element {
  const cardClass = 'bg-white border-gray-200 shadow-sm';
  const textClass = 'text-gray-900';
  const subtextClass = 'text-gray-600';

  // Get max length for scaling
  const maxLength = Math.max(...Object.values(CHROMOSOME_LENGTHS));

  // Chromosomes in order
  const chromosomes = Object.keys(CHROMOSOME_LENGTHS).filter(c => c !== 'MT');

  return (
    <div className={`p-6 rounded-lg border ${cardClass}`}>
      <h2 className={`text-xl font-semibold mb-4 ${textClass}`}>
        Explore Your Chromosomes
      </h2>

      <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
        {chromosomes.map(chr => {
          const length =
            CHROMOSOME_LENGTHS[chr as keyof typeof CHROMOSOME_LENGTHS];
          const heightPercent = (length / maxLength) * 100;
          const minHeight = 30;
          const maxHeight = 60;
          const height =
            minHeight + (heightPercent / 100) * (maxHeight - minHeight);

          return (
            <button
              key={chr}
              onClick={() => onSelectChromosome(chr)}
              className="flex flex-col items-center p-1 rounded transition-all hover:scale-110 hover:bg-gray-100"
              title={`Chromosome ${chr} - ${(length / 1_000_000).toFixed(0)} Mb`}
            >
              <div
                className="w-4 rounded-full bg-gradient-to-b from-blue-400 to-blue-600"
                style={{ height: `${height}px` }}
              />
              <span className={`text-xs mt-1 ${subtextClass}`}>{chr}</span>
            </button>
          );
        })}
      </div>

      <p className={`mt-4 text-sm text-center ${subtextClass}`}>
        Click any chromosome to explore it in detail
      </p>
    </div>
  );
}

// Fun Facts Section Component
interface FunFactsSectionProps {
  copyLevel: number;
}

function FunFactsSection({ copyLevel }: FunFactsSectionProps): JSX.Element {
  const cardClass = 'bg-white border-gray-200 shadow-sm';
  const textClass = 'text-gray-900';
  const subtextClass = 'text-gray-600';
  const valueClass = 'text-blue-600';

  const facts = [
    {
      value: '3 billion',
      label:
        copyLevel <= 5 ? 'Base pairs in your DNA' : 'Base pairs (nucleotides)',
      detail: copyLevel <= 5 ? 'Would stretch 6 feet if uncoiled!' : null,
    },
    {
      value: '99.9%',
      label: copyLevel <= 5 ? 'Identical to all humans' : 'Sequence similarity',
      detail: copyLevel <= 5 ? "We're all more alike than different" : null,
    },
    {
      value: '~20,000',
      label: copyLevel <= 5 ? 'Genes in your DNA' : 'Protein-coding genes',
      detail: copyLevel <= 5 ? 'Fewer than a grape!' : null,
    },
    {
      value: '23',
      label: copyLevel <= 5 ? 'Chromosome pairs' : 'Chromosome pairs (diploid)',
      detail: copyLevel <= 5 ? 'Half from mom, half from dad' : null,
    },
    {
      value: '50%',
      label: 'From each parent',
      detail: null,
    },
    {
      value: '~2%',
      label: copyLevel <= 5 ? 'Neanderthal DNA (avg)' : 'Avg archaic admixture',
      detail: copyLevel <= 5 ? 'Ancient relatives live on in us' : null,
    },
  ];

  const sectionTitle =
    copyLevel <= 5 ? 'Your Genome by Numbers' : 'Genomic Statistics';

  return (
    <div className={`p-6 rounded-lg border ${cardClass}`}>
      <h2 className={`text-xl font-semibold mb-4 ${textClass}`}>
        {sectionTitle}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {facts.map((fact, i) => (
          <div key={i} className="text-center">
            <div className={`text-2xl font-bold ${valueClass}`}>
              {fact.value}
            </div>
            <div className={`text-sm ${subtextClass}`}>{fact.label}</div>
            {fact.detail && (
              <div className={`text-xs mt-1 italic ${subtextClass}`}>
                {fact.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
