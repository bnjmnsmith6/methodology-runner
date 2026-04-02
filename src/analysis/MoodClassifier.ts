import {
  MoodCategory,
  FaceExpression,
  LightingCondition,
  AnalysisFeatures,
  AnalysisError,
  AnalysisErrorCode,
} from './types';

interface ClassificationInput {
  faceCount: number;
  avgFaceExpression?: FaceExpression;
  lighting: LightingCondition;
  brightnessScore: number;
  colorTemperature: 'warm' | 'cool' | 'neutral';
  contrastLevel: 'high' | 'medium' | 'low';
}

interface ClassificationResult {
  primaryMood: MoodCategory;
  confidence: number;
  secondaryMood?: MoodCategory;
}

/**
 * Classifies mood from aggregated visual features.
 *
 * Uses a weighted rule-based scoring system as the initial implementation.
 * Each mood category accumulates a score based on evidence from scene and
 * facial analysis. The highest-scoring mood wins with a confidence derived
 * from the score margin.
 *
 * Replace `inferWithModel()` with TFLite / Core ML inference to upgrade
 * to learned classification without changing the public interface.
 */
export class MoodClassifier {
  private modelLoaded = false;

  /**
   * Load classification model.
   * In production this would load a TFLite / Core ML model file.
   */
  async loadModel(): Promise<void> {
    // Placeholder: real code initialises TensorFlow Lite runtime here.
    this.modelLoaded = true;
  }

  /**
   * Classify mood from extracted visual features.
   */
  async classifyMood(features: ClassificationInput): Promise<ClassificationResult> {
    if (!this.modelLoaded) {
      await this.loadModel();
    }

    this.validateInput(features);
    return this.scoreAndRank(features);
  }

  /**
   * Build a AnalysisFeatures object from classifier inputs for the aggregator.
   */
  buildFeatures(
    input: ClassificationInput,
  ): AnalysisFeatures {
    return {
      faceCount: input.faceCount,
      avgFaceExpression: input.avgFaceExpression,
      lighting: input.lighting,
      composition: this.inferComposition(input.faceCount),
    };
  }

  /**
   * Rule-based mood scoring.
   * Each rule contributes a weighted score to one or more mood categories.
   */
  private scoreAndRank(features: ClassificationInput): ClassificationResult {
    const scores: Record<MoodCategory, number> = {
      happy: 0,
      energetic: 0,
      calm: 0,
      melancholic: 0,
      sad: 0,
    };

    // --- Facial expression signals ---
    if (features.avgFaceExpression === 'positive') {
      scores.happy += 3;
      scores.energetic += 1;
    } else if (features.avgFaceExpression === 'negative') {
      scores.sad += 3;
      scores.melancholic += 1;
    } else if (features.avgFaceExpression === 'neutral') {
      scores.calm += 2;
    }

    // --- Lighting signals ---
    if (features.lighting === 'bright') {
      scores.happy += 2;
      scores.energetic += 2;
    } else if (features.lighting === 'dim') {
      scores.sad += 1;
      scores.melancholic += 2;
      scores.calm += 1;
    } else {
      // natural
      scores.calm += 2;
      scores.happy += 1;
    }

    // --- Brightness score signals ---
    if (features.brightnessScore > 0.7) {
      scores.energetic += 1;
      scores.happy += 1;
    } else if (features.brightnessScore < 0.3) {
      scores.melancholic += 1;
      scores.sad += 1;
    }

    // --- Color temperature signals ---
    if (features.colorTemperature === 'warm') {
      scores.happy += 1;
      scores.energetic += 1;
    } else if (features.colorTemperature === 'cool') {
      scores.calm += 1;
      scores.melancholic += 1;
    }

    // --- Contrast signals ---
    if (features.contrastLevel === 'high') {
      scores.energetic += 1;
    } else if (features.contrastLevel === 'low') {
      scores.calm += 1;
      scores.melancholic += 1;
    }

    // --- Social context signals ---
    if (features.faceCount > 2) {
      scores.happy += 1;
      scores.energetic += 1;
    } else if (features.faceCount === 0) {
      scores.calm += 1;
    }

    return this.deriveResult(scores);
  }

  /**
   * Convert raw scores into a mood result with confidence.
   */
  private deriveResult(scores: Record<MoodCategory, number>): ClassificationResult {
    const sorted = (Object.entries(scores) as [MoodCategory, number][]).sort(
      (a, b) => b[1] - a[1],
    );

    const [primaryMood, primaryScore] = sorted[0];
    const [secondaryMood, secondaryScore] = sorted[1];

    const total = Object.values(scores).reduce((sum, s) => sum + s, 0);

    // Confidence: proportional share of the top mood, boosted by margin.
    const confidence = total > 0
      ? Math.min(1, Math.max(0, primaryScore / total + (primaryScore - secondaryScore) / (total + 1) * 0.3))
      : 0.5;

    const result: ClassificationResult = {
      primaryMood,
      confidence: Math.round(confidence * 1000) / 1000, // 3 decimal places
    };

    // Report a secondary mood if it has meaningful support (>60% of primary).
    if (secondaryScore > 0 && primaryScore > 0 && secondaryScore / primaryScore > 0.6 && secondaryMood !== primaryMood) {
      result.secondaryMood = secondaryMood;
    }

    return result;
  }

  private inferComposition(faceCount: number): AnalysisFeatures['composition'] {
    if (faceCount >= 3) return 'group';
    if (faceCount === 1) return 'close';
    return 'distant';
  }

  private validateInput(features: ClassificationInput): void {
    if (features.brightnessScore < 0 || features.brightnessScore > 1) {
      throw new AnalysisError(
        `brightnessScore must be between 0 and 1, got ${features.brightnessScore}`,
        AnalysisErrorCode.INVALID_IMAGE,
      );
    }
    if (features.faceCount < 0) {
      throw new AnalysisError(
        `faceCount cannot be negative, got ${features.faceCount}`,
        AnalysisErrorCode.INVALID_IMAGE,
      );
    }
  }
}
