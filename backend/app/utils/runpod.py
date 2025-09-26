"""Utilities for building RunPod endpoint URLs."""
from __future__ import annotations

from typing import Final

_BASE_PREFIX: Final[str] = "https://api.runpod.ai/v2/"


def _normalize_endpoint(raw_endpoint: str) -> str:
    if not raw_endpoint:
        raise ValueError("RunPod endpoint is missing")

    endpoint = raw_endpoint.strip()
    if not endpoint:
        raise ValueError("RunPod endpoint is empty")

    endpoint = endpoint.rstrip("/")

    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint

    return f"{_BASE_PREFIX}{endpoint.lstrip('/')}"


def build_run_url(raw_endpoint: str) -> str:
    base = _normalize_endpoint(raw_endpoint)
    if base.endswith("/run"):
        return base
    return f"{base}/run"


def build_status_url(raw_endpoint: str, job_id: str) -> str:
    base = _normalize_endpoint(raw_endpoint)
    if base.endswith("/run"):
        base = base[:-len("/run")]
    return f"{base}/status/{job_id}"


def build_cancel_url(raw_endpoint: str, job_id: str) -> str:
    base = _normalize_endpoint(raw_endpoint)
    if base.endswith("/run"):
        base = base[:-len("/run")]
    return f"{base}/cancel/{job_id}"


def build_health_url(raw_endpoint: str) -> str:
    base = _normalize_endpoint(raw_endpoint)
    if base.endswith("/run"):
        base = base[:-len("/run")]
    return base
