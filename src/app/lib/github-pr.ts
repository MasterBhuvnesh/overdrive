import "server-only";
import type { PRResult } from "./heal-types";

const GITHUB_API = "https://api.github.com";

/* ─── Build auth headers (supports runtime token) ────────────────────── */

function getHeaders(token?: string): Record<string, string> {
  let t = (token || process.env.GITHUB_TOKEN || "").trim();
  
  // Sanitize token: Remove any non-ASCII characters (often from copy-paste errors)
  // This prevents 'TypeError: Cannot convert argument to a ByteString'
  t = t.replace(/[^\x00-\x7F]/g, "");

  if (!t || t.length === 0) {
    throw new Error(
      "GITHUB_TOKEN is not configured. Add it to .env or provide it in the request."
    );
  }
  return {
    Authorization: `Bearer ${t}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "Overdrive-AI-Agent",
  };
}

/* ─── Parse github URL ───────────────────────────────────────────────── */

export function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname
      .replace(/^\//, "")
      .replace(/\/$/, "")
      .replace(/\.git$/, "")
      .split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

/* ─── Create PR with arbitrary content ───────────────────────────────── */

export async function createPR(opts: {
  owner: string;
  repo: string;
  title: string;
  body: string;           // PR body (markdown for the PR description)
  fileContent: string;    // file content to commit (e.g. fix_error.md)
  fileName?: string;      // file name to commit (default: fix_error.md)
  commitMessage?: string; // custom commit message
  branchPrefix?: string;  // branch prefix (default: fix/auto-heal)
  labels?: string[];      // optional labels
  token?: string;         // optional runtime token override
}): Promise<PRResult> {
  const h = getHeaders(opts.token);
  const timestamp = Date.now();
  const prefix = opts.branchPrefix || "fix/auto-heal";
  const branchName = `${prefix}-${timestamp}`;
  const fileName = opts.fileName || "fix_error.md";
  const commitMsg = opts.commitMessage || `fix: ${opts.title}`;

  // 1. Get default branch + its SHA
  const repoRes = await fetch(
    `${GITHUB_API}/repos/${opts.owner}/${opts.repo}`,
    { headers: h }
  );
  if (!repoRes.ok) {
    const body = await repoRes.text();
    throw new Error(`Failed to fetch repo info: ${repoRes.status} — ${body}`);
  }
  const repoData = await repoRes.json();
  const defaultBranch: string = repoData.default_branch;

  const branchRes = await fetch(
    `${GITHUB_API}/repos/${opts.owner}/${opts.repo}/git/ref/heads/${defaultBranch}`,
    { headers: h }
  );
  if (!branchRes.ok) {
    throw new Error(`Failed to get default branch ref: ${branchRes.status}`);
  }
  const branchData = await branchRes.json();
  const baseSha: string = branchData.object.sha;

  // 2. Create fix branch
  const createRefRes = await fetch(
    `${GITHUB_API}/repos/${opts.owner}/${opts.repo}/git/refs`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    }
  );
  if (!createRefRes.ok) {
    const body = await createRefRes.text();
    throw new Error(
      `Failed to create branch: ${createRefRes.status} — ${body}`
    );
  }

  // 3. Commit file
  const content = Buffer.from(opts.fileContent).toString("base64");
  const commitRes = await fetch(
    `${GITHUB_API}/repos/${opts.owner}/${opts.repo}/contents/${fileName}`,
    {
      method: "PUT",
      headers: h,
      body: JSON.stringify({
        message: commitMsg,
        content,
        branch: branchName,
      }),
    }
  );
  if (!commitRes.ok) {
    const body = await commitRes.text();
    throw new Error(
      `Failed to commit ${fileName}: ${commitRes.status} — ${body}`
    );
  }

  // 4. Open Pull Request
  const prRes = await fetch(
    `${GITHUB_API}/repos/${opts.owner}/${opts.repo}/pulls`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        title: opts.title,
        body: opts.body,
        head: branchName,
        base: defaultBranch,
      }),
    }
  );
  if (!prRes.ok) {
    const body = await prRes.text();
    throw new Error(`Failed to create PR: ${prRes.status} — ${body}`);
  }
  const prData = await prRes.json();

  // 5. Try to add labels (optional, graceful fail)
  const labels = opts.labels ?? ["auto-heal", "ai-generated"];
  try {
    await fetch(
      `${GITHUB_API}/repos/${opts.owner}/${opts.repo}/issues/${prData.number}/labels`,
      {
        method: "POST",
        headers: h,
        body: JSON.stringify({ labels }),
      }
    );
  } catch {
    // labels may not exist — ok
  }

  return {
    pr_url: prData.html_url,
    pr_number: prData.number,
    branch_name: branchName,
  };
}
