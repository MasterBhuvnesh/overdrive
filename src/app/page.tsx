"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [checking, setChecking] = useState(true);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) router.replace("/dashboard");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background effects */}
      <div className="bg-grid" />
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div
          className="fade-in"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}
        >
          <div className="logo-mark" style={{ marginBottom: 14 }}>
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9z" />
            </svg>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Overdrive
          </h1>
          <p style={{ fontSize: "0.875rem", marginTop: 6, color: "var(--text-muted)", textAlign: "center" }}>
            {tab === "login"
              ? "Welcome back — sign in to continue"
              : "Create your account to get started"}
          </p>
        </div>

        {/* Card — padding lives in CSS .auth-card */}
        <div className="auth-card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.9375rem", color: "rgba(240,240,248,0.7)", marginBottom: 24, lineHeight: 1.6 }}>
            The AI-powered PR Agent that heals your repository in seconds.
          </p>

          <a
            href="/api/auth/github"
            target="_top"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "13px",
              borderRadius: 12,
              background: "white",
              color: "black",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.9375rem",
              transition: "transform 0.15s",
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            Sign in with GitHub
          </a>
        </div>

        {/* Footer */}
        <p
          className="fade-in fade-in-delay-3"
          style={{ textAlign: "center", fontSize: "0.75rem", marginTop: 20, color: "var(--text-muted)" }}
        >
          By continuing, you agree to our{" "}
          <a href="#" className="auth-link">Terms</a>{" "}&amp;{" "}
          <a href="#" className="auth-link">Privacy Policy</a>
        </p>
      </div>
    </main>
  );
}
