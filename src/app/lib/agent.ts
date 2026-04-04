import "server-only";
import { StateGraph, Annotation } from "@langchain/langgraph";
import { analyzeWithAI } from "./ai";
import { createPR, parseGitHubUrl } from "./github-pr";
import type { PRResult, FixAnalysis } from "./heal-types";

/* ─── Define Agent State ─────────────────────────────────────────────── */

export interface AgentState {
  repoUrl: string;
  logs: string;
  token: string;
  analysis?: FixAnalysis;
  prResult?: PRResult;
  error?: string;
  status: "idle" | "analyzing" | "raising_pr" | "completed" | "failed";
}

const AgentStateAnnotation = Annotation.Root({
  repoUrl: Annotation<string>(),
  logs: Annotation<string>(),
  token: Annotation<string>(),
  analysis: Annotation<FixAnalysis | undefined>(),
  prResult: Annotation<PRResult | undefined>(),
  error: Annotation<string | undefined>(),
  status: Annotation<AgentState["status"]>(),
});

/* ─── Define Nodes ─────────────────────────────────────────────────── */

/**
 * node: think
 * Analyzes logs with Gemini and generates a fix report.
 */
async function thinkNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    const { owner, repo } = parseGitHubUrl(state.repoUrl) || { owner: "unknown", repo: "unknown" };
    const analysis = await analyzeWithAI(state.logs, `${owner}/${repo}`);

    return {
      analysis,
      status: "raising_pr"
    };
  } catch (err) {
    return {
      error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      status: "failed"
    };
  }
}

/**
 * node: execute
 * Uses the GitHub API to create a branch, commit the fix, and open a PR.
 */
async function executeNode(state: AgentState): Promise<Partial<AgentState>> {
  if (state.error || !state.analysis) return { status: "failed" };

  try {
    const { owner, repo } = parseGitHubUrl(state.repoUrl)!;

    const prResult = await createPR({
      owner,
      repo,
      title: state.analysis.error_summary,
      body: state.analysis.fix_markdown,
      fileContent: state.analysis.fix_markdown,
      token: state.token,
    });

    return {
      prResult,
      status: "completed"
    };
  } catch (err) {
    return {
      error: `PR creation failed: ${err instanceof Error ? err.message : String(err)}`,
      status: "failed"
    };
  }
}

/* ─── Build the Graph ─────────────────────────────────────────────── */

const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("think", thinkNode)
  .addNode("execute", executeNode)
  .addEdge("__start__", "think")
  .addEdge("think", "execute")
  .addEdge("execute", "__end__");

export const prAgent = workflow.compile();
