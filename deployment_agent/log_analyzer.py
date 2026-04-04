"""
log_analyzer.py
────────────────────────────────────────────────────────────────────────────
Reads the in-memory job logs produced by pipeline.py, detects failures /
warnings, and writes a structured Markdown incident report via the LLM.

Public surface
──────────────
  analyze_logs(job, api_key, output_dir, job_id, docker_output) -> str | None
      Inspects `job["logs"]` + docker compose output for error/warn entries.
      Returns the markdown text (and saves it as error.md)
      or None if the deployment had no errors.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional

import os
from openai import AsyncOpenAI

LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "local-model")

# Log entry types that count as "something went wrong"
ERROR_TYPES = {"error", "warn", "warning"}


# ── helpers ──────────────────────────────────────────────────────────────────

def _extract_problem_entries(logs: List[Dict]) -> List[Dict]:
    """Return only the log entries that indicate a problem."""
    return [e for e in logs if e.get("type", "").lower() in ERROR_TYPES]


def _format_log_table(logs: List[Dict]) -> str:
    """Format all log entries into a readable plain-text block."""
    lines: List[str] = []
    for entry in logs:
        ts = time.strftime(
            "%H:%M:%S", time.localtime(entry.get("timestamp", 0))
        )
        tag = entry.get("type", "info").upper().ljust(7)
        msg = entry.get("message", "")
        lines.append(f"[{ts}] [{tag}] {msg}")
    return "\n".join(lines)


def _has_errors(job: Dict) -> bool:
    """Return True if the job finished with status 'error' OR has error/warn logs."""
    if job.get("status") == "error":
        return True
    return any(
        e.get("type", "").lower() in ERROR_TYPES for e in job.get("logs", [])
    )


# ── LLM-powered report generation ────────────────────────────────────────────

async def _generate_report(
    api_key: str,
    full_log: str,
    problem_entries: List[Dict],
    job_meta: Dict,
    docker_output: Optional[List[str]] = None,
    base_url: Optional[str] = None,
) -> str:
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    system = (
        "You are a senior DevOps engineer and incident analyst. "
        "Your job is to read deployment logs, identify root causes, "
        "and write clear, actionable Markdown incident reports. "
        "Use precise technical language. Always suggest concrete fixes."
    )

    problem_block = "\n".join(
        f"- [{e.get('type','?').upper()}] {e.get('message','')}"
        for e in problem_entries
    )

    github_url = job_meta.get("github_url", "unknown")
    status = job_meta.get("status", "unknown")
    job_id = job_meta.get("job_id", "unknown")

    docker_section = ""
    if docker_output:
        docker_section = (
            "\n## Docker Compose Output\n"
            "```\n"
            + "\n".join(docker_output[-200:])  # last 200 lines to stay within token limit
            + "\n```\n"
        )

    user = f"""A deployment pipeline has finished with status: **{status}**.

## Job Details
- **Job ID**: {job_id}
- **Repository**: {github_url}
- **Final Status**: {status}

## Detected Problems
{problem_block if problem_block else "No explicit error entries, but the pipeline did not complete successfully."}

## Pipeline Log
```
{full_log}
```
{docker_section}
Write a comprehensive Markdown incident report using EXACTLY this structure:

# 🚨 Deployment Error Report

## 📋 Incident Summary
(One paragraph: what happened, when, severity level)

## 🔍 Root Cause Analysis
(For each error/warning: what it means, why it happened — include docker errors if present)

## 💥 Affected Steps
(Table: Step | Status | Error Message)

## 🛠️ Fix Instructions
(Numbered list of exact steps to resolve each issue — be specific)

## ⚠️ Warnings to Address
(Non-fatal warnings that need attention)

## 🔁 How to Retry
(Step-by-step: fix the issues above, then re-run)

## ✅ Pre-flight Checklist
- [ ] (things to verify before next deployment attempt)

Be specific. Reference exact error messages from the logs.
"""

    response = await client.chat.completions.create(
        model=LM_STUDIO_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=0.2,
        max_tokens=4096,
    )
    return response.choices[0].message.content or ""


# ── public API ────────────────────────────────────────────────────────────────

async def analyze_logs(
    job: Dict[str, Any],
    api_key: str,
    output_dir: str = ".",
    job_id: str = "unknown",
    docker_output: Optional[List[str]] = None,
    base_url: Optional[str] = None,
) -> Optional[str]:
    """
    Analyze job logs (+ optional docker output) for errors and produce
    a Markdown 'error.md' report.

    Parameters
    ----------
    job           : the job dict from jobs[job_id]
    api_key       : Groq API key
    output_dir    : directory where error.md will be written
    job_id        : job identifier (used in report metadata)
    docker_output : raw lines captured from docker compose (optional)

    Returns
    -------
    Markdown string of the report, or None if the job was clean.
    """
    logs: List[Dict] = job.get("logs", [])

    # Also treat a docker failure as an error even if pipeline logs are clean
    docker_failed = (
        docker_output is not None
        and any(
            kw in line.lower()
            for line in docker_output
            for kw in ("error", "failed", "exit code", "exited with")
        )
    )

    if not _has_errors(job) and not docker_failed:
        return None  # Completely clean run — nothing to report

    problem_entries = _extract_problem_entries(logs)
    full_log = _format_log_table(logs)

    job_meta = {
        "job_id": job_id,
        "github_url": (
            job.get("results", {}).get("meta", {}).get("github_url", "unknown")
            if job.get("results")
            else job.get("github_url", "unknown")
        ),
        "status": job.get("status", "unknown"),
    }

    report_md = await _generate_report(
        api_key, full_log, problem_entries, job_meta, docker_output, base_url
    )

    # ── persist to disk as error.md ──────────────────────────────────────────
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, "error.md")

    with open(filepath, "w", encoding="utf-8") as fh:
        fh.write(report_md)

    return report_md
