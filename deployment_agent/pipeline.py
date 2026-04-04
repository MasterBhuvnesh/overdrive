import asyncio
import os
import shutil
import tempfile
import time
from typing import Any, Dict, Optional, List
import docker

import httpx

from .analyzer import analyze_repo
from .cloner import clone_repo
from .docker_runner import run_docker_compose
from .github_fetcher import fetch_repo_via_api
from .llm_agent import LLMAgent


def make_log(job: Dict):
    def log(message: str, log_type: str = "info"):
        job["logs"].append({
            "message": message,
            "type": log_type,
            "timestamp": time.time(),
        })
    return log


async def _fetch_analysis(
    github_url: str,
    github_token: Optional[str],
    log,
) -> Dict[str, Any]:
    """
    Try GitHub API first (fast, no disk I/O).
    Fall back to a shallow git clone only if the API call fails
    (e.g. private repo without token, or network issue).
    """
    try:
        log("🌐 Fetching repo via GitHub API (no clone needed)...", "step")
        analysis = await fetch_repo_via_api(github_url, github_token)

        extra = " ⚠️ Tree was truncated by GitHub (very large repo)." if analysis.get("_truncated") else ""
        log(
            f"📁 {analysis['file_count']} files | "
            f"{analysis['dir_count']} dirs | "
            f"Branch: {analysis['_branch']} | "
            f"Hints: {', '.join(analysis['framework_hints']) or 'none'}"
            f"{extra}",
            "info",
        )
        log("✅ Repo fetched via API", "success")
        return analysis

    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 404:
            log("⚠️  Repo not found via API (private?). Falling back to git clone...", "warn")
        elif status == 403:
            log("⚠️  GitHub API rate-limited. Falling back to git clone...", "warn")
        else:
            log(f"⚠️  GitHub API returned {status}. Falling back to git clone...", "warn")
        return await _clone_and_analyze(github_url, log)

    except Exception as e:
        log(f"⚠️  API fetch failed ({e}). Falling back to git clone...", "warn")
        return await _clone_and_analyze(github_url, log)


async def _clone_and_analyze(github_url: str, log) -> Dict[str, Any]:
    """Shallow-clone the repo into a temp dir and run local analysis."""
    log(f"🔄 Cloning repository: {github_url}", "step")
    tmpdir = tempfile.mkdtemp(prefix="overdrive_")
    repo_dir = os.path.join(tmpdir, "repo")

    try:
        success, msg = await asyncio.to_thread(clone_repo, github_url, repo_dir)
        if not success:
            raise RuntimeError(f"Clone failed: {msg}")
        log("✅ Repository cloned successfully", "success")

        log("🔍 Analyzing local repository structure...", "step")
        analysis = await asyncio.to_thread(analyze_repo, repo_dir)
        analysis["_source"] = "git_clone"
        log(
            f"📁 Found {analysis['file_count']} files | "
            f"{analysis['dir_count']} directories | "
            f"Hints: {', '.join(analysis['framework_hints']) or 'none'}",
            "info",
        )
        return analysis
    finally:
        # Always clean up clone
        shutil.rmtree(tmpdir, ignore_errors=True)


async def run_pipeline(
    job_id: str,
    github_url: str,
    api_key: str,
    jobs: Dict,
    base_url: Optional[str] = None,
    github_token: Optional[str] = None,
    env_vars: Optional[Dict[str, str]] = None,
):
    job = jobs[job_id]
    log = make_log(job)
    docker_output: list = []  # captured docker compose lines (populated in Step 7)

    try:
        job["status"] = "running"
        
        # 🩺 Pre-flight Check: Is Docker running?
        log("🩺 Checking environment health...", "step")
        try:
            docker_client = docker.from_env()
            docker_client.ping()
            log("✅ Docker daemon is healthy", "success")
        except Exception:
            raise RuntimeError(
                "Docker Desktop is not running or unreachable. "
                "Please start Docker Desktop to enable deployments."
            )

        # ── Step 1 & 2: Fetch + Analyze (API preferred) ────────────────
        github_token = github_token or os.getenv("GITHUB_TOKEN")
        analysis = await _fetch_analysis(github_url, github_token, log)

        # ── Step 3-6: LLM ──────────────────────────────────────────────
        agent = LLMAgent(api_key=api_key, base_url=base_url)

        log("🤖 Detecting tech stack with AI...", "step")
        stack = await agent.detect_stack(analysis)
        log(f"✅ Stack identified: {stack.get('summary', 'Unknown')}", "success")

        log("🐳 Generating Dockerfile(s)...", "step")
        dockerfiles = await agent.generate_dockerfile(analysis, stack)
        log(f"✅ Generated {len(dockerfiles)} Dockerfile(s): {', '.join(dockerfiles.keys())}", "success")

        log("📦 Generating docker-compose.yml...", "step")
        compose = await agent.generate_compose(analysis, stack, dockerfiles)
        log("✅ docker-compose.yml generated", "success")

        log("🔎 Analyzing for errors & improvements...", "step")
        error_fix = await agent.analyze_errors(analysis, stack)
        log("✅ Error analysis complete", "success")

        # ── Step 7: Run docker compose ───────────────────────────────────
        log("📦 Writing files & running docker compose up...", "step")
        docker_success, docker_output = await run_docker_compose(
            job_id=job_id,
            dockerfiles=dockerfiles,
            compose_yaml=compose,
            log=log,
            env_vars=env_vars,
        )

        if docker_success:
            log("🎉 docker compose ran successfully!", "success")
        else:
            log("❌ docker compose failed — error.md will be generated.", "error")

        job["results"] = {
            "dockerfiles": dockerfiles,
            "docker_compose": compose,
            "error_fix": error_fix,
            "tech_stack": stack,
            "docker_output": docker_output,
            "docker_success": docker_success,
            "meta": {
                "file_count": analysis["file_count"],
                "dir_count": analysis["dir_count"],
                "languages": analysis.get("detected_languages", []),
                "github_url": github_url,
                "fetch_source": analysis.get("_source", "unknown"),
            },
        }

        if docker_success:
            job["status"] = "done"
            log("🎉 All done! Dockerfile, compose, and deployment are ready.", "done")
        else:
            job["status"] = "error"
            job["error"] = "docker compose exited with a non-zero code. See error.md for details."

    except Exception as e:
        log(f"❌ Error: {str(e)}", "error")
        job["status"] = "error"
        job["error"] = str(e)

    finally:
        # ── Auto-analyze logs + docker output → write error.md if needed ─────
        try:
            from .log_analyzer import analyze_logs
            import os as _os

            reports_dir = _os.path.join(
                _os.path.dirname(_os.path.dirname(__file__)), "reports"
            )
            report = await analyze_logs(
                job=job,
                api_key=api_key,
                base_url=base_url,
                output_dir=reports_dir,
                job_id=job_id,
                docker_output=docker_output or None,
            )
            if report:
                # Store report text in results so frontend can render it
                if job.get("results") is not None:
                    job["results"]["error_report"] = report
                log("📄 error.md saved → reports/error.md", "info")
        except Exception as report_err:
            # Never let report generation crash the pipeline response
            log(f"⚠️  Log analyzer failed: {report_err}", "warn")
