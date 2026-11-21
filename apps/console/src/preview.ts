import { logoMark } from './landing';

// Read-only workspace preview with clearly labelled example data (no live audit results).
export function renderDemo(root: HTMLDivElement): void {
  const checks = [
    ['Home', 'infinite_spinner', 'high', 'Loading indicator persists after connection loss.'],
    ['Cart', 'ok', 'none', 'Basket remains available without a connection.'],
    ['Checkout', 'data_loss', 'high', 'Delivery address is cleared after a failed submission.'],
    ['Profile', 'raw_error', 'medium', 'Technical fetch error appears directly on screen.'],
    ['Orders', 'blank_screen', 'medium', 'No cached orders or offline explanation appears.'],
  ];
  root.innerHTML = `<header><a class="logo" href="/" aria-label="Deadzone home">${logoMark}<span>Deadzone</span></a><span class="app-bar-divider"></span><span class="app-bar-title">Workspace preview · example data</span><a class="header-link" href="/">Open live workspace ↗</a></header><aside><p>WORKSPACE PREVIEW</p><div class="workspace-name">FreshCart team <small>Grocery application</small></div>${[
    ['overview', 'Overview'],
    ['checks', 'Screen checks'],
    ['workflow', 'Walkthrough'],
  ]
    .map(
      ([id, label]) =>
        `<a href="${id === 'overview' ? '/preview' : id === 'checks' ? '/preview/checks' : '/preview/guide'}" ${(location.pathname === '/preview' && id === 'overview') || (location.pathname === '/preview/checks' && id === 'checks') || (location.pathname === '/preview/guide' && id === 'workflow') ? 'aria-current="page"' : ''}>${label}</a>`,
    )
    .join(
      '',
    )}<div class="sidebar-note">EXAMPLE RESULTS<br>These are example results, not findings from a live audit.</div></aside><main class="demo-main"><div class="fixture-banner"><span>ILLUSTRATIVE PREVIEW</span> Example results · not from a live audit · read-only</div><section id="overview"><div class="page-heading"><div><p class="eyebrow">YOUR APP, WITHOUT THE INTERNET</p><h1>Offline readiness.<br><em>Clarity in every state.</em></h1><p>A clear view of the screens that break when the signal disappears.</p></div><a class="primary-link" href="https://dz-3003-buggy.web.app" target="_blank" rel="noopener">Open FreshCart buggy ↗</a></div><div class="metrics"><article class="hero-score"><p>Illustrative buggy score</p><strong>20<span>/100</span></strong><div class="score-track"><i></i></div><p>1 of 5 fixture checks passes</p></article><article><p>Issues to investigate</p><strong class="metric-number">4</strong><p><span class="severity high">2 HIGH</span> <span class="severity medium">2 MEDIUM</span></p></article><article><p>Compare the fix</p><strong class="metric-number">5<span> screens</span></strong><p>Open the fixed app and inspect its offline states.</p><a href="https://dz-3003-fixed.web.app" target="_blank" rel="noopener">Open FreshCart fixed ↗</a></article></div></section><section id="checks"><div class="section-title"><h2>Where the experience breaks</h2><span>FreshCart · fixture set</span></div><div class="checks-table"><div class="table-row table-head"><span>SCREEN</span><span>OFFLINE STATE</span><span>SEVERITY</span><span>EVIDENCE</span></div>${checks.map(([name, state, severity, evidence]) => `<div class="table-row"><strong>${name}</strong><span class="state ${state === 'ok' ? 'passing' : ''}">${state.replaceAll('_', ' ')}</span><span><span class="severity ${severity}">${severity === 'none' ? 'PASS' : severity.toUpperCase()}</span></span><p>${evidence}</p></div>`).join('')}</div></section><section id="workflow"><div class="section-title"><h2>Workflow</h2><span>Three steps to present</span></div><div class="grid workflow"><article><b>01 / BREAK</b><h2>Start with the buggy app</h2><p>Open Checkout, enter a test address, disconnect and place an order. Observe lost input and the loading state.</p><a href="https://dz-3003-buggy.web.app/checkout" target="_blank" rel="noopener">Open checkout ↗</a></article><article><b>02 / COMPARE</b><h2>Switch to the fixed app</h2><p>Repeat the action. The address stays and the order queues on this device while offline.</p><a href="https://dz-3003-fixed.web.app/checkout" target="_blank" rel="noopener">Try the fixed checkout ↗</a></article><article><b>03 / VERIFY</b><h2>Run a real sweep</h2><p>Load the development extension in supported desktop Chrome. Actual judgments appear as ON DEVICE, CLOUD or PENDING.</p><a href="/">Open live console →</a></article></div></section><footer>DEADZONE · Workspace preview. Live Firebase workspace and physical-device AI validation are separate.</footer></main>`;
  const selected =
    location.pathname === '/preview/checks'
      ? 'checks'
      : location.pathname === '/preview/guide'
        ? 'workflow'
        : 'overview';
  root.querySelectorAll<HTMLElement>('.demo-main>section').forEach((section) => {
    section.hidden = section.id !== selected;
  });
  if (selected === 'overview') {
    const overview = document.querySelector('#overview')!;
    overview.insertAdjacentHTML(
      'beforeend',
      '<article class="editorial-card"><div class="editorial-copy"><span>FRESHCART / TEST ENVIRONMENT</span><h2>A better experience.<br>Even without a signal.</h2><p>Understand what breaks. Compare the fix. Verify the result.</p><a href="/preview/checks">Explore screen checks →</a></div><div class="orbital" aria-hidden="true"></div></article><div class="overview-links"><a href="/preview/checks"><b>Screen checks</b><span>Review five offline states →</span></a><a href="/preview/guide"><b>Presentation guide</b><span>Show the buggy and fixed apps →</span></a></div>',
    );
  }
  if (selected === 'checks') {
    document
      .querySelector('#checks')!
      .insertAdjacentHTML(
        'afterbegin',
        '<p class="eyebrow">QUALITY / SCREEN CHECKS</p><h1>Screen checks</h1><p>Illustrative evidence from five FreshCart screens. These are example results, not findings from a live audit.</p><label class="search-control">Search checks <input id="check-search" placeholder="Screen, state or evidence…" type="search"></label>',
      );
    document.querySelector<HTMLInputElement>('#check-search')!.oninput = (event) => {
      const query = (event.target as HTMLInputElement).value.toLowerCase();
      root
        .querySelectorAll<HTMLElement>('.table-row:not(.table-head)')
        .forEach((row) => (row.hidden = !row.textContent?.toLowerCase().includes(query)));
    };
  }
  if (selected === 'workflow')
    document
      .querySelector('#workflow')!
      .insertAdjacentHTML(
        'afterbegin',
        '<p class="eyebrow">RESOURCES / PRESENTATION</p><h1>A clear path to your audit.</h1><p>Walk through the problem and the fix, one focused step at a time.</p>',
      );
}
