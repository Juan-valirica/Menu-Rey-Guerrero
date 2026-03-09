/**
 * REY GUERRERO · MENÚ DIGITAL
 * main.js — Experiencia digital interactiva
 * Pacífico Colombiano · Cali
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════
   1. LOADER
═══════════════════════════════════════════════════════════════════ */
(function initLoader() {
  const loader    = document.getElementById('loader');
  const fillBar   = document.getElementById('loaderFill');
  if (!loader || !fillBar) return;

  let progress = 0;
  const tick = setInterval(() => {
    progress += Math.random() * 22;
    if (progress >= 100) {
      progress = 100;
      clearInterval(tick);
      fillBar.style.width = '100%';
      setTimeout(() => loader.classList.add('hidden'), 350);
    } else {
      fillBar.style.width = progress + '%';
    }
  }, 80);

  // Fallback: always hide after 2.5 s
  setTimeout(() => loader.classList.add('hidden'), 2500);
})();


/* ═══════════════════════════════════════════════════════════════════
   2. HERO CANVAS — Partículas flotantes (burbujas / mariposas de mar)
═══════════════════════════════════════════════════════════════════ */
(function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    createParticles();
  }

  /** Particle factory */
  function createParticles() {
    const count = Math.min(80, Math.floor((W * H) / 12000));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(makeParticle());
    }
  }

  function makeParticle(fromBottom = false) {
    const y = fromBottom ? H + 10 : Math.random() * H;
    return {
      x:     Math.random() * W,
      y,
      r:     1 + Math.random() * 3.5,
      vx:    (Math.random() - .5) * .35,
      vy:    -(.2 + Math.random() * .55),
      alpha: .08 + Math.random() * .25,
      hue:   120 + Math.random() * 60,      // greens → teals
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: .008 + Math.random() * .015,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    particles.forEach((p, i) => {
      p.pulse += p.pulseSpeed;
      const a = p.alpha * (.7 + .3 * Math.sin(p.pulse));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 60%, 65%, ${a})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      // Wrap horizontally
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;

      // Recycle if off top
      if (p.y < -10) {
        particles[i] = makeParticle(true);
      }
    });

    requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement || canvas);
  resize();
  draw();
})();


/* ═══════════════════════════════════════════════════════════════════
   3. SCROLL PROGRESS BAR
═══════════════════════════════════════════════════════════════════ */
(function initScrollProgress() {
  const bar = document.getElementById('scrollBar');
  if (!bar) return;

  function update() {
    const scrollTop  = window.scrollY;
    const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    const pct        = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width  = pct + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();


/* ═══════════════════════════════════════════════════════════════════
   4. SECTION INTERSECTION — accent color + nav + bg tint
═══════════════════════════════════════════════════════════════════ */
(function initSectionObserver() {
  const sections  = document.querySelectorAll('.menu-section, .hero');
  const catLinks  = document.querySelectorAll('.cat-link');
  const dots      = document.querySelectorAll('.dot');
  const catNav    = document.getElementById('catNav');
  const root      = document.documentElement;

  function slugOf(sec) {
    return sec.id || '';
  }

  function setActive(id) {
    catLinks.forEach(l => l.classList.toggle('active', l.dataset.sec === id));
    dots.forEach(d => {
      const href = d.getAttribute('href') || '';
      d.classList.toggle('active', href === '#' + id);
    });
  }

  function setAccent(section) {
    const color = section.dataset.accent;
    if (color) {
      root.style.setProperty('--accent', color);
      const bar = document.getElementById('scrollBar');
      if (bar) bar.style.background =
        `linear-gradient(90deg, ${color}88, ${color})`;
    }
  }

  // Show/hide cat-nav after scrolling past hero
  const hero = document.querySelector('.hero');
  let heroBottom = 0;
  function updateHeroBottom() {
    heroBottom = hero ? hero.offsetHeight : 300;
  }
  updateHeroBottom();
  window.addEventListener('resize', updateHeroBottom);

  window.addEventListener('scroll', () => {
    if (catNav) {
      catNav.classList.toggle('visible', window.scrollY > heroBottom * .6);
    }
  }, { passive: true });

  // IntersectionObserver for section activation
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = slugOf(entry.target);
        setActive(id);
        setAccent(entry.target);
      }
    });
  }, {
    threshold: 0,
    rootMargin: '-35% 0px -55% 0px',
  });

  sections.forEach(s => observer.observe(s));
})();


/* ═══════════════════════════════════════════════════════════════════
   5. REVEAL ANIMATIONS — IntersectionObserver para items del menú
═══════════════════════════════════════════════════════════════════ */
(function initReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  // Reduce-motion check
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    items.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const siblings = Array.from(el.parentElement.querySelectorAll('[data-reveal]'));
      const index    = siblings.indexOf(el);
      el.style.transitionDelay = (index * 55) + 'ms';
      el.classList.add('revealed');
      observer.unobserve(el);
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px',
  });

  items.forEach(el => observer.observe(el));
})();


/* ═══════════════════════════════════════════════════════════════════
   6. SMOOTH SCROLL — Navegación anclajes (fallback polyfill)
═══════════════════════════════════════════════════════════════════ */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const targetId = anchor.getAttribute('href').slice(1);
      const target   = document.getElementById(targetId);
      if (!target) return;
      e.preventDefault();

      const catNavH = document.getElementById('catNav')?.offsetHeight ?? 0;
      const y = target.getBoundingClientRect().top + window.scrollY - catNavH - 8;

      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    });
  });
})();


/* ═══════════════════════════════════════════════════════════════════
   7. VICHES — Efecto de partículas místicas en la sección especial
═══════════════════════════════════════════════════════════════════ */
(function initVichesGlow() {
  const section = document.getElementById('viches');
  if (!section) return;

  // Add ambient floating orbs via DOM (CSS-animated)
  const orbCount = 6;
  for (let i = 0; i < orbCount; i++) {
    const orb = document.createElement('div');
    orb.style.cssText = `
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      will-change: transform;
      animation: vOrb${i} ${6 + i * 1.5}s ${i * .8}s ease-in-out infinite alternate;
    `;

    const size = 80 + Math.random() * 160;
    const x    = Math.random() * 100;
    const y    = Math.random() * 100;
    const hue  = 260 + Math.random() * 60;

    orb.style.width  = size + 'px';
    orb.style.height = size + 'px';
    orb.style.left   = x + '%';
    orb.style.top    = y + '%';
    orb.style.background =
      `radial-gradient(circle, hsla(${hue},70%,55%,.06) 0%, transparent 70%)`;

    section.appendChild(orb);
  }

  // Inject keyframes
  const style = document.createElement('style');
  style.textContent = Array.from({ length: orbCount }, (_, i) => `
    @keyframes vOrb${i} {
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(${(Math.random()-.5)*60}px, ${(Math.random()-.5)*60}px) scale(${.8 + Math.random()*.4}); }
    }
  `).join('');
  document.head.appendChild(style);
})();


/* ═══════════════════════════════════════════════════════════════════
   8. SECTION-PHOTO PARALLAX — Sutil parallax en los slots de foto
═══════════════════════════════════════════════════════════════════ */
(function initParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const photos = document.querySelectorAll('.sec-photo');
  if (!photos.length) return;

  function update() {
    const scrollY = window.scrollY;
    photos.forEach(photo => {
      const rect   = photo.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const vhCenter = window.innerHeight / 2;
      const delta  = (center - vhCenter) * .12;
      photo.style.backgroundPositionY = `calc(50% + ${delta}px)`;
    });
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();


/* ═══════════════════════════════════════════════════════════════════
   9. CAT-NAV DRAG-TO-SCROLL (mobile UX)
═══════════════════════════════════════════════════════════════════ */
(function initNavDrag() {
  const track = document.querySelector('.cat-nav-track');
  if (!track) return;

  let isDown = false, startX, scrollLeft;

  track.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX - track.offsetLeft;
    scrollLeft = track.scrollLeft;
    track.style.cursor = 'grabbing';
  });
  track.addEventListener('mouseleave', () => { isDown = false; track.style.cursor = ''; });
  track.addEventListener('mouseup',    () => { isDown = false; track.style.cursor = ''; });
  track.addEventListener('mousemove',  e => {
    if (!isDown) return;
    e.preventDefault();
    const x    = e.pageX - track.offsetLeft;
    const walk = (x - startX) * 1.4;
    track.scrollLeft = scrollLeft - walk;
  });
})();


/* ═══════════════════════════════════════════════════════════════════
   10. AUTO-SCROLL CAT-NAV to active link
═══════════════════════════════════════════════════════════════════ */
(function initCatNavAutoScroll() {
  const track = document.querySelector('.cat-nav-track');
  if (!track) return;

  const observer = new MutationObserver(() => {
    const active = track.querySelector('.cat-link.active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });

  observer.observe(track, { subtree: true, attributeFilter: ['class'] });
})();
