import { GenomeBrowser } from './GenomeBrowser';
import { GenomeData, Gene, Variant, Chromosome, AncestryData } from './types';

// Sample genome data for demonstration using GRCh38 coordinates
const sampleGenomeData: GenomeData = {
  chromosomes: [
    {
      id: 'chr1',
      name: 'Chromosome 1',
      length: 248956422, // GRCh38 chr1 length
      type: 'autosomal',
      genes: [
        {
          id: 'gene1',
          name: 'Tumor Protein P53',
          symbol: 'TP53',
          start: 7565097,  // GRCh38 coordinates
          end: 7590856,
          strand: '+',
          description: 'Tumor suppressor protein',
          function: 'DNA repair and apoptosis',
          ancestryRelevant: true,
          simpleDescription: 'This gene helps protect your cells from becoming damaged',
          familyFriendlyName: 'Cell Protector Gene',
          traits: ['Cancer protection', 'Cell repair'],
          ethnicAssociations: ['Found in all populations']
        },
        {
          id: 'gene2',
          name: 'Breast Cancer Type 1',
          symbol: 'BRCA1',
          start: 43044295, // GRCh38 coordinates
          end: 43125483,
          strand: '+',
          description: 'DNA repair protein',
          function: 'Double-strand break repair'
        },
        {
          id: 'gene3',
          name: 'Cyclin Dependent Kinase Inhibitor 2A',
          symbol: 'CDKN2A',
          start: 21971177, // GRCh38 coordinates
          end: 21994428,
          strand: '-',
          description: 'Tumor suppressor',
          function: 'Cell cycle regulation'
        }
      ],
      variants: [
        {
          id: 'rs1042522',
          position: 7574000, // GRCh38 coordinates
          reference: 'G',
          alternate: 'C',
          type: 'SNP',
          significance: 'uncertain',
          clinicalSignificance: 'Associated with cancer risk',
          frequency: 0.3,
          ancestryRelevant: true,
          ethnicOrigin: 'European',
          simpleExplanation: 'This is a small difference in your DNA that might affect how your cells work'
        },
        {
          id: 'rs1799966',
          position: 43095000, // GRCh38 coordinates
          reference: 'A',
          alternate: 'G',
          type: 'SNP',
          significance: 'likely_benign',
          clinicalSignificance: 'No known clinical significance',
          frequency: 0.15
        },
        {
          id: 'rs11571833',
          position: 21980000, // GRCh38 coordinates
          reference: 'T',
          alternate: 'C',
          type: 'SNP',
          significance: 'pathogenic',
          clinicalSignificance: 'Associated with melanoma risk',
          frequency: 0.05
        }
      ],
      segments: [
        { start: 0, end: 50000000, ancestry: 'European', confidence: 0.95, population: 'British' },
        { start: 50000000, end: 100000000, ancestry: 'African', confidence: 0.87, population: 'West African' },
        { start: 100000000, end: 150000000, ancestry: 'European', confidence: 0.92, population: 'German' },
        { start: 150000000, end: 200000000, ancestry: 'Asian', confidence: 0.78, population: 'East Asian' },
        { start: 200000000, end: 248956422, ancestry: 'European', confidence: 0.89, population: 'Irish' }
      ]
    },
    {
      id: 'chr2',
      name: 'Chromosome 2',
      length: 242193529, // GRCh38 chr2 length
      genes: [
        {
          id: 'gene4',
          name: 'MSH2',
          symbol: 'MSH2',
          start: 47406299, // GRCh38 coordinates
          end: 47500000,
          strand: '+',
          description: 'DNA mismatch repair protein',
          function: 'DNA repair'
        },
        {
          id: 'gene5',
          name: 'MLH1',
          symbol: 'MLH1',
          start: 37034841, // GRCh38 coordinates
          end: 37092337,
          strand: '+',
          description: 'DNA mismatch repair protein',
          function: 'DNA repair'
        }
      ],
      variants: [
        {
          id: 'rs1801282',
          position: 47450000, // GRCh38 coordinates
          reference: 'C',
          alternate: 'G',
          type: 'SNP',
          significance: 'likely_pathogenic',
          clinicalSignificance: 'Lynch syndrome risk',
          frequency: 0.02
        }
      ]
    },
    {
      id: 'chr13',
      name: 'Chromosome 13',
      length: 114364328, // GRCh38 chr13 length
      genes: [
        {
          id: 'gene6',
          name: 'BRCA2',
          symbol: 'BRCA2',
          start: 32315086, // GRCh38 coordinates (BRCA2 is on chr13, not chrX)
          end: 32400266,
          strand: '+',
          description: 'DNA repair protein',
          function: 'Double-strand break repair'
        }
      ],
      variants: [
        {
          id: 'rs80357382',
          position: 32350000, // GRCh38 coordinates
          reference: 'A',
          alternate: 'T',
          type: 'SNP',
          significance: 'pathogenic',
          clinicalSignificance: 'Breast and ovarian cancer risk',
          frequency: 0.01
        }
      ]
    },
    // Add more chromosomes for comprehensive view
    {
      id: 'chrX',
      name: 'X Chromosome',
      length: 156040895,
      type: 'sex',
      genes: [],
      variants: [],
      segments: [
        { start: 0, end: 50000000, ancestry: 'European', confidence: 0.88, population: 'British' },
        { start: 50000000, end: 100000000, ancestry: 'African', confidence: 0.82, population: 'West African' },
        { start: 100000000, end: 156040895, ancestry: 'European', confidence: 0.91, population: 'German' }
      ]
    },
    {
      id: 'chrY',
      name: 'Y Chromosome',
      length: 57227415,
      type: 'sex',
      genes: [],
      variants: [],
      segments: [
        { start: 0, end: 20000000, ancestry: 'European', confidence: 0.95, population: 'British' },
        { start: 20000000, end: 40000000, ancestry: 'European', confidence: 0.93, population: 'German' },
        { start: 40000000, end: 57227415, ancestry: 'European', confidence: 0.89, population: 'Irish' }
      ]
    },
    {
      id: 'chrM',
      name: 'Mitochondrial DNA',
      length: 16569,
      type: 'mitochondrial',
      genes: [],
      variants: [],
      segments: [
        { start: 0, end: 16569, ancestry: 'European', confidence: 0.98, population: 'H1a Haplogroup' }
      ]
    }
  ],
  metadata: {
    species: 'Homo sapiens',
    assembly: 'GRCh38',
    version: 'hg38',
    build: 'GRCh38.p14',
    release: '2023-03-15'
  }
};

// Sample ancestry data
const sampleAncestryData: AncestryData = {
  ethnicity: {
    'European': 45,
    'African': 30,
    'Asian': 20,
    'Native American': 5
  },
  haplogroups: {
    maternal: 'H1a',
    paternal: 'R1b'
  },
  populationMatches: {
    'British': 0.85,
    'Irish': 0.78,
    'German': 0.72,
    'French': 0.68
  },
  migrationPath: ['Africa', 'Middle East', 'Europe', 'North America']
};

// Initialize the genome browser
function initGenomeBrowser() {
  const container = document.getElementById('genome-browser');
  if (!container) {
    console.error('Genome browser container not found');
    return;
  }

  const browser = new GenomeBrowser(
    container,
    sampleGenomeData,
    {
      width: 1000,
      height: 700, // Increased height for new tracks
      showGenes: true,
      showVariants: true,
      showTooltips: true,
      enableZoom: true,
      enablePan: true,
      theme: 'light',
      showAncestryTrack: true,
      showEthnicityTrack: true,
      showTutorial: false,
      simpleMode: false,
      showFamilyTree: false,
      enableTutorial: true,
      showAncestrySegments: true,
      showAllChromosomes: true,
      showMitochondrialDNA: true,
      professionalMode: true,
      colors: {
        chromosome: '#3498db',
        gene: '#2ecc71',
        variant: '#e74c3c',
        pathogenic: '#e74c3c',
        benign: '#95a5a6',
        background: '#ffffff',
        ancestry: '#9b59b6',
        ethnicity: '#f39c12',
        tutorial: '#e67e22'
      }
    },
    {
      onGeneClick: (gene: Gene) => {
        console.log('Gene clicked:', gene);
        showGeneInfo(gene);
      },
      onVariantClick: (variant: Variant) => {
        console.log('Variant clicked:', variant);
        showVariantInfo(variant);
      },
      onChromosomeClick: (chromosome: Chromosome) => {
        console.log('Chromosome clicked:', chromosome);
        showChromosomeInfo(chromosome);
      },
      onZoom: (scale: number) => {
        console.log('Zoom level:', scale);
        updateZoomDisplay(scale);
      },
      onTutorialStep: (step) => {
        console.log('Tutorial step:', step.title);
      },
      onAncestryClick: (ancestryData) => {
        console.log('Ancestry clicked:', ancestryData);
      }
    }
  );

  // Set ancestry data
  browser.setAncestryData(sampleAncestryData);

  // Add controls
  addControls(browser);
}

function showGeneInfo(gene: Gene) {
  const familyName = gene.familyFriendlyName || gene.symbol;
  const simpleDesc = gene.simpleDescription || gene.description || 'No description available';
  const traits = gene.traits ? gene.traits.join(', ') : 'Various traits';
  
  const info = `
    <h3>🧬 ${familyName}</h3>
    <p><strong>What it does:</strong> ${simpleDesc}</p>
    <p><strong>Position:</strong> ${gene.start.toLocaleString()} - ${gene.end.toLocaleString()}</p>
    <p><strong>Direction:</strong> ${gene.strand === '+' ? 'Forward' : 'Reverse'}</p>
    <p><strong>Traits:</strong> ${traits}</p>
    ${gene.ethnicAssociations ? `<p><strong>Found in:</strong> ${gene.ethnicAssociations.join(', ')}</p>` : ''}
    <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px;">
      <strong>For Kids:</strong> This gene is like a recipe in your DNA cookbook that tells your body how to make something important!
    </div>
  `;
  showInfoPanel(info);
}

function showVariantInfo(variant: Variant) {
  const significanceColor = {
    'benign': '#27ae60',
    'likely_benign': '#2ecc71',
    'uncertain': '#f39c12',
    'likely_pathogenic': '#e67e22',
    'pathogenic': '#e74c3c'
  }[variant.significance || 'uncertain'];

  const simpleExplanation = variant.simpleExplanation || 'This is a small difference in your DNA';
  const ethnicOrigin = variant.ethnicOrigin ? `Common in ${variant.ethnicOrigin} populations` : 'Found in many populations';

  const info = `
    <h3>🔬 ${variant.id}</h3>
    <p><strong>What this is:</strong> ${simpleExplanation}</p>
    <p><strong>Position:</strong> ${variant.position.toLocaleString()}</p>
    <p><strong>Change:</strong> ${variant.reference} → ${variant.alternate}</p>
    <p><strong>Type:</strong> ${variant.type}</p>
    <p><strong>Importance:</strong> <span style="color: ${significanceColor}">${variant.significance || 'Unknown'}</span></p>
    <p><strong>What it means:</strong> ${variant.clinicalSignificance || 'Not specified'}</p>
    <p><strong>How common:</strong> ${variant.frequency ? (variant.frequency * 100).toFixed(1) + '% of people' : 'Unknown'}</p>
    <p><strong>Family History:</strong> ${ethnicOrigin}</p>
    <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px;">
      <strong>For Kids:</strong> This is like a tiny typo in your DNA recipe book - most of the time it doesn't matter, but sometimes it can change how things work!
    </div>
  `;
  showInfoPanel(info);
}

function showChromosomeInfo(chromosome: Chromosome) {
  const info = `
    <h3>📊 ${chromosome.name}</h3>
    <p><strong>Length:</strong> ${chromosome.length.toLocaleString()} base pairs</p>
    <p><strong>Genes:</strong> ${chromosome.genes.length}</p>
    <p><strong>Variants:</strong> ${chromosome.variants.length}</p>
  `;
  showInfoPanel(info);
}

function showInfoPanel(content: string) {
  // Remove existing info panel
  const existingPanel = document.getElementById('info-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  // Create new info panel
  const panel = document.createElement('div');
  panel.id = 'info-panel';
  panel.innerHTML = content;
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 300px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #999;
  `;
  closeButton.onclick = () => panel.remove();
  panel.appendChild(closeButton);

  document.body.appendChild(panel);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (panel.parentNode) {
      panel.remove();
    }
  }, 10000);
}

function updateZoomDisplay(scale: number) {
  let zoomDisplay = document.getElementById('zoom-display');
  if (!zoomDisplay) {
    zoomDisplay = document.createElement('div');
    zoomDisplay.id = 'zoom-display';
    zoomDisplay.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
    `;
    document.body.appendChild(zoomDisplay);
  }
  zoomDisplay.textContent = `Zoom: ${(scale * 100).toFixed(0)}%`;
}

function addControls(browser: GenomeBrowser) {
  const controls = document.createElement('div');
  controls.style.cssText = `
    margin: 20px 0;
    text-align: center;
  `;

  // Tutorial button
  const tutorialButton = document.createElement('button');
  tutorialButton.textContent = '🎓 Take Tour';
  tutorialButton.style.cssText = `
    background: #e67e22;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    margin: 0 10px;
    font-size: 16px;
    font-weight: bold;
  `;
  tutorialButton.onclick = () => browser.startTutorial();

  // Zoom controls
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset Zoom';
  resetButton.style.cssText = `
    background: #3498db;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    margin: 0 10px;
    font-size: 14px;
  `;
  resetButton.onclick = () => browser.resetZoom();

  const zoomInButton = document.createElement('button');
  zoomInButton.textContent = 'Zoom In';
  zoomInButton.style.cssText = resetButton.style.cssText;
  zoomInButton.style.background = '#27ae60';
  zoomInButton.onclick = () => browser.zoomTo(browser.getCurrentScale() * 1.5);

  const zoomOutButton = document.createElement('button');
  zoomOutButton.textContent = 'Zoom Out';
  zoomOutButton.style.cssText = resetButton.style.cssText;
  zoomOutButton.style.background = '#e74c3c';
  zoomOutButton.onclick = () => browser.zoomTo(browser.getCurrentScale() * 0.75);

  // Simple mode toggle
  const simpleModeButton = document.createElement('button');
  simpleModeButton.textContent = '👶 Simple Mode';
  simpleModeButton.style.cssText = `
    background: #9b59b6;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    margin: 0 10px;
    font-size: 14px;
  `;
  simpleModeButton.onclick = () => {
    const currentMode = browser.options.simpleMode;
    browser.updateOptions({ simpleMode: !currentMode });
    simpleModeButton.textContent = !currentMode ? '👶 Simple Mode' : '🔬 Expert Mode';
    simpleModeButton.style.background = !currentMode ? '#9b59b6' : '#34495e';
  };

  controls.appendChild(tutorialButton);
  controls.appendChild(simpleModeButton);
  controls.appendChild(zoomInButton);
  controls.appendChild(resetButton);
  controls.appendChild(zoomOutButton);

  const app = document.getElementById('app');
  if (app) {
    app.insertBefore(controls, app.children[1]);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initGenomeBrowser);
