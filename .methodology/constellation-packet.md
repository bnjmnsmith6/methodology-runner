@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem:** Need foundational computer vision system for security intelligence on constrained edge hardware
- **Desired outcome:** 24/7 operational vision pipeline with <100ms inference, <15W power, thermal stability
- **Success checks:** 
  - 4K video stream processing without frame drops
  - Person/object detection inference <100ms
  - System runs 72+ hours without intervention
  - Power consumption measured <15W under load

## 2. In scope / Out of scope

**In scope:**
- Jetson Orin Nano setup and optimization
- Reolink RLC-811A camera integration
- Real-time 4K video pipeline
- Basic person and object detection
- TensorRT model optimization
- Thermal monitoring and throttling
- Auto-recovery from failures
- Power monitoring

**Out of scope:**
- Advanced AI models beyond basic detection
- Multi-camera support
- Network streaming/recording
- User interfaces
- Cloud integration
- Advanced analytics or behavior detection

## 3. Source-of-truth constraints
- Inference latency must be <100ms end-to-end
- Total system power <15W continuous
- Must handle 4K@30fps input stream
- 24/7 operation requirement (auto-recovery mandatory)
- Jetson Orin Nano hardware platform fixed
- Reolink RLC-811A camera fixed
- TensorRT optimization required for inference

## 4. Architecture and flow

**Components:**
- Camera interface (RTSP/GStreamer)
- Video preprocessing pipeline
- TensorRT inference engine
- Detection post-processing
- System monitoring daemon
- Thermal management service

**Data flow:**
Camera → GStreamer → Frame preprocessing → TensorRT inference → Detection results → Monitoring/logging

**State transitions:**
INIT → CAMERA_CONNECT → PIPELINE_START → INFERENCE_READY → RUNNING → (THERMAL_THROTTLE|ERROR_RECOVERY) → RUNNING

## 5. Contracts and invariants

**Video pipeline contract:**
- Input: 4K@30fps RTSP stream
- Output: Detection results with bounding boxes, confidence scores
- Frame format: RGB/BGR, normalized for model input

**Detection output schema:**
```
{
  "timestamp": int64,
  "frame_id": int,
  "detections": [
    {
      "class": str,  // "person" | "vehicle" | "object"
      "confidence": float,
      "bbox": [x1, y1, x2, y2],  // normalized 0-1
      "tracking_id": int | null
    }
  ],
  "inference_time_ms": float,
  "system_temp_c": float
}
```

**System invariants:**
- Max inference time 100ms or trigger warning
- Temperature >70°C triggers throttling
- Power >15W triggers optimization mode
- Failed frames >5% triggers camera reconnect

## 6. File-by-file implementation plan

**src/camera_interface.py**
- Purpose: Handle RTSP connection and frame capture
- Changes: New module
- Key functions: `connect_camera()`, `get_frame()`, `reconnect()`

**src/vision_pipeline.py**
- Purpose: Main processing pipeline orchestration
- Changes: New module
- Key functions: `initialize_pipeline()`, `process_frame()`, `cleanup()`

**src/tensorrt_engine.py**
- Purpose: TensorRT model loading and inference
- Changes: New module
- Key functions: `load_model()`, `infer()`, `optimize_model()`

**src/detection_processor.py**
- Purpose: Post-process inference results
- Changes: New module
- Key functions: `parse_detections()`, `filter_results()`, `format_output()`

**src/system_monitor.py**
- Purpose: Health monitoring and thermal management
- Changes: New module
- Key functions: `monitor_system()`, `check_thermal()`, `trigger_recovery()`

**src/main.py**
- Purpose: Application entry point and coordination
- Changes: New module
- Key functions: `main()`, `shutdown_handler()`

**config/models/detection_model.trt**
- Purpose: Optimized TensorRT model file
- Changes: New file (generated during setup)

**config/system_config.yaml**
- Purpose: System parameters and thresholds
- Changes: New file

## 7. Build order

1. **Environment setup** - Install JetPack, dependencies, camera drivers
2. **System monitoring** - Implement thermal/power monitoring foundation
3. **Camera interface** - RTSP connection and frame capture
4. **TensorRT engine** - Model loading and basic inference
5. **Detection processing** - Post-processing and result formatting
6. **Pipeline integration** - Connect all components with error handling
7. **Optimization phase** - Performance tuning and TensorRT optimization
8. **Recovery mechanisms** - Auto-restart and failure handling
9. **Integration testing** - End-to-end validation

## 8. Acceptance tests

**Performance tests:**
- Measure inference latency over 1000 frames, confirm <100ms average
- Run power measurement for 1 hour, confirm <15W average
- Monitor system temperature under load for thermal stability

**Reliability tests:**
- 72-hour continuous operation without manual intervention
- Camera disconnect/reconnect handling
- System recovery from thermal throttling
- Recovery from inference engine crashes

**Functional tests:**
- Person detection accuracy on test video set
- 4K frame processing without drops
- Correct detection output format validation

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. Pre-trained YOLO/SSD model available for TensorRT conversion
2. Jetson Orin Nano can maintain 4K@30fps with current thermal design
3. Camera RTSP stream stable and compatible with GStreamer

**Risk hotspots:**
- TensorRT model conversion may require model architecture changes
- Thermal throttling may impact real-time performance
- Camera compatibility issues with specific RTSP implementation

**Rollback plan:**
- Keep CPU-based inference as fallback if TensorRT fails
- Implement resolution downscaling if 4K proves too demanding
- Support multiple model backends if conversion issues arise

## 10. Escalate instead of guessing

**Conditions requiring STOP_AND_ASK:**
- Cannot achieve <100ms inference with any available model
- Power consumption consistently >15W with all optimizations
- System cannot maintain 4K processing due to hardware limitations
- TensorRT conversion fails for available detection models
- Camera hardware incompatibility that cannot be resolved via software
- Thermal management cannot maintain safe operating temperatures