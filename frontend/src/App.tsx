import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, CheckCheck, Eye, EyeOff, Github, Info, KeyRound, LogOut, MapPin, Navigation, PenLine, ScanLine, ShieldCheck, UserPlus } from 'lucide-react'
import { api } from './api/client'
import { ActionPad } from './components/ActionPad'
import { SceneBoard } from './components/SceneBoard'
import type { AttemptResponse, EnrollmentResponse, Mode, Stage } from './types'

type View = 'home' | 'how' | 'practice' | 'consent' | 'privacy' | 'enroll' | 'study' | 'login' | 'password' | 'workspace'
type StudyState = { condition: 'password' | 'direct' | 'shielded' | 'complete'; phase: 'practice' | 'measured' | 'workload' | 'retention' | 'complete'; period: number; trialNumber: number; practiceSuccesses: number; retentionPeriod: number; retentionReady: boolean; retentionDueAt?: string; complete: boolean }

const PATHS: Record<View, string> = {
  home: '/',
  how: '/how-it-works',
  practice: '/practice',
  consent: '/research/consent',
  privacy: '/privacy',
  enroll: '/research/enroll',
  study: '/research/session',
  login: '/sign-in',
  password: '/sign-in/password',
  workspace: '/workspace',
}

const viewFromPath = (path: string): View => {
  const entry = Object.entries(PATHS).find(([, value]) => value === path.replace(/\/+$/, '') || (path === '/' && value === '/'))
  return (entry?.[0] as View | undefined) ?? 'home'
}

const HERO_SCENES = [
  { asset: '/scenes/2001.webp', label: 'Scene 1' },
  { asset: '/scenes/2002.webp', label: 'Scene 2' },
  { asset: '/scenes/2003.webp', label: 'Scene 3' },
  { asset: '/scenes/2004.webp', label: 'Scene 4' },
  { asset: '/scenes/2005.webp', label: 'Scene 5' },
]

export function App() {
  const [view, setView] = useState<View>(() => viewFromPath(window.location.pathname))
  const [handle, setHandle] = useState('')
  const [mode, setMode] = useState<Mode>('direct')
  const [me, setMe] = useState<string | null>(null)
  const [pack, setPack] = useState<{ mode: string; sceneCount: number; recruitmentEnabled: boolean } | null>(null)
  const [privacyReturn, setPrivacyReturn] = useState<View>('home')

  useEffect(() => {
    const syncRoute = () => setView(viewFromPath(window.location.pathname))
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])
  useEffect(() => { api.get<{ handle: string; studyRequired: boolean }>('/api/me').then(r => {
    setMe(r.handle); setHandle(r.handle)
    if (['/', '/sign-in', '/sign-in/password'].includes(window.location.pathname)) {
      const next = r.studyRequired ? 'study' : 'workspace'
      window.history.replaceState({}, '', PATHS[next])
      setView(next)
    }
  }).catch(() => undefined) }, [])
  useEffect(() => { api.get<{ mode: string; sceneCount: number; recruitmentEnabled: boolean }>('/api/pack/status').then(setPack).catch(() => undefined) }, [])

  const go = (next: View, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', PATHS[next])
    setView(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  if (view === 'how') return <HowItWorks go={go} recruitmentEnabled={pack?.recruitmentEnabled} packMode={pack?.mode} />
  if (view === 'practice') return <Practice onDone={() => go('home')} />
  if (view === 'consent') return <Consent onAccept={() => go('enroll')} onCancel={() => go('home')} onPrivacy={() => { setPrivacyReturn('consent'); go('privacy') }} />
  if (view === 'privacy') return <PrivacyNotice onBack={() => go(privacyReturn)} />
  if (view === 'enroll') return <Enrollment onDone={newHandle => { setHandle(newHandle); go('study') }} onCancel={() => go('home')} />
  if (view === 'study') return <StudyFlow handle={handle} onExit={() => go('home')} />
  if (view === 'login') return <GraphicalLogin handle={handle} setHandle={setHandle} mode={mode} setMode={setMode}
    onDone={() => { setMe(handle); go('workspace') }} onPassword={() => go('password')} onCancel={() => go('home')} />
  if (view === 'password') return <PasswordLogin handle={handle} setHandle={setHandle}
    onDone={() => { setMe(handle); go('workspace') }} onBack={() => go('login')} />
  if (view === 'workspace') return <Workspace handle={me ?? handle} onLogout={async () => { await api.delete('/api/session'); setMe(null); go('home') }} onDeleted={() => { setMe(null); setHandle(''); go('home') }} />

  return <main className="landing">
    <SiteHeader current="home" go={go} recruitmentEnabled={pack?.recruitmentEnabled} />
    <div className="research-alert" role="note"><AlertTriangle size={20} /><strong>Research prototype</strong><span>Never reuse a real password here.</span></div>
    <section className="hero">
      <div className="hero-copy">
        <h1>Remember a route.<br />Prove it visually.</h1>
        <span className="hero-rule" aria-hidden="true" />
        <div className="eyebrow hero-subtitle">A five-scene authentication study</div>
        <p>You’ll see five real-world scenes. For each one, remember a location and direction. Verification happens only after the complete chain.</p>
        <button className="primary hero-cta" onClick={() => go('practice')}>Explore the practice flow <ArrowRight size={19} /></button>
      </div>
      <div className="scene-journey" aria-label="Five scene authentication journey">
        {HERO_SCENES.map((scene, index) => <article className="journey-step" key={scene.asset}>
          <span className="step-number">{index + 1}</span>
          <img src={scene.asset} alt={`Real-world photograph used as ${scene.label.toLowerCase()}`} />
          <div><strong>{scene.label}</strong><span>Where are you?</span><span>Which direction?</span></div>
          <ArrowRight className="step-arrow" aria-hidden="true" />
        </article>)}
      </div>
    </section>
    <nav className="route-directory" aria-label="Explore SceneChain">
      <button onClick={() => go('practice')}><PenLine /><span><strong>Practice</strong><small>Explore the complete five-scene flow at your own pace.</small></span><ArrowRight /></button>
      <button onClick={() => go('consent')} disabled={!pack?.recruitmentEnabled}><UserPlus /><span><strong>Enrollment</strong><small>Learn about the study and see if participation is open.</small></span><ArrowRight /></button>
      <button onClick={() => go('login')}><ShieldCheck /><span><strong>Authentication</strong><small>Sign in and complete your five-scene chain.</small></span><ArrowRight /></button>
      <button onClick={() => { setPrivacyReturn('home'); go('privacy') }}><Info /><span><strong>Participant information</strong><small>Privacy, data handling, and your rights as a participant.</small></span><ArrowRight /></button>
    </nav>
    <SiteFooter packMode={pack?.mode} />
  </main>
}

function SiteFooter({ packMode }: { packMode?: string }) {
  return <footer className="landing-footer">
      <a className="footer-brand" href="https://elfeel.me" target="_blank" rel="noreferrer" aria-label="Open elfeel.me">
        <img className="footer-elephant" src="/assets/brand/elephant-logo.png" alt="" />
      </a>
      <div className="footer-copy">
        <span>© Mahmoud elfeel 2026</span>
        <small>
          Verified only after the complete chain.{' '}
          {packMode === 'formal' ? 'Approved CC0 research scene pack loaded.' : 'Research services are currently unavailable.'}
        </small>
      </div>
      <a
        className="footer-github"
        href="https://github.com/elephancy/SceneChain"
        target="_blank"
        rel="noreferrer"
        aria-label="Open SceneChain GitHub repository"
      >
        <Github aria-hidden="true" />
      </a>
    </footer>
}

function HowItWorks({ go, recruitmentEnabled, packMode }: { go: (view: View) => void; recruitmentEnabled?: boolean; packMode?: string }) {
  return <main className="landing how-page">
    <SiteHeader current="how" go={go} recruitmentEnabled={recruitmentEnabled} />
    <section className="how-intro">
      <span className="eyebrow">How it works</span>
      <h1>A visual route instead of one typed secret.</h1>
      <p>SceneChain asks you to remember one location and one direction in each of five real-world scenes. The complete route is checked only after the final scene.</p>
    </section>
    <section className="how-steps" aria-label="SceneChain demonstration">
      <article className="how-step">
        <div className="how-demo">
          <img src="/scenes/2001.webp" alt="A real-world street scene divided into selectable locations" />
          <span className="demo-grid" aria-hidden="true" />
          <span className="demo-pin" aria-hidden="true"><MapPin /></span>
        </div>
        <div className="how-step-copy"><span>01</span><h2>Choose a location</h2><p>Select a memorable place in the scene, such as a doorway, sign, or corner.</p></div>
      </article>
      <article className="how-step">
        <div className="how-demo">
          <img src="/scenes/2003.webp" alt="A real-world street scene with a direction selection demonstration" />
          <span className="demo-direction" aria-hidden="true"><Navigation /><strong>East</strong></span>
        </div>
        <div className="how-step-copy"><span>02</span><h2>Add a direction</h2><p>Pair that location with one of four cardinal directions to create the scene step.</p></div>
      </article>
      <article className="how-step">
        <div className="how-demo demo-chain">
          {[2002, 2004, 2005].map((scene, index) => <span key={scene}>
            <img src={`/scenes/${scene}.webp`} alt={`Real-world example for route scene ${index + 3}`} />
            <i>{index + 3}</i>
          </span>)}
          <CheckCheck aria-hidden="true" />
        </div>
        <div className="how-step-copy"><span>03</span><h2>Complete all five</h2><p>Repeat the same idea across five scenes. Nothing is accepted or rejected until the chain is complete.</p></div>
      </article>
    </section>
    <section className="how-cta">
      <div><span className="eyebrow">Try it safely</span><h2>The practice route is local and not recorded.</h2></div>
      <button className="primary" onClick={() => go('practice')}>Start practice <ArrowRight size={18} /></button>
    </section>
    <SiteFooter packMode={packMode} />
  </main>
}

function SiteHeader({ current, go, recruitmentEnabled }: { current: View; go: (view: View) => void; recruitmentEnabled?: boolean }) {
  return <header className="site-header">
    <button className="brand brand-button" onClick={() => go('home')} aria-label="SceneChain home"><span className="brand-mark"><ScanLine size={23} /></span><span>SceneChain</span></button>
    <nav aria-label="Primary navigation">
      <button className={current === 'home' ? 'active' : ''} onClick={() => go('home')}>Overview</button>
      <button className={current === 'how' ? 'active' : ''} onClick={() => go('how')}>How it works</button>
      <button className={current === 'practice' ? 'active' : ''} onClick={() => go('practice')}>Practice</button>
      <button className={current === 'privacy' ? 'active' : ''} onClick={() => go('privacy')}>Privacy</button>
    </nav>
    <div className="header-actions"><button className="secondary" onClick={() => go('login')}>Sign in</button><button className="primary" disabled={!recruitmentEnabled} onClick={() => go('consent')}>Join study <ArrowRight size={18} /></button></div>
  </header>
}

function Consent({ onAccept, onCancel, onPrivacy }: { onAccept: () => void; onCancel: () => void; onPrivacy: () => void }) {
  const [checks, setChecks] = useState([false, false, false, false, false])
  const [assetAnswer, setAssetAnswer] = useState('')
  const [withdrawalAnswer, setWithdrawalAnswer] = useState('')
  const labels = [
    'I have read and understood the participant information and privacy notice.',
    'I understand this is a research prototype and protects nothing valuable.',
    'I am at least 18 years old and choose to participate voluntarily.',
    'I understand interaction timing and success/failure outcomes will be recorded under a pseudonym.',
    'I know I may stop before submission and can request deletion using my study handle.',
  ]
  return <Shell title="Participant consent" onCancel={onCancel}><div className="completion-panel consent-panel">
    <h2>Before you participate</h2><p>Read the participant information and privacy notice before creating a study credential. Participation is optional.</p>
    {labels.map((label, index) => <label className="check-row" key={label}><input type="checkbox" checked={checks[index]}
      onChange={event => { const next = [...checks]; next[index] = event.target.checked; setChecks(next) }} />{label}</label>)}
    <fieldset><legend>Understanding check: what should this account protect?</legend>
      <label className="check-row"><input type="radio" name="asset-check" value="nothing" checked={assetAnswer === 'nothing'} onChange={event => setAssetAnswer(event.target.value)} />Nothing valuable; it is study-only.</label>
      <label className="check-row"><input type="radio" name="asset-check" value="real" checked={assetAnswer === 'real'} onChange={event => setAssetAnswer(event.target.value)} />My real files or accounts.</label>
    </fieldset>
    <fieldset><legend>Understanding check: when may you stop participating?</legend>
      <label className="check-row"><input type="radio" name="withdrawal-check" value="anytime" checked={withdrawalAnswer === 'anytime'} onChange={event => setWithdrawalAnswer(event.target.value)} />At any time, without penalty.</label>
      <label className="check-row"><input type="radio" name="withdrawal-check" value="never" checked={withdrawalAnswer === 'never'} onChange={event => setWithdrawalAnswer(event.target.value)} />Only after every trial is complete.</label>
    </fieldset>
    <button className="text-button" onClick={onPrivacy}>Read privacy and participant information</button>
    <button className="primary" disabled={!checks.every(Boolean) || assetAnswer !== 'nothing' || withdrawalAnswer !== 'anytime'} onClick={onAccept}>I consent and want to continue</button>
  </div></Shell>
}

function PrivacyNotice({ onBack }: { onBack: () => void }) {
  return <Shell title="Privacy and participant information" onCancel={onBack}><article className="legal-panel">
    <h1>SceneChain research privacy notice</h1>
    <p><strong>This is an experimental authenticator protecting no valuable account.</strong> Do not enter a password used anywhere else.</p>
    <h2>What is collected</h2><p>A random study handle, assigned scene identifiers, protected credential verifiers, authentication condition, success or failure, total completion time, per-stage times, retry count, and coarse aggregate cell/action counts.</p>
    <h2>What is not collected</h2><p>No name, email address, raw click coordinates, typed recovery password, graphical secret, recording, advertising identifier, or third-party analytics data is included in the research export.</p>
    <h2>Purpose and access</h2><p>Data is used only to compare ordinary passwords with direct and shielded SceneChain login. Raw events are available only through an authenticated administrative export. Published results must use aggregated groups with minimum-count disclosure controls.</p>
    <h2>Retention and deletion</h2><p>Linked data is deleted at the earlier of 24 months after collection closes or six months after final publication. While linkage remains, an authenticated participant can permanently delete the account and linked event rows after password reauthentication. Irreversibly anonymised published aggregates cannot be reversed.</p>
    <h2>Voluntary participation</h2><p>You may stop at any time without penalty. Do not participate until the responsible ethics committee and data-protection contact have approved the final study.</p>
  </article></Shell>
}

const PRACTICE_SCENES = [
  { id: 9001, version: 0, family: 'urban', title: 'Practice city route', asset: '/scenes/2001.webp', license: 'CC0-1.0' },
  { id: 9002, version: 0, family: 'architecture', title: 'Practice entrance', asset: '/scenes/2002.webp', license: 'CC0-1.0' },
  { id: 9003, version: 0, family: 'landscape', title: 'Practice park route', asset: '/scenes/2003.webp', license: 'CC0-1.0' },
  { id: 9004, version: 0, family: 'urban', title: 'Practice side street', asset: '/scenes/2004.webp', license: 'CC0-1.0' },
  { id: 9005, version: 0, family: 'transit', title: 'Practice station', asset: '/scenes/2005.webp', license: 'CC0-1.0' },
]

function Practice({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const [cell, setCell] = useState<number>()
  const [action, setAction] = useState<number>()
  const [complete, setComplete] = useState(false)
  if (complete) return <Shell title="Practice complete" onCancel={onDone}><div className="completion-panel"><div className="success-icon"><ShieldCheck /></div><h2>You completed a five-scene practice chain</h2><p>No practice input was sent to the server or stored. Enrollment will assign different scene IDs and ask you to repeat the complete chain twice.</p><button className="primary" onClick={onDone}>Return home</button></div></Shell>
  const next = async () => {
    if (cell === undefined || action === undefined) return
    if (index === 4) { setComplete(true); return }
    setIndex(index + 1); setCell(undefined); setAction(undefined)
  }
  const scene = PRACTICE_SCENES[index]
  return <Shell title="SceneChain practice" onCancel={onDone} progress={`${index + 1} / 5`}><div className="stage-copy"><span>Not recorded</span><h2>Choose any memorable location and direction</h2><p>This teaches the interaction only. Nothing selected here becomes your credential.</p></div><SceneBoard scene={scene} mode="direct" selectedCell={cell} onCell={setCell}/><ActionPad selected={action} onSelect={setAction}/><div className="stage-footer"><span>Practice has no correctness test.</span><button className="primary" disabled={cell === undefined || action === undefined} onClick={next}>{index === 4 ? 'Finish practice' : 'Next practice scene'}</button></div></Shell>
}

function Enrollment({ onDone, onCancel }: { onDone: (handle: string) => void; onCancel: () => void }) {
  const startedAt = useRef(0)
  const stageStartedAt = useRef(0)
  const [data, setData] = useState<EnrollmentResponse | null>(null)
  const [index, setIndex] = useState(0)
  const [cell, setCell] = useState<number>()
  const [action, setAction] = useState<number>()
  const [stages, setStages] = useState<Stage[]>([])
  const [confirmPass, setConfirmPass] = useState(0)
  const [confirmation, setConfirmation] = useState<Stage[]>([])
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stageMs, setStageMs] = useState<number[]>([])

  useEffect(() => { api.post<EnrollmentResponse>('/api/enrollments/start', {
    informed: true, adult: true, voluntary: true, researchMetrics: true, deletionRights: true, comprehensionPassed: true,
  }).then(response => {
    const now = performance.now()
    startedAt.current = now
    stageStartedAt.current = now
    setData(response)
  }).catch(e => setError(e.message)) }, [])
  if (!data) return <Shell title="Preparing private enrollment" onCancel={onCancel}><p>{error || 'Assigning five cue scenes…'}</p></Shell>

  const scene = data.scenes[index]
  const confirming = confirmPass > 0
  const activeScene = scene

  const next = async () => {
    if (cell === undefined || action === undefined) return
    const stage = { sceneId: scene.id, cellId: cell, actionId: action }
    const collection = confirming ? [...confirmation, stage] : [...stages, stage]
    if (!confirming) setStageMs(previous => [...previous, Math.round(performance.now() - stageStartedAt.current)])
    stageStartedAt.current = performance.now()
    setCell(undefined); setAction(undefined)
    if (index < 4) {
      if (confirming) setConfirmation(collection)
      else setStages(collection)
      setIndex(index + 1)
      return
    }
    setIndex(0); setBusy(true); setError('')
    try {
      if (confirmPass < 2) {
        await api.post('/api/enrollments/confirmation', { stages: collection }, data.csrfToken)
        if (!confirming) setStages(collection)
        setConfirmation([])
        setConfirmPass(confirmPass + 1)
      } else {
        setConfirmation(collection)
        setConfirmPass(3)
      }
    } catch (e) {
      setError((e as Error).message)
      setConfirmation([])
    } finally { setBusy(false) }
  }

  const finish = async () => {
    if (password.trim().length < 15) { setError('The alternative password must contain at least 15 characters.'); return }
    setBusy(true); setError('')
    try {
      const result = await api.post<{ handle: string }>('/api/enrollments/complete', {
        stages: confirmation, password, totalMs: Math.round(performance.now() - startedAt.current), stageMs,
      }, data.csrfToken)
      onDone(result.handle)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (confirmPass === 3) return <Shell title="Save your recovery sign-in" onCancel={onCancel}>
    <div className="completion-panel">
      <div className="success-icon"><ShieldCheck /></div>
      <h2>Your visual chain matched twice</h2>
      <p>Your assigned study handle is <code>{data.handle}</code>. Store it somewhere private.</p>
      <label>Alternative password
        <span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password}
          autoComplete="new-password" onChange={e => setPassword(e.target.value)} minLength={15} maxLength={128} />
          <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff /> : <Eye />}
          </button></span>
      </label>
      <small>At least 15 characters. Do not reuse a real password from another service.</small>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy} onClick={finish}>{busy ? 'Protecting credential…' : 'Complete enrollment'}</button>
    </div>
  </Shell>

  return <Shell title={confirming ? `Confirmation ${confirmPass} of 2` : 'Create your visual chain'} onCancel={onCancel}
    progress={`${index + 1} / 5`}>
    <div className="stage-copy">
      <span>{scene.family}</span><h2>{confirming ? 'Repeat your remembered location' : 'Choose any memorable location'}</h2>
      <p>{confirming ? 'Select the same cell and direction.' : 'Every one of the 384 cells is available. No locations are suggested or highlighted.'}</p>
    </div>
    <SceneBoard scene={activeScene} mode={confirming ? 'direct' : 'enrollment'} selectedCell={cell} onCell={setCell} />
    <ActionPad selected={action} onSelect={setAction} />
    {error && <p className="error" role="alert">{error}</p>}
    <div className="stage-footer"><span>No correctness is checked until the complete chain.</span>
      <button className="primary" disabled={busy || cell === undefined || action === undefined} onClick={next}>Confirm stage</button></div>
  </Shell>
}

function GraphicalLogin({ handle, setHandle, mode, setMode, onDone, onPassword, onCancel, locked = false }: {
  handle: string; setHandle: (v: string) => void; mode: Mode; setMode: (m: Mode) => void
  onDone: () => void; onPassword: () => void; onCancel: () => void; locked?: boolean
}) {
  const startedAt = useRef(0)
  const stageStartedAt = useRef(0)
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null)
  const [index, setIndex] = useState(0)
  const [selectedScene, setSelectedScene] = useState<number>()
  const [cell, setCell] = useState<number>()
  const [marker, setMarker] = useState<number>()
  const [action, setAction] = useState<number>()
  const [stages, setStages] = useState<Stage[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stageMs, setStageMs] = useState<number[]>([])

  const start = async () => {
    setBusy(true); setError('')
    try { setAttempt(await api.post<AttemptResponse>('/api/auth/attempts', { handle: handle.toUpperCase(), mode })); setIndex(0); setStages([]); setStageMs([]); setSelectedScene(undefined); startedAt.current = performance.now(); stageStartedAt.current = performance.now() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const next = async () => {
    if (action === undefined || (mode === 'direct' && cell === undefined) || (mode === 'shielded' && marker === undefined)) return
    if (selectedScene === undefined) return
    const stage: Stage = { sceneId: selectedScene, actionId: action,
      ...(mode === 'direct' ? { cellId: cell } : { markerId: marker }) }
    const all = [...stages, stage]
    const allStageMs = [...stageMs, Math.round(performance.now() - stageStartedAt.current)]
    setStageMs(allStageMs); stageStartedAt.current = performance.now()
    setCell(undefined); setMarker(undefined); setAction(undefined); setSelectedScene(undefined)
    if (index < 4) { setStages(all); setIndex(index + 1); return }
    setBusy(true)
    try { await api.post('/api/auth/attempts/complete', {
      stages: all, totalMs: Math.round(performance.now() - startedAt.current), stageMs: allStageMs,
    }, attempt!.csrfToken); onDone() }
    catch (e) { setError((e as Error).message); setAttempt(null); setStages([]); setSelectedScene(undefined); if (locked) onDone() } finally { setBusy(false) }
  }

  if (!attempt) return <Shell title="Authenticate with SceneChain" onCancel={onCancel}>
    <div className="login-panel">
      <label>Study handle<input value={handle} autoCapitalize="characters" autoComplete="username"
        placeholder="SC-ABCD-2345" onChange={e => setHandle(e.target.value.toUpperCase())} /></label>
      {!locked && <fieldset className="mode-choice"><legend>Presentation</legend>
        <button role="radio" aria-checked={mode === 'direct'} className={mode === 'direct' ? 'selected' : ''} onClick={() => setMode('direct')} type="button">
          <Eye size={20} /><strong>Direct</strong><span>Fast; visible when observed.</span></button>
        <button role="radio" aria-checked={mode === 'shielded'} className={mode === 'shielded' ? 'selected' : ''} onClick={() => setMode('shielded')} type="button">
          <ScanLine size={20} /><strong>Shielded</strong><span>Respond without touching the secret cell.</span></button>
      </fieldset>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={!/^SC-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(handle) || busy} onClick={start}>Begin five-scene attempt</button>
      {!locked && <button className="text-button" onClick={onPassword}>Use password instead</button>}
    </div>
  </Shell>

  const scene = attempt.scenes.find(item => item.id === selectedScene)
  if (!scene) return <Shell title="Recognize your scene" onCancel={onCancel} progress={`${index + 1} / 5`}>
    <div className="stage-copy"><span>Private recognition</span><h2>Choose scene {index + 1} from your chain</h2>
      <p>The pool is shuffled on every attempt. Select your remembered scenes in enrollment order; no scene is identified as belonging to this account.</p></div>
    <div className="scene-gallery">{attempt.scenes.filter(item => !stages.some(stage => stage.sceneId === item.id)).map(item => <button type="button" key={item.id}
      onClick={() => setSelectedScene(item.id)} aria-label={`Choose ${item.title}`}>
      <img src={item.thumbnail ?? item.asset} alt="" loading="lazy" decoding="async" /><span>{item.title}</span></button>)}</div>
  </Shell>
  return <Shell title={mode === 'shielded' ? 'Shielded SceneChain' : 'Direct SceneChain'} onCancel={onCancel} progress={`${index + 1} / 5`}>
    <div className="stage-copy"><span>{scene.family}</span><h2>{mode === 'direct' ? 'Select your remembered cell' : 'Find your location, then read its marker'}</h2>
      <p>{mode === 'direct' ? 'Your selected cell is input feedback, not a correctness signal.' : 'Do not touch the image. The action remains visible in protocol version 1.'}</p></div>
    <button className="text-button stage-back" type="button" onClick={() => { setSelectedScene(undefined); setCell(undefined); setMarker(undefined); setAction(undefined) }}>Choose another scene</button>
    <SceneBoard scene={scene} mode={mode} selectedCell={cell} selectedMarker={marker} onCell={setCell} onMarker={setMarker} />
    <ActionPad selected={action} onSelect={setAction} />
    <div className="stage-footer"><span>All five stages are evaluated together.</span><button className="primary"
      disabled={busy || action === undefined || (mode === 'direct' ? cell === undefined : marker === undefined)} onClick={next}>
      {index === 4 ? 'Verify complete chain' : 'Confirm stage'}</button></div>
  </Shell>
}

function PasswordLogin({ handle, setHandle, onDone, onBack, locked = false }: { handle: string; setHandle: (v: string) => void; onDone: () => void; onBack: () => void; locked?: boolean }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState<{ csrfToken: string } | null>(null)
  const start = async () => { try { setAttempt(await api.post('/api/auth/password/attempts', { handle })) } catch (e) { setError((e as Error).message) } }
  const submit = async () => { if (!attempt) return; try { await api.post('/api/auth/password', { password }, attempt.csrfToken); onDone() } catch (e) { setError((e as Error).message); setAttempt(null); setPassword(''); if (locked) onDone() } }
  return <Shell title="Use your alternative password" onCancel={onBack}><form className="login-panel" onSubmit={event => { event.preventDefault(); void submit() }}>
    <label>Study handle<input autoComplete="username" value={handle} readOnly={locked} onChange={e => setHandle(e.target.value.toUpperCase())} /></label>
    {!attempt && <><p>Timing starts only after you press the button below.</p><button className="primary" type="button" disabled={!/^SC-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(handle)} onClick={start}>Begin password trial</button></>}
    {attempt && <><label>Password<span className="password-field"><input autoFocus type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff /> : <Eye />}</button></span></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary" type="submit">Sign in</button></>}{!locked && <button className="text-button" type="button" onClick={onBack}>Use SceneChain instead</button>}
  </form></Shell>
}

function StudyFlow({ handle, onExit }: { handle: string; onExit: () => void }) {
  const [state, setState] = useState<StudyState | null>(null)
  const [inputMethod, setInputMethod] = useState('mouse')
  const [started, setStarted] = useState(false)
  const [error, setError] = useState('')
  const [supported, setSupported] = useState(window.innerWidth >= 1024 && window.innerHeight >= 600)
  useEffect(() => {
    const check = () => setSupported(window.innerWidth >= 1024 && window.innerHeight >= 600)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  useEffect(() => { api.get<StudyState>('/api/study/state').then(value => { setState(value); setStarted(true) }).catch(() => undefined) }, [])
  const refresh = () => api.get<StudyState>('/api/study/state').then(setState).catch(e => setError(e.message))
  const browserFamily = /Firefox/i.test(navigator.userAgent) ? 'firefox' : /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium/i.test(navigator.userAgent) ? 'safari' : /Chrome|Chromium/i.test(navigator.userAgent) ? 'chromium' : 'other'
  const begin = async () => {
    if (window.innerWidth < 1024 || window.innerHeight < 600) { setError('The confirmatory study requires a desktop or laptop viewport of at least 1024 × 600 CSS pixels.'); return }
    try {
      setState(await api.post<StudyState>('/api/study/start', { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, inputMethod, browserFamily }))
      setStarted(true)
    } catch (e) { setError((e as Error).message) }
  }
  if (!started) return <Shell title="Start assigned study session" onCancel={onExit}><form className="completion-panel" onSubmit={event => { event.preventDefault(); void begin() }}>
    <h2>Desktop or laptop study</h2><p>Your three authentication conditions are server-assigned and counterbalanced. Keep this browser at least 1024 pixels wide throughout each trial.</p>
    <label>Primary input method<select value={inputMethod} onChange={event => setInputMethod(event.target.value)}><option value="mouse">Mouse</option><option value="trackpad">Trackpad</option><option value="keyboard">Keyboard</option><option value="touch">Touchscreen laptop</option><option value="other">Other approved accommodation</option></select></label>
    {error && <p className="error" role="alert">{error}</p>}<button className="primary" type="submit">Begin assigned sequence</button>
  </form></Shell>
  if (!supported) return <Shell title="Study task paused" onCancel={onExit}><div className="completion-panel"><h2>Restore the supported viewport</h2><p>Resize this desktop or laptop browser to at least 1024 × 600 CSS pixels. The task is paused so its geometry and timing are not silently changed.</p></div></Shell>
  if (!state) return <Shell title="Loading study state" onCancel={onExit}><p>{error || 'Loading…'}</p></Shell>
  if (state.complete) return <Shell title="Study sequence complete" onCancel={onExit}><div className="completion-panel"><div className="success-icon"><ShieldCheck /></div><h2>All assigned trials are complete</h2><p>Your study-only account protects no valuable data. Follow the researcher’s debriefing and deletion instructions.</p><button className="primary" onClick={onExit}>Finish</button></div></Shell>
  if (state.phase === 'retention' && !state.retentionReady) return <Shell title="Delayed retention" onCancel={onExit}><div className="completion-panel"><h2>Your follow-up is not due yet</h2><p>Return at the scheduled time shown in your participant instructions. The server will unlock the trial after {state.retentionDueAt ? new Date(state.retentionDueAt).toLocaleString() : 'the declared interval'}.</p></div></Shell>
  if (state.phase === 'workload') return <Workload period={state.period} onDone={next => setState(next)} onExit={onExit} />
  const label = state.phase === 'practice' ? `Practice: ${state.practiceSuccesses} of 2 successful trials` : state.phase === 'measured' ? `Measured trial ${state.trialNumber + 1} of 3` : `Delayed trial ${state.retentionPeriod + 1} of 3`
  if (state.condition === 'password') return <><div className="study-banner" role="status">{label} · Assigned condition: password</div><PasswordLogin handle={handle} setHandle={() => undefined} locked onDone={refresh} onBack={onExit} /></>
  const graphicalMode: Mode = state.condition === 'shielded' ? 'shielded' : 'direct'
  return <><div className="study-banner" role="status">{label} · Assigned condition: {graphicalMode}</div><GraphicalLogin handle={handle} setHandle={() => undefined} mode={graphicalMode} setMode={() => undefined} locked onDone={refresh} onPassword={() => undefined} onCancel={onExit} /></>
}

function Workload({ period, onDone, onExit }: { period: number; onDone: (state: StudyState) => void; onExit: () => void }) {
  const dimensions = ['mental', 'physical', 'temporal', 'performance', 'effort', 'frustration'] as const
  const [values, setValues] = useState<Record<(typeof dimensions)[number], number>>({ mental: 10, physical: 10, temporal: 10, performance: 10, effort: 10, frustration: 10 })
  const [error, setError] = useState('')
  const submit = async () => { try { onDone(await api.post<StudyState>('/api/study/workload', values)) } catch (e) { setError((e as Error).message) } }
  return <Shell title={`Workload after condition ${period + 1}`} onCancel={onExit}><form className="legal-panel workload" onSubmit={event => { event.preventDefault(); void submit() }}><h1>Rate the completed condition</h1><p>Use 0 for very low and 20 for very high. For performance, 0 means perfect and 20 means failure.</p>{dimensions.map(name => <label key={name}>{name[0].toUpperCase() + name.slice(1)}: <output>{values[name]}</output><input type="range" min="0" max="20" value={values[name]} onChange={event => setValues(previous => ({ ...previous, [name]: Number(event.target.value) }))} /></label>)}{error && <p className="error" role="alert">{error}</p>}<button className="primary" type="submit">Save and continue</button></form></Shell>
}

function Workspace({ handle, onLogout, onDeleted }: { handle: string; onLogout: () => void; onDeleted: () => void }) {
  const [showDelete, setShowDelete] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const remove = async () => { try { await api.delete('/api/participant', { password, understandDeletionIsPermanent: confirmed }); onDeleted() } catch (e) { setError((e as Error).message) } }
  return <main className="workspace"><header className="topbar"><div className="brand"><span className="brand-mark"><ScanLine size={20} /></span>SceneChain</div>
    <button className="secondary" onClick={onLogout}><LogOut size={16} />Sign out</button></header>
    <section className="workspace-content"><div className="eyebrow">Authenticated research sandbox</div><h1>Complete chain accepted.</h1>
      <p>Signed in as <code>{handle}</code>. This prototype protects no valuable data and is not a production authenticator.</p>
      <div className="workspace-grid"><article><ShieldCheck /><h2>Final-only verification</h2><p>No individual stage disclosed correctness.</p></article>
        <article><KeyRound /><h2>Separate alternatives</h2><p>Password recovery remains independent of the graphical credential.</p></article></div>
      <button className="text-button danger-link" onClick={() => setShowDelete(!showDelete)}>Delete my participant account and linked research data</button>
      {showDelete && <form className="delete-panel" onSubmit={event => { event.preventDefault(); void remove() }}><h2>Permanent deletion</h2><p>This revokes the study account and deletes its still-linked event rows. It cannot reverse statistics that were already irreversibly anonymised.</p><label>Alternative password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="check-row"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I understand this deletion is permanent.</label>{error && <p className="error" role="alert">{error}</p>}<button className="secondary danger" disabled={!confirmed || !password} type="submit">Delete permanently</button></form>}
    </section></main>
}

function Shell({ title, progress, onCancel, children }: { title: string; progress?: string; onCancel: () => void; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [title])
  return <main className="app-shell"><header className="topbar"><button className="brand brand-button" onClick={onCancel} aria-label="Exit to previous page"><span className="brand-mark"><ScanLine size={20} /></span><span>SceneChain</span><span className="brand-divider" /><span className="brand-title">{title}</span></button>
    <div className="top-actions">{progress && <span className="progress-label">Scene {progress}</span>}<button className="secondary compact" onClick={onCancel}>Exit flow</button></div></header>
    <section className="flow-content"><h1 className="sr-only" ref={heading} tabIndex={-1}>{title}</h1>{children}</section></main>
}
