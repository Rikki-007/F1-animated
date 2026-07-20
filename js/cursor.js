document.addEventListener('DOMContentLoaded', () => {
  const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!supportsFinePointer) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.add('has-custom-cursor');

  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  const DOT_SIZE = 8;
  const RING_SIZE = 34;

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const ringPos = { ...pos };
  let ringScale = 1;
  let targetScale = 1;

  const place = () => {
    dot.style.transform = `translate(${pos.x - DOT_SIZE / 2}px, ${pos.y - DOT_SIZE / 2}px)`;
    ring.style.transform = `translate(${ringPos.x - RING_SIZE / 2}px, ${ringPos.y - RING_SIZE / 2}px) scale(${ringScale})`;
  };
  place();

  window.addEventListener('mousemove', (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    dot.style.opacity = '1';
    ring.style.opacity = '1';
    dot.style.transform = `translate(${pos.x - DOT_SIZE / 2}px, ${pos.y - DOT_SIZE / 2}px)`;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });

  const hoverables = document.querySelectorAll('a, button, select, .card-tilt, .standings-row');
  hoverables.forEach((el) => {
    el.addEventListener('mouseenter', () => {
      targetScale = 1.6;
      ring.classList.add('cursor-ring--active');
    });
    el.addEventListener('mouseleave', () => {
      targetScale = 1;
      ring.classList.remove('cursor-ring--active');
    });
  });

  const tick = () => {
    const ease = reduceMotion ? 1 : 0.18;
    ringPos.x += (pos.x - ringPos.x) * ease;
    ringPos.y += (pos.y - ringPos.y) * ease;
    ringScale += (targetScale - ringScale) * 0.2;
    ring.style.transform = `translate(${ringPos.x - RING_SIZE / 2}px, ${ringPos.y - RING_SIZE / 2}px) scale(${ringScale})`;
    requestAnimationFrame(tick);
  };
  tick();

  if (!reduceMotion && window.anime) {
    document.querySelectorAll('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const relX = e.clientX - rect.left - rect.width / 2;
        const relY = e.clientY - rect.top - rect.height / 2;
        anime({
          targets: el,
          translateX: relX * 0.35,
          translateY: relY * 0.35,
          duration: 300,
          easing: 'easeOutQuad',
        });
      });
      el.addEventListener('mouseleave', () => {
        anime({
          targets: el,
          translateX: 0,
          translateY: 0,
          duration: 500,
          easing: 'easeOutElastic(1, .5)',
        });
      });
    });
  }
});
