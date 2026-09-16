/**
 * MajorScout Client Telemetry & User Activity Tracker
 *
 * Tracks user sessions, active duration on site, quiz milestone progress,
 * and account creation events without blocking UI interactions.
 */

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}

function getVisitorId() {
  try {
    let vid = localStorage.getItem('ms_visitor_id')
    if (!vid) {
      vid = generateId('vis')
      localStorage.setItem('ms_visitor_id', vid)
    }
    return vid
  } catch {
    return generateId('vis_tmp')
  }
}

function getSessionId() {
  try {
    let sid = sessionStorage.getItem('ms_session_id')
    if (!sid) {
      sid = generateId('ses')
      sessionStorage.setItem('ms_session_id', sid)
    }
    return sid
  } catch {
    return generateId('ses_tmp')
  }
}

class Tracker {
  constructor() {
    this.visitorId = getVisitorId()
    this.sessionId = getSessionId()
    this.currentPage = window.location.pathname || '/'
    this.maxQuizStep = 0
    this.quizCompleted = false
    this.lastActivityTime = Date.now()
    this.heartbeatInterval = null
    this.activeSecondsBucket = 0
    this.isInitialized = false
    this.idleTimeoutMs = 60000 // 1 minute idle cutoff
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return
    this.isInitialized = true

    // Activity listeners
    const onUserActivity = () => {
      this.lastActivityTime = Date.now()
    }
    window.addEventListener('mousemove', onUserActivity, { passive: true })
    window.addEventListener('keydown', onUserActivity, { passive: true })
    window.addEventListener('click', onUserActivity, { passive: true })
    window.addEventListener('scroll', onUserActivity, { passive: true })
    window.addEventListener('touchstart', onUserActivity, { passive: true })

    // Heartbeat every 20 seconds
    const HEARTBEAT_INTERVAL_MS = 20000
    this.heartbeatInterval = setInterval(() => {
      const isVisible = document.visibilityState === 'visible'
      const isRecent = Date.now() - this.lastActivityTime < this.idleTimeoutMs
      if (isVisible && isRecent) {
        this.sendHeartbeat(HEARTBEAT_INTERVAL_MS / 1000)
      }
    }, HEARTBEAT_INTERVAL_MS)

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      if (this.activeSecondsBucket > 0) {
        this.sendHeartbeat(this.activeSecondsBucket, true)
      }
    })
  }

  async sendEvent(eventType, properties = {}) {
    const payload = {
      session_id: this.sessionId,
      visitor_id: this.visitorId,
      event_type: eventType,
      page: this.currentPage,
      properties: properties || {},
    }

    try {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
        keepalive: true,
      }).catch(() => {})
    } catch {
      // Ignore network errors
    }
  }

  async sendHeartbeat(deltaSeconds, isSync = false) {
    const payload = {
      session_id: this.sessionId,
      visitor_id: this.visitorId,
      delta_seconds: Math.round(deltaSeconds),
      page: this.currentPage,
      max_quiz_step: this.maxQuizStep,
      quiz_completed: this.quizCompleted,
    }

    try {
      if (isSync && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
        navigator.sendBeacon('/api/analytics/heartbeat', blob)
      } else {
        fetch('/api/analytics/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
          keepalive: true,
        }).catch(() => {})
      }
    } catch {
      // Ignore network errors
    }
  }

  trackPageView(page, title = '') {
    this.currentPage = page || window.location.pathname || '/'
    this.sendEvent('page_view', { title, url: window.location.href })
  }

  trackQuizStart(totalQuestions = 15, sectionId = null) {
    if (this.maxQuizStep < 1) {
      this.maxQuizStep = 1
    }
    this.sendEvent('quiz_start', {
      total_questions: totalQuestions,
      section: sectionId,
    })
  }

  trackQuizStep(stepIndex, totalQuestions, questionId = null, section = null) {
    const stepNumber = stepIndex + 1
    if (stepNumber > this.maxQuizStep) {
      this.maxQuizStep = stepNumber
    }
    this.sendEvent('quiz_step', {
      step: stepNumber,
      total_questions: totalQuestions,
      question_id: questionId,
      section,
    })
  }

  trackQuizComplete(meta = {}) {
    this.quizCompleted = true
    this.sendEvent('quiz_complete', {
      ...meta,
      max_step: this.maxQuizStep,
    })
  }

  trackAccountCreated(method = 'google') {
    this.sendEvent('account_created', { method })
  }

  trackLogin(method = 'google') {
    this.sendEvent('login', { method })
  }

  trackUpgradeClick(plan = 'pro', location = 'banner') {
    this.sendEvent('upgrade_click', { plan, location })
  }
}

export const tracker = new Tracker()
