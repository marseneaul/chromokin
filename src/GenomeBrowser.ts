import * as d3 from 'd3';
import { 
  GenomeData, 
  GenomeBrowserOptions, 
  GenomeBrowserEvents, 
  Variant, 
  Chromosome,
  ChromosomeSegment,
  AncestryData,
  TutorialStep
} from './types';

export class GenomeBrowser {
  private container: HTMLElement;
  private data: GenomeData;
  private options: Required<GenomeBrowserOptions>;
  private events: GenomeBrowserEvents;
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private scale: number = 1;
  private ancestryData?: AncestryData;
  private tutorialSteps: TutorialStep[] = [];
  private currentTutorialStep: number = 0;

  constructor(
    container: HTMLElement, 
    data: GenomeData, 
    options: GenomeBrowserOptions = {},
    events: GenomeBrowserEvents = {}
  ) {
    this.container = container;
    this.data = data;
    this.events = events;
    
    // Set default options
    this.options = {
      width: 1000,
      height: 600,
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
      },
      ...options
    };

    // Store instance globally for event handlers
    (window as any).genomeBrowserInstance = this;
    
    // Initialize tutorial steps
    this.initializeTutorialSteps();
    
    this.init();
  }

  private init(): void {
    // Clear container
    this.container.innerHTML = '';

    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .style('background-color', this.options.colors.background || '#ffffff')
      .style('border', '1px solid #ddd')
      .style('border-radius', '8px');

    // Create main group
    this.g = this.svg.append('g');

    // Set up zoom behavior
    if (this.options.enableZoom || this.options.enablePan) {
      this.zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 10])
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          this.scale = event.transform.k;
          this.g.attr('transform', event.transform.toString());
          this.events.onZoom?.(this.scale);
        });

      this.svg.call(this.zoom);
    }

    this.render();
  }

  private render(): void {
    const margin = { top: 80, right: 20, bottom: 40, left: 100 }; // Increased top margin for ruler
    const chartWidth = this.options.width - margin.left - margin.right;
    
    // Add extra margin for ancestry tracks
    const ancestryMargin = this.options.showAncestryTrack ? 60 : 0;
    const ethnicityMargin = this.options.showEthnicityTrack ? 60 : 0;

    // Calculate chromosome positions
    const chromosomeHeight = 40;
    const spacing = 20;
    
    // Filter chromosomes based on options
    let chromosomesToShow = this.data.chromosomes;
    if (!this.options.showAllChromosomes) {
      chromosomesToShow = this.data.chromosomes.filter(c => c.id !== 'chrM' && c.id !== 'chrY');
    }
    if (!this.options.showMitochondrialDNA) {
      chromosomesToShow = chromosomesToShow.filter(c => c.id !== 'chrM');
    }
    
    const totalHeight = chromosomesToShow.length * (chromosomeHeight + spacing);

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(this.data.chromosomes, (d: Chromosome) => d.length) || 0])
      .range([0, chartWidth]);

    const yScale = d3.scaleBand()
      .domain(chromosomesToShow.map((d: Chromosome) => d.id))
      .range([0, totalHeight])
      .padding(0.1);

    // Render ruler track
    this.renderRuler(margin, chartWidth, xScale);

    // Render ancestry tracks if enabled
    let currentY = margin.top;
    if (this.options.showAncestryTrack) {
      this.renderAncestryTrack(margin, chartWidth, xScale, currentY);
      currentY += ancestryMargin;
    }
    
    if (this.options.showEthnicityTrack) {
      this.renderEthnicityTrack(margin, chartWidth, xScale, currentY);
      currentY += ethnicityMargin;
    }

    // Render chromosomes
    const chromosomeGroup = this.g.append('g')
      .attr('transform', `translate(${margin.left}, ${currentY})`);

    const chromosomes = chromosomeGroup.selectAll('.chromosome')
      .data(chromosomesToShow)
      .enter()
      .append('g')
      .attr('class', 'chromosome')
      .attr('transform', d => `translate(0, ${yScale(d.id)})`);

    // Chromosome labels
    chromosomes.append('text')
      .attr('class', 'chromosome-label')
      .attr('x', -10)
      .attr('y', chromosomeHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text(d => d.name);

    // Chromosome bars with ancestry segments
    chromosomes.each(function(chromosome: Chromosome) {
      const chromosomeGroup = d3.select(this);
      
      if (chromosome.segments && chromosome.segments.length > 0) {
        // Render ancestry segments
        chromosomeGroup.selectAll('.ancestry-segment')
          .data(chromosome.segments)
          .enter()
          .append('rect')
          .attr('class', 'ancestry-segment')
          .attr('x', (d: ChromosomeSegment) => xScale(d.start))
          .attr('y', 0)
          .attr('width', (d: ChromosomeSegment) => Math.max(xScale(d.end) - xScale(d.start), 1))
          .attr('height', chromosomeHeight)
          .style('fill', (d: ChromosomeSegment) => d.color || getAncestryColor(d.ancestry))
          .style('stroke', '#34495e')
          .style('stroke-width', 0.5)
          .style('opacity', (d: ChromosomeSegment) => 0.7 + (d.confidence * 0.3))
          .on('click', (event: MouseEvent, d: ChromosomeSegment) => {
            event.stopPropagation();
            showSegmentInfo(chromosome, d);
          });
      } else {
        // Default chromosome bar if no segments
        chromosomeGroup.append('rect')
          .attr('class', 'chromosome-bar')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', xScale(chromosome.length))
          .attr('height', chromosomeHeight)
          .style('fill', getChromosomeColor(chromosome))
          .style('stroke', '#34495e')
          .style('stroke-width', 1)
          .style('opacity', 0.8);
      }
      
      // Add chromosome click handler
      chromosomeGroup.on('click', (_event: MouseEvent) => {
        this.events.onChromosomeClick?.(chromosome);
      });
    });

    // Render genes if enabled
    if (this.options.showGenes) {
      this.renderGenes(chromosomes, xScale, chromosomeHeight);
    }

    // Render variants if enabled
    if (this.options.showVariants) {
      this.renderVariants(chromosomes, xScale, chromosomeHeight);
    }

    // Add axis
    const xAxis = d3.axisBottom(xScale)
      .tickFormat((d: d3.NumberValue) => this.formatPosition(d as number));

    chromosomeGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${totalHeight + 10})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#7f8c8d');

    // Add axis label
    chromosomeGroup.append('text')
      .attr('class', 'axis-label')
      .attr('x', chartWidth / 2)
      .attr('y', totalHeight + 35)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#2c3e50')
      .text('Position (base pairs)');
  }

  private renderGenes(
    chromosomes: d3.Selection<SVGGElement, Chromosome, SVGGElement, unknown>,
    xScale: d3.ScaleLinear<number, number, never>,
    chromosomeHeight: number
  ): void {
    const geneHeight = 15;
    const geneY = (chromosomeHeight - geneHeight) / 2;

    chromosomes.each(function(chromosome: Chromosome) {
      const chromosomeGroup = d3.select(this);
      
      const genes = chromosomeGroup.selectAll('.gene')
        .data(chromosome.genes)
        .enter()
        .append('g')
        .attr('class', 'gene')
        .attr('transform', (d: any) => `translate(${xScale(d.start)}, ${geneY})`);

      // Gene rectangles
      genes.append('rect')
        .attr('width', (d: any) => Math.max(xScale(d.end) - xScale(d.start), 2))
        .attr('height', geneHeight)
        .style('fill', (d: any) => d.strand === '+' ? '#27ae60' : '#e67e22')
        .style('stroke', '#2c3e50')
        .style('stroke-width', 0.5)
        .style('opacity', 0.8)
        .on('click', (event: MouseEvent, d: any) => {
          event.stopPropagation();
          // Access the class instance through closure
          const browser = (window as any).genomeBrowserInstance;
          browser?.events.onGeneClick?.(d);
        });

      // Gene labels (only for larger genes)
      genes.filter((d: any) => xScale(d.end) - xScale(d.start) > 50)
        .append('text')
        .attr('x', (d: any) => (xScale(d.end) - xScale(d.start)) / 2)
        .attr('y', geneHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '10px')
        .style('fill', '#2c3e50')
        .style('font-weight', 'bold')
        .text((d: any) => d.symbol);
    });
  }

  private renderVariants(
    chromosomes: d3.Selection<SVGGElement, Chromosome, SVGGElement, unknown>,
    xScale: d3.ScaleLinear<number, number, never>,
    chromosomeHeight: number
  ): void {
    const variantRadius = 3;
    const variantY = chromosomeHeight + 5;

    chromosomes.each(function(chromosome: Chromosome) {
      const chromosomeGroup = d3.select(this);
      
      const variants = chromosomeGroup.selectAll('.variant')
        .data(chromosome.variants)
        .enter()
        .append('circle')
        .attr('class', 'variant')
        .attr('cx', (d: any) => xScale(d.position))
        .attr('cy', variantY)
        .attr('r', variantRadius)
        .style('fill', (d: any) => {
          const browser = (window as any).genomeBrowserInstance;
          switch (d.significance) {
            case 'pathogenic':
            case 'likely_pathogenic':
              return browser?.options.colors.pathogenic;
            case 'benign':
            case 'likely_benign':
              return browser?.options.colors.benign;
            default:
              return browser?.options.colors.variant;
          }
        })
        .style('stroke', '#2c3e50')
        .style('stroke-width', 1)
        .style('opacity', 0.8)
        .on('click', (event: MouseEvent, d: any) => {
          event.stopPropagation();
          const browser = (window as any).genomeBrowserInstance;
          browser?.events.onVariantClick?.(d);
        });

      // Add tooltips if enabled
      const browser = (window as any).genomeBrowserInstance;
      if (browser?.options.showTooltips) {
        browser.addTooltips(variants);
      }
    });
  }

  public addTooltips(selection: d3.Selection<SVGCircleElement, Variant, SVGGElement, unknown>): void {
    const tooltip = d3.select('body').append('div')
      .attr('class', 'genome-tooltip')
      .style('position', 'absolute')
      .style('padding', '8px 12px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', '1000');

    selection
      .on('mouseover', (event: MouseEvent, d: Variant) => {
        tooltip.transition()
          .duration(200)
          .style('opacity', 1);
        
        tooltip.html(`
          <strong>${d.id}</strong><br/>
          Position: ${this.formatPosition(d.position)}<br/>
          Type: ${d.type}<br/>
          ${d.significance ? `Significance: ${d.significance}` : ''}
          ${d.clinicalSignificance ? `<br/>Clinical: ${d.clinicalSignificance}` : ''}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition()
          .duration(200)
          .style('opacity', 0);
      });
  }

  private renderRuler(
    margin: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    xScale: d3.ScaleLinear<number, number, never>
  ): void {
    const rulerGroup = this.g.append('g')
      .attr('class', 'ruler-track')
      .attr('transform', `translate(${margin.left}, 10)`);

    // Ruler background
    rulerGroup.append('rect')
      .attr('class', 'ruler-background')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', chartWidth)
      .attr('height', 50)
      .style('fill', '#f8f9fa')
      .style('stroke', '#dee2e6')
      .style('stroke-width', 1);

    // Ruler label
    rulerGroup.append('text')
      .attr('class', 'ruler-label')
      .attr('x', -10)
      .attr('y', 25)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#495057')
      .text('GRCh38');

    // Calculate tick positions
    const maxLength = d3.max(this.data.chromosomes, (d: Chromosome) => d.length) || 0;
    const tickInterval = this.calculateTickInterval(maxLength);
    const ticks = this.generateTicks(maxLength, tickInterval);

    // Ruler ticks
    const tickGroup = rulerGroup.append('g')
      .attr('class', 'ruler-ticks');

    tickGroup.selectAll('.ruler-tick')
      .data(ticks)
      .enter()
      .append('line')
      .attr('class', 'ruler-tick')
      .attr('x1', (d: number) => xScale(d))
      .attr('x2', (d: number) => xScale(d))
      .attr('y1', 10)
      .attr('y2', 40)
      .style('stroke', '#6c757d')
      .style('stroke-width', 1);

    // Ruler labels
    tickGroup.selectAll('.ruler-label')
      .data(ticks)
      .enter()
      .append('text')
      .attr('class', 'ruler-label')
      .attr('x', (d: number) => xScale(d))
      .attr('y', 8)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'bottom')
      .style('font-size', '10px')
      .style('fill', '#495057')
      .text((d: number) => this.formatPosition(d));

    // Add major tick marks for better readability
    const majorTicks = ticks.filter((_, i) => i % 5 === 0);
    tickGroup.selectAll('.ruler-major-tick')
      .data(majorTicks)
      .enter()
      .append('line')
      .attr('class', 'ruler-major-tick')
      .attr('x1', (d: number) => xScale(d))
      .attr('x2', (d: number) => xScale(d))
      .attr('y1', 5)
      .attr('y2', 45)
      .style('stroke', '#495057')
      .style('stroke-width', 2);
  }

  private calculateTickInterval(maxLength: number): number {
    // Calculate appropriate tick interval based on chromosome length
    if (maxLength >= 100000000) return 10000000; // 10M for large chromosomes
    if (maxLength >= 50000000) return 5000000;   // 5M for medium chromosomes
    if (maxLength >= 10000000) return 1000000;   // 1M for smaller chromosomes
    if (maxLength >= 1000000) return 100000;     // 100K for very small chromosomes
    return 10000; // 10K for tiny sequences
  }

  private generateTicks(maxLength: number, interval: number): number[] {
    const ticks: number[] = [];
    for (let i = 0; i <= maxLength; i += interval) {
      ticks.push(i);
    }
    return ticks;
  }

  private formatPosition(position: number): string {
    if (position >= 1000000) {
      return `${(position / 1000000).toFixed(1)}M`;
    } else if (position >= 1000) {
      return `${(position / 1000).toFixed(1)}K`;
    }
    return position.toString();
  }

  private getAncestryColor(ancestry: string): string {
    const colors: { [key: string]: string } = {
      'European': '#3498db',
      'African': '#e74c3c',
      'Asian': '#f39c12',
      'Native American': '#2ecc71',
      'Middle Eastern': '#9b59b6',
      'South Asian': '#e67e22',
      'Oceanian': '#1abc9c',
      'Unknown': '#95a5a6'
    };
    return colors[ancestry] || '#95a5a6';
  }

  private getChromosomeColor(chromosome: Chromosome): string {
    if (chromosome.type === 'mitochondrial') return '#e67e22';
    if (chromosome.type === 'sex') return '#9b59b6';
    return this.options.colors.chromosome || '#3498db';
  }

  private showSegmentInfo(chromosome: Chromosome, segment: ChromosomeSegment): void {
    const info = `
      <h3>🧬 ${chromosome.name} - ${segment.ancestry} Segment</h3>
      <p><strong>Position:</strong> ${segment.start.toLocaleString()} - ${segment.end.toLocaleString()}</p>
      <p><strong>Length:</strong> ${(segment.end - segment.start).toLocaleString()} base pairs</p>
      <p><strong>Ancestry:</strong> ${segment.ancestry}</p>
      <p><strong>Confidence:</strong> ${(segment.confidence * 100).toFixed(1)}%</p>
      ${segment.population ? `<p><strong>Population:</strong> ${segment.population}</p>` : ''}
      <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px;">
        <strong>What this means:</strong> This segment of your DNA comes from ${segment.ancestry} ancestry with ${(segment.confidence * 100).toFixed(1)}% confidence. This means your ancestors from this region likely lived in areas where this genetic signature is common.
      </div>
    `;
    this.showInfoPanel(info);
  }

  private initializeTutorialSteps(): void {
    this.tutorialSteps = [
      {
        id: 'welcome',
        title: 'Welcome to Your Genome!',
        description: 'This is your personal genome browser. Think of it like a map of your DNA - the instruction manual that makes you, you!',
        target: '.header',
        position: 'bottom'
      },
      {
        id: 'ruler',
        title: 'The Ruler Track',
        description: 'This ruler shows positions on your chromosomes, like mile markers on a highway. GRCh38 is the latest human genome map.',
        target: '.ruler-track',
        position: 'bottom'
      },
      {
        id: 'chromosomes',
        title: 'Your Chromosomes',
        description: 'These blue bars represent your chromosomes - you have 23 pairs. Each contains thousands of genes that determine your traits.',
        target: '.chromosome-bar',
        position: 'right'
      },
      {
        id: 'genes',
        title: 'Your Genes',
        description: 'These green and orange rectangles are genes - the instructions for making proteins. Green = forward direction, Orange = reverse.',
        target: '.gene',
        position: 'top'
      },
      {
        id: 'variants',
        title: 'Your Variants',
        description: 'These colored dots show genetic variants - small differences that make you unique. Red = important, Gray = common.',
        target: '.variant',
        position: 'top'
      }
    ];
  }

  private renderAncestryTrack(
    margin: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    _xScale: d3.ScaleLinear<number, number, never>,
    yPosition: number
  ): void {
    const ancestryGroup = this.g.append('g')
      .attr('class', 'ancestry-track')
      .attr('transform', `translate(${margin.left}, ${yPosition})`);

    // Ancestry track background
    ancestryGroup.append('rect')
      .attr('class', 'ancestry-background')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', chartWidth)
      .attr('height', 50)
      .style('fill', '#f8f9fa')
      .style('stroke', '#dee2e6')
      .style('stroke-width', 1);

    // Ancestry track label
    ancestryGroup.append('text')
      .attr('class', 'ancestry-label')
      .attr('x', -10)
      .attr('y', 25)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#495057')
      .text('Family History');

    // Sample ancestry regions (this would come from real data)
    const ancestryRegions = [
      { name: 'European', percentage: 45, color: '#3498db' },
      { name: 'African', percentage: 30, color: '#e74c3c' },
      { name: 'Asian', percentage: 20, color: '#f39c12' },
      { name: 'Native American', percentage: 5, color: '#2ecc71' }
    ];

    let currentX = 0;
    ancestryRegions.forEach(region => {
      const width = (region.percentage / 100) * chartWidth;
      
      ancestryGroup.append('rect')
        .attr('class', 'ancestry-region')
        .attr('x', currentX)
        .attr('y', 10)
        .attr('width', width)
        .attr('height', 30)
        .style('fill', region.color)
        .style('opacity', 0.8)
        .on('click', () => {
          this.showAncestryInfo(region);
        });

      // Add region label if wide enough
      if (width > 60) {
        ancestryGroup.append('text')
          .attr('x', currentX + width / 2)
          .attr('y', 25)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '10px')
          .style('fill', 'white')
          .style('font-weight', 'bold')
          .text(`${region.name} ${region.percentage}%`);
      }

      currentX += width;
    });
  }

  private renderEthnicityTrack(
    margin: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    _xScale: d3.ScaleLinear<number, number, never>,
    yPosition: number
  ): void {
    const ethnicityGroup = this.g.append('g')
      .attr('class', 'ethnicity-track')
      .attr('transform', `translate(${margin.left}, ${yPosition})`);

    // Ethnicity track background
    ethnicityGroup.append('rect')
      .attr('class', 'ethnicity-background')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', chartWidth)
      .attr('height', 50)
      .style('fill', '#fff3cd')
      .style('stroke', '#ffeaa7')
      .style('stroke-width', 1);

    // Ethnicity track label
    ethnicityGroup.append('text')
      .attr('class', 'ethnicity-label')
      .attr('x', -10)
      .attr('y', 25)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#495057')
      .text('Ethnic Origins');

    // Sample haplogroup markers
    const haplogroups = [
      { name: 'H1a', position: 0.2, description: 'Maternal Line' },
      { name: 'R1b', position: 0.6, description: 'Paternal Line' },
      { name: 'J2', position: 0.8, description: 'Ancient Migration' }
    ];

    haplogroups.forEach(hg => {
      const x = hg.position * chartWidth;
      
      ethnicityGroup.append('circle')
        .attr('class', 'haplogroup-marker')
        .attr('cx', x)
        .attr('cy', 25)
        .attr('r', 8)
        .style('fill', '#f39c12')
        .style('stroke', '#e67e22')
        .style('stroke-width', 2)
        .on('click', () => {
          this.showHaplogroupInfo(hg);
        });

      ethnicityGroup.append('text')
        .attr('x', x)
        .attr('y', 45)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'top')
        .style('font-size', '9px')
        .style('fill', '#495057')
        .text(hg.name);
    });
  }

  private showAncestryInfo(region: any): void {
    const info = `
      <h3>🌍 ${region.name} Ancestry</h3>
      <p><strong>Percentage:</strong> ${region.percentage}%</p>
      <p><strong>What this means:</strong> This percentage of your DNA comes from ${region.name} populations.</p>
      <p><strong>Family History:</strong> Your ancestors likely lived in regions where this genetic signature is common.</p>
      <p><strong>For Kids:</strong> Think of this like a recipe - ${region.percentage}% of your DNA "ingredients" come from ${region.name} heritage!</p>
    `;
    this.showInfoPanel(info);
  }

  private showHaplogroupInfo(haplogroup: any): void {
    const info = `
      <h3>🧬 Haplogroup ${haplogroup.name}</h3>
      <p><strong>Type:</strong> ${haplogroup.description}</p>
      <p><strong>What this means:</strong> This is a genetic marker that traces your ancient family line.</p>
      <p><strong>Migration Story:</strong> Your ancestors with this marker traveled specific paths thousands of years ago.</p>
      <p><strong>For Kids:</strong> This is like a family passport stamp that shows where your ancestors came from long, long ago!</p>
    `;
    this.showInfoPanel(info);
  }

  private showInfoPanel(content: string): void {
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
      width: 350px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-height: 80vh;
      overflow-y: auto;
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

    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (panel.parentNode) {
        panel.remove();
      }
    }, 15000);
  }

  // Public methods
  public updateData(newData: GenomeData): void {
    this.data = newData;
    this.render();
  }

  public updateOptions(newOptions: Partial<GenomeBrowserOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.render();
  }

  public zoomTo(scale: number): void {
    if (this.zoom) {
      this.svg.transition()
        .duration(750)
        .call(this.zoom.scaleTo, scale);
    }
  }

  public resetZoom(): void {
    if (this.zoom) {
      this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity);
    }
  }

  public getCurrentScale(): number {
    return this.scale;
  }

  public destroy(): void {
    this.container.innerHTML = '';
    d3.selectAll('.genome-tooltip').remove();
  }

  // Tutorial methods
  public startTutorial(): void {
    if (this.tutorialSteps.length === 0) return;
    
    this.currentTutorialStep = 0;
    this.showTutorialStep(this.tutorialSteps[0]);
  }

  public nextTutorialStep(): void {
    if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
      this.currentTutorialStep++;
      this.showTutorialStep(this.tutorialSteps[this.currentTutorialStep]);
    } else {
      this.endTutorial();
    }
  }

  public previousTutorialStep(): void {
    if (this.currentTutorialStep > 0) {
      this.currentTutorialStep--;
      this.showTutorialStep(this.tutorialSteps[this.currentTutorialStep]);
    }
  }

  public endTutorial(): void {
    const tutorialOverlay = document.getElementById('tutorial-overlay');
    if (tutorialOverlay) {
      tutorialOverlay.remove();
    }
  }

  private showTutorialStep(step: TutorialStep): void {
    // Remove existing tutorial overlay
    const existingOverlay = document.getElementById('tutorial-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create tutorial overlay
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create tutorial card
    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 500px;
      margin: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    card.innerHTML = `
      <h2 style="color: #2c3e50; margin-bottom: 15px; font-size: 24px;">${step.title}</h2>
      <p style="color: #34495e; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">${step.description}</p>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button id="tutorial-prev" style="
          background: #95a5a6;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          ${this.currentTutorialStep === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
        " ${this.currentTutorialStep === 0 ? 'disabled' : ''}>Previous</button>
        <span style="color: #7f8c8d; font-size: 14px;">
          ${this.currentTutorialStep + 1} of ${this.tutorialSteps.length}
        </span>
        <button id="tutorial-next" style="
          background: #3498db;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">${this.currentTutorialStep === this.tutorialSteps.length - 1 ? 'Finish' : 'Next'}</button>
      </div>
      <button id="tutorial-skip" style="
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
      ">×</button>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Add event listeners
    document.getElementById('tutorial-prev')?.addEventListener('click', () => {
      this.previousTutorialStep();
    });

    document.getElementById('tutorial-next')?.addEventListener('click', () => {
      this.nextTutorialStep();
    });

    document.getElementById('tutorial-skip')?.addEventListener('click', () => {
      this.endTutorial();
    });

    // Highlight target element if specified
    if (step.target) {
      const targetElement = document.querySelector(step.target) as HTMLElement;
      if (targetElement) {
        targetElement.style.outline = '3px solid #e67e22';
        targetElement.style.outlineOffset = '2px';
        targetElement.style.transition = 'outline 0.3s ease';
      }
    }

    this.events.onTutorialStep?.(step);
  }

  // Ancestry data methods
  public setAncestryData(ancestryData: AncestryData): void {
    this.ancestryData = ancestryData;
    this.render();
  }

  public getAncestryData(): AncestryData | undefined {
    return this.ancestryData;
  }
}
