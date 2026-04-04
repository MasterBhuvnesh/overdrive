import os
import json
from typing import Dict, Any, List

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

LANGUAGE_MAP = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
    ".jsx": "React (JSX)", ".tsx": "React (TSX)", ".go": "Go",
    ".rs": "Rust", ".java": "Java", ".rb": "Ruby", ".php": "PHP",
    ".cs": "C#", ".cpp": "C++", ".vue": "Vue", ".svelte": "Svelte",
    ".dart": "Dart", ".kt": "Kotlin", ".swift": "Swift",
}

MAX_FILE_SIZE = 40_000  # 40KB


def generate_file_tree(root: str, prefix: str = "", depth: int = 0, max_depth: int = 5) -> str:
    if depth > max_depth:
        return ""
    lines = []
    try:
        entries = sorted(os.listdir(root))
    except PermissionError:
        return ""

    dirs = [e for e in entries if os.path.isdir(os.path.join(root, e)) and e not in SKIP_DIRS]
    files = [e for e in entries if os.path.isfile(os.path.join(root, e))]
    all_entries = dirs + files

    for i, entry in enumerate(all_entries):
        is_last = i == len(all_entries) - 1
        connector = "└── " if is_last else "├── "
        lines.append(f"{prefix}{connector}{entry}")
        path = os.path.join(root, entry)
        if os.path.isdir(path):
            ext = "    " if is_last else "│   "
            subtree = generate_file_tree(path, prefix + ext, depth + 1, max_depth)
            if subtree:
                lines.append(subtree)
    return "\n".join(lines)


def read_key_file(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read(MAX_FILE_SIZE)
        if len(content) >= MAX_FILE_SIZE:
            content += "\n... [truncated]"
        return content
    except Exception:
        return "[Could not read file]"


def detect_languages(root: str) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in LANGUAGE_MAP:
                lang = LANGUAGE_MAP[ext]
                counts[lang] = counts.get(lang, 0) + 1
    return counts


def analyze_repo(repo_dir: str) -> Dict[str, Any]:
    file_count = 0
    dir_count = 0
    key_file_contents: Dict[str, str] = {}

    for dirpath, dirnames, filenames in os.walk(repo_dir):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        dir_count += len(dirnames)
        file_count += len(filenames)
        for fn in filenames:
            if fn in KEY_FILES:
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, repo_dir)
                key_file_contents[rel] = read_key_file(full)

    file_tree = generate_file_tree(repo_dir)
    languages = detect_languages(repo_dir)
    sorted_langs = sorted(languages.items(), key=lambda x: -x[1])

    # Framework hints
    hints: List[str] = []
    if "package.json" in key_file_contents:
        try:
            pkg = json.loads(key_file_contents["package.json"])
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if "next" in deps:
                hints.append("Next.js")
            elif "react" in deps:
                hints.append("React")
            if "vue" in deps:
                hints.append("Vue.js")
            if "svelte" in deps:
                hints.append("Svelte")
            if "express" in deps:
                hints.append("Express.js")
            if "@nestjs/core" in deps:
                hints.append("NestJS")
            if "vite" in deps:
                hints.append("Vite")
            if "typescript" in deps or "ts-node" in deps:
                hints.append("TypeScript")
            if "mongoose" in deps or "mongodb" in deps:
                hints.append("MongoDB")
            if "pg" in deps or "postgres" in deps:
                hints.append("PostgreSQL")
            if "mysql2" in deps:
                hints.append("MySQL")
            if "redis" in deps or "ioredis" in deps:
                hints.append("Redis")
            if "prisma" in deps or "@prisma/client" in deps:
                hints.append("Prisma")
        except Exception:
            pass

    if "requirements.txt" in key_file_contents:
        reqs = key_file_contents["requirements.txt"].lower()
        for fw, name in [
            ("django", "Django"), ("flask", "Flask"), ("fastapi", "FastAPI"),
            ("sqlalchemy", "SQLAlchemy"), ("celery", "Celery"),
            ("psycopg", "PostgreSQL"), ("pymongo", "MongoDB"), ("redis", "Redis"),
        ]:
            if fw in reqs:
                hints.append(name)

    return {
        "file_count": file_count,
        "dir_count": dir_count,
        "file_tree": file_tree[:18000],
        "key_files": key_file_contents,
        "detected_languages": [{"name": l, "count": c} for l, c in sorted_langs[:10]],
        "framework_hints": list(set(hints)),
    }
