import { useEffect, useState } from 'react'
import SiteHeader from '../components/SiteHeader.jsx'
import SiteFooter from '../components/SiteFooter.jsx'

export default function Legal({
  user,
  initialTab = 'privacy',
  onRefreshUser,
  onHome,
  onStartQuiz,
  onNavigateLegal,
}) {
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (onNavigateLegal) {
      onNavigateLegal(tab)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-200">
      <SiteHeader
        user={user}
        onHome={onHome}
        onRefreshUser={onRefreshUser}
        rightSlot={
          <button
            onClick={onStartQuiz}
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white"
          >
            Take the quiz
          </button>
        }
      />

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-8 sm:pt-12">
        {/* Breadcrumb / Back button */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-sky-300"
          >
            <span aria-hidden="true">&larr;</span> Back to Home
          </button>
          <span className="text-xs font-medium text-slate-500">
            Last Updated: September 2026
          </span>
        </div>

        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Legal & Compliance
        </h1>
        <p className="mt-2 text-base text-slate-400">
          Transparency and trust are fundamental to MajorScout. Below are our Privacy Policy,
          Terms of Service, and Admissions Disclaimers.
        </p>

        {/* Tab Navigation */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => handleTabChange('privacy')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'privacy'
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/50'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => handleTabChange('terms')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'terms'
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/50'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            Terms of Service
          </button>
          <button
            onClick={() => handleTabChange('disclaimer')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'disclaimer'
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/50'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            Admissions & AI Disclaimers
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'privacy' && <PrivacyPolicy />}
          {activeTab === 'terms' && <TermsOfService />}
          {activeTab === 'disclaimer' && <AdmissionsDisclaimer />}
        </div>
      </main>

      <SiteFooter onNavigateLegal={handleTabChange} onHome={onHome} />
    </div>
  )
}

function PrivacyPolicy() {
  return (
    <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-300">
      <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4 text-xs text-sky-200">
        <p className="font-semibold text-sky-300">Privacy Summary</p>
        <p className="mt-1 text-slate-300">
          MajorScout uses your quiz responses and optional profile information solely to provide
          personalized college major matches and essay guidance. We do not sell your personal data to
          third-party advertisers or data brokers. Payments are handled securely through Stripe,
          and authentication is handled via Google OAuth.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-bold text-white">1. Introduction</h2>
        <p className="mt-2 text-slate-300">
          MajorScout (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) respects your privacy and is committed
          to protecting personal data. This Privacy Policy outlines what information we collect when you visit
          our website (majorscout.com), take our major-matching quiz, create an account, or unlock premium insights,
          and how that information is used, safeguarded, and shared.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">2. Information We Collect</h2>
        <p className="mt-2 text-slate-300">
          We collect information directly from you when you interact with our platform:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-slate-300">
          <li>
            <strong className="text-white">Account Information:</strong> When you sign in using Google OAuth,
            we receive your name, email address, profile photo URL, and unique Google account identifier. We do not
            receive or store your Google password.
          </li>
          <li>
            <strong className="text-white">Quiz & Profile Responses:</strong> When you take the quiz, you provide
            academic indicators (such as GPA, SAT/ACT scores), extracurricular activities, subject interests,
            work preferences, and answers to multiple-choice and written follow-up questions.
          </li>
          <li>
            <strong className="text-white">Payment Information:</strong> Paid unlocks are processed directly by
            our payment processor, <strong className="text-white">Stripe</strong>. MajorScout does not collect,
            store, or process your credit card numbers or banking details. We receive only transaction identifiers,
            timestamp, and payment status from Stripe.
          </li>
          <li>
            <strong className="text-white">Usage & Device Data:</strong> Like most web applications, our servers
            automatically log standard technical data such as your IP address, browser type, device information,
            operating system, and timestamps to ensure security, detect abuse, and debug service errors.
          </li>
          <li>
            <strong className="text-white">Cookies:</strong> We use essential, HTTP-only session cookies to
            maintain your logged-in session securely. We do not deploy third-party cross-site advertising cookies.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">3. How We Use Your Information</h2>
        <p className="mt-2 text-slate-300">
          We process collected information for the following legitimate purposes:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-slate-300">
          <li>To match your academic profile, stats, and interests with college programs in our database.</li>
          <li>To securely save and restore your past quiz attempts and unlocked results across sessions.</li>
          <li>To provide personalized AI-assisted follow-up questions and essay guidance grounded in your answers.</li>
          <li>To process one-time unlock transactions and maintain purchase records.</li>
          <li>To safeguard our platform against fraud, automated scraping, and unauthorized access.</li>
          <li>To respond to user support inquiries and feedback.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">4. Third-Party Service Providers & Subprocessors</h2>
        <p className="mt-2 text-slate-300">
          We only share data with trusted third parties strictly necessary to operate the service:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-slate-300">
          <li>
            <strong className="text-white">Google Identity Services (OAuth):</strong> For secure single sign-on
            authentication.
          </li>
          <li>
            <strong className="text-white">Stripe:</strong> For PCI-compliant payment checkout and billing
            reconciliation.
          </li>
          <li>
            <strong className="text-white">OpenAI:</strong> To generate contextual follow-up questions and
            admissions essay guidance. Prompt queries sent to OpenAI include quiz responses and matched school names.
            In accordance with OpenAI&rsquo;s API data usage policies, data sent through their API is not used to train
            their models.
          </li>
          <li>
            <strong className="text-white">Database & Hosting Providers:</strong> For encrypted database storage
            (Turso / libSQL) and secure application hosting (Railway).
          </li>
        </ul>
        <p className="mt-3 text-slate-300 font-medium">
          We do not sell, rent, license, or monetize your personal information to third-party data brokers or marketing networks.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">5. Children&rsquo;s Privacy (COPPA Compliance)</h2>
        <p className="mt-2 text-slate-300">
          MajorScout is designed for high school and college students, parents, and educators. Our service is not
          directed to children under the age of 13. We do not knowingly collect or maintain personal information
          from children under 13. If you believe a child under 13 has submitted personal information to our site,
          please contact us immediately at{' '}
          <a href="mailto:support@majorscout.com" className="text-sky-400 underline hover:text-sky-300">
            support@majorscout.com
          </a>
          , and we will promptly delete such information.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">6. Data Retention & Security</h2>
        <p className="mt-2 text-slate-300">
          We retain your account details and quiz attempts as long as your account remains active so you can revisit
          your results. We employ industry-standard administrative, physical, and technical safeguards (including
          HTTPS encryption in transit and encrypted database storage) to protect your personal data.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">7. Your Rights & Choices</h2>
        <p className="mt-2 text-slate-300">
          Depending on your jurisdiction (e.g., California CCPA/CPRA, European GDPR), you may have the following rights:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-slate-300">
          <li>The right to know what personal data we have collected about you and obtain a copy.</li>
          <li>The right to request deletion of your account and all associated quiz attempts.</li>
          <li>The right to request correction of inaccurate personal data.</li>
          <li>The right to opt-out of optional marketing communications (if any).</li>
        </ul>
        <p className="mt-3 text-slate-300">
          To exercise any of these rights, email us at{' '}
          <a href="mailto:support@majorscout.com" className="text-sky-400 underline hover:text-sky-300">
            support@majorscout.com
          </a>
          . We will verify and process your request in accordance with applicable laws without discrimination.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">8. Changes to This Policy</h2>
        <p className="mt-2 text-slate-300">
          We may update this Privacy Policy from time to time. When changes are made, we will revise the
          &ldquo;Last Updated&rdquo; date at the top of this page. Continued use of MajorScout after changes are posted
          constitutes acceptance of the revised policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">9. Contact Us</h2>
        <p className="mt-2 text-slate-300">
          For any privacy questions or data deletion requests, please contact:{' '}
          <a href="mailto:support@majorscout.com" className="text-sky-400 underline hover:text-sky-300">
            support@majorscout.com
          </a>
        </p>
      </section>
    </article>
  )
}

function TermsOfService() {
  return (
    <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-300">
      <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4 text-xs text-violet-200">
        <p className="font-semibold text-violet-300">Terms Summary</p>
        <p className="mt-1 text-slate-300">
          By using MajorScout, you agree to these Terms. MajorScout is an exploratory, informational tool designed
          to help students discover academic majors. MajorScout is not an admissions agency and does not guarantee
          acceptance to any college. One-time unlock purchases grant digital access to detailed result rankings and
          AI essay tips.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-bold text-white">1. Acceptance of Terms</h2>
        <p className="mt-2 text-slate-300">
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of MajorScout (&ldquo;the Service&rdquo;).
          By accessing the website, taking the quiz, creating an account, or purchasing an unlock, you agree to be
          bound by these Terms. If you do not agree, do not use the Service.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">2. Educational & Exploratory Nature of Service</h2>
        <p className="mt-2 text-slate-300">
          MajorScout provides algorithmic matching and AI-assisted admissions guidance based on publicly reported
          admissions statistics, academic program data, and user-provided inputs. The Service is intended exclusively
          for educational and informational exploration.
        </p>
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200">
          <p className="font-bold">No Guarantee of Admission</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-300/90">
            MajorScout is not an accredited educational institution, admissions office, college counselor, or financial
            aid advisor. We make no representations, warranties, or guarantees that using MajorScout or following
            its essay tips will result in admission, acceptance, scholarship awards, or honors at any college,
            university, or degree program.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">3. Non-Affiliation & Trademarks</h2>
        <p className="mt-2 text-slate-300">
          MajorScout is an independent private platform. MajorScout is not affiliated with, endorsed by, sponsored by,
          or associated with any university, college, institution, or testing organization, including but not limited
          to Harvard University, Stanford University, MIT, University of Pennsylvania, the College Board (SAT),
          or ACT, Inc. All university names, institution marks, test designations, and logos cited on this website
          are trademarks of their respective holders and are used solely for identification and nominative reference.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">4. AI-Generated Content Notice</h2>
        <p className="mt-2 text-slate-300">
          Portions of the Service, including dynamic follow-up questions and essay approach suggestions, are generated
          using artificial intelligence models (such as OpenAI GPT models). While we strive for high quality,
          AI-generated outputs may occasionally be incomplete, inaccurate, or outdated. Students are solely
          responsible for writing their own original application essays, independently verifying university-specific
          application prompts, and ensuring compliance with the honor codes and policies of target universities.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">5. Accounts and Security</h2>
        <p className="mt-2 text-slate-300">
          You may access basic quiz results without an account. To save your quiz history and unlock full results,
          you must authenticate via Google OAuth. You are responsible for maintaining the confidentiality of your
          Google credentials and for all activities that occur under your account.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">6. Fees, Unlocks, and Refunds</h2>
        <p className="mt-2 text-slate-300">
          The core quiz and a preview of program matches are provided free of charge. Users may optionally purchase
          a one-time digital unlock for a specific quiz attempt to view their #1 match, full rankings, and detailed
          essay guidance.
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-slate-300">
          <li>
            <strong className="text-white">Immediate Digital Delivery:</strong> Unlocked results and essay guidance
            are made accessible in your account immediately upon successful payment confirmation.
          </li>
          <li>
            <strong className="text-white">Payment Processing:</strong> Payments are billed through Stripe. You agree
            to provide accurate and valid payment information.
          </li>
          <li>
            <strong className="text-white">Refund Policy:</strong> Because unlocked results are delivered immediately
            as digital content, unlock fees are generally non-refundable once unlocked. If you experience technical
            difficulties or an error processing your unlock, please reach out to{' '}
            <a href="mailto:support@majorscout.com" className="text-sky-400 underline hover:text-sky-300">
              support@majorscout.com
            </a>{' '}
            within 14 days and we will review your request.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">7. User Conduct & Restrictions</h2>
        <p className="mt-2 text-slate-300">
          When using MajorScout, you agree not to:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-slate-300">
          <li>Use any automated spider, bot, scraper, or script to extract data, questions, or rankings from the site.</li>
          <li>Reverse engineer, decompile, or disassemble any part of the matching algorithm or backend service.</li>
          <li>Circumvent or attempt to circumvent authentication, billing checks, or payment gateways.</li>
          <li>Use the platform for any unlawful, harassing, or fraudulent purpose.</li>
          <li>Resell, sublicense, or redistribute our proprietary program database or essay guidance.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">8. Intellectual Property</h2>
        <p className="mt-2 text-slate-300">
          The MajorScout website, brand, logos, matching algorithms, question banks, curated datasets, and software
          are the intellectual property of MajorScout and are protected by applicable copyright, trademark, and trade
          secret laws. All rights not expressly granted herein are reserved.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">9. Disclaimer of Warranties</h2>
        <p className="mt-2 text-slate-300">
          THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES
          OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
          TIMELY, SECURE, OR ERROR-FREE.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">10. Limitation of Liability</h2>
        <p className="mt-2 text-slate-300">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL MAJORSCOUT, ITS FOUNDERS, DIRECTORS, OR
          AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY
          LOSS OF PROFITS, DATA, USE, OR ADMISSIONS OUTCOMES, ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR
          USE OF THE SERVICE. OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO MAJORSCOUT IN
          THE PRECEDING TWELVE MONTHS.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">11. Governing Law & Dispute Resolution</h2>
        <p className="mt-2 text-slate-300">
          These Terms shall be governed by and construed in accordance with the laws of the United States and the
          State of California, without regard to its conflict of law principles. Any dispute arising under these
          Terms shall be resolved in the state or federal courts located within California.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">12. Contact Information</h2>
        <p className="mt-2 text-slate-300">
          If you have questions regarding these Terms of Service, please contact us at:{' '}
          <a href="mailto:support@majorscout.com" className="text-sky-400 underline hover:text-sky-300">
            support@majorscout.com
          </a>
        </p>
      </section>
    </article>
  )
}

function AdmissionsDisclaimer() {
  return (
    <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-300">
      <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4 text-xs text-sky-200">
        <p className="font-semibold text-sky-300">Admissions & Data Disclaimer Summary</p>
        <p className="mt-1 text-slate-300">
          MajorScout is an independent academic exploration platform. Our program rankings and admissions match
          percentages are algorithmic estimations designed to help students discover majors that fit their interests
          and academic profile. They do not constitute official admissions decisions or guarantees.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-bold text-white">1. Not an Admissions Office or Counseling Agency</h2>
        <p className="mt-2 text-slate-300">
          MajorScout provides data synthesis, major matching, and essay brainstorming guides. We are not an admissions
          office, college, university, or certified secondary school counselor. Use of our platform does not guarantee
          acceptance, interview offers, enrollment, or financial aid awards at any higher education institution.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">2. Estimation Methodology & Data Accuracy</h2>
        <p className="mt-2 text-slate-300">
          Our match percentages and program classifications are generated from our dataset of university curricula,
          departmental rankings, acceptance figures, and user-submitted inputs. While we endeavor to curate accurate
          and current data, college admissions criteria, course offerings, and program availability change frequently.
          Students and parents should always check official university admissions websites and consult their high
          school college counseling offices for official requirements.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">3. Non-Affiliation Notice</h2>
        <p className="mt-2 text-slate-300">
          All university and college names mentioned on MajorScout (including, but not limited to, Harvard, Stanford,
          MIT, University of Chicago, Brown, Princeton, Columbia, etc.) are registered trademarks of their respective
          institutions. MajorScout is completely independent and is not endorsed by, sponsored by, or affiliated with
          any of these colleges or universities.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">4. AI Guidance & Student Authorship</h2>
        <p className="mt-2 text-slate-300">
          Our essay coaches and guidance hooks are powered by artificial intelligence designed to stimulate
          brainstorming and suggest unique angles. MajorScout strongly discourages submitting AI-generated prose
          as your own admissions essay. Admissions committees prioritize personal voice, honesty, and authenticity.
          Students are solely responsible for writing their own essays and complying with all academic integrity and
          application rules.
        </p>
      </section>
    </article>
  )
}
