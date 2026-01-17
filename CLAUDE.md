# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production (runs tsc + vite build)
npm run type-check   # TypeScript type checking only
npm run lint         # ESLint with zero warnings tolerance
npm run lint:fix     # Auto-fix ESLint errors
npm run format       # Format with Prettier
npm run format:check # Check formatting without changing
```

## Architecture

ChromoKin is a browser-only TypeScript genome browser for visualizing human chromosomes. It uses React 19 with Vite and has no server-side dependencies.

### State Management (Two Systems)

1. **Zustand Store** (`src/state/appState.ts`): Primary React state for UI
   - Manages view mode (play/explorer/pro), active chromosome, zoom states, side panel
   - Uses `subscribeWithSelector` middleware for selective subscriptions
   - Export individual selector hooks (e.g., `useActiveChromosome`, `useSidePanel`) to prevent unnecessary re-renders

2. **Observer/Listener Pattern** (`src/store.ts`): Coordinate-based state for tracks
   - `Store` class implements Observer pattern for zoom/scroll operations
   - `CoordinateStore` singleton factory manages named store instances
   - `Listener` interface for components that react to coordinate changes

### Genome Domain Model (`src/genome/`)

- `GenomeRegion`: Base class for genomic intervals with intersection/union operations
- `Chromosome` extends `GenomeRegion`: Named chromosome with local coordinates
- `Genome`: Collection of chromosomes with contig map and cytobands
- `Cytoband`: Chromosome banding pattern visualization data

### Core Types (`src/types/core.ts`)

- `ViewMode`: 'play' | 'explorer' | 'pro' - three user experience levels
- `CopyLevel`: 3-8 grade reading levels for kid-friendly content
- `TrackSpec`: Configuration for visualization tracks (genes, variants, traits)
- `CHROMOSOME_LENGTHS` / `CHROMOSOME_NAMES`: GRCh38 reference data

### Scale System (`src/scales/scale.ts`)

Linear scale class for domain-to-range mapping (similar to d3-scale) with `scale()` and `inverse()` methods.

## Code Conventions

- Path alias: `@/*` maps to `./src/*`
- Unused variables: Prefix with underscore (e.g., `_unused`) to satisfy ESLint
- TypeScript: Strict mode with `exactOptionalPropertyTypes` enabled
- Pre-commit hooks via Husky run ESLint and Prettier on staged files
