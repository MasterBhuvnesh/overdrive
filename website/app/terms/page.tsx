import Link from "next/link";

export default function Terms() {
  return (
    <div className="page-bg flex flex-1 justify-center px-5 py-16 sm:px-8 sm:py-24">
      <div className="gradient-bg" aria-hidden="true">
        <div className="gradient-orb gradient-orb--1" />
        <div className="gradient-orb gradient-orb--2" />
        <div className="gradient-orb gradient-orb--3" />
        <div className="gradient-orb gradient-orb--4" />
      </div>
      <div className="w-full max-w-xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300 sm:text-sm"
        >
          <span>&larr;</span> Back
        </Link>

        <h1 className="mb-2 text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
          Terms of Service
        </h1>
        <p className="mb-10 text-[11px] text-zinc-500 sm:text-xs">
          Last updated: April 25, 2026
        </p>

        <div className="space-y-8 text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">
          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Overdrive (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree, do not use the Service. We reserve the right to
              update these terms at any time, and continued use constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">2. Description of Service</h2>
            <p>
              Overdrive is a deployment and DevOps automation platform that provides zero-config
              containerization, intelligent CI/CD pipeline generation, self-healing debugging, and
              one-click production deployments for software applications.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">3. Accounts &amp; Access</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials.
              You must provide accurate information during registration and promptly update it if it
              changes. You are liable for all activity under your account.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-500">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
              <li>Attempt to gain unauthorized access to the Service or its related systems</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
              <li>Use the Service to deploy malicious software or conduct cyberattacks</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">5. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the Service are owned by Overdrive and are
              protected by copyright, trademark, and other intellectual property laws. You retain
              ownership of the code and content you deploy through the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">6. Service Availability</h2>
            <p>
              We strive for high availability but do not guarantee uninterrupted access. The Service
              may be temporarily unavailable due to maintenance, updates, or circumstances beyond our
              control. We are not liable for any downtime or data loss.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Overdrive shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of the
              Service, including but not limited to loss of data, revenue, or business opportunities.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">8. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at our discretion, with or
              without notice, for conduct that we believe violates these Terms or is harmful to
              other users or the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">9. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <span className="text-zinc-300">legal@overdrive.dev</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
