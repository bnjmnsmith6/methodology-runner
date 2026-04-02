import { ImageAnalyzer } from '../ImageAnalyzer';
import { AnalysisError, AnalysisErrorCode, ImageInput, MAX_PROCESSING_TIME_MS } from '../types';

const VALID_IMAGE: ImageInput = {
  uri: 'file:///photos/happy_portrait.jpg',
  width: 1080,
  height: 1920,
  source: 'gallery',
};

describe('ImageAnalyzer', () => {
  let analyzer: ImageAnalyzer;

  beforeEach(() => {
    analyzer = new ImageAnalyzer();
  });

  describe('analyzeImage()', () => {
    it('returns a valid MoodAnalysis for a standard image', async () => {
      const result = await analyzer.analyzeImage(VALID_IMAGE);

      expect(result).toBeDefined();
      expect(typeof result.primaryMood).toBe('string');
      expect(['happy', 'energetic', 'calm', 'melancholic', 'sad']).toContain(result.primaryMood);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('always records processingTime', async () => {
      const result = await analyzer.analyzeImage(VALID_IMAGE);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('returns confidence within [0, 1]', async () => {
      const result = await analyzer.analyzeImage(VALID_IMAGE);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('includes required features fields', async () => {
      const result = await analyzer.analyzeImage(VALID_IMAGE);
      expect(result.features).toBeDefined();
      expect(typeof result.features.faceCount).toBe('number');
      expect(result.features.faceCount).toBeGreaterThanOrEqual(0);
      expect(['bright', 'dim', 'natural']).toContain(result.features.lighting);
      expect(['close', 'distant', 'group']).toContain(result.features.composition);
    });

    it('handles camera source images', async () => {
      const cameraImage: ImageInput = {
        uri: 'file:///camera/frame_001.jpg',
        width: 1920,
        height: 1080,
        source: 'camera',
      };
      const result = await analyzer.analyzeImage(cameraImage);
      expect(result.primaryMood).toBeDefined();
    });

    it('handles images with no faces (landscape)', async () => {
      const landscape: ImageInput = {
        uri: 'file:///photos/nature_landscape.jpg',
        width: 4032,
        height: 2268,
        source: 'gallery',
      };
      const result = await analyzer.analyzeImage(landscape);
      expect(result.features.faceCount).toBe(0);
      expect(result.features.avgFaceExpression).toBeUndefined();
    });

    it('processes within the time budget', async () => {
      const start = Date.now();
      await analyzer.analyzeImage(VALID_IMAGE);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(MAX_PROCESSING_TIME_MS);
    });

    it('throws INVALID_IMAGE for empty URI', async () => {
      await expect(
        analyzer.analyzeImage({ ...VALID_IMAGE, uri: '' }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });

    it('throws INVALID_IMAGE for zero width', async () => {
      await expect(
        analyzer.analyzeImage({ ...VALID_IMAGE, width: 0 }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });

    it('throws INVALID_IMAGE for negative height', async () => {
      await expect(
        analyzer.analyzeImage({ ...VALID_IMAGE, height: -1 }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });

    it('throws UNSUPPORTED_FORMAT for unknown extension', async () => {
      await expect(
        analyzer.analyzeImage({ ...VALID_IMAGE, uri: 'file:///photos/image.bmp' }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.UNSUPPORTED_FORMAT });
    });

    it('accepts HEIC format', async () => {
      const heicImage: ImageInput = {
        uri: 'file:///photos/portrait.heic',
        width: 3024,
        height: 4032,
        source: 'gallery',
      };
      const result = await analyzer.analyzeImage(heicImage);
      expect(result.primaryMood).toBeDefined();
    });

    it('accepts http URI (no extension check needed)', async () => {
      const webImage: ImageInput = {
        uri: 'https://example.com/photo',
        width: 800,
        height: 600,
        source: 'gallery',
      };
      const result = await analyzer.analyzeImage(webImage);
      expect(result.primaryMood).toBeDefined();
    });

    it('returns sad/melancholic mood hints for sad URI keywords', async () => {
      const sadImage: ImageInput = {
        uri: 'file:///photos/sad_cry.jpg',
        width: 1080,
        height: 1920,
        source: 'gallery',
      };
      const result = await analyzer.analyzeImage(sadImage);
      expect(['sad', 'melancholic', 'calm']).toContain(result.primaryMood);
    });

    it('returns happy/energetic mood hints for happy URI keywords', async () => {
      const happyImage: ImageInput = {
        uri: 'file:///photos/smile_party.jpg',
        width: 1080,
        height: 1080,
        source: 'gallery',
      };
      const result = await analyzer.analyzeImage(happyImage);
      expect(['happy', 'energetic', 'calm']).toContain(result.primaryMood);
    });
  });

  describe('analyzeCameraFrame()', () => {
    it('works with camera source', async () => {
      const frame: ImageInput = {
        uri: 'file:///tmp/frame.jpg',
        width: 640,
        height: 480,
        source: 'camera',
      };
      const result = await analyzer.analyzeCameraFrame(frame);
      expect(result.primaryMood).toBeDefined();
    });

    it('corrects mismatched source to camera', async () => {
      const frame: ImageInput = {
        uri: 'file:///tmp/frame.jpg',
        width: 640,
        height: 480,
        source: 'gallery',
      };
      const result = await analyzer.analyzeCameraFrame(frame);
      expect(result).toBeDefined();
    });
  });

  describe('preprocessImage()', () => {
    it('returns normalized URI', () => {
      const processed = analyzer.preprocessImage({
        ...VALID_IMAGE,
        uri: '  file:///photos/happy.jpg  ',
      });
      expect(processed.uri).toBe('file:///photos/happy.jpg');
    });

    it('throws UNSUPPORTED_FORMAT for .gif extension', () => {
      expect(() =>
        analyzer.preprocessImage({ ...VALID_IMAGE, uri: 'file:///anim.gif' }),
      ).toThrow(AnalysisError);
    });
  });

  describe('initialize()', () => {
    it('can be called explicitly before analyzeImage', async () => {
      const fresh = new ImageAnalyzer();
      await fresh.initialize();
      const result = await fresh.analyzeImage(VALID_IMAGE);
      expect(result).toBeDefined();
    });

    it('is idempotent when called multiple times implicitly', async () => {
      await analyzer.analyzeImage(VALID_IMAGE);
      const result = await analyzer.analyzeImage(VALID_IMAGE);
      expect(result).toBeDefined();
    });
  });
});
