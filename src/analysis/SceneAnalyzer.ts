import {
  ImageInput,
  SceneAnalysisResult,
  LightingCondition,
  CompositionType,
  AnalysisError,
  AnalysisErrorCode,
} from './types';

/**
 * Analyzes scene lighting and composition from image metadata.
 *
 * Since direct pixel access is unavailable in this rule-based implementation,
 * heuristics are derived from image dimensions, aspect ratio, and URI metadata.
 * When integrated with a native image processing library (e.g., react-native-fast-image
 * or expo-image-manipulator), replace the heuristic methods with real pixel data.
 */
export class SceneAnalyzer {
  /**
   * Analyze scene properties of the given image.
   */
  async analyzeScene(image: ImageInput): Promise<SceneAnalysisResult> {
    this.validateImage(image);

    const lighting = this.analyzeLighting(image);
    const composition = this.analyzeComposition(image);
    const brightnessScore = this.estimateBrightness(image, lighting);
    const colorTemperature = this.estimateColorTemperature(image);
    const contrastLevel = this.estimateContrast(image, lighting);

    return {
      lighting,
      composition,
      brightnessScore,
      colorTemperature,
      contrastLevel,
    };
  }

  /**
   * Determine lighting condition from heuristics.
   *
   * In a real implementation this would analyze pixel luminance values.
   * Here we use image source and URI hints as proxies.
   */
  analyzeLighting(image: ImageInput): LightingCondition {
    const uri = image.uri.toLowerCase();

    // Camera images captured in typical indoor conditions lean toward natural/dim.
    // Gallery images (selected by user) are more likely well-lit.
    if (image.source === 'camera') {
      if (uri.includes('outdoor') || uri.includes('sunny') || uri.includes('bright')) {
        return 'bright';
      }
      if (uri.includes('night') || uri.includes('dark') || uri.includes('indoor')) {
        return 'dim';
      }
      return 'natural';
    }

    // Gallery images: use aspect-ratio and dimension proxies.
    // Wide landscape photos are often taken outdoors in good light.
    const aspectRatio = image.width / image.height;
    if (aspectRatio > 1.5) {
      return 'bright';
    }
    if (aspectRatio < 0.8) {
      // Portrait mode often shot indoors
      return 'natural';
    }
    return 'natural';
  }

  /**
   * Determine composition type from image dimensions.
   *
   * In a real implementation, subject-detection bounding boxes would drive this.
   */
  analyzeComposition(image: ImageInput): CompositionType {
    const aspectRatio = image.width / image.height;
    const totalPixels = image.width * image.height;

    // Very high-resolution images with portrait aspect ratio suggest close-up.
    if (aspectRatio < 0.9 && totalPixels > 2_000_000) {
      return 'close';
    }

    // Wide landscape with many pixels suggests distant scene.
    if (aspectRatio > 1.6) {
      return 'distant';
    }

    // Square-ish images are typically social/group shots.
    return 'group';
  }

  /**
   * Estimate a normalized brightness score [0–1].
   */
  private estimateBrightness(image: ImageInput, lighting: LightingCondition): number {
    const base: Record<LightingCondition, number> = {
      bright: 0.8,
      natural: 0.55,
      dim: 0.25,
    };
    // Add small variance based on image dimensions to avoid identical scores.
    const variance = ((image.width * image.height) % 100) / 1000;
    return Math.min(1, Math.max(0, base[lighting] + variance));
  }

  /**
   * Estimate color temperature from URI hints and source.
   */
  private estimateColorTemperature(
    image: ImageInput,
  ): 'warm' | 'cool' | 'neutral' {
    const uri = image.uri.toLowerCase();
    if (uri.includes('sunset') || uri.includes('warm') || uri.includes('golden')) {
      return 'warm';
    }
    if (uri.includes('snow') || uri.includes('blue') || uri.includes('winter')) {
      return 'cool';
    }
    return 'neutral';
  }

  /**
   * Estimate contrast level.
   */
  private estimateContrast(
    image: ImageInput,
    lighting: LightingCondition,
  ): 'high' | 'medium' | 'low' {
    // Bright scenes often have higher contrast; dim scenes lower.
    if (lighting === 'bright') return 'high';
    if (lighting === 'dim') return 'low';
    return 'medium';
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
