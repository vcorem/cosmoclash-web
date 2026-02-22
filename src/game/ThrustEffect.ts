import * as THREE from 'three';

export const THRUST_CONFIG = {
  POOL_SIZE: 60,
  EMIT_RATE: 40,        // particles per second
  MIN_LIFETIME: 200,    // ms
  MAX_LIFETIME: 400,    // ms
  SPAWN_OFFSET: 25,     // units behind ship
  SPREAD: 3,            // ±units perpendicular
  PARTICLE_SIZE: 20,
} as const;

export class ThrustEffect {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private opacities: Float32Array;
  private ages: Float32Array;
  private lifetimes: Float32Array;
  private nextIndex = 0;
  private timeSinceLastEmit = 0;
  private geometry: THREE.BufferGeometry;
  private posAttr: THREE.Float32BufferAttribute;
  private opacityAttr: THREE.Float32BufferAttribute;

  constructor(texture: THREE.Texture) {
    const n = THRUST_CONFIG.POOL_SIZE;
    this.positions = new Float32Array(n * 3);
    this.opacities = new Float32Array(n);
    this.ages = new Float32Array(n);
    this.lifetimes = new Float32Array(n);

    // All particles start dead (opacity 0, off-screen)
    for (let i = 0; i < n; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = -9999;
      this.opacities[i] = 0;
      this.ages[i] = 0;
      this.lifetimes[i] = 0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.Float32BufferAttribute(this.positions, 3);
    this.opacityAttr = new THREE.Float32BufferAttribute(this.opacities, 1);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('opacity', this.opacityAttr);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        pointSize: { value: THRUST_CONFIG.PARTICLE_SIZE },
      },
      vertexShader: `
        attribute float opacity;
        varying float vOpacity;
        uniform float pointSize;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying float vOpacity;
        void main() {
          vec4 texColor = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(texColor.rgb, texColor.a * vOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
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

  getLifetime(index: number): number {
    return this.lifetimes[index];
  }

  update(dt: number, isThrusting: boolean, shipX: number, shipY: number, shipAngle: number): void {
    const n = THRUST_CONFIG.POOL_SIZE;

    // Age existing particles
    for (let i = 0; i < n; i++) {
      if (this.opacities[i] <= 0) continue;
      this.ages[i] += dt;
      if (this.ages[i] >= this.lifetimes[i]) {
        this.opacities[i] = 0;
        this.positions[i * 3 + 2] = -9999;
      } else {
        this.opacities[i] = 1 - this.ages[i] / this.lifetimes[i];
      }
    }

    // Spawn new particles if thrusting
    if (isThrusting) {
      this.timeSinceLastEmit += dt;
      const emitInterval = 1000 / THRUST_CONFIG.EMIT_RATE;

      while (this.timeSinceLastEmit >= emitInterval) {
        this.timeSinceLastEmit -= emitInterval;
        this.spawnParticle(shipX, shipY, shipAngle);
      }
    } else {
      this.timeSinceLastEmit = 0;
    }

    // Mark buffers for GPU upload
    this.posAttr.needsUpdate = true;
    this.opacityAttr.needsUpdate = true;
  }

  private spawnParticle(shipX: number, shipY: number, shipAngle: number): void {
    const i = this.nextIndex;
    this.nextIndex = (this.nextIndex + 1) % THRUST_CONFIG.POOL_SIZE;

    const rad = shipAngle * (Math.PI / 180);
    // "Behind" is opposite of heading: heading = (-sin(a), cos(a)), behind = (sin(a), -cos(a))
    const behindX = Math.sin(rad) * THRUST_CONFIG.SPAWN_OFFSET;
    const behindY = -Math.cos(rad) * THRUST_CONFIG.SPAWN_OFFSET;

    // Perpendicular direction for spread: (cos(a), sin(a))
    const perpX = Math.cos(rad);
    const perpY = Math.sin(rad);
    const spread = (Math.random() - 0.5) * 2 * THRUST_CONFIG.SPREAD;

    this.positions[i * 3] = shipX + behindX + perpX * spread;
    this.positions[i * 3 + 1] = shipY + behindY + perpY * spread;
    this.positions[i * 3 + 2] = 0;
    this.opacities[i] = 1;
    this.ages[i] = 0;
    this.lifetimes[i] = THRUST_CONFIG.MIN_LIFETIME +
      Math.random() * (THRUST_CONFIG.MAX_LIFETIME - THRUST_CONFIG.MIN_LIFETIME);
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.ShaderMaterial).dispose();
  }
}
