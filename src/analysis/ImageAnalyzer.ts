import {
  ImageInput,
  MoodAnalysis,
  AnalysisFeatures,
  AnalysisError,
  AnalysisErrorCode,
  SUPPORTED_FORMATS,
  MAX_PROCESSING_TIME_MS,
} from './types';
import { FaceDetector } from './FaceDetector';
import { SceneAnalyzer } from './SceneAnalyzer';
import { MoodClassifier } from './MoodClassifier';

/**
 * Main analysis coordinator.
 *
 * Orchestrates FaceDetector, SceneAnalyzer, and MoodClassifier to produce
 * a complete MoodAnalysis from a single image input.
 *
 * Processing runs face detection and scene analysis in parallel, then feeds
 * combined features into the mood classifier. Total budget is <2 seconds.
 */
export class ImageAnalyzer {
  private readonly faceDetector: FaceDetector;
  private readonly sceneAnalyzer: SceneAnalyzer;
  private readonly moodClassifier: MoodClassifier;
  private initialized = false;

  constructor(
    faceDetector?: FaceDetector,
    sceneAnalyzer?: SceneAnalyzer,
    moodClassifier?: MoodClassifier,
  ) {
    this.faceDetector = faceDetector ?? new FaceDetector();
    this.sceneAnalyzer = sceneAnalyzer ?? new SceneAnalyzer();
    this.moodClassifier = moodClassifier ?? new MoodClassifier();
  }

  /**
   * Pre-load all ML model assets.
   * Call once at app startup to avoid cold-start latency during analysis.
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.faceDetector.loadModel(),
      this.moodClassifier.loadModel(),
    ]);
    this.initialized = true;
  }

  /**
   * Analyze an image and return a full MoodAnalysis.
   *
   * Validates input format, runs parallel scene + face analysis, classifies
   * mood, and enforces the 2-second processing budget.
   *
   * @throws {AnalysisError} with code UNSUPPORTED_FORMAT | INVALID_IMAGE | PROCESSING_TIMEOUT
   */
  async analyzeImage(image: ImageInput): Promise<MoodAnalysis> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.validateImageInput(image);

    const startTime = Date.now();

    const analysisPromise = this.runAnalysis(image, startTime);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new AnalysisError(
            `Processing exceeded ${MAX_PROCESSING_TIME_MS}ms limit`,
            AnalysisErrorCode.PROCESSING_TIMEOUT,
          ),
        );
      }, MAX_PROCESSING_TIME_MS);
    });

    return Promise.race([analysisPromise, timeoutPromise]);
  }

  /**
   * Convenience method for analyzing a single camera frame.
   * Semantically identical to analyzeImage() but signals real-time use.
   */
  async analyzeCameraFrame(frame: ImageInput): Promise<MoodAnalysis> {
    if (frame.source !== 'camera') {
      // Tolerate mismatched source rather than hard-failing; just correct it.
      return this.analyzeImage({ ...frame, source: 'camera' });
    }
    return this.analyzeImage(frame);
  }

  /**
   * Preprocess image URI for analysis.
   * Normalizes the URI and validates the format extension.
   */
  preprocessImage(image: ImageInput): ImageInput {
    const normalized = image.uri.trim();
    if (!this.isSupportedFormat(normalized)) {
      throw new AnalysisError(
        `Unsupported image format. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
        AnalysisErrorCode.UNSUPPORTED_FORMAT,
      );
    }
    return { ...image, uri: normalized };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async runAnalysis(image: ImageInput, startTime: number): Promise<MoodAnalysis> {
    const preprocessed = this.preprocessImage(image);

    // Run face detection and scene analysis in parallel.
    const [faceResult, sceneResult] = await Promise.all([
      this.faceDetector.detectFaces(preprocessed),
      this.sceneAnalyzer.analyzeScene(preprocessed),
    ]);

    const avgFaceExpression = this.faceDetector.analyzeExpressions(faceResult.expressions);

    const classificationInput = {
      faceCount: faceResult.count,
      avgFaceExpression,
      lighting: sceneResult.lighting,
      brightnessScore: sceneResult.brightnessScore,
      colorTemperature: sceneResult.colorTemperature,
      contrastLevel: sceneResult.contrastLevel,
    };

    const classification = await this.moodClassifier.classifyMood(classificationInput);

    const features: AnalysisFeatures = {
      faceCount: faceResult.count,
      avgFaceExpression,
      lighting: sceneResult.lighting,
      composition: sceneResult.composition,
    };

    const processingTime = Date.now() - startTime;

    return {
      primaryMood: classification.primaryMood,
      confidence: classification.confidence,
      secondaryMood: classification.secondaryMood,
      features,
      processingTime,
    };
  }

  private validateImageInput(image: ImageInput): void {
    if (!image || typeof image !== 'object') {
      throw new AnalysisError('Image input is required', AnalysisErrorCode.INVALID_IMAGE);
    }
    if (!image.uri || typeof image.uri !== 'string' || image.uri.trim() === '') {
      throw new AnalysisError('Image URI must be a non-empty string', AnalysisErrorCode.INVALID_IMAGE);
    }
    if (!Number.isFinite(image.width) || image.width <= 0) {
      throw new AnalysisError('Image width must be a positive number', AnalysisErrorCode.INVALID_IMAGE);
    }
    if (!Number.isFinite(image.height) || image.height <= 0) {
      throw new AnalysisError('Image height must be a positive number', AnalysisErrorCode.INVALID_IMAGE);
    }
    if (image.source !== 'camera' && image.source !== 'gallery') {
      throw new AnalysisError(
        `Image source must be 'camera' or 'gallery', got '${image.source}'`,
        AnalysisErrorCode.INVALID_IMAGE,
      );
    }
  }

  private isSupportedFormat(uri: string): boolean {
    const lower = uri.toLowerCase();
    // For data URIs and http(s) URLs, assume supported (format is in MIME type, not extension).
    if (lower.startsWith('data:image/') || lower.startsWith('http://') || lower.startsWith('https://')) {
      return true;
    }
    return SUPPORTED_FORMATS.some((ext) => lower.endsWith(ext));
  }
}
