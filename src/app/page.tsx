"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      {/* Dynamic Backgrounds */}
      <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(108,99,255,0.1) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-5%", left: "-5%", width: "35vw", height: "35vw", background: "radial-gradient(circle, rgba(192,132,252,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "100%", backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

      <div className="glass-card" style={{ padding: "48px", maxWidth: "480px", width: "90%", textAlign: "center", position: "relative", zIndex: 1, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, var(--accent), var(--accent-secondary))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 16px rgba(108,99,255,0.15)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9z" />
          </svg>
        </div>

        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 12 }}>
          Overdrive
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: 32 }}>
          The AI-powered PR Agent that heals your repository in seconds.
        </p>

        <a
          href="/api/auth/github"
          onClick={() => setLoading(true)}
          className="btn-primary"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, textDecoration: "none", fontSize: "1rem" }}
        >
          {loading ? (
            <div className="spinner" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              Sign in with GitHub
            </>
          )}
        </a>

        <p style={{ marginTop: 24, fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Secure, automated, and lightning-fast repository fixes.
        </p>
      </div>

      <footer style={{ position: "absolute", bottom: 32, fontSize: "0.85rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em", fontWeight: 500 }}>
        © 2026 OVERDRIVE AI • ADVANCED AGENTIC CODING
      </footer>
    </main>
  );
}
