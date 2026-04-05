"""
docker_runner.py
────────────────────────────────────────────────────────────────────────────
Writes the generated Dockerfiles + docker-compose.yml to a temp workspace,
then runs `docker compose up --build --abort-on-container-exit` as an async
subprocess with live line-by-line log streaming back to the pipeline.

Public surface
──────────────
  run_docker_compose(job_id, dockerfiles, compose_yaml, log, timeout=120, env_vars=None)
      → (success: bool, output_lines: list[str])
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import tempfile
from typing import Callable, Dict, List, Tuple

# Can be overridden with DOCKER_RUN_TIMEOUT env var (seconds)
DOCKER_TIMEOUT = int(os.getenv("DOCKER_RUN_TIMEOUT", "120"))


# ── helpers ───────────────────────────────────────────────────────────────────

def _workspace_dir(job_id: str) -> str:
    """Return a deterministic temp dir path for this job."""
    return os.path.join(tempfile.gettempdir(), f"overdrive_{job_id[:8]}")


def _patch_compose_dockerfile_refs(
    compose_yaml: str,
    service_names: List[str],
) -> str:
    """
    Ensure each service section in the compose file references the correct
    named Dockerfile (Dockerfile.<service>).

    Strategy
    --------
    - If `dockerfile:` already present under a service's build block → leave it.
    - If `build: .` (shorthand) → expand to multi-line with named dockerfile.
    - If `build:\n  context: .` without dockerfile → inject the line.
    """
    for svc in service_names:
        named = f"Dockerfile.{svc}"

        # 1. Shorthand: "    build: ."  → expand
        # This regex looks for 'build: .' possibly followed by comments or trailing whitespace
        compose_yaml = re.sub(
            rf"([ \t]+)(build:\s*\.[^\n]*(\n|$))",
            rf"\1build:\n\1  context: .\n\1  dockerfile: {named}\n",
            compose_yaml,
            count=1,
        )

    return compose_yaml


# ── public API ────────────────────────────────────────────────────────────────

async def run_docker_compose(
    job_id: str,
    dockerfiles: Dict[str, str],
    compose_yaml: str,
    log: Callable[[str, str], None],
    timeout: int = DOCKER_TIMEOUT,
    env_vars: Optional[Dict[str, str]] = None,
) -> Tuple[bool, List[str]]:
    """
    Write generated files to disk and execute `docker compose up --build`.

    Parameters
    ----------
    job_id       : used to name the temp workspace directory
    dockerfiles  : {service_name: dockerfile_content}
    compose_yaml : raw content of docker-compose.yml
    log          : pipeline log callback  log(message, type)
    timeout      : seconds before killing the subprocess (default 120)

    Returns
    -------
    (success, all_output_lines)
        success           → True if docker exited with code 0
        all_output_lines  → every stdout/stderr line captured
    
    env_vars (Optional): Dictionary of KV pairs to write to a .env file.
    """
    workspace = _workspace_dir(job_id)
    repo_dir = os.path.join(workspace, "repo")
    os.makedirs(repo_dir, exist_ok=True)
    output_lines: List[str] = []

    try:
        # ── Step 0: Ghost Build Check ─────────────────────────────────────
        # Ensure the repo_dir actually contains source code before we add our files.
        existing_items = [f for f in os.listdir(repo_dir) if not f.startswith(".")]
        if not existing_items:
            msg = "❌ GHOST BUILD: Build context is empty. Source code hydration failed."
            log(msg, "error")
            output_lines.append(msg)
            return False, output_lines

        # ── Step A: Write Dockerfiles ─────────────────────────────────────
        for svc_name, content in dockerfiles.items():
            # Standardized naming logic (always include service suffix)
            filename = f"Dockerfile.{svc_name}"
            path = os.path.join(repo_dir, filename)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)
            log(f"📝 Written {filename} to workspace", "info")

        # ── Step B: Patch compose to use named Dockerfiles ───────────────
        if len(dockerfiles) > 1:
            compose_yaml = _patch_compose_dockerfile_refs(
                compose_yaml, list(dockerfiles.keys())
            )

        # ── Step B.5: Write .env file if env_vars provided ──────────────
        if env_vars:
            dot_env_path = os.path.join(repo_dir, ".env")
            with open(dot_env_path, "w", encoding="utf-8") as fh:
                for k, v in env_vars.items():
                    fh.write(f"{k}={v}\n")
                    log(f"🔑 Env Variable added: {k}", "info")
            log(f"📝 Written .env with {len(env_vars)} variables", "info")

        # ── Step C: Write docker-compose.yml ─────────────────────────────
        compose_path = os.path.join(repo_dir, "docker-compose.yml")
        with open(compose_path, "w", encoding="utf-8") as fh:
            fh.write(compose_yaml)
        log("📝 Written docker-compose.yml to workspace", "info")
        
        # 🧪 Debug: Show the final YAML configuration
        log("🔎 FINAL DOCKER COMPOSE CONFIGURATION:", "data")
        for line in compose_yaml.splitlines():
            log(f"   {line}", "data")
            
        log(f"📂 Workspace: {repo_dir}", "info")

        # ── Step D: Launch subprocess ─────────────────────────────────────
        log(
            f"🚀 Launching: docker compose up --build "
            f"--abort-on-container-exit  (timeout: {timeout}s)",
            "step",
        )

        env = {**os.environ, "COMPOSE_ANSI": "never"}  # no ANSI escapes in logs

        try:
            proc = await asyncio.create_subprocess_exec(
                "docker",
                "compose",
                "up",
                "--build",
                "--abort-on-container-exit",
                "--no-color",
                cwd=repo_dir,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,  # merge stderr → stdout stream
            )
        except FileNotFoundError:
            msg = (
                "❌ 'docker' binary not found. "
                "Please install Docker Desktop and ensure it is in PATH."
            )
            log(msg, "error")
            output_lines.append(msg)
            return False, output_lines

        # ── Step E: Stream output line-by-line ────────────────────────────
        async def _stream_output() -> None:
            assert proc.stdout is not None
            async for raw_line in proc.stdout:
                line = raw_line.decode("utf-8", errors="replace").rstrip()
                if not line:
                    continue
                output_lines.append(line)
                log(line, "docker")

        try:
            await asyncio.wait_for(_stream_output(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            msg = f"⏱️  docker compose timed out after {timeout}s — process killed."
            output_lines.append(msg)
            log(msg, "error")
            return False, output_lines

        await proc.wait()
        success = proc.returncode == 0

        if success:
            log("✅ docker compose exited cleanly (exit code 0)", "success")
        else:
            log(
                f"❌ docker compose failed (exit code {proc.returncode})",
                "error",
            )

        return success, output_lines

    except Exception as exc:
        msg = f"❌ docker_runner unexpected error: {type(exc).__name__}: {repr(exc)}"
        import traceback
        traceback.print_exc()
        log(msg, "error")
        output_lines.append(msg)
        return False, output_lines

    finally:
        # Always clean up the workspace to avoid disk bloat.
        # Remove the line below to keep the workspace on failure for debugging.
        shutil.rmtree(workspace, ignore_errors=True)
