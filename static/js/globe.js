/**
 * globe.js — Atlas SupplyChain360 AI
 * Holographic 3D Digital Globe matching Google Flow reference:
 * - Bright blue/cyan digital Earth with glowing continent dots
 * - Glowing supply-chain city nodes & logistics arcs
 * - Cyan and purple orbital rings
 * - Surrounding radar telemetry HUD circles
 * - Ambient particle dust field
 */

(function () {
  'use strict';

  // Major global supply-chain hub coordinates
  const CITIES = [
    { name: 'Shanghai',      lat:  31.2, lon: 121.5 },
    { name: 'Singapore',     lat:   1.3, lon: 103.8 },
    { name: 'Dubai',         lat:  25.2, lon:  55.3 },
    { name: 'Rotterdam',     lat:  51.9, lon:   4.5 },
    { name: 'Los Angeles',   lat:  34.0, lon: -118.2 },
    { name: 'New York',      lat:  40.7, lon:  -74.0 },
    { name: 'Mumbai',        lat:  19.1, lon:  72.9 },
    { name: 'Tokyo',         lat:  35.7, lon: 139.7 },
    { name: 'London',        lat:  51.5, lon:  -0.1 },
    { name: 'Chicago',       lat:  41.9, lon:  -87.6 },
    { name: 'São Paulo',     lat: -23.5, lon:  -46.6 },
    { name: 'Sydney',        lat: -33.9, lon: 151.2 },
    { name: 'Frankfurt',     lat:  50.1, lon:   8.7 },
    { name: 'Shenzhen',      lat:  22.5, lon: 114.1 },
  ];

  const ARC_PAIRS = [
    [0, 1], [0, 7], [0, 13], [1, 2], [1, 6],
    [2, 3], [2, 12], [3, 8], [3, 12], [4, 5],
    [4, 9], [5, 8], [6, 2], [7, 0], [8, 3],
    [9, 4], [10, 4], [11, 7], [12, 3],
  ];

  function latLonToVec3(lat, lon, radius) {
    const phi   = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
       (radius * Math.cos(phi)),
       (radius * Math.sin(phi) * Math.sin(theta))
    );
  }

  function initGlobe(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const parent = canvas.parentElement;
    const W = parent.clientWidth  || 800;
    const H = parent.clientHeight || 540;

    // ── WebGL Renderer ──────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // ── Scene & Camera ──────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 1000);
    camera.position.set(0, 0, 2.75); // Calibrated for ~52% visual width

    // ── Lights ──────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0a1c38, 2.5);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x00e5ff, 2, 10);
    cyanLight.position.set(2, 2, 2.5);
    scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 1.8, 10);
    purpleLight.position.set(-2, -1.5, 2);
    scene.add(purpleLight);

    const GLOBE_R = 1.0;

    // ── 1. Digital Dot-Map Sphere ───────────────────────────────
    const dotTexture = generateDotMapTexture();
    const globeGeo  = new THREE.SphereGeometry(GLOBE_R, 64, 64);
    const globeMat  = new THREE.MeshPhongMaterial({
      map: dotTexture,
      transparent: true,
      opacity: 0.96,
      shininess: 25,
      specular: 0x00ffff,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // ── 2. Atmospheric Rim Glow ─────────────────────────────────
    const atmGeo = new THREE.SphereGeometry(GLOBE_R * 1.05, 48, 48);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    // ── 3. Radar Telemetry Background Rings ─────────────────────
    const radarGroup = new THREE.Group();
    const radar1 = makeRing(GLOBE_R * 1.28, 0x00e5ff, 0.18, 0.002);
    const radar2 = makeRing(GLOBE_R * 1.45, 0x6366f1, 0.14, 0.002);
    radarGroup.add(radar1);
    radarGroup.add(radar2);
    scene.add(radarGroup);

    // ── 4. Luminous Tilted Orbital Rings ────────────────────────
    // Orbital Ring 1: Cyan (Tilted ~25°)
    const ring1 = makeRing(GLOBE_R * 1.42, 0x00e5ff, 0.75, 0.005);
    ring1.rotation.x = Math.PI / 2.2;
    ring1.rotation.y = 0.42;
    scene.add(ring1);

    // Orbital Ring 2: Purple (Tilted Counter-Angle)
    const ring2 = makeRing(GLOBE_R * 1.62, 0xa855f7, 0.65, 0.005);
    ring2.rotation.x = Math.PI / 1.8;
    ring2.rotation.y = -0.32;
    ring2.rotation.z = 0.25;
    scene.add(ring2);

    // Orbital Ring 3: Fine Outer Cyan Guide
    const ring3 = makeRing(GLOBE_R * 1.76, 0x00ffff, 0.35, 0.002);
    ring3.rotation.x = 1.1;
    ring3.rotation.z = -0.4;
    scene.add(ring3);

    // ── 5. City Hotspot Nodes ───────────────────────────────────
    const nodeGroup = new THREE.Group();
    const nodePositions = [];
    CITIES.forEach(city => {
      const pos = latLonToVec3(city.lat, city.lon, GLOBE_R * 1.012);
      nodePositions.push(pos);
      const nodeMesh = makeNode(pos);
      nodeGroup.add(nodeMesh);
    });
    scene.add(nodeGroup);

    // ── 6. Logistics Arc Routes ─────────────────────────────────
    const arcGroup  = new THREE.Group();
    const arcLines  = [];
    ARC_PAIRS.forEach(([a, b]) => {
      const posA = nodePositions[a];
      const posB = nodePositions[b];
      if (!posA || !posB) return;
      const arc = makeArc(posA, posB, GLOBE_R);
      arcGroup.add(arc.line);
      arcLines.push(arc);
    });
    scene.add(arcGroup);

    // ── 7. Orbiting Dust Particle Cloud ─────────────────────────
    const particles = makeParticles(2000, GLOBE_R);
    scene.add(particles.points);

    // ── Mouse Interactive Tilt ──────────────────────────────────
    const mouse = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    window.addEventListener('mousemove', e => {
      mouse.x = (e.clientX / window.innerWidth  - 0.5) *  0.35;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * -0.25;
    });

    // ── Resize Observer ─────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      const nW = parent.clientWidth;
      const nH = parent.clientHeight;
      if (nW > 0 && nH > 0) {
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
        renderer.setSize(nW, nH);
      }
    });
    resizeObserver.observe(parent);

    // ── Render & Animation Loop ─────────────────────────────────
    let t = 0;
    function animate() {
      requestAnimationFrame(animate);
      t += 0.016;

      // Smooth continuous globe rotation
      globe.rotation.y      += 0.001;
      nodeGroup.rotation.y  += 0.001;
      arcGroup.rotation.y   += 0.001;
      atmosphere.rotation.y += 0.001;

      // Orbital rings rotate at calibrated speeds
      ring1.rotation.z += 0.0028;
      ring2.rotation.z -= 0.0022;
      ring3.rotation.z += 0.0016;

      radar1.rotation.z -= 0.0008;
      radar2.rotation.z += 0.0006;

      // Atmospheric breathing pulse
      atmMat.opacity = 0.11 + 0.03 * Math.sin(t * 1.4);

      // Arc traveling packets
      arcLines.forEach(arc => {
        arc.offset = ((arc.offset || 0) + arc.speed) % 1;
        const pos = arc.curve.getPoint(arc.offset);
        arc.packet.position.copy(pos);
      });

      // City nodes scale & pulse
      nodeGroup.children.forEach((node, i) => {
        const p = Math.sin(t * 2 + i * 0.7);
        const s = 1 + 0.35 * Math.abs(p);
        node.scale.set(s, s, s);
      });

      // Subtle mouse parallax dampening
      target.x += (mouse.x - target.x) * 0.06;
      target.y += (mouse.y - target.y) * 0.06;
      globe.rotation.x     = target.y * 0.4;
      nodeGroup.rotation.x = target.y * 0.4;
      arcGroup.rotation.x  = target.y * 0.4;

      renderer.render(scene, camera);
    }

    animate();
  }

  // ── Helper: Canvas Dot-Map Texture ────────────────────────────
  function generateDotMapTexture() {
    const size   = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep midnight ocean background
    ctx.fillStyle = '#060d24';
    ctx.fillRect(0, 0, size, size);

    // Draw continent dots
    const dotR = 2.4;
    const step = dotR * 2.8;
    const cols = Math.floor(size / step);
    const rows = Math.floor(size / step);

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const lon = (c / cols) * 360 - 180;
        const lat = 90 - (r / rows) * 180;

        if (isLand(lat, lon)) {
          const x = (c / cols) * size + dotR;
          const y = (r / rows) * size + dotR;

          // Glowing cyan to electric blue
          const gradVal = (Math.sin(lat * 0.05) + 1) * 0.5;
          ctx.beginPath();
          ctx.arc(x, y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = gradVal > 0.4 ? 'rgba(0, 229, 255, 0.95)' : 'rgba(74, 158, 255, 0.85)';
          ctx.fill();
        }
      }
    }

    // Add city luminous hotspot glows
    CITIES.forEach(city => {
      const cx = ((city.lon + 180) / 360) * size;
      const cy = ((90 - city.lat) / 180) * size;

      const rad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
      rad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      rad.addColorStop(0.3, 'rgba(0, 229, 255, 0.8)');
      rad.addColorStop(0.7, 'rgba(99, 102, 241, 0.35)');
      rad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fillStyle = rad;
      ctx.fill();
    });

    return new THREE.CanvasTexture(canvas);
  }

  // Geographic continent approximation bounding boxes
  function isLand(lat, lon) {
    // North America
    if (lat > 15 && lat < 72 && lon > -170 && lon < -55) {
      if (lat > 25 && lon > -130 && lon < -60) return true;
      if (lat > 15 && lat < 25 && lon > -120 && lon < -80) return true;
      if (lat > 60 && lon > -170 && lon < -55) return true;
    }
    // South America
    if (lat > -56 && lat < 15 && lon > -82 && lon < -34) return true;
    // Europe
    if (lat > 36 && lat < 72 && lon > -10 && lon < 40) return true;
    // Africa
    if (lat > -35 && lat < 37 && lon > -20 && lon < 52) return true;
    // Asia
    if (lat > 10 && lat < 75 && lon > 25 && lon < 150) return true;
    // Southeast Asia
    if (lat > -10 && lat < 25 && lon > 95 && lon < 145) return true;
    // Australia & NZ
    if (lat > -44 && lat < -10 && lon > 113 && lon < 155) return true;
    // Japan
    if (lat > 30 && lat < 46 && lon > 128 && lon < 148) return true;
    // UK & Ireland
    if (lat > 50 && lat < 60 && lon > -11 && lon < 2) return true;
    return false;
  }

  // ── Helper: Luminous Ring ─────────────────────────────────────
  function makeRing(radius, color, opacity, tubeR = 0.004) {
    const geo = new THREE.TorusGeometry(radius, tubeR, 12, 180);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Mesh(geo, mat);
  }

  // ── Helper: City Node Marker ──────────────────────────────────
  function makeNode(pos) {
    const geo = new THREE.SphereGeometry(0.014, 10, 10);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    return mesh;
  }

  // ── Helper: 3D Arcs Between Cities ────────────────────────────
  function makeArc(posA, posB, globeR) {
    const mid = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
    const len = posA.distanceTo(posB);
    mid.normalize().multiplyScalar(globeR + 0.28 + len * 0.25);

    const curve = new THREE.CatmullRomCurve3([posA, mid, posB]);
    const points = curve.getPoints(50);
    const geo  = new THREE.BufferGeometry().setFromPoints(points);
    const mat  = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);

    // Glowing packet
    const pktGeo = new THREE.SphereGeometry(0.009, 8, 8);
    const pktMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
    });
    const packet = new THREE.Mesh(pktGeo, pktMat);
    packet.position.copy(posA);

    return {
      line,
      curve,
      packet,
      offset: Math.random(),
      speed:  0.004 + Math.random() * 0.004,
    };
  }

  // ── Helper: Particle Field ────────────────────────────────────
  function makeParticles(count, globeR) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = globeR * 1.15 + Math.random() * globeR * 0.7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x80d8ff,
      size: 0.008,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    return { points: new THREE.Points(geo, mat) };
  }

  window.AtlasGlobe = { init: initGlobe };
})();
