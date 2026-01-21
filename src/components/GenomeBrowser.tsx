/**
 * GenomeBrowser - Clean, interactive genome visualization
 * Features: drag-to-pan, scroll-to-zoom, minimal design
 * Tracks: Cytoband, Ancestry, Genes, Genomic Features
 */

import {
  type JSX,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAppStore,
  useActiveChromosome,
  useZoomState,
  useLoadTraits,
  useTraitsLoaded,
  useLoadGenomicFeatures,
  useGenomicFeaturesLoaded,
} from '@/state/appState';
import { CHROMOSOME_LENGTHS } from '@/types/core';
import { Scale } from '@/scales/scale';
import { getGenesInRange } from '@/data/traitsLoader';
import { getFeaturesInRange } from '@/data/genomicFeaturesLoader';
import { getCytobandsInRange } from '@/data/genomeLoader';
import { getAncestrySegmentsInRange, isPhased } from '@/data/ancestryLoader';
import { getGeneDisplayName } from '@/lib/content';
import { Tooltip } from '@/components/interaction/Tooltip';
import { DetailPanel } from '@/components/interaction/DetailPanel';
import {
  CYTOBAND_COLORS,
  POPULATION_COLORS,
  POPULATION_DISPLAY_NAMES,
  SNP_COLORS,
} from '@/types/genome';
import type {
  AncestrySegment,
  AncestryPopulation,
  AnnotatedSNP,
  SNPCategory,
} from '@/types/genome';
import { getAncestryComposition } from '@/data/ancestryLoader';
import { getSNPsInRange } from '@/data/snpLoader';

interface GenomeBrowserProps {
  className?: string;
}

export function GenomeBrowser({
  className = '',
}: GenomeBrowserProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, centerPosition: 0 });

  // Ancestry tooltip state
  const [ancestryTooltip, setAncestryTooltip] = useState<{
    segment: AncestrySegment;
    position: { x: number; y: number };
  } | null>(null);

  // SNP tooltip state
  const [snpTooltip, setSnpTooltip] = useState<{
    snp: AnnotatedSNP;
    position: { x: number; y: number };
  } | null>(null);

  const activeChromosome = useActiveChromosome();
  const zoomState = useZoomState();
  const setChromosomeZoom = useAppStore(state => state.setChromosomeZoom);
  const globalBpPerPx = useAppStore(state => state.globalBpPerPx);
  const viewMode = useAppStore(state => state.viewMode);
  const setHoveredGene = useAppStore(state => state.setHoveredGene);
  const setHoveredFeature = useAppStore(state => state.setHoveredFeature);
  const selectGene = useAppStore(state => state.selectGene);
  const selectFeature = useAppStore(state => state.selectFeature);
  const traitsLoaded = useTraitsLoaded();
  const loadTraits = useLoadTraits();
  const genomicFeaturesLoaded = useGenomicFeaturesLoaded();
  const loadGenomicFeatures = useLoadGenomicFeatures();

  // Load traits and genomic features on mount
  useEffect(() => {
    if (!traitsLoaded) loadTraits();
    if (!genomicFeaturesLoaded) loadGenomicFeatures();
  }, [traitsLoaded, loadTraits, genomicFeaturesLoaded, loadGenomicFeatures]);

  // Get chromosome length
  const chromosomeLength = activeChromosome
    ? CHROMOSOME_LENGTHS[activeChromosome as keyof typeof CHROMOSOME_LENGTHS] ||
      0
    : 0;

  // Effective zoom state
  const effectiveZoom = zoomState || {
    bpPerPx: globalBpPerPx,
    centerPosition: chromosomeLength / 2,
    chromosome: activeChromosome || '',
  };

  // Update dimensions on resize using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Use fallback dimensions if not yet measured
  const effectiveWidth = dimensions.width || 800;
  const effectiveHeight = dimensions.height || 400;

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const halfWidth = (effectiveWidth * effectiveZoom.bpPerPx) / 2;
    return {
      start: Math.max(0, effectiveZoom.centerPosition - halfWidth),
      end: Math.min(
        chromosomeLength || 1,
        effectiveZoom.centerPosition + halfWidth
      ),
    };
  }, [effectiveZoom, effectiveWidth, chromosomeLength]);

  // Create scale for coordinate transformation
  const scale = useMemo(() => {
    return new Scale(
      [visibleRange.start, visibleRange.end],
      [0, effectiveWidth]
    );
  }, [visibleRange, effectiveWidth]);

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!activeChromosome) return;
      e.preventDefault();

      const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8; // Zoom out / in
      const newBpPerPx = Math.max(
        100, // Min zoom (very zoomed in)
        Math.min(
          chromosomeLength / effectiveWidth, // Max zoom (whole chromosome)
          effectiveZoom.bpPerPx * zoomFactor
        )
      );

      // Zoom towards mouse position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseRatio = mouseX / effectiveWidth;
        const mouseBp =
          visibleRange.start +
          mouseRatio * (visibleRange.end - visibleRange.start);

        // Adjust center to keep mouse position stable
        const newHalfWidth = (effectiveWidth * newBpPerPx) / 2;
        const newCenter = mouseBp - (mouseRatio - 0.5) * 2 * newHalfWidth;

        setChromosomeZoom(activeChromosome, {
          ...effectiveZoom,
          bpPerPx: newBpPerPx,
          centerPosition: Math.max(
            newHalfWidth,
            Math.min(chromosomeLength - newHalfWidth, newCenter)
          ),
        });
      }
    },
    [
      activeChromosome,
      effectiveZoom,
      dimensions,
      chromosomeLength,
      visibleRange,
      setChromosomeZoom,
    ]
  );

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Left click only
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        centerPosition: effectiveZoom.centerPosition,
      });
    },
    [effectiveZoom.centerPosition]
  );

  // Handle drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !activeChromosome) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaBp = -deltaX * effectiveZoom.bpPerPx;
      const newCenter = dragStart.centerPosition + deltaBp;

      const halfWidth = (effectiveWidth * effectiveZoom.bpPerPx) / 2;
      const clampedCenter = Math.max(
        halfWidth,
        Math.min(chromosomeLength - halfWidth, newCenter)
      );

      setChromosomeZoom(activeChromosome, {
        ...effectiveZoom,
        centerPosition: clampedCenter,
      });
    },
    [
      isDragging,
      activeChromosome,
      dragStart,
      effectiveZoom,
      effectiveWidth,
      chromosomeLength,
      setChromosomeZoom,
    ]
  );

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredGene(null);
  }, [setHoveredGene]);

  // Zoom controls
  const handleZoomIn = () => {
    if (!activeChromosome) return;
    const newBpPerPx = Math.max(100, effectiveZoom.bpPerPx * 0.5);
    setChromosomeZoom(activeChromosome, {
      ...effectiveZoom,
      bpPerPx: newBpPerPx,
    });
  };

  const handleZoomOut = () => {
    if (!activeChromosome) return;
    const maxBpPerPx = chromosomeLength / effectiveWidth;
    const newBpPerPx = Math.min(maxBpPerPx, effectiveZoom.bpPerPx * 2);
    setChromosomeZoom(activeChromosome, {
      ...effectiveZoom,
      bpPerPx: newBpPerPx,
    });
  };

  const handleReset = () => {
    if (!activeChromosome) return;
    setChromosomeZoom(activeChromosome, {
      bpPerPx: chromosomeLength / effectiveWidth,
      centerPosition: chromosomeLength / 2,
      chromosome: activeChromosome,
    });
  };

  // Get genes in visible range
  const visibleGenes = useMemo(() => {
    if (!activeChromosome || !traitsLoaded) return [];
    return getGenesInRange(
      activeChromosome,
      visibleRange.start,
      visibleRange.end
    );
  }, [activeChromosome, visibleRange, traitsLoaded]);

  // Get genomic features in visible range
  const visibleFeatures = useMemo(() => {
    if (!activeChromosome || !genomicFeaturesLoaded) return [];
    return getFeaturesInRange(
      activeChromosome,
      visibleRange.start,
      visibleRange.end
    );
  }, [activeChromosome, visibleRange, genomicFeaturesLoaded]);

  // Get cytobands in visible range
  const visibleCytobands = useMemo(() => {
    if (!activeChromosome) return [];
    return getCytobandsInRange(
      activeChromosome,
      visibleRange.start,
      visibleRange.end
    );
  }, [activeChromosome, visibleRange]);

  // Get SNPs in visible range
  const visibleSNPs = useMemo(() => {
    if (!activeChromosome) return [];
    return getSNPsInRange(
      activeChromosome,
      visibleRange.start,
      visibleRange.end
    );
  }, [activeChromosome, visibleRange]);

  // Get ancestry segments in visible range
  const maternalSegments = useMemo(() => {
    if (!activeChromosome) return [];
    return getAncestrySegmentsInRange(
      activeChromosome,
      visibleRange.start,
      visibleRange.end,
      'maternal'
    );
  }, [activeChromosome, visibleRange]);

  const paternalSegments = useMemo(() => {
    if (!activeChromosome) return [];
    return getAncestrySegmentsInRange(
      activeChromosome,
      visibleRange.start,
      visibleRange.end,
      'paternal'
    );
  }, [activeChromosome, visibleRange]);

  // Check if data is phased
  const dataIsPhased = isPhased();

  // Get overall ancestry composition for legend
  const ancestryComposition = useMemo(() => {
    return getAncestryComposition();
  }, []);

  // Helper to format segment size
  const formatSegmentSize = (start: number, end: number): string => {
    const size = end - start;
    if (size >= 1000000) return `${(size / 1000000).toFixed(1)} Mb`;
    if (size >= 1000) return `${(size / 1000).toFixed(0)} kb`;
    return `${size} bp`;
  };

  // Format position for ruler
  const formatBp = (bp: number): string => {
    if (bp >= 1000000) return `${(bp / 1000000).toFixed(1)}M`;
    if (bp >= 1000) return `${(bp / 1000).toFixed(0)}K`;
    return `${bp}`;
  };

  // Generate ruler ticks
  const rulerTicks = useMemo(() => {
    const range = visibleRange.end - visibleRange.start;
    let interval: number;

    if (range > 100000000) interval = 20000000;
    else if (range > 50000000) interval = 10000000;
    else if (range > 10000000) interval = 5000000;
    else if (range > 5000000) interval = 1000000;
    else if (range > 1000000) interval = 500000;
    else if (range > 500000) interval = 100000;
    else if (range > 100000) interval = 50000;
    else if (range > 50000) interval = 10000;
    else if (range > 10000) interval = 5000;
    else interval = 1000;

    const ticks: { x: number; label: string }[] = [];
    const start = Math.ceil(visibleRange.start / interval) * interval;

    for (let bp = start; bp <= visibleRange.end; bp += interval) {
      ticks.push({
        x: scale.scale(bp),
        label: formatBp(bp),
      });
    }
    return ticks;
  }, [visibleRange, scale]);

  if (!activeChromosome) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 text-gray-400 h-full w-full ${className}`}
      >
        Select a chromosome to begin
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white h-full w-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="text-sm font-medium text-gray-700">
          Chr {activeChromosome} &middot; {formatBp(visibleRange.start)} -{' '}
          {formatBp(visibleRange.end)}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-8 w-8"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-8 w-8"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="h-8 w-8"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main browser area */}
      <div
        ref={containerRef}
        className={`flex-1 relative select-none overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          className="block absolute inset-0 w-full h-full"
          viewBox={`0 0 ${effectiveWidth} ${effectiveHeight}`}
          preserveAspectRatio="xMidYMin meet"
        >
          {/* Background */}
          <rect
            width={effectiveWidth}
            height={effectiveHeight}
            fill="#fafafa"
          />

          {/* Ruler area */}
          <g>
            <rect
              x={0}
              y={0}
              width={effectiveWidth}
              height={16}
              fill="#f5f5f5"
            />
            <line
              x1={0}
              y1={16}
              x2={effectiveWidth}
              y2={16}
              stroke="#e5e5e5"
              strokeWidth={1}
            />

            {/* Ruler ticks */}
            {rulerTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={tick.x}
                  y1={11}
                  x2={tick.x}
                  y2={16}
                  stroke="#999"
                  strokeWidth={1}
                />
                <text
                  x={tick.x < 20 ? tick.x : tick.x}
                  y={9}
                  textAnchor={tick.x < 20 ? 'start' : 'middle'}
                  fontSize={7}
                  fill="#666"
                >
                  {tick.label}
                </text>
              </g>
            ))}
          </g>

          {/* Cytoband track */}
          <g transform="translate(0, 18)">
            <text x={4} y={7} fontSize={7} fill="#888" fontWeight={500}>
              Cytobands
            </text>
            <g transform="translate(0, 9)">
              {/* Chromosome outline */}
              <rect
                x={0}
                y={0}
                width={effectiveWidth}
                height={10}
                rx={5}
                fill="#f0f0f0"
                stroke="#d0d0d0"
                strokeWidth={1}
              />
              {/* Cytoband segments */}
              {visibleCytobands.map((band, i) => {
                const x = Math.max(0, scale.scale(band.chromStart));
                const xEnd = Math.min(
                  effectiveWidth,
                  scale.scale(band.chromEnd)
                );
                const width = Math.max(1, xEnd - x);
                const isFirst =
                  i === 0 || band.chromStart <= visibleRange.start;
                const isLast =
                  i === visibleCytobands.length - 1 ||
                  band.chromEnd >= visibleRange.end;

                return (
                  <rect
                    key={`${band.name}-${i}`}
                    x={x}
                    y={1}
                    width={width}
                    height={8}
                    rx={isFirst || isLast ? 4 : 0}
                    fill={CYTOBAND_COLORS[band.stain]}
                    stroke={band.stain === 'acen' ? '#991b1b' : 'none'}
                    strokeWidth={band.stain === 'acen' ? 1 : 0}
                  />
                );
              })}
              {/* Band labels when zoomed in */}
              {visibleCytobands.map((band, i) => {
                const x = scale.scale(band.chromStart);
                const xEnd = scale.scale(band.chromEnd);
                const width = xEnd - x;
                if (width < 25) return null;

                return (
                  <text
                    key={`label-${band.name}-${i}`}
                    x={x + width / 2}
                    y={7}
                    textAnchor="middle"
                    fontSize={6}
                    fill={band.stain.includes('gpos') ? '#fff' : '#666'}
                    className="pointer-events-none"
                  >
                    {band.name}
                  </text>
                );
              })}
            </g>
          </g>

          {/* Ancestry Painting track */}
          <g transform="translate(0, 40)">
            <text x={4} y={7} fontSize={7} fill="#888" fontWeight={500}>
              Ancestry {dataIsPhased ? '(Phased)' : ''}
            </text>

            {dataIsPhased ? (
              /* Split view: Maternal on top, Paternal on bottom */
              <g transform="translate(0, 10)">
                {/* Maternal label with background */}
                <rect
                  x={2}
                  y={-1}
                  width={50}
                  height={10}
                  rx={2}
                  fill="white"
                  opacity={0.85}
                />
                <text x={4} y={7} fontSize={7} fill="#e91e63" fontWeight={600}>
                  ♀ Maternal
                </text>
                {/* Maternal segments */}
                <g transform="translate(0, 10)">
                  {maternalSegments.map((segment, i) => {
                    const x = Math.max(0, scale.scale(segment.start));
                    const xEnd = Math.min(
                      effectiveWidth,
                      scale.scale(segment.end)
                    );
                    const width = Math.max(1, xEnd - x);
                    const isHovered = ancestryTooltip?.segment === segment;

                    return (
                      <rect
                        key={`mat-${i}`}
                        x={x}
                        y={0}
                        width={width}
                        height={10}
                        fill={POPULATION_COLORS[segment.population]}
                        opacity={isHovered ? 1 : 0.85}
                        stroke={isHovered ? '#000' : 'none'}
                        strokeWidth={isHovered ? 1 : 0}
                        className="cursor-pointer transition-opacity"
                        onMouseEnter={e => {
                          setAncestryTooltip({
                            segment,
                            position: { x: e.clientX, y: e.clientY },
                          });
                        }}
                        onMouseMove={e => {
                          setAncestryTooltip({
                            segment,
                            position: { x: e.clientX, y: e.clientY },
                          });
                        }}
                        onMouseLeave={() => setAncestryTooltip(null)}
                      />
                    );
                  })}
                </g>

                {/* Paternal label with background */}
                <rect
                  x={2}
                  y={22}
                  width={48}
                  height={10}
                  rx={2}
                  fill="white"
                  opacity={0.85}
                />
                <text x={4} y={30} fontSize={7} fill="#2196f3" fontWeight={600}>
                  ♂ Paternal
                </text>
                {/* Paternal segments */}
                <g transform="translate(0, 34)">
                  {paternalSegments.map((segment, i) => {
                    const x = Math.max(0, scale.scale(segment.start));
                    const xEnd = Math.min(
                      effectiveWidth,
                      scale.scale(segment.end)
                    );
                    const width = Math.max(1, xEnd - x);
                    const isHovered = ancestryTooltip?.segment === segment;

                    return (
                      <rect
                        key={`pat-${i}`}
                        x={x}
                        y={0}
                        width={width}
                        height={10}
                        fill={POPULATION_COLORS[segment.population]}
                        opacity={isHovered ? 1 : 0.85}
                        stroke={isHovered ? '#000' : 'none'}
                        strokeWidth={isHovered ? 1 : 0}
                        className="cursor-pointer transition-opacity"
                        onMouseEnter={e => {
                          setAncestryTooltip({
                            segment,
                            position: { x: e.clientX, y: e.clientY },
                          });
                        }}
                        onMouseMove={e => {
                          setAncestryTooltip({
                            segment,
                            position: { x: e.clientX, y: e.clientY },
                          });
                        }}
                        onMouseLeave={() => setAncestryTooltip(null)}
                      />
                    );
                  })}
                </g>
              </g>
            ) : (
              /* Unphased view: single track */
              <g transform="translate(0, 12)">
                {maternalSegments.concat(paternalSegments).map((segment, i) => {
                  const x = Math.max(0, scale.scale(segment.start));
                  const xEnd = Math.min(
                    effectiveWidth,
                    scale.scale(segment.end)
                  );
                  const width = Math.max(1, xEnd - x);
                  const isHovered = ancestryTooltip?.segment === segment;

                  return (
                    <rect
                      key={`anc-${i}`}
                      x={x}
                      y={0}
                      width={width}
                      height={14}
                      fill={POPULATION_COLORS[segment.population]}
                      opacity={isHovered ? 1 : 0.85}
                      stroke={isHovered ? '#000' : 'none'}
                      strokeWidth={isHovered ? 1 : 0}
                      className="cursor-pointer transition-opacity"
                      onMouseEnter={e => {
                        setAncestryTooltip({
                          segment,
                          position: { x: e.clientX, y: e.clientY },
                        });
                      }}
                      onMouseMove={e => {
                        setAncestryTooltip({
                          segment,
                          position: { x: e.clientX, y: e.clientY },
                        });
                      }}
                      onMouseLeave={() => setAncestryTooltip(null)}
                    />
                  );
                })}
              </g>
            )}

            {/* Improved Ancestry Legend - shows top populations with percentages */}
            <g
              transform={`translate(${effectiveWidth - 350}, ${dataIsPhased ? 60 : 28})`}
            >
              {ancestryComposition
                .filter(c => c.percentage >= 2) // Only show populations >= 2%
                .slice(0, 5)
                .map((comp, i) => (
                  <g
                    key={comp.population}
                    transform={`translate(${i * 70}, 0)`}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={8}
                      height={8}
                      rx={1}
                      fill={
                        POPULATION_COLORS[comp.population as AncestryPopulation]
                      }
                    />
                    <text
                      x={10}
                      y={6}
                      fontSize={6}
                      fill="#555"
                      fontWeight={500}
                    >
                      {comp.percentage.toFixed(0)}%
                    </text>
                    <text x={10} y={13} fontSize={5} fill="#888">
                      {comp.displayName.length > 8
                        ? comp.displayName.slice(0, 7) + '…'
                        : comp.displayName}
                    </text>
                  </g>
                ))}
            </g>
          </g>

          {/* Your Variants (SNPs) track */}
          <g transform="translate(0, 120)">
            <rect
              x={0}
              y={0}
              width={effectiveWidth}
              height={40}
              fill="#fef2f2"
            />
            <text x={4} y={7} fontSize={7} fill="#888" fontWeight={500}>
              Your Variants{' '}
              {visibleSNPs.length > 0 && `(${visibleSNPs.length})`}
            </text>

            {visibleSNPs.length === 0 ? (
              <text
                x={effectiveWidth / 2}
                y={22}
                textAnchor="middle"
                fontSize={7}
                fill="#bbb"
              >
                {effectiveZoom.bpPerPx > 500000
                  ? 'Zoom in to see your variants'
                  : 'No annotated variants in this region'}
              </text>
            ) : (
              visibleSNPs.map(snp => {
                const x = scale.scale(snp.position);
                const isHovered = snpTooltip?.snp === snp;

                return (
                  <g
                    key={snp.rsid}
                    className="cursor-pointer"
                    onMouseEnter={e => {
                      setSnpTooltip({
                        snp,
                        position: { x: e.clientX, y: e.clientY },
                      });
                    }}
                    onMouseMove={e => {
                      setSnpTooltip({
                        snp,
                        position: { x: e.clientX, y: e.clientY },
                      });
                    }}
                    onMouseLeave={() => setSnpTooltip(null)}
                  >
                    {/* SNP marker - diamond shape */}
                    <path
                      d={`M${x} 14 L${x + 5} 20 L${x} 26 L${x - 5} 20 Z`}
                      fill={SNP_COLORS[snp.category]}
                      stroke={isHovered ? '#000' : 'white'}
                      strokeWidth={isHovered ? 1.5 : 0.5}
                      opacity={isHovered ? 1 : 0.9}
                    />
                    {/* Risk allele indicator */}
                    {snp.hasRiskAllele && (
                      <circle cx={x} cy={20} r={1.5} fill="white" />
                    )}
                    {/* Label when zoomed in */}
                    {effectiveZoom.bpPerPx < 50000 && (
                      <text
                        x={x}
                        y={34}
                        textAnchor="middle"
                        fontSize={6}
                        fill="#666"
                        className="pointer-events-none"
                      >
                        {snp.gene || snp.rsid}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {/* SNP category legend */}
            {visibleSNPs.length > 0 && (
              <g transform={`translate(${effectiveWidth - 280}, 30)`}>
                {(
                  [
                    { cat: 'trait', label: 'Trait' },
                    { cat: 'health', label: 'Health' },
                    { cat: 'pharmacogenomics', label: 'Drug' },
                    { cat: 'neanderthal', label: 'Archaic' },
                  ] as { cat: SNPCategory; label: string }[]
                ).map((item, i) => (
                  <g key={item.cat} transform={`translate(${i * 70}, 0)`}>
                    <path
                      d={`M0 0 L3 3 L0 6 L-3 3 Z`}
                      fill={SNP_COLORS[item.cat]}
                    />
                    <text x={6} y={5} fontSize={6} fill="#888">
                      {item.label}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </g>

          {/* Genes track */}
          <g transform="translate(0, 163)">
            <text x={4} y={7} fontSize={7} fill="#888" fontWeight={500}>
              Trait Genes
            </text>

            {visibleGenes.length === 0 ? (
              <text
                x={effectiveWidth / 2}
                y={22}
                textAnchor="middle"
                fontSize={7}
                fill="#bbb"
              >
                {effectiveZoom.bpPerPx > 500000
                  ? 'Zoom in to see genes'
                  : 'No trait-associated genes in this region'}
              </text>
            ) : (
              visibleGenes.map(gene => {
                const x = scale.scale(gene.start);
                const width = Math.max(4, scale.scale(gene.end) - x);
                const displayName = getGeneDisplayName(
                  gene.symbol,
                  gene.nickname,
                  viewMode
                );

                return (
                  <g
                    key={gene.id}
                    className="cursor-pointer"
                    onMouseEnter={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredGene(gene.id, {
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredGene(null)}
                    onClick={() => selectGene(gene.id)}
                  >
                    <rect
                      x={x}
                      y={14}
                      width={width}
                      height={14}
                      rx={2}
                      fill={gene.color || '#3b82f6'}
                      opacity={0.85}
                      className="hover:opacity-100 transition-opacity"
                    />
                    {/* Strand arrow */}
                    {width > 16 && (
                      <path
                        d={
                          gene.strand === '+'
                            ? `M${x + width - 6} 18 l4 3 l-4 3`
                            : `M${x + 6} 18 l-4 3 l4 3`
                        }
                        fill="white"
                        opacity={0.6}
                      />
                    )}
                    {/* Label */}
                    {width > 40 && (
                      <text
                        x={x + width / 2}
                        y={24}
                        textAnchor="middle"
                        fontSize={Math.min(8, width / 6)}
                        fill="white"
                        fontWeight={500}
                        className="pointer-events-none"
                      >
                        {displayName.length > width / 5
                          ? displayName.slice(0, Math.floor(width / 5)) + '…'
                          : displayName}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </g>

          {/* Genomic Features track (HERVs, transposons, etc.) */}
          <g transform="translate(0, 200)">
            <rect
              x={0}
              y={0}
              width={effectiveWidth}
              height={55}
              fill="#fef7ed"
            />
            <text x={4} y={7} fontSize={7} fill="#888" fontWeight={500}>
              Genomic Oddities{' '}
              {visibleFeatures.length > 0 && `(${visibleFeatures.length})`}
            </text>

            {visibleFeatures.length === 0 ? (
              <text
                x={effectiveWidth / 2}
                y={22}
                textAnchor="middle"
                fontSize={7}
                fill="#bbb"
              >
                {effectiveZoom.bpPerPx > 500000
                  ? 'Zoom in to see genomic features'
                  : 'No quirky features in this region'}
              </text>
            ) : (
              visibleFeatures.map(feature => {
                const x = scale.scale(feature.start);
                const width = Math.max(6, scale.scale(feature.end) - x);
                const displayName =
                  viewMode === 'play' && feature.nickname
                    ? feature.nickname
                    : feature.name;

                return (
                  <g
                    key={feature.id}
                    className="cursor-pointer"
                    onMouseEnter={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredFeature(feature.id, {
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredFeature(null)}
                    onClick={() => selectFeature(feature.id)}
                  >
                    {/* Feature body */}
                    <rect
                      x={x}
                      y={14}
                      width={width}
                      height={12}
                      rx={feature.type === 'herv' ? 0 : 2}
                      fill={feature.color}
                      opacity={0.8}
                      className="hover:opacity-100 transition-opacity"
                    />
                    {/* HERV LTR markers */}
                    {feature.type === 'herv' && width > 10 && (
                      <>
                        <rect
                          x={x}
                          y={14}
                          width={2}
                          height={12}
                          fill={feature.color}
                        />
                        <rect
                          x={x + width - 2}
                          y={14}
                          width={2}
                          height={12}
                          fill={feature.color}
                        />
                      </>
                    )}
                    {/* Pseudogene "broken" indicator */}
                    {feature.type === 'pseudogene' && width > 12 && (
                      <g opacity={0.6}>
                        <line
                          x1={x + 3}
                          y1={16}
                          x2={x + 8}
                          y2={24}
                          stroke="white"
                          strokeWidth={1}
                        />
                        <line
                          x1={x + 8}
                          y1={16}
                          x2={x + 3}
                          y2={24}
                          stroke="white"
                          strokeWidth={1}
                        />
                      </g>
                    )}
                    {/* Label */}
                    {width > 40 && (
                      <text
                        x={x + width / 2}
                        y={23}
                        textAnchor="middle"
                        fontSize={Math.min(7, width / 7)}
                        fill="white"
                        fontWeight={500}
                        className="pointer-events-none"
                        style={{ textShadow: '0 1px 1px rgba(0,0,0,0.5)' }}
                      >
                        {displayName.length > width / 5
                          ? displayName.slice(0, Math.floor(width / 5)) + '...'
                          : displayName}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {/* Feature type mini-legend */}
            {visibleFeatures.length > 0 && (
              <g transform={`translate(${effectiveWidth - 350}, 38)`}>
                {[
                  { type: 'herv', label: 'Virus', color: '#dc2626' },
                  { type: 'line', label: 'LINEs', color: '#2563eb' },
                  { type: 'pseudogene', label: 'Fossil', color: '#78716c' },
                  { type: 'numt', label: 'Mito', color: '#14b8a6' },
                  { type: 'har', label: 'HAR', color: '#f59e0b' },
                  { type: 'neanderthal', label: 'Neand.', color: '#8b5cf6' },
                  { type: 'gene_desert', label: 'Desert', color: '#fbbf24' },
                ].map((item, i) => (
                  <g key={item.type} transform={`translate(${i * 50}, 0)`}>
                    <rect
                      x={0}
                      y={0}
                      width={6}
                      height={6}
                      rx={1}
                      fill={item.color}
                      opacity={0.8}
                    />
                    <text x={8} y={5} fontSize={6} fill="#888">
                      {item.label}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Navigation Bar - separate from tracks */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 border-t border-gray-200">
        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
          Chr {activeChromosome}
        </span>
        <div className="flex-1 relative h-6 bg-gray-200 rounded-full overflow-hidden">
          {/* Full chromosome background */}
          <div className="absolute inset-0 rounded-full" />
          {/* Viewport indicator */}
          <div
            className="absolute top-1 bottom-1 bg-gray-700 rounded-full transition-all duration-75 cursor-grab hover:bg-gray-600"
            style={{
              left: `${(visibleRange.start / chromosomeLength) * 100}%`,
              width: `${Math.max(2, ((visibleRange.end - visibleRange.start) / chromosomeLength) * 100)}%`,
            }}
          />
          {/* Centromere marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-400 opacity-50"
            style={{ left: '45%' }}
          />
        </div>
        <span className="text-xs text-gray-400 font-mono whitespace-nowrap min-w-[100px] text-right">
          {formatBp(chromosomeLength)}
        </span>
      </div>

      {/* Tooltip and Panel */}
      <Tooltip />
      <DetailPanel />

      {/* Ancestry Tooltip */}
      {ancestryTooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: Math.min(
              ancestryTooltip.position.x + 15,
              window.innerWidth - 240
            ),
            top: Math.min(
              ancestryTooltip.position.y + 15,
              window.innerHeight - 200
            ),
          }}
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[220px]">
            {/* Header with color */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-4 h-4 rounded"
                style={{
                  backgroundColor:
                    POPULATION_COLORS[ancestryTooltip.segment.population],
                }}
              />
              <div>
                <div className="font-semibold text-sm text-gray-900">
                  {POPULATION_DISPLAY_NAMES[ancestryTooltip.segment.population]}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {ancestryTooltip.segment.category.replace('_', ' ')}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Inherited from:</span>
                <span
                  className={`font-medium ${
                    ancestryTooltip.segment.parent === 'maternal'
                      ? 'text-pink-600'
                      : 'text-blue-600'
                  }`}
                >
                  {ancestryTooltip.segment.parent === 'maternal'
                    ? '♀ Mother'
                    : '♂ Father'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Segment size:</span>
                <span className="font-medium text-gray-700">
                  {formatSegmentSize(
                    ancestryTooltip.segment.start,
                    ancestryTooltip.segment.end
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Position:</span>
                <span className="font-mono text-gray-600 text-[10px]">
                  {formatBp(ancestryTooltip.segment.start)} -{' '}
                  {formatBp(ancestryTooltip.segment.end)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Confidence:</span>
                <span className="font-medium text-gray-700">
                  {(ancestryTooltip.segment.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${ancestryTooltip.segment.confidence * 100}%`,
                  backgroundColor:
                    POPULATION_COLORS[ancestryTooltip.segment.population],
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SNP Tooltip */}
      {snpTooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: Math.min(snpTooltip.position.x + 15, window.innerWidth - 290),
            top: Math.min(snpTooltip.position.y + 15, window.innerHeight - 280),
          }}
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[260px] max-w-[300px]">
            {/* Header */}
            <div className="flex items-start gap-2 mb-2">
              <div
                className="w-4 h-4 rotate-45 flex-shrink-0 mt-0.5"
                style={{ backgroundColor: SNP_COLORS[snpTooltip.snp.category] }}
              />
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900">
                  {snpTooltip.snp.name || snpTooltip.snp.rsid}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="font-mono">{snpTooltip.snp.rsid}</span>
                  {snpTooltip.snp.gene && (
                    <span className="text-blue-600">
                      ({snpTooltip.snp.gene})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Your Genotype - highlighted */}
            <div className="bg-gray-50 rounded-md p-2 mb-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Your genotype:</span>
                <span className="font-mono font-bold text-lg text-gray-900">
                  {snpTooltip.snp.genotype}
                </span>
              </div>
              {snpTooltip.snp.hasRiskAllele && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                    You carry the {snpTooltip.snp.riskAllele} allele
                  </span>
                </div>
              )}
            </div>

            {/* Trait association */}
            {snpTooltip.snp.traitAssociation && (
              <div className="text-sm text-gray-700 mb-2">
                <span className="font-medium">Associated with: </span>
                {snpTooltip.snp.traitAssociation}
              </div>
            )}

            {/* Fun fact */}
            {snpTooltip.snp.funFact && (
              <div className="text-xs text-gray-600 italic border-l-2 border-purple-300 pl-2 mb-2">
                {snpTooltip.snp.funFact}
              </div>
            )}

            {/* Details row */}
            <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span>
                Position:{' '}
                <span className="font-mono">
                  {formatBp(snpTooltip.snp.position)}
                </span>
              </span>
              {snpTooltip.snp.globalFrequency !== undefined && (
                <span>
                  Global freq:{' '}
                  {(snpTooltip.snp.globalFrequency * 100).toFixed(0)}%
                </span>
              )}
            </div>

            {/* Confidence/Source */}
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span className="capitalize">
                {snpTooltip.snp.confidence} confidence
              </span>
              {snpTooltip.snp.source && <span>{snpTooltip.snp.source}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
