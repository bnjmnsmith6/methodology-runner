/**
 * Input image data for analysis.
 * Supports both static uploads and live camera frames.
 */
export interface ImageInput {
  uri: string;
  width: number;
  height: number;
  source: 'camera' | 'gallery';
}

/**
 * Mood categories on the emotional spectrum from positive/energetic to negative/melancholic.
 */
export type MoodCategory = 'happy' | 'energetic' | 'calm' | 'melancholic' | 'sad';

/**
 * Face expression classification.
 */
export type FaceExpression = 'positive' | 'neutral' | 'negative';

/**
 * Scene lighting conditions.
 */
export type LightingCondition = 'bright' | 'dim' | 'natural';

/**
 * Scene composition type based on subject distance and grouping.
 */
export type CompositionType = 'close' | 'distant' | 'group';

/**
 * Visual features extracted from the image.
 */
export interface AnalysisFeatures {
  faceCount: number;
  avgFaceExpression?: FaceExpression;
  lighting: LightingCondition;
  composition: CompositionType;
}

/**
 * Final mood analysis output.
 * All confidence scores are in the range [0, 1].
 * processingTime is always recorded in milliseconds.
 */
export interface MoodAnalysis {
  primaryMood: MoodCategory;
  confidence: number; // 0-1
  secondaryMood?: MoodCategory;
  features: AnalysisFeatures;
  processingTime: number; // milliseconds
}

/**
 * Raw face detection result from FaceDetector.
 */
export interface FaceDetectionResult {
  count: number;
  expressions: FaceExpression[];
  boundingBoxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

/**
 * Raw scene analysis result from SceneAnalyzer.
 */
export interface SceneAnalysisResult {
  lighting: LightingCondition;
  composition: CompositionType;
  brightnessScore: number; // 0-1, raw brightness estimate
  colorTemperature: 'warm' | 'cool' | 'neutral';
  contrastLevel: 'high' | 'medium' | 'low';
}

/**
 * Error types specific to the analysis pipeline.
 */
export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: AnalysisErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export enum AnalysisErrorCode {
  INVALID_IMAGE = 'INVALID_IMAGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  CORRUPTED_IMAGE = 'CORRUPTED_IMAGE',
}

/**
 * Supported image format extensions.
 */
export const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'] as const;

/**
 * Maximum processing time in milliseconds before timing out.
 */
export const MAX_PROCESSING_TIME_MS = 2000;
