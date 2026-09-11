import logo from '../assets/logo.png'

export default function SiteFooter({ onNavigateLegal, onHome, onStartQuiz }) {
  function handleLegalClick(e, tab) {
    e.preventDefault()
    if (onNavigateLegal) {
      onNavigateLegal(tab)
    }
  }

  function handleHomeClick(e) {
    if (onHome) {
      e.preventDefault()
      onHome()
    }
  }

  function handleQuizClick(e) {
    if (onStartQuiz) {
      e.preventDefault()
      onStartQuiz()
    }
  }

  return (
    <footer className="border-t border-white/5 bg-slate-950/80 py-10 text-xs text-slate-500">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleHomeClick}
              className="flex items-center gap-2 text-left font-bold text-slate-300 transition hover:text-white"
            >
              <img
                src={logo}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full object-contain opacity-80"
              />
              <span className="text-sm">MajorScout</span>
            </button>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Data-driven major matching for college-bound students.
            </span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-slate-400">
            {onStartQuiz && (
              <button
                onClick={handleQuizClick}
                className="transition hover:text-sky-300"
              >
                Take the quiz
              </button>
            )}
            <a
              href="/privacy"
              onClick={(e) => handleLegalClick(e, 'privacy')}
              className="transition hover:text-sky-300"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              onClick={(e) => handleLegalClick(e, 'terms')}
              className="transition hover:text-sky-300"
            >
              Terms of Service
            </a>
            <a
              href="/disclaimer"
              onClick={(e) => handleLegalClick(e, 'disclaimer')}
              className="transition hover:text-sky-300"
            >
              Admissions Disclaimer
            </a>
            <a
              href="mailto:support@majorscout.com"
              className="transition hover:text-sky-300"
            >
              Contact
            </a>
          </nav>
        </div>

        {/* Muted Disclaimer & Copyright */}
        <div className="mt-6 border-t border-white/5 pt-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
          <p className="max-w-2xl text-[11px] leading-relaxed text-slate-600">
            MajorScout is an independent platform and is not affiliated with, endorsed by, or
            sponsored by any college, university, the College Board, or ACT, Inc. All trademarks are
            the property of their respective owners. Content is for educational exploration only and
            does not guarantee admission.
          </p>
          <p className="mt-3 text-[11px] text-slate-600 sm:mt-0">
            &copy; {new Date().getFullYear()} MajorScout. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
