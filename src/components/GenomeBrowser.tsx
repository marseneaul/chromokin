/**
 * GenomeBrowser - Clean, interactive genome visualization
 * Features: drag-to-pan, scroll-to-zoom, minimal design
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
import { getGeneDisplayName } from '@/lib/content';
import { Tooltip } from '@/components/interaction/Tooltip';
import { DetailPanel } from '@/components/interaction/DetailPanel';

interface GenomeBrowserProps {
  className?: string;
}

export function GenomeBrowser({
  className = '',
}: GenomeBrowserProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, centerPosition: 0 });

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

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const halfWidth = (dimensions.width * effectiveZoom.bpPerPx) / 2;
    return {
      start: Math.max(0, effectiveZoom.centerPosition - halfWidth),
      end: Math.min(chromosomeLength, effectiveZoom.centerPosition + halfWidth),
    };
  }, [effectiveZoom, dimensions.width, chromosomeLength]);

  // Create scale for coordinate transformation
  const scale = useMemo(() => {
    return new Scale(
      [visibleRange.start, visibleRange.end],
      [0, dimensions.width]
    );
  }, [visibleRange, dimensions.width]);

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!activeChromosome) return;
      e.preventDefault();

      const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8; // Zoom out / in
      const newBpPerPx = Math.max(
        100, // Min zoom (very zoomed in)
        Math.min(
          chromosomeLength / dimensions.width, // Max zoom (whole chromosome)
          effectiveZoom.bpPerPx * zoomFactor
        )
      );

      // Zoom towards mouse position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseRatio = mouseX / dimensions.width;
        const mouseBp =
          visibleRange.start +
          mouseRatio * (visibleRange.end - visibleRange.start);

        // Adjust center to keep mouse position stable
        const newHalfWidth = (dimensions.width * newBpPerPx) / 2;
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

      const halfWidth = (dimensions.width * effectiveZoom.bpPerPx) / 2;
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
      dimensions.width,
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
    const maxBpPerPx = chromosomeLength / dimensions.width;
    const newBpPerPx = Math.min(maxBpPerPx, effectiveZoom.bpPerPx * 2);
    setChromosomeZoom(activeChromosome, {
      ...effectiveZoom,
      bpPerPx: newBpPerPx,
    });
  };

  const handleReset = () => {
    if (!activeChromosome) return;
    setChromosomeZoom(activeChromosome, {
      bpPerPx: chromosomeLength / dimensions.width,
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
        className={`flex items-center justify-center bg-gray-50 text-gray-400 ${className}`}
      >
        Select a chromosome to begin
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white ${className}`}>
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
        className={`flex-1 relative select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="block"
        >
          {/* Background */}
          <rect
            width={dimensions.width}
            height={dimensions.height}
            fill="#fafafa"
          />

          {/* Ruler area */}
          <g>
            <rect
              x={0}
              y={0}
              width={dimensions.width}
              height={30}
              fill="#f5f5f5"
            />
            <line
              x1={0}
              y1={30}
              x2={dimensions.width}
              y2={30}
              stroke="#e5e5e5"
              strokeWidth={1}
            />

            {/* Ruler ticks */}
            {rulerTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={tick.x}
                  y1={20}
                  x2={tick.x}
                  y2={30}
                  stroke="#999"
                  strokeWidth={1}
                />
                <text
                  x={tick.x}
                  y={16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#666"
                >
                  {tick.label}
                </text>
              </g>
            ))}
          </g>

          {/* Genes track */}
          <g transform="translate(0, 50)">
            <text x={8} y={14} fontSize={11} fill="#888" fontWeight={500}>
              Trait Genes
            </text>

            {visibleGenes.length === 0 ? (
              <text
                x={dimensions.width / 2}
                y={50}
                textAnchor="middle"
                fontSize={12}
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
                      y={24}
                      width={width}
                      height={20}
                      rx={3}
                      fill={gene.color || '#3b82f6'}
                      opacity={0.85}
                      className="hover:opacity-100 transition-opacity"
                    />
                    {/* Strand arrow */}
                    {width > 20 && (
                      <path
                        d={
                          gene.strand === '+'
                            ? `M${x + width - 8} 30 l5 4 l-5 4`
                            : `M${x + 8} 30 l-5 4 l5 4`
                        }
                        fill="white"
                        opacity={0.6}
                      />
                    )}
                    {/* Label */}
                    {width > 50 && (
                      <text
                        x={x + width / 2}
                        y={38}
                        textAnchor="middle"
                        fontSize={Math.min(10, width / 5)}
                        fill="white"
                        fontWeight={500}
                        className="pointer-events-none"
                      >
                        {displayName.length > width / 6
                          ? displayName.slice(0, Math.floor(width / 6)) + '…'
                          : displayName}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </g>

          {/* Genomic Features track (HERVs, transposons, etc.) */}
          <g transform="translate(0, 130)">
            <rect
              x={0}
              y={0}
              width={dimensions.width}
              height={80}
              fill="#fef7ed"
            />
            <text x={8} y={14} fontSize={11} fill="#888" fontWeight={500}>
              Genomic Oddities{' '}
              {visibleFeatures.length > 0 && `(${visibleFeatures.length})`}
            </text>

            {visibleFeatures.length === 0 ? (
              <text
                x={dimensions.width / 2}
                y={45}
                textAnchor="middle"
                fontSize={12}
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
                      y={24}
                      width={width}
                      height={18}
                      rx={feature.type === 'herv' ? 0 : 2}
                      fill={feature.color}
                      opacity={0.8}
                      className="hover:opacity-100 transition-opacity"
                    />
                    {/* HERV LTR markers */}
                    {feature.type === 'herv' && width > 12 && (
                      <>
                        <rect
                          x={x}
                          y={24}
                          width={3}
                          height={18}
                          fill={feature.color}
                        />
                        <rect
                          x={x + width - 3}
                          y={24}
                          width={3}
                          height={18}
                          fill={feature.color}
                        />
                      </>
                    )}
                    {/* Pseudogene "broken" indicator */}
                    {feature.type === 'pseudogene' && width > 15 && (
                      <g opacity={0.6}>
                        <line
                          x1={x + 4}
                          y1={26}
                          x2={x + 10}
                          y2={40}
                          stroke="white"
                          strokeWidth={1.5}
                        />
                        <line
                          x1={x + 10}
                          y1={26}
                          x2={x + 4}
                          y2={40}
                          stroke="white"
                          strokeWidth={1.5}
                        />
                      </g>
                    )}
                    {/* Label */}
                    {width > 50 && (
                      <text
                        x={x + width / 2}
                        y={37}
                        textAnchor="middle"
                        fontSize={Math.min(9, width / 6)}
                        fill="white"
                        fontWeight={500}
                        className="pointer-events-none"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                      >
                        {displayName.length > width / 6
                          ? displayName.slice(0, Math.floor(width / 6)) + '...'
                          : displayName}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {/* Feature type mini-legend */}
            {visibleFeatures.length > 0 && (
              <g transform={`translate(${dimensions.width - 280}, 60)`}>
                {[
                  { type: 'herv', label: 'Virus DNA', color: '#dc2626' },
                  { type: 'line', label: 'LINEs', color: '#2563eb' },
                  {
                    type: 'pseudogene',
                    label: 'Fossil Genes',
                    color: '#78716c',
                  },
                ].map((item, i) => (
                  <g key={item.type} transform={`translate(${i * 90}, 0)`}>
                    <rect
                      x={0}
                      y={0}
                      width={10}
                      height={10}
                      rx={1}
                      fill={item.color}
                      opacity={0.8}
                    />
                    <text x={14} y={8} fontSize={8} fill="#888">
                      {item.label}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </g>

          {/* Chromosome ideogram placeholder */}
          <g transform={`translate(0, ${dimensions.height - 40})`}>
            <rect
              x={20}
              y={10}
              width={dimensions.width - 40}
              height={16}
              rx={8}
              fill="#e0e0e0"
            />
            <rect
              x={
                20 +
                (visibleRange.start / chromosomeLength) *
                  (dimensions.width - 40)
              }
              y={10}
              width={Math.max(
                4,
                ((visibleRange.end - visibleRange.start) / chromosomeLength) *
                  (dimensions.width - 40)
              )}
              height={16}
              rx={2}
              fill="#3b82f6"
              opacity={0.7}
            />
          </g>
        </svg>
      </div>

      {/* Tooltip and Panel */}
      <Tooltip />
      <DetailPanel />
    </div>
  );
}
