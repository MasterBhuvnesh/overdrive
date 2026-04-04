import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { prAgent } from "@/app/lib/agent";

export async function POST(request: NextRequest) {
  const session = await getSession();
  const token = session?.githubToken;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized: No GitHub token." }, { status: 401 });
  }

  try {
    const { repoUrl, logs, authOverride } = await request.json();

    if (!repoUrl || !logs) {
      return NextResponse.json({ error: "Missing required fields (repoUrl, logs)." }, { status: 400 });
    }

    // 1. Invoke the LangGraph Agent
    const finalState = await (prAgent as any).invoke({
      repoUrl,
      logs,
      token: (authOverride || token) as string,
      status: "idle",
    });

    if (finalState.error) {
      return NextResponse.json({
        success: false,
        error: finalState.error,
        status: finalState.status
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      analysis: finalState.analysis,
      pr: finalState.prResult,
      status: finalState.status,
    });

  } catch (error) {
    console.error("Agent Execution Error:", error);
    return NextResponse.json({ error: "The AI Agent encountered a fatal error while processing your request." }, { status: 500 });
  }
}
