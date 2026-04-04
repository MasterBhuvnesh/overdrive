import { NextResponse } from "next/server";

export async function GET() {
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI;

  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json({ error: "GitHub Client ID is not configured." }, { status: 500 });
  }

  // Scopes: repo (to manage code/PRs), read:user (profile metadata), user:email (to identify user)
  const scopes = ["repo", "read:user", "user:email"].join(" ");
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI || "")}&scope=${encodeURIComponent(scopes)}&state=${Math.random().toString(36).substring(7)}`;

  return NextResponse.redirect(githubAuthUrl);
}
