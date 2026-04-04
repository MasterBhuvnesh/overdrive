import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const token = session?.githubToken;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized: No GitHub token." }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Forward the status request to the Python FastAPI Worker
    const pythonWorkerUrl = `http://localhost:8000/api/deploy/status/${id}`;
    
    const response = await fetch(pythonWorkerUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: data.detail || data.error || "Deployment status fetch failed.",
      }, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Deploy Status Proxy Error:", error);
    return NextResponse.json({ 
      error: "The Deployment Agent worker is currently unreachable." 
    }, { status: 500 });
  }
}
