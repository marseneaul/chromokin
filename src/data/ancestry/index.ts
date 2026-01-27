/**
 * Ancestry inference module
 *
 * Provides tools to:
 * 1. Parse 23andMe and AncestryDNA raw data files
 * 2. Infer continental ancestry proportions from SNP data
 */

export {
  parseSNPFile,
  parseSNPFileAsync,
  detectFileSource,
  type ParsedSNPFile,
  type SNPFileSource,
  type ParseProgress,
} from './snpFileParser';

export {
  inferAncestry,
  inferAdmixture,
  inferAdmixtureWithReferencePanel,
  checkReferencePanelAvailable,
  inferAncestryFromSNPs,
  getAIMMarkers,
  countAvailableAIMs,
  formatAncestryResult,
  type InferencePopulation,
  type AncestryInferenceResult,
  type MarkerInferenceDetail,
} from './ancestryInference';

export {
  inferLocalAncestry,
  inferLocalAncestryFromSNPs,
  type LocalAncestryResult,
} from './localAncestryInference';

export {
  inferLocalAncestryHMM,
  type HMMLocalAncestryResult,
} from './hmmAncestryInference';

export {
  inferWithReferencePanel,
  isReferencePanelAvailable,
  loadReferencePanel,
  getSubPopulationComposition,
  SUB_TO_SUPER_POP,
  SUB_POP_NAMES,
  type SubPopulation,
  type NearestNeighbor,
  type ReferencePanelResult,
} from './referenceBasedInference';
