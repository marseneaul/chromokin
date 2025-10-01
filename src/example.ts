/**
 * Example usage of Chromokin Genome Browser
 * This file demonstrates how to integrate the genome browser into your project
 */

import { GenomeBrowser } from './GenomeBrowser';
import { GenomeData, Gene, Variant } from './types';

// Example 1: Basic usage with minimal data
export function createBasicGenomeBrowser(container: HTMLElement) {
  const basicData: GenomeData = {
    chromosomes: [
      {
        id: 'chr1',
        name: 'Chromosome 1',
        length: 1000000, // 1M base pairs
        genes: [
          {
            id: 'example-gene',
            name: 'Example Gene',
            symbol: 'EG1',
            start: 100000,
            end: 200000,
            strand: '+',
            description: 'An example gene for demonstration'
          }
        ],
        variants: [
          {
            id: 'example-variant',
            position: 150000,
            reference: 'A',
            alternate: 'T',
            type: 'SNP',
            significance: 'uncertain'
          }
        ]
      }
    ]
  };

  return new GenomeBrowser(container, basicData);
}

// Example 2: Advanced usage with custom options and event handlers
export function createAdvancedGenomeBrowser(container: HTMLElement) {
  const advancedData: GenomeData = {
    chromosomes: [
      {
        id: 'chr1',
        name: 'Chromosome 1',
        length: 248956422,
        genes: [
          {
            id: 'tp53',
            name: 'Tumor Protein P53',
            symbol: 'TP53',
            start: 7565097,
            end: 7590856,
            strand: '+',
            description: 'Tumor suppressor protein',
            function: 'DNA repair and apoptosis'
          }
        ],
        variants: [
          {
            id: 'rs1042522',
            position: 7574000,
            reference: 'G',
            alternate: 'C',
            type: 'SNP',
            significance: 'pathogenic',
            clinicalSignificance: 'Associated with increased cancer risk',
            frequency: 0.3
          }
        ]
      }
    ]
  };

  return new GenomeBrowser(
    container,
    advancedData,
    {
      width: 1200,
      height: 700,
      showGenes: true,
      showVariants: true,
      showTooltips: true,
      enableZoom: true,
      enablePan: true,
      theme: 'light',
      colors: {
        chromosome: '#3498db',
        gene: '#2ecc71',
        variant: '#e74c3c',
        pathogenic: '#e74c3c',
        benign: '#95a5a6',
        background: '#ffffff'
      }
    },
    {
      onGeneClick: (gene: Gene) => {
        console.log('Gene clicked:', gene);
        // You can integrate with your app's navigation, modals, etc.
        alert(`Gene: ${gene.symbol} - ${gene.description}`);
      },
      onVariantClick: (variant: Variant) => {
        console.log('Variant clicked:', variant);
        // Show detailed variant information
        alert(`Variant: ${variant.id}\nSignificance: ${variant.significance}`);
      },
      onZoom: (scale: number) => {
        console.log('Zoom level changed:', scale);
        // Update UI elements based on zoom level
      }
    }
  );
}

// Example 3: Integration with ancestry data
export function createAncestryGenomeBrowser(container: HTMLElement, ancestryData: any) {
  // Transform ancestry data to genome browser format
  const genomeData: GenomeData = {
    chromosomes: ancestryData.chromosomes.map((chr: any) => ({
      id: chr.id,
      name: chr.name,
      length: chr.length,
      genes: chr.genes || [],
      variants: chr.variants.filter((v: any) => v.ancestryRelevant) || []
    })),
    metadata: {
      species: 'Homo sapiens',
      assembly: 'GRCh38',
      version: 'hg38'
    }
  };

  return new GenomeBrowser(container, genomeData, {
    colors: {
      chromosome: '#8e44ad',  // Purple theme for ancestry
      gene: '#f39c12',        // Orange genes
      variant: '#e67e22',     // Orange variants
      pathogenic: '#e74c3c',
      benign: '#95a5a6',
      background: '#ffffff'
    }
  });
}

// Example 4: Dynamic data updates
export function createDynamicGenomeBrowser(container: HTMLElement) {
  const browser = new GenomeBrowser(container, {
    chromosomes: []
  });

  // Simulate loading data
  setTimeout(() => {
    const newData: GenomeData = {
      chromosomes: [
        {
          id: 'chr1',
          name: 'Chromosome 1',
          length: 248956422,
          genes: [
            {
              id: 'brca1',
              name: 'Breast Cancer Type 1',
              symbol: 'BRCA1',
              start: 43044295,
              end: 43125483,
              strand: '+',
              description: 'DNA repair protein'
            }
          ],
          variants: []
        }
      ]
    };
    
    browser.updateData(newData);
  }, 1000);

  return browser;
}

// Example 5: Custom styling and theming
export function createCustomStyledGenomeBrowser(container: HTMLElement) {
  const data: GenomeData = {
    chromosomes: [
      {
        id: 'chr1',
        name: 'Chromosome 1',
        length: 248956422,
        genes: [],
        variants: []
      }
    ]
  };

  return new GenomeBrowser(container, data, {
    width: 1000,
    height: 500,
    theme: 'dark',
    colors: {
      chromosome: '#5dade2',
      gene: '#58d68d',
      variant: '#ec7063',
      pathogenic: '#e74c3c',
      benign: '#95a5a6',
      background: '#2c3e50'
    }
  });
}
