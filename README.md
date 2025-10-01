# 🧬 Chromokin Genome Browser

A user-friendly TypeScript genome browser component designed for lay people to explore genetic data. Built with D3.js and Vite, it provides an intuitive interface for visualizing chromosomes, genes, and genetic variants.

## ✨ Features

- **Interactive Visualization**: Zoom, pan, and explore genetic data with smooth interactions
- **User-Friendly Design**: Clean, intuitive interface perfect for non-experts
- **Rich Data Display**: Visualize chromosomes, genes, and genetic variants
- **GRCh38 Support**: Built-in support for the latest human genome reference assembly
- **Ruler Track**: Genomic coordinate ruler at the top for easy position reference
- **Tooltips & Information**: Hover and click for detailed information
- **Customizable**: Flexible theming and configuration options
- **TypeScript Support**: Full type safety and IntelliSense support
- **Vite Compatible**: Fast development and building with Vite
- **NPM Ready**: Easy integration into existing Node.js projects

## 🚀 Quick Start

### Installation

```bash
npm install chromokin-genome-browser
```

### Basic Usage

```typescript
import { GenomeBrowser } from 'chromokin-genome-browser';
import { GenomeData } from 'chromokin-genome-browser';

// Your genetic data
const genomeData: GenomeData = {
  chromosomes: [
    {
      id: 'chr1',
      name: 'Chromosome 1',
      length: 248956422,
      genes: [
        {
          id: 'gene1',
          name: 'Tumor Protein P53',
          symbol: 'TP53',
          start: 7565097,
          end: 7590856,
          strand: '+',
          description: 'Tumor suppressor protein'
        }
      ],
      variants: [
        {
          id: 'rs1042522',
          position: 7574000,
          reference: 'G',
          alternate: 'C',
          type: 'SNP',
          significance: 'uncertain'
        }
      ]
    }
  ]
};

// Create the browser
const container = document.getElementById('genome-browser');
const browser = new GenomeBrowser(container, genomeData, {
  width: 1000,
  height: 600,
  showGenes: true,
  showVariants: true,
  enableZoom: true
});
```

## 📊 Data Structure

### GenomeData

```typescript
interface GenomeData {
  chromosomes: Chromosome[];
  metadata?: {
    species?: string;
    assembly?: string;
    version?: string;
    build?: string;
    release?: string;
  };
}
```

### Chromosome

```typescript
interface Chromosome {
  id: string;           // Unique identifier (e.g., 'chr1', 'chrX')
  name: string;         // Display name (e.g., 'Chromosome 1')
  length: number;       // Length in base pairs
  genes: Gene[];        // Array of genes on this chromosome
  variants: Variant[];  // Array of genetic variants
}
```

### Gene

```typescript
interface Gene {
  id: string;           // Unique identifier
  name: string;         // Full gene name
  symbol: string;       // Gene symbol (e.g., 'TP53')
  start: number;        // Start position in base pairs
  end: number;          // End position in base pairs
  strand: '+' | '-';    // DNA strand
  description?: string; // Gene description
  function?: string;    // Gene function
}
```

### Variant

```typescript
interface Variant {
  id: string;                    // Variant ID (e.g., 'rs1042522')
  position: number;              // Position in base pairs
  reference: string;             // Reference allele
  alternate: string;             // Alternate allele
  type: 'SNP' | 'INDEL' | 'CNV'; // Variant type
  significance?: 'benign' | 'likely_benign' | 'uncertain' | 'likely_pathogenic' | 'pathogenic';
  clinicalSignificance?: string; // Clinical interpretation
  frequency?: number;            // Population frequency (0-1)
}
```

## ⚙️ Configuration Options

### GenomeBrowserOptions

```typescript
interface GenomeBrowserOptions {
  width?: number;              // Browser width (default: 1000)
  height?: number;             // Browser height (default: 600)
  showGenes?: boolean;         // Show genes (default: true)
  showVariants?: boolean;      // Show variants (default: true)
  showTooltips?: boolean;      // Show hover tooltips (default: true)
  enableZoom?: boolean;        // Enable zoom (default: true)
  enablePan?: boolean;         // Enable panning (default: true)
  theme?: 'light' | 'dark';    // Color theme (default: 'light')
  colors?: {                   // Custom colors
    chromosome?: string;
    gene?: string;
    variant?: string;
    pathogenic?: string;
    benign?: string;
    background?: string;
  };
}
```

## 🎯 Event Handling

```typescript
interface GenomeBrowserEvents {
  onGeneClick?: (gene: Gene) => void;
  onVariantClick?: (variant: Variant) => void;
  onChromosomeClick?: (chromosome: Chromosome) => void;
  onZoom?: (scale: number) => void;
  onPan?: (x: number, y: number) => void;
}

// Example usage
const browser = new GenomeBrowser(container, data, options, {
  onGeneClick: (gene) => {
    console.log('Gene clicked:', gene.symbol);
    // Show gene details, navigate to gene page, etc.
  },
  onVariantClick: (variant) => {
    console.log('Variant clicked:', variant.id);
    // Show variant details, clinical significance, etc.
  }
});
```

## 🎨 Customization

### Custom Colors

```typescript
const browser = new GenomeBrowser(container, data, {
  colors: {
    chromosome: '#3498db',    // Blue chromosomes
    gene: '#2ecc71',         // Green genes
    variant: '#e74c3c',      // Red variants
    pathogenic: '#e74c3c',   // Red for pathogenic variants
    benign: '#95a5a6',       // Gray for benign variants
    background: '#ffffff'    // White background
  }
});
```

### Dark Theme

```typescript
const browser = new GenomeBrowser(container, data, {
  theme: 'dark',
  colors: {
    chromosome: '#5dade2',
    gene: '#58d68d',
    variant: '#ec7063',
    background: '#2c3e50'
  }
});
```

## 🔧 API Methods

### Public Methods

```typescript
// Update data
browser.updateData(newGenomeData);

// Update options
browser.updateOptions({ showGenes: false });

// Zoom controls
browser.zoomTo(2.0);        // Zoom to 200%
browser.resetZoom();         // Reset to original zoom
browser.getCurrentScale();   // Get current zoom level

// Cleanup
browser.destroy();           // Remove browser and clean up
```

## 🛠️ Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd chromokin-genome-browser

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### Project Structure

```
src/
├── types.ts           # TypeScript type definitions
├── GenomeBrowser.ts   # Main browser component
├── index.ts          # Public API exports
└── demo.ts           # Demo implementation
```

## 🧪 Demo

The included demo showcases the genome browser with sample data including:

- **Chromosome 1**: TP53, BRCA1, CDKN2A genes with associated variants
- **Chromosome 2**: MSH2, MLH1 genes with Lynch syndrome variant
- **Chromosome 13**: BRCA2 gene with breast cancer variant

### New Features in Action

- **GRCh38 Ruler Track**: See the genomic coordinate ruler at the top showing position markers
- **Accurate Coordinates**: All positions use real GRCh38 coordinates
- **Interactive Elements**: Click genes and variants for detailed information
- **Zoom Controls**: Use the zoom buttons or mouse wheel to explore different scales

Run `npm run dev` to see the demo in action!

## 🤝 Integration with Ancestry Projects

This genome browser is designed to integrate seamlessly with ancestry and genealogy projects:

```typescript
// Example integration with ancestry data
const ancestryGenomeData: GenomeData = {
  chromosomes: ancestryData.chromosomes.map(chr => ({
    ...chr,
    variants: chr.variants.filter(v => v.ancestryRelevant)
  }))
};

const browser = new GenomeBrowser(container, ancestryGenomeData, {
  colors: {
    chromosome: '#8e44ad',  // Purple theme for ancestry
    gene: '#f39c12',        // Orange genes
    variant: '#e67e22'      // Orange variants
  }
});
```

## 📝 License

MIT License - see LICENSE file for details.

## 🙏 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

**Made with ❤️ for the genetics community**
