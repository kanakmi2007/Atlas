/**
 * landing.js — Atlas SupplyChain360 AI
 * GSAP orchestration: page-load timeline, counters,
 * background starfield, telemetry card live updates,
 * drone orbit animation.
 */

(function () {
  'use strict';

  // ── 1. Background Starfield (Canvas 2D) ───────────────────────
  function initStarfield(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const STAR_COUNT = 280;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 1.2 + 0.2,
      alpha: Math.random() * 0.6 + 0.1,
      speed: Math.random() * 0.3 + 0.05,
      drift: (Math.random() - 0.5) * 0.08,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    function drawStars() {
      requestAnimationFrame(drawStars);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame += 0.016;
      stars.forEach(s => {
        s.y -= s.speed * 0.1;
        s.x += s.drift;
        if (s.y < 0) { s.y = canvas.height; s.x = Math.random() * canvas.width; }
        if (s.x < 0 || s.x > canvas.width) s.x = Math.random() * canvas.width;

        const twinkle = 0.5 + 0.5 * Math.sin(frame * s.twinkleSpeed * 60 + s.twinkleOffset);
        const alpha   = s.alpha * (0.5 + 0.5 * twinkle);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
        ctx.fill();
      });
    }
    drawStars();
  }

  // ── 2. GSAP Page Load Timeline ───────────────────────────────
  function initPageTimeline() {
    if (typeof gsap === 'undefined') {
      console.warn('GSAP not loaded');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Make everything visible (they start opacity: 0)
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Navbar
    tl.to('.navbar', {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power2.out',
    }, 0.1);

    // Nav links stagger
    tl.from('.nav-links li', {
      opacity: 0,
      y: -10,
      stagger: 0.07,
      duration: 0.4,
    }, 0.5);

    // Nav actions
    tl.from('.nav-actions > *', {
      opacity: 0,
      x: 10,
      stagger: 0.08,
      duration: 0.4,
    }, 0.6);

    // Hero badge
    tl.to('.hero-badge', {
      opacity: 1,
      y: 0,
      duration: 0.5,
    }, 0.5);

    // Hero headline
    tl.to('.hero-headline', {
      opacity: 1,
      y: 0,
      duration: 0.65,
      ease: 'power3.out',
    }, 0.75);

    // Subtext
    tl.to('.hero-subtext', {
      opacity: 1,
      y: 0,
      duration: 0.5,
    }, 1.0);

    // Buttons
    tl.to('.hero-buttons', {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'back.out(1.4)',
    }, 1.2);

    // Globe fade in
    tl.to('#globe-canvas', {
      opacity: 1,
      duration: 1.2,
      ease: 'power1.inOut',
    }, 0.9);

    // HUD Telemetry card (slide down from above)
    tl.to('.hud-telemetry', {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power2.out',
      onStart: () => {
        gsap.set('.hud-telemetry', { y: -30 });
      },
    }, 1.6);

    // HUD Graph card (slide from right)
    tl.to('.hud-graph', {
      opacity: 1,
      x: 0,
      duration: 0.6,
      ease: 'power2.out',
      onStart: () => {
        gsap.set('.hud-graph', { x: 40 });
      },
    }, 1.8);

    // Stat cards stagger
    tl.to('.stat-card', {
      opacity: 1,
      y: 0,
      stagger: 0.14,
      duration: 0.65,
      ease: 'power2.out',
    }, 1.6);

    // Drones fade in
    tl.to('.drone', {
      opacity: 1,
      duration: 0.8,
      stagger: 0.2,
    }, 2.0);

    // Kick off counters after cards appear
    tl.call(initCounters, [], 2.4);
  }

  // ── 3. Animated Stat Counters ─────────────────────────────────
  function initCounters() {
    const counters = [
      { el: document.getElementById('counter-tasks'),  start: 120000, end: 145210, suffix: '+',  decimals: 0 },
      { el: document.getElementById('counter-agents'), start: 850,    end: 1042,   suffix: '+',  decimals: 0 },
      { el: document.getElementById('counter-health'), start: 98.0,   end: 99.4,   suffix: '%',  decimals: 1 },
    ];

    counters.forEach(c => {
      if (!c.el) return;
      const obj = { val: c.start };
      gsap.to(obj, {
        val: c.end,
        duration: 2.8,
        ease: 'power1.inOut',
        onUpdate: () => {
          const v = c.decimals > 0
            ? obj.val.toFixed(c.decimals)
            : Math.floor(obj.val).toLocaleString();
          c.el.textContent = v + c.suffix;
        },
      });
    });
  }

  // ── 4. Drone Orbit Animation ─────────────────────────────────
  function initDrones() {
    const container = document.querySelector('.drone-container');
    if (!container) return;

    const heroRight = document.querySelector('.hero-right');
    if (!heroRight) return;

    const drones = document.querySelectorAll('.drone');
    const trails = document.querySelectorAll('.drone-trail');

    // Define 3 orbital paths (cx, cy as % of container, radius, speed, startAngle)
    const orbits = [
      { cx: 0.5, cy: 0.42, rx: 0.38, ry: 0.16, speed: 0.4, angle: 0,       tilt: -0.3 },
      { cx: 0.5, cy: 0.46, rx: 0.46, ry: 0.22, speed: -0.28, angle: 2.1,   tilt: 0.15 },
      { cx: 0.5, cy: 0.44, rx: 0.30, ry: 0.12, speed: 0.55, angle: 4.0,    tilt: -0.5 },
    ];

    let t = 0;
    function animateDrones() {
      requestAnimationFrame(animateDrones);
      t += 0.012;

      const rect = heroRight.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      drones.forEach((drone, i) => {
        const o = orbits[i];
        const a = o.angle + t * o.speed;
        const x = (o.cx + Math.cos(a) * o.rx) * W;
        const y = (o.cy + Math.sin(a) * o.ry * Math.cos(o.tilt)) * H;

        // Scale by y position for perspective
        const scale = 0.65 + (y / H) * 0.5;
        drone.style.left   = `${x - 26}px`;
        drone.style.top    = `${y - 26}px`;
        drone.style.transform = `scale(${scale}) rotate(${Math.sin(a) * 8}deg)`;

        // Trail behind drone
        if (trails[i]) {
          const dx  = -Math.sin(a) * o.rx * W * o.speed;
          const trailAngle = Math.atan2(-Math.sin(a) * o.ry * Math.cos(o.tilt), -Math.sin(a) * o.rx) * 180 / Math.PI;
          trails[i].style.left = `${x - 20}px`;
          trails[i].style.top  = `${y - 3}px`;
          trails[i].style.transform = `rotate(${trailAngle + 180}deg)`;
          trails[i].style.opacity = drone.style.opacity;
        }
      });
    }

    animateDrones();
  }

  // ── 5. Live Telemetry Card Updates ───────────────────────────
  function initTelemetry() {
    const rows = [
      { id: 'tel-nodes',    base: 1247, range: 30 },
      { id: 'tel-latency',  base: 12,   range: 8,  suffix: 'ms' },
      { id: 'tel-uptime',   base: 99.9, range: 0,  fixed: 1, suffix: '%' },
      { id: 'tel-packets',  base: 3800, range: 400 },
    ];

    function update() {
      rows.forEach(r => {
        const el = document.getElementById(r.id);
        if (!el) return;
        const v = r.base + (Math.random() - 0.5) * r.range;
        el.textContent = r.fixed
          ? v.toFixed(r.fixed) + (r.suffix || '')
          : Math.floor(v).toLocaleString() + (r.suffix || '');
      });
    }

    update();
    setInterval(update, 2200);
  }

  // ── 6. Live Chart (DATA GRAPHS HUD card) ─────────────────────
  function initHUDChart() {
    const ctx = document.getElementById('telemetry-chart-canvas');
    if (!ctx || typeof Chart === 'undefined') return;

    const labels = Array.from({ length: 12 }, (_, i) => `${i * 10}:00`);
    const data1  = [210, 240, 190, 270, 300, 277, 250, 290, 310, 285, 272, 277];
    const data2  = [28,  32,  25,  30,  38,  31,  29,  35,  40,  33,  31,  28];

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: data1,
            borderColor: '#00e5ff',
            backgroundColor: 'rgba(0,229,255,0.1)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            data: data2,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168,85,247,0.08)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: false,
        animation: { duration: 800 },
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    });

    // Push new data point every 2.5s
    setInterval(() => {
      chart.data.datasets[0].data.shift();
      chart.data.datasets[0].data.push(240 + Math.random() * 80);
      chart.data.datasets[1].data.shift();
      chart.data.datasets[1].data.push(25 + Math.random() * 20);
      chart.update('none');
    }, 2500);
  }

  // ── Boot ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initStarfield('particle-canvas');
    initDrones();
    initTelemetry();
    initHUDChart();

    // Wait a frame so Three.js globe canvas is sized correctly
    requestAnimationFrame(() => {
      if (window.AtlasGlobe) {
        window.AtlasGlobe.init('globe-canvas');
      }
      initPageTimeline();
    });
  });

})();
