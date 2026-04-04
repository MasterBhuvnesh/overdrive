#!/usr/bin/env python3
"""
generate_compose.py — Standalone CLI to generate a docker-compose.yml for any GitHub repo.

Uses the GitHub API by default (no cloning), with automatic fallback to git clone.

Usage:
    python generate_compose.py <github_url> <api_key> [options]

Options:
    --output PATH          Output file (default: docker-compose.generated.yml)
    --github-token TOKEN   GitHub token for private repos / higher rate limits
                           (or set GITHUB_TOKEN env var)
    --force-clone          Skip API and always git-clone the repo
    --base-url URL         Base URL for local LLM (default: http://localhost:1234/v1)

Example:
    python generate_compose.py https://github.com/user/repo lm-studio
    python generate_compose.py https://github.com/user/repo lm-studio --github-token ghp_XXX
"""

import argparse
import asyncio
import os
import shutil
import sys
import tempfile

# ── Make agent package importable when run from backend/ ─────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import httpx

from agent.cloner import clone_repo
from agent.analyzer import analyze_repo
from agent.github_fetcher import fetch_repo_via_api
from agent.llm_agent import LLMAgent


# ── UI helpers ────────────────────────────────────────────────────────────────

def banner():
    print("\n" + "═" * 62)
    print("  🐳  Overdrive — Docker Compose Generator")
    print("═" * 62 + "\n")


def step(msg: str):
    print(f"  ▶  {msg}")


def ok(msg: str):
    print(f"  ✅  {msg}")


def warn(msg: str):
    print(f"  ⚠️   {msg}")


def err(msg: str):
    print(f"  ❌  {msg}", file=sys.stderr)


# ── Fetch strategy ────────────────────────────────────────────────────────────

async def _fetch_via_api(github_url: str, github_token: str | None):
    step("Fetching repo via GitHub API (no clone needed)...")
    analysis = await fetch_repo_via_api(github_url, github_token)
    extra = " ⚠️ Tree truncated (very large repo)." if analysis.get("_truncated") else ""
    ok(
        f"{analysis['file_count']} files | "
        f"{analysis['dir_count']} dirs | "
        f"Branch: {analysis['_branch']} | "
        f"Hints: {', '.join(analysis['framework_hints']) or 'none'}"
        + extra
    )
    return analysis


async def _fetch_via_clone(github_url: str):
    step(f"Cloning {github_url} (shallow) ...")
    tmpdir = tempfile.mkdtemp(prefix="overdrive_")
    repo_dir = os.path.join(tmpdir, "repo")
    try:
        success, msg = clone_repo(github_url, repo_dir)
        if not success:
            err(f"Clone failed: {msg}")
            sys.exit(1)
        ok("Repository cloned.")

        step("Analyzing local repository structure...")
        analysis = analyze_repo(repo_dir)
        analysis["_source"] = "git_clone"
        ok(
            f"Found {analysis['file_count']} files, "
            f"{analysis['dir_count']} dirs. "
            f"Hints: {', '.join(analysis['framework_hints']) or 'none'}"
        )
        return analysis
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


async def get_analysis(github_url: str, github_token: str | None, force_clone: bool):
    if force_clone:
        return await _fetch_via_clone(github_url)
    try:
        return await _fetch_via_api(github_url, github_token)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 404:
            warn("Repo not found via API (private?). Falling back to git clone...")
        elif status == 403:
            warn("GitHub API rate-limited. Falling back to git clone...")
        else:
            warn(f"GitHub API returned {status}. Falling back to git clone...")
        return await _fetch_via_clone(github_url)
    except Exception as e:
        warn(f"API fetch failed ({e}). Falling back to git clone...")
        return await _fetch_via_clone(github_url)


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def generate(
    github_url: str,
    api_key: str,
    base_url: str,
    output_path: str,
    github_token: str | None,
    force_clone: bool,
):
    # Step 1+2: Fetch / Analyze
    analysis = await get_analysis(github_url, github_token, force_clone)

    agent = LLMAgent(api_key=api_key, base_url=base_url)

    # Step 3: Detect stack
    step("Detecting tech stack with LM Studio AI...")
    stack = await agent.detect_stack(analysis)
    ok(f"Stack: {stack.get('summary', 'Unknown')}")

    # Step 4: Generate Dockerfiles
    step("Generating Dockerfile(s)...")
    dockerfiles = await agent.generate_dockerfile(analysis, stack)
    ok(f"Dockerfiles generated for: {', '.join(dockerfiles.keys())}")

    # Step 5: Generate docker-compose.yml
    step("Generating docker-compose.yml...")
    compose_content = await agent.generate_compose(analysis, stack, dockerfiles)
    ok("docker-compose.yml generated.")

    # Write output
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(compose_content)

    print("\n" + "═" * 62)
    print(f"  🎉  Saved → {os.path.abspath(output_path)}")
    print("      Fetch method:", analysis.get("_source", "unknown"))
    print("═" * 62 + "\n")
    print(compose_content)


def main():
    banner()

    parser = argparse.ArgumentParser(
        description="Generate a docker-compose.yml for any GitHub repo using LM Studio AI.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("github_url", help="GitHub repository URL (HTTPS or SSH)")
    parser.add_argument("api_key", help="API key (default 'lm-studio')", default="lm-studio", nargs="?")
    parser.add_argument("--base-url", default=os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1"), help="Base URL for LM Studio")
    parser.add_argument(
        "--output",
        default="docker-compose.generated.yml",
        help="Output file path (default: docker-compose.generated.yml)",
    )
    parser.add_argument(
        "--github-token",
        default=os.getenv("GITHUB_TOKEN"),
        help="GitHub personal access token (also reads $GITHUB_TOKEN env var)",
    )
    parser.add_argument(
        "--force-clone",
        action="store_true",
        help="Skip the GitHub API and always git-clone the repo",
    )
    args = parser.parse_args()

    asyncio.run(
        generate(
            args.github_url,
            args.api_key,
            args.base_url,
            args.output,
            args.github_token,
            args.force_clone,
        )
    )


if __name__ == "__main__":
    main()
