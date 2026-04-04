import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ user: null });
  }

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${session.githubToken}`,
        Accept: "application/json",
      },
    });

    const userData = await response.json();

    return NextResponse.json({
      user: {
        id: userData.id,
        name: userData.name || userData.login,
        email: userData.email,
        avatar_url: userData.avatar_url,
      }
    });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}
