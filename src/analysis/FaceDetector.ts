import {
  ImageInput,
  FaceDetectionResult,
  FaceExpression,
  AnalysisError,
  AnalysisErrorCode,
} from './types';

/**
 * Detects faces and analyzes facial expressions in an image.
 *
 * This implementation provides a rule-based heuristic baseline.
 * It is designed to be replaced with a real ML model (e.g., TensorFlow Lite
 * face detection + expression classification) when native bindings are available.
 *
 * The public API is stable; swap the private inference methods to upgrade.
 */
export class FaceDetector {
  private modelLoaded = false;

  /**
   * Load face detection model assets.
   * In a real implementation this initializes TFLite / Core ML.
   */
  async loadModel(): Promise<void> {
    // Placeholder: real code would load .tflite / .mlmodel file here.
    this.modelLoaded = true;
  }

  /**
   * Detect faces in the provided image and analyze their expressions.
   */
  async detectFaces(image: ImageInput): Promise<FaceDetectionResult> {
    if (!this.modelLoaded) {
      await this.loadModel();
    }

    this.validateImage(image);

    const count = this.estimateFaceCount(image);
    const expressions = this.estimateExpressions(image, count);
    const boundingBoxes = this.generateBoundingBoxes(image, count);

    return { count, expressions, boundingBoxes };
  }

  /**
   * Analyze expression arrays and return the dominant expression.
   */
  analyzeExpressions(expressions: FaceExpression[]): FaceExpression | undefined {
    if (expressions.length === 0) return undefined;

    const tally: Record<FaceExpression, number> = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    for (const expr of expressions) {
      tally[expr]++;
    }

    // Return the most frequent expression.
    return (Object.entries(tally) as [FaceExpression, number][]).reduce(
      (best, current) => (current[1] > best[1] ? current : best),
    )[0];
  }

  /**
   * Heuristic face count estimation based on image dimensions and composition.
   *
   * Replace with real inference output when ML model is available.
   */
  private estimateFaceCount(image: ImageInput): number {
    const aspectRatio = image.width / image.height;
    const totalPixels = image.width * image.height;
    const uri = image.uri.toLowerCase();

    // URI-based hints (useful for test/demo scenarios).
    if (uri.includes('selfie') || uri.includes('portrait')) return 1;
    if (uri.includes('group') || uri.includes('crowd')) return Math.floor(3 + (totalPixels % 5));
    if (uri.includes('landscape') || uri.includes('nature') || uri.includes('architecture')) return 0;

    // Dimension heuristics:
    // Tall portrait images likely contain 1-2 faces.
    if (aspectRatio < 0.8) return 1;
    // Wide landscape images rarely focus on faces.
    if (aspectRatio > 1.7) return 0;
    // Square-ish: moderate chance of 1-2 faces.
    return 1;
  }

  /**
   * Heuristic expression estimation.
   *
   * Replace with real classifier output when ML model is available.
   */
  private estimateExpressions(image: ImageInput, faceCount: number): FaceExpression[] {
    if (faceCount === 0) return [];

    const uri = image.uri.toLowerCase();
    const expressions: FaceExpression[] = [];

    let baseExpression: FaceExpression = 'neutral';
    if (uri.includes('smile') || uri.includes('happy') || uri.includes('laugh') || uri.includes('party')) {
      baseExpression = 'positive';
    } else if (uri.includes('sad') || uri.includes('cry') || uri.includes('grief') || uri.includes('funeral')) {
      baseExpression = 'negative';
    }

    for (let i = 0; i < faceCount; i++) {
      expressions.push(baseExpression);
    }

    return expressions;
  }

  /**
   * Generate estimated bounding boxes for detected faces.
   * These are approximate; a real model returns actual coordinates.
   */
  private generateBoundingBoxes(
    image: ImageInput,
    count: number,
  ): FaceDetectionResult['boundingBoxes'] {
    const boxes: FaceDetectionResult['boundingBoxes'] = [];

    for (let i = 0; i < count; i++) {
      const faceWidth = image.width * 0.3;
      const faceHeight = image.height * 0.4;
      const spacing = image.width / (count + 1);

      boxes.push({
        x: spacing * (i + 1) - faceWidth / 2,
        y: image.height * 0.1,
        width: faceWidth,
        height: faceHeight,
      });
    }

    return boxes;
  }

  private validateImage(image: ImageInput): void {
    if (!image.uri || image.uri.trim() === '') {
      throw new AnalysisError(
        'Image URI is required',
        AnalysisErrorCode.INVALID_IMAGE,
      );
    }
    if (image.width <= 0 || image.height <= 0) {
      throw new AnalysisError(
        'Image dimensions must be positive',
        AnalysisErrorCode.INVALID_IMAGE,
      );
    }
  }
}
