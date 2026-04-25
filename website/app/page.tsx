"use client";

import { useState } from "react";

const features = [
  {
    title: "Zero-Config Deployments",
    desc: "Push your repo — Overdrive detects your stack and generates optimized containers automatically.",
  },
  {
    title: "Intelligent CI/CD",
    desc: "Pipelines that configure themselves. Build, test, and ship without writing a single workflow file.",
  },
  {
    title: "Self-Healing Debugging",
    desc: "Runtime errors get diagnosed automatically with fix PRs and actionable insights sent to your team.",
  },
  {
    title: "One-Click to Production",
    desc: "Go from commit to live in seconds. Built for developer speed, not operational overhead.",
  },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showFeatures, setShowFeatures] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setMessage(data.message);
      setSubmitted(true);
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-bg flex flex-1 items-center justify-center px-5 py-12 sm:px-8 sm:py-16">
      <div className="gradient-bg" aria-hidden="true">
        <div className="gradient-orb gradient-orb--1" />
        <div className="gradient-orb gradient-orb--2" />
        <div className="gradient-orb gradient-orb--3" />
        <div className="gradient-orb gradient-orb--4" />
      </div>
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <img
          src="/icon.ico"
          alt="Overdrive"
          className="mb-6 h-12 w-12 sm:mb-8 sm:h-14 sm:w-14"
        />

        <h1 className="mb-2 text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl lg:text-3xl">
          Join the Waitlist
        </h1>
        <p className="mb-8 text-xs text-zinc-400 sm:mb-10 sm:text-sm">
          Be the first to know when we launch.{" "}
          <span className="text-zinc-200">Get early access.</span>
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:gap-4">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-white/[0.08] bg-transparent px-4 text-xs text-zinc-200 placeholder-zinc-500 outline-none transition-colors focus:border-white/20 sm:h-11 sm:text-sm"
            />
            {message && !submitted && (
              <p className="text-[11px] text-red-400">{message}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-lg bg-white text-xs font-medium text-black transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-50 sm:h-11 sm:text-sm"
            >
              {loading ? "Joining..." : "Join Waitlist"}
            </button>
          </form>
        ) : (
          <div className="flex w-full flex-col items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-6 sm:px-6 sm:py-8">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="#22c55e" strokeWidth="1.5" />
              <path d="M10 16.5L14 20.5L22 12.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-medium text-zinc-100 sm:text-base">{message}</p>
            <p className="text-[11px] text-zinc-400 sm:text-xs">
              We&apos;ll reach out to <span className="text-zinc-200">{email}</span> when it&apos;s time.
            </p>
          </div>
        )}

        <div className="my-6 flex w-full items-center gap-4 sm:my-8">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-xs text-zinc-500">or</span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="h-10 w-full rounded-lg border border-white/[0.08] bg-transparent text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.04] sm:h-11 sm:text-sm"
        >
          {showFeatures ? "Hide details" : "Learn more about Overdrive"}
        </button>

        {showFeatures && (
          <div className="mt-6 grid w-full gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-left"
              >
                <p className="mb-1 text-xs font-medium text-zinc-200">{f.title}</p>
                <p className="text-[11px] leading-4 text-zinc-500">{f.desc}</p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 max-w-xs text-[10px] leading-4 text-zinc-500 sm:mt-10 sm:text-[11px] sm:leading-5">
          By joining, you acknowledge that you read, and agree, to our{" "}
          <a href="/terms" className="underline underline-offset-2 hover:text-zinc-300">
            Terms of Service
          </a>{" "}
          and our{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-zinc-300">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
