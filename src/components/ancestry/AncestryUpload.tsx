/**
 * AncestryUpload - File upload component for ancestry inference
 * Supports 23andMe and AncestryDNA raw data files
 */

import { type JSX, useCallback, useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAppStore,
  useUserAncestryData,
  useUserAncestryLoading,
  useUserAncestryError,
  type UserAncestryData,
} from '@/state/appState';
import {
  parseSNPFile,
  inferLocalAncestryHMM,
  inferAdmixtureWithReferencePanel,
  type ParsedSNPFile,
  type ReferencePanelResult,
} from '@/data/ancestry';
import type { AncestryComposition } from '@/types/genome';

interface AncestryUploadProps {
  onComplete?: () => void;
  compact?: boolean;
}

export function AncestryUpload({
  onComplete,
  compact = false,
}: AncestryUploadProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);

  const userAncestryData = useUserAncestryData();
  const isLoading = useUserAncestryLoading();
  const error = useUserAncestryError();

  const setUserAncestryData = useAppStore(state => state.setUserAncestryData);
  const setUserAncestryLoading = useAppStore(
    state => state.setUserAncestryLoading
  );
  const setUserAncestryError = useAppStore(state => state.setUserAncestryError);
  const clearUserAncestryData = useAppStore(
    state => state.clearUserAncestryData
  );

  const processFile = useCallback(
    async (file: File) => {
      setUserAncestryLoading(true);
      setUserAncestryError(null);

      try {
        // Read file
        setProcessingStage('Reading file...');
        const content = await file.text();

        // Parse SNPs
        setProcessingStage('Parsing genetic data...');
        let parsed: ParsedSNPFile;
        try {
          parsed = parseSNPFile(content);
        } catch {
          throw new Error(
            'Unable to parse file. Please ensure this is a raw data file from 23andMe or AncestryDNA.'
          );
        }

        if (parsed.snpCount < 1000) {
          throw new Error(
            'File contains too few SNPs. Please upload a complete raw data file.'
          );
        }

        // Run admixture inference with reference panel if available
        setProcessingStage('Analyzing ancestry admixture...');
        const globalResult = await inferAdmixtureWithReferencePanel(parsed);

        // Check if we got enhanced reference panel results
        const hasReferencePanel = 'subPopulationProportions' in globalResult;
        if (hasReferencePanel) {
          setProcessingStage('Using 1000 Genomes reference panel...');
        }

        // Run HMM-based local ancestry inference (uses global as prior)
        setProcessingStage('Running HMM ancestry inference...');
        const localResult = inferLocalAncestryHMM(parsed, globalResult);

        // Convert to AncestryComposition format
        const composition: AncestryComposition[] = globalResult.composition;

        // Create user ancestry data
        const userData: UserAncestryData = {
          source: parsed.source as '23andme' | 'ancestry' | 'unknown',
          fileName: file.name,
          snpCount: parsed.snpCount,
          buildVersion: parsed.buildVersion,
          composition,
          segments: localResult.segments,
          segmentsByChromosome: localResult.segmentsByChromosome,
          globalConfidence: globalResult.confidence,
          markersUsed: globalResult.markersUsed,
          processedAt: new Date().toISOString(),
          // Add reference panel data if available
          ...(hasReferencePanel && {
            subPopulationProportions: (globalResult as ReferencePanelResult)
              .subPopulationProportions,
            nearestNeighbors: (globalResult as ReferencePanelResult)
              .nearestNeighbors,
            inferenceMethod: (globalResult as ReferencePanelResult).method,
          }),
          ...(!hasReferencePanel && {
            inferenceMethod: 'em' as const,
          }),
        };

        setUserAncestryData(userData);
        setProcessingStage(null);
        onComplete?.();
      } catch (err) {
        setUserAncestryError(
          err instanceof Error ? err.message : 'Failed to process file'
        );
        setProcessingStage(null);
      }
    },
    [
      setUserAncestryData,
      setUserAncestryLoading,
      setUserAncestryError,
      onComplete,
    ]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // Show compact success state if data is loaded
  if (userAncestryData && compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800">
            {userAncestryData.fileName}
          </span>
        </div>
        <button
          onClick={clearUserAncestryData}
          className="text-green-600 hover:text-green-800"
          title="Remove uploaded data"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-slate-200 border-dashed rounded-lg">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm text-slate-600">
          {processingStage || 'Processing...'}
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserAncestryError(null)}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state with data
  if (userAncestryData) {
    return (
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {userAncestryData.fileName}
              </p>
              <p className="text-xs text-gray-500">
                {userAncestryData.snpCount.toLocaleString()} SNPs from{' '}
                {userAncestryData.source === '23andme'
                  ? '23andMe'
                  : userAncestryData.source === 'ancestry'
                    ? 'AncestryDNA'
                    : 'Unknown source'}
              </p>
            </div>
          </div>
          <button
            onClick={clearUserAncestryData}
            className="text-gray-400 hover:text-gray-600"
            title="Remove uploaded data"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            Confidence:{' '}
            <span className="font-medium capitalize">
              {userAncestryData.globalConfidence}
            </span>{' '}
            ({userAncestryData.markersUsed} markers used)
          </p>
          <p>
            {userAncestryData.segments.length} chromosomal segments identified
          </p>
        </div>
      </div>
    );
  }

  // Upload state
  return (
    <div
      className={`relative p-6 border-2 border-dashed rounded-lg transition-colors ${
        isDragOver
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex flex-col items-center text-center">
        <Upload
          className={`w-10 h-10 mb-3 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`}
        />
        <p className="text-sm text-gray-700 mb-1">
          Drag and drop your DNA file here
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Supports 23andMe and AncestryDNA raw data files
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse Files
        </Button>
      </div>
    </div>
  );
}
