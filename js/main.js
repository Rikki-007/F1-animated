document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Theme toggle ---------- */
  const html = document.documentElement;
  const toggleBtn = document.getElementById('theme-toggle');
  const iconSun = document.getElementById('icon-sun');
  const iconMoon = document.getElementById('icon-moon');

  const syncIcons = (theme) => {
    iconSun.classList.toggle('hidden', theme === 'light');
    iconMoon.classList.toggle('hidden', theme !== 'light');
  };
  syncIcons(html.getAttribute('data-theme') || 'dark');

  toggleBtn.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('f1-theme', next);
    syncIcons(next);
    window.dispatchEvent(new CustomEvent('f1-theme-change', { detail: { theme: next } }));
    anime({
      targets: toggleBtn,
      rotate: next === 'light' ? [0, 180] : [0, -180],
      scale: [1, 1.15, 1],
      duration: 500,
      easing: 'easeOutBack',
    });
  });

  /* ---------- Hero reveal ---------- */
  anime.timeline({ easing: 'easeOutExpo' })
    .add({ targets: '#hero-eyebrow', opacity: [0,1], translateY: [16,0], duration: 700 })
    .add({ targets: '#hero-l1', opacity: [0,1], translateY: [40,0], duration: 800 }, '-=450')
    .add({ targets: '#hero-l2', opacity: [0,1], translateY: [40,0], duration: 800 }, '-=600')
    .add({ targets: '#hero-sub', opacity: [0,1], translateY: [24,0], duration: 700 }, '-=500')
    .add({ targets: '#hero-panel', opacity: [0,1], translateY: [24,0], scale: [0.96,1], duration: 700 }, '-=600')
    .add({ targets: '#nav-logo, #nav-links a', opacity: [0,1], translateY: [-10,0], duration: 500, delay: anime.stagger(60) }, '-=900');

  /* hero counter */
  const heroCounter = { val: 0 };
  anime({
    targets: heroCounter,
    val: 75,
    round: 1,
    duration: 1800,
    delay: 600,
    easing: 'easeOutCubic',
    update: () => document.getElementById('hero-counter').textContent = heroCounter.val,
  });
  anime({
    targets: '#hero-bar',
    width: ['0%','100%'],
    duration: 1800,
    delay: 600,
    easing: 'easeOutCubic',
  });

  /* marquee scroll */
  anime({
    targets: '#marquee',
    translateX: '-50%',
    duration: 22000,
    easing: 'linear',
    loop: true,
  });

  /* ---------- Scroll reveal via IntersectionObserver ---------- */
  const revealGroup = (selector, animProps) => {
    const els = document.querySelectorAll(selector);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          anime({ targets: entry.target, ...animProps });
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    els.forEach((el) => io.observe(el));
  };

  revealGroup('.reveal-h', {
    opacity: [0,1], translateY: [24,0], duration: 700, easing: 'easeOutExpo',
  });

  revealGroup('.reveal-stat', {
    opacity: [0,1], translateY: [30,0], duration: 700, easing: 'easeOutExpo', delay: anime.stagger(100),
  });

  revealGroup('.driver-card', {
    opacity: [0,1], translateY: [40,0], scale: [0.96,1], duration: 800, easing: 'easeOutExpo', delay: anime.stagger(120),
  });

  revealGroup('.circuit-card', {
    opacity: [0,1], translateY: [40,0], duration: 800, easing: 'easeOutExpo', delay: anime.stagger(120),
  });

  revealGroup('.timeline-item', {
    opacity: [0,1], translateX: [-24,0], duration: 700, easing: 'easeOutExpo', delay: anime.stagger(150),
  });

  document.querySelectorAll('.reveal-stat, .driver-card, .circuit-card, .timeline-item').forEach(el => el.style.opacity = 0);

  /* ---------- Animated stat numbers ---------- */
  const statEls = document.querySelectorAll('.stat-num');
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.target);
      const decimal = el.dataset.decimal;
      const suffix = el.dataset.suffix || '';
      const obj = { val: 0 };
      anime({
        targets: obj,
        val: target,
        duration: 1600,
        easing: 'easeOutCubic',
        update: () => {
          if (decimal !== undefined) {
            el.textContent = obj.val.toFixed(0) + '.' + decimal + suffix;
          } else {
            el.textContent = Math.round(obj.val) + suffix;
          }
        },
      });
      statIO.unobserve(el);
    });
  }, { threshold: 0.4 });
  statEls.forEach((el) => statIO.observe(el));

  /* ---------- Team bar widths ---------- */
  const teamBars = document.querySelectorAll('.team-bar');
  const barIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      anime({
        targets: el,
        width: el.dataset.width + '%',
        duration: 1400,
        easing: 'easeOutExpo',
      });
      barIO.unobserve(el);
    });
  }, { threshold: 0.3 });
  teamBars.forEach((el) => barIO.observe(el));

  /* ---------- Card tilt on hover ---------- */
  const tiltEls = document.querySelectorAll('.card-tilt');
  tiltEls.forEach((card) => {
    card.style.transform = 'perspective(900px)';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y / rect.height) - 0.5) * -10;
      const rotateY = ((x / rect.width) - 0.5) * 10;
      anime({
        targets: card,
        rotateX,
        rotateY,
        scale: 1.02,
        duration: 300,
        easing: 'easeOutQuad',
      });
    });
    card.addEventListener('mouseleave', () => {
      anime({
        targets: card,
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        duration: 500,
        easing: 'easeOutElastic(1, .6)',
      });
    });
  });

});
