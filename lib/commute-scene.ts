import * as THREE from 'three';

/**
 * Lightweight low-poly commute scene (WebGL / Three.js).
 *
 * Draws a stylised car driving along a gradient-lit road that recedes into the
 * distance, matching the CoRide indigo → coral identity. The renderer is
 * transparent (`alpha: true`) so the hero's CSS gradient sky shows through and
 * we avoid heavy sky textures.
 *
 * Performance constraints honoured here:
 *   - only low-poly box/cylinder geometry (no imported models, no textures)
 *   - capped pixel ratio (`min(devicePixelRatio, 2)`)
 *   - the render loop pauses when the tab is hidden
 *   - everything is disposed on cleanup
 *
 * This module is client-only and is imported lazily (see `commute-scene.tsx`)
 * so the `three` bundle only ever loads in a browser session that wants motion.
 */

export interface CommuteSceneHandle {
  dispose: () => void;
}

interface BuildOptions {
  /** Progress (0 → 1) of the hero scrolled past the viewport. */
  onScrollProgress?: (value: number) => void;
}

export function createCommuteScene(
  container: HTMLElement,
  _options?: BuildOptions
): CommuteSceneHandle | null {
  if (!container) return null;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x312e81, 12, 36);

  // Read the live brand hues from CSS tokens so the scene stays in sync with
  // the design system (including dark mode).
  const rootStyle = getComputedStyle(document.documentElement);
  function readBrandHsl(name: string): THREE.Color {
    const raw = rootStyle.getPropertyValue(name).trim();
    const parts = raw.split(/\s+/).map((part) => parseFloat(part));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
      return new THREE.Color(0x6366f1);
    }
    return new THREE.Color(`hsl(${parts[0]} ${parts[1]}% ${parts[2]}%)`);
  }
  const indigo = readBrandHsl('--brand-from');
  const coral = readBrandHsl('--brand-to');
  const roadColor = new THREE.Color(0x1e1b4b);

  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
  camera.position.set(4.4, 3.6, 7.4);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // --- Lights: indigo from one side, coral from the other → gradient-lit car.
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const indigoLight = new THREE.DirectionalLight(indigo, 1.1);
  indigoLight.position.set(-4, 5, 2);
  scene.add(indigoLight);

  const coralLight = new THREE.DirectionalLight(coral, 1.1);
  coralLight.position.set(4, 4, 3);
  scene.add(coralLight);

  const rimLight = new THREE.PointLight(0xffffff, 0.5, 12);
  rimLight.position.set(0, 5, -2);
  scene.add(rimLight);

  // --- Road.
  const roadGroup = new THREE.Group();
  scene.add(roadGroup);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 22),
    new THREE.MeshStandardMaterial({ color: roadColor, roughness: 0.9, metalness: 0.05 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  road.position.z = -3;
  roadGroup.add(road);

  // Road edge lines.
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xc7d2fe });
  const edgeGeometry = new THREE.BoxGeometry(0.08, 0.015, 22);
  const leftEdge = new THREE.Mesh(edgeGeometry, edgeMat);
  leftEdge.position.set(-2.18, 0.015, -3);
  leftEdge.rotation.x = -Math.PI / 2;
  roadGroup.add(leftEdge);
  const rightEdge = new THREE.Mesh(edgeGeometry, edgeMat);
  rightEdge.position.set(2.18, 0.015, -3);
  rightEdge.rotation.x = -Math.PI / 2;
  roadGroup.add(rightEdge);

  // Lane dashes — small boxes animated toward the camera to suggest motion.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xe0e7ff });
  const dashGeo = new THREE.BoxGeometry(0.1, 0.02, 1.1);
  const dashes: THREE.Mesh[] = [];
  const DASH_COUNT = 9;
  const DASH_SPACING = 1.6;
  for (let index = 0; index < DASH_COUNT; index += 1) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(0, 0.012, -10 + index * DASH_SPACING);
    roadGroup.add(dash);
    dashes.push(dash);
  }

  // --- Low-poly car.
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.5, 3.1),
    new THREE.MeshStandardMaterial({ color: 0x818cf8, roughness: 0.35, metalness: 0.15 })
  );
  body.position.y = 0.5;
  car.add(body);

  // Coral accent stripe along the side.
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.83, 0.1, 3.15),
    new THREE.MeshStandardMaterial({ color: coral, roughness: 0.4 })
  );
  stripe.position.y = 0.42;
  car.add(stripe);

  // Cabin.
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.62, 1.55),
    new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.25, metalness: 0.2 })
  );
  cabin.position.set(0, 0.94, 0.35);
  car.add(cabin);

  // Windows.
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xe0e7ff });
  const windowGeo = new THREE.BoxGeometry(0.02, 0.42, 1.1);
  const windowL = new THREE.Mesh(windowGeo, windowMat);
  windowL.position.set(-0.68, 0.95, 0.35);
  car.add(windowL);
  const windowR = new THREE.Mesh(windowGeo, windowMat);
  windowR.position.set(0.68, 0.95, 0.35);
  car.add(windowR);

  // Headlight / taillight.
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), headlightMat);
  headlight.position.set(-0.5, 0.45, -1.55);
  car.add(headlight);
  const headlight2 = headlight.clone();
  headlight2.position.set(0.5, 0.45, -1.55);
  car.add(headlight2);
  const taillightMat = new THREE.MeshBasicMaterial({ color: coral });
  const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), taillightMat);
  taillight.position.set(-0.5, 0.45, 1.55);
  car.add(taillight);
  const taillight2 = taillight.clone();
  taillight2.position.set(0.5, 0.45, 1.55);
  car.add(taillight2);

  // Wheels.
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.24, 12);
  const wheelPositions: Array<[number, number, number]> = [
    [-0.72, 0.3, -1.05],
    [0.72, 0.3, -1.05],
    [-0.72, 0.3, 1.05],
    [0.72, 0.3, 1.05]
  ];
  const wheels: THREE.Mesh[] = [];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    car.add(wheel);
    wheels.push(wheel);
  }

  car.position.set(0.6, 0, 2.4);
  scene.add(car);

  // --- Parallax input.
  const pointer = { x: 0, y: 0 };
  const lookTarget = { x: 0, y: 0.8, z: -1 };

  function onPointerMove(event: PointerEvent) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
  }

  let scrollProgress = 0;

  function onScroll() {
    const rect = container.getBoundingClientRect();
    const total = rect.height + window.innerHeight;
    scrollProgress = Math.min(1, Math.max(0, -rect.top / total));
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Resize.
  function onResize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // --- Render loop.
  const clock = new THREE.Clock();
  let rafId = 0;
  let disposed = false;

  function tick() {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);

    // Pause while the tab is hidden to save battery / CPU.
    if (document.hidden) return;

    const elapsed = clock.getElapsedTime();

    // Animate lane dashes toward the camera to convey forward motion.
    const dashSpeed = 0.06;
    for (const dash of dashes) {
      dash.position.z += dashSpeed;
      if (dash.position.z > 6) dash.position.z -= DASH_COUNT * DASH_SPACING;
    }

    // Gentle drive bob + slow sway.
    car.position.y = Math.sin(elapsed * 1.6) * 0.03;
    car.rotation.y = Math.sin(elapsed * 0.4) * 0.03;

    // Subtle auto-drift so the scene never feels static.
    const autoX = Math.sin(elapsed * 0.2) * 0.15;
    const autoY = Math.cos(elapsed * 0.18) * 0.06;

    // Cursor parallax (lerped) + scroll tilt.
    const targetX = pointer.x * 0.7 + autoX;
    const targetY = 3.6 + pointer.y * 0.45 + autoY;
    camera.position.x += (targetX - camera.position.x) * 0.045;
    camera.position.y += (targetY - camera.position.y) * 0.045;

    roadGroup.rotation.x = scrollProgress * 0.16;

    camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);

    renderer.render(scene, camera);
  }

  tick();

  // --- Cleanup.
  function dispose() {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });

    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return { dispose };
}
