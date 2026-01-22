/**
 * Tour Overlay - Creates spotlight effect around target element
 */

import { useEffect, useState, type JSX } from 'react';
import { useTour } from './TourProvider';
import { TourTooltip } from './TourTooltip';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8; // Padding around highlighted element

export function TourOverlay(): JSX.Element | null {
  const { isActive, currentStepData, skipTour } = useTour();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  // Find and track the target element
  useEffect(() => {
    if (!isActive || !currentStepData) {
      setTargetRect(null);
      return;
    }

    const findTarget = () => {
      const target = document.querySelector(
        `[data-tour="${currentStepData.target}"]`
      );

      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect({
          top: rect.top - PADDING,
          left: rect.left - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
        });

        // Scroll into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    };

    // Find immediately and on resize
    findTarget();
    const resizeObserver = new ResizeObserver(findTarget);
    resizeObserver.observe(document.body);

    // Also check periodically in case of dynamic content
    const interval = setInterval(findTarget, 500);

    return () => {
      resizeObserver.disconnect();
      clearInterval(interval);
    };
  }, [isActive, currentStepData]);

  if (!isActive || !currentStepData) {
    return null;
  }

  // Create spotlight using box-shadow technique
  const spotlightStyle = targetRect
    ? {
        position: 'fixed' as const,
        top: targetRect.top,
        left: targetRect.left,
        width: targetRect.width,
        height: targetRect.height,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
        borderRadius: '8px',
        pointerEvents: 'none' as const,
        zIndex: 9998,
      }
    : null;

  return (
    <>
      {/* Backdrop that captures clicks outside spotlight */}
      <div
        className="fixed inset-0 z-[9997]"
        onClick={skipTour}
        aria-hidden="true"
      />

      {/* Spotlight cutout */}
      {spotlightStyle && <div style={spotlightStyle} />}

      {/* Pulse animation on target */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[9998] rounded-lg animate-pulse"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            border: '2px solid rgba(59, 130, 246, 0.5)',
          }}
        />
      )}

      {/* Tooltip */}
      {targetRect && (
        <TourTooltip step={currentStepData} targetRect={targetRect} />
      )}
    </>
  );
}
