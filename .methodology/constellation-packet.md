@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- Problem: App needs to analyze photos (uploaded or camera) to detect mood/emotion for song selection
- Desired outcome: Image analysis pipeline that outputs mood classification with confidence scores
- Success checks: Can classify test images into mood categories with >70% accuracy, processes images in <2s

## 2. In scope / Out of scope

**In scope:**
- Image preprocessing and analysis pipeline
- Mood classification (happy/energetic to sad/melancholic spectrum)
- Both static uploads and camera frame analysis
- Basic facial expression detection
- Scene lighting and composition analysis
- Confidence scoring for classifications

**Out of scope:**
- Song recommendation logic (separate component)
- Advanced emotion detection beyond basic mood spectrum
- Video analysis (frame-by-frame only)
- User preference learning
- Real-time streaming optimization

## 3. Source-of-truth constraints
- Must work on mobile devices (iOS/Android via React Native)
- Processing time <2 seconds for reasonable image sizes
- Should work offline after initial model loading
- Output must be JSON-serializable mood data
- Must handle common image formats (JPEG, PNG, HEIC)

## 4. Architecture and flow

**Components:**
- ImageAnalyzer: Main analysis coordinator
- MoodClassifier: Core ML model wrapper
- FaceDetector: Facial expression analysis
- SceneAnalyzer: Lighting/composition analysis
- ResultAggregator: Combines analysis outputs

**Data flow:**
1. Image input → ImageAnalyzer
2. Parallel processing: FaceDetector + SceneAnalyzer
3. Results → MoodClassifier
4. Classification → ResultAggregator
5. Final mood output with confidence

**External dependencies:**
- TensorFlow Lite or Core ML for model inference
- React Native image processing libraries
- Pre-trained models for face detection and scene analysis

## 5. Contracts and invariants

**Input:**
```typescript
interface ImageInput {
  uri: string;
  width: number;
  height: number;
  source: 'camera' | 'gallery';
}
```

**Output:**
```typescript
interface MoodAnalysis {
  primaryMood: 'happy' | 'energetic' | 'calm' | 'melancholic' | 'sad';
  confidence: number; // 0-1
  secondaryMood?: string;
  features: {
    faceCount: number;
    avgFaceExpression?: 'positive' | 'neutral' | 'negative';
    lighting: 'bright' | 'dim' | 'natural';
    composition: 'close' | 'distant' | 'group';
  };
  processingTime: number;
}
```

**Invariants:**
- All confidence scores between 0 and 1
- Processing time always recorded
- Must return result or throw specific error types

## 6. File-by-file implementation plan

**src/analysis/ImageAnalyzer.ts**
- Purpose: Main entry point and orchestration
- Change: New file
- Key functions: analyzeImage(), preprocessImage()

**src/analysis/MoodClassifier.ts**
- Purpose: Core mood classification logic
- Change: New file
- Key functions: classifyMood(), loadModel()

**src/analysis/FaceDetector.ts**
- Purpose: Facial expression analysis
- Change: New file
- Key functions: detectFaces(), analyzeExpressions()

**src/analysis/SceneAnalyzer.ts**
- Purpose: Lighting and composition analysis
- Change: New file
- Key functions: analyzeLighting(), analyzeComposition()

**src/analysis/types.ts**
- Purpose: Shared type definitions
- Change: New file
- Key types: ImageInput, MoodAnalysis, AnalysisFeatures

**src/analysis/index.ts**
- Purpose: Module exports
- Change: New file
- Exports: ImageAnalyzer as default, types

## 7. Build order

1. Set up types.ts with all interfaces
2. Implement basic ImageAnalyzer with placeholder processing
3. Add SceneAnalyzer for lighting/composition (simpler, no ML)
4. Implement FaceDetector with basic face counting
5. Integrate MoodClassifier with simple rule-based logic
6. Add model loading and TensorFlow Lite integration
7. Implement result aggregation and confidence scoring
8. Add error handling and performance monitoring

## 8. Acceptance tests

**Unit tests:**
- ImageAnalyzer processes valid images without errors
- MoodClassifier returns valid mood categories
- All confidence scores are 0-1 range
- Processing completes within time limit

**Integration tests:**
- End-to-end: upload image → get mood classification
- Camera frame analysis works in real-time
- Handles common error cases (corrupted images, network issues)

**Manual validation:**
- Test with 20 diverse photos, verify reasonable classifications
- Performance test on target devices
- Memory usage stays within bounds during continuous processing

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. Pre-trained models (face detection, scene analysis) will be sufficiently accurate
2. Device performance will support real-time analysis on mid-range phones
3. Simple rule-based mood classification will provide acceptable accuracy initially

**Risk hotspots:**
- Model size vs. performance trade-offs
- Battery usage during continuous camera analysis
- Accuracy may vary significantly across different photo types

**Rollback plan:**
- Start with rule-based classification, upgrade to ML models incrementally
- Fallback to server-side analysis if device performance insufficient
- Graceful degradation: return basic mood if analysis fails

## 10. Escalate instead of guessing

**Stop and ask if:**
- Model accuracy consistently below 60% in testing
- Processing time exceeds 3 seconds on target devices
- Memory usage causes app crashes during normal operation
- Required model files exceed 50MB total size
- Integration with camera API proves technically infeasible
- Need clarification on mood category definitions or boundaries