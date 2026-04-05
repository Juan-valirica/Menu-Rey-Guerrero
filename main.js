/**
 * REY GUERRERO · MENÚ DIGITAL
 * main.js — Experiencia digital interactiva v2
 * Pacífico Colombiano · Bogotá
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════
   0. CORRIENTES MARINAS — Canvas particles entre secciones
   Sin sólidos. Sin bordes. Elementos del Pacífico y el manglar que
   fluyen como corrientes vivas entre cada sección del menú.

   Técnica:
   · Canvas transparente sobre cada .wave-sep
   · destination-out composite = trails que se desvanecen sin manchar
   · IntersectionObserver = solo anima lo visible (perf)
   · Movimiento sinusoidal + variación de profundidad (tamaño/alpha)
   · Path2D pre-compilado = zero-cost shapes (misma perf que arc())
     - Peces apuntan en su dirección real de nado (atan2)
     - Hojas/gotas en remolinos giran suavemente sobre sí mismas
     - Mystical (Viches): sin peces — solo botánica flotante
═══════════════════════════════════════════════════════════════════ */
(function initCurrentParticles() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const seps = document.querySelectorAll('.wave-sep');
  if (!seps.length) return;

  const BLEED = 72;

  /* ── Formas del Pacífico — Path2D definidos UNA SOLA VEZ ──────────
     Sistema de coordenadas normalizado (cuerpo ≈ ±1).
     Se escalan por p.r con ctx.scale en el draw loop.
     Zero dependencias externas — canvas nativo puro.
  ──────────────────────────────────────────────────────────────────── */

  // Pez: cuerpo aerodinámico apuntando a la derecha (+x), cola bifurcada.
  // Los peces drift/back rotan con atan2(vy,vx) para nadar en su
  // dirección real de movimiento — incluida la oscilación sinusoidal.
  const FISH = (() => {
    const p = new Path2D();
    // Cuerpo
    p.moveTo(1.0, 0);
    p.bezierCurveTo( 0.9, -0.55,  0.0, -0.72, -0.65, -0.50);
    p.bezierCurveTo(-0.95, -0.34, -0.95, 0.34, -0.65,  0.50);
    p.bezierCurveTo( 0.0,  0.72,  0.9,  0.55,  1.0,    0);
    p.closePath();
    // Cola bifurcada (subpath — non-zero fill rellena ambos)
    p.moveTo(-0.65, -0.12);
    p.lineTo(-1.75, -0.82);
    p.lineTo(-1.45,  0);
    p.lineTo(-1.75,  0.82);
    p.lineTo(-0.65,  0.12);
    p.closePath();
    return p;
  })();

  // Hoja de manglar: óvalo apuntado, eje vertical.
  // Rotación continua en partículas tipo eddy.
  const LEAF = (() => {
    const p = new Path2D();
    p.moveTo( 0,   -1.1);
    p.bezierCurveTo( 0.72, -0.65,  0.72,  0.65,  0,  1.1);
    p.bezierCurveTo(-0.72,  0.65, -0.72, -0.65,  0, -1.1);
    p.closePath();
    return p;
  })();

  // Gota / burbuja elongada: usada en eddies y corriente mística.
  const DROP = (() => {
    const p = new Path2D();
    p.moveTo(0, -1.1);
    p.bezierCurveTo( 0.65, -0.55,  0.65,  0.35,  0,  0.85);
    p.bezierCurveTo(-0.65,  0.35, -0.65, -0.55,  0, -1.1);
    p.closePath();
    return p;
  })();

  const SHAPES = { fish: FISH, leaf: LEAF, drop: DROP };

  seps.forEach(sep => {
    const isMystical = sep.classList.contains('wave-sep--mystical');

    /* ── Canvas setup ── */
    const canvas = document.createElement('canvas');
    sep.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0, particles = [], animId = null, active = false;

    /* ── Particle factory ──
       Types:
         'drift'  — sinusoidal left-to-right (main current)   → pez
         'back'   — right-to-left counter-current             → pez (invertido)
         'eddy'   — circular vortex                           → hoja | gota
         'speck'  — tiny fast random-walk mote               → círculo (arc)
       Mystical (Viches): drift/back usan hoja|gota en lugar de pez.
    */
    function make(scatter = false) {
      const depth  = Math.random();
      const roll   = Math.random();
      const type   = roll < .60 ? 'drift'
                   : roll < .80 ? 'back'
                   : roll < .92 ? 'eddy'
                   :              'speck';

      const goLeft = type === 'back';
      const spawnX = scatter
        ? Math.random() * W
        : goLeft ? W + 8 : -8;

      // Asignar forma según tipo y variante (normal vs mystical)
      let shape;
      if      (type === 'speck')                     shape = 'speck'; // arc directo
      else if (type === 'eddy')                      shape = Math.random() < .6 ? 'leaf' : 'drop';
      else if (isMystical)                           shape = Math.random() < .55 ? 'leaf' : 'drop';
      else /* drift / back — corriente normal */     shape = 'fish';

      return {
        type, shape,
        x:         spawnX,
        y:         H * (.05 + Math.random() * .90),
        // Tamaño ×2 respecto a iteración anterior — fish real width 16–50px.
        r:         type === 'speck'
                     ? .5  + Math.random() * 1.5
                     : 6.0 + depth * 12.0,
        vx:        goLeft
                     ? -(0.10 + depth * 0.42)
                     : type === 'speck'
                       ? (Math.random() - .5) * 1.1
                       : (0.16 + depth * 0.80),
        vy:        type === 'speck'
                     ? (Math.random() - .5) * 0.9
                     : (Math.random() - .5) * 0.18,
        phase:     Math.random() * Math.PI * 2,
        freq:      .003 + Math.random() * .013,
        amp:       type === 'speck' ? .2 : (.5 + (1 - depth) * 3.8),
        // Siluetas de peces y hojas más opacas para que "lean" como formas fuertes.
        // Drops y specks mantienen la transparencia de antes.
        alpha:     shape === 'fish' || shape === 'leaf'
                     ? .22 + depth * .42
                     : type === 'speck'
                       ? .03 + Math.random() * .09
                       : .04 + depth * .18,
        // Color propio por forma — paleta independiente del hue isMystical.
        // Mystical (Viches) conserva su morado para drop/speck.
        hue: isMystical             ? 255 + Math.random() * 60
           : shape === 'fish'       ? 212 + Math.random() * 14   // azul marino oscuro
           : shape === 'leaf'       ? 125 + Math.random() * 20   // verde natural oscuro
           :                          172 + Math.random() * 52,  // teal/drop original
        sat: isMystical             ? 65
           : shape === 'fish'       ? 68
           : shape === 'leaf'       ? 58
           :                          60,
        // Luminosidad: peces y hojas oscuros (silueta), resto claro (bioluminiscente)
        lit: isMystical             ? 78
           : shape === 'fish'       ? 22
           : shape === 'leaf'       ? 32
           :                          78,
        life:      0,
        lifeMax:   type === 'speck'
                     ? 80  + Math.random() * 120
                     : 140 + Math.random() * 340,
        // Orientación inicial
        angle:     type === 'eddy' || isMystical
                     ? Math.random() * Math.PI * 2
                     : goLeft ? Math.PI : 0,
        rotSpeed:  (Math.random() < .5 ? 1 : -1) * (.012 + Math.random() * .022),
        /* eddy params */
        eddyAngle: Math.random() * Math.PI * 2,
        eddyR:     4 + Math.random() * 10,
        eddySpeed: (Math.random() < .5 ? 1 : -1) * (.025 + Math.random() * .06),
        /* speck random-walk */
        wx: (Math.random() - .5) * .08,
        wy: (Math.random() - .5) * .08,
      };
    }

    /* ── Build particle pool ── */
    function build() {
      const n = Math.max(40, Math.floor(W / 22));
      particles = Array.from({ length: n }, () => make(true));
    }

    /* ── Resize — canvas extends BLEED px beyond the sep element ── */
    function resize() {
      W = canvas.width  = sep.offsetWidth;
      H = canvas.height = sep.offsetHeight + BLEED * 2;
      canvas.style.top  = -BLEED + 'px';
      build();
    }

    /* ── Draw loop ── */
    function draw() {
      /* destination-out: desvanece trazas sin añadir fondo opaco */
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';

      particles.forEach((p, i) => {
        p.life++;
        p.phase += p.freq;

        /* Movimiento por tipo + actualización de ángulo */
        if (p.type === 'eddy') {
          p.eddyAngle += p.eddySpeed;
          p.x += Math.cos(p.eddyAngle) * p.eddyR * .045 + p.vx * .25;
          p.y += Math.sin(p.eddyAngle) * p.eddyR * .045;
          // Hojas y gotas en remolino giran suavemente sobre sí mismas
          p.angle += p.rotSpeed;
        } else if (p.type === 'speck') {
          p.wx += (Math.random() - .5) * .04;
          p.wy += (Math.random() - .5) * .04;
          p.wx *= .96; p.wy *= .96;
          p.x += p.vx + p.wx;
          p.y += p.vy + p.wy;
        } else {
          // drift / back: calcular dy real para orientar el pez
          const dy = Math.sin(p.phase) * p.amp * .045 + p.vy * .12;
          p.x += p.vx;
          p.y += dy;
          if (p.shape === 'fish') {
            // El pez se inclina en su dirección real de nado (oscilación incluida)
            p.angle = Math.atan2(dy, p.vx);
          } else {
            // Hojas/gotas en corriente mística: rotación lenta independiente
            p.angle += p.rotSpeed;
          }
        }

        /* Rebote vertical suave dentro del canvas */
        const margin = H * .04;
        if (p.y < margin)     p.y += .5;
        if (p.y > H - margin) p.y -= .5;

        /* Alpha compuesto: fade-in / hold / fade-out + edge fade */
        const fadeIn  = Math.min(p.life / 35, 1);
        const fadeOut = Math.min((p.lifeMax - p.life) / 45, 1);
        const edgeFrac = H * .09;
        const edgeA = Math.min(p.y / edgeFrac, 1)
                    * Math.min((H - p.y) / edgeFrac, 1);

        const a = p.alpha * fadeIn * fadeOut * edgeA;

        if (a > .003) {
          ctx.fillStyle = `hsla(${p.hue},${p.sat}%,${p.lit}%,${a})`;

          if (p.shape === 'speck') {
            // Burbujas/specks: círculo simple (demasiado pequeños para formas)
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Formas temáticas: translate → rotate → scale → fill(Path2D)
            // Path2D pre-compilado = mismo coste que un arc() nativo.
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            // Escala no-uniforme por forma para siluetas más reconocibles:
            // pez: más ancho que alto (esbelto) · hoja/gota: más alta que ancha
            if (p.shape === 'fish')      ctx.scale(p.r * 1.25, p.r * 0.80);
            else if (p.shape === 'leaf') ctx.scale(p.r * 0.70, p.r * 1.10);
            else                         ctx.scale(p.r * 0.75, p.r * 1.15);
            ctx.fill(SHAPES[p.shape]);
            ctx.restore();
          }
        }

        /* Reciclar al salir o expirar */
        const offLeft  = p.vx < 0 && p.x < -12;
        const offRight = p.vx > 0 && p.x > W + 12;
        const expired  = p.life >= p.lifeMax;
        if (offLeft || offRight || expired) {
          particles[i] = make(false);
        }
      });

      if (active) animId = requestAnimationFrame(draw);
    }

    /* ── Visibility observer — animate only what's on screen ── */
    const vis = new IntersectionObserver(entries => {
      entries.forEach(e => {
        active = e.isIntersecting;
        if (active && !animId) {
          animId = requestAnimationFrame(draw);
        } else if (!active && animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      });
    }, { rootMargin: '140px' });
    vis.observe(sep);

    const ro = new ResizeObserver(resize);
    ro.observe(sep);
    resize();
  });
})();

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
      r:     1.2 + Math.random() * 4,
      vx:    (Math.random() - .5) * .35,
      vy:    -(.2 + Math.random() * .55),
      /* Opacidad subida para que sean claramente visibles
         sin esfuerzo: rango 0.22–0.58 antes del pulso. */
      alpha: .22 + Math.random() * .36,
      hue:   172 + Math.random() * 55,      // teals → aquamarines → cyan
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: .008 + Math.random() * .015,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    particles.forEach((p, i) => {
      p.pulse += p.pulseSpeed;
      /* Pulso de brillo: oscila entre 65 % y 100 % de la alpha base */
      const a = p.alpha * (.65 + .35 * Math.sin(p.pulse));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      /* Luminosidad subida a 70 % y saturación a 65 % para mayor presencia */
      ctx.fillStyle = `hsla(${p.hue}, 65%, 70%, ${a})`;
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
    if (!color) return;
    root.style.setProperty('--accent', color);
    const bar = document.getElementById('scrollBar');
    if (bar) bar.style.background = `linear-gradient(90deg, ${color}88, ${color})`;

    // Tint the nearest wave-sep glows with the section accent
    const nextsep = section.nextElementSibling;
    const prevsep = section.previousElementSibling;
    [nextsep, prevsep].forEach(sep => {
      if (sep && sep.classList.contains('wave-sep') && !sep.classList.contains('wave-sep--mystical')) {
        const glow = sep.querySelector('.ws-glow');
        if (glow) {
          glow.style.background =
            `linear-gradient(90deg, transparent 0%, ${color}30 30%, ${color}55 50%, ${color}30 70%, transparent 100%)`;
        }
      }
    });
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
   8. SECTION-PHOTO LAZY LOAD + PARALLAX
   · IntersectionObserver carga la imagen real (data-bg) justo antes
     de entrar al viewport — las imágenes off-screen no se descargan.
   · Una vez cargada, añadimos bg-loaded y aplicamos parallax suave.
   · Shimmer CSS en :not(.bg-loaded) desaparece solo al cargar.
═══════════════════════════════════════════════════════════════════ */
(function initSecPhotoLazyLoad() {
  const photos = document.querySelectorAll('.sec-photo[data-bg]');
  if (!photos.length) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Preload helper — crea un Image() oculto para disparar el fetch
     y aplica el background-image solo cuando el browser lo tiene en caché */
  function loadBg(el) {
    const src = el.dataset.bg;
    if (!src || el.classList.contains('bg-loaded')) return;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url('${src}')`;
      el.classList.add('bg-loaded');
    };
    img.src = src;
  }

  /* IntersectionObserver — margin amplio (300px) para que la imagen
     esté lista antes de que el usuario llegue a verla */
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadBg(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '300px 0px' });

  photos.forEach(photo => observer.observe(photo));

  /* ── Parallax — solo en elementos con imagen ya cargada ── */
  if (prefersReduced) return;

  function updateParallax() {
    photos.forEach(photo => {
      if (!photo.classList.contains('bg-loaded')) return;
      const rect     = photo.getBoundingClientRect();
      const center   = rect.top + rect.height / 2;
      const vhCenter = window.innerHeight / 2;
      const delta    = (center - vhCenter) * .12;
      photo.style.backgroundPositionY = `calc(50% + ${delta}px)`;
    });
  }

  window.addEventListener('scroll', updateParallax, { passive: true });
  updateParallax();
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


/* ═══════════════════════════════════════════════════════════════════
   11. GALERÍA LIGHTBOX — Expandir fotos al hacer clic
═══════════════════════════════════════════════════════════════════ */
(function initGalleryLightbox() {
  const mosaic   = document.getElementById('galeriaMosaic');
  const lightbox = document.getElementById('galLightbox');
  const lbImg    = document.getElementById('galLbImg');
  const lbClose  = document.getElementById('galLbClose');
  if (!mosaic || !lightbox || !lbImg) return;

  function openLightbox(src, alt) {
    lbImg.src = src;
    lbImg.alt = alt || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    /* Clear src after transition to free memory */
    setTimeout(() => { lbImg.src = ''; }, 320);
  }

  /* Delegated click on gallery items */
  mosaic.addEventListener('click', e => {
    const item = e.target.closest('.gal-item');
    if (!item) return;
    const img = item.querySelector('img');
    if (!img) return;
    openLightbox(img.src, img.alt);
  });

  /* Close handlers */
  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
  });
})();
