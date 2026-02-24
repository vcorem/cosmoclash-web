import * as THREE from 'three';

export const FROST_TRAIL_CONFIG = {
  POOL_SIZE: 80,
  EMIT_RATE: 60,          // particles per second — dense, nearly one per frame
  MIN_LIFETIME: 800,      // ms
  MAX_LIFETIME: 1200,     // ms
  START_SIZE: 1400,       // initial point size (matches shield overlay scale)
  END_SIZE: 100,          // shrinks to this over lifetime
} as const;

/**
 * Frost trail effect: spawns the shield texture at the ship position each frame,
 * each instance shrinking over its lifetime. The high density creates a nearly
 * continuous glowing trail behind the ship.
 */
export class FrostTrailEffect {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private opacities: Float32Array;
  private sizes: Float32Array;
  private ages: Float32Array;
  private lifetimes: Float32Array;
  private nextIndex = 0;
  private timeSinceLastEmit = 0;
  private geometry: THREE.BufferGeometry;
  private posAttr: THREE.BufferAttribute;
  private opacityAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;

  constructor(texture: THREE.Texture) {
    const n = FROST_TRAIL_CONFIG.POOL_SIZE;
    this.positions = new Float32Array(n * 3);
    this.opacities = new Float32Array(n);
    this.sizes = new Float32Array(n);
    this.ages = new Float32Array(n);
    this.lifetimes = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = -9999;
      this.opacities[i] = 0;
      this.sizes[i] = 0;
      this.ages[i] = 0;
      this.lifetimes[i] = 0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.opacityAttr = new THREE.BufferAttribute(this.opacities, 1);
    this.sizeAttr = new THREE.BufferAttribute(this.sizes, 1);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('opacity', this.opacityAttr);
    this.geometry.setAttribute('size', this.sizeAttr);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        color: { value: new THREE.Color(0.5, 0.75, 1.0) },
      },
      vertexShader: `
        attribute float opacity;
        attribute float size;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform vec3 color;
        varying float vOpacity;
        void main() {
          vec4 texColor = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(texColor.rgb * color, texColor.a * vOpacity * 0.7);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  getOpacity(index: number): number {
    return this.opacities[index];
  }

  getPosition(index: number): { x: number; y: number; z: number } {
    return {
      x: this.positions[index * 3],
      y: this.positions[index * 3 + 1],
      z: this.positions[index * 3 + 2],
    };
  }

  update(dt: number, isActive: boolean, shipX: number, shipY: number): void {
    const n = FROST_TRAIL_CONFIG.POOL_SIZE;
    const startSize = FROST_TRAIL_CONFIG.START_SIZE;
    const endSize = FROST_TRAIL_CONFIG.END_SIZE;

    // Age existing particles — shrink and fade
    for (let i = 0; i < n; i++) {
      if (this.opacities[i] <= 0) continue;
      this.ages[i] += dt;
      if (this.ages[i] >= this.lifetimes[i]) {
        this.opacities[i] = 0;
        this.sizes[i] = 0;
        this.positions[i * 3 + 2] = -9999;
      } else {
        const t = this.ages[i] / this.lifetimes[i]; // 0→1
        this.opacities[i] = 1 - t;
        this.sizes[i] = startSize + (endSize - startSize) * t;
      }
    }

    // Spawn new particles when shield is active
    if (isActive) {
      this.timeSinceLastEmit += dt;
      const emitInterval = 1000 / FROST_TRAIL_CONFIG.EMIT_RATE;

      while (this.timeSinceLastEmit >= emitInterval) {
        this.timeSinceLastEmit -= emitInterval;
        this.spawnParticle(shipX, shipY);
      }
    } else {
      this.timeSinceLastEmit = 0;
    }

    this.posAttr.needsUpdate = true;
    this.opacityAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  private spawnParticle(shipX: number, shipY: number): void {
    const i = this.nextIndex;
    this.nextIndex = (this.nextIndex + 1) % FROST_TRAIL_CONFIG.POOL_SIZE;

    this.positions[i * 3] = shipX;
    this.positions[i * 3 + 1] = shipY;
    this.positions[i * 3 + 2] = 0;
    this.opacities[i] = 1;
    this.sizes[i] = FROST_TRAIL_CONFIG.START_SIZE;
    this.ages[i] = 0;
    this.lifetimes[i] = FROST_TRAIL_CONFIG.MIN_LIFETIME +
      Math.random() * (FROST_TRAIL_CONFIG.MAX_LIFETIME - FROST_TRAIL_CONFIG.MIN_LIFETIME);
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.ShaderMaterial).dispose();
  }
}
