"""Application entry point for the vision security pipeline."""

import logging
import os
import signal
import sys
import time
from pathlib import Path

import yaml

from .vision_pipeline import VisionPipeline, PipelineState

logger = logging.getLogger(__name__)


def _configure_logging(level_name: str = "INFO") -> None:
    level = getattr(logging, level_name.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )


def _load_config(config_path: str) -> dict:
    with open(config_path) as f:
        return yaml.safe_load(f)


def shutdown_handler(pipeline: VisionPipeline, signum: int, _frame) -> None:
    logger.info("Signal %d received — shutting down", signum)
    pipeline.stop()
    sys.exit(0)


def main(config_path: str = "config/system_config.yaml") -> int:
    """Main entry point. Returns exit code."""
    _configure_logging()

    config_file = Path(config_path)
    if not config_file.exists():
        logger.error("Config file not found: %s", config_path)
        return 1

    try:
        config = _load_config(config_path)
    except Exception:
        logger.exception("Failed to load config: %s", config_path)
        return 1

    log_level = config.get("monitoring", {}).get("log_level", "INFO")
    _configure_logging(log_level)

    logger.info("Starting vision security pipeline")
    pipeline = VisionPipeline(config)

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, lambda s, f: shutdown_handler(pipeline, s, f))
    signal.signal(signal.SIGTERM, lambda s, f: shutdown_handler(pipeline, s, f))

    try:
        pipeline.initialize_pipeline()
    except Exception:
        logger.exception("Pipeline initialisation failed")
        return 1

    def log_result(result: dict) -> None:
        n = len(result.get("detections", []))
        latency = result.get("inference_time_ms", 0.0)
        temp = result.get("system_temp_c", 0.0)
        logger.debug(
            "frame=%d detections=%d latency=%.1fms temp=%.1f°C",
            result.get("frame_id", 0),
            n,
            latency,
            temp,
        )

    pipeline.add_result_callback(log_result)

    try:
        pipeline.start()
        # Main thread: keep alive and watch for unrecoverable errors
        while True:
            time.sleep(1.0)
            if pipeline.state == PipelineState.STOPPED:
                logger.error("Pipeline unexpectedly stopped")
                return 1
    except KeyboardInterrupt:
        pass
    finally:
        pipeline.cleanup()

    logger.info("Vision pipeline exited cleanly")
    return 0


if __name__ == "__main__":
    config_path = os.environ.get("VISION_CONFIG", "config/system_config.yaml")
    if len(sys.argv) > 1:
        config_path = sys.argv[1]
    sys.exit(main(config_path))
