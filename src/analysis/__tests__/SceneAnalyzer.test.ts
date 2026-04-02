import { SceneAnalyzer } from '../SceneAnalyzer';
import { AnalysisErrorCode, ImageInput } from '../types';

const BASE_IMAGE: ImageInput = {
  uri: 'file:///photos/test.jpg',
  width: 1080,
  height: 1920,
  source: 'gallery',
};

describe('SceneAnalyzer', () => {
  let analyzer: SceneAnalyzer;

  beforeEach(() => {
    analyzer = new SceneAnalyzer();
  });

  describe('analyzeScene()', () => {
    it('returns all required fields', async () => {
      const result = await analyzer.analyzeScene(BASE_IMAGE);
      expect(['bright', 'dim', 'natural']).toContain(result.lighting);
      expect(['close', 'distant', 'group']).toContain(result.composition);
      expect(result.brightnessScore).toBeGreaterThanOrEqual(0);
      expect(result.brightnessScore).toBeLessThanOrEqual(1);
      expect(['warm', 'cool', 'neutral']).toContain(result.colorTemperature);
      expect(['high', 'medium', 'low']).toContain(result.contrastLevel);
    });

    it('throws INVALID_IMAGE for empty URI', async () => {
      await expect(
        analyzer.analyzeScene({ ...BASE_IMAGE, uri: '' }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });

    it('throws INVALID_IMAGE for zero width', async () => {
      await expect(
        analyzer.analyzeScene({ ...BASE_IMAGE, width: 0 }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });
  });

  describe('analyzeLighting()', () => {
    it('returns bright for wide landscape gallery image', () => {
      const lighting = analyzer.analyzeLighting({
        ...BASE_IMAGE,
        width: 4032,
        height: 2268,
      });
      expect(lighting).toBe('bright');
    });

    it('returns dim for camera image with night hint', () => {
      const lighting = analyzer.analyzeLighting({
        uri: 'file:///camera/night_shot.jpg',
        width: 1920,
        height: 1080,
        source: 'camera',
      });
      expect(lighting).toBe('dim');
    });

    it('returns bright for camera image with sunny hint', () => {
      const lighting = analyzer.analyzeLighting({
        uri: 'file:///camera/sunny_outdoor.jpg',
        width: 1920,
        height: 1080,
        source: 'camera',
      });
      expect(lighting).toBe('bright');
    });
  });

  describe('analyzeComposition()', () => {
    it('returns close for tall high-res portrait', () => {
      const composition = analyzer.analyzeComposition({
        ...BASE_IMAGE,
        width: 2000,
        height: 3000,
      });
      expect(composition).toBe('close');
    });

    it('returns distant for wide landscape', () => {
      const composition = analyzer.analyzeComposition({
        ...BASE_IMAGE,
        width: 4032,
        height: 2268,
      });
      expect(composition).toBe('distant');
    });

    it('returns group for square-ish image', () => {
      const composition = analyzer.analyzeComposition({
        ...BASE_IMAGE,
        width: 1080,
        height: 1080,
      });
      expect(composition).toBe('group');
    });
  });
});
