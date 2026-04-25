import Link from "next/link";

export default function Privacy() {
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
          Privacy Policy
        </h1>
        <p className="mb-10 text-[11px] text-zinc-500 sm:text-xs">
          Last updated: April 25, 2026
        </p>

        <div className="space-y-8 text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">
          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">1. Information We Collect</h2>
            <p className="mb-3">We collect information that you provide directly to us:</p>
            <ul className="list-inside list-disc space-y-1 text-zinc-500">
              <li>Account information (name, email address)</li>
              <li>GitHub repository data you connect to the Service</li>
              <li>Deployment configurations and logs</li>
              <li>Usage data and analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">2. How We Use Your Information</h2>
            <p className="mb-3">We use collected information to:</p>
            <ul className="list-inside list-disc space-y-1 text-zinc-500">
              <li>Provide, maintain, and improve the Service</li>
              <li>Generate optimized deployment configurations for your applications</li>
              <li>Diagnose issues and generate automated fix suggestions</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">3. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data. All data is
              encrypted in transit and at rest. Access to your repository data is scoped to the
              minimum permissions required to provide the Service. We never store your source code
              beyond what is needed for active deployments.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">4. Third-Party Services</h2>
            <p>
              The Service integrates with third-party platforms such as GitHub and cloud
              infrastructure providers. Your use of these integrations is subject to their
              respective privacy policies. We only share the minimum data necessary for these
              integrations to function.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">5. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide the
              Service. Deployment logs are retained for 90 days. You may request deletion of your
              data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">6. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-inside list-disc space-y-1 text-zinc-500">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate personal data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to processing of your personal data</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">7. Cookies</h2>
            <p>
              We use essential cookies to maintain your session and preferences. We do not use
              third-party advertising cookies. Analytics cookies are only used with your consent to
              help us understand how the Service is used.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new policy on this page and updating the &quot;Last
              updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-zinc-200 sm:text-sm">9. Contact</h2>
            <p>
              For questions about this Privacy Policy, contact us at{" "}
              <span className="text-zinc-300">privacy@overdrive.dev</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
