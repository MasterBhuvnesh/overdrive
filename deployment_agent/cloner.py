import os
import re
import subprocess
from typing import Tuple


def normalize_github_url(url: str) -> str:
    url = url.strip().rstrip("/")
    # SSH → HTTPS
    if url.startswith("git@github.com:"):
        url = url.replace("git@github.com:", "https://github.com/")
    # Strip .git suffix
    if url.endswith(".git"):
        url = url[:-4]
    if not re.match(r"https://github\.com/[\w\-\.]+/[\w\-\.]+", url):
        raise ValueError(f"Invalid GitHub URL: {url}")
    return url


def clone_repo(github_url: str, target_dir: str) -> Tuple[bool, str]:
    try:
        url = normalize_github_url(github_url)
        os.makedirs(target_dir, exist_ok=True)

        result = subprocess.run(
            ["git", "clone", "--depth=1", "--single-branch", url, target_dir],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            # retry with .git suffix
            result = subprocess.run(
                ["git", "clone", "--depth=1", "--single-branch", url + ".git", target_dir],
                capture_output=True,
                text=True,
                timeout=120,
            )

        if result.returncode != 0:
            return False, result.stderr.strip()

        return True, "Success"

    except subprocess.TimeoutExpired:
        return False, "Clone timed out (120s). The repository may be too large."
    except ValueError as e:
        return False, str(e)
    except FileNotFoundError:
        return False, "git is not installed. Please install git."
    except Exception as e:
        return False, str(e)
