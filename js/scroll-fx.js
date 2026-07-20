document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const progressBar = document.getElementById('scroll-progress');
  const heroSection = document.getElementById('overview');
  const heroContent = heroSection ? heroSection.querySelector(':scope > .max-w-7xl') : null;

  let heroHeight = heroSection ? heroSection.offsetHeight : 0;
  const measure = () => { heroHeight = heroSection ? heroSection.offsetHeight : 0; };

  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const frac = max > 0 ? window.scrollY / max : 0;
    if (progressBar) progressBar.style.width = `${frac * 100}%`;

    if (heroContent && !reduceMotion && heroHeight > 0) {
      const progress = Math.min(1, Math.max(0, window.scrollY / heroHeight));
      heroContent.style.transform = `translateY(${progress * 60}px)`;
      heroContent.style.opacity = `${1 - progress * 0.8}`;
    }
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  update();
});
