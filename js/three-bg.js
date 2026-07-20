import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
  const mount = document.getElementById('bg-canvas');
  if (!mount) return;

  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
  if (!gl) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PARTICLE_COUNT = window.innerWidth < 768 ? 900 : 1800;
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
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(width, height);
  mount.appendChild(renderer.domElement);

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 1700;
    positions[i3 + 1] = (Math.random() - 0.5) * 1200;
    positions[i3 + 2] = (Math.random() - 0.5) * 1500;
    tmpColor.set(palette[Math.floor(Math.random() * palette.length)]);
    colors[i3] = tmpColor.r;
    colors[i3 + 1] = tmpColor.g;
    colors[i3 + 2] = tmpColor.b;
    seeds[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  // Drift is computed on the GPU from uTime + a per-vertex seed, so the CPU
  // never has to rewrite/re-upload the position buffer every frame.
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
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec3 p = position;
        p.x += cos(uTime * 0.35 + aSeed) * 8.0;
        p.y += sin(uTime * 0.5 + aSeed) * 14.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 2.6 * uPixelRatio * (300.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * uOpacity;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const group = new THREE.Group();
  group.add(new THREE.Points(geometry, material));
  scene.add(group);

  const applyTheme = (theme) => {
    const isLight = theme === 'light';
    material.uniforms.uOpacity.value = isLight ? 0.5 : 0.85;
    material.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    material.needsUpdate = true;
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
      group.rotation.y = t * 0.025 + scrollFrac * Math.PI * 0.6 + pointer.x * 0.25;
      group.rotation.x = pointer.y * 0.15 + Math.sin(t * 0.12) * 0.03;
      camera.position.z = 620 - boost * 16;
      boost *= 0.92;
    } else {
      group.rotation.y = scrollFrac * Math.PI * 0.4;
    }

    renderer.render(scene, camera);
  };
  tick();
})();
