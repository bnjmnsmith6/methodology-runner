"""Tests for SystemMonitor — thermal classification and state transitions."""

import threading
import time
from unittest.mock import MagicMock, patch

import pytest

from src.system_monitor import PowerState, SystemMonitor, ThermalState

BASE_CONFIG = {
    "thermal": {
        "warning_temp_c": 65.0,
        "throttle_temp_c": 70.0,
        "critical_temp_c": 80.0,
        "poll_interval_s": 0.05,  # Fast for tests
        "thermal_zone_path": "/nonexistent/thermal",
    },
    "power": {
        "max_watts": 15.0,
        "warning_watts": 13.0,
        "power_mode_normal": 0,
        "ina3221_path": "/nonexistent/ina3221",
    },
    "monitoring": {
        "metrics_interval_s": 1.0,
    },
}


class TestThermalClassification:
    def setup_method(self):
        self.monitor = SystemMonitor(BASE_CONFIG)

    def test_normal_temp(self):
        with patch.object(self.monitor, "_read_temperature", return_value=50.0):
            assert self.monitor.check_thermal() == ThermalState.NORMAL

    def test_warning_temp_at_boundary(self):
        with patch.object(self.monitor, "_read_temperature", return_value=65.0):
            assert self.monitor.check_thermal() == ThermalState.WARNING

    def test_throttle_temp_at_boundary(self):
        with patch.object(self.monitor, "_read_temperature", return_value=70.0):
            assert self.monitor.check_thermal() == ThermalState.THROTTLED

    def test_critical_temp(self):
        with patch.object(self.monitor, "_read_temperature", return_value=85.0):
            assert self.monitor.check_thermal() == ThermalState.CRITICAL

    def test_below_warning(self):
        with patch.object(self.monitor, "_read_temperature", return_value=64.9):
            assert self.monitor.check_thermal() == ThermalState.NORMAL


class TestPowerClassification:
    def setup_method(self):
        self.monitor = SystemMonitor(BASE_CONFIG)

    def test_normal_power(self):
        assert self.monitor._classify_power(10.0) == PowerState.NORMAL

    def test_warning_power(self):
        assert self.monitor._classify_power(13.5) == PowerState.WARNING

    def test_throttled_power(self):
        assert self.monitor._classify_power(15.5) == PowerState.THROTTLED


class TestSystemMonitorCallbacks:
    def setup_method(self):
        self.monitor = SystemMonitor(BASE_CONFIG)

    def test_throttle_callback_fired_on_throttle(self):
        cb = MagicMock()
        self.monitor.add_throttle_callback(cb)

        with (
            patch.object(self.monitor, "_read_temperature", return_value=72.0),
            patch.object(self.monitor, "_read_power", return_value=10.0),
            patch.object(self.monitor, "_read_cpu_freq", return_value=0),
            patch.object(self.monitor, "_read_gpu_freq", return_value=0),
            patch.object(self.monitor, "_apply_throttling"),
        ):
            self.monitor._prev_thermal_state = ThermalState.NORMAL
            self.monitor._update_metrics()
            self.monitor._handle_state_transitions()

        cb.assert_called_once()
        args = cb.call_args[0]
        assert args[0] == ThermalState.THROTTLED

    def test_recovery_callback_fired_on_return_to_normal(self):
        cb = MagicMock()
        self.monitor.add_recovery_callback(cb)
        self.monitor._prev_thermal_state = ThermalState.THROTTLED

        with (
            patch.object(self.monitor, "_read_temperature", return_value=50.0),
            patch.object(self.monitor, "_read_power", return_value=10.0),
            patch.object(self.monitor, "_read_cpu_freq", return_value=0),
            patch.object(self.monitor, "_read_gpu_freq", return_value=0),
            patch.object(self.monitor, "_remove_throttling"),
        ):
            self.monitor._update_metrics()
            self.monitor._handle_state_transitions()

        cb.assert_called_once()

    def test_no_callback_when_state_unchanged(self):
        throttle_cb = MagicMock()
        recovery_cb = MagicMock()
        self.monitor.add_throttle_callback(throttle_cb)
        self.monitor.add_recovery_callback(recovery_cb)
        self.monitor._prev_thermal_state = ThermalState.NORMAL

        with (
            patch.object(self.monitor, "_read_temperature", return_value=50.0),
            patch.object(self.monitor, "_read_power", return_value=10.0),
            patch.object(self.monitor, "_read_cpu_freq", return_value=0),
            patch.object(self.monitor, "_read_gpu_freq", return_value=0),
        ):
            self.monitor._update_metrics()
            self.monitor._handle_state_transitions()

        throttle_cb.assert_not_called()
        recovery_cb.assert_not_called()


class TestSystemMonitorStartStop:
    def test_start_and_stop(self):
        monitor = SystemMonitor(BASE_CONFIG)
        with (
            patch.object(monitor, "_read_temperature", return_value=40.0),
            patch.object(monitor, "_read_power", return_value=8.0),
            patch.object(monitor, "_read_cpu_freq", return_value=0),
            patch.object(monitor, "_read_gpu_freq", return_value=0),
        ):
            monitor.start()
            assert monitor._running is True
            time.sleep(0.15)  # Let monitor loop run a couple times
            monitor.stop()
            assert monitor._running is False

    def test_get_metrics_returns_snapshot(self):
        monitor = SystemMonitor(BASE_CONFIG)
        with (
            patch.object(monitor, "_read_temperature", return_value=55.0),
            patch.object(monitor, "_read_power", return_value=10.0),
            patch.object(monitor, "_read_cpu_freq", return_value=1200),
            patch.object(monitor, "_read_gpu_freq", return_value=800),
        ):
            monitor._update_metrics()

        metrics = monitor.get_metrics()
        assert metrics.temperature_c == pytest.approx(55.0)
        assert metrics.power_w == pytest.approx(10.0)
        assert metrics.thermal_state == ThermalState.NORMAL
