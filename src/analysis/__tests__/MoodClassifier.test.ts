import { MoodClassifier } from '../MoodClassifier';
import { AnalysisErrorCode } from '../types';

describe('MoodClassifier', () => {
  let classifier: MoodClassifier;

  beforeEach(async () => {
    classifier = new MoodClassifier();
    await classifier.loadModel();
  });

  describe('classifyMood()', () => {
    it('returns a valid mood category', async () => {
      const result = await classifier.classifyMood({
        faceCount: 1,
        avgFaceExpression: 'positive',
        lighting: 'bright',
        brightnessScore: 0.8,
        colorTemperature: 'warm',
        contrastLevel: 'high',
      });
      expect(['happy', 'energetic', 'calm', 'melancholic', 'sad']).toContain(result.primaryMood);
    });

    it('returns confidence between 0 and 1', async () => {
      const result = await classifier.classifyMood({
        faceCount: 0,
        lighting: 'natural',
        brightnessScore: 0.5,
        colorTemperature: 'neutral',
        contrastLevel: 'medium',
      });
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('classifies bright + positive expression as happy or energetic', async () => {
      const result = await classifier.classifyMood({
        faceCount: 2,
        avgFaceExpression: 'positive',
        lighting: 'bright',
        brightnessScore: 0.9,
        colorTemperature: 'warm',
        contrastLevel: 'high',
      });
      expect(['happy', 'energetic']).toContain(result.primaryMood);
    });

    it('classifies dim + negative expression as sad or melancholic', async () => {
      const result = await classifier.classifyMood({
        faceCount: 1,
        avgFaceExpression: 'negative',
        lighting: 'dim',
        brightnessScore: 0.2,
        colorTemperature: 'cool',
        contrastLevel: 'low',
      });
      expect(['sad', 'melancholic']).toContain(result.primaryMood);
    });

    it('classifies natural lighting + neutral expression as calm', async () => {
      const result = await classifier.classifyMood({
        faceCount: 1,
        avgFaceExpression: 'neutral',
        lighting: 'natural',
        brightnessScore: 0.5,
        colorTemperature: 'neutral',
        contrastLevel: 'medium',
      });
      expect(['calm', 'happy']).toContain(result.primaryMood);
    });

    it('handles zero faces gracefully', async () => {
      const result = await classifier.classifyMood({
        faceCount: 0,
        lighting: 'bright',
        brightnessScore: 0.75,
        colorTemperature: 'warm',
        contrastLevel: 'medium',
      });
      expect(result.primaryMood).toBeDefined();
    });

    it('optionally includes secondaryMood', async () => {
      const result = await classifier.classifyMood({
        faceCount: 3,
        avgFaceExpression: 'positive',
        lighting: 'bright',
        brightnessScore: 0.85,
        colorTemperature: 'warm',
        contrastLevel: 'high',
      });
      if (result.secondaryMood !== undefined) {
        expect(['happy', 'energetic', 'calm', 'melancholic', 'sad']).toContain(result.secondaryMood);
        expect(result.secondaryMood).not.toBe(result.primaryMood);
      }
    });

    it('throws INVALID_IMAGE for negative faceCount', async () => {
      await expect(
        classifier.classifyMood({
          faceCount: -1,
          lighting: 'bright',
          brightnessScore: 0.5,
          colorTemperature: 'neutral',
          contrastLevel: 'medium',
        }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });

    it('throws INVALID_IMAGE for brightnessScore above 1', async () => {
      await expect(
        classifier.classifyMood({
          faceCount: 0,
          lighting: 'bright',
          brightnessScore: 1.5,
          colorTemperature: 'neutral',
          contrastLevel: 'medium',
        }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });

    it('throws INVALID_IMAGE for negative brightnessScore', async () => {
      await expect(
        classifier.classifyMood({
          faceCount: 0,
          lighting: 'bright',
          brightnessScore: -0.1,
          colorTemperature: 'neutral',
          contrastLevel: 'medium',
        }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });
  });

  describe('buildFeatures()', () => {
    it('maps faceCount >= 3 to group composition', () => {
      const features = classifier.buildFeatures({
        faceCount: 5,
        lighting: 'bright',
        brightnessScore: 0.8,
        colorTemperature: 'neutral',
        contrastLevel: 'medium',
      });
      expect(features.composition).toBe('group');
    });

    it('maps faceCount === 1 to close composition', () => {
      const features = classifier.buildFeatures({
        faceCount: 1,
        avgFaceExpression: 'positive',
        lighting: 'natural',
        brightnessScore: 0.5,
        colorTemperature: 'neutral',
        contrastLevel: 'medium',
      });
      expect(features.composition).toBe('close');
    });

    it('maps faceCount === 0 to distant composition', () => {
      const features = classifier.buildFeatures({
        faceCount: 0,
        lighting: 'bright',
        brightnessScore: 0.7,
        colorTemperature: 'warm',
        contrastLevel: 'high',
      });
      expect(features.composition).toBe('distant');
    });
  });
});
