# Core Vision Pipeline and Hardware Integration

**Project:** Autonomous Multi-Modal Security Intelligence System  
**Tier:** 3  
**Built by:** GUPPI (autonomous AI development pipeline)  
**Build cost:** 0.75  
**Build date:** 2026-03-30

## What was requested

@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective

## What was built

Built the foundational vision pipeline system for Jetson Orin Nano with Reolink RLC-811A camera. Created all 6 source modules (camera_interface, vision_pipeline, tensorrt_engine, detection_processor, system_monitor, main), system config YAML, 4 test files covering all modules, requirements.txt, and pytest.ini. The implementation follows the specified state machine (INIT→CAMERA_CONNECT→PIPELINE_START→INFERENCE_READY→RUNNING→THERMAL_THROTTLE|ERROR_RECOVERY→RUNNING), enforces the detection output schema, handles thermal throttling at 70°C/critical at 80°C, monitors power against 15W budget, auto-reconnects on camera failures >5%, and uses TensorRT FP16 with a stub fallback for non-Jetson environments. Tests were written to run without hardware by mocking cv2, TensorRT, and sysfs paths — but could not be executed due to shell access being restricted in this environment.

## Files changed

- src/__init__.py
- src/camera_interface.py
- src/vision_pipeline.py
- src/tensorrt_engine.py
- src/detection_processor.py
- src/system_monitor.py
- src/main.py
- config/system_config.yaml
- config/models/.gitkeep
- tests/__init__.py
- tests/test_detection_processor.py
- tests/test_system_monitor.py
- tests/test_camera_interface.py
- tests/test_vision_pipeline.py
- tests/test_tensorrt_engine.py
- requirements.txt
- pytest.ini

## How to run

```bash
python src/main.py
```

---

*This project was built autonomously by GUPPI using Claude Code, PBCA Research, and the 10-step methodology.*
