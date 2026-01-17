/**
 * TrackContainer - Container for rendering genomic tracks
 * Manages coordinate transformation and renders child tracks
 */

import { type JSX, useMemo, useEffect } from 'react';
import { Scale } from '@/scales/scale';
import { GenesTrack } from './GenesTrack';
import { TraitsTrack } from './TraitsTrack';
import { useAppStore, useLoadTraits, useTraitsLoaded } from '@/state/appState';
import type { TrackSpec, ZoomState } from '@/types/core';

interface TrackContainerProps {
  chromosome: string;
  chromosomeLength: number;
  zoomState: ZoomState;
  containerWidth: number;
  tracks: TrackSpec[];
}

export function TrackContainer({
  chromosome,
  chromosomeLength,
  zoomState,
  containerWidth,
  tracks,
}: TrackContainerProps): JSX.Element {
  const traitsLoaded = useTraitsLoaded();
  const loadTraits = useLoadTraits();
  const viewMode = useAppStore(state => state.viewMode);

  // Load traits database on first render
  useEffect(() => {
    if (!traitsLoaded) {
      loadTraits();
    }
  }, [traitsLoaded, loadTraits]);

  // Create scale for coordinate transformation
  const scale = useMemo(() => {
    const { bpPerPx, centerPosition } = zoomState;
    const halfWidth = (containerWidth * bpPerPx) / 2;
    const domainStart = Math.max(0, centerPosition - halfWidth);
    const domainEnd = Math.min(chromosomeLength, centerPosition + halfWidth);

    return new Scale([domainStart, domainEnd], [0, containerWidth]);
  }, [zoomState, containerWidth, chromosomeLength]);

  // Calculate visible range in base pairs
  const visibleRange = useMemo(() => {
    return {
      start: scale.domain[0],
      end: scale.domain[1],
    };
  }, [scale]);

  // Get visible tracks
  const visibleTracks = useMemo(() => {
    return tracks.filter(track => track.visible);
  }, [tracks]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    return visibleTracks.reduce(
      (sum, track) => sum + (track.heightPx || 60),
      0
    );
  }, [visibleTracks]);

  // Render appropriate track component based on type
  const renderTrack = (track: TrackSpec, yOffset: number) => {
    const height = track.heightPx || 60;

    switch (track.type) {
      case 'genes':
        return (
          <g key={track.id} transform={`translate(0, ${yOffset})`}>
            <GenesTrack
              chromosome={chromosome}
              visibleRange={visibleRange}
              scale={scale}
              height={height}
              viewMode={viewMode}
            />
          </g>
        );
      case 'traits':
        return (
          <g key={track.id} transform={`translate(0, ${yOffset})`}>
            <TraitsTrack
              chromosome={chromosome}
              visibleRange={visibleRange}
              scale={scale}
              height={height}
              viewMode={viewMode}
            />
          </g>
        );
      default:
        // Placeholder for other track types
        return (
          <g key={track.id} transform={`translate(0, ${yOffset})`}>
            <rect
              x={0}
              y={0}
              width={containerWidth}
              height={height}
              fill="transparent"
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            <text
              x={10}
              y={height / 2}
              fill="#9ca3af"
              fontSize={12}
              dominantBaseline="middle"
            >
              {track.name} (coming soon)
            </text>
          </g>
        );
    }
  };

  // Calculate y offsets for each track
  let currentY = 0;
  const trackElements = visibleTracks.map(track => {
    const element = renderTrack(track, currentY);
    currentY += track.heightPx || 60;
    return element;
  });

  return (
    <svg
      width={containerWidth}
      height={totalHeight}
      className="track-container"
    >
      {/* Track labels on the left */}
      <defs>
        <clipPath id="track-clip">
          <rect x={0} y={0} width={containerWidth} height={totalHeight} />
        </clipPath>
      </defs>

      <g clipPath="url(#track-clip)">{trackElements}</g>
    </svg>
  );
}
