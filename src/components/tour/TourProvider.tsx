/**
 * Tour Provider - Context for managing onboarding tour state
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type JSX,
} from 'react';
import { PLAY_MODE_TOUR, type TourStep, type PageType } from './tours';

const STORAGE_KEY = 'chromokin-tour';

interface TourStorage {
  hasSeenTour: boolean;
  dontShowAgain: boolean;
  completedAt: string | null;
}

interface TourContextValue {
  // State
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  showWelcome: boolean;

  // Computed
  currentStepData: TourStep | null;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  currentPage: PageType | null;

  // Actions
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  dismissWelcome: (dontShowAgain: boolean) => void;
  resetTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

/**
 * Load tour state from localStorage
 */
function loadTourStorage(): TourStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {
    hasSeenTour: false,
    dontShowAgain: false,
    completedAt: null,
  };
}

/**
 * Save tour state to localStorage
 */
function saveTourStorage(state: Partial<TourStorage>): void {
  try {
    const current = loadTourStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
  } catch {
    // Ignore storage errors
  }
}

interface TourProviderProps {
  children: ReactNode;
  onNavigate?: (page: 'overview' | 'browser', chromosome?: string) => void;
}

export function TourProvider({
  children,
  onNavigate,
}: TourProviderProps): JSX.Element {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);

  const steps = PLAY_MODE_TOUR;
  const totalSteps = steps.length;
  const currentStepData = isActive ? (steps[currentStep] ?? null) : null;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const currentPage = currentStepData?.page ?? null;

  // Check if should show welcome on mount
  useEffect(() => {
    const storage = loadTourStorage();
    if (!storage.hasSeenTour && !storage.dontShowAgain) {
      // Small delay to let the app render first
      const timer = setTimeout(() => {
        setShowWelcome(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const startTour = useCallback(() => {
    setShowWelcome(false);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      const nextStepData = steps[currentStep + 1];
      const currentStepData = steps[currentStep];

      // Navigate if next step is on a different page
      if (
        nextStepData &&
        currentStepData &&
        nextStepData.page !== currentStepData.page
      ) {
        onNavigate?.(
          nextStepData.page,
          nextStepData.page === 'browser' ? '1' : undefined
        );
      }

      setCurrentStep(prev => prev + 1);
    } else {
      // Last step - complete the tour
      setIsActive(false);
      saveTourStorage({
        hasSeenTour: true,
        completedAt: new Date().toISOString(),
      });
    }
  }, [currentStep, totalSteps, steps, onNavigate]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const prevStepData = steps[currentStep - 1];
      const currentStepData = steps[currentStep];

      // Navigate if previous step is on a different page
      if (
        prevStepData &&
        currentStepData &&
        prevStepData.page !== currentStepData.page
      ) {
        onNavigate?.(prevStepData.page);
      }

      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep, steps, onNavigate]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setShowWelcome(false);
    saveTourStorage({ hasSeenTour: true });
  }, []);

  const completeTour = useCallback(() => {
    setIsActive(false);
    saveTourStorage({
      hasSeenTour: true,
      completedAt: new Date().toISOString(),
    });
  }, []);

  const dismissWelcome = useCallback((dontShowAgain: boolean) => {
    setShowWelcome(false);
    if (dontShowAgain) {
      saveTourStorage({ dontShowAgain: true, hasSeenTour: true });
    }
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentStep(0);
    setIsActive(false);
    setShowWelcome(true);
  }, []);

  const value: TourContextValue = {
    isActive,
    currentStep,
    steps,
    showWelcome,
    currentStepData,
    totalSteps,
    isFirstStep,
    isLastStep,
    currentPage,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    dismissWelcome,
    resetTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

/**
 * Hook to access tour context
 */
export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
