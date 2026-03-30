"""Tests for TensorRTEngine in stub mode (no hardware required)."""

import numpy as np
import pytest

from src.tensorrt_engine import TensorRTEngine

BASE_CONFIG = {
    "inference": {
        "model_path": "config/models/detection_model.trt",
        "input_width": 64,
        "input_height": 64,
        "confidence_threshold": 0.5,
        "nms_threshold": 0.4,
        "max_detections": 100,
        "max_latency_ms": 100.0,
        "precision": "fp16",
    }
}


class TestTensorRTEngineStubMode:
    """Tests that run without actual TensorRT installed."""

    def setup_method(self):
        self.engine = TensorRTEngine(BASE_CONFIG)

    def test_not_loaded_initially(self):
        assert self.engine.is_loaded is False

    def test_load_model_stub_sets_loaded(self):
        # In stub mode (no TRT), load_model should still mark loaded
        self.engine.load_model()
        assert self.engine.is_loaded is True

    def test_infer_raises_if_not_loaded(self):
        frame = np.zeros((1, 3, 64, 64), dtype=np.float32)
        with pytest.raises(RuntimeError, match="not loaded"):
            self.engine.infer(frame)

    def test_infer_stub_returns_empty_array(self):
        self.engine.load_model()
        frame = np.zeros((1, 3, 64, 64), dtype=np.float32)
        result = self.engine.infer(frame)
        assert result is not None
        assert isinstance(result, np.ndarray)
        # Stub returns shape (1, 0, 85)
        assert result.shape == (1, 0, 85)
        assert result.dtype == np.float32

    def test_cleanup_does_not_raise(self):
        self.engine.load_model()
        self.engine.cleanup()  # Should not raise
        assert self.engine.is_loaded is False

    def test_config_values_loaded(self):
        assert self.engine._input_w == 64
        assert self.engine._input_h == 64
        assert self.engine._precision == "fp16"
        assert self.engine._max_latency_ms == pytest.approx(100.0)

    def test_model_path_not_found_raises(self):
        from unittest.mock import patch
        with patch("src.tensorrt_engine._TRT_AVAILABLE", True):
            # Without mocking the file open, it should raise FileNotFoundError
            with pytest.raises(FileNotFoundError):
                self.engine.load_model()
