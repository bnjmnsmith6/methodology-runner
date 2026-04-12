"""
Data models and schema validation for tactile alignment lock database.
"""
from dataclasses import dataclass, field
from typing import Literal, Optional
from datetime import date, datetime
import json


@dataclass
class Vendor:
    name: str
    url: str
    contact: str
    verified_date: str  # ISO date string

    def to_dict(self):
        return {
            "name": self.name,
            "url": self.url,
            "contact": self.contact,
            "verified_date": self.verified_date,
        }


@dataclass
class TactileLock:
    product_name: str
    vendor: Vendor
    mechanism_type: str  # always "tactile_alignment"
    piece_count: int
    difficulty_rating: int  # 1-10
    hand_precision_required: bool
    puzzle_classification: Literal["puzzle", "security", "hybrid"]
    availability_status: Literal["in_stock", "backorder", "discontinued"]
    tactile_description: str
    verification_date: str  # ISO date string
    classification_reasoning: str = ""
    difficulty_justification: str = ""
    product_url: str = ""
    notes: str = ""

    def validate(self) -> list[str]:
        errors = []
        if not self.product_name:
            errors.append("product_name is required")
        if self.mechanism_type != "tactile_alignment":
            errors.append("mechanism_type must be 'tactile_alignment'")
        if self.piece_count < 2:
            errors.append("piece_count must be >= 2")
        if not (1 <= self.difficulty_rating <= 10):
            errors.append("difficulty_rating must be 1-10")
        if self.puzzle_classification not in ("puzzle", "security", "hybrid"):
            errors.append("invalid puzzle_classification")
        if self.availability_status not in ("in_stock", "backorder", "discontinued"):
            errors.append("invalid availability_status")
        if not self.tactile_description:
            errors.append("tactile_description is required")
        if not self.vendor.url:
            errors.append("vendor URL is required")
        return errors

    def to_dict(self):
        return {
            "product_name": self.product_name,
            "vendor": self.vendor.to_dict(),
            "mechanism_type": self.mechanism_type,
            "piece_count": self.piece_count,
            "difficulty_rating": self.difficulty_rating,
            "hand_precision_required": self.hand_precision_required,
            "puzzle_classification": self.puzzle_classification,
            "availability_status": self.availability_status,
            "tactile_description": self.tactile_description,
            "verification_date": self.verification_date,
            "classification_reasoning": self.classification_reasoning,
            "difficulty_justification": self.difficulty_justification,
            "product_url": self.product_url,
            "notes": self.notes,
        }


class LockDatabase:
    def __init__(self):
        self.records: list[TactileLock] = []

    def add(self, lock: TactileLock) -> list[str]:
        errors = lock.validate()
        if errors:
            return errors
        # enforce uniqueness
        existing_names = {r.product_name for r in self.records}
        if lock.product_name in existing_names:
            return [f"Duplicate product_name: {lock.product_name}"]
        self.records.append(lock)
        return []

    def to_json(self) -> str:
        return json.dumps(
            {
                "generated_date": date.today().isoformat(),
                "total_records": len(self.records),
                "records": [r.to_dict() for r in self.records],
            },
            indent=2,
        )

    def validate_all(self) -> dict:
        issues = {}
        for rec in self.records:
            errs = rec.validate()
            if errs:
                issues[rec.product_name] = errs
        return issues
