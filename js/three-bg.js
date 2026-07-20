import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
  const html = document.documentElement;
  const revealEverythingNow = () => {
    html.classList.remove('js-loading', 'js-content-pending');
    window.dispatchEvent(new CustomEvent('f1-intro-complete'));
  };

  const mount = document.getElementById('bg-canvas');
  if (!mount) { revealEverythingNow(); return; }

  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
  if (!gl) { revealEverythingNow(); return; }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PARTICLE_COUNT = window.innerWidth < 768 ? 1000 : 2200;
  const palette = [0xe10600, 0xff3b30, 0xd4af37, 0x7dd3fc, 0xffffff];

  let width = window.innerWidth;
  let height = window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
  camera.position.z = 620;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: testCanvas, context: gl, antialias: false, alpha: true, powerPreference: 'low-power' });
  } catch (err) {
    revealEverythingNow();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(width, height);
  mount.appendChild(renderer.domElement);

  /* ================= Particle field — dense, twinkling, layered ================= */
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 1800;
    positions[i3 + 1] = (Math.random() - 0.5) * 1300;
    positions[i3 + 2] = (Math.random() - 0.5) * 1600;
    tmpColor.set(palette[Math.floor(Math.random() * palette.length)]);
    colors[i3] = tmpColor.r;
    colors[i3 + 1] = tmpColor.g;
    colors[i3 + 2] = tmpColor.b;
    seeds[i] = Math.random() * Math.PI * 2;
    sizes[i] = 0.6 + Math.random() * 0.8;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  // Drift + twinkle are computed on the GPU from uTime + a per-vertex seed,
  // so the CPU never has to rewrite/re-upload the position buffer per frame.
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.85 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute float aSeed;
      attribute float aSize;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        vec3 p = position;
        p.x += cos(uTime * 0.35 + aSeed) * 8.0;
        p.y += sin(uTime * 0.5 + aSeed) * 14.0;
        vTwinkle = 0.55 + 0.45 * sin(uTime * 0.9 + aSeed * 3.1);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 2.6 * aSize * uPixelRatio * (300.0 / -mv.z) * (0.75 + 0.4 * vTwinkle);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * uOpacity * vTwinkle;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const particleGroup = new THREE.Group();
  particleGroup.add(new THREE.Points(geometry, material));
  scene.add(particleGroup);

  /* ================= F1 car: built from primitives, one per section ==============
   * No 3D model asset is available, so the car is assembled from simple
   * geometry in the same wireframe-HUD style as the rest of the site — each
   * part built from several pieces so it reads as an actual component
   * rather than a bare primitive. Each of the six parts belongs to its own
   * page section and docks at its own spot (front wing→Overview,
   * halo→Data Hub, wheel→Legends, sidepods→Constructors, tyres→Circuits,
   * rear wing→Timeline); only the active section's part is visible. */
  const SECTION_IDS = ['overview', 'data-hub', 'legends', 'teams', 'circuits', 'timeline'];
  const sectionEls = SECTION_IDS.map((id) => document.getElementById(id));

  const DOCKED_POSITIONS = [
    [145, 60, -30],
    [-130, 26, -40],
    [155, -20, -35],
    [-150, -52, -30],
    [115, 78, -45],
    [-105, -90, -35],
  ];
  const PART_SCALE = 1.9;

  const PART_INFO = [
    { label: 'FRONT WING & NOSE', title: 'First Point of Airflow', fact: 'The front wing shapes airflow for the entire car — teams run thousands of CFD simulations to perfect its curvature.' },
    { label: 'HALO & COCKPIT', title: 'Built to Deflect 12 Tonnes', fact: 'Introduced in 2018, the titanium halo can withstand the static weight of a London bus without deforming.' },
    { label: 'STEERING WHEEL', title: 'Mission Control', fact: 'A modern F1 wheel packs over 25 buttons and dials, letting drivers adjust brake bias and engine maps mid-corner.' },
    { label: 'SIDEPODS & ENGINE COVER', title: 'Cooling Under Pressure', fact: 'Sidepods duct air through radiators handling engine temperatures north of 1,000°C.' },
    { label: 'WHEELS & TYRES', title: 'The Only Contact With The Track', fact: 'Tyres reach surface temperatures over 100°C, with the contact patch no bigger than a postcard.' },
    { label: 'REAR WING & DIFFUSER', title: 'Traction Out Of The Corner', fact: 'The diffuser accelerates airflow under the car, generating downforce without adding drag.' },
  ];

  const CAR_PART_DEFS = [
    { // 0: Overview — front wing & nose
      color: 0xe10600,
      pieces: [
        { geo: new THREE.ConeGeometry(20, 90, 8), pos: [0, -5, 150], rot: [-Math.PI / 2, 0, 0] },
        { geo: new THREE.ConeGeometry(8, 34, 8), pos: [0, -5, 195], rot: [-Math.PI / 2, 0, 0] },
        { geo: new THREE.BoxGeometry(120, 4, 20), pos: [0, -22, 178] },
        { geo: new THREE.BoxGeometry(110, 3, 14), pos: [0, -13, 172] },
        { geo: new THREE.BoxGeometry(4, 18, 20), pos: [-58, -14, 178] },
        { geo: new THREE.BoxGeometry(4, 18, 20), pos: [58, -14, 178] },
        { geo: new THREE.BoxGeometry(2, 10, 14), pos: [-25, -28, 175] },
        { geo: new THREE.BoxGeometry(2, 10, 14), pos: [25, -28, 175] },
      ],
    },
    { // 1: Data Hub — halo & cockpit
      color: 0x7dd3fc,
      pieces: [
        { geo: new THREE.BoxGeometry(66, 20, 130), pos: [0, 8, 10] },
        { geo: new THREE.TorusGeometry(24, 3, 6, 14), pos: [0, 44, 30], rot: [1.15, 0, 0] },
        { geo: new THREE.TorusGeometry(20, 2, 6, 12), pos: [0, 14, 35], rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.CylinderGeometry(2.5, 2.5, 46, 8), pos: [0, 26, 56], rot: [0.55, 0, 0] },
        { geo: new THREE.CylinderGeometry(2, 2, 36, 8), pos: [-17, 26, 12], rot: [0, 0, 0.4] },
        { geo: new THREE.CylinderGeometry(2, 2, 36, 8), pos: [17, 26, 12], rot: [0, 0, -0.4] },
      ],
    },
    { // 2: Legends — steering wheel
      color: 0xd4af37,
      pieces: [
        { geo: new THREE.TorusGeometry(16, 2.6, 6, 16, Math.PI * 1.6), pos: [0, 22, 60], rot: [0, 0, -0.9] },
        { geo: new THREE.CylinderGeometry(6, 6, 5, 10), pos: [0, 22, 60], rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.BoxGeometry(10, 6, 1), pos: [0, 22, 64] },
        { geo: new THREE.BoxGeometry(4, 2, 2), pos: [-9, 26, 62] },
        { geo: new THREE.BoxGeometry(4, 2, 2), pos: [9, 26, 62] },
        { geo: new THREE.CylinderGeometry(1.5, 1.5, 2, 8), pos: [-6, 18, 63], rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.CylinderGeometry(1.5, 1.5, 2, 8), pos: [6, 18, 63], rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.BoxGeometry(3, 1, 9), pos: [-14, 20, 55], rot: [0, 0.3, 0] },
        { geo: new THREE.BoxGeometry(3, 1, 9), pos: [14, 20, 55], rot: [0, -0.3, 0] },
      ],
    },
    { // 3: Constructors — sidepods & engine cover
      color: 0xff3b30,
      pieces: [
        { geo: new THREE.BoxGeometry(18, 22, 90), pos: [-42, -2, -20] },
        { geo: new THREE.BoxGeometry(18, 22, 90), pos: [42, -2, -20] },
        { geo: new THREE.BoxGeometry(12, 14, 8), pos: [-42, 0, 20] },
        { geo: new THREE.BoxGeometry(12, 14, 8), pos: [42, 0, 20] },
        { geo: new THREE.BoxGeometry(44, 16, 100), pos: [0, 18, -40] },
        { geo: new THREE.BoxGeometry(40, 1, 6), pos: [0, 27, -30] },
        { geo: new THREE.BoxGeometry(40, 1, 6), pos: [0, 30, -42] },
        { geo: new THREE.BoxGeometry(40, 1, 6), pos: [0, 33, -54] },
      ],
    },
    { // 4: Circuits — wheels & tyres
      color: 0x7dd3fc,
      pieces: [
        { geo: new THREE.CylinderGeometry(26, 26, 20, 14), pos: [-62, -30, 120], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(26, 26, 20, 14), pos: [62, -30, 120], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(28, 28, 22, 14), pos: [-65, -32, -110], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(28, 28, 22, 14), pos: [65, -32, -110], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(14, 14, 22, 10), pos: [-62, -30, 120], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(14, 14, 22, 10), pos: [62, -30, 120], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(15, 15, 24, 10), pos: [-65, -32, -110], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.CylinderGeometry(15, 15, 24, 10), pos: [65, -32, -110], rot: [0, 0, Math.PI / 2] },
        { geo: new THREE.BoxGeometry(10, 10, 6), pos: [-62, -30, 135] },
        { geo: new THREE.BoxGeometry(10, 10, 6), pos: [62, -30, 135] },
      ],
    },
    { // 5: Timeline — rear wing & diffuser
      color: 0xd4af37,
      pieces: [
        { geo: new THREE.BoxGeometry(90, 5, 18), pos: [0, 55, -165] },
        { geo: new THREE.BoxGeometry(85, 3, 14), pos: [0, 45, -160] },
        { geo: new THREE.BoxGeometry(4, 30, 4), pos: [-30, 38, -165] },
        { geo: new THREE.BoxGeometry(4, 30, 4), pos: [30, 38, -165] },
        { geo: new THREE.BoxGeometry(3, 24, 20), pos: [-46, 50, -165] },
        { geo: new THREE.BoxGeometry(3, 24, 20), pos: [46, 50, -165] },
        { geo: new THREE.BoxGeometry(70, 14, 40), pos: [0, -28, -170], rot: [0.3, 0, 0] },
        { geo: new THREE.BoxGeometry(2, 10, 35), pos: [-20, -24, -168] },
        { geo: new THREE.BoxGeometry(2, 10, 35), pos: [0, -24, -168] },
        { geo: new THREE.BoxGeometry(2, 10, 35), pos: [20, -24, -168] },
      ],
    },
  ];

  function buildCarPart({ color, pieces }) {
    const group = new THREE.Group();
    const lineMats = [];
    const fillMats = [];
    pieces.forEach(({ geo, pos = [0, 0, 0], rot = [0, 0, 0] }) => {
      const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
      const lines = new THREE.LineSegments(new THREE.WireframeGeometry(geo), lineMat);
      const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.BackSide });
      const fill = new THREE.Mesh(geo, fillMat);
      const piece = new THREE.Group();
      piece.add(fill, lines);
      piece.position.set(...pos);
      piece.rotation.set(...rot);
      group.add(piece);
      lineMats.push(lineMat);
      fillMats.push(fillMat);
    });
    group.scale.setScalar(0);
    return { group, lineMats, fillMats };
  }

  const carRig = new THREE.Group();
  scene.add(carRig);

  const carParts = CAR_PART_DEFS.map((def, i) => {
    const part = buildCarPart(def);
    part.dockedPos = DOCKED_POSITIONS[i];
    carRig.add(part.group);
    return part;
  });

  function dockAllPartsImmediately() {
    carParts.forEach(({ group, dockedPos }) => {
      scene.attach(group);
      group.position.set(dockedPos[0], dockedPos[1], dockedPos[2]);
      group.scale.setScalar(PART_SCALE);
      group.rotation.set(0, 0, 0);
    });
  }

  const dataReadyPromise = new Promise((resolve) => {
    window.addEventListener('f1-data-ready', () => resolve(), { once: true });
  });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- Loading screen percentage ---------- */
  const loaderPercentEl = document.getElementById('loader-percent');
  const loaderBarEl = document.getElementById('loader-bar');
  const loaderCounter = { val: 0 };
  const updateLoaderDom = () => {
    const v = Math.round(loaderCounter.val);
    if (loaderPercentEl) loaderPercentEl.textContent = v + '%';
    if (loaderBarEl) loaderBarEl.style.width = v + '%';
  };
  const animateLoaderTo = (val, duration) => {
    if (!window.anime) { loaderCounter.val = val; updateLoaderDom(); return Promise.resolve(); }
    return window.anime({
      targets: loaderCounter,
      val,
      duration,
      easing: 'easeOutCubic',
      update: updateLoaderDom,
    }).finished;
  };

  let introComplete = false;

  async function playIntro() {
    if (reduceMotion || !window.anime) {
      dockAllPartsImmediately();
      revealEverythingNow();
      introComplete = true;
      return;
    }
    try {
      carRig.position.set(0, 15, -70);

      // Scale still ramps 0→1 per part below, so nothing is visible yet —
      // but opacity has to be non-zero *now*, or the whole build/drive/
      // scatter sequence renders invisibly even as it moves.
      const visibleLine = 0.85;
      const visibleFill = 0.08;
      carParts.forEach((p) => {
        p.lineMats.forEach((m) => { m.opacity = visibleLine; });
        p.fillMats.forEach((m) => { m.opacity = visibleFill; });
      });

      // BUILD — parts settle into their assembled position one after
      // another, on top of the loader; percentage climbs to 96% here and
      // holds — it only completes once the live data actually resolves.
      const buildScale = anime({
        targets: carParts.map((p) => p.group.scale),
        x: [0, 1], y: [0, 1], z: [0, 1],
        duration: 550,
        delay: anime.stagger(110),
        easing: 'easeOutBack',
      });
      const buildSpin = anime({
        targets: carParts.map((p) => p.group.rotation),
        y: [Math.PI * 1.1, 0],
        duration: 550,
        delay: anime.stagger(110),
        easing: 'easeOutBack',
      });
      await Promise.all([buildScale.finished, buildSpin.finished, animateLoaderTo(96, 950)]);

      await Promise.race([dataReadyPromise, wait(8500)]);
      await animateLoaderTo(100, 250);
      await wait(250);

      // Loader dismisses; the car (already fully built) is now visible
      // against the actual page background as it drives across.
      html.classList.remove('js-loading');

      const drive = anime.timeline()
        .add({ targets: carRig.position, x: -550, duration: 500, easing: 'easeInQuad' })
        .add({ targets: carRig.position, x: 550, duration: 900, easing: 'easeInOutSine', begin: () => { boost = 4; } })
        .add({ targets: carRig.position, x: 300, duration: 400, easing: 'easeOutQuad' });
      await drive.finished;

      // SCATTER — the car dissects; each part flies out, staggered and in
      // order, to its own section's spot on the page.
      carParts.forEach(({ group }) => scene.attach(group));
      const scatterMove = anime({
        targets: carParts.map((p) => p.group.position),
        x: (el, i) => carParts[i].dockedPos[0],
        y: (el, i) => carParts[i].dockedPos[1],
        z: (el, i) => carParts[i].dockedPos[2],
        delay: anime.stagger(150),
        duration: 750,
        easing: 'easeOutExpo',
      });
      const scatterScale = anime({
        targets: carParts.map((p) => p.group.scale),
        x: PART_SCALE, y: PART_SCALE, z: PART_SCALE,
        delay: anime.stagger(150),
        duration: 750,
        easing: 'easeOutExpo',
      });
      const scatterSpin = anime({
        targets: carParts.map((p) => p.group.rotation),
        y: (el, i) => `+=${(i % 2 === 0 ? 1 : -1) * (Math.PI * 2 + Math.random() * Math.PI)}`,
        delay: anime.stagger(150),
        duration: 750,
        easing: 'easeOutExpo',
      });
      await Promise.all([scatterMove.finished, scatterScale.finished, scatterSpin.finished]);

      // Parts are still and docked — reveal the actual site content.
      revealEverythingNow();
    } catch (err) {
      dockAllPartsImmediately();
      revealEverythingNow();
    } finally {
      introComplete = true;
    }
  }

  let activeSection = 0;
  const updateActiveSection = () => {
    const probeY = window.innerHeight * 0.45;
    let closestIdx = 0;
    let closestDist = Infinity;
    sectionEls.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(mid - probeY);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });
    activeSection = closestIdx;
  };
  window.addEventListener('scroll', updateActiveSection, { passive: true });
  updateActiveSection();

  /* ---------- Part spotlight HUD — only shows when the cursor is actually
   * near the active part, not just because its section is in view. ---------- */
  const spotlightEl = document.getElementById('part-spotlight');
  const spotlightLabelEl = document.getElementById('part-spotlight-label');
  const spotlightTitleEl = document.getElementById('part-spotlight-title');
  const spotlightFactEl = document.getElementById('part-spotlight-fact');
  let spotlightOpacity = 0;
  let lastSpotlightSection = -1;

  const mousePx = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  window.addEventListener('mousemove', (e) => {
    mousePx.x = e.clientX;
    mousePx.y = e.clientY;
  }, { passive: true });
  const projected = new THREE.Vector3();

  let themeOpacityScale = 1;

  const applyTheme = (theme) => {
    const isLight = theme === 'light';
    material.uniforms.uOpacity.value = isLight ? 0.5 : 0.85;
    material.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    material.needsUpdate = true;
    themeOpacityScale = isLight ? 0.6 : 1;
  };
  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  window.addEventListener('f1-theme-change', (e) => applyTheme(e.detail.theme));

  const pointerTarget = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let lastScrollY = window.scrollY;
  let scrollFrac = 0;
  let boost = 0;
  const readScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    scrollFrac = max > 0 ? window.scrollY / max : 0;
    boost = Math.min(boost + Math.abs(window.scrollY - lastScrollY) * 0.015, 4);
    lastScrollY = window.scrollY;
  };
  window.addEventListener('scroll', readScroll, { passive: true });

  const onResize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  };
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();

  const tick = () => {
    requestAnimationFrame(tick);
    if (document.hidden) return;

    const t = clock.getElapsedTime();
    pointer.x += (pointerTarget.x - pointer.x) * 0.04;
    pointer.y += (pointerTarget.y - pointer.y) * 0.04;

    if (!reduceMotion) {
      material.uniforms.uTime.value = t;
      particleGroup.rotation.y = t * 0.025 + scrollFrac * Math.PI * 0.6 + pointer.x * 0.25;
      particleGroup.rotation.x = pointer.y * 0.15 + Math.sin(t * 0.12) * 0.03;
      camera.position.z = 620 - boost * 16;
      boost *= 0.92;
    } else {
      particleGroup.rotation.y = scrollFrac * Math.PI * 0.4;
    }

    if (introComplete) {
      const activePart = carParts[activeSection];
      let nearCursor = false;

      // Parts sit still once docked — no auto-rotation, no scroll drift.
      // The only motion is a direct response to the cursor, so it reads as
      // "you're interacting with it" rather than ambient fidgeting.
      if (activePart) {
        projected.copy(activePart.group.position).project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * width;
        const screenY = (-projected.y * 0.5 + 0.5) * height;
        const dx = mousePx.x - screenX;
        const dy = mousePx.y - screenY;
        nearCursor = Math.sqrt(dx * dx + dy * dy) < 280;
      }

      if (activeSection !== lastSpotlightSection) {
        lastSpotlightSection = activeSection;
        const info = PART_INFO[activeSection];
        if (info && spotlightLabelEl) {
          spotlightLabelEl.textContent = info.label;
          spotlightTitleEl.textContent = info.title;
          spotlightFactEl.textContent = info.fact;
        }
      }
      const spotlightTarget = nearCursor ? 1 : 0;
      spotlightOpacity += (spotlightTarget - spotlightOpacity) * 0.08;
      if (spotlightEl) spotlightEl.style.opacity = String(spotlightOpacity);

      carParts.forEach(({ group, lineMats, fillMats, dockedPos }, i) => {
        const isActive = i === activeSection;
        const targetLine = isActive ? 0.9 * themeOpacityScale : 0;
        const targetFill = isActive ? 0.09 * themeOpacityScale : 0;
        lineMats.forEach((m) => { m.opacity += (targetLine - m.opacity) * 0.06; });
        fillMats.forEach((m) => { m.opacity += (targetFill - m.opacity) * 0.06; });

        group.position.y += (dockedPos[1] - group.position.y) * 0.08;

        if (isActive) {
          const targetScale = nearCursor ? PART_SCALE * 1.1 : PART_SCALE;
          group.scale.x += (targetScale - group.scale.x) * 0.08;
          group.scale.y = group.scale.z = group.scale.x;
          if (!reduceMotion) {
            group.rotation.x += (pointer.y * 0.22 - group.rotation.x) * 0.06;
            group.rotation.z += (pointer.x * 0.16 - group.rotation.z) * 0.06;
          }
        } else {
          group.scale.x += (PART_SCALE - group.scale.x) * 0.06;
          group.scale.y = group.scale.z = group.scale.x;
          group.rotation.x += (0 - group.rotation.x) * 0.06;
          group.rotation.z += (0 - group.rotation.z) * 0.06;
        }
      });
    }

    renderer.render(scene, camera);
  };
  tick();
  playIntro();
})();
