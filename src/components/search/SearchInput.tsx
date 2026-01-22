/**
 * Search input component with icon and clear button
 */

import React, { forwardRef, type JSX } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  isSearching?: boolean;
  placeholder?: string;
  className?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
      onClear,
      isSearching = false,
      placeholder = 'Search genes, SNPs, traits...',
      className,
    },
    ref
  ): JSX.Element => {
    return (
      <div className={cn('relative', className)}>
        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>

        {/* Input */}
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full h-9 pl-9 pr-8',
            'rounded-md border border-input bg-background',
            'text-sm placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'transition-colors'
          )}
          aria-label="Search"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2',
              'p-0.5 rounded-sm',
              'text-muted-foreground hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
