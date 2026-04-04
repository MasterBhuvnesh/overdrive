/* ─── PR Agent Types ─────────────────────────────────────────────────── */

/** Request to the PR Agent endpoint */
export interface PRAgentRequest {
  repoUrl: string;
  prTitle: string;
  prBody: string;           // markdown content for fix_error.md
  commitMessage?: string;   // optional custom commit message
  branchPrefix?: string;    // optional branch prefix (default: "fix/auto-heal")
  labels?: string[];        // optional labels to add
  fileName?: string;        // optional file name (default: "fix_error.md")
}

/** Result from GitHub PR creation */
export interface PRResult {
  pr_url: string;
  pr_number: number;
  branch_name: string;
}

/** Stored PR history item */
export interface PRHistoryItem {
  id: string;
  timestamp: string;
  repoUrl: string;
  repoName: string;
  prTitle: string;
  pr_url: string;
  pr_number: number;
  branch_name: string;
  sessionUserId: string;
}

export type Severity = "low" | "medium" | "high" | "critical" | "unknown";
export type ErrorCategory = "dependency" | "syntax" | "config" | "environment" | "memory" | "type-error" | "unknown";

/** AI Agent's analysis of an error */
export interface FixAnalysis {
  error_summary: string;     // Brief summary of the root cause
  root_cause: string;        // Detailed explanation
  fix_markdown: string;      // Detailed fix markdown and instructions
  fix_steps: string[];       // Step-by-step list
  suggested_commands: string[]; // Terminal commands to run
  severity: Severity;
  category: ErrorCategory | string;
  confidence?: number;
}
