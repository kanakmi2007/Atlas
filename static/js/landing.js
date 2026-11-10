/**
 * landing.js — Atlas SupplyChain360 AI
 * Synchronized motion controller matching Google Flow video reference:
 * - GSAP choreographed entrance timeline
 * - Smooth KPI counter count-up (120K+ -> 145,210+, 850+ -> 1,042+, 98% -> 99.4%)
 * - Live HUD chart data animation
 * - Live telemetry fluctuations
 * - Deep space starfield
 */

(function () {
  'use strict';

  // ── 1. Starfield Canvas ───────────────────────────────────────
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

    const count = 260;
    const stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      alpha: Math.random() * 0.7 + 0.15,
      speed: Math.random() * 0.25 + 0.05,
      twinkleSpeed: Math.random() * 0.025 + 0.008,
      twinkleOffset: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    function render() {
      requestAnimationFrame(render);
      frame += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach(s => {
        s.y -= s.speed * 0.15;
        if (s.y < 0) {
          s.y = canvas.height;
          s.x = Math.random() * canvas.width;
        }

        const twinkle = 0.5 + 0.5 * Math.sin(frame * s.twinkleSpeed * 60 + s.twinkleOffset);
        const a = s.alpha * (0.6 + 0.4 * twinkle);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 220, 255, ${a})`;
        ctx.fill();
      });
    }
    render();
  }

  // ── 2. GSAP Entrance Timeline ────────────────────────────────
  function initPageTimeline() {
    if (typeof gsap === 'undefined') return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Initial state sets
    gsap.set('.navbar', { opacity: 0, y: -20 });
    gsap.set('.badge-pill', { opacity: 0, y: 15 });
    gsap.set('.hero-title', { opacity: 0, y: 25 });
    gsap.set('.hero-desc', { opacity: 0, y: 20 });
    gsap.set('.hero-ctas', { opacity: 0, y: 15 });
    gsap.set('#globe-canvas', { opacity: 0 });
    gsap.set('.kpi-capsule', { opacity: 0, y: 30 });
    gsap.set('.futuristic-drone', { opacity: 0 });

    // Choreographed entrance
    tl.to('.navbar', { opacity: 1, y: 0, duration: 0.6 }, 0.1)
      .to('.badge-pill', { opacity: 1, y: 0, duration: 0.45 }, 0.3)
      .to('.hero-title', { opacity: 1, y: 0, duration: 0.55 }, 0.45)
      .to('.hero-desc', { opacity: 1, y: 0, duration: 0.5 }, 0.6)
      .to('.hero-ctas', { opacity: 1, y: 0, duration: 0.45 }, 0.75)
      .to('#globe-canvas', { opacity: 1, duration: 1.2 }, 0.5)
      .to('.futuristic-drone', { opacity: 1, duration: 0.8, stagger: 0.2 }, 0.8)
      .to('.kpi-capsule', { opacity: 1, y: 0, duration: 0.55, stagger: 0.12 }, 0.85)
      .call(startCountUpAnimations, [], 1.3);
  }

  // ── 3. KPI Count-Up Animation (Matching Video Timestamps) ────
  function startCountUpAnimations() {
    // Card 1: 120K+ -> 145,210+
    const cTasks = document.getElementById('counter-tasks');
    if (cTasks) {
      const obj = { val: 120000 };
      gsap.to(obj, {
        val: 145210,
        duration: 3.2,
        ease: 'power1.inOut',
        onUpdate: () => {
          cTasks.textContent = Math.floor(obj.val).toLocaleString() + '+';
        }
      });
    }

    // Card 2: 850+ -> 1,042+
    const cAgents = document.getElementById('counter-agents');
    if (cAgents) {
      const obj = { val: 850 };
      gsap.to(obj, {
        val: 1042,
        duration: 3.2,
        ease: 'power1.inOut',
        onUpdate: () => {
          cAgents.textContent = Math.floor(obj.val).toLocaleString() + '+';
        }
      });
    }

    // Card 3: 98% -> 99.4%
    const cHealth = document.getElementById('counter-health');
    if (cHealth) {
      const obj = { val: 98.0 };
      gsap.to(obj, {
        val: 99.4,
        duration: 3.2,
        ease: 'power1.inOut',
        onUpdate: () => {
          cHealth.textContent = obj.val.toFixed(1) + '%';
        }
      });
    }
  }

  // ── Init on DOM Loaded ───────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initStarfield('particle-canvas');

    requestAnimationFrame(() => {
      if (window.AtlasGlobe) {
        window.AtlasGlobe.init('globe-canvas');
      }
      initPageTimeline();
    });
  });

})();
