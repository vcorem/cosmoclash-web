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
  const colors = new Float32Array(ARENA.NUM_STARS * 3);
  const extent = ARENA.STARS_EXTENT;

  for (let i = 0; i < ARENA.NUM_STARS; i++) {
    positions[i * 3] = (Math.random() - 0.5) * extent;
    positions[i * 3 + 1] = (Math.random() - 0.5) * extent;
    positions[i * 3 + 2] = Math.random() * extent; // random Z depth in cube
    // Brightness from depth matching C++ CStarsNode: closer = brighter
    const brightness = (extent - positions[i * 3 + 2]) / extent;
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Original uses star_test-02.jpg (blue glow) as 10x10 billboard quads
  // with EMT_TRANSPARENT_ADD_COLOR (additive blending).
  // ShaderMaterial clamps max point size and applies radial falloff to
  // prevent close stars from showing square JPEG edges.
  const starTexture = new THREE.TextureLoader().load('/textures/star_test-02.jpg');
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: starTexture },
      starSize: { value: 50.0 },
      maxPointSize: { value: 60.0 },
      viewportHeight: { value: window.innerHeight * window.devicePixelRatio },
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
      uniform float starSize;
      uniform float maxPointSize;
      uniform float viewportHeight;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(starSize * (viewportHeight * 0.5 / -mvPosition.z), maxPointSize);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      varying vec3 vColor;
      void main() {
        vec4 texColor = texture2D(map, gl_PointCoord);
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        gl_FragColor = vec4(texColor.rgb * vColor, texColor.a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const stars = new THREE.Points(geometry, material);
  stars.position.z = ARENA.STARS_Z;
  stars.renderOrder = -1; // render before all other transparent objects
  return stars;
}

export function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  return renderer;
}
