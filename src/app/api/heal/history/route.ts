import { NextResponse } from "next/server";

export async function GET() {
  // Mock history for now.
  // In a real application, you would fetch this from a database (e.g. Prisma + PostgreSQL)
  // based on the logged-in user's ID.
  return NextResponse.json({
    history: [
      {
        id: "1",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        repoUrl: "https://github.com/example/repo",
        repoName: "example/repo",
        prTitle: "[Auto-Heal] Fix dependency mismatch",
        pr_url: "https://github.com/example/repo/pull/1",
        pr_number: 1,
        branch_name: "fix/overdrive-x7y8z9",
      }
    ],
  });
}
