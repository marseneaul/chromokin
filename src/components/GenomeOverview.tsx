/**
 * GenomeOverview - Dashboard view of user's genome
 * Shows stats, ancestry, traits, and entry points to browser
 */

import { type JSX, useEffect, useMemo } from 'react';
import {
  useAppStore,
  useCopyLevel,
  useUserAncestryData,
} from '@/state/appState';
import { CHROMOSOME_LENGTHS } from '@/types/core';
import {
  getAncestryComposition,
  hasUserAncestryData,
} from '@/data/ancestryLoader';
import { getTraitsDatabase, getDatabaseMetadata } from '@/data/traitsLoader';
import { getGenomicFeaturesDatabase } from '@/data/genomicFeaturesLoader';
import { AncestryUpload } from '@/components/ancestry';
import type { AncestryComposition } from '@/types/genome';
import type { EnhancedTraitRecord } from '@/types/traits';

// Refined ancestry colors (includes both demo and inference categories)
const ANCESTRY_COLORS: Record<string, string> = {
  european: '#3b82f6',
  african: '#f59e0b',
  asian: '#10b981',
  east_asian: '#10b981',
  south_asian: '#14b8a6',
  american: '#ef4444',
  native_american: '#ef4444',
  oceanian: '#8b5cf6',
  archaic: '#64748b',
};

// Trait category colors for visual indicators
const TRAIT_COLORS: Record<string, string> = {
  eye_color: '#3b82f6',
  caffeine: '#78350f',
  cilantro: '#16a34a',
  bitter_taste: '#dc2626',
  lactose: '#0ea5e9',
  muscle_type: '#7c3aed',
  earwax: '#d97706',
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

  // User ancestry data (reactive)
  const userAncestryData = useUserAncestryData();

  // Load data on mount
  useEffect(() => {
    if (!traitsLoaded) loadTraits();
    if (!genomicFeaturesLoaded) loadGenomicFeatures();
  }, [traitsLoaded, genomicFeaturesLoaded, loadTraits, loadGenomicFeatures]);

  // Get data - composition is reactive to user data changes
  const composition = useMemo(
    () => getAncestryComposition(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userAncestryData]
  );
  const hasUserData = hasUserAncestryData();
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

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        {/* Header */}
        <header className="mb-2">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            {copyLevel <= 5 ? 'Your Genome' : 'Genome Overview'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {copyLevel <= 5
              ? 'Explore the unique code that makes you, you'
              : 'Summary of your genetic data and annotations'}
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            value={stats.totalGenes.toLocaleString()}
            label={copyLevel <= 5 ? 'Genes Mapped' : 'Annotated Genes'}
            color="#3b82f6"
          />
          <StatCard
            value={stats.totalTraits.toLocaleString()}
            label={copyLevel <= 5 ? 'Traits Analyzed' : 'Trait Associations'}
            color="#10b981"
          />
          <StatCard
            value={`${neanderthalPercent.toFixed(1)}%`}
            label={copyLevel <= 5 ? 'Ancient DNA' : 'Archaic Ancestry'}
            color="#8b5cf6"
          />
          <StatCard
            value={stats.totalFeatures.toLocaleString()}
            label={copyLevel <= 5 ? 'Genomic Features' : 'Structural Features'}
            color="#f59e0b"
          />
        </div>

        {/* Two-column layout for Ancestry and Traits */}
        <div className="grid lg:grid-cols-2 gap-5">
          <AncestrySection
            composition={composition}
            copyLevel={copyLevel}
            hasUserData={hasUserData}
            userAncestryData={userAncestryData}
          />
          <TraitsSection
            traits={featuredTraits}
            copyLevel={copyLevel}
            onNavigateToChromosome={onNavigateToChromosome}
          />
        </div>

        {/* Chromosome Gallery */}
        <ChromosomeGallery onSelectChromosome={onNavigateToChromosome} />

        {/* Genome Facts */}
        <GenomeFactsSection copyLevel={copyLevel} />
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  value: string;
  label: string;
  color: string;
}

function StatCard({ value, label, color }: StatCardProps): JSX.Element {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-8 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div>
          <div className="text-xl font-semibold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

// Ancestry Section Component
interface AncestrySectionProps {
  composition: AncestryComposition[];
  copyLevel: number;
  hasUserData: boolean;
  userAncestryData: ReturnType<typeof useUserAncestryData>;
}

function AncestrySection({
  composition,
  copyLevel,
  hasUserData,
  userAncestryData,
}: AncestrySectionProps): JSX.Element {
  // Filter out archaic for the main display, sort by percentage
  const mainComposition = composition
    .filter(c => c.category !== 'archaic')
    .sort((a, b) => b.percentage - a.percentage);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm"
      data-tour="ancestry-section"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900">
          {copyLevel <= 5 ? 'Your Ancestry' : 'Ancestry Composition'}
        </h2>
        {hasUserData && (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
            Your Data
          </span>
        )}
        {!hasUserData && (
          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
            Demo
          </span>
        )}
      </div>

      {mainComposition.length > 0 ? (
        <div className="space-y-3">
          {mainComposition.map(comp => (
            <div key={comp.population || comp.category}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700">
                  {comp.displayName}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {comp.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(comp.percentage, 100)}%`,
                    backgroundColor:
                      ANCESTRY_COLORS[comp.category] || '#94a3b8',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 py-2">No ancestry data available</p>
      )}

      {/* User data info */}
      {hasUserData && userAncestryData && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Based on {userAncestryData.markersUsed} ancestry markers from your{' '}
            {userAncestryData.source === '23andme'
              ? '23andMe'
              : userAncestryData.source === 'ancestry'
                ? 'AncestryDNA'
                : ''}{' '}
            data
          </p>
        </div>
      )}

      {/* Upload section when no user data */}
      {!hasUserData && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-3">
            {copyLevel <= 5
              ? 'Upload your DNA file to see your real ancestry'
              : 'Upload raw data from 23andMe or AncestryDNA'}
          </p>
          <AncestryUpload compact />
        </div>
      )}

      {copyLevel <= 5 && !hasUserData && (
        <p className="mt-3 text-xs text-gray-400">
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
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm"
      data-tour="traits-section"
    >
      <h2 className="text-sm font-medium text-gray-900 mb-4">
        {copyLevel <= 5 ? 'Your Traits' : 'Trait Associations'}
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {traits.map(trait => {
          const chromosome = trait.genes[0]?.chromosome || '1';
          const color = TRAIT_COLORS[trait.id] || '#6b7280';

          return (
            <button
              key={trait.id}
              onClick={() => onNavigateToChromosome(chromosome)}
              className="flex items-center gap-3 p-2.5 rounded-md text-left transition-colors hover:bg-gray-50 group"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-700 group-hover:text-gray-900 truncate">
                  {trait.name}
                </div>
                <div className="text-xs text-gray-400">chr{chromosome}</div>
              </div>
            </button>
          );
        })}
      </div>

      {copyLevel <= 5 && (
        <p className="mt-4 text-xs text-gray-400">
          Click any trait to explore the genes behind it.
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
  // Get max length for scaling
  const maxLength = Math.max(...Object.values(CHROMOSOME_LENGTHS));

  // Chromosomes in order (exclude mitochondrial)
  const chromosomes = Object.keys(CHROMOSOME_LENGTHS).filter(c => c !== 'MT');

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm"
      data-tour="chromosome-gallery"
    >
      <h2 className="text-sm font-medium text-gray-900 mb-4">
        Chromosome Browser
      </h2>

      <div className="flex items-end justify-between gap-1 h-16">
        {chromosomes.map(chr => {
          const length =
            CHROMOSOME_LENGTHS[chr as keyof typeof CHROMOSOME_LENGTHS];
          const heightPercent = (length / maxLength) * 100;
          const minHeight = 20;
          const maxHeightPx = 56;
          const height =
            minHeight + (heightPercent / 100) * (maxHeightPx - minHeight);

          return (
            <button
              key={chr}
              onClick={() => onSelectChromosome(chr)}
              className="flex-1 flex flex-col items-center group"
              title={`Chromosome ${chr} - ${(length / 1_000_000).toFixed(0)} Mb`}
            >
              <div
                className="w-full max-w-[14px] rounded-sm bg-gradient-to-t from-blue-500 to-blue-400 group-hover:from-blue-600 group-hover:to-blue-500 transition-colors"
                style={{ height: `${height}px` }}
              />
              <span className="text-[9px] text-gray-400 mt-1 group-hover:text-gray-600">
                {chr}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-400 text-center">
        Click any chromosome to explore it in detail
      </p>
    </div>
  );
}

// Genome Facts Section Component
interface GenomeFactsSectionProps {
  copyLevel: number;
}

function GenomeFactsSection({
  copyLevel,
}: GenomeFactsSectionProps): JSX.Element {
  const facts = [
    {
      value: '3B',
      label: copyLevel <= 5 ? 'Base pairs' : 'Nucleotides',
      sublabel: copyLevel <= 5 ? '6 feet if uncoiled' : null,
    },
    {
      value: '99.9%',
      label: copyLevel <= 5 ? 'Shared with all humans' : 'Sequence similarity',
      sublabel: null,
    },
    {
      value: '~20K',
      label: copyLevel <= 5 ? 'Protein-coding genes' : 'Gene count',
      sublabel: copyLevel <= 5 ? 'Fewer than a grape' : null,
    },
    {
      value: '23',
      label: 'Chromosome pairs',
      sublabel: copyLevel <= 5 ? 'Half from each parent' : null,
    },
    {
      value: '~2%',
      label: copyLevel <= 5 ? 'Neanderthal DNA' : 'Archaic admixture',
      sublabel: null,
    },
    {
      value: '8%',
      label: copyLevel <= 5 ? 'Viral DNA' : 'Endogenous retroviruses',
      sublabel: copyLevel <= 5 ? 'Ancient viral remnants' : null,
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-900 mb-4">
        {copyLevel <= 5 ? 'Genome by Numbers' : 'Genomic Statistics'}
      </h2>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        {facts.map((fact, i) => (
          <div key={i} className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {fact.value}
            </div>
            <div className="text-xs text-gray-500">{fact.label}</div>
            {fact.sublabel && (
              <div className="text-[10px] text-gray-400 mt-0.5">
                {fact.sublabel}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
