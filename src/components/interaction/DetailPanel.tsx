/**
 * DetailPanel - Detailed information panel on click
 * Varies display style by ViewMode
 */

import { type JSX, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  ExternalLink,
  Dna,
  Sparkles,
  Info,
  Bug,
  Skull,
  Repeat,
  Zap,
  Brain,
  Users,
  Map,
} from 'lucide-react';
import {
  useDetailPanelOpen,
  useSelectedGeneId,
  useSelectedTraitId,
  useSelectedFeatureId,
  useCloseDetailPanel,
  useCopyLevel,
  useViewMode,
  useTraitsDatabase,
  useGenomicFeaturesDatabase,
} from '@/state/appState';
import {
  getContentForLevel,
  formatPosition,
  getGeneDisplayName,
  getViewModeSettings,
} from '@/lib/content';
import { getTraitsForGene } from '@/data/traitsLoader';
import { Button } from '@/components/ui/button';
import type { GenomicFeature } from '@/types/genomicFeatures';

export function DetailPanel(): JSX.Element | null {
  const isOpen = useDetailPanelOpen();
  const selectedGeneId = useSelectedGeneId();
  const selectedTraitId = useSelectedTraitId();
  const selectedFeatureId = useSelectedFeatureId();
  const closePanel = useCloseDetailPanel();
  const copyLevel = useCopyLevel();
  const viewMode = useViewMode();
  const traitsDatabase = useTraitsDatabase();
  const genomicFeaturesDatabase = useGenomicFeaturesDatabase();

  const settings = getViewModeSettings(viewMode);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  // Get content for panel
  const content = useMemo(() => {
    if (selectedGeneId && traitsDatabase) {
      const gene = traitsDatabase.genes.get(selectedGeneId);
      if (!gene) return null;

      const traits = getTraitsForGene(selectedGeneId);
      const displayName = getGeneDisplayName(
        gene.symbol,
        gene.nickname,
        viewMode
      );

      return {
        type: 'gene' as const,
        gene,
        traits,
        displayName,
      };
    }

    if (selectedTraitId && traitsDatabase) {
      const trait = traitsDatabase.traits.get(selectedTraitId);
      if (!trait) return null;

      // Get genes for this trait
      const genes = trait.genes
        .map(g => traitsDatabase.genes.get(g.geneId))
        .filter(Boolean);

      return {
        type: 'trait' as const,
        trait,
        genes,
      };
    }

    if (selectedFeatureId && genomicFeaturesDatabase) {
      const feature = genomicFeaturesDatabase.features.get(selectedFeatureId);
      if (!feature) return null;

      const displayName =
        viewMode === 'play' && feature.nickname
          ? feature.nickname
          : feature.name;

      return {
        type: 'feature' as const,
        feature,
        displayName,
      };
    }

    return null;
  }, [
    selectedGeneId,
    selectedTraitId,
    selectedFeatureId,
    traitsDatabase,
    genomicFeaturesDatabase,
    viewMode,
  ]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closePanel();
      }
    },
    [closePanel]
  );

  if (!isOpen || !content) {
    return null;
  }

  // Play mode: Full-screen modal
  if (settings.panelStyle === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
          <PlayModeContent
            content={content}
            copyLevel={copyLevel}
            onClose={closePanel}
          />
        </div>
      </div>
    );
  }

  // Explorer/Pro mode: Slide-out panel
  return (
    <div
      className={`
        fixed top-16 right-0 bottom-0 z-40
        ${settings.panelStyle === 'compact' ? 'w-80' : 'w-96'}
        bg-white border-l shadow-lg
        transform transition-transform duration-200
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
    >
      <SlideoutContent
        content={content}
        copyLevel={copyLevel}
        viewMode={viewMode}
        onClose={closePanel}
      />
    </div>
  );
}

// Play mode content - friendly and illustrated
function PlayModeContent({
  content,
  copyLevel,
  onClose,
}: {
  content: NonNullable<ReturnType<typeof getContent>>;
  copyLevel: number;
  onClose: () => void;
}) {
  if (content.type === 'gene') {
    const { gene, traits, displayName } = content;

    return (
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: gene.color || '#3b82f6' }}
            >
              <Dna className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
              <p className="text-sm text-gray-500">{gene.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <p className="text-gray-700 text-lg leading-relaxed mb-6">
          {getContentForLevel(
            gene.shortDescription,
            copyLevel as 3 | 4 | 5 | 6 | 7 | 8
          )}
        </p>

        {traits.length > 0 && (
          <div className="bg-green-50 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Connected Traits
            </h3>
            <div className="space-y-2">
              {traits.map(trait => (
                <div
                  key={trait.id}
                  className="bg-white rounded-lg p-3 border border-green-100"
                >
                  <h4 className="font-medium text-gray-900">{trait.name}</h4>
                  <p className="text-sm text-gray-600">
                    {getContentForLevel(
                      trait.shortDescription,
                      copyLevel as 3 | 4 | 5 | 6 | 7 | 8
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Fun Fact
          </h3>
          <p className="text-blue-700">
            This gene is found on chromosome {gene.chromosome}!
          </p>
        </div>
      </div>
    );
  }

  if (content.type === 'feature') {
    const { feature, displayName } = content;
    const FeatureIcon = getFeatureIcon(feature.type);

    return (
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: feature.color }}
            >
              <FeatureIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
              <p className="text-sm text-gray-500">
                {getFeatureTypeLabel(feature.type)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <p className="text-gray-700 text-lg leading-relaxed mb-6">
          {getContentForLevel(
            feature.shortDescription,
            copyLevel as 3 | 4 | 5 | 6 | 7 | 8
          )}
        </p>

        {feature.funFact && (
          <div className="bg-amber-50 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Fun Fact
            </h3>
            <p className="text-amber-700">
              {getContentForLevel(
                feature.funFact,
                copyLevel as 3 | 4 | 5 | 6 | 7 | 8
              )}
            </p>
          </div>
        )}

        {feature.isActive && (
          <div className="bg-orange-50 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Still Active!
            </h3>
            <p className="text-orange-700">
              This element can still move around in the genome today!
            </p>
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            About This Type
          </h3>
          <p className="text-gray-700">
            Found on chromosome {feature.chromosome}
            {feature.ageEstimate &&
              ` - approximately ${feature.ageEstimate} old`}
            .
          </p>
        </div>
      </div>
    );
  }

  // Trait content for play mode
  const { trait, genes } = content;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: getCategoryColor(trait.category) }}
          >
            {trait.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{trait.name}</h2>
            <p className="text-sm text-gray-500 capitalize">
              {trait.category} trait
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <p className="text-gray-700 text-lg leading-relaxed mb-6">
        {getContentForLevel(
          trait.longDescription,
          copyLevel as 3 | 4 | 5 | 6 | 7 | 8
        )}
      </p>

      <div className="bg-amber-50 rounded-xl p-4 mb-4">
        <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Fun Fact
        </h3>
        <p className="text-amber-700">
          {getContentForLevel(
            trait.funFact,
            copyLevel as 3 | 4 | 5 | 6 | 7 | 8
          )}
        </p>
      </div>

      {genes.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Dna className="w-4 h-4" />
            Genes Involved
          </h3>
          <div className="flex flex-wrap gap-2">
            {genes.map(gene => (
              <span
                key={gene?.id}
                className="bg-white px-3 py-1 rounded-full text-sm border border-blue-100"
              >
                {gene?.nickname || gene?.symbol}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Slideout content for Explorer/Pro modes
function SlideoutContent({
  content,
  copyLevel,
  viewMode,
  onClose,
}: {
  content: NonNullable<ReturnType<typeof getContent>>;
  copyLevel: number;
  viewMode: 'play' | 'explorer' | 'pro';
  onClose: () => void;
}) {
  const isPro = viewMode === 'pro';

  if (content.type === 'gene') {
    const { gene, traits, displayName } = content;

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{ backgroundColor: gene.color || '#3b82f6' }}
            >
              <Dna className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`font-semibold ${isPro ? 'font-mono' : ''}`}>
                {isPro ? gene.symbol : displayName}
              </h2>
              {!isPro && gene.nickname && (
                <p className="text-xs text-gray-500">{gene.symbol}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              Description
            </h3>
            <p className={`text-sm ${isPro ? 'font-mono text-xs' : ''}`}>
              {getContentForLevel(
                gene.shortDescription,
                copyLevel as 3 | 4 | 5 | 6 | 7 | 8
              )}
            </p>
          </div>

          {/* Coordinates */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Location</h3>
            <p className={`text-sm ${isPro ? 'font-mono text-xs' : ''}`}>
              chr{gene.chromosome}:{formatPosition(gene.start, viewMode)}-
              {formatPosition(gene.end, viewMode)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Strand: {gene.strand === '+' ? 'Forward (+)' : 'Reverse (-)'}
            </p>
          </div>

          {/* Associated traits */}
          {traits.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Associated Traits
              </h3>
              <div className="space-y-2">
                {traits.map(trait => (
                  <div
                    key={trait.id}
                    className="bg-gray-50 rounded p-2 text-sm"
                  >
                    <span className="font-medium">{trait.name}</span>
                    <span className="text-gray-500 ml-2 capitalize">
                      ({trait.category})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* External links (Pro mode) */}
          {isPro && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                External Resources
              </h3>
              <div className="space-y-1">
                <a
                  href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Ensembl <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene.symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  GeneCards <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (content.type === 'feature') {
    const { feature, displayName } = content;
    const FeatureIcon = getFeatureIcon(feature.type);

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{ backgroundColor: feature.color }}
            >
              <FeatureIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`font-semibold ${isPro ? 'font-mono' : ''}`}>
                {isPro ? feature.name : displayName}
              </h2>
              <p className="text-xs text-gray-500">
                {getFeatureTypeLabel(feature.type)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              Description
            </h3>
            <p className={`text-sm ${isPro ? 'font-mono text-xs' : ''}`}>
              {getContentForLevel(
                feature.shortDescription,
                copyLevel as 3 | 4 | 5 | 6 | 7 | 8
              )}
            </p>
          </div>

          {/* Coordinates */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Location</h3>
            <p className={`text-sm ${isPro ? 'font-mono text-xs' : ''}`}>
              chr{feature.chromosome}:{formatPosition(feature.start, viewMode)}-
              {formatPosition(feature.end, viewMode)}
            </p>
            {feature.strand && feature.strand !== '.' && (
              <p className="text-xs text-gray-400 mt-1">
                Strand: {feature.strand === '+' ? 'Forward (+)' : 'Reverse (-)'}
              </p>
            )}
          </div>

          {/* Age estimate */}
          {feature.ageEstimate && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Age</h3>
              <p className="text-sm">{feature.ageEstimate}</p>
            </div>
          )}

          {/* Active status */}
          {feature.isActive && (
            <div className="bg-orange-50 rounded p-3">
              <p className="text-sm font-medium text-orange-800">
                This element is still active in the genome!
              </p>
            </div>
          )}

          {/* Fun fact */}
          {feature.funFact && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">
                Fun Fact
              </h3>
              <p className={`text-sm ${isPro ? 'text-xs' : ''}`}>
                {getContentForLevel(
                  feature.funFact,
                  copyLevel as 3 | 4 | 5 | 6 | 7 | 8
                )}
              </p>
            </div>
          )}

          {/* Known function */}
          {feature.functionKnown && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">
                Known Function
              </h3>
              <p className="text-sm">{feature.functionKnown}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Trait content for slideout
  const { trait, genes } = content;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: getCategoryColor(trait.category) }}
          >
            {trait.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold">{trait.name}</h2>
            <p className="text-xs text-gray-500 capitalize">{trait.category}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Description */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Description
          </h3>
          <p className={`text-sm ${isPro ? 'text-xs' : ''}`}>
            {getContentForLevel(
              trait.longDescription,
              copyLevel as 3 | 4 | 5 | 6 | 7 | 8
            )}
          </p>
        </div>

        {/* Fun Fact */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Fun Fact</h3>
          <p className={`text-sm ${isPro ? 'text-xs' : ''}`}>
            {getContentForLevel(
              trait.funFact,
              copyLevel as 3 | 4 | 5 | 6 | 7 | 8
            )}
          </p>
        </div>

        {/* Inheritance */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Inheritance
          </h3>
          <p className="text-sm">
            <span className="capitalize font-medium">
              {trait.inheritancePattern}
            </span>
            {' - '}
            {getContentForLevel(
              trait.inheritanceExplanation,
              copyLevel as 3 | 4 | 5 | 6 | 7 | 8
            )}
          </p>
        </div>

        {/* Associated genes */}
        {genes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Associated Genes
            </h3>
            <div className="space-y-2">
              {genes.map(gene => (
                <div key={gene?.id} className="bg-gray-50 rounded p-2 text-sm">
                  <span className="font-medium">
                    {isPro ? gene?.symbol : gene?.nickname || gene?.symbol}
                  </span>
                  {isPro && (
                    <span className="text-gray-500 text-xs ml-2">
                      chr{gene?.chromosome}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Variants (Pro mode) */}
        {isPro && trait.variants.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Key Variants
            </h3>
            <div className="space-y-2">
              {trait.variants.map(variant => (
                <div
                  key={variant.variantId}
                  className="bg-gray-50 rounded p-2 text-xs font-mono"
                >
                  <div className="font-medium">{variant.rsId}</div>
                  <div className="text-gray-500">
                    chr{variant.chromosome}:{variant.position}
                  </div>
                  <div className="text-gray-600 mt-1">{variant.effect}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to get content type
type GeneContent = {
  type: 'gene';
  gene: NonNullable<ReturnType<TraitsDatabase['genes']['get']>>;
  traits: ReturnType<typeof getTraitsForGene>;
  displayName: string;
};

type TraitContent = {
  type: 'trait';
  trait: NonNullable<ReturnType<TraitsDatabase['traits']['get']>>;
  genes: (ReturnType<TraitsDatabase['genes']['get']> | undefined)[];
};

type FeatureContent = {
  type: 'feature';
  feature: GenomicFeature;
  displayName: string;
};

type ContentType = GeneContent | TraitContent | FeatureContent;

function getContent(): ContentType | null {
  return null; // Type helper only
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    physical: '#3b82f6',
    sensory: '#8b5cf6',
    health: '#10b981',
    fun: '#f59e0b',
  };
  return colors[category] || '#6b7280';
}

function getFeatureTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    herv: 'Ancient Virus DNA',
    line: 'Jumping Gene (LINE)',
    sine: 'Alu Element',
    pseudogene: 'Fossil Gene',
    dna_transposon: 'Cut-and-Paste Gene',
    satellite: 'Repetitive DNA',
    segmental_duplication: 'Duplicated Region',
    numt: 'Mitochondrial Ghost',
    har: 'Human Accelerated Region',
    neanderthal: 'Neanderthal DNA',
    gene_desert: 'Gene Desert',
  };
  return labels[type] || type;
}

function getFeatureIcon(type: string) {
  const icons: Record<string, typeof Bug> = {
    herv: Bug,
    line: Repeat,
    sine: Repeat,
    pseudogene: Skull,
    dna_transposon: Repeat,
    satellite: Repeat,
    segmental_duplication: Repeat,
    numt: Zap,
    har: Brain,
    neanderthal: Users,
    gene_desert: Map,
  };
  return icons[type] || Info;
}

// Type import for the TraitsDatabase
type TraitsDatabase = NonNullable<ReturnType<typeof useTraitsDatabase>>;
