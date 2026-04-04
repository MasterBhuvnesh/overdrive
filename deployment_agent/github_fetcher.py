"""
github_fetcher.py — Fetches a GitHub repo's structure and key files via the
GitHub REST API, without cloning anything to disk.

Produces the exact same dict shape as analyzer.analyze_repo() so the rest of
the pipeline works unchanged.

Rate limits:
  • Unauthenticated : 60  req / hr
  • With token      : 5000 req / hr   (set GITHUB_TOKEN env var)
"""

import base64
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

# ── Constants ─────────────────────────────────────────────────────────────────

GITHUB_API = "https://api.github.com"
MAX_FILE_BYTES = 40_000        # 40 KB per key file
MAX_TREE_ENTRIES = 5_000       # cap tree traversal

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".next", ".nuxt",
    "dist", "build", "target", "vendor", ".venv", "venv",
    "env", ".env", "coverage", ".nyc_output", ".cache",
    "tmp", "temp", ".pytest_cache", "migrations", ".turbo",
}

KEY_FILES = {
    "package.json", "requirements.txt", "setup.py", "pyproject.toml",
    "Pipfile", "go.mod", "Cargo.toml", "pom.xml", "build.gradle",
    "Gemfile", "composer.json", "Dockerfile", "docker-compose.yml",
    "docker-compose.yaml", ".env.example", ".env.sample",
    "nginx.conf", "Makefile", "README.md",
    "next.config.js", "next.config.ts", "vite.config.js", "vite.config.ts",
    "tsconfig.json", "main.py", "app.py", "server.py",
    "index.js", "index.ts", "manage.py", "settings.py",
}

LANGUAGE_EXT_MAP = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
    ".jsx": "React (JSX)", ".tsx": "React (TSX)", ".go": "Go",
    ".rs": "Rust", ".java": "Java", ".rb": "Ruby", ".php": "PHP",
    ".cs": "C#", ".cpp": "C++", ".vue": "Vue", ".svelte": "Svelte",
    ".dart": "Dart", ".kt": "Kotlin", ".swift": "Swift",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_github_url(url: str) -> Tuple[str, str]:
    """Return (owner, repo) from any GitHub URL form."""
    url = url.strip().rstrip("/").removesuffix(".git")
    url = re.sub(r"^git@github\.com:", "https://github.com/", url)
    m = re.search(r"github\.com[:/]([^/]+)/([^/]+)", url)
    if not m:
        raise ValueError(f"Cannot parse GitHub URL: {url}")
    return m.group(1), m.group(2)


def _headers(github_token: Optional[str] = None) -> Dict[str, str]:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = github_token or os.getenv("GITHUB_TOKEN")
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _decode_content(blob: Dict) -> str:
    """Decode base64 file content from GitHub contents API."""
    try:
        raw = base64.b64decode(blob["content"]).decode("utf-8", errors="ignore")
        if len(raw) > MAX_FILE_BYTES:
            raw = raw[:MAX_FILE_BYTES] + "\n... [truncated]"
        return raw
    except Exception:
        return "[Could not decode content]"


# ── File-tree rendering ───────────────────────────────────────────────────────

def _render_tree(entries: List[Dict]) -> str:
    """
    Convert the flat list from the Git Trees API into a pretty ASCII tree,
    skipping noise directories up to depth 5.
    """
    # Build a set of paths to skip (subtrees of SKIP_DIRS)
    skip_prefixes = tuple(f"{d}/" for d in SKIP_DIRS)

    # Filter entries
    filtered = []
    for e in entries:
        path: str = e["path"]
        parts = path.split("/")
        # skip if any top-level segment is in SKIP_DIRS
        if any(p in SKIP_DIRS for p in parts):
            continue
        if len(parts) > 5:   # depth limit
            continue
        filtered.append(e)

    # Group by directory
    def _tree_lines(prefix_path: str, indent: str) -> List[str]:
        children = [
            e for e in filtered
            if (
                e["path"].startswith(prefix_path) if prefix_path else True
            ) and (
                e["path"][len(prefix_path):].count("/") == 0
                if prefix_path
                else e["path"].count("/") == 0
            )
        ]
        lines = []
        for i, entry in enumerate(children):
            is_last = i == len(children) - 1
            connector = "└── " if is_last else "├── "
            name = entry["path"][len(prefix_path):]
            icon = "📁 " if entry["type"] == "tree" else ""
            lines.append(f"{indent}{connector}{icon}{name}")
            if entry["type"] == "tree":
                ext = "    " if is_last else "│   "
                subtree = _tree_lines(entry["path"] + "/", indent + ext)
                lines.extend(subtree)
        return lines

    return "\n".join(_tree_lines("", ""))


# ── Framework hints (mirrors analyzer.py logic) ───────────────────────────────

def _detect_hints(key_files: Dict[str, str]) -> List[str]:
    hints: List[str] = []

    pkg_content = next((v for k, v in key_files.items() if k.endswith("package.json")), None)
    if pkg_content:
        try:
            pkg = json.loads(pkg_content)
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if "next" in deps:       hints.append("Next.js")
            elif "react" in deps:    hints.append("React")
            if "vue" in deps:        hints.append("Vue.js")
            if "svelte" in deps:     hints.append("Svelte")
            if "express" in deps:    hints.append("Express.js")
            if "@nestjs/core" in deps: hints.append("NestJS")
            if "vite" in deps:       hints.append("Vite")
            if "typescript" in deps or "ts-node" in deps: hints.append("TypeScript")
            if "mongoose" in deps or "mongodb" in deps:   hints.append("MongoDB")
            if "pg" in deps or "postgres" in deps:        hints.append("PostgreSQL")
            if "mysql2" in deps:     hints.append("MySQL")
            if "redis" in deps or "ioredis" in deps:      hints.append("Redis")
            if "prisma" in deps or "@prisma/client" in deps: hints.append("Prisma")
        except Exception:
            pass

    reqs_content = next((v for k, v in key_files.items() if k.endswith("requirements.txt")), None)
    if reqs_content:
        reqs = reqs_content.lower()
        for fw, name in [
            ("django", "Django"), ("flask", "Flask"), ("fastapi", "FastAPI"),
            ("sqlalchemy", "SQLAlchemy"), ("celery", "Celery"),
            ("psycopg", "PostgreSQL"), ("pymongo", "MongoDB"), ("redis", "Redis"),
        ]:
            if fw in reqs:
                hints.append(name)

    return list(set(hints))


# ── Main public function ──────────────────────────────────────────────────────

async def fetch_repo_via_api(
    github_url: str,
    github_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch everything needed for the pipeline from the GitHub API.
    Returns the same dict shape as analyzer.analyze_repo().

    Raises httpx.HTTPStatusError on API errors (e.g. 404, 403 rate-limit).
    """
    owner, repo = _parse_github_url(github_url)
    headers = _headers(github_token)

    async with httpx.AsyncClient(headers=headers, timeout=30) as client:

        # ── 1. Repo metadata + default branch ────────────────────────────────
        r = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}")
        r.raise_for_status()
        repo_meta = r.json()
        default_branch = repo_meta.get("default_branch", "main")

        # ── 2. Full recursive file tree via Git Trees API ─────────────────────
        r = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}",
            params={"recursive": "1"},
        )
        r.raise_for_status()
        tree_data = r.json()
        all_entries: List[Dict] = tree_data.get("tree", [])[:MAX_TREE_ENTRIES]

        # ── 3. Language stats from GitHub ─────────────────────────────────────
        r = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/languages")
        r.raise_for_status()
        gh_languages: Dict[str, int] = r.json()   # {"Python": 12345, ...}

        # ── 4. Fetch key file contents (only blobs whose basename matches) ────
        key_paths = [
            e["path"] for e in all_entries
            if e["type"] == "blob" and os.path.basename(e["path"]) in KEY_FILES
        ][:20]   # cap at 20 files to stay within rate-limit budget

        key_file_contents: Dict[str, str] = {}
        for path in key_paths:
            try:
                r = await client.get(
                    f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
                    params={"ref": default_branch},
                )
                r.raise_for_status()
                key_file_contents[path] = _decode_content(r.json())
            except Exception:
                pass   # skip unreadable files silently

    # ── 5. Build counts ───────────────────────────────────────────────────────
    files  = [e for e in all_entries if e["type"] == "blob"]
    dirs   = [e for e in all_entries if e["type"] == "tree"]
    file_count = len(files)
    dir_count  = len(dirs)

    # ── 6. Language list (prefer GitHub's own stats) ──────────────────────────
    sorted_langs = sorted(gh_languages.items(), key=lambda x: -x[1])
    detected_languages = [{"name": lang, "count": cnt} for lang, cnt in sorted_langs[:10]]

    # ── 7. File tree string ───────────────────────────────────────────────────
    file_tree = _render_tree(all_entries)

    # ── 8. Framework hints ────────────────────────────────────────────────────
    framework_hints = _detect_hints(key_file_contents)

    return {
        "file_count": file_count,
        "dir_count": dir_count,
        "file_tree": file_tree[:18_000],
        "key_files": key_file_contents,
        "detected_languages": detected_languages,
        "framework_hints": framework_hints,
        # extra meta (not used by LLM agent but useful for logging)
        "_source": "github_api",
        "_repo": f"{owner}/{repo}",
        "_branch": default_branch,
        "_truncated": tree_data.get("truncated", False),
    }
