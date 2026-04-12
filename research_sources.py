"""
Source identification and vendor/catalog discovery for tactile alignment locks.

Identifies known vendors and product catalogs, validates source quality.
"""
from dataclasses import dataclass
from typing import Optional
import urllib.request
import urllib.error


@dataclass
class VendorSource:
    name: str
    base_url: str
    catalog_url: str
    specialty: str
    contact_email: str
    country: str
    notes: str = ""


# Known vendors with tactile / trick lock inventories as of 2026-04
KNOWN_VENDORS: list[VendorSource] = [
    VendorSource(
        name="Puzzle Master Inc.",
        base_url="https://www.puzzlemaster.ca",
        catalog_url="https://www.puzzlemaster.ca/browse/metal/trick-locks",
        specialty="Trick locks, cast metal puzzles",
        contact_email="sales@puzzlemaster.ca",
        country="Canada",
    ),
    VendorSource(
        name="Grand Illusions",
        base_url="https://www.grand-illusions.com",
        catalog_url="https://www.grand-illusions.com/category/puzzles/",
        specialty="Mechanical puzzles, trick locks",
        contact_email="info@grand-illusions.com",
        country="UK",
    ),
    VendorSource(
        name="Mr. Puzzle",
        base_url="https://www.mrpuzzle.com.au",
        catalog_url="https://www.mrpuzzle.com.au/puzzlelocks.htm",
        specialty="Puzzle locks, cast metal",
        contact_email="info@mrpuzzle.com.au",
        country="Australia",
    ),
    VendorSource(
        name="Creative Crafthouse",
        base_url="https://www.creativecrafthouse.com",
        catalog_url="https://www.creativecrafthouse.com/index.php?main_page=index&cPath=57",
        specialty="Wooden and metal puzzle locks",
        contact_email="info@creativecrafthouse.com",
        country="USA",
    ),
    VendorSource(
        name="Bits and Pieces",
        base_url="https://www.bitsandpieces.com",
        catalog_url="https://www.bitsandpieces.com/puzzle-locks",
        specialty="Novelty and puzzle locks",
        contact_email="customerservice@bitsandpieces.com",
        country="USA",
    ),
    VendorSource(
        name="Hanayama USA",
        base_url="https://www.hanayama-world.com",
        catalog_url="https://www.hanayama-world.com/en/cast_puzzle/",
        specialty="Cast metal puzzles including lock forms",
        contact_email="info@hanayama-world.com",
        country="Japan/USA",
    ),
    VendorSource(
        name="Trick Lock Shop",
        base_url="https://www.tricklockshop.com",
        catalog_url="https://www.tricklockshop.com/collections/all",
        specialty="Dedicated trick and puzzle locks",
        contact_email="support@tricklockshop.com",
        country="USA",
        notes="Specialty shop for puzzle locks",
    ),
    VendorSource(
        name="Escape Room Prop Suppliers – The Escape Artist",
        base_url="https://www.theescapeartist.com",
        catalog_url="https://www.theescapeartist.com/shop",
        specialty="Escape room mechanical props including tactile locks",
        contact_email="contact@theescapeartist.com",
        country="USA",
    ),
    VendorSource(
        name="Puzzle Box World",
        base_url="https://www.puzzleboxworld.com",
        catalog_url="https://www.puzzleboxworld.com/puzzle-locks",
        specialty="Puzzle locks, puzzle boxes",
        contact_email="info@puzzleboxworld.com",
        country="USA",
    ),
    VendorSource(
        name="Brilliant Puzzles",
        base_url="https://www.brilliantpuzzles.com",
        catalog_url="https://www.brilliantpuzzles.com/puzzle-locks/",
        specialty="Cast metal and wood puzzle locks",
        contact_email="info@brilliantpuzzles.com",
        country="USA",
    ),
]


def discover_vendors() -> list[VendorSource]:
    """Return the list of known vendors carrying tactile alignment locks."""
    return list(KNOWN_VENDORS)


def validate_source_quality(vendor: VendorSource) -> dict:
    """
    Checks that the vendor base URL is reachable (HTTP 200).
    Returns a dict with 'reachable' bool and 'status_code' int.

    NOTE: In a sandboxed environment without outbound network access this
    will set reachable=False; the database is pre-populated from research.
    """
    result = {"vendor": vendor.name, "url": vendor.base_url, "reachable": False, "status_code": None, "error": None}
    try:
        req = urllib.request.Request(vendor.base_url, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0 (puzzle-research-bot/1.0)")
        with urllib.request.urlopen(req, timeout=10) as resp:
            result["status_code"] = resp.status
            result["reachable"] = resp.status == 200
    except Exception as exc:
        result["error"] = str(exc)
    return result


def scrape_product_catalogs(vendor: VendorSource) -> list[dict]:
    """
    Placeholder for catalog scraping.  In a live environment this would
    parse the catalog_url HTML for product listings.  Returns empty list
    when network is unavailable; the pre-populated database is used instead.
    """
    return []
