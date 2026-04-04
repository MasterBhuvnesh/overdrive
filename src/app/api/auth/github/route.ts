import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const client_id = process.env.GITHUB_CLIENT_ID;
  const redirect_uri = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI || "http://localhost:3000/api/auth/github/callback";
  const scope = "repo read:user user:email";
  const state = Math.random().toString(36).substring(7);

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

  // Use a standard Response redirect for better browser compatibility
  return new Response(null, {
    status: 307,
    headers: {
      Location: githubAuthUrl,
    },
  });
}
