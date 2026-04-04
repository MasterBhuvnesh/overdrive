import { NextRequest, NextResponse } from "next/server";
import { getSession, deleteSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session || !session.githubToken) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    // We can use the token to fetch current GitHub user details
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${session.githubToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // Token might be invalid/expired
      await deleteSession();
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const userData = await response.json();

    return NextResponse.json({
      user: {
        id: userData.id.toString(),
        name: userData.name || userData.login,
        email: userData.email || "No public email",
        createdAt: userData.created_at,
        avatar_url: userData.avatar_url,
        githubToken: session.githubToken, // Included for debugging
      },
    });
  } catch (error) {
    console.error("Me Route Error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

export async function POST() {
  await deleteSession();
  return NextResponse.json({ success: true });
}
