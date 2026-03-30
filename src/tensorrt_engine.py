"""TensorRT inference engine for object detection on Jetson Orin Nano."""

import logging
import time
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# TensorRT imports are Jetson-specific; guard for CI environments
try:
    import tensorrt as trt
    import pycuda.autoinit  # noqa: F401  - initialises CUDA context
    import pycuda.driver as cuda

    _TRT_AVAILABLE = True
except ImportError:
    _TRT_AVAILABLE = False
    logger.warning("TensorRT/PyCUDA not available; inference engine in stub mode")


class TensorRTEngine:
    """Loads a serialised TensorRT engine and runs synchronous inference."""

    # Expected input tensor name (adjust to match your specific engine)
    INPUT_NAME = "images"
    OUTPUT_NAME = "output0"

    def __init__(self, config: dict):
        self._config = config
        inf_cfg = config.get("inference", {})

        self._model_path = Path(inf_cfg.get("model_path", "config/models/detection_model.trt"))
        self._input_w: int = inf_cfg.get("input_width", 640)
        self._input_h: int = inf_cfg.get("input_height", 640)
        self._precision: str = inf_cfg.get("precision", "fp16")
        self._max_latency_ms: float = inf_cfg.get("max_latency_ms", 100.0)

        # Runtime objects (set in load_model)
        self._engine = None
        self._context = None
        self._stream = None
        self._bindings: List = []
        self._host_inputs: List[np.ndarray] = []
        self._host_outputs: List[np.ndarray] = []
        self._cuda_inputs: List = []
        self._cuda_outputs: List = []
        self._output_shapes: List[Tuple] = []
        self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def load_model(self) -> None:
        """Deserialise and load TensorRT engine from disk."""
        if not _TRT_AVAILABLE:
            logger.warning("TensorRT not available; running in stub mode")
            self._loaded = True  # allow pipeline to continue in stub mode
            return

        if not self._model_path.exists():
            raise FileNotFoundError(f"TensorRT engine not found: {self._model_path}")

        logger.info("Loading TensorRT engine from %s", self._model_path)
        trt_logger = trt.Logger(trt.Logger.WARNING)
        runtime = trt.Runtime(trt_logger)

        with open(self._model_path, "rb") as f:
            engine_data = f.read()

        self._engine = runtime.deserialize_cuda_engine(engine_data)
        if self._engine is None:
            raise RuntimeError("Failed to deserialise TensorRT engine")

        self._context = self._engine.create_execution_context()
        self._stream = cuda.Stream()

        self._allocate_buffers()
        self._loaded = True
        logger.info(
            "TensorRT engine loaded (precision=%s, input=%dx%d)",
            self._precision,
            self._input_w,
            self._input_h,
        )

    def infer(self, preprocessed_frame: np.ndarray) -> Optional[np.ndarray]:
        """Run inference. Input must be (1, 3, H, W) float32, normalised 0-1.
        Returns raw output tensor or None if not loaded."""
        if not self._loaded:
            raise RuntimeError("Model not loaded; call load_model() first")

        if not _TRT_AVAILABLE:
            return self._stub_infer(preprocessed_frame)

        t0 = time.perf_counter()

        np.copyto(self._host_inputs[0], preprocessed_frame.ravel())
        cuda.memcpy_htod_async(self._cuda_inputs[0], self._host_inputs[0], self._stream)
        self._context.execute_async_v2(
            bindings=self._bindings, stream_handle=self._stream.handle
        )
        for host_out, cuda_out in zip(self._host_outputs, self._cuda_outputs):
            cuda.memcpy_dtoh_async(host_out, cuda_out, self._stream)
        self._stream.synchronize()

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        if elapsed_ms > self._max_latency_ms:
            logger.warning("Inference took %.1fms (limit %.1fms)", elapsed_ms, self._max_latency_ms)

        return self._host_outputs[0].reshape(self._output_shapes[0])

    def optimize_model(self, onnx_path: str, output_path: Optional[str] = None) -> str:
        """Convert ONNX model to TensorRT engine and save to disk.
        Returns path to the saved engine file."""
        if not _TRT_AVAILABLE:
            raise RuntimeError("TensorRT required for model optimisation")

        output_path = output_path or str(self._model_path)
        logger.info("Optimising ONNX model %s → %s (precision=%s)", onnx_path, output_path, self._precision)

        trt_logger = trt.Logger(trt.Logger.INFO)
        builder = trt.Builder(trt_logger)
        network_flags = 1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
        network = builder.create_network(network_flags)
        parser = trt.OnnxParser(network, trt_logger)

        with open(onnx_path, "rb") as f:
            if not parser.parse(f.read()):
                errors = [str(parser.get_error(i)) for i in range(parser.num_errors)]
                raise RuntimeError(f"ONNX parse errors: {errors}")

        config = builder.create_builder_config()
        config.max_workspace_size = 1 << 30  # 1 GB

        if self._precision == "fp16" and builder.platform_has_fast_fp16:
            config.set_flag(trt.BuilderFlag.FP16)
            logger.info("FP16 optimisation enabled")
        elif self._precision == "int8":
            config.set_flag(trt.BuilderFlag.INT8)
            logger.info("INT8 optimisation enabled (calibration required)")

        engine = builder.build_engine(network, config)
        if engine is None:
            raise RuntimeError("TensorRT engine build failed")

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(engine.serialize())

        logger.info("TensorRT engine saved to %s", output_path)
        return output_path

    def cleanup(self) -> None:
        """Free CUDA resources."""
        if not _TRT_AVAILABLE:
            return
        try:
            for buf in self._cuda_inputs + self._cuda_outputs:
                buf.free()
            if self._stream:
                del self._stream
            if self._context:
                del self._context
            if self._engine:
                del self._engine
        except Exception:
            logger.exception("Error during TensorRT cleanup")
        self._loaded = False
        logger.info("TensorRT engine unloaded")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _allocate_buffers(self) -> None:
        """Allocate pinned host and device memory for all I/O bindings."""
        self._bindings = []
        self._host_inputs.clear()
        self._host_outputs.clear()
        self._cuda_inputs.clear()
        self._cuda_outputs.clear()
        self._output_shapes.clear()

        for i in range(self._engine.num_bindings):
            shape = tuple(self._engine.get_binding_shape(i))
            dtype = trt.nptype(self._engine.get_binding_dtype(i))
            size = int(np.prod(shape))
            host_buf = cuda.pagelocked_empty(size, dtype)
            cuda_buf = cuda.mem_alloc(host_buf.nbytes)
            self._bindings.append(int(cuda_buf))

            if self._engine.binding_is_input(i):
                self._host_inputs.append(host_buf)
                self._cuda_inputs.append(cuda_buf)
            else:
                self._host_outputs.append(host_buf)
                self._cuda_outputs.append(cuda_buf)
                self._output_shapes.append(shape)

    def _stub_infer(self, frame: np.ndarray) -> np.ndarray:
        """Return empty detections when running without TensorRT (testing/CI)."""
        # Shape: [1, num_detections, 85] for YOLO-style outputs (85 = 5 + 80 classes)
        return np.zeros((1, 0, 85), dtype=np.float32)
