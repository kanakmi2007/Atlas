/**
 * globe.js — Atlas SupplyChain360 AI
 * Three.js Globe Scene: dot-map sphere, orbital rings,
 * arc paths, city nodes, particles, drones
 */

(function () {
  'use strict';

  // ── Supply-chain hub city coordinates (lat/lon → 3D) ──────────
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
    { name: 'Johannesburg',  lat: -26.2, lon:  28.0 },
    { name: 'São Paulo',     lat: -23.5, lon:  -46.6 },
    { name: 'Sydney',        lat: -33.9, lon: 151.2 },
    { name: 'Frankfurt',     lat:  50.1, lon:   8.7 },
    { name: 'Shenzhen',      lat:  22.5, lon: 114.1 },
  ];

  // Arc pairs (index pairs from CITIES array)
  const ARC_PAIRS = [
    [0, 1], [0, 7], [0, 14], [1, 2], [1, 6],
    [2, 3], [2, 13], [3, 8], [3, 13], [4, 5],
    [4, 9], [5, 8], [6, 2], [7, 0], [8, 3],
    [9, 4], [10, 2], [11, 4], [12, 7], [13, 3],
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

  // ── Entry point ───────────────────────────────────────────────
  function initGlobe(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const W = canvas.clientWidth  || canvas.parentElement.clientWidth  || 800;
    const H = canvas.clientHeight || canvas.parentElement.clientHeight || 600;

    // ── Renderer ─────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // ── Scene & Camera ───────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    camera.position.set(0, 0, 3.4);

    // ── Lights ───────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x112244, 2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x00e5ff, 1.2);
    dirLight.position.set(2, 2, 2);
    scene.add(dirLight);

    const GLOBE_R = 1.0;

    // ── 1. Dot-map Globe Sphere ──────────────────────────────────
    const dotTexture = generateDotMapTexture();
    const globeGeo  = new THREE.SphereGeometry(GLOBE_R, 64, 64);
    const globeMat  = new THREE.MeshPhongMaterial({
      map: dotTexture,
      transparent: true,
      opacity: 0.95,
      shininess: 10,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // ── 2. Atmosphere Glow ───────────────────────────────────────
    const atmGeo = new THREE.SphereGeometry(GLOBE_R * 1.06, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    // Outer glow halo
    const haloGeo = new THREE.SphereGeometry(GLOBE_R * 1.14, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x0055cc,
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Mesh(haloGeo, haloMat));

    // ── 3. Orbital Rings ─────────────────────────────────────────
    const ring1 = makeRing(GLOBE_R * 1.4, 0x00e5ff, 0.6);
    ring1.rotation.x = Math.PI / 2;
    ring1.rotation.y = 0.44;  // ~25°
    scene.add(ring1);

    const ring2 = makeRing(GLOBE_R * 1.6, 0xa855f7, 0.4);
    ring2.rotation.x = Math.PI / 2;
    ring2.rotation.y = -0.26; // ~-15°
    ring2.rotation.z = 0.3;
    scene.add(ring2);

    const ring3 = makeRing(GLOBE_R * 1.25, 0x4a9eff, 0.25);
    ring3.rotation.x = 0.9;
    ring3.rotation.z = 0.5;
    scene.add(ring3);

    // ── 4. City Nodes ────────────────────────────────────────────
    const nodeGroup = new THREE.Group();
    const nodePositions = [];
    CITIES.forEach(city => {
      const pos = latLonToVec3(city.lat, city.lon, GLOBE_R * 1.01);
      nodePositions.push(pos);
      const nodeMesh = makeNode(pos);
      nodeGroup.add(nodeMesh);
    });
    scene.add(nodeGroup);

    // ── 5. Arc Paths ─────────────────────────────────────────────
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

    // ── 6. Particle Field ────────────────────────────────────────
    const particles = makeParticles(2500, GLOBE_R);
    scene.add(particles.points);

    // ── 7. Mouse Parallax ────────────────────────────────────────
    const mouse = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    window.addEventListener('mousemove', e => {
      mouse.x = (e.clientX / window.innerWidth  - 0.5) *  0.4;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * -0.3;
    });

    // ── Resize Handler ───────────────────────────────────────────
    window.addEventListener('resize', () => {
      const nW = canvas.parentElement.clientWidth;
      const nH = canvas.parentElement.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    });

    // ── Animation Loop ───────────────────────────────────────────
    let t = 0;
    function animate() {
      requestAnimationFrame(animate);
      t += 0.016;

      // Globe slow rotation
      globe.rotation.y     += 0.0008;
      nodeGroup.rotation.y += 0.0008;
      arcGroup.rotation.y  += 0.0008;
      atmosphere.rotation.y += 0.0008;

      // Orbital ring rotation (opposite dirs)
      ring1.rotation.z += 0.003;
      ring2.rotation.z -= 0.0018;
      ring3.rotation.z += 0.0024;

      // Atmosphere pulse
      atmMat.opacity = 0.07 + 0.025 * Math.sin(t * 1.1);

      // Arc packet travel
      arcLines.forEach((arc, i) => {
        arc.offset = ((arc.offset || 0) + arc.speed) % 1;
        const pos = arc.curve.getPoint(arc.offset);
        arc.packet.position.copy(pos);

        // Dash offset animation
        if (arc.line.material.dashOffset !== undefined) {
          arc.line.material.dashOffset -= arc.speed * 0.5;
        }
      });

      // Node pulse
      nodeGroup.children.forEach((node, i) => {
        const phase = i * 0.6;
        node.scale.setScalar(1 + 0.3 * Math.abs(Math.sin(t * 1.5 + phase)));
        node.material.opacity = 0.7 + 0.3 * Math.abs(Math.sin(t * 1.5 + phase));
      });

      // Particle drift
      const pPos = particles.points.geometry.attributes.position;
      for (let i = 0; i < particles.velocities.length; i++) {
        const v = particles.velocities[i];
        pPos.array[i * 3]     += v.x * 0.001;
        pPos.array[i * 3 + 1] += v.y * 0.001;
        pPos.array[i * 3 + 2] += v.z * 0.001;
        // Reset if too far
        const d = Math.sqrt(
          pPos.array[i*3]**2 + pPos.array[i*3+1]**2 + pPos.array[i*3+2]**2
        );
        if (d > 2.2) {
          pPos.array[i*3]     *= 0.3;
          pPos.array[i*3+1]   *= 0.3;
          pPos.array[i*3+2]   *= 0.3;
        }
      }
      pPos.needsUpdate = true;

      // Mouse parallax (damped)
      target.x += (mouse.x - target.x) * 0.05;
      target.y += (mouse.y - target.y) * 0.05;
      globe.rotation.x     = target.y * 0.5;
      nodeGroup.rotation.x = target.y * 0.5;
      arcGroup.rotation.x  = target.y * 0.5;

      renderer.render(scene, camera);
    }

    animate();
  }

  // ── Helper: Dot-map texture ───────────────────────────────────
  function generateDotMapTexture() {
    const size   = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Ocean base
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, size, size);

    // Draw continent dots using lat/lon sampling
    const dotR = 2.2;
    const cols = Math.floor(size / (dotR * 2.8));
    const rows = Math.floor(size / (dotR * 2.8));

    // Rough continent mask (simplified polygon approximation via land check)
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const lon = (col / cols) * 360 - 180;
        const lat = 90 - (row / rows) * 180;
        if (isLand(lat, lon)) {
          const x = (col / cols) * size + dotR;
          const y = (row / rows) * size + dotR;
          // Brightness based on latitude (brighter near equator)
          const brightness = 0.6 + 0.4 * Math.cos(lat * Math.PI / 180);
          const alpha = 0.7 + 0.3 * brightness;
          // Cyan-blue gradient on continents
          const hue = 190 + (lon / 180) * 20;
          ctx.beginPath();
          ctx.arc(x, y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 90%, ${55 + brightness * 25}%, ${alpha})`;
          ctx.fill();
        }
      }
    }

    // Add bright hotspot glows for supply-chain cities
    CITIES.forEach(city => {
      const x = ((city.lon + 180) / 360) * size;
      const y = ((90 - city.lat) / 180) * size;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 20);
      grad.addColorStop(0, 'rgba(0,229,255,0.9)');
      grad.addColorStop(0.3, 'rgba(0,180,255,0.4)');
      grad.addColorStop(1, 'rgba(0,100,200,0)');
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    return new THREE.CanvasTexture(canvas);
  }

  // Simplified land detection (approximate bounding boxes)
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
    // Asia (main)
    if (lat > 10 && lat < 75 && lon > 25 && lon < 150) return true;
    // South/SE Asia
    if (lat > -10 && lat < 25 && lon > 95 && lon < 145) return true;
    // Australia
    if (lat > -44 && lat < -10 && lon > 113 && lon < 155) return true;
    // Japan
    if (lat > 30 && lat < 46 && lon > 128 && lon < 148) return true;
    // UK / Ireland
    if (lat > 50 && lat < 60 && lon > -11 && lon < 2) return true;
    // Greenland
    if (lat > 60 && lat < 85 && lon > -60 && lon < -18) return true;
    // Antarctica (small strip)
    if (lat < -72) return true;
    return false;
  }

  // ── Helper: Orbital ring ──────────────────────────────────────
  function makeRing(radius, color, opacity) {
    const geo = new THREE.TorusGeometry(radius, 0.004, 8, 180);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Mesh(geo, mat);
  }

  // ── Helper: City node ─────────────────────────────────────────
  function makeNode(pos) {
    const geo = new THREE.SphereGeometry(0.012, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    return mesh;
  }

  // ── Helper: Arc between two points ───────────────────────────
  function makeArc(posA, posB, globeR) {
    const mid = new THREE.Vector3()
      .addVectors(posA, posB)
      .multiplyScalar(0.5);
    const len = posA.distanceTo(posB);
    mid.normalize().multiplyScalar(globeR + 0.35 + len * 0.3);

    const curve = new THREE.CatmullRomCurve3([posA, mid, posB]);
    const points = curve.getPoints(60);
    const geo  = new THREE.BufferGeometry().setFromPoints(points);
    const mat  = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);

    // Travelling packet (small bright sphere)
    const pktGeo = new THREE.SphereGeometry(0.008, 6, 6);
    const pktMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
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

  // ── Helper: Particle field ────────────────────────────────────
  function makeParticles(count, globeR) {
    const positions   = new Float32Array(count * 3);
    const velocities  = [];

    for (let i = 0; i < count; i++) {
      // Distribute in a shell around globe
      const r     = globeR * 1.1 + Math.random() * globeR * 0.8;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.cos(phi);
      positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);

      velocities.push({
        x: (Math.random() - 0.5) * 0.6,
        y: (Math.random() - 0.5) * 0.6,
        z: (Math.random() - 0.5) * 0.6,
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x88ddff,
      size: 0.006,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    return { points: new THREE.Points(geo, mat), velocities };
  }

  // ── Expose init ───────────────────────────────────────────────
  window.AtlasGlobe = { init: initGlobe };

})();
