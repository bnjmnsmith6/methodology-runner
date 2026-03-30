"""Integration-level tests for VisionPipeline using stubs for all hardware."""

import time
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from src.vision_pipeline import PipelineState, VisionPipeline

BASE_CONFIG = {
    "camera": {
        "rtsp_url": "rtsp://test/stream",
        "width": 640,
        "height": 480,
        "fps": 30,
        "reconnect_delay_s": 0.01,
        "max_reconnect_attempts": 3,
        "failed_frame_threshold": 0.05,
        "buffer_size": 2,
    },
    "inference": {
        "model_path": "config/models/detection_model.trt",
        "input_width": 64,
        "input_height": 64,
        "confidence_threshold": 0.5,
        "nms_threshold": 0.4,
        "max_detections": 100,
        "max_latency_ms": 100.0,
        "precision": "fp16",
    },
    "classes": ["person", "vehicle", "object"],
    "thermal": {
        "warning_temp_c": 65.0,
        "throttle_temp_c": 70.0,
        "critical_temp_c": 80.0,
        "poll_interval_s": 10.0,
        "thermal_zone_path": "/nonexistent/thermal",
    },
    "power": {
        "max_watts": 15.0,
        "warning_watts": 13.0,
        "ina3221_path": "/nonexistent/ina3221",
    },
    "monitoring": {
        "metrics_interval_s": 60.0,
        "max_consecutive_errors": 5,
        "recovery_wait_s": 0.01,
    },
    "pipeline": {
        "frame_queue_size": 5,
        "result_queue_size": 10,
    },
}


def _make_pipeline_with_stubs():
    """Return VisionPipeline with camera, engine, and monitor mocked."""
    pipeline = VisionPipeline(BASE_CONFIG)

    # Camera stub
    pipeline._camera.connect_camera = MagicMock(return_value=True)
    pipeline._camera.release = MagicMock()
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    pipeline._camera.get_frame = MagicMock(return_value=(True, dummy_frame))
    pipeline._camera.get_frame_stats = MagicMock(
        return_value={"frames_attempted": 10, "frames_failed": 0, "failure_rate": 0.0}
    )
    pipeline._camera._state = __import__(
        "src.camera_interface", fromlist=["CameraState"]
    ).CameraState.CONNECTED

    # Engine stub — returns empty detections
    pipeline._engine.load_model = MagicMock()
    pipeline._engine.infer = MagicMock(return_value=np.zeros((1, 0, 85), dtype=np.float32))
    pipeline._engine.cleanup = MagicMock()
    pipeline._engine._input_w = 64
    pipeline._engine._input_h = 64
    pipeline._engine._loaded = True

    # Monitor stub
    pipeline._monitor.start = MagicMock()
    pipeline._monitor.stop = MagicMock()
    pipeline._monitor.get_metrics = MagicMock(
        return_value=__import__(
            "src.system_monitor", fromlist=["SystemMetrics"]
        ).SystemMetrics(temperature_c=45.0, power_w=8.0)
    )

    return pipeline


class TestPipelineInitialisation:
    def test_init_state(self):
        pipeline = _make_pipeline_with_stubs()
        assert pipeline.state == PipelineState.INIT

    def test_initialize_pipeline_success(self):
        pipeline = _make_pipeline_with_stubs()
        pipeline.initialize_pipeline()
        assert pipeline.state == PipelineState.INFERENCE_READY
        pipeline._camera.connect_camera.assert_called_once()
        pipeline._engine.load_model.assert_called_once()

    def test_initialize_pipeline_camera_fail(self):
        pipeline = _make_pipeline_with_stubs()
        pipeline._camera.connect_camera.return_value = False
        with pytest.raises(RuntimeError, match="camera"):
            pipeline.initialize_pipeline()


class TestProcessFrame:
    def test_process_frame_returns_result(self):
        pipeline = _make_pipeline_with_stubs()
        pipeline.initialize_pipeline()

        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = pipeline.process_frame(frame)
        assert result.frame_id == 1
        assert isinstance(result.detections, list)

    def test_inference_called_with_preprocessed_frame(self):
        pipeline = _make_pipeline_with_stubs()
        pipeline.initialize_pipeline()

        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        pipeline.process_frame(frame)

        assert pipeline._engine.infer.called
        call_args = pipeline._engine.infer.call_args[0][0]
        assert call_args.shape == (1, 3, 64, 64)
        assert call_args.dtype == np.float32
        assert call_args.min() >= 0.0
        assert call_args.max() <= 1.0


class TestPipelineLifecycle:
    def test_start_stop(self):
        pipeline = _make_pipeline_with_stubs()
        pipeline.initialize_pipeline()
        pipeline.start()
        assert pipeline._running is True
        assert pipeline.state == PipelineState.RUNNING
        time.sleep(0.1)
        pipeline.stop()
        assert pipeline.state == PipelineState.STOPPED

    def test_result_callback_invoked(self):
        pipeline = _make_pipeline_with_stubs()
        results = []

        pipeline.initialize_pipeline()
        pipeline.add_result_callback(results.append)
        pipeline.start()
        time.sleep(0.2)
        pipeline.stop()

        # Inference thread should have consumed at least some frames
        assert pipeline._engine.infer.called

    def test_cleanup_stops_pipeline(self):
        pipeline = _make_pipeline_with_stubs()
        pipeline.initialize_pipeline()
        pipeline.start()
        pipeline.cleanup()
        assert pipeline.state == PipelineState.STOPPED


class TestThermalStateHandling:
    def test_thermal_throttle_callback_changes_state(self):
        pipeline = _make_pipeline_with_stubs()
        pipeline.initialize_pipeline()
        pipeline.start()

        from src.system_monitor import ThermalState
        pipeline._on_thermal_throttle(ThermalState.THROTTLED)
        assert pipeline.state == PipelineState.THERMAL_THROTTLE

        pipeline.stop()

    def test_thermal_recovery_restores_running(self):
        pipeline = _make_pipeline_with_stubs()
        pipeline.initialize_pipeline()
        pipeline.start()

        from src.system_monitor import ThermalState
        pipeline._on_thermal_throttle(ThermalState.THROTTLED)
        pipeline._on_thermal_recovery()
        assert pipeline.state == PipelineState.RUNNING

        pipeline.stop()
