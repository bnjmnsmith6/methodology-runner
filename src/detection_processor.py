"""Post-process raw TensorRT output into structured detection results."""

import logging
import time
from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] normalised 0-1
    tracking_id: Optional[int] = None


@dataclass
class DetectionResult:
    timestamp: int  # Unix epoch ms
    frame_id: int
    detections: List[Detection] = field(default_factory=list)
    inference_time_ms: float = 0.0
    system_temp_c: float = 0.0

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "frame_id": self.frame_id,
            "detections": [
                {
                    "class": d.class_name,
                    "confidence": d.confidence,
                    "bbox": d.bbox,
                    "tracking_id": d.tracking_id,
                }
                for d in self.detections
            ],
            "inference_time_ms": self.inference_time_ms,
            "system_temp_c": self.system_temp_c,
        }


class DetectionProcessor:
    """Converts raw model output to DetectionResult objects."""

    def __init__(self, config: dict):
        inf_cfg = config.get("inference", {})
        self._conf_threshold: float = inf_cfg.get("confidence_threshold", 0.5)
        self._nms_threshold: float = inf_cfg.get("nms_threshold", 0.4)
        self._max_detections: int = inf_cfg.get("max_detections", 100)
        self._input_w: int = inf_cfg.get("input_width", 640)
        self._input_h: int = inf_cfg.get("input_height", 640)

        self._classes: List[str] = config.get(
            "classes",
            ["person", "vehicle", "bicycle", "motorcycle", "car", "truck", "bus", "object"],
        )
        # Remap COCO class IDs to our simplified taxonomy
        self._coco_to_class = self._build_coco_map()

    def parse_detections(
        self,
        raw_output: np.ndarray,
        frame_id: int,
        inference_time_ms: float,
        system_temp_c: float = 0.0,
    ) -> DetectionResult:
        """Parse YOLO-format output (shape [1, N, 85]) into DetectionResult.

        The 85 values per detection are:
        [cx, cy, w, h, obj_conf, class0_conf, ..., class79_conf]
        """
        timestamp_ms = int(time.time() * 1000)
        result = DetectionResult(
            timestamp=timestamp_ms,
            frame_id=frame_id,
            inference_time_ms=inference_time_ms,
            system_temp_c=system_temp_c,
        )

        if raw_output is None or raw_output.size == 0:
            return result

        detections = self._decode_yolo_output(raw_output)
        detections = self.filter_results(detections)
        result.detections = detections[: self._max_detections]
        return result

    def filter_results(self, detections: List[Detection]) -> List[Detection]:
        """Apply confidence filtering and NMS."""
        if not detections:
            return []

        boxes = np.array([d.bbox for d in detections], dtype=np.float32)
        scores = np.array([d.confidence for d in detections], dtype=np.float32)

        # Per-class NMS
        kept_indices = self._nms(boxes, scores, self._nms_threshold)
        return [detections[i] for i in kept_indices]

    def format_output(self, result: DetectionResult) -> dict:
        """Format DetectionResult to the canonical output schema dict."""
        return result.to_dict()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _decode_yolo_output(self, raw: np.ndarray) -> List[Detection]:
        """Decode YOLO output tensor into Detection list."""
        detections: List[Detection] = []

        # raw shape: (1, N, 85) or (N, 85)
        if raw.ndim == 3:
            raw = raw[0]  # (N, 85)

        for row in raw:
            cx, cy, w, h = row[0], row[1], row[2], row[3]
            obj_conf = float(row[4])
            class_scores = row[5:]

            class_id = int(np.argmax(class_scores))
            class_conf = float(class_scores[class_id])
            confidence = obj_conf * class_conf

            if confidence < self._conf_threshold:
                continue

            # Convert cx,cy,w,h (normalised) → x1,y1,x2,y2
            x1 = max(0.0, cx - w / 2)
            y1 = max(0.0, cy - h / 2)
            x2 = min(1.0, cx + w / 2)
            y2 = min(1.0, cy + h / 2)

            class_name = self._coco_to_class.get(class_id, "object")
            if class_name not in self._classes:
                class_name = "object"

            detections.append(
                Detection(
                    class_name=class_name,
                    confidence=round(confidence, 4),
                    bbox=[round(x1, 4), round(y1, 4), round(x2, 4), round(y2, 4)],
                )
            )

        return detections

    def _nms(self, boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> List[int]:
        """Greedy NMS. boxes are [x1,y1,x2,y2] normalised."""
        if len(boxes) == 0:
            return []

        x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort()[::-1]

        kept = []
        while len(order) > 0:
            i = order[0]
            kept.append(int(i))
            if len(order) == 1:
                break

            rest = order[1:]
            inter_x1 = np.maximum(x1[i], x1[rest])
            inter_y1 = np.maximum(y1[i], y1[rest])
            inter_x2 = np.minimum(x2[i], x2[rest])
            inter_y2 = np.minimum(y2[i], y2[rest])

            inter_w = np.maximum(0.0, inter_x2 - inter_x1)
            inter_h = np.maximum(0.0, inter_y2 - inter_y1)
            intersection = inter_w * inter_h
            union = areas[i] + areas[rest] - intersection
            iou = intersection / np.maximum(union, 1e-6)

            order = rest[iou <= iou_threshold]

        return kept

    def _build_coco_map(self) -> dict:
        """Map COCO class IDs to our detection taxonomy."""
        return {
            0: "person",
            1: "bicycle",
            2: "car",
            3: "motorcycle",
            5: "bus",
            7: "truck",
        }
