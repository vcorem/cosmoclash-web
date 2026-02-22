import * as THREE from 'three';
import { ARENA } from './Arena';

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000011);

  // Ambient light matching original
  const ambient = new THREE.AmbientLight(0x4d4d4d); // (0.3, 0.3, 0.3)
  scene.add(ambient);

  // Directional light for ship illumination
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(-30, 30, -20);
  scene.add(dirLight);

  return scene;
}

export function createStarField(): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ARENA.NUM_STARS * 3);
  const extent = ARENA.STARS_EXTENT;

  for (let i = 0; i < ARENA.NUM_STARS; i++) {
    positions[i * 3] = (Math.random() - 0.5) * extent;
    positions[i * 3 + 1] = (Math.random() - 0.5) * extent;
    positions[i * 3 + 2] = (Math.random() - 0.5) * extent;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: true,
  });

  const stars = new THREE.Points(geometry, material);
  stars.position.z = ARENA.STARS_Z;
  return stars;
}

export function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  return renderer;
}
