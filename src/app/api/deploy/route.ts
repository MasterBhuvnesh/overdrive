import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  const token = session?.githubToken;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized: No GitHub token." }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Forward the deployment request to the Python FastAPI Worker
    const pythonWorkerUrl = "http://localhost:8000/api/deploy";
    
    // We pass the token in the body as authOverride so the worker can use it
    const response = await fetch(pythonWorkerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        authOverride: body.authOverride || token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: data.detail || data.error || "Deployment agent failed.",
      }, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Deploy Proxy Error:", error);
    return NextResponse.json({ 
      error: "The Deployment Agent worker is currently unreachable. Make sure the Python server is running." 
    }, { status: 500 });
  }
}
