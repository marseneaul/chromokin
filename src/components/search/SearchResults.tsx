/**
 * Search results dropdown with categorized results
 */

import { type JSX } from 'react';
import { cn } from '@/lib/utils';
import { SearchResultItem } from './SearchResultItem';
import type {
  SearchResults as SearchResultsType,
  SearchResult,
} from '@/types/search';

interface SearchResultsProps {
  results: SearchResultsType;
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
}

interface CategorySectionProps {
  title: string;
  results: SearchResult[];
  startIndex: number;
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
}

function CategorySection({
  title,
  results,
  startIndex,
  selectedIndex,
  onSelect,
  onHover,
}: CategorySectionProps): JSX.Element | null {
  if (results.length === 0) return null;

  return (
    <div>
      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
        {title}
      </div>
      {results.map((result, idx) => (
        <SearchResultItem
          key={result.id}
          result={result}
          isSelected={selectedIndex === startIndex + idx}
          onClick={() => onSelect(result)}
          onMouseEnter={() => onHover(startIndex + idx)}
        />
      ))}
    </div>
  );
}

export function SearchResults({
  results,
  selectedIndex,
  onSelect,
  onHover,
}: SearchResultsProps): JSX.Element {
  // Calculate starting indices for each category
  let currentIndex = 0;
  const geneStartIndex = currentIndex;
  currentIndex += results.genes.length;
  const snpStartIndex = currentIndex;
  currentIndex += results.snps.length;
  const traitStartIndex = currentIndex;
  currentIndex += results.traits.length;
  const featureStartIndex = currentIndex;
  currentIndex += results.features.length;
  const cytobandStartIndex = currentIndex;

  const hasResults = results.totalCount > 0;

  return (
    <div
      className={cn(
        'absolute top-full left-0 right-0 mt-1',
        'max-h-80 overflow-auto',
        'border rounded-md bg-background shadow-lg',
        'z-50'
      )}
    >
      {hasResults ? (
        <>
          <CategorySection
            title="Genes"
            results={results.genes}
            startIndex={geneStartIndex}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            onHover={onHover}
          />
          <CategorySection
            title="SNPs"
            results={results.snps}
            startIndex={snpStartIndex}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            onHover={onHover}
          />
          <CategorySection
            title="Traits"
            results={results.traits}
            startIndex={traitStartIndex}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            onHover={onHover}
          />
          <CategorySection
            title="Features"
            results={results.features}
            startIndex={featureStartIndex}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            onHover={onHover}
          />
          <CategorySection
            title="Cytobands"
            results={results.cytobands}
            startIndex={cytobandStartIndex}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            onHover={onHover}
          />
        </>
      ) : (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
          No results found
        </div>
      )}
    </div>
  );
}
