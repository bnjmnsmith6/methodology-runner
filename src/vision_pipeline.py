"""Main vision pipeline: orchestrates camera, inference, and detection processing."""

import logging
import queue
import threading
import time
from enum import Enum
from typing import Callable, Optional

import numpy as np

from .camera_interface import CameraInterface, CameraState
from .detection_processor import DetectionProcessor, DetectionResult
from .system_monitor import SystemMonitor, ThermalState
from .tensorrt_engine import TensorRTEngine

logger = logging.getLogger(__name__)


class PipelineState(Enum):
    INIT = "init"
    CAMERA_CONNECT = "camera_connect"
    PIPELINE_START = "pipeline_start"
    INFERENCE_READY = "inference_ready"
    RUNNING = "running"
    THERMAL_THROTTLE = "thermal_throttle"
    ERROR_RECOVERY = "error_recovery"
    STOPPING = "stopping"
    STOPPED = "stopped"


class VisionPipeline:
    """Coordinates the full camera→preprocess→infer→detect pipeline."""

    def __init__(self, config: dict):
        self._config = config
        pipe_cfg = config.get("pipeline", {})

        self._frame_queue_size: int = pipe_cfg.get("frame_queue_size", 5)
        self._result_queue_size: int = pipe_cfg.get("result_queue_size", 10)

        mon_cfg = config.get("monitoring", {})
        self._max_errors: int = mon_cfg.get("max_consecutive_errors", 5)
        self._recovery_wait: float = mon_cfg.get("recovery_wait_s", 10.0)
        self._metrics_interval: float = mon_cfg.get("metrics_interval_s", 10.0)

        self._camera = CameraInterface(config)
        self._engine = TensorRTEngine(config)
        self._processor = DetectionProcessor(config)
        self._monitor = SystemMonitor(config)

        self._state = PipelineState.INIT
        self._frame_queue: queue.Queue = queue.Queue(maxsize=self._frame_queue_size)
        self._result_queue: queue.Queue = queue.Queue(maxsize=self._result_queue_size)

        self._running = False
        self._capture_thread: Optional[threading.Thread] = None
        self._infer_thread: Optional[threading.Thread] = None

        self._frame_id = 0
        self._consecutive_errors = 0
        self._result_callbacks: list[Callable[[dict], None]] = []

        self._monitor.add_throttle_callback(self._on_thermal_throttle)
        self._monitor.add_recovery_callback(self._on_thermal_recovery)

    @property
    def state(self) -> PipelineState:
        return self._state

    def add_result_callback(self, cb: Callable[[dict], None]) -> None:
        """Register a callback invoked with every detection result dict."""
        self._result_callbacks.append(cb)

    def initialize_pipeline(self) -> None:
        """Connect camera and load TensorRT engine. Raises on failure."""
        logger.info("Initialising vision pipeline")
        self._state = PipelineState.CAMERA_CONNECT

        if not self._camera.connect_camera():
            raise RuntimeError("Failed to connect to camera")

        self._state = PipelineState.PIPELINE_START
        logger.info("Loading TensorRT engine")
        self._engine.load_model()

        self._state = PipelineState.INFERENCE_READY
        logger.info("Pipeline initialised successfully")

    def start(self) -> None:
        """Start capture and inference threads."""
        if self._running:
            logger.warning("Pipeline already running")
            return

        if self._state not in (PipelineState.INFERENCE_READY, PipelineState.ERROR_RECOVERY):
            raise RuntimeError(f"Cannot start pipeline in state {self._state}")

        self._running = True
        self._state = PipelineState.RUNNING
        self._monitor.start()

        self._capture_thread = threading.Thread(
            target=self._capture_loop, daemon=True, name="CaptureThread"
        )
        self._infer_thread = threading.Thread(
            target=self._inference_loop, daemon=True, name="InferenceThread"
        )
        self._capture_thread.start()
        self._infer_thread.start()
        logger.info("Vision pipeline running")

    def stop(self) -> None:
        """Gracefully stop pipeline threads."""
        logger.info("Stopping vision pipeline")
        self._state = PipelineState.STOPPING
        self._running = False

        # Unblock queues
        try:
            self._frame_queue.put_nowait(None)
        except queue.Full:
            pass

        if self._capture_thread:
            self._capture_thread.join(timeout=10.0)
        if self._infer_thread:
            self._infer_thread.join(timeout=10.0)

        self._monitor.stop()
        self._engine.cleanup()
        self._camera.release()
        self._state = PipelineState.STOPPED
        logger.info("Vision pipeline stopped")

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        """Synchronously process a single frame and return detections.
        Exposed for direct use (e.g., testing)."""
        preprocessed = self._preprocess(frame)
        t0 = time.perf_counter()
        raw_output = self._engine.infer(preprocessed)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        metrics = self._monitor.get_metrics()
        self._frame_id += 1
        return self._processor.parse_detections(
            raw_output,
            frame_id=self._frame_id,
            inference_time_ms=elapsed_ms,
            system_temp_c=metrics.temperature_c,
        )

    def cleanup(self) -> None:
        if self._running:
            self.stop()

    # ------------------------------------------------------------------
    # Pipeline threads
    # ------------------------------------------------------------------

    def _capture_loop(self) -> None:
        last_metrics_time = time.time()
        while self._running:
            try:
                ok, frame = self._camera.get_frame()
                if not ok:
                    self._consecutive_errors += 1
                    if self._consecutive_errors >= self._max_errors:
                        logger.error("Too many consecutive frame errors; triggering recovery")
                        self._trigger_error_recovery()
                    continue

                self._consecutive_errors = 0
                try:
                    self._frame_queue.put_nowait(frame)
                except queue.Full:
                    # Drop oldest frame to avoid stalling
                    try:
                        self._frame_queue.get_nowait()
                    except queue.Empty:
                        pass
                    self._frame_queue.put_nowait(frame)

                now = time.time()
                if now - last_metrics_time >= self._metrics_interval:
                    stats = self._camera.get_frame_stats()
                    metrics = self._monitor.get_metrics()
                    logger.info(
                        "Frame stats: attempted=%d failed=%d rate=%.2f%% | "
                        "temp=%.1f°C power=%.1fW",
                        stats["frames_attempted"],
                        stats["frames_failed"],
                        stats["failure_rate"] * 100,
                        metrics.temperature_c,
                        metrics.power_w,
                    )
                    last_metrics_time = now

            except Exception:
                logger.exception("Error in capture loop")
                self._consecutive_errors += 1

    def _inference_loop(self) -> None:
        while self._running:
            try:
                frame = self._frame_queue.get(timeout=1.0)
                if frame is None:
                    continue

                result = self.process_frame(frame)
                result_dict = self._processor.format_output(result)

                # Deliver to callbacks
                for cb in self._result_callbacks:
                    try:
                        cb(result_dict)
                    except Exception:
                        logger.exception("Result callback error")

                # Non-blocking enqueue for external consumers
                try:
                    self._result_queue.put_nowait(result_dict)
                except queue.Full:
                    try:
                        self._result_queue.get_nowait()
                    except queue.Empty:
                        pass
                    self._result_queue.put_nowait(result_dict)

            except queue.Empty:
                continue
            except Exception:
                logger.exception("Error in inference loop")

    # ------------------------------------------------------------------
    # Frame preprocessing
    # ------------------------------------------------------------------

    def _preprocess(self, frame: np.ndarray) -> np.ndarray:
        """Resize to model input size and normalise to [0,1] NCHW float32."""
        try:
            import cv2
            resized = cv2.resize(
                frame,
                (self._engine._input_w, self._engine._input_h),
                interpolation=cv2.INTER_LINEAR,
            )
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        except ImportError:
            # Fallback: simple slice/pad without cv2 (degraded quality, for CI)
            rgb = frame[: self._engine._input_h, : self._engine._input_w]
            if rgb.shape[2] == 3:
                rgb = rgb[:, :, ::-1]  # BGR → RGB

        # HWC → NCHW, normalise
        arr = rgb.astype(np.float32) / 255.0
        arr = np.transpose(arr, (2, 0, 1))  # CHW
        arr = np.expand_dims(arr, axis=0)   # NCHW
        return np.ascontiguousarray(arr)

    # ------------------------------------------------------------------
    # Recovery callbacks
    # ------------------------------------------------------------------

    def _on_thermal_throttle(self, state: ThermalState) -> None:
        logger.warning("Thermal throttle event: %s", state.value)
        self._state = PipelineState.THERMAL_THROTTLE

    def _on_thermal_recovery(self) -> None:
        if self._state == PipelineState.THERMAL_THROTTLE:
            logger.info("Thermal recovery: resuming normal operation")
            self._state = PipelineState.RUNNING

    def _trigger_error_recovery(self) -> None:
        self._state = PipelineState.ERROR_RECOVERY
        self._consecutive_errors = 0
        logger.info("Error recovery: attempting camera reconnect in %.1fs", self._recovery_wait)
        time.sleep(self._recovery_wait)
        if self._camera.reconnect():
            self._state = PipelineState.RUNNING
            logger.info("Camera reconnected; resuming pipeline")
        else:
            logger.error("Camera reconnect failed; pipeline remains in ERROR_RECOVERY")
