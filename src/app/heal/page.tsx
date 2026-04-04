"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────── */
type LogLevel = "info" | "success" | "warn" | "error" | "debug" | "data" | "section" | "ai" | "step" | "done";

interface LogLine {
  id: number;
  ts: string;
  level: LogLevel;
  message: string;
  indent?: number;
}

interface PRResult {
  pr_url: string;
  pr_number: number;
  branch_name: string;
}

/* ─── Helpers ─────────────────────────────────────────────── */
let _logId = 0;
function makeLog(level: LogLevel, message: string, indent = 0): LogLine {
  return {
    id: _logId++,
    ts: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    level,
    message,
    indent,
  };
}

const LEVEL_STYLES: Record<LogLevel, { color: string; badge: string; bg: string }> = {
  section: { color: "#a78bfa", badge: "▶ ", bg: "rgba(108,99,255,0.06)" },
  info: { color: "#60a5fa", badge: "ℹ ", bg: "transparent" },
  success: { color: "#34d399", badge: "✓ ", bg: "transparent" },
  warn: { color: "#fbbf24", badge: "⚠ ", bg: "rgba(251,191,36,0.04)" },
  error: { color: "#f87171", badge: "✗ ", bg: "rgba(248,113,113,0.05)" },
  debug: { color: "#94a3b8", badge: "· ", bg: "transparent" },
  data: { color: "#e2e8f0", badge: "  ", bg: "transparent" },
  ai: { color: "#c084fc", badge: "🤖 ", bg: "rgba(192,132,252,0.05)" },
  step: { color: "#cbd5e1", badge: "⚡ ", bg: "transparent" },
  done: { color: "#10b981", badge: "🎉 ", bg: "rgba(16,185,129,0.05)" },
};

/* ─── Component ─────────────────────────────────────────────── */
export default function HealPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  // Form state
  const [repoUrl, setRepoUrl] = useState("");
  const [logsInput, setLogsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  
  // Repo list state
  const [repos, setRepos] = useState<any[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  
  // Console state
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [lastPR, setLastPR] = useState<PRResult | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [errorReport, setErrorReport] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) router.replace("/");
        else {
          setSessionUser(data.user);
          setChecking(false);
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  // Load repos & handle query param
  useEffect(() => {
    if (!checking && sessionUser) {
      setRepoLoading(true);
      fetch("/api/repo/list")
        .then(r => r.json())
        .then(data => {
          if (data.repos) setRepos(data.repos);
          setRepoLoading(false);
          
          // Check for ?repo= in URL
          const params = new URLSearchParams(window.location.search);
          const preselect = params.get("repo");
          if (preselect) setRepoUrl(preselect);
        })
        .catch(() => setRepoLoading(false));
    }
  }, [checking, sessionUser]);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const pushLog = (level: LogLevel, msg: string, indent = 0) => {
    setLogs((prev) => [...prev, makeLog(level, msg, indent)]);
  };

  async function pollDeployment(jobId: string) {
    try {
      const res = await fetch(`/api/deploy/status/${jobId}`);
      const job = await res.json();

      // Update logs if new ones arrived
      if (job.logs) {
        setLogs(prev => {
          const existingCount = prev.filter(p => !p.message.includes("Initial")).length; // pseudo logic
          // Actually, job.logs has the full history usually. Let's just map it.
          const freshLogs = job.logs.map((l: any) => makeLog(l.type as LogLevel, l.message, 1));
          return [...prev.slice(0, 3), ...freshLogs]; // Keep first 3 init logs
        });
      }

      if (job.status === "done" || job.status === "error") {
        setLoading(false);
        if (job.status === "error") {
          pushLog("error", "Deployment failed. Generating error report...", 1);
          setActiveJobId(jobId);
          setJobError(job.error || "Unknown deployment error.");
          
          if (job.results?.error_report) {
            setErrorReport(job.results.error_report);
            pushLog("data", "Error report generated. You can now use 'Auto-Heal' to fix these issues.", 1);
          } else {
            pushLog("warn", "No detailed report generated. Repair will use standard logs.", 1);
          }
        } else {
          pushLog("success", "Deployment successful! No errors found.", 1);
        }
        return;
      }

      setTimeout(() => pollDeployment(jobId), 1500);
    } catch (err) {
      setLoading(false);
    }
  }

  async function handleDeepScan() {
    if (!repoUrl || loading) return;

    setLogs([]);
    setLoading(true);
    setAnalysis(null);
    setLastPR(null);
    setErrorReport(null);

    pushLog("section", "🐳 DEPLOYMENT AGENT (AGENT 2) INITIALIZED");
    pushLog("info", `Analyzing Repo: ${repoUrl}`, 1);
    pushLog("info", "Task: Generate Dockerfile, Compose, and Run...", 1);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Failed to start deployment agent");

      setActiveJobId(data.jobId);
      pushLog("success", `Deployment job started: ${data.jobId}`, 1);
      pollDeployment(data.jobId);

    } catch (err: any) {
      pushLog("error", `Error: ${err.message}`, 1);
      setLoading(false);
    }
  }

  async function handleAutoHeal() {
    if (!repoUrl || loading) return;
    if (!errorReport && !logsInput.trim() && !jobError) return;

    let currentLogs = logsInput;
    if (errorReport) {
      currentLogs = `Error Report from Deployment Agent:\n${errorReport}`;
    } else if (jobError) {
      currentLogs = `Deployment Failure Context:\n${jobError}`;
    }

    setLogs([]);
    setLoading(true);
    setAgentStatus("analyzing");

    pushLog("section", "🤖 PR AGENT (AGENT 1) INITIALIZED");
    pushLog("info", `Target Repo : ${repoUrl}`, 1);
    if (errorReport) pushLog("success", "Using Error Report from previous scan as context.", 1);
    pushLog("ai", "Thinking: Generating fix with Llama-3 Reasoning...", 1);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          repoUrl, 
          logs: currentLogs,
          errorReport: errorReport,
          jobId: activeJobId
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        pushLog("error", `Bridge Error: ${data.error || data.detail || "Agent worker failed."}`, 1);
        setLoading(false);
        return;
      }

      setAnalysis(data.analysis);
      setLastPR(data.pr);

      pushLog("success", "Analysis complete! Fix generated by Python worker. ✓", 1);
      if (data.pr) {
        pushLog("success", "Pull Request raised successfully! ✓", 1);
      }

    } catch (err) {
      pushLog("error", "Failed to connect to Python worker.", 1);
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "#0a0a0c" }}>
      <div style={{ position: "fixed", top: "-10%", right: "-10%", width: "40%", height: "40%", background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-10%", left: "-10%", width: "40%", height: "40%", background: "radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <main style={{ padding: "40px", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "30px", maxWidth: "1600px", margin: "0 auto", position: "relative" }}>
        
        <aside className="glass-card" style={{ padding: "30px", height: "fit-content", position: "sticky", top: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
            <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>AI Overdrive</h2>
          </div>
          
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "8px", opacity: 0.7 }}>Target Repository</label>
            <select 
              className="auth-input" 
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "white", padding: "12px", borderRadius: "10px" }}
              value={repos.some(r => r.html_url === repoUrl) ? repoUrl : repoUrl ? "custom" : ""}
              onChange={(e) => setRepoUrl(e.target.value === "custom" ? "" : e.target.value)}
            >
              <option value="" disabled>{repoLoading ? "Loading..." : "Select a repository"}</option>
              {repos.map(r => (
                <option key={r.id} value={r.html_url}>{r.full_name}</option>
              ))}
              <option value="custom">── Custom URL ──</option>
            </select>
            
            {(repoUrl === "" || !repos.some(r => r.html_url === repoUrl)) && (
              <input 
                className="auth-input" 
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "white", padding: "12px", borderRadius: "10px", marginTop: "12px" }}
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
              />
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
             <button className="btn-secondary" onClick={handleDeepScan} disabled={loading}>Deep Docker Scan</button>
             <button className="btn-primary" onClick={handleAutoHeal} disabled={loading || (!logsInput && !errorReport && !jobError)}>Launch Repair</button>
          </div>

          {!errorReport && (
            <div style={{ marginBottom: "30px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "8px", opacity: 0.7 }}>Manual Build Logs (Optional)</label>
              <textarea 
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "white", padding: "12px", borderRadius: "10px", minHeight: "150px", fontFamily: "monospace", fontSize: "0.8rem" }}
                value={logsInput}
                onChange={(e) => setLogsInput(e.target.value)}
                placeholder="Paste logs here OR run Deep Scan..."
              />
            </div>
          )}

          {errorReport && (
            <div style={{ marginBottom: "30px", padding: "15px", background: "rgba(248,113,113,0.03)", border: "1px solid rgba(248,113,113,0.1)", borderRadius: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "0.8rem", color: "#f87171", fontWeight: 600 }}>FAILED DEPLOYMENT REPORT</span>
                <button onClick={() => setErrorReport(null)} style={{ fontSize: "0.7rem", opacity: 0.5, background: "none", border: "none", color: "white", cursor: "pointer" }}>Clear</button>
              </div>
              <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>A build error was captured. Click <b>Launch Repair</b> to fix.</p>
            </div>
          )}

          {lastPR && (
            <div style={{ marginTop: "24px", padding: "20px", background: "rgba(52,211,153,0.1)", borderRadius: "16px", border: "1px solid rgba(52,211,153,0.2)" }}>
              <p style={{ color: "#34d399", fontWeight: 700, fontSize: "1rem" }}>✓ PR Created</p>
              <a href={lastPR.pr_url} target="_blank" className="btn-primary" style={{ display: "inline-block", marginTop: "12px", padding: "8px 16px", textDecoration: "none" }}>View on GitHub</a>
            </div>
          )}
        </aside>

        <section className="glass-card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399" }} />
            </div>
            <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>{loading ? "● LIVE STREAMING" : "SESSION IDLE"}</span>
          </div>

          <div ref={consoleRef} style={{ flex: 1, padding: "20px", overflowY: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
             {logs.length === 0 ? (
               <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.1 }}>
                 <p>Waiting for initialization...</p>
               </div>
             ) : (
               logs.map(log => {
                 const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
                 return (
                 <div key={log.id} style={{ display: "flex", gap: "16px", marginBottom: "6px", background: style.bg, padding: "4px 12px", borderRadius: "6px", marginLeft: (log.indent || 0) * 20 }}>
                   <span style={{ opacity: 0.25, fontSize: "0.7rem", width: "70px" }}>{log.ts}</span>
                   <span style={{ color: style.color, fontSize: "0.85rem" }}>{style.badge}{log.message}</span>
                 </div>
                 );
               })
             )}
          </div>
          
          {analysis && (
            <div style={{ padding: "24px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px" }}>{analysis.error_summary}</h3>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>{analysis.root_cause}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
