/**
 * F1 Data Hub
 * Fetches live/historical driver standings from the Jolpica-F1 API (a free,
 * community-run Ergast-compatible mirror) and renders a Driver Hall of Fame
 * bio card on click. Falls back to bundled mock data whenever the network
 * request fails, times out, or a season has no data yet, so the UI never
 * shows a blank or broken state.
 */
(function () {

  const CONFIG = {
    API_BASE: 'https://api.jolpi.ca/ergast/f1',
    TIMEOUT_MS: 8000,
    EARLIEST_SEASON: 1950,
  };

  /* ---------- Fallback data (used if the live API is unreachable) ---------- */
  const FALLBACK_STANDINGS = {
    season: 'current',
    list: [
      { position: 1, driverId: 'antonelli', given: 'Andrea Kimi', family: 'Antonelli', nationality: 'Italian', team: 'Mercedes', points: 179, wins: 5 },
      { position: 2, driverId: 'russell', given: 'George', family: 'Russell', nationality: 'British', team: 'Mercedes', points: 154, wins: 2 },
      { position: 3, driverId: 'hamilton', given: 'Lewis', family: 'Hamilton', nationality: 'British', team: 'Ferrari', points: 147, wins: 1 },
      { position: 4, driverId: 'leclerc', given: 'Charles', family: 'Leclerc', nationality: 'Monegasque', team: 'Ferrari', points: 108, wins: 1 },
      { position: 5, driverId: 'norris', given: 'Lando', family: 'Norris', nationality: 'British', team: 'McLaren', points: 97, wins: 0 },
      { position: 6, driverId: 'piastri', given: 'Oscar', family: 'Piastri', nationality: 'Australian', team: 'McLaren', points: 82, wins: 0 },
      { position: 7, driverId: 'max_verstappen', given: 'Max', family: 'Verstappen', nationality: 'Dutch', team: 'Red Bull', points: 76, wins: 0 },
      { position: 8, driverId: 'hadjar', given: 'Isack', family: 'Hadjar', nationality: 'French', team: 'Red Bull', points: 52, wins: 0 },
      { position: 9, driverId: 'gasly', given: 'Pierre', family: 'Gasly', nationality: 'French', team: 'Alpine', points: 42, wins: 0 },
      { position: 10, driverId: 'lawson', given: 'Liam', family: 'Lawson', nationality: 'New Zealander', team: 'RB', points: 39, wins: 0 },
      { position: 11, driverId: 'arvid_lindblad', given: 'Arvid', family: 'Lindblad', nationality: 'British', team: 'RB', points: 20, wins: 0 },
      { position: 12, driverId: 'bearman', given: 'Oliver', family: 'Bearman', nationality: 'British', team: 'Haas', points: 18, wins: 0 },
      { position: 13, driverId: 'colapinto', given: 'Franco', family: 'Colapinto', nationality: 'Argentine', team: 'Alpine', points: 18, wins: 0 },
      { position: 14, driverId: 'bortoleto', given: 'Gabriel', family: 'Bortoleto', nationality: 'Brazilian', team: 'Audi', points: 6, wins: 0 },
      { position: 15, driverId: 'sainz', given: 'Carlos', family: 'Sainz', nationality: 'Spanish', team: 'Williams', points: 6, wins: 0 },
      { position: 16, driverId: 'albon', given: 'Alexander', family: 'Albon', nationality: 'Thai', team: 'Williams', points: 5, wins: 0 },
      { position: 17, driverId: 'ocon', given: 'Esteban', family: 'Ocon', nationality: 'French', team: 'Haas', points: 3, wins: 0 },
      { position: 18, driverId: 'alonso', given: 'Fernando', family: 'Alonso', nationality: 'Spanish', team: 'Aston Martin', points: 1, wins: 0 },
      { position: 19, driverId: 'hulkenberg', given: 'Nico', family: 'Hülkenberg', nationality: 'German', team: 'Audi', points: 0, wins: 0 },
      { position: 20, driverId: 'bottas', given: 'Valtteri', family: 'Bottas', nationality: 'Finnish', team: 'Cadillac', points: 0, wins: 0 },
      { position: 21, driverId: 'perez', given: 'Sergio', family: 'Pérez', nationality: 'Mexican', team: 'Cadillac', points: 0, wins: 0 },
      { position: 22, driverId: 'stroll', given: 'Lance', family: 'Stroll', nationality: 'Canadian', team: 'Aston Martin', points: 0, wins: 0 },
    ],
  };

  /* ---------- Curated career stats for the Driver Hall of Fame ---------- */
  const DRIVER_BIOS = {
    hamilton: { championships: 7, wins: 105, podiums: 202, poles: 104, bio: 'Widely regarded as one of the greatest drivers in the sport’s history, Lewis Hamilton equalled Michael Schumacher’s record of seven world titles across a career spent with McLaren, Mercedes, and now Ferrari.' },
    max_verstappen: { championships: 4, wins: 65, podiums: 116, poles: 44, bio: 'Max Verstappen became F1’s youngest ever race winner and went on to dominate the sport with Red Bull, claiming four consecutive drivers’ championships between 2021 and 2024.' },
    russell: { championships: 0, wins: 5, podiums: 21, poles: 5, bio: 'George Russell rose through Mercedes’ junior program and stepped into the team’s lead seat, becoming a consistent front-runner and race winner for the Silver Arrows.' },
    leclerc: { championships: 0, wins: 8, podiums: 47, poles: 26, bio: 'Charles Leclerc has been the face of Ferrari’s resurgence, combining raw one-lap pace with a fierce home-grown following at the Scuderia.' },
    norris: { championships: 0, wins: 8, podiums: 35, poles: 12, bio: 'Lando Norris grew from a promising McLaren rookie into a genuine title contender, pairing consistent podium finishes with a fan-favourite personality.' },
    piastri: { championships: 0, wins: 4, podiums: 15, poles: 4, bio: 'Oscar Piastri arrived in F1 as a triple junior-series champion and quickly proved it was no fluke, taking wins for McLaren in only his second season.' },
    alonso: { championships: 2, wins: 32, podiums: 106, poles: 22, bio: 'A two-time world champion with Renault, Fernando Alonso remains one of the grid’s sharpest racecraft minds two decades into his career.' },
    gasly: { championships: 0, wins: 1, podiums: 4, poles: 0, bio: 'Pierre Gasly took a surprise victory at Monza for Red Bull before rebuilding his career at AlphaTauri and Alpine into a reliable points scorer.' },
    sainz: { championships: 0, wins: 4, podiums: 26, poles: 6, bio: 'Carlos Sainz built a reputation as a relentlessly consistent racer at Renault, McLaren, and Ferrari, banking multiple grand prix wins along the way.' },
    albon: { championships: 0, wins: 0, podiums: 2, poles: 0, bio: 'Alexander Albon rebuilt his F1 career at Williams after a tough spell at Red Bull, becoming the team’s benchmark driver during its recovery.' },
    ocon: { championships: 0, wins: 1, podiums: 3, poles: 0, bio: 'Esteban Ocon took a maiden win in the chaos of the 2021 Hungarian Grand Prix and has since been a dependable presence in the midfield.' },
    bearman: { championships: 0, wins: 0, podiums: 0, poles: 0, bio: 'Oliver Bearman announced himself with a composed points-scoring debut for Ferrari as a late substitute before joining Haas full-time.' },
    hulkenberg: { championships: 0, wins: 0, podiums: 0, poles: 1, bio: 'Nico Hülkenberg is F1’s most experienced active driver, known for a blistering one-lap pace that has never quite converted into a podium.' },
    bottas: { championships: 0, wins: 10, podiums: 67, poles: 20, bio: 'Valtteri Bottas spent five seasons as Lewis Hamilton’s wing-man at Mercedes, racking up race wins before moving on to Sauber and Cadillac.' },
    perez: { championships: 0, wins: 6, podiums: 39, poles: 3, bio: 'Sergio Pérez became a Red Bull race winner and a fan favourite in Mexico, known for his tyre management and late-race charges.' },
    stroll: { championships: 0, wins: 0, podiums: 3, poles: 1, bio: 'Lance Stroll has raced for the Aston Martin family team since 2019, picking up a shock pole position in the wet at Turkey in 2020.' },
    hadjar: { championships: 0, wins: 0, podiums: 0, poles: 0, bio: 'Isack Hadjar joined the grid as one of the Red Bull junior program’s most highly rated prospects after a dominant Formula 2 campaign.' },
    lawson: { championships: 0, wins: 0, podiums: 0, poles: 0, bio: 'Liam Lawson impressed on his stand-in appearances for AlphaTauri before earning a full-time Red Bull family race seat.' },
    colapinto: { championships: 0, wins: 0, podiums: 0, poles: 0, bio: 'Franco Colapinto burst onto the grid with a string of composed rookie performances for Williams that turned him into Argentina’s newest motorsport star.' },
    bortoleto: { championships: 0, wins: 0, podiums: 0, poles: 0, bio: 'Gabriel Bortoleto arrived in F1 as reigning Formula 2 champion, continuing Brazil’s long lineage of front-running single-seater talent.' },
    antonelli: { championships: 0, wins: 0, podiums: 0, poles: 0, bio: 'Andrea Kimi Antonelli was fast-tracked through Mercedes’ junior program and handed the seat vacated by Lewis Hamilton as one of the sport’s most hyped rookies.' },
    arvid_lindblad: { championships: 0, wins: 0, podiums: 0, poles: 0, bio: 'Arvid Lindblad progressed rapidly through the Red Bull junior ranks, earning a super-licence exemption on his way to a Formula 1 seat.' },
    vettel: { championships: 4, wins: 53, podiums: 122, poles: 57, bio: 'Sebastian Vettel won four consecutive titles with Red Bull between 2010 and 2013, becoming the sport’s youngest ever champion at the time.' },
    schumacher: { championships: 7, wins: 91, podiums: 155, poles: 68, bio: 'Michael Schumacher redefined what a Formula 1 driver could achieve, winning seven world titles and transforming Ferrari into a dominant force.' },
    senna: { championships: 3, wins: 41, podiums: 80, poles: 65, bio: 'Ayrton Senna’s blend of raw speed and fierce intensity, especially in the rain, made him one of the most revered drivers the sport has seen.' },
  };

  const GENERIC_BIO = 'Full curated career statistics aren’t available for this driver yet — the figures below reflect their standing for the selected season only.';

  /* ---------- Fetch helpers ---------- */
  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizeApiResponse(json, seasonLabel) {
    const lists = json && json.MRData && json.MRData.StandingsTable && json.MRData.StandingsTable.StandingsLists;
    if (!lists || !lists.length) return null;
    const rows = lists[0].DriverStandings || [];
    if (!rows.length) return null;
    return {
      season: lists[0].season || seasonLabel,
      list: rows.map((row) => ({
        position: parseInt(row.position, 10),
        driverId: row.Driver.driverId,
        given: row.Driver.givenName,
        family: row.Driver.familyName,
        nationality: row.Driver.nationality,
        team: (row.Constructors && row.Constructors[0] && row.Constructors[0].name) || '—',
        points: parseFloat(row.points),
        wins: parseInt(row.wins, 10),
      })),
    };
  }

  /**
   * Resolves standings for a given season ("current" or a year string).
   * Always resolves successfully; falls back to bundled mock data on any
   * network failure, timeout, or empty API response.
   */
  async function getStandings(seasonValue) {
    try {
      const json = await fetchWithTimeout(
        `${CONFIG.API_BASE}/${seasonValue}/driverStandings.json`,
        CONFIG.TIMEOUT_MS
      );
      const normalized = normalizeApiResponse(json, seasonValue);
      if (!normalized) throw new Error('Empty standings payload');
      return {
        source: seasonValue === 'current' ? 'live' : 'historical',
        season: normalized.season,
        list: normalized.list,
      };
    } catch (err) {
      console.warn('[F1 Data Hub] Falling back to mock standings:', err.message);
      return {
        source: 'fallback',
        season: seasonValue === 'current' ? '2026' : seasonValue,
        list: FALLBACK_STANDINGS.list,
      };
    }
  }

  /* ---------- Rendering ---------- */
  const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
  }

  function driverInitials(driver) {
    return `${driver.given.charAt(0)}${driver.family.charAt(0)}`.toUpperCase();
  }

  function rowMarkup(driver) {
    const rankClass = driver.position === 1 ? 'rank-1' : driver.position === 2 ? 'rank-2' : driver.position === 3 ? 'rank-3' : '';
    return `
      <button type="button" class="standings-row" data-driver-id="${escapeHtml(driver.driverId)}" style="opacity:0">
        <span class="standings-pos ${rankClass}">${driver.position}</span>
        <span class="standings-driver">
          <span class="standings-name">${escapeHtml(driver.given)} ${escapeHtml(driver.family)}</span>
          <span class="standings-meta">${escapeHtml(driver.nationality)} · ${escapeHtml(driver.team)}</span>
        </span>
        <span class="standings-team">${escapeHtml(driver.team)}</span>
        <span class="standings-points">${driver.points}</span>
        <span class="standings-wins">${driver.wins}</span>
      </button>
    `;
  }

  function skeletonMarkup(count) {
    return Array.from({ length: count }, () => '<div class="standings-skeleton"></div>').join('');
  }

  function animateOutRows(container) {
    return new Promise((resolve) => {
      const rows = container.querySelectorAll('.standings-row');
      if (!rows.length) return resolve();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      anime({
        targets: rows,
        opacity: [1, 0],
        translateY: [0, -14],
        duration: 350,
        delay: anime.stagger(18),
        easing: 'easeInExpo',
        complete: finish,
      });
      // Safety net: never let a stalled animation (e.g. a backgrounded tab
      // throttling requestAnimationFrame) block the season switch forever.
      setTimeout(finish, 900);
    });
  }

  function animateInRows(container) {
    const rows = container.querySelectorAll('.standings-row');
    anime({
      targets: rows,
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 550,
      delay: anime.stagger(35),
      easing: 'easeOutExpo',
    });
  }

  async function renderStandings(container, result) {
    await animateOutRows(container);
    container.innerHTML = result.list.map(rowMarkup).join('');
    animateInRows(container);
  }

  function updateStatusBadge(result) {
    const badge = document.getElementById('hub-status');
    const text = document.getElementById('hub-status-text');
    const note = document.getElementById('hub-note');
    if (!badge || !text) return;

    if (result.source === 'live') {
      badge.setAttribute('data-state', 'live');
      text.textContent = 'LIVE · ' + result.season;
    } else if (result.source === 'historical') {
      badge.setAttribute('data-state', 'historical');
      text.textContent = result.season + ' FINAL';
    } else {
      badge.setAttribute('data-state', 'fallback');
      text.textContent = 'OFFLINE · SAMPLE DATA';
    }

    if (note) {
      note.textContent = result.source === 'fallback'
        ? 'Live standings are unavailable right now, so a recent snapshot is shown instead. Click any driver to open their Hall of Fame bio card.'
        : 'Click any driver to open their Hall of Fame bio card.';
    }
  }

  function buildBioPanel(panel, driver) {
    const curated = DRIVER_BIOS[driver.driverId];
    const championships = curated ? curated.championships : '—';
    const wins = curated ? curated.wins : driver.wins;
    const podiums = curated ? curated.podiums : '—';
    const bioText = curated ? curated.bio : GENERIC_BIO;

    panel.innerHTML = `
      <div class="glass rounded-2xl p-6 md:p-8" id="bio-card-inner" style="opacity:0">
        <div class="flex items-start justify-between gap-4 mb-6">
          <div class="bio-card flex-1">
            <div class="bio-avatar">${escapeHtml(driverInitials(driver))}</div>
            <div>
              <p class="font-display text-xs tracking-widest text-racered2 mb-1">DRIVER HALL OF FAME</p>
              <h3 class="font-display font-700 text-2xl mb-1">${escapeHtml(driver.given)} ${escapeHtml(driver.family)}</h3>
              <p class="text-sm text-[color:var(--tx-50)]">${escapeHtml(driver.nationality)} · ${escapeHtml(driver.team)} · Currently P${driver.position}</p>
            </div>
          </div>
          <button type="button" id="bio-close" class="bio-close" aria-label="Close bio card">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="text-sm text-[color:var(--tx-70)] leading-relaxed mb-6 max-w-3xl">${bioText}</p>
        <div class="grid grid-cols-3 md:grid-cols-5 gap-4 text-center border-t border-[color:var(--bd-10)] pt-6">
          <div>
            <p class="bio-stat-value">${championships}</p>
            <p class="bio-stat-label">Championships</p>
          </div>
          <div>
            <p class="bio-stat-value">${wins}</p>
            <p class="bio-stat-label">Career Wins</p>
          </div>
          <div>
            <p class="bio-stat-value">${podiums}</p>
            <p class="bio-stat-label">Podiums</p>
          </div>
          <div>
            <p class="bio-stat-value">${driver.points}</p>
            <p class="bio-stat-label">Season Points</p>
          </div>
          <div>
            <p class="bio-stat-value">${driver.wins}</p>
            <p class="bio-stat-label">Season Wins</p>
          </div>
        </div>
      </div>
    `;

    anime({
      targets: '#bio-card-inner',
      opacity: [0, 1],
      translateY: [20, 0],
      scale: [0.98, 1],
      duration: 550,
      easing: 'easeOutExpo',
    });

    document.getElementById('bio-close').addEventListener('click', () => closeBioPanel(panel));
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeBioPanel(panel) {
    const inner = document.getElementById('bio-card-inner');
    if (!inner) return;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      panel.innerHTML = '';
    };
    anime({
      targets: inner,
      opacity: [1, 0],
      translateY: [0, 12],
      duration: 300,
      easing: 'easeInExpo',
      complete: finish,
    });
    // Safety net: match animateOutRows' guard against a stalled rAF loop.
    setTimeout(finish, 700);
    document.querySelectorAll('.standings-row.is-active').forEach((el) => el.classList.remove('is-active'));
  }

  /* ---------- Season selector ---------- */
  function populateSeasonSelect(select) {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= CONFIG.EARLIEST_SEASON; year--) {
      const opt = document.createElement('option');
      opt.value = String(year);
      opt.textContent = String(year);
      select.appendChild(opt);
    }
    select.disabled = false;
  }

  /* ---------- Init ---------- */
  function init() {
    const section = document.getElementById('data-hub');
    if (!section) return;

    const select = document.getElementById('season-select');
    const listContainer = document.getElementById('standings-list');
    const bioPanel = document.getElementById('bio-panel');

    listContainer.innerHTML = skeletonMarkup(8);
    populateSeasonSelect(select);

    let currentDriverList = [];
    let loadSeq = 0;

    async function loadSeason(seasonValue) {
      const mySeq = ++loadSeq;
      select.disabled = true;
      const result = await getStandings(seasonValue);
      if (mySeq !== loadSeq) return; // a newer season was requested meanwhile; discard this stale response
      currentDriverList = result.list;
      updateStatusBadge(result);
      await renderStandings(listContainer, result);
      if (mySeq !== loadSeq) return; // guard again in case a newer request landed mid-animation
      select.disabled = false;
    }

    select.addEventListener('change', () => loadSeason(select.value));

    listContainer.addEventListener('click', (e) => {
      const row = e.target.closest('.standings-row');
      if (!row) return;
      const driverId = row.dataset.driverId;
      const driver = currentDriverList.find((d) => d.driverId === driverId);
      if (!driver) return;

      document.querySelectorAll('.standings-row.is-active').forEach((el) => el.classList.remove('is-active'));
      row.classList.add('is-active');
      buildBioPanel(bioPanel, driver);
    });

    loadSeason('current');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
