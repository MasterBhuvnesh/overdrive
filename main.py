import os
import sys
import uuid
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
from agent import pr_agent
from github_utils import list_user_repos
from dotenv import load_dotenv

# Import Deployment Agent logic
from deployment_agent.pipeline import run_pipeline

load_dotenv()

app = FastAPI(title="Overdrive Hybrid Agent API")

# Global Job Stores
SESSIONS = {}
DEPLOYMENT_JOBS = {}
PR_JOBS = {}

class AgentRequest(BaseModel):
    repoUrl: str
    logs: str
    authOverride: Optional[str] = None
    errorReport: Optional[str] = None
    jobId: Optional[str] = None # Support looking up error report by Job ID

class DeploymentRequest(BaseModel):
    repoUrl: str
    authOverride: Optional[str] = None
    envVars: Optional[Dict[str, str]] = None # Pass custom env to deployment

class RepoInfo(BaseModel):
    id: int
    full_name: str
    html_url: str
    description: Optional[str]

@app.get("/api/auth/me")
async def get_me(request: Request):
    return {"user": {"id": "1", "name": "Python User", "email": "python@overdrive.ai"}}

@app.get("/api/system/docker/status")
async def get_docker_status():
    import docker
    try:
        client = docker.from_env()
        client.ping()
        return {"status": "running", "version": client.version().get("Version")}
    except Exception as e:
        return {"status": "stopped", "error": str(e)}

@app.get("/api/repo/list", response_model=List[RepoInfo])
async def list_repos(token: Optional[str] = None):
    token = token or os.getenv("GITHUB_TOKEN")
    if not token:
        raise HTTPException(status_code=401, detail="No GitHub token provided.")
    
    try:
        repos = await list_user_repos(token)
        return repos
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Deployment Agent (Agent 2) Endpoints ---

@app.post("/api/deploy")
async def start_deployment(req: DeploymentRequest, background_tasks: BackgroundTasks):
    token = req.authOverride or os.getenv("GITHUB_TOKEN")
    api_key = "lm-studio" # Local LLMs do not enforce private keys
    base_url = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
    
    if not token:
        raise HTTPException(status_code=401, detail="Missing GitHub token.")
    
    job_id = str(uuid.uuid4())
    DEPLOYMENT_JOBS[job_id] = {
        "status": "idle",
        "logs": [],
        "results": None,
        "error": None
    }
    
    # Run pipeline in background
    background_tasks.add_task(
        run_pipeline,
        job_id=job_id,
        github_url=req.repoUrl,
        api_key=api_key,
        base_url=base_url,
        jobs=DEPLOYMENT_JOBS,
        github_token=token,
        env_vars=req.envVars
    )
    
    return {"jobId": job_id, "status": "started"}

@app.get("/api/deploy/status/{job_id}")
async def get_deployment_status(job_id: str):
    job = DEPLOYMENT_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

# --- PR Agent (Agent 1) Endpoints ---

@app.post("/api/agent")
async def run_agent(req: AgentRequest):
    token = req.authOverride or os.getenv("GITHUB_TOKEN")
    if not token:
        raise HTTPException(status_code=401, detail="No GitHub access token.")
    
    try:
        # If jobId is provided, attempt to pull error report from that job
        report = req.errorReport
        if req.jobId and not report:
            job = DEPLOYMENT_JOBS.get(req.jobId)
            if job:
                report = (job.get("results") or {}).get("error_report")
                if not report and job.get("error"):
                    report = f"System Error: {job['error']}"

        # Invoke the LangGraph Agent with potential errorReport from Agent 2
        state = {
            "repo_url": req.repoUrl,
            "logs": req.logs,
            "token": token,
            "error_report": report, # Passed to the agent
            "analysis": None,
            "pr_result": None,
            "error": None,
            "status": "idle"
        }
        
        final_state = await pr_agent.ainvoke(state)
        
        if final_state.get("error"):
            return JSONResponse({
                "success": False,
                "error": final_state["error"]
            }, status_code=500)
            
        return {
            "success": True,
            "analysis": final_state["analysis"].dict() if final_state.get("analysis") else None,
            "pr": final_state["pr_result"],
            "status": final_state["status"]
        }
        
    except Exception as e:
        print(f"Agent API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

