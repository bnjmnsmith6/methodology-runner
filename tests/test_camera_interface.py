"""Tests for CameraInterface — uses mocked cv2 to avoid hardware dependency."""

import sys
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

BASE_CONFIG = {
    "camera": {
        "rtsp_url": "rtsp://test/stream",
        "width": 3840,
        "height": 2160,
        "fps": 30,
        "reconnect_delay_s": 0.01,
        "max_reconnect_attempts": 3,
        "failed_frame_threshold": 0.05,
        "buffer_size": 2,
    }
}


def _make_mock_cap(opened=True, read_frame=True):
    cap = MagicMock()
    cap.isOpened.return_value = opened
    cap.get.return_value = 30.0
    dummy_frame = np.zeros((2160, 3840, 3), dtype=np.uint8)
    cap.read.return_value = (read_frame, dummy_frame if read_frame else None)
    return cap


class TestCameraInterface:
    def _make_interface(self):
        # Import here so the cv2 mock is in place
        from src.camera_interface import CameraInterface
        return CameraInterface(BASE_CONFIG)

    @patch("src.camera_interface._CV2_AVAILABLE", True)
    @patch("src.camera_interface.cv2")
    def test_connect_success(self, mock_cv2):
        mock_cv2.CAP_GSTREAMER = 1800
        mock_cv2.CAP_PROP_FRAME_WIDTH = 3
        mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
        mock_cv2.CAP_PROP_FPS = 5
        mock_cv2.CAP_PROP_BUFFERSIZE = 38

        cap = _make_mock_cap(opened=True)
        mock_cv2.VideoCapture.return_value = cap

        cam = self._make_interface()
        result = cam.connect_camera()

        assert result is True
        from src.camera_interface import CameraState
        assert cam.state == CameraState.CONNECTED

    @patch("src.camera_interface._CV2_AVAILABLE", True)
    @patch("src.camera_interface.cv2")
    def test_connect_failure_both_methods(self, mock_cv2):
        mock_cv2.CAP_GSTREAMER = 1800
        mock_cv2.CAP_PROP_FRAME_WIDTH = 3
        mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
        mock_cv2.CAP_PROP_FPS = 5
        mock_cv2.CAP_PROP_BUFFERSIZE = 38

        cap = _make_mock_cap(opened=False)
        mock_cv2.VideoCapture.return_value = cap

        cam = self._make_interface()
        result = cam.connect_camera()

        assert result is False
        from src.camera_interface import CameraState
        assert cam.state == CameraState.ERROR

    @patch("src.camera_interface._CV2_AVAILABLE", True)
    @patch("src.camera_interface.cv2")
    def test_get_frame_success(self, mock_cv2):
        mock_cv2.CAP_GSTREAMER = 1800
        mock_cv2.CAP_PROP_FRAME_WIDTH = 3
        mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
        mock_cv2.CAP_PROP_FPS = 5
        mock_cv2.CAP_PROP_BUFFERSIZE = 38

        cap = _make_mock_cap(opened=True, read_frame=True)
        mock_cv2.VideoCapture.return_value = cap

        cam = self._make_interface()
        cam.connect_camera()

        ok, frame = cam.get_frame()
        assert ok is True
        assert frame is not None

    @patch("src.camera_interface._CV2_AVAILABLE", True)
    @patch("src.camera_interface.cv2")
    def test_get_frame_failed(self, mock_cv2):
        mock_cv2.CAP_GSTREAMER = 1800
        mock_cv2.CAP_PROP_FRAME_WIDTH = 3
        mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
        mock_cv2.CAP_PROP_FPS = 5
        mock_cv2.CAP_PROP_BUFFERSIZE = 38

        cap = _make_mock_cap(opened=True, read_frame=False)
        mock_cv2.VideoCapture.return_value = cap

        cam = self._make_interface()
        cam.connect_camera()

        ok, frame = cam.get_frame()
        assert ok is False
        assert frame is None

    @patch("src.camera_interface._CV2_AVAILABLE", True)
    @patch("src.camera_interface.cv2")
    def test_frame_stats_tracked(self, mock_cv2):
        mock_cv2.CAP_GSTREAMER = 1800
        mock_cv2.CAP_PROP_FRAME_WIDTH = 3
        mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
        mock_cv2.CAP_PROP_FPS = 5
        mock_cv2.CAP_PROP_BUFFERSIZE = 38

        cap = _make_mock_cap(opened=True, read_frame=True)
        # Alternate: first two success, third fail
        frames = [
            (True, np.zeros((10, 10, 3), dtype=np.uint8)),
            (True, np.zeros((10, 10, 3), dtype=np.uint8)),
            (False, None),
        ]
        cap.read.side_effect = frames
        mock_cv2.VideoCapture.return_value = cap

        cam = self._make_interface()
        cam.connect_camera()

        cam.get_frame()
        cam.get_frame()
        cam.get_frame()

        stats = cam.get_frame_stats()
        assert stats["frames_attempted"] == 3
        assert stats["frames_failed"] == 1
        assert stats["failure_rate"] == pytest.approx(1 / 3)

    @patch("src.camera_interface._CV2_AVAILABLE", True)
    @patch("src.camera_interface.cv2")
    @patch("src.camera_interface.time.sleep")
    def test_reconnect_resets_cap(self, mock_sleep, mock_cv2):
        mock_cv2.CAP_GSTREAMER = 1800
        mock_cv2.CAP_PROP_FRAME_WIDTH = 3
        mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
        mock_cv2.CAP_PROP_FPS = 5
        mock_cv2.CAP_PROP_BUFFERSIZE = 38

        cap = _make_mock_cap(opened=True)
        mock_cv2.VideoCapture.return_value = cap

        cam = self._make_interface()
        cam.connect_camera()
        result = cam.reconnect()

        assert result is True
        assert mock_cv2.VideoCapture.call_count >= 2  # initial + reconnect

    def test_no_cv2_raises_runtime_error(self):
        with patch("src.camera_interface._CV2_AVAILABLE", False):
            from src.camera_interface import CameraInterface
            cam = CameraInterface(BASE_CONFIG)
            with pytest.raises(RuntimeError, match="OpenCV"):
                cam.connect_camera()
