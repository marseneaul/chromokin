import { type JSX } from 'react';
import { type Chromosome } from '@/types';
import { formatChromosomeName } from '@/lib/utils';
import type { PageType } from '@/state/appState';

interface SidebarProps {
  chromosomes: Chromosome[];
  selectedChromosome: string | null;
  onSelectChromosome: (chromosomeId: string) => void;
  onNavigateToOverview: () => void;
  currentPage: PageType;
  collapsed: boolean;
}

export function Sidebar({
  chromosomes,
  selectedChromosome,
  onSelectChromosome,
  onNavigateToOverview,
  currentPage,
  collapsed,
}: SidebarProps): JSX.Element {
  return (
    <aside
      className={`bg-card border-r border-border transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } flex flex-col`}
    >
      {/* Overview Link */}
      <div className="p-2 border-b border-border">
        <button
          onClick={onNavigateToOverview}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150 ${
            currentPage === 'overview'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'hover:bg-accent text-foreground'
          } ${collapsed ? 'justify-center' : 'justify-start'}`}
          title={collapsed ? 'Genome Overview' : undefined}
        >
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          {!collapsed && <span className="font-medium">Overview</span>}
        </button>
      </div>

      <div className="p-4 border-b border-border">
        {!collapsed && (
          <h2 className="text-lg font-semibold text-foreground">Chromosomes</h2>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {chromosomes.map(chromosome => (
            <button
              key={chromosome.id}
              onClick={() => onSelectChromosome(chromosome.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150 ${
                selectedChromosome === chromosome.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-accent text-foreground'
              } ${collapsed ? 'justify-center' : 'justify-start'}`}
              title={
                collapsed ? formatChromosomeName(chromosome.name) : undefined
              }
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: chromosome.color }}
              />
              {!collapsed && (
                <div className="flex-1 text-left">
                  <div className="font-medium">
                    {formatChromosomeName(chromosome.name)}
                  </div>
                  {chromosome.displayName && (
                    <div className="text-xs font-medium opacity-90 mt-0.5">
                      {chromosome.displayName}
                    </div>
                  )}
                  <div className="text-xs opacity-70">
                    {Math.round(chromosome.length / 1000000)}M bp
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">
            Select a chromosome to view
          </div>
        </div>
      )}
    </aside>
  );
}
