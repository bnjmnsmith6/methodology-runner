import { FaceDetector } from '../FaceDetector';
import { AnalysisErrorCode, ImageInput } from '../types';

const BASE_IMAGE: ImageInput = {
  uri: 'file:///photos/portrait.jpg',
  width: 1080,
  height: 1920,
  source: 'gallery',
};

describe('FaceDetector', () => {
  let detector: FaceDetector;

  beforeEach(async () => {
    detector = new FaceDetector();
    await detector.loadModel();
  });

  describe('detectFaces()', () => {
    it('returns a valid FaceDetectionResult', async () => {
      const result = await detector.detectFaces(BASE_IMAGE);
      expect(typeof result.count).toBe('number');
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.expressions)).toBe(true);
      expect(Array.isArray(result.boundingBoxes)).toBe(true);
    });

    it('expressions array length matches face count', async () => {
      const result = await detector.detectFaces(BASE_IMAGE);
      expect(result.expressions.length).toBe(result.count);
    });

    it('bounding boxes length matches face count', async () => {
      const result = await detector.detectFaces(BASE_IMAGE);
      expect(result.boundingBoxes.length).toBe(result.count);
    });

    it('returns 0 faces for landscape nature image', async () => {
      const landscape: ImageInput = {
        uri: 'file:///photos/landscape.jpg',
        width: 4032,
        height: 2268,
        source: 'gallery',
      };
      const result = await detector.detectFaces(landscape);
      expect(result.count).toBe(0);
      expect(result.expressions).toHaveLength(0);
    });

    it('returns positive expression for smile image', async () => {
      const smileImage: ImageInput = {
        uri: 'file:///photos/smile_portrait.jpg',
        width: 1080,
        height: 1920,
        source: 'gallery',
      };
      const result = await detector.detectFaces(smileImage);
      expect(result.count).toBeGreaterThan(0);
      for (const expr of result.expressions) {
        expect(expr).toBe('positive');
      }
    });

    it('returns negative expression for sad image', async () => {
      const sadImage: ImageInput = {
        uri: 'file:///photos/sad_portrait.jpg',
        width: 1080,
        height: 1920,
        source: 'gallery',
      };
      const result = await detector.detectFaces(sadImage);
      expect(result.count).toBeGreaterThan(0);
      for (const expr of result.expressions) {
        expect(expr).toBe('negative');
      }
    });

    it('returns multiple faces for group image', async () => {
      const groupImage: ImageInput = {
        uri: 'file:///photos/group_photo.jpg',
        width: 1920,
        height: 1080,
        source: 'gallery',
      };
      const result = await detector.detectFaces(groupImage);
      expect(result.count).toBeGreaterThan(2);
    });

    it('throws INVALID_IMAGE for empty URI', async () => {
      await expect(
        detector.detectFaces({ ...BASE_IMAGE, uri: '' }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });

    it('throws INVALID_IMAGE for negative dimensions', async () => {
      await expect(
        detector.detectFaces({ ...BASE_IMAGE, height: -100 }),
      ).rejects.toMatchObject({ code: AnalysisErrorCode.INVALID_IMAGE });
    });

    it('loads model automatically if not pre-loaded', async () => {
      const fresh = new FaceDetector();
      const result = await fresh.detectFaces(BASE_IMAGE);
      expect(result).toBeDefined();
    });
  });

  describe('analyzeExpressions()', () => {
    it('returns undefined for empty array', () => {
      const result = detector.analyzeExpressions([]);
      expect(result).toBeUndefined();
    });

    it('returns the dominant expression', () => {
      const result = detector.analyzeExpressions(['positive', 'positive', 'neutral']);
      expect(result).toBe('positive');
    });

    it('returns the single expression when only one face', () => {
      expect(detector.analyzeExpressions(['negative'])).toBe('negative');
    });

    it('handles all-same expressions', () => {
      expect(detector.analyzeExpressions(['neutral', 'neutral', 'neutral'])).toBe('neutral');
    });
  });
});
