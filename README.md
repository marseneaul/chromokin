# ChromoKin - Genome Browser

A browser-only TypeScript genome browser application built with React, Vite, and Tailwind CSS.

## Features

- 🧬 Interactive chromosome visualization
- 🎨 Modern, kid-friendly UI design
- 📱 Responsive layout with collapsible sidebar
- 🎯 WCAG AA accessible color palette
- ⚡ Fast development with Vite
- 🔧 Strict TypeScript configuration
- 🎨 Tailwind CSS + shadcn/ui components
- 📦 ESM imports only (no Node.js dependencies)

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety with strict mode
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Component library
- **Lucide React** - Icon library
- **ESLint + Prettier** - Code quality and formatting
- **Husky** - Git hooks for pre-commit formatting

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd chromokin

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── app/           # Main application components
├── components/    # Reusable UI components
│   └── ui/       # shadcn/ui components
├── tracks/        # Track-related components
├── data/          # Data management
├── lib/           # Utility functions
├── state/         # State management
├── styles/        # Global styles and CSS
├── types/         # TypeScript type definitions
├── pages/         # Page components
└── assets/        # Static assets
```

## Features

### Responsive Layout

- Top header with navigation
- Collapsible left sidebar for chromosome selection
- Main content area for genome visualization

### Chromosome Browser

- Visual representation of all 24 human chromosomes
- Color-coded chromosomes for easy identification
- Interactive selection and navigation
- Kid-friendly design with accessible colors

### Accessibility

- WCAG AA compliant color contrast
- Keyboard navigation support
- Screen reader friendly
- Focus management

## Development

The project uses strict TypeScript configuration and enforces code quality through:

- ESLint with Airbnb-style rules
- Prettier for consistent formatting
- Husky pre-commit hooks
- TypeScript strict mode

## Browser Support

This is a browser-only application that works in all modern browsers supporting:

- ES2020 features
- CSS Grid and Flexbox
- Modern JavaScript APIs

## License

MIT
