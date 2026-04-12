"""
Vendor verification: checks current availability and product URL reachability.

In a network-enabled environment this will perform live HTTP checks.
In a sandboxed/offline environment it logs the inability to verify and
returns the pre-researched status from the database.
"""
import urllib.request
import urllib.error
from datetime import date
from typing import Optional
from data_models import TactileLock, Vendor


def _http_status(url: str, timeout: int = 10) -> Optional[int]:
    """Return HTTP status code for a URL, or None on error."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0 (puzzle-research-bot/1.0)")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None


def verify_availability(lock: TactileLock) -> dict:
    """
    Checks vendor base URL and product URL (if present) for HTTP 200.
    Returns a verification result dict.
    """
    result = {
        "product_name": lock.product_name,
        "vendor_url": lock.vendor.url,
        "vendor_reachable": False,
        "vendor_status_code": None,
        "product_url": lock.product_url or None,
        "product_reachable": None,
        "product_status_code": None,
        "verified_date": date.today().isoformat(),
        "network_available": False,
    }

    vendor_code = _http_status(lock.vendor.url)
    if vendor_code is not None:
        result["network_available"] = True
        result["vendor_status_code"] = vendor_code
        result["vendor_reachable"] = vendor_code == 200

        if lock.product_url:
            prod_code = _http_status(lock.product_url)
            result["product_status_code"] = prod_code
            result["product_reachable"] = prod_code == 200
    else:
        result["notes"] = (
            "Network unavailable in this environment; "
            "status based on pre-research data. "
            "Run verify_availability() with network access to confirm."
        )

    return result


def contact_vendor(vendor: Vendor, product_name: str) -> dict:
    """
    Stub for vendor contact workflow.  In a live environment this would
    trigger an email or form submission to confirm availability.
    Returns a contact record for audit trail purposes.
    """
    return {
        "vendor": vendor.name,
        "product": product_name,
        "contact_method": "email",
        "contact_address": vendor.contact,
        "contacted_date": date.today().isoformat(),
        "status": "pending_response",
        "notes": (
            "Manual follow-up required. "
            "Send inquiry to confirm current in-stock status."
        ),
    }


def update_status(lock: TactileLock, new_status: str) -> TactileLock:
    """Return a copy of the lock record with updated availability status."""
    valid = ("in_stock", "backorder", "discontinued")
    if new_status not in valid:
        raise ValueError(f"status must be one of {valid}")
    lock.availability_status = new_status
    lock.verification_date = date.today().isoformat()
    return lock


def batch_verify(locks: list[TactileLock]) -> list[dict]:
    """Run verify_availability for every lock and return summary list."""
    return [verify_availability(lock) for lock in locks]
