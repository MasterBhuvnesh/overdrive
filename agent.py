from typing import TypedDict, Optional, List, Any
from langgraph.graph import StateGraph, END
from ai_logic import analyze_with_ai, FixAnalysis
from github_utils import create_pr, parse_github_url

# Define Agent State
class AgentState(TypedDict):
    repo_url: str
    logs: str
    token: str
    error_report: Optional[str]
    analysis: Optional[FixAnalysis]
    pr_result: Optional[dict]
    error: Optional[str]
    status: str

# Node Logic
async def think_node(state: AgentState) -> dict:
    """Think about the build failure and provide a fix."""
    try:
        gh_info = parse_github_url(state["repo_url"])
        repo_name = gh_info["repo"] if gh_info else "unknown"
        
        # Pass the error_report from Agent 2 to the AI integration
        analysis = await analyze_with_ai(
            state["logs"], 
            repo_name, 
            state.get("error_report")
        )
        
        return {
            "analysis": analysis,
            "status": "raising_pr"
        }
    except Exception as e:
        return {
            "error": f"Analysis failed: {str(e)}",
            "status": "failed"
        }

async def execute_node(state: AgentState) -> dict:
    """Create the PR on GitHub."""
    if state.get("error") or not state.get("analysis"):
        return {"status": "failed"}
        
    try:
        gh_info = parse_github_url(state["repo_url"])
        if not gh_info:
            raise ValueError("Invalid GitHub URL")
            
        owner, repo_name = gh_info["owner"], gh_info["repo"]
        analysis = state["analysis"]
        
        pr_result = await create_pr(
            owner=owner,
            repo_name=repo_name,
            title=analysis.error_summary,
            body=analysis.fix_markdown,
            file_content=analysis.fix_markdown,
            token=state["token"]
        )
        
        return {
            "pr_result": pr_result,
            "status": "completed"
        }
    except Exception as e:
        return {
            "error": f"PR creation failed: {str(e)}",
            "status": "failed"
        }

# Build the Graph
workflow = StateGraph(AgentState)

workflow.add_node("think", think_node)
workflow.add_node("execute", execute_node)

workflow.set_entry_point("think")
workflow.add_edge("think", "execute")
workflow.add_edge("execute", END)

# Compile
pr_agent = workflow.compile()
