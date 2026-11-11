import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import {
  HEXAGRAMS,
  LINE_COUNT,
  changedHexagram,
  nuclearHexagram,
  oppositeHexagram,
  reversedHexagram,
  singleLineEdges,
  type Hexagram,
} from '../domain/hexagrams.ts';
import { computeSphereLayout } from '../domain/layout.ts';
import { dampOffset, easingShare } from './motion.ts';
import type { RelationColors, SceneColors, Theme } from '../theme/themes.ts';

export interface SphereSceneCallbacks {
  onPick(hexagram: Hexagram): void;
  onHover(hexagram: Hexagram | null, clientX: number, clientY: number): void;
}

interface NodeView {
  hexagram: Hexagram;
  sprite: THREE.Sprite;
  position: THREE.Vector3;
  scale: number;
  opacity: number;
  /** Shader uniform: 1 applies the scene fog in full, 0 ignores it. */
  fogScale: { value: number };
}

type RelationKey = keyof RelationColors;

const RELATION_KEYS: RelationKey[] = ['opposite', 'reversed', 'nuclear'];

const RELATION_LABELS: Record<RelationKey, string> = {
  opposite: '错',
  reversed: '综',
  nuclear: '互',
};

const CAMERA_DISTANCE = 3.5;
const MIN_CAMERA_DISTANCE = 1.9;
const MAX_CAMERA_DISTANCE = 6;
const CAMERA_FOV = 45;

// Node sprites are drawn on a canvas of this logical size and shown at
// NODE_WIDTH world units. The round plate is anchored on the node position.
const TEXTURE_WIDTH = 160;
const TEXTURE_HEIGHT = 200;
const TEXTURE_PIXEL_RATIO = 2;
const PLATE_CENTER_Y = 66;
const PLATE_RADIUS = 56;
const NODE_WIDTH = 0.185;
const NODE_HEIGHT = (NODE_WIDTH * TEXTURE_HEIGHT) / TEXTURE_WIDTH;
const HALO_SIZE = NODE_WIDTH * 2.4;

const ARC_SEGMENTS = 16;
// Arcs stop at the rim of the plate so they never cross the hexagram drawing.
const ARC_CLEARANCE = (PLATE_RADIUS / TEXTURE_WIDTH) * NODE_WIDTH + 0.008;

const SELECTED_SCALE = 1.5;
const NEIGHBOR_SCALE = 1.14;
const HOVER_SCALE = 1.16;
const UNRELATED_OPACITY = 0.42;
const CLICK_TOLERANCE_PX = 6;
const AUTO_ROTATE_SPEED = 0.45;

// Time constants in seconds. Every animated value approaches its target
// exponentially, so a change that arrives mid-animation continues smoothly.
const NODE_EASING_TIME = 0.14;
const SELECTION_FADE_TIME = 0.16;
const CAMERA_SMOOTH_TIME = 0.3;
const CAMERA_SETTLED_ANGLE = 0.0005;
const MAX_FRAME_SECONDS = 0.05;

// The stock fog chunk with one extra factor, so a node can ease out of the fog.
const SCALED_FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth ) * fogScale;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width * TEXTURE_PIXEL_RATIO;
  canvas.height = height * TEXTURE_PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is not available');
  }
  context.scale(TEXTURE_PIXEL_RATIO, TEXTURE_PIXEL_RATIO);
  return [canvas, context];
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawNodeTexture(hexagram: Hexagram, colors: SceneColors): THREE.CanvasTexture {
  const [canvas, context] = createCanvas(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const centerX = TEXTURE_WIDTH / 2;

  const ringColor = new THREE.Color(colors.ringYin).lerp(
    new THREE.Color(colors.ringYang),
    hexagram.yangCount / LINE_COUNT,
  );
  context.beginPath();
  context.arc(centerX, PLATE_CENTER_Y, PLATE_RADIUS, 0, Math.PI * 2);
  context.fillStyle = colors.plate;
  context.fill();
  context.lineWidth = 2.2;
  context.strokeStyle = ringColor.getStyle();
  context.stroke();

  const barWidth = 58;
  const barHeight = 7;
  const barGap = 5.4;
  const yinGap = 11;
  const stackHeight = LINE_COUNT * barHeight + (LINE_COUNT - 1) * barGap;
  const top = PLATE_CENTER_Y - stackHeight / 2;
  for (let row = 0; row < LINE_COUNT; row += 1) {
    // Row 0 is the top line, which is the last entry of `lines`.
    const isYang = hexagram.lines[LINE_COUNT - 1 - row];
    const y = top + row * (barHeight + barGap);
    const left = centerX - barWidth / 2;
    context.fillStyle = isYang ? colors.yangLine : colors.yinLine;
    context.beginPath();
    if (isYang) {
      context.roundRect(left, y, barWidth, barHeight, 1.5);
    } else {
      const halfWidth = (barWidth - yinGap) / 2;
      context.roundRect(left, y, halfWidth, barHeight, 1.5);
      context.roundRect(left + halfWidth + yinGap, y, halfWidth, barHeight, 1.5);
    }
    context.fill();
  }

  context.font = '600 30px "Songti SC", "Noto Serif SC", "STSong", serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = 6;
  context.strokeStyle = colors.labelOutline;
  const labelY = PLATE_CENTER_Y + PLATE_RADIUS + 26;
  context.strokeText(hexagram.name, centerX, labelY);
  context.fillStyle = colors.label;
  context.fillText(hexagram.name, centerX, labelY);
  return toTexture(canvas);
}

/** A soft white ring. The sprite material tints it, so a theme change needs no redraw. */
function drawHaloTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, context] = createCanvas(size, size);
  const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.22, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return toTexture(canvas);
}

/** A pill-shaped badge with one character per relation, such as 错 or 错综. */
function drawBadgeTexture(relations: RelationKey[], colors: SceneColors): THREE.CanvasTexture {
  const height = 64;
  const characterWidth = 44;
  const width = 24 + characterWidth * relations.length;
  const [canvas, context] = createCanvas(width, height);
  context.beginPath();
  context.roundRect(2, 2, width - 4, height - 4, (height - 4) / 2);
  context.fillStyle = colors.plate;
  context.fill();
  context.lineWidth = 2.5;
  context.strokeStyle = colors.relations[relations[0]];
  context.stroke();
  context.font = '700 34px "PingFang SC", "Noto Sans SC", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  relations.forEach((relation, index) => {
    context.fillStyle = colors.relations[relation];
    context.fillText(RELATION_LABELS[relation], 12 + characterWidth * (index + 0.5), height / 2 + 2);
  });
  return toTexture(canvas);
}

/** Points along the great-circle arc between two unit vectors, trimmed at both ends. */
function arcPoints(from: THREE.Vector3, to: THREE.Vector3, clearance: number): THREE.Vector3[] {
  const angle = from.angleTo(to);
  const start = Math.min(clearance / angle, 0.45);
  const points: THREE.Vector3[] = [];
  for (let step = 0; step <= ARC_SEGMENTS; step += 1) {
    const t = start + ((1 - 2 * start) * step) / ARC_SEGMENTS;
    const point = from
      .clone()
      .multiplyScalar(Math.sin((1 - t) * angle))
      .addScaledVector(to, Math.sin(t * angle))
      .divideScalar(Math.sin(angle));
    points.push(point);
  }
  return points;
}

/** Flattens polylines into the vertex-pair layout that line segment geometries expect. */
function toSegmentPositions(polylines: THREE.Vector3[][]): number[] {
  const positions: number[] = [];
  for (const polyline of polylines) {
    for (let index = 0; index < polyline.length - 1; index += 1) {
      positions.push(...polyline[index].toArray(), ...polyline[index + 1].toArray());
    }
  }
  return positions;
}

function shortestAngle(from: number, to: number): number {
  const difference = (to - from) % (Math.PI * 2);
  if (difference > Math.PI) {
    return difference - Math.PI * 2;
  }
  if (difference < -Math.PI) {
    return difference + Math.PI * 2;
  }
  return difference;
}

/**
 * The 3D view: 64 hexagram nodes on a sphere, joined by an edge wherever two
 * hexagrams differ in a single line.
 */
export class SphereScene {
  private readonly container: HTMLElement;
  private readonly callbacks: SphereSceneCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly fog = new THREE.Fog(0, 1, 10);
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly nodes: NodeView[] = [];
  private readonly nodeBySprite = new Map<THREE.Object3D, NodeView>();
  private readonly nodeByCode = new Map<number, NodeView>();
  private readonly selectionGroup = new THREE.Group();
  private readonly badges: THREE.Sprite[] = [];
  private readonly badgeTextures = new Map<string, THREE.CanvasTexture>();
  private readonly edgeMaterial = new THREE.LineBasicMaterial({ transparent: true });
  private readonly guideMaterial = new THREE.LineBasicMaterial({ transparent: true });
  private readonly changeEdgeMaterial = new LineMaterial({ linewidth: 2.4, transparent: true });
  private readonly relationMaterials: Record<RelationKey, LineMaterial>;
  private readonly halo: THREE.Sprite;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private colors: SceneColors;
  private selected: Hexagram | null = null;
  private hovered: NodeView | null = null;
  private related = new Set<number>();
  private neighbors = new Set<number>();
  private pointerDown: { x: number; y: number } | null = null;
  /** Rises from 0 to 1 after each selection change and fades the highlight in. */
  private selectionFade = 1;
  private cameraGoal: THREE.Spherical | null = null;
  private cameraVelocity = { phi: 0, theta: 0 };
  private lastFrameTime = performance.now();

  constructor(container: HTMLElement, callbacks: SphereSceneCallbacks, theme: Theme) {
    this.container = container;
    this.callbacks = callbacks;
    this.colors = theme.scene;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(this.renderer.domElement);

    this.scene.background = new THREE.Color();
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
    this.camera.position.set(1.2, 1.1, 3.1).setLength(CAMERA_DISTANCE);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;
    this.controls.minDistance = MIN_CAMERA_DISTANCE;
    this.controls.maxDistance = MAX_CAMERA_DISTANCE;
    this.controls.autoRotate = !this.reducedMotion;
    this.controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    // A drag takes over from any camera move that is still playing.
    this.controls.addEventListener('start', () => this.stopCameraMove());

    const relationMaterial = () =>
      new LineMaterial({
        linewidth: 2,
        dashed: true,
        dashSize: 0.05,
        gapSize: 0.035,
        transparent: true,
      });
    this.relationMaterials = {
      opposite: relationMaterial(),
      reversed: relationMaterial(),
      nuclear: relationMaterial(),
    };

    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: drawHaloTexture(),
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.halo.scale.setScalar(HALO_SIZE);
    this.halo.visible = false;
    this.halo.renderOrder = 1;
    this.scene.add(this.halo);

    this.buildGuides();
    this.buildNodes();
    this.buildEdges();
    this.scene.add(this.selectionGroup);
    this.applyColors();

    this.bindPointerEvents();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.compileSelectionShaders();
    this.renderer.setAnimationLoop(() => this.renderFrame());
  }

  get autoRotate(): boolean {
    return this.controls.autoRotate;
  }

  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
  }

  /** Highlights a hexagram and its relations, and optionally turns the sphere to face it. */
  setSelection(hexagram: Hexagram | null, options: { focus?: boolean } = {}): void {
    if (hexagram?.code !== this.selected?.code) {
      this.selected = hexagram;
      this.rebuildSelection();
    }
    if (hexagram && options.focus) {
      this.controls.autoRotate = false;
      this.focusOn(hexagram);
    }
  }

  setTheme(theme: Theme): void {
    this.colors = theme.scene;
    this.applyColors();
    this.rebuildSelection();
  }

  /** Pushes the current colors into every material and redraws the canvas textures. */
  private applyColors(): void {
    const colors = this.colors;
    (this.scene.background as THREE.Color).set(colors.background);
    this.fog.color.set(colors.background);
    this.edgeMaterial.color.set(colors.edge);
    this.guideMaterial.color.set(colors.guide);
    this.guideMaterial.opacity = colors.guideOpacity;
    this.changeEdgeMaterial.color.set(colors.changeEdge);
    for (const relation of RELATION_KEYS) {
      this.relationMaterials[relation].color.set(colors.relations[relation]);
    }
    this.halo.material.color.set(colors.halo);
    for (const node of this.nodes) {
      node.sprite.material.map?.dispose();
      node.sprite.material.map = drawNodeTexture(node.hexagram, colors);
    }
    for (const texture of this.badgeTextures.values()) {
      texture.dispose();
    }
    this.badgeTextures.clear();
  }

  /** Faint latitude circles and the axis from 乾 to 坤 that show the layered structure. */
  private buildGuides(): void {
    for (let yangCount = 1; yangCount < LINE_COUNT; yangCount += 1) {
      const polar = (Math.PI * (LINE_COUNT - yangCount)) / LINE_COUNT;
      const points: THREE.Vector3[] = [];
      for (let step = 0; step <= 96; step += 1) {
        points.push(new THREE.Vector3().setFromSphericalCoords(1, polar, (Math.PI * 2 * step) / 96));
      }
      this.scene.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.guideMaterial),
      );
    }
    const axis = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 1 - ARC_CLEARANCE, 0),
      new THREE.Vector3(0, -1 + ARC_CLEARANCE, 0),
    ]);
    this.scene.add(new THREE.Line(axis, this.guideMaterial));
  }

  private buildNodes(): void {
    const layout = computeSphereLayout();
    for (const hexagram of HEXAGRAMS) {
      const point = layout[hexagram.code];
      const fogScale = { value: 1 };
      const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
      // All node materials share one compiled program. Each keeps its own
      // fogScale value, which changes without recompiling the shader.
      material.onBeforeCompile = (shader) => {
        shader.uniforms.fogScale = fogScale;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\nuniform float fogScale;')
          .replace('#include <fog_fragment>', SCALED_FOG_FRAGMENT);
      };
      material.customProgramCacheKey = () => 'node-with-scaled-fog';

      const sprite = new THREE.Sprite(material);
      sprite.position.set(point.x, point.y, point.z);
      sprite.center.set(0.5, 1 - PLATE_CENTER_Y / TEXTURE_HEIGHT);
      sprite.scale.set(NODE_WIDTH, NODE_HEIGHT, 1);
      sprite.renderOrder = 2;
      this.scene.add(sprite);
      const node: NodeView = {
        hexagram,
        sprite,
        position: sprite.position.clone(),
        scale: 1,
        opacity: 1,
        fogScale,
      };
      this.nodes.push(node);
      this.nodeBySprite.set(sprite, node);
      this.nodeByCode.set(hexagram.code, node);
    }
  }

  private positionOf(hexagram: Hexagram): THREE.Vector3 {
    const node = this.nodeByCode.get(hexagram.code);
    if (!node) {
      throw new Error(`No node for hexagram ${hexagram.name}`);
    }
    return node.position;
  }

  private buildEdges(): void {
    const arcs = singleLineEdges().map(([from, to]) => {
      const fromNode = this.nodeByCode.get(from);
      const toNode = this.nodeByCode.get(to);
      if (!fromNode || !toNode) {
        throw new Error('Edge refers to a missing node');
      }
      return arcPoints(fromNode.position, toNode.position, ARC_CLEARANCE);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(toSegmentPositions(arcs), 3));
    this.edgeMaterial.opacity = this.colors.edgeOpacity;
    this.scene.add(new THREE.LineSegments(geometry, this.edgeMaterial));
  }

  /**
   * Compiles the shaders that only a selection uses. Without this step, the
   * first click would pause while the browser compiles them.
   */
  private compileSelectionShaders(): void {
    this.selected = HEXAGRAMS[2];
    this.rebuildSelection();
    this.renderer.compile(this.scene, this.camera);
    this.selected = null;
    this.rebuildSelection();
    this.selectionFade = 1;
  }

  private rebuildSelection(): void {
    for (const child of [...this.selectionGroup.children]) {
      this.selectionGroup.remove(child);
      (child as Partial<THREE.Mesh>).geometry?.dispose();
    }
    for (const badge of this.badges) {
      badge.material.dispose();
    }
    this.badges.length = 0;
    this.related = new Set();
    this.neighbors = new Set();
    this.halo.visible = false;
    this.selectionFade = 0;

    const selected = this.selected;
    if (!selected) {
      return;
    }
    const origin = this.positionOf(selected);
    this.related.add(selected.code);
    this.halo.position.copy(origin);
    this.halo.visible = true;

    const changeArcs: THREE.Vector3[][] = [];
    for (let line = 1; line <= LINE_COUNT; line += 1) {
      const neighbor = changedHexagram(selected, line);
      this.neighbors.add(neighbor.code);
      this.related.add(neighbor.code);
      changeArcs.push(arcPoints(origin, this.positionOf(neighbor), ARC_CLEARANCE));
    }
    const changeGeometry = new LineSegmentsGeometry().setPositions(toSegmentPositions(changeArcs));
    const changeEdges = new LineSegments2(changeGeometry, this.changeEdgeMaterial);
    changeEdges.renderOrder = 1;
    this.selectionGroup.add(changeEdges);

    const relationTargets: [RelationKey, Hexagram][] = [
      ['opposite', oppositeHexagram(selected)],
      ['reversed', reversedHexagram(selected)],
      ['nuclear', nuclearHexagram(selected)],
    ];
    const oppositeCode = oppositeHexagram(selected).code;
    const relationsByCode = new Map<number, RelationKey[]>();
    for (const [relation, target] of relationTargets) {
      // Some hexagrams are their own reversed or nuclear hexagram.
      if (target.code === selected.code) {
        continue;
      }
      this.related.add(target.code);
      relationsByCode.set(target.code, [...(relationsByCode.get(target.code) ?? []), relation]);
      // When another relation also lands on the opposite hexagram, the straight
      // link already joins the two and the badge names both relations.
      const sharesOppositeLink = relation !== 'opposite' && target.code === oppositeCode;
      if (!sharesOppositeLink) {
        this.selectionGroup.add(this.buildRelationLine(relation, origin, this.positionOf(target)));
      }
    }
    for (const [code, relations] of relationsByCode) {
      const node = this.nodeByCode.get(code);
      if (node) {
        const badge = this.buildBadge(relations, node.position);
        this.badges.push(badge);
        this.selectionGroup.add(badge);
      }
    }
  }

  private buildRelationLine(relation: RelationKey, from: THREE.Vector3, to: THREE.Vector3): Line2 {
    // The opposite hexagram is antipodal, so its link runs straight through the sphere.
    const points =
      relation === 'opposite'
        ? [from.clone().multiplyScalar(1 - ARC_CLEARANCE), to.clone().multiplyScalar(1 - ARC_CLEARANCE)]
        : arcPoints(from, to, ARC_CLEARANCE).map((point) => point.multiplyScalar(1.03));
    const geometry = new LineGeometry().setPositions(points.flatMap((point) => point.toArray()));
    const line = new Line2(geometry, this.relationMaterials[relation]);
    line.computeLineDistances();
    line.renderOrder = 1;
    return line;
  }

  private buildBadge(relations: RelationKey[], position: THREE.Vector3): THREE.Sprite {
    const key = relations.join('+');
    let texture = this.badgeTextures.get(key);
    if (!texture) {
      texture = drawBadgeTexture(relations, this.colors);
      this.badgeTextures.set(key, texture);
    }
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }),
    );
    const height = NODE_WIDTH * 0.4;
    const image = texture.image as HTMLCanvasElement;
    sprite.scale.set((height * image.width) / image.height, height, 1);
    // The badge hangs off the upper right of the plate.
    sprite.center.set(-0.45, -0.9);
    sprite.position.copy(position);
    sprite.renderOrder = 3;
    return sprite;
  }

  private focusOn(hexagram: Hexagram): void {
    const nodeDirection = new THREE.Spherical().setFromVector3(this.positionOf(hexagram));
    // The camera stops slightly beside the node and nearer the equator. Looking
    // straight at it would hide the opposite hexagram directly behind.
    const goal = new THREE.Spherical(
      1,
      THREE.MathUtils.clamp(nodeDirection.phi * 0.8 + (Math.PI / 2) * 0.2, 0.3, Math.PI - 0.3),
      nodeDirection.theta + 0.32,
    );
    if (this.reducedMotion) {
      const current = new THREE.Spherical().setFromVector3(this.camera.position);
      this.camera.position.setFromSphericalCoords(current.radius, goal.phi, goal.theta);
      return;
    }
    // The velocity is kept, so a new goal during a move does not restart the motion.
    this.cameraGoal = goal;
  }

  private stopCameraMove(): void {
    this.cameraGoal = null;
    this.cameraVelocity = { phi: 0, theta: 0 };
  }

  private advanceCameraMove(deltaSeconds: number): void {
    const goal = this.cameraGoal;
    if (!goal) {
      return;
    }
    const current = new THREE.Spherical().setFromVector3(this.camera.position);
    const velocity = this.cameraVelocity;
    const [phiOffset, phiVelocity] = dampOffset(
      current.phi - goal.phi,
      velocity.phi,
      CAMERA_SMOOTH_TIME,
      deltaSeconds,
    );
    const [thetaOffset, thetaVelocity] = dampOffset(
      -shortestAngle(current.theta, goal.theta),
      velocity.theta,
      CAMERA_SMOOTH_TIME,
      deltaSeconds,
    );
    this.cameraVelocity = { phi: phiVelocity, theta: thetaVelocity };
    this.camera.position.setFromSphericalCoords(
      current.radius,
      goal.phi + phiOffset,
      goal.theta + thetaOffset,
    );
    const isSettled =
      Math.abs(phiOffset) + Math.abs(thetaOffset) < CAMERA_SETTLED_ANGLE &&
      Math.abs(phiVelocity) + Math.abs(thetaVelocity) < CAMERA_SETTLED_ANGLE;
    if (isSettled) {
      this.stopCameraMove();
    }
  }

  private bindPointerEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointerup', (event) => {
      const start = this.pointerDown;
      this.pointerDown = null;
      if (!start) {
        return;
      }
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > CLICK_TOLERANCE_PX) {
        return;
      }
      const node = this.pickNode(event.clientX, event.clientY);
      if (node) {
        this.callbacks.onPick(node.hexagram);
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      // While dragging, the pointer rotates the sphere and hover is suspended.
      const node = this.pointerDown ? null : this.pickNode(event.clientX, event.clientY);
      this.setHovered(node, event.clientX, event.clientY);
    });
    canvas.addEventListener('pointerleave', () => {
      this.setHovered(null, 0, 0);
    });
  }

  private setHovered(node: NodeView | null, clientX: number, clientY: number): void {
    this.hovered = node;
    this.renderer.domElement.style.cursor = node ? 'pointer' : 'grab';
    this.callbacks.onHover(node?.hexagram ?? null, clientX, clientY);
  }

  private pickNode(clientX: number, clientY: number): NodeView | null {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.nodes.map((node) => node.sprite));
    return hits.length > 0 ? (this.nodeBySprite.get(hits[0].object) ?? null) : null;
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    // On narrow viewports the vertical field of view widens so the sphere still fits.
    const horizontalFit = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) / Math.min(this.camera.aspect, 1)),
    );
    this.camera.fov = Math.max(CAMERA_FOV, Math.min(horizontalFit, 80));
    this.camera.updateProjectionMatrix();
    this.changeEdgeMaterial.resolution.set(width, height);
    for (const material of Object.values(this.relationMaterials)) {
      material.resolution.set(width, height);
    }
    // Resizing clears the canvas. Rendering at once avoids a blank frame.
    this.renderer.render(this.scene, this.camera);
  }

  private updateNodes(deltaSeconds: number): void {
    const share = easingShare(deltaSeconds, NODE_EASING_TIME);
    const hasSelection = this.selected !== null;
    for (const node of this.nodes) {
      const code = node.hexagram.code;
      const isRelated = this.related.has(code);
      let targetScale = 1;
      if (this.selected?.code === code) {
        targetScale = SELECTED_SCALE;
      } else if (this.hovered === node) {
        targetScale = HOVER_SCALE;
      } else if (this.neighbors.has(code)) {
        targetScale = NEIGHBOR_SCALE;
      }
      const isDimmed = hasSelection && !isRelated && this.hovered !== node;
      node.scale += (targetScale - node.scale) * share;
      node.opacity += ((isDimmed ? UNRELATED_OPACITY : 1) - node.opacity) * share;
      // Nodes related to the selection leave the fog, so they stay readable on the far side.
      node.fogScale.value += ((isRelated ? 0 : 1) - node.fogScale.value) * share;
      node.sprite.scale.set(NODE_WIDTH * node.scale, NODE_HEIGHT * node.scale, 1);
      node.sprite.material.opacity = node.opacity;
    }
  }

  private updateSelectionFade(deltaSeconds: number, now: number): void {
    const colors = this.colors;
    const share = easingShare(deltaSeconds, SELECTION_FADE_TIME);
    this.selectionFade += (1 - this.selectionFade) * share;
    const fade = this.reducedMotion ? 1 : this.selectionFade;

    const edgeTarget = this.selected ? colors.edgeOpacityWithSelection : colors.edgeOpacity;
    this.edgeMaterial.opacity += (edgeTarget - this.edgeMaterial.opacity) * share;

    this.changeEdgeMaterial.opacity = 0.95 * fade;
    for (const relation of RELATION_KEYS) {
      this.relationMaterials[relation].opacity = 0.95 * fade;
    }
    for (const badge of this.badges) {
      badge.material.opacity = fade;
    }
    if (this.halo.visible) {
      const pulse = this.reducedMotion ? 1 : 1 + 0.05 * Math.sin(now / 480);
      this.halo.scale.setScalar(HALO_SIZE * pulse);
      this.halo.material.opacity = colors.haloOpacity * fade;
    }
  }

  private renderFrame(): void {
    const now = performance.now();
    const deltaSeconds = Math.min((now - this.lastFrameTime) / 1000, MAX_FRAME_SECONDS);
    this.lastFrameTime = now;

    this.advanceCameraMove(deltaSeconds);
    this.controls.update();
    this.updateNodes(deltaSeconds);
    this.updateSelectionFade(deltaSeconds, now);

    // The fog range follows the camera so the far side of the sphere always recedes.
    const distance = this.camera.position.length();
    this.fog.near = distance - 0.7;
    this.fog.far = distance + 2.1;

    this.renderer.render(this.scene, this.camera);
  }
}
