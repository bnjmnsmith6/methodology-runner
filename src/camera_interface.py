"""Reolink RLC-811A camera interface via RTSP/GStreamer."""

import logging
import time
from enum import Enum
from typing import Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# cv2 import is deferred to allow testing without OpenCV installed
try:
    import cv2

    _CV2_AVAILABLE = True
except ImportError:
    _CV2_AVAILABLE = False
    logger.warning("OpenCV not available; camera interface will not function")


class CameraState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


class CameraInterface:
    """Manages RTSP connection to Reolink RLC-811A and delivers frames."""

    def __init__(self, config: dict):
        self._config = config
        cam_cfg = config.get("camera", {})

        self._rtsp_url: str = cam_cfg.get("rtsp_url", "")
        self._width: int = cam_cfg.get("width", 3840)
        self._height: int = cam_cfg.get("height", 2160)
        self._fps: int = cam_cfg.get("fps", 30)
        self._reconnect_delay: float = cam_cfg.get("reconnect_delay_s", 5.0)
        self._max_reconnect: int = cam_cfg.get("max_reconnect_attempts", 10)
        self._failed_threshold: float = cam_cfg.get("failed_frame_threshold", 0.05)
        self._buffer_size: int = cam_cfg.get("buffer_size", 2)

        self._cap: Optional[object] = None  # cv2.VideoCapture
        self._state = CameraState.DISCONNECTED
        self._reconnect_count = 0

        # Frame statistics for failure-rate tracking
        self._frames_attempted = 0
        self._frames_failed = 0

    @property
    def state(self) -> CameraState:
        return self._state

    def connect_camera(self) -> bool:
        """Connect to the RTSP stream. Returns True on success."""
        if not _CV2_AVAILABLE:
            raise RuntimeError("OpenCV is required for camera interface")

        self._state = CameraState.CONNECTING
        logger.info("Connecting to camera: %s", self._rtsp_url)

        gst_pipeline = self._build_gstreamer_pipeline()
        cap = cv2.VideoCapture(gst_pipeline, cv2.CAP_GSTREAMER)

        if not cap.isOpened():
            # Fallback: direct RTSP without custom GStreamer pipeline
            logger.warning("GStreamer pipeline failed, falling back to direct RTSP")
            cap = cv2.VideoCapture(self._rtsp_url)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, self._buffer_size)

        if not cap.isOpened():
            logger.error("Failed to open camera stream: %s", self._rtsp_url)
            self._state = CameraState.ERROR
            return False

        self._cap = cap
        self._state = CameraState.CONNECTED
        self._reconnect_count = 0
        self._frames_attempted = 0
        self._frames_failed = 0

        actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        logger.info(
            "Camera connected: %dx%d @ %.1ffps", actual_w, actual_h, actual_fps
        )
        return True

    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Capture the next frame. Returns (success, frame_bgr or None)."""
        if self._cap is None or self._state != CameraState.CONNECTED:
            return False, None

        self._frames_attempted += 1
        ret, frame = self._cap.read()

        if not ret or frame is None:
            self._frames_failed += 1
            self._check_failure_rate()
            return False, None

        return True, frame

    def reconnect(self) -> bool:
        """Attempt to re-establish the camera connection."""
        if self._reconnect_count >= self._max_reconnect:
            logger.error(
                "Max reconnect attempts (%d) reached", self._max_reconnect
            )
            self._state = CameraState.ERROR
            return False

        self._reconnect_count += 1
        logger.info(
            "Reconnect attempt %d/%d in %.1fs",
            self._reconnect_count,
            self._max_reconnect,
            self._reconnect_delay,
        )
        self._release()
        time.sleep(self._reconnect_delay)
        return self.connect_camera()

    def release(self) -> None:
        """Release camera resources."""
        self._release()
        self._state = CameraState.DISCONNECTED
        logger.info("Camera released")

    def get_frame_stats(self) -> dict:
        attempted = self._frames_attempted
        failed = self._frames_failed
        rate = (failed / attempted) if attempted > 0 else 0.0
        return {
            "frames_attempted": attempted,
            "frames_failed": failed,
            "failure_rate": rate,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_gstreamer_pipeline(self) -> str:
        """Build optimised GStreamer pipeline for Jetson NVDEC decoding."""
        return (
            f"rtspsrc location={self._rtsp_url} latency=100 ! "
            "rtph264depay ! h264parse ! "
            "nvv4l2decoder ! "
            "nvvidconv ! "
            "video/x-raw,format=BGRx ! "
            "videoconvert ! "
            "video/x-raw,format=BGR ! "
            "appsink max-buffers=2 drop=true"
        )

    def _check_failure_rate(self) -> None:
        if self._frames_attempted < 100:
            return
        rate = self._frames_failed / self._frames_attempted
        if rate > self._failed_threshold:
            logger.warning(
                "Frame failure rate %.1f%% exceeds threshold %.1f%% — reconnecting",
                rate * 100,
                self._failed_threshold * 100,
            )
            self.reconnect()

    def _release(self) -> None:
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
