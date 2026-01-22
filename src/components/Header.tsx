import React, { type JSX } from 'react';
import { Menu, Dna, Play, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/search';
import { useViewMode, useAppStore } from '@/state/appState';
import { type ViewMode } from '@/types/core';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

const viewModeIcons: Record<
  ViewMode,
  React.ComponentType<{ className?: string }>
> = {
  play: Play,
  pro: Settings,
};

const viewModeLabels: Record<ViewMode, string> = {
  play: 'Play Mode',
  pro: 'Pro Mode',
};

export function Header({
  onToggleSidebar,
  sidebarCollapsed,
}: HeaderProps): JSX.Element {
  const viewMode = useViewMode();
  const setViewMode = useAppStore(state => state.setViewMode);

  const ViewModeIcon = viewModeIcons[viewMode];

  const cycleViewMode = (): void => {
    const modes: ViewMode[] = ['play', 'pro'];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="hover:bg-accent"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <Dna className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold rainbow-text">ChromoKin</h1>
        </div>
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-md mx-4">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleViewMode}
          className="flex items-center gap-2 hover:bg-accent"
          title={`Current: ${viewModeLabels[viewMode]}`}
        >
          <ViewModeIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{viewModeLabels[viewMode]}</span>
        </Button>

        <div className="text-sm text-muted-foreground hidden md:block">
          Genome Browser
        </div>
      </div>
    </header>
  );
}
