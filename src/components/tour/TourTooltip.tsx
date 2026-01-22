/**
 * Tour Tooltip - Positioned tooltip with navigation buttons
 */

import { useMemo, type JSX } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTour } from './TourProvider';
import type { TourStep } from './tours';

interface TourTooltipProps {
  step: TourStep;
  targetRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

const TOOLTIP_WIDTH = 320;
const TOOLTIP_OFFSET = 16;

export function TourTooltip({
  step,
  targetRect,
}: TourTooltipProps): JSX.Element {
  const {
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  // Calculate tooltip position
  const position = useMemo(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = targetRect.top - TOOLTIP_OFFSET;
        left = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
        break;
      case 'bottom':
        top = targetRect.top + targetRect.height + TOOLTIP_OFFSET;
        left = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left + targetRect.width + TOOLTIP_OFFSET;
        break;
    }

    // Keep within viewport bounds
    left = Math.max(16, Math.min(left, viewportWidth - TOOLTIP_WIDTH - 16));
    top = Math.max(16, Math.min(top, viewportHeight - 200));

    return { top, left };
  }, [step.position, targetRect]);

  // Determine if tooltip should render above or below based on position
  const isAbove = step.position === 'top';

  return (
    <div
      className={cn(
        'fixed z-[9999] bg-white rounded-xl shadow-2xl border',
        'transform transition-all duration-200',
        isAbove ? '-translate-y-full' : ''
      )}
      style={{
        top: position.top,
        left: position.left,
        width: TOOLTIP_WIDTH,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-gray-600">
            Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
        <button
          onClick={skipTour}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pb-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              i === currentStep ? 'bg-blue-500' : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 rounded-b-xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevStep}
          disabled={isFirstStep}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={nextStep}
          className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600"
        >
          {isLastStep ? (
            "Let's Go!"
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
