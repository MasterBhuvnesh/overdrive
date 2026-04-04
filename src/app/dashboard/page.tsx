"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [repos, setRepos] = useState<any[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace("/");
        } else {
          setUser(data.user);
          setLoading(false);
          // Only fetch repos if user is authenticated
          fetchRepos();
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  async function fetchRepos() {
    try {
      const res = await fetch("/api/repo/list");
      const data = await res.json();
      if (data.repos) setRepos(data.repos);
    } catch (err) {
      console.error("Failed to fetch repos:", err);
    } finally {
      setReposLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/me", { method: "POST" });
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading…</p>
        </div>
      </div>
    );
  }

  const memberSince = user
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : "";

  const initials = user
    ? user.name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
    : "?";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="bg-grid" />
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      {/* Navbar */}
      <nav
        style={{
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(5,5,8,0.8)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 24px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="logo-mark" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9z" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.01em" }}>Overdrive</span>
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Avatar */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "white",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <button
              id="btn-logout"
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "rgba(240,240,248,0.7)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s, color 0.2s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.4)";
                (e.target as HTMLButtonElement).style.color = "#f87171";
                (e.target as HTMLButtonElement).style.background = "rgba(248,113,113,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.target as HTMLButtonElement).style.color = "rgba(240,240,248,0.7)";
                (e.target as HTMLButtonElement).style.background = "var(--surface)";
              }}
            >
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px", position: "relative", zIndex: 10 }}>
        {/* Greeting */}
        <div className="fade-in" style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="badge badge-success">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4" /></svg>
              Authenticated
            </span>
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Welcome back,{" "}
            <span style={{ background: "linear-gradient(135deg, var(--accent), #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {user?.name.split(" ")[0]}
            </span> 👋
          </h1>
          <p style={{ marginTop: 10, color: "var(--text-muted)", fontSize: "1rem" }}>
            You&apos;re successfully logged into your Overdrive account.
          </p>
        </div>

        {/* Cards grid */}
        <div
          className="fade-in fade-in-delay-1"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
            marginBottom: 32,
          }}
        >
          {/* Profile card */}
          <div className="dashboard-card">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "white",
                  flexShrink: 0,
                  boxShadow: "0 4px 16px rgba(108,99,255,0.35)",
                }}
              >
                {initials}
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: "1rem" }}>{user?.name}</p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginTop: 2 }}>{user?.email}</p>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <Row label="User ID" value={user?.id?.toString().slice(0, 8) + "…"} />
              <Row label="Member since" value={memberSince} />
            </div>
          </div>

          {/* Security card */}
          <div className="dashboard-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 600 }}>Security</p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Account protection</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SecurityItem label="Password" status="Set" ok />
              <SecurityItem label="Session" status="Active (7 days)" ok />
              <SecurityItem label="JWT Encryption" status="HS256" ok />
            </div>
          </div>

          {/* Session card */}
          <div className="dashboard-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(108,99,255,0.12)", border: "1px solid rgba(108,99,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 600 }}>Session</p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Current session info</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Row label="Status" value="✓ Active" />
              <Row label="Cookie" value="HttpOnly, SameSite=Lax" />
              <Row label="Expires" value="7 days from login" />
            </div>
          </div>
        </div>

        {/* Repositories section */}
        <div 
          className="fade-in fade-in-delay-1"
          style={{ marginBottom: 32 }}
        >
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(240,240,248,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
            Your Repositories ({repos.length})
          </p>
          
          {reposLoading ? (
             <div style={{ padding: "40px", textAlign: "center", background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)" }}>
               <div className="spinner" style={{ margin: "0 auto 12px" }} />
               <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Fetching your projects from GitHub...</p>
             </div>
          ) : repos.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No repositories found.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {repos.slice(0, 6).map((repo) => (
                <div key={repo.id} className="dashboard-card" style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ overflow: "hidden" }}>
                      <p style={{ fontWeight: 600, fontSize: "0.9375rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {repo.name}
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 2 }}>{repo.full_name}</p>
                    </div>
                    {repo.isPrivate && <span style={{ fontSize: "0.625rem", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>Private</span>}
                  </div>
                  
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4, height: 40, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 16 }}>
                    {repo.description || "No description provided."}
                  </p>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", color: "rgba(240,240,248,0.3)" }}>
                      Updated {new Date(repo.updated_at).toLocaleDateString()}
                    </span>
                    <Link 
                      href={`/heal?repo=${encodeURIComponent(repo.html_url)}`}
                      style={{ fontSize: "0.75rem", color: "var(--accent-secondary)", textDecoration: "none", fontWeight: 600 }}
                    >
                      Fix Repo →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          {repos.length > 6 && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
               <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>And {repos.length - 6} more repositories...</p>
            </div>
          )}
        </div>

        {/* ── Quick Actions row ── */}
        <div
          className="fade-in fade-in-delay-1"
          style={{ marginBottom: 28 }}
        >
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(240,240,248,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            Quick Actions
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {/* Repo Analyzer */}
            <Link
              href="/repo"
              id="link-repo-analyzer"
              style={{ textDecoration: "none" }}
            >
              <div
                className="dashboard-card"
                style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer", padding: "18px 20px" }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                  background: "linear-gradient(135deg,rgba(108,99,255,0.2),rgba(139,92,246,0.15))",
                  border: "1px solid rgba(108,99,255,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: 3 }}>Repo Analyzer</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>Analyze any GitHub repo and log debug output with your user context.</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(240,240,248,0.3)" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            {/* Heal Agent */}
            <Link
              href="/heal"
              id="link-heal-agent"
              style={{ textDecoration: "none" }}
            >
              <div
                className="dashboard-card"
                style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer", padding: "18px 20px" }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                  background: "linear-gradient(135deg,rgba(192,132,252,0.2),rgba(124,58,237,0.15))",
                  border: "1px solid rgba(192,132,252,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 3h5v5" />
                    <path d="M21 3l-7 7" />
                    <path d="M11 13l-7 7" />
                    <path d="M3 16v5h5" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.9375rem" }}>PR Agent</p>
                    <span style={{
                      fontSize: "0.5625rem", fontWeight: 700, padding: "1px 5px",
                      borderRadius: 4, background: "rgba(192,132,252,0.15)",
                      border: "1px solid rgba(192,132,252,0.3)", color: "#c084fc",
                      letterSpacing: "0.05em",
                    }}>PR</span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>Auto-create fix PRs on GitHub — paste fix content from the AI agent and raise a PR.</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(240,240,248,0.3)" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </div>

        {/* Tech stack note */}
        <div
          className="fade-in fade-in-delay-2 dashboard-card"
          style={{ padding: 24 }}
        >
          <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 12, color: "rgba(240,240,248,0.65)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Stack used
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              "Next.js 16", "React 19", "TypeScript", "bcryptjs", "jose (JWT)",
              "Zod", "App Router", "Route Handlers", "HttpOnly Cookies",
              "Gemini AI", "GitHub REST API", "Docker",
            ].map((tech) => (
              <span
                key={tech}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: "0.8125rem",
                  background: tech === "Gemini AI" ? "rgba(192,132,252,0.1)" : "rgba(108,99,255,0.1)",
                  border: `1px solid ${tech === "Gemini AI" ? "rgba(192,132,252,0.2)" : "rgba(108,99,255,0.2)"}`,
                  color: tech === "Gemini AI" ? "#c084fc" : "var(--accent-2)",
                  fontWeight: 500,
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 500, maxWidth: "60%", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function SecurityItem({ label, status, ok }: { label: string; status: string; ok?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>{label}</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: "0.75rem",
          fontWeight: 600,
          color: ok ? "#34d399" : "#f87171",
          background: ok ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
          border: `1px solid ${ok ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
          padding: "3px 10px",
          borderRadius: "999px",
        }}
      >
        {ok && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status}
      </span>
    </div>
  );
}
