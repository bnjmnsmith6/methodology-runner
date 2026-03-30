"""System health monitoring: thermal management and power monitoring for Jetson Orin Nano."""

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class ThermalState(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    THROTTLED = "throttled"
    CRITICAL = "critical"


class PowerState(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    THROTTLED = "throttled"


@dataclass
class SystemMetrics:
    timestamp: float = 0.0
    temperature_c: float = 0.0
    power_w: float = 0.0
    thermal_state: ThermalState = ThermalState.NORMAL
    power_state: PowerState = PowerState.NORMAL
    cpu_freq_mhz: int = 0
    gpu_freq_mhz: int = 0


class SystemMonitor:
    """Monitors Jetson thermal and power state, triggers throttling and recovery."""

    def __init__(self, config: dict):
        self._config = config
        self._thermal_cfg = config.get("thermal", {})
        self._power_cfg = config.get("power", {})
        self._monitoring_cfg = config.get("monitoring", {})

        self._warning_temp = self._thermal_cfg.get("warning_temp_c", 65.0)
        self._throttle_temp = self._thermal_cfg.get("throttle_temp_c", 70.0)
        self._critical_temp = self._thermal_cfg.get("critical_temp_c", 80.0)
        self._thermal_zone = self._thermal_cfg.get(
            "thermal_zone_path", "/sys/class/thermal/thermal_zone0/temp"
        )
        self._poll_interval = self._thermal_cfg.get("poll_interval_s", 5.0)

        self._max_watts = self._power_cfg.get("max_watts", 15.0)
        self._warning_watts = self._power_cfg.get("warning_watts", 13.0)
        self._ina3221_path = self._power_cfg.get("ina3221_path", "/sys/bus/i2c/drivers/ina3221x")

        self._current_metrics = SystemMetrics(timestamp=time.time())
        self._lock = threading.Lock()
        self._running = False
        self._monitor_thread: Optional[threading.Thread] = None

        self._throttle_callbacks: list[Callable[[ThermalState], None]] = []
        self._recovery_callbacks: list[Callable[[], None]] = []
        self._prev_thermal_state = ThermalState.NORMAL

    def add_throttle_callback(self, cb: Callable[[ThermalState], None]) -> None:
        self._throttle_callbacks.append(cb)

    def add_recovery_callback(self, cb: Callable[[], None]) -> None:
        self._recovery_callbacks.append(cb)

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop, daemon=True, name="SystemMonitor"
        )
        self._monitor_thread.start()
        logger.info("System monitor started")

    def stop(self) -> None:
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=10.0)
        logger.info("System monitor stopped")

    def get_metrics(self) -> SystemMetrics:
        with self._lock:
            return SystemMetrics(
                timestamp=self._current_metrics.timestamp,
                temperature_c=self._current_metrics.temperature_c,
                power_w=self._current_metrics.power_w,
                thermal_state=self._current_metrics.thermal_state,
                power_state=self._current_metrics.power_state,
                cpu_freq_mhz=self._current_metrics.cpu_freq_mhz,
                gpu_freq_mhz=self._current_metrics.gpu_freq_mhz,
            )

    def check_thermal(self) -> ThermalState:
        temp = self._read_temperature()
        if temp >= self._critical_temp:
            return ThermalState.CRITICAL
        if temp >= self._throttle_temp:
            return ThermalState.THROTTLED
        if temp >= self._warning_temp:
            return ThermalState.WARNING
        return ThermalState.NORMAL

    def trigger_recovery(self) -> None:
        logger.info("Triggering system recovery")
        for cb in self._recovery_callbacks:
            try:
                cb()
            except Exception:
                logger.exception("Recovery callback failed")

    def _monitor_loop(self) -> None:
        while self._running:
            try:
                self._update_metrics()
                self._handle_state_transitions()
            except Exception:
                logger.exception("Error in monitor loop")
            time.sleep(self._poll_interval)

    def _update_metrics(self) -> None:
        temp = self._read_temperature()
        power = self._read_power()
        thermal_state = self._classify_thermal(temp)
        power_state = self._classify_power(power)
        cpu_freq = self._read_cpu_freq()
        gpu_freq = self._read_gpu_freq()

        with self._lock:
            self._current_metrics = SystemMetrics(
                timestamp=time.time(),
                temperature_c=temp,
                power_w=power,
                thermal_state=thermal_state,
                power_state=power_state,
                cpu_freq_mhz=cpu_freq,
                gpu_freq_mhz=gpu_freq,
            )

        if temp >= self._warning_temp:
            logger.warning(
                "Temperature %.1f°C (state=%s, power=%.1fW)",
                temp,
                thermal_state.value,
                power,
            )

    def _handle_state_transitions(self) -> None:
        with self._lock:
            current_state = self._current_metrics.thermal_state

        if current_state != self._prev_thermal_state:
            logger.info(
                "Thermal state: %s → %s",
                self._prev_thermal_state.value,
                current_state.value,
            )
            if current_state in (ThermalState.THROTTLED, ThermalState.CRITICAL):
                self._apply_throttling(current_state)
                for cb in self._throttle_callbacks:
                    try:
                        cb(current_state)
                    except Exception:
                        logger.exception("Throttle callback failed")
            elif (
                current_state == ThermalState.NORMAL
                and self._prev_thermal_state != ThermalState.NORMAL
            ):
                self._remove_throttling()
                for cb in self._recovery_callbacks:
                    try:
                        cb()
                    except Exception:
                        logger.exception("Recovery callback failed")
            self._prev_thermal_state = current_state

    def _apply_throttling(self, state: ThermalState) -> None:
        logger.warning("Applying thermal throttling for state: %s", state.value)
        try:
            nvpmodel_mode = 1 if state == ThermalState.THROTTLED else 2
            os.system(f"nvpmodel -m {nvpmodel_mode} 2>/dev/null")
        except Exception:
            logger.debug("nvpmodel not available (expected in non-Jetson environment)")

    def _remove_throttling(self) -> None:
        logger.info("Removing thermal throttling, restoring normal power mode")
        try:
            power_mode = self._power_cfg.get("power_mode_normal", 0)
            os.system(f"nvpmodel -m {power_mode} 2>/dev/null")
        except Exception:
            logger.debug("nvpmodel not available (expected in non-Jetson environment)")

    def _read_temperature(self) -> float:
        """Read temperature from Jetson thermal zone sysfs."""
        try:
            with open(self._thermal_zone) as f:
                millidegrees = int(f.read().strip())
            return millidegrees / 1000.0
        except (OSError, ValueError):
            # Fall back to scanning multiple zones
            return self._read_max_thermal_zone()

    def _read_max_thermal_zone(self) -> float:
        """Read maximum temperature across all available thermal zones."""
        max_temp = 0.0
        for zone in range(10):
            path = f"/sys/class/thermal/thermal_zone{zone}/temp"
            try:
                with open(path) as f:
                    millidegrees = int(f.read().strip())
                temp = millidegrees / 1000.0
                max_temp = max(max_temp, temp)
            except (OSError, ValueError):
                break
        return max_temp

    def _read_power(self) -> float:
        """Read power consumption from INA3221 power monitor."""
        total_power = 0.0
        try:
            # Jetson power rail: look for in_power* sysfs attributes
            for rail in range(3):
                path = os.path.join(
                    self._ina3221_path,
                    f"0-0040/iio:device0/in_power{rail}_input",
                )
                try:
                    with open(path) as f:
                        milliwatts = float(f.read().strip())
                    total_power += milliwatts / 1000.0
                except (OSError, ValueError):
                    pass
        except Exception:
            pass
        return total_power

    def _read_cpu_freq(self) -> int:
        try:
            with open("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq") as f:
                khz = int(f.read().strip())
            return khz // 1000
        except (OSError, ValueError):
            return 0

    def _read_gpu_freq(self) -> int:
        try:
            with open("/sys/kernel/debug/clk/gpc_clk/clk_rate") as f:
                hz = int(f.read().strip())
            return hz // 1_000_000
        except (OSError, ValueError):
            return 0

    def _classify_thermal(self, temp: float) -> ThermalState:
        if temp >= self._critical_temp:
            return ThermalState.CRITICAL
        if temp >= self._throttle_temp:
            return ThermalState.THROTTLED
        if temp >= self._warning_temp:
            return ThermalState.WARNING
        return ThermalState.NORMAL

    def _classify_power(self, watts: float) -> PowerState:
        if watts >= self._max_watts:
            return PowerState.THROTTLED
        if watts >= self._warning_watts:
            return PowerState.WARNING
        return PowerState.NORMAL
