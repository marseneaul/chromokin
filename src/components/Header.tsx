import React from 'react';
import { Menu, Dna, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export function Header({ onToggleSidebar, sidebarCollapsed }: HeaderProps): JSX.Element {
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
          <h1 className="text-2xl font-bold rainbow-text">
            ChromoKin
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="hover:bg-accent">
          <Sun className="h-5 w-5" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        
        <div className="text-sm text-muted-foreground">
          Genome Browser
        </div>
      </div>
    </header>
  );
}
