import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

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

  /* ================= F1 car: real GLB model, exploded-view rig ==================
   * assets/f1_car.glb is an 11-mesh model (Object_0..Object_10) with no
   * per-mesh naming/metadata distinguishing which real car component each
   * one is — it's the output of an STL cleanup/material-merge pipeline, not
   * an authored, labelled car-parts scene. So instead of claiming mesh N
   * "is" the front wing (which would be fabricated), each mesh is treated
   * as its own generic component slot, cycled through by overall scroll
   * position (not tied to the page's 6 content sections). Each part's
   * "exploded" position is computed from its own geometry — the direction
   * from the whole model's center through that mesh's own center — rather
   * than hand-authored per-part coordinates. */
  const MODEL_URL = './assets/f1_car.glb';
  const CAR_COLOR = 0xe10600;
  const NORMALIZED_LENGTH = 300; // world units, matches the previous hand-built car's scale
  const EXPLODE_DISTANCE = 150;
  const SCATTER_ANCHOR = new THREE.Vector3(150, 20, -40); // keeps the exploded cluster in the same "main focus" spot used before
  const PART_SCALE = 1.9;

  const PART_INFO = [
    { label: 'COMPONENT 01', title: 'Precision Composite Structure', fact: 'Modern F1 bodywork is almost entirely carbon-fibre composite — around five times stronger than steel at a fraction of the weight.' },
    { label: 'COMPONENT 02', title: 'Aerodynamic Load Path', fact: 'Every exterior surface on an F1 car is shaped to manage airflow — nothing is purely cosmetic.' },
    { label: 'COMPONENT 03', title: 'Sub-Millimetre Tolerances', fact: 'F1 components are machined to tolerances as fine as 5 microns — a fraction of the width of a human hair.' },
    { label: 'COMPONENT 04', title: 'Built for Rapid Replacement', fact: 'Teams can strip and rebuild major bodywork sections in a pit stop lasting under three seconds.' },
    { label: 'COMPONENT 05', title: 'Heat Under Pressure', fact: 'Surface temperatures across the car can exceed 200°C during a race, driving every material choice.' },
    { label: 'COMPONENT 06', title: 'CFD-Validated Geometry', fact: 'Teams run millions of core-hours of computational fluid dynamics before a single part is machined.' },
    { label: 'COMPONENT 07', title: 'Structural Crash Protection', fact: 'The survival cell alone must pass over a dozen FIA crash tests before a chassis is homologated.' },
    { label: 'COMPONENT 08', title: 'Weight Distribution', fact: 'Teams add ballast to hit the minimum weight limit precisely where it helps balance, not just to reach the number.' },
    { label: 'COMPONENT 09', title: 'Vibration-Tuned Mounting', fact: 'Components are mounted to damp resonance from an engine spinning past 10,000 RPM.' },
    { label: 'COMPONENT 10', title: 'Regulated Geometry', fact: 'Every surface sits inside FIA-mandated bodywork boxes — even a few millimetres out of spec voids a part.' },
    { label: 'COMPONENT 11', title: 'The Final Assembly', fact: 'A complete F1 car is built from roughly 80,000 individual components, all engineered to work as one system.' },
  ];

  const carRig = new THREE.Group();
  scene.add(carRig);

  let carParts = [];

  function processModel(gltf) {
    const root = gltf.scene;
    carRig.add(root);

    // Normalize scale + center so the model fits the same visual footprint
    // as the rest of the scene, regardless of the source file's own units.
    const rawBox = new THREE.Box3().setFromObject(root);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const rawCenter = rawBox.getCenter(new THREE.Vector3());
    const longest = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;
    const scale = NORMALIZED_LENGTH / longest;
    root.scale.setScalar(scale);
    root.position.set(-rawCenter.x * scale, -rawCenter.y * scale, -rawCenter.z * scale);
    root.updateMatrixWorld(true);

    const meshes = [];
    root.traverse((child) => { if (child.isMesh) meshes.push(child); });

    const modelBox = new THREE.Box3().setFromObject(root);
    const modelCenter = modelBox.getCenter(new THREE.Vector3());
    const boxTmp = new THREE.Box3();
    const centerTmp = new THREE.Vector3();

    carParts = meshes.map((mesh) => {
      // Pull this mesh out of the model's original (arbitrarily deep)
      // node hierarchy into its own group directly under carRig, preserving
      // its current world transform — so it can be freely animated
      // (BUILD scale, SCATTER position) independent of its GLB siblings.
      const group = new THREE.Group();
      carRig.add(group);
      group.attach(mesh);
      const restPos = group.position.clone();

      boxTmp.setFromObject(mesh);
      boxTmp.getCenter(centerTmp);
      const dir = centerTmp.clone().sub(modelCenter);
      if (dir.lengthSq() < 1) {
        dir.set(Math.random() - 0.5, Math.random() * 0.5 + 0.1, Math.random() - 0.5);
      }
      dir.normalize();
      const dockedVec = restPos.clone().add(dir.multiplyScalar(EXPLODE_DISTANCE)).add(SCATTER_ANCHOR);

      const lineMat = new THREE.MeshBasicMaterial({ color: CAR_COLOR, wireframe: true, transparent: true, opacity: 0 });
      mesh.material = lineMat;

      const fillMat = new THREE.MeshBasicMaterial({ color: CAR_COLOR, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false });
      const fillMesh = new THREE.Mesh(mesh.geometry, fillMat);
      fillMesh.position.copy(mesh.position);
      fillMesh.rotation.copy(mesh.rotation);
      fillMesh.scale.copy(mesh.scale);
      group.add(fillMesh);

      group.scale.setScalar(0);

      return {
        group,
        lineMats: [lineMat],
        fillMats: [fillMat],
        restPos: [restPos.x, restPos.y, restPos.z],
        dockedPos: [dockedVec.x, dockedVec.y, dockedVec.z],
      };
    });
  }

  function dockAllPartsImmediately() {
    // Called from multiple points (reduced-motion skip, any error in the
    // BUILD/DRIVE/SCATTER sequence) — group may still be carRig-local at
    // that moment, so re-parent to the scene first to guarantee dockedPos
    // (an absolute coordinate) lands correctly regardless of carRig's
    // current position.
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

  // Real download/parse progress drives 0->90%; the remaining 90->100% is
  // reserved for the live-standings gate below, same as before.
  const modelReadyPromise = (async () => {
    // The optimized GLB (4MB vs. ~38MB uncompressed) uses meshopt geometry
    // compression. Registering the decoder isn't enough on its own — the
    // extension also checks `decoder.supported`, which only flips true once
    // the decoder's WASM has finished initializing, so `.ready` has to be
    // awaited *before* load() or every mesh fails with "setMeshoptDecoder
    // must be called before loading compressed files" even though it was.
    await MeshoptDecoder.ready;
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        MODEL_URL,
        (gltf) => {
          try {
            processModel(gltf);
            if (loaderCounter.val < 90) { loaderCounter.val = 90; updateLoaderDom(); }
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            loaderCounter.val = Math.min(90, (xhr.loaded / xhr.total) * 90);
            updateLoaderDom();
          }
        },
        (err) => reject(err)
      );
    });
  })();

  let introComplete = false;

  async function playIntro() {
    try {
      await modelReadyPromise;
    } catch (err) {
      console.warn('[three-bg] Failed to load F1 car model:', err);
      revealEverythingNow();
      introComplete = true;
      return;
    }

    if (reduceMotion || !window.anime) {
      dockAllPartsImmediately();
      revealEverythingNow();
      introComplete = true;
      return;
    }

    try {
      // Scale still ramps 0→1 per part below, so nothing is visible yet —
      // but opacity has to be non-zero *now*, or the whole build/drive/
      // scatter sequence renders invisibly even as it moves.
      carParts.forEach((p) => {
        p.lineMats.forEach((m) => { m.opacity = 0.85; });
        p.fillMats.forEach((m) => { m.opacity = 0.08; });
      });

      // BUILD — parts settle into their assembled (native) position one
      // after another, on top of the loader.
      const buildScale = anime({
        targets: carParts.map((p) => p.group.scale),
        x: [0, 1], y: [0, 1], z: [0, 1],
        duration: 550,
        delay: anime.stagger(70),
        easing: 'easeOutBack',
      });
      const buildSpin = anime({
        targets: carParts.map((p) => p.group.rotation),
        y: [Math.PI * 1.1, 0],
        duration: 550,
        delay: anime.stagger(70),
        easing: 'easeOutBack',
      });
      await Promise.all([buildScale.finished, buildSpin.finished, animateLoaderTo(96, 700)]);

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

      // SCATTER — the car dissects; each part flies out, staggered, to its
      // own exploded-view slot (computed from its own geometry above).
      // Re-parent to the scene first: dockedPos is an absolute coordinate,
      // but group.position is still carRig-local at this point, and carRig
      // itself just moved during DRIVE — without this, every part would
      // land offset by wherever DRIVE ended instead of at its real slot.
      carParts.forEach(({ group }) => scene.attach(group));
      const scatterMove = anime({
        targets: carParts.map((p) => p.group.position),
        x: (el, i) => carParts[i].dockedPos[0],
        y: (el, i) => carParts[i].dockedPos[1],
        z: (el, i) => carParts[i].dockedPos[2],
        delay: anime.stagger(90),
        duration: 750,
        easing: 'easeOutExpo',
      });
      const scatterScale = anime({
        targets: carParts.map((p) => p.group.scale),
        x: PART_SCALE, y: PART_SCALE, z: PART_SCALE,
        delay: anime.stagger(90),
        duration: 750,
        easing: 'easeOutExpo',
      });
      const scatterSpin = anime({
        targets: carParts.map((p) => p.group.rotation),
        y: (el, i) => `+=${(i % 2 === 0 ? 1 : -1) * (Math.PI * 2 + Math.random() * Math.PI)}`,
        delay: anime.stagger(90),
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

  // Which of the 11 parts is "active" is driven by overall scroll progress
  // through the whole page, split into 11 even slots — independent of the
  // page's 6 content sections.
  let activeIndex = 0;
  const updateActiveIndex = () => {
    if (!carParts.length) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const frac = max > 0 ? window.scrollY / max : 0;
    activeIndex = Math.min(carParts.length - 1, Math.floor(frac * carParts.length));
  };
  window.addEventListener('scroll', updateActiveIndex, { passive: true });

  /* ---------- Part spotlight HUD — only shows when the cursor is actually
   * near the active part, not just because it's the active scroll slot. ---------- */
  const spotlightEl = document.getElementById('part-spotlight');
  const spotlightLabelEl = document.getElementById('part-spotlight-label');
  const spotlightTitleEl = document.getElementById('part-spotlight-title');
  const spotlightFactEl = document.getElementById('part-spotlight-fact');
  let spotlightOpacity = 0;
  let lastSpotlightIndex = -1;

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

    if (introComplete && carParts.length) {
      const activePart = carParts[activeIndex];
      let nearCursor = false;

      // Parts sit still once docked — no auto-rotation, no scroll drift.
      // The only motion is a direct response to the cursor.
      if (activePart) {
        projected.copy(activePart.group.position).project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * width;
        const screenY = (-projected.y * 0.5 + 0.5) * height;
        const dx = mousePx.x - screenX;
        const dy = mousePx.y - screenY;
        nearCursor = Math.sqrt(dx * dx + dy * dy) < 280;
      }

      if (activeIndex !== lastSpotlightIndex) {
        lastSpotlightIndex = activeIndex;
        const info = PART_INFO[activeIndex];
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
        const isActive = i === activeIndex;
        const targetLine = isActive ? 0.9 * themeOpacityScale : 0;
        const targetFill = isActive ? 0.09 * themeOpacityScale : 0;
        lineMats.forEach((m) => { m.opacity += (targetLine - m.opacity) * 0.06; });
        fillMats.forEach((m) => { m.opacity += (targetFill - m.opacity) * 0.06; });

        group.position.y += (dockedPos[1] - group.position.y) * 0.08;

        if (isActive) {
          // Major hover-zoom: the isolated part expands fluidly toward the
          // viewer when the cursor is near it.
          const targetScale = nearCursor ? PART_SCALE * 1.55 : PART_SCALE;
          group.scale.x += (targetScale - group.scale.x) * 0.08;
          group.scale.y = group.scale.z = group.scale.x;
          if (!reduceMotion) {
            // Micro-rotation toward the cursor — feels like tilting the
            // physical piece in your hand.
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
  updateActiveIndex();
  playIntro();
})();
