import os
import re
from github import Github
from typing import Dict, Any, Optional

def parse_github_url(url: str) -> Optional[Dict[str, str]]:
    """Parse a GitHub URL into owner and repo names."""
    pattern = r"github\.com/([^/]+)/([^/.]+)"
    match = re.search(pattern, url)
    if match:
        return {"owner": match.group(1), "repo": match.group(2)}
    return None

async def create_pr(
    owner: str,
    repo_name: str,
    title: str,
    body: str,
    file_content: str,
    token: str,
    branch_prefix: str = "ai-fix-"
) -> Dict[str, Any]:
    """Create a new branch, commit the fix, and open a Pull Request."""
    
    g = Github(token)
    repo = g.get_repo(f"{owner}/{repo_name}")
    
    # 1. Create a unique branch name
    import uuid
    branch_name = f"{branch_prefix}{uuid.uuid4().hex[:8]}"
    
    # 2. Get the default branch (usually 'main' or 'master')
    base_branch = repo.default_branch
    sb = repo.get_branch(base_branch)
    
    # 3. Create the new branch from the base branch
    repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=sb.commit.sha)
    
    # 4. Commit the fix (create or update error.md)
    # Note: In the "Manual Logs" version, we're just creating/updating the report file
    try:
        contents = repo.get_contents("AI_FIX_REPORT.md", ref=branch_name)
        repo.update_file(
            path="AI_FIX_REPORT.md",
            message=f"AI Fix: {title}",
            content=file_content,
            sha=contents.sha,
            branch=branch_name
        )
    except:
        repo.create_file(
            path="AI_FIX_REPORT.md",
            message=f"AI Fix: {title}",
            content=file_content,
            branch=branch_name
        )
    
    # 5. Create the Pull Request
    pr = repo.create_pull(
        title=title,
        body=body,
        base=base_branch,
        head=branch_name
    )
    
    return {
        "pr_url": pr.html_url,
        "pr_number": pr.number,
        "branch_name": branch_name
    }

async def list_user_repos(token: str, limit: int = 50) -> List[Dict[str, Any]]:
    """List the repositories that the user has access to."""
    g = Github(token)
    repos = []
    for repo in g.get_user().get_repos(sort="updated", direction="desc")[:limit]:
        repos.append({
            "id": repo.id,
            "full_name": repo.full_name,
            "html_url": repo.html_url,
            "description": repo.description
        })
    return repos
