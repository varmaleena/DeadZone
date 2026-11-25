// Public home page shown to signed-out visitors.
import './landing.css';

export const logoMark = `<span class="mark brand-symbol" aria-hidden="true"><img src="/deadzone-logo.png" alt="" /></span>`;
export const brandName = `<span class="brand-name">Deadzone<small>Offline state auditor</small></span>`;

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const I = {
  spinner: icon('<path d="M12 3a9 9 0 1 0 9 9"/>'),
  eraser: icon('<path d="M7 21h10"/><path d="M5 15l8-8 6 6-8 8H8z"/>'),
  alert: icon('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>'),
  wifiOff: icon(
    '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.6-2.6M19 12.5a10 10 0 0 0-2.3-1.6M12 20h.01"/>',
  ),
  rocket: icon(
    '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 12l3 3"/><path d="M14 4c3-1 6 0 6 0s1 3 0 6l-7 7-6-6z"/>',
  ),
  wrench: icon('<path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3 5-5a4 4 0 0 0-5-5z"/><path d="M2 22l6-6"/>'),
  lock: icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  globe: icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  arrow: icon('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};

const STEPS: { id: string; title: string; tag: string; caption: string; preview: string }[] = [
  {
    id: 'sweep',
    title: 'Sweep',
    tag: 'Chrome',
    caption: 'Every screen, online then offline.',
    preview: `<div class="pv-line"><span class="pv-chip pv-red">OFFLINE</span> Checkout · Place order</div>
      <div class="pv-progress"><i style="width:60%"></i></div>
      <p class="pv-note">Step 3 of 5 · waiting for the screen to settle</p>`,
  },
  {
    id: 'judge',
    title: 'Judge',
    tag: 'On device',
    caption: 'Gemini Nano reads the screen. No network.',
    preview: `<pre class="pv-code">{
  "state": "infinite_spinner",
  "severity": "high",
  "evidence": "Spinner visible 30s, no offline message",
  "confidence": 0.92
}</pre><span class="pv-chip pv-teal">ON DEVICE</span>`,
  },
  {
    id: 'queue',
    title: 'Queue',
    tag: 'Firestore',
    caption: 'Results wait safely on the device.',
    preview: `<div class="pv-sync"><span class="pv-dot amber"></span> 5 results waiting to sync</div>
      <p class="pv-note">Nothing has left this device. Firestore sends everything when the connection returns.</p>`,
  },
  {
    id: 'diagnose',
    title: 'Diagnose',
    tag: 'Cloud',
    caption: 'Root cause and a real code fix.',
    preview: `<p class="pv-strong">Checkout hangs and loses the address</p>
      <pre class="pv-code"><span class="del">-  await fetch('/api/order')</span>
<span class="add">+  await queueOrder(order)   // saved offline</span>
<span class="add">+  showOfflineNotice()</span></pre><span class="pv-chip pv-blue">CLOUD</span>`,
  },
  {
    id: 'verify',
    title: 'Verify',
    tag: 'Re-sweep',
    caption: 'Prove the fix, keep it fixed.',
    preview: `<div class="pv-score"><span class="pv-ring"><b>100</b></span><div><p class="pv-strong">Every screen passes</p><p class="pv-note">Saved as baseline · regressions flagged automatically</p></div></div>`,
  },
  {
    id: 'field',
    title: 'Field',
    tag: 'Android',
    caption: 'Real dead zones, judged on the phone.',
    preview: `<div class="pv-phone"><div class="pv-pill">1 issue recorded · ON DEVICE</div><p>Profile screen</p><p class="pv-note">Signal lost in a basement car park</p></div>`,
  },
];

const FAQ: [string, string][] = [
  [
    'What is Deadzone?',
    'An offline-state auditor. It cuts the network on each screen of your web app, judges what the user sees with on-device AI, and helps you fix what breaks.',
  ],
  [
    'Why does the AI need to run on the device?',
    'Because the test happens with the network switched off. A cloud model can’t see the screen at that moment. Gemini Nano runs inside Chrome, so it can.',
  ],
  [
    'What happens on computers without Gemini Nano?',
    'Sweeps still run. Verdicts are kept as pending and judged by cloud Gemini when you reconnect, using the same Firebase AI Logic SDK.',
  ],
  [
    'Does my source code leave my machine?',
    'Only if you choose. You can link a source folder to get code fixes; the files are listed with their sizes and sent only when you tick the consent box.',
  ],
  [
    'Can I test my own app?',
    'Yes. Describe the user actions as a short JSON plan, open your app in Chrome and start a sweep. Deadzone asks for access to that site only.',
  ],
  [
    'What does it run on?',
    'Firebase AI Logic hybrid inference, Firestore, Remote Config, App Check and Firebase Auth. The extension runs in desktop Chrome; the Field SDK runs on Android.',
  ],
];

export function renderLanding(root: HTMLElement, onSignIn: () => void): void {
  document.title = 'Deadzone — Find the bugs that only happen offline';
  root.innerHTML = `
  <div class="lp">
    <header class="lp-nav">
      <div class="lp-wrap lp-nav-inner">
        <a class="lp-logo" href="/" aria-label="Deadzone home">${logoMark}${brandName}</a>
        <nav aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#loop">The loop</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div class="lp-nav-actions">
          <button class="lp-btn lp-btn-ghost" data-signin>Sign in</button>
          <button class="lp-btn lp-btn-dark" data-signin>Get started</button>
        </div>
      </div>
    </header>

    <main>
      <section class="lp-wrap">
        <div class="lp-hero">
          <p class="lp-pill"><span></span>Offline-state auditing for web and Android</p>
          <h1>Find the bugs that only<br>happen offline.</h1>
          <p class="lp-lead">Deadzone cuts the network on every screen of your app, lets Gemini Nano judge what users actually see — right on the device — and brings in cloud Gemini to explain the cause and write the fix.</p>
          <div class="lp-cta">
            <button class="lp-btn lp-btn-dark lp-btn-lg" data-signin>Get started ${I.arrow}</button>
            <a class="lp-btn lp-btn-light lp-btn-lg" href="#how">See how it works</a>
          </div>
        </div>
      </section>

      <section class="lp-wrap lp-section" id="how">
        <div class="lp-split">
          <h2>Offline bugs hide<br>from every test.</h2>
          <p class="lp-side">Apps are tested on fast office Wi-Fi. Users open them in lifts, basements and trains. When the signal drops, these are the moments that break — and nobody sees them before release.</p>
        </div>
        <div class="lp-problems">
          <div>${I.spinner}<h3>Endless spinners</h3><p>“Place order” spins forever with no message.</p></div>
          <div>${I.eraser}<h3>Lost input</h3><p>The address they typed is gone on reconnect.</p></div>
          <div>${I.alert}<h3>Raw errors</h3><p>Customers read “TypeError: Failed to fetch”.</p></div>
        </div>

        <div class="lp-mocks">
          <figure>
            <div class="mk mk-panel">
              <div class="mk-top"><b>DEADZONE</b><span class="pv-chip pv-red">OFFLINE</span></div>
              <div class="mk-row"><span>Home · Open home</span><em class="sev-h">Spinner</em></div>
              <div class="mk-row"><span>Checkout · Place order</span><em class="sev-h">Data lost</em></div>
              <div class="mk-row"><span>Profile · Open profile</span><em class="sev-m">Raw error</em></div>
              <div class="mk-row"><span>Cart · View cart</span><em class="sev-o">OK</em></div>
              <div class="mk-foot"><span class="pv-dot amber"></span> 4 waiting to sync</div>
            </div>
            <figcaption><span>01</span><h3>Sweep the app, network off</h3><p>The Chrome extension replays real user actions under offline and flaky profiles.</p></figcaption>
          </figure>
          <figure>
            <div class="mk mk-verdict">
              <div class="mk-shots"><div class="mk-shot"><i></i><i></i><i></i></div><div class="mk-shot off"><span class="mk-spin"></span></div></div>
              <p class="mk-label">Infinite spinner · HIGH</p>
              <p class="mk-ev">Order button disabled, spinner visible 30 s, no offline message.</p>
              <span class="pv-chip pv-teal">ON DEVICE</span>
            </div>
            <figcaption><span>02</span><h3>Judged by Gemini Nano, offline</h3><p>Online and offline screenshots are compared on the device in about a second.</p></figcaption>
          </figure>
          <figure>
            <div class="mk mk-diff">
              <p class="mk-label">Checkout hangs and wipes the form</p>
              <pre><span class="del">- form.reset()</span>
<span class="add">+ keepDraft(form)</span>
<span class="del">- await fetch(url)</span>
<span class="add">+ await queueOrder(order)</span></pre>
              <span class="pv-chip pv-blue">CLOUD</span>
            </div>
            <figcaption><span>03</span><h3>Fixed with cloud Gemini</h3><p>Back online, findings are grouped by root cause with a patch you can apply.</p></figcaption>
          </figure>
        </div>

        <div class="lp-callout">
          <span class="lp-callout-icon">${I.wifiOff}</span>
          <div>
            <h3>The AI has to work when the network doesn’t.</h3>
            <p>A cloud model can’t judge a screen while the test has the connection cut. Deadzone uses Gemini Nano on the device for every verdict, and cloud Gemini only for the heavy thinking after you reconnect.</p>
          </div>
        </div>
      </section>

      <section class="lp-dark">
        <div class="lp-wrap">
          <h2>One hybrid SDK.<br>On-device and cloud.</h2>
          <div class="lp-stats">
            <div><strong>0</strong><span>network calls to judge a screen</span></div>
            <div><strong>6</strong><span>offline failure states detected</span></div>
            <div><strong>3</strong><span>Firebase AI Logic inference modes</span></div>
          </div>
          <p class="lp-fine">ONLY_ON_DEVICE for verdicts · ONLY_IN_CLOUD for diagnosis · PREFER_ON_DEVICE for plain-language explanations.</p>
        </div>
      </section>

      <section class="lp-wrap lp-section" id="loop">
        <div class="lp-split">
          <h2>One loop, every screen</h2>
          <p class="lp-side">Detect, diagnose, fix and verify — then confirm it on real phones in real dead zones.</p>
        </div>
        <div class="lp-tabs">
          <div class="lp-tablist" role="tablist" aria-label="Deadzone loop">
            ${STEPS.map(
              (s, i) =>
                `<button role="tab" id="t-${s.id}" aria-controls="p-loop" aria-selected="${i === 0}" data-step="${i}"><span><b>${s.title}</b><small>${s.caption}</small></span><em>${s.tag}</em></button>`,
            ).join('')}
          </div>
          <div class="lp-tabpanel" id="p-loop" role="tabpanel" aria-live="polite"></div>
        </div>
      </section>

      <section class="lp-wrap lp-section">
        <div class="lp-split">
          <h2>Fewer surprises.<br>Faster fixes.</h2>
          <p class="lp-side">Offline readiness becomes something you measure, not something you hope for.</p>
        </div>
        <div class="lp-benefits">
          <article>${I.rocket}<h3>Found before release</h3><p>Sweeps catch offline failures in minutes, not from customer complaints.</p></article>
          <article>${I.wrench}<h3>Fixes, not just reports</h3><p>Each finding comes with a root cause and a unified-diff patch.</p></article>
          <article>${I.lock}<h3>Private by default</h3><p>Screens are judged on the device; you choose what goes to the cloud.</p></article>
          <article>${I.globe}<h3>Works on any web app</h3><p>Describe user actions once as a plan and sweep any site you own.</p></article>
        </div>
      </section>

      <section class="lp-wrap lp-section" id="faq">
        <h2 class="lp-center">Frequently asked questions</h2>
        <div class="lp-faq">
          ${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
        </div>
      </section>

      <section class="lp-wrap">
        <div class="lp-final">
          <h2>Let the network fail in testing,<br>not in production.</h2>
          <p>Create a workspace, pair the Chrome extension and run your first sweep in minutes.</p>
          <div class="lp-cta">
            <button class="lp-btn lp-btn-dark lp-btn-lg" data-signin>Get started ${I.arrow}</button>
            <a class="lp-btn lp-btn-light lp-btn-lg" href="/preview">Explore the live preview</a>
          </div>
        </div>
      </section>
    </main>

    <footer class="lp-footer">
      <div class="lp-wrap lp-footer-inner">
        <a class="lp-logo" href="/">${logoMark}${brandName}</a>
        <nav aria-label="Footer">
          <a href="/preview">Live preview</a>
          <a href="/downloads/deadzone-extension-0.2.0.zip" download>Chrome extension</a>
          <a href="https://dz-work-511514-buggy.web.app" target="_blank" rel="noopener">Demo app</a>
          <a href="https://github.com/varmaleena/DeadZone" target="_blank" rel="noopener">GitHub</a>
        </nav>
        <p>Built with Firebase AI Logic · Apache-2.0 · Demo data is fictional.</p>
      </div>
    </footer>
    <p id="login-error" class="lp-toast" role="alert" hidden></p>
  </div>`;

  root.querySelectorAll<HTMLButtonElement>('[data-signin]').forEach((button) => (button.onclick = onSignIn));

  const panel = root.querySelector<HTMLElement>('#p-loop')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const select = (index: number) => {
    tabs.forEach((tab, i) => tab.setAttribute('aria-selected', String(i === index)));
    const step = STEPS[index];
    panel.setAttribute('aria-labelledby', `t-${step.id}`);
    panel.innerHTML = `<p class="pv-title"><b>${step.title}.</b> ${step.caption}</p><div class="pv-card">${step.preview}</div>`;
  };
  tabs.forEach((tab, i) => {
    tab.onclick = () => select(i);
    tab.onkeydown = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = (i + (event.key === 'ArrowDown' ? 1 : tabs.length - 1)) % tabs.length;
        tabs[next].focus();
        select(next);
      }
    };
  });
  select(0);
}

export function showSignInError(message: string): void {
  const toast = document.querySelector<HTMLElement>('#login-error');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 8000);
}
