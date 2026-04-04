import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  const token = session?.githubToken;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized: No GitHub token." }, { status: 401 });
  }

  try {
    console.log("DEBUG: Fetching repositories for user with token starting with", token.substring(0, 8));
    const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Overdrive-AI-Agent",
      },
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("DEBUG: GitHub API Error:", response.status, err);
      return NextResponse.json({ error: err.message || "Failed to fetch repositories." }, { status: response.status });
    }

    const repos = await response.json();
    console.log("DEBUG: Successfully fetched repos count:", repos.length);

    // Map to a cleaner format for the UI
    const formattedRepos = repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      html_url: r.html_url,
      default_branch: r.default_branch,
      description: r.description,
      isPrivate: r.private,
      updated_at: r.updated_at,
    }));

    return NextResponse.json({ repos: formattedRepos });
  } catch (error) {
    console.error("Repo List Error:", error);
    return NextResponse.json({ error: "Interal server error while fetching repositories." }, { status: 500 });
  }
}
