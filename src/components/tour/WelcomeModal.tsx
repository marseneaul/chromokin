/**
 * Welcome Modal - Shown on first visit to offer tour
 */

import { useState, type JSX } from 'react';
import { Dna, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTour } from './TourProvider';

export function WelcomeModal(): JSX.Element | null {
  const { showWelcome, startTour, dismissWelcome } = useTour();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!showWelcome) {
    return null;
  }

  const handleSkip = () => {
    dismissWelcome(dontShowAgain);
  };

  const handleStartTour = () => {
    startTour();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 px-6 py-8 text-center text-white">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Dna className="w-16 h-16" />
              <Sparkles className="w-6 h-6 absolute -top-1 -right-1 text-yellow-300" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to ChromoKin!</h2>
          <p className="text-white/90 text-sm">Your personal genome explorer</p>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-600 text-center mb-6">
            Discover the secrets hidden in your DNA! Would you like a quick tour
            to learn how to explore your genome?
          </p>

          {/* Features preview */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center p-3 rounded-lg bg-blue-50">
              <div className="text-2xl mb-1">🧬</div>
              <div className="text-xs text-gray-600">Explore Genes</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-50">
              <div className="text-2xl mb-1">🌍</div>
              <div className="text-xs text-gray-600">See Ancestry</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-pink-50">
              <div className="text-2xl mb-1">✨</div>
              <div className="text-xs text-gray-600">Discover Traits</div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleStartTour}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
              size="lg"
            >
              Take the Tour
            </Button>
            <Button
              onClick={handleSkip}
              variant="ghost"
              className="w-full text-gray-500"
            >
              Maybe Later
            </Button>
          </div>

          {/* Don't show again */}
          <label className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="rounded border-gray-300"
            />
            Don&apos;t show this again
          </label>
        </div>
      </div>
    </div>
  );
}
