"""Tests for detection post-processing logic — no hardware required."""

import time

import numpy as np
import pytest

from src.detection_processor import Detection, DetectionProcessor, DetectionResult

BASE_CONFIG = {
    "inference": {
        "confidence_threshold": 0.5,
        "nms_threshold": 0.4,
        "max_detections": 100,
        "input_width": 640,
        "input_height": 640,
    },
    "classes": ["person", "vehicle", "bicycle", "motorcycle", "car", "truck", "bus", "object"],
}


def _make_yolo_row(cx, cy, w, h, obj_conf, class_id, class_conf, num_classes=80):
    """Build a single YOLO detection row."""
    row = np.zeros(5 + num_classes, dtype=np.float32)
    row[0], row[1], row[2], row[3] = cx, cy, w, h
    row[4] = obj_conf
    row[5 + class_id] = class_conf
    return row


class TestDetectionProcessor:
    def setup_method(self):
        self.proc = DetectionProcessor(BASE_CONFIG)

    def test_empty_output_returns_no_detections(self):
        raw = np.zeros((1, 0, 85), dtype=np.float32)
        result = self.proc.parse_detections(raw, frame_id=1, inference_time_ms=10.0)
        assert isinstance(result, DetectionResult)
        assert result.frame_id == 1
        assert len(result.detections) == 0

    def test_none_output_returns_no_detections(self):
        result = self.proc.parse_detections(None, frame_id=2, inference_time_ms=5.0)
        assert len(result.detections) == 0

    def test_single_high_confidence_person_detected(self):
        row = _make_yolo_row(0.5, 0.5, 0.2, 0.4, obj_conf=0.9, class_id=0, class_conf=0.95)
        raw = row.reshape(1, 1, 85)
        result = self.proc.parse_detections(raw, frame_id=3, inference_time_ms=20.0)
        assert len(result.detections) == 1
        det = result.detections[0]
        assert det.class_name == "person"
        assert det.confidence == pytest.approx(0.9 * 0.95, abs=1e-3)

    def test_low_confidence_detection_filtered_out(self):
        row = _make_yolo_row(0.5, 0.5, 0.2, 0.4, obj_conf=0.3, class_id=0, class_conf=0.4)
        # 0.3 * 0.4 = 0.12 < threshold 0.5
        raw = row.reshape(1, 1, 85)
        result = self.proc.parse_detections(raw, frame_id=4, inference_time_ms=15.0)
        assert len(result.detections) == 0

    def test_bbox_coordinates_normalised(self):
        row = _make_yolo_row(0.5, 0.5, 0.4, 0.6, obj_conf=0.9, class_id=0, class_conf=0.9)
        raw = row.reshape(1, 1, 85)
        result = self.proc.parse_detections(raw, frame_id=5, inference_time_ms=18.0)
        assert len(result.detections) == 1
        x1, y1, x2, y2 = result.detections[0].bbox
        assert 0.0 <= x1 < x2 <= 1.0
        assert 0.0 <= y1 < y2 <= 1.0

    def test_nms_removes_overlapping_boxes(self):
        # Two nearly-identical boxes for the same object
        row1 = _make_yolo_row(0.5, 0.5, 0.4, 0.4, obj_conf=0.9, class_id=0, class_conf=0.9)
        row2 = _make_yolo_row(0.51, 0.51, 0.4, 0.4, obj_conf=0.85, class_id=0, class_conf=0.85)
        raw = np.array([[row1, row2]], dtype=np.float32)
        result = self.proc.parse_detections(raw, frame_id=6, inference_time_ms=25.0)
        assert len(result.detections) == 1  # NMS should keep only the higher-confidence one

    def test_multiple_distinct_detections_kept(self):
        # Two well-separated boxes
        row1 = _make_yolo_row(0.1, 0.1, 0.1, 0.1, obj_conf=0.9, class_id=0, class_conf=0.9)  # top-left
        row2 = _make_yolo_row(0.9, 0.9, 0.1, 0.1, obj_conf=0.9, class_id=2, class_conf=0.9)  # bottom-right (car)
        raw = np.array([[row1, row2]], dtype=np.float32)
        result = self.proc.parse_detections(raw, frame_id=7, inference_time_ms=22.0)
        assert len(result.detections) == 2

    def test_max_detections_cap_respected(self):
        cfg = {**BASE_CONFIG, "inference": {**BASE_CONFIG["inference"], "max_detections": 3}}
        proc = DetectionProcessor(cfg)
        rows = [
            _make_yolo_row(i * 0.1, 0.1, 0.05, 0.05, obj_conf=0.9, class_id=0, class_conf=0.9)
            for i in range(10)
        ]
        raw = np.array([rows], dtype=np.float32)
        result = proc.parse_detections(raw, frame_id=8, inference_time_ms=30.0)
        assert len(result.detections) <= 3

    def test_to_dict_schema(self):
        row = _make_yolo_row(0.5, 0.5, 0.2, 0.4, obj_conf=0.9, class_id=0, class_conf=0.9)
        raw = row.reshape(1, 1, 85)
        result = self.proc.parse_detections(raw, frame_id=9, inference_time_ms=12.0, system_temp_c=45.0)
        d = result.to_dict()

        assert "timestamp" in d
        assert "frame_id" in d
        assert "detections" in d
        assert "inference_time_ms" in d
        assert "system_temp_c" in d
        assert d["frame_id"] == 9
        assert d["system_temp_c"] == 45.0
        assert isinstance(d["detections"], list)

        if d["detections"]:
            det = d["detections"][0]
            assert "class" in det
            assert "confidence" in det
            assert "bbox" in det
            assert "tracking_id" in det
            assert len(det["bbox"]) == 4

    def test_timestamp_is_recent(self):
        raw = np.zeros((1, 0, 85), dtype=np.float32)
        before = int(time.time() * 1000)
        result = self.proc.parse_detections(raw, frame_id=10, inference_time_ms=5.0)
        after = int(time.time() * 1000)
        assert before <= result.timestamp <= after

    def test_vehicle_class_mapped(self):
        # COCO class 2 = car
        row = _make_yolo_row(0.5, 0.5, 0.3, 0.3, obj_conf=0.9, class_id=2, class_conf=0.9)
        raw = row.reshape(1, 1, 85)
        result = self.proc.parse_detections(raw, frame_id=11, inference_time_ms=20.0)
        assert len(result.detections) == 1
        assert result.detections[0].class_name == "car"

    def test_unknown_coco_class_mapped_to_object(self):
        # COCO class 10 = traffic light — not in our map
        row = _make_yolo_row(0.5, 0.5, 0.1, 0.1, obj_conf=0.9, class_id=10, class_conf=0.9)
        raw = row.reshape(1, 1, 85)
        result = self.proc.parse_detections(raw, frame_id=12, inference_time_ms=20.0)
        assert len(result.detections) == 1
        assert result.detections[0].class_name == "object"

    def test_format_output_returns_dict(self):
        row = _make_yolo_row(0.5, 0.5, 0.2, 0.2, obj_conf=0.9, class_id=0, class_conf=0.9)
        raw = row.reshape(1, 1, 85)
        result = self.proc.parse_detections(raw, frame_id=13, inference_time_ms=10.0)
        output = self.proc.format_output(result)
        assert isinstance(output, dict)
        assert output["frame_id"] == 13
