/**
 * Tour step definitions for the onboarding experience
 */

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type PageType = 'overview' | 'browser';

export interface TourStep {
  id: string;
  target: string; // data-tour attribute value
  title: string;
  description: string;
  position: TooltipPosition;
  page: PageType;
}

/**
 * Play mode onboarding tour steps
 */
export const PLAY_MODE_TOUR: TourStep[] = [
  {
    id: 'chromosome-gallery',
    target: 'chromosome-gallery',
    title: 'Your Chromosomes',
    description:
      "These bars represent your 23 pairs of chromosomes. Each one holds thousands of genes! Click any chromosome to explore what's inside.",
    position: 'top',
    page: 'overview',
  },
  {
    id: 'traits-section',
    target: 'traits-section',
    title: 'Your Traits',
    description:
      'These are traits linked to your genes - like eye color, taste preferences, and more. Click one to see which genes are involved!',
    position: 'top',
    page: 'overview',
  },
  {
    id: 'ancestry-section',
    target: 'ancestry-section',
    title: 'Your Ancestry',
    description:
      'This shows where your ancestors came from. The colored bars represent different populations in your family history.',
    position: 'bottom',
    page: 'overview',
  },
  {
    id: 'browser-tracks',
    target: 'browser-tracks',
    title: 'DNA Tracks',
    description:
      'Each row shows different information about your DNA - ancestry segments, your genetic variants, genes, and even ancient virus DNA!',
    position: 'left',
    page: 'browser',
  },
  {
    id: 'zoom-controls',
    target: 'zoom-controls',
    title: 'Zoom & Navigate',
    description:
      'Use these buttons to zoom in and out. You can also scroll with your mouse wheel or drag to move around!',
    position: 'bottom',
    page: 'browser',
  },
];

/**
 * Get tour steps for a specific page
 */
export function getStepsForPage(page: PageType): TourStep[] {
  return PLAY_MODE_TOUR.filter(step => step.page === page);
}

/**
 * Get the next step that should show on a different page
 */
export function getNextPageStep(
  currentStepIndex: number
): { step: TourStep; index: number } | null {
  const currentStep = PLAY_MODE_TOUR[currentStepIndex];
  if (!currentStep) return null;

  for (let i = currentStepIndex + 1; i < PLAY_MODE_TOUR.length; i++) {
    if (PLAY_MODE_TOUR[i].page !== currentStep.page) {
      return { step: PLAY_MODE_TOUR[i], index: i };
    }
  }
  return null;
}
