import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm";

const canvas = document.querySelector("#scene");
const loading = document.querySelector("#loading");
const viewer = document.querySelector("#viewer");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070912);
scene.fog = new THREE.Fog(0x070912, 70, 220);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(70, 45, 90);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, -14, 0);
controls.maxDistance = 260;
controls.minDistance = 25;

const hemi = new THREE.HemisphereLight(0xc9d9ff, 0x08060a, 1.7);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffe4a8, 2.1);
key.position.set(45, 80, 35);
key.castShadow = true;
scene.add(key);

const rim = new THREE.DirectionalLight(0x8debd4, 1.1);
rim.position.set(-60, 20, -45);
scene.add(rim);

const params = {
  topRadiusKm: 20000,
  baseRadiusKm: 38000,
  heightKm: 4800,
  profilePower: 1.5,
  surfaceCurveKm: 111000,
  verticalScale: 1.15,
  showBody: true,
  showSurface: true,
  showDensityLayers: true,
  showHellCavity: true,
  showGravityVectors: true,
  showEdgeRing: true,
  showGrid: true,
  cutaway: false,
  vectorCount: 36,
  vectorLength: 8,
  mode: "Gravity"
};

const SCALE = 1 / 600; // km to scene units
let modelGroup = new THREE.Group();
scene.add(modelGroup);

function km(value) {
  return value * SCALE;
}

function radiusAtDepth(depthKm, p = params) {
  const t = THREE.MathUtils.clamp(depthKm / p.heightKm, 0, 1);
  return p.topRadiusKm + (p.baseRadiusKm - p.topRadiusKm) * Math.pow(t, p.profilePower);
}

function surfaceZ(radiusKm, p = params) {
  const rc = Math.max(p.surfaceCurveKm, p.topRadiusKm * 1.01);
  return rc - Math.sqrt(Math.max(0, rc * rc - radiusKm * radiusKm));
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

function makeConicalBody() {
  const radialSegments = params.cutaway ? 54 : 144;
  const heightSegments = 40;
  const angleSpan = params.cutaway ? Math.PI * 1.55 : Math.PI * 2;
  const angleOffset = params.cutaway ? Math.PI * 0.18 : 0;

  const vertices = [];
  const normals = [];
  const indices = [];

  for (let iz = 0; iz <= heightSegments; iz++) {
    const depthKm = params.heightKm * iz / heightSegments;
    const r = km(radiusAtDepth(depthKm));
    const y = -km(depthKm) * params.verticalScale;

    for (let ia = 0; ia <= radialSegments; ia++) {
      const a = angleOffset + angleSpan * ia / radialSegments;
      vertices.push(r * Math.cos(a), y, r * Math.sin(a));
      normals.push(Math.cos(a), 0.2, Math.sin(a));
    }
  }

  const row = radialSegments + 1;
  for (let iz = 0; iz < heightSegments; iz++) {
    for (let ia = 0; ia < radialSegments; ia++) {
      const a = iz * row + ia;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x5b493c,
    roughness: 0.82,
    metalness: 0.05,
    transparent: true,
    opacity: params.mode === "Density" ? 0.46 : 0.82,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = params.showBody;
  return mesh;
}

function makeSurfaceDisk() {
  const radialSegments = 120;
  const angleSegments = params.cutaway ? 96 : 192;
  const angleSpan = params.cutaway ? Math.PI * 1.55 : Math.PI * 2;
  const angleOffset = params.cutaway ? Math.PI * 0.18 : 0;
  const vertices = [];
  const indices = [];

  for (let ir = 0; ir <= radialSegments; ir++) {
    const radiusKm = params.topRadiusKm * ir / radialSegments;
    const r = km(radiusKm);
    const y = km(surfaceZ(radiusKm)) * params.verticalScale + 0.02;

    for (let ia = 0; ia <= angleSegments; ia++) {
      const a = angleOffset + angleSpan * ia / angleSegments;
      vertices.push(r * Math.cos(a), y, r * Math.sin(a));
    }
  }

  const row = angleSegments + 1;
  for (let ir = 0; ir < radialSegments; ir++) {
    for (let ia = 0; ia < angleSegments; ia++) {
      const a = ir * row + ia;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x194e5a,
    emissive: 0x062126,
    roughness: 0.5,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });

  const disk = new THREE.Mesh(geometry, material);
  disk.receiveShadow = true;
  disk.visible = params.showSurface;
  return disk;
}

function makeDensityLayers() {
  const group = new THREE.Group();
  const colors = [0x6c4f36, 0x8a6034, 0xa56f2d, 0xd19b35];
  const depths = [0.25, 0.45, 0.65, 0.85];

  depths.forEach((t, i) => {
    const ringRadiusKm = radiusAtDepth(params.heightKm * t);
    const geometry = new THREE.TorusGeometry(km(ringRadiusKm) * 0.82, 0.08 + i * 0.035, 12, params.cutaway ? 90 : 180);
    const material = new THREE.MeshStandardMaterial({
      color: colors[i],
      emissive: colors[i],
      emissiveIntensity: 0.06,
      transparent: true,
      opacity: params.mode === "Density" ? 0.34 : 0.16,
      roughness: 0.65
    });
    const torus = new THREE.Mesh(geometry, material);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = -km(params.heightKm * t) * params.verticalScale;
    group.add(torus);
  });

  group.visible = params.showDensityLayers;
  return group;
}

function makeEdgeRing() {
  const radius = km(params.topRadiusKm) * 0.985;
  const geometry = new THREE.TorusGeometry(radius, 0.42, 16, params.cutaway ? 110 : 220);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd6a84f,
    emissive: 0x5e3d0c,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.18,
    transparent: true,
    opacity: params.mode === "Density" ? 0.92 : 0.58
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;
  ring.visible = params.showEdgeRing;
  return ring;
}

function makeHellCavity() {
  const geometry = new THREE.SphereGeometry(1, 48, 24);
  const material = new THREE.MeshStandardMaterial({
    color: 0x1a0502,
    emissive: 0x7a1006,
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.82,
    roughness: 0.5,
    side: THREE.DoubleSide
  });
  const cavity = new THREE.Mesh(geometry, material);
  cavity.scale.set(km(params.topRadiusKm * 0.38), km(params.heightKm * 0.18) * params.verticalScale, km(params.topRadiusKm * 0.24));
  cavity.position.set(0, -km(params.heightKm * 0.76) * params.verticalScale, 0);
  cavity.visible = params.showHellCavity;
  return cavity;
}

function makeGravityVectors() {
  const group = new THREE.Group();
  const n = Math.max(6, params.vectorCount);
  const rings = [0.18, 0.36, 0.54, 0.72, 0.9];

  rings.forEach((rt, ringIndex) => {
    const count = Math.max(8, Math.round(n * rt));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ringIndex * 0.17;
      if (params.cutaway && a > Math.PI * 1.55) continue;
      const radiusKm = params.topRadiusKm * rt;
      const x = km(radiusKm) * Math.cos(a);
      const z = km(radiusKm) * Math.sin(a);
      const y = km(surfaceZ(radiusKm)) * params.verticalScale + 1.7;
      const dir = new THREE.Vector3(0, -1, 0);
      const origin = new THREE.Vector3(x, y, z);
      const arrow = new THREE.ArrowHelper(dir, origin, params.vectorLength, 0x70f0d0, 0.9, 0.45);
      group.add(arrow);
    }
  });

  group.visible = params.showGravityVectors;
  return group;
}

function makeGrid() {
  const grid = new THREE.GridHelper(km(params.baseRadiusKm) * 2.2, 36, 0x334155, 0x1f2937);
  grid.position.y = -km(params.heightKm) * params.verticalScale - 0.1;
  grid.visible = params.showGrid;
  return grid;
}

function makeAxisLine() {
  const material = new THREE.LineBasicMaterial({ color: 0xd6a84f, transparent: true, opacity: 0.5 });
  const points = [
    new THREE.Vector3(0, 8, 0),
    new THREE.Vector3(0, -km(params.heightKm) * params.verticalScale - 8, 0)
  ];
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function rebuildModel() {
  disposeObject(modelGroup);
  scene.remove(modelGroup);
  modelGroup = new THREE.Group();
  scene.add(modelGroup);

  modelGroup.add(makeConicalBody());
  modelGroup.add(makeSurfaceDisk());
  modelGroup.add(makeDensityLayers());
  modelGroup.add(makeEdgeRing());
  modelGroup.add(makeHellCavity());
  modelGroup.add(makeGravityVectors());
  modelGroup.add(makeGrid());
  modelGroup.add(makeAxisLine());

  loading.style.display = "none";
}

function applyMode() {
  params.showDensityLayers = ["Density", "Gravity", "Cutaway"].includes(params.mode);
  params.showGravityVectors = ["Gravity", "Cutaway"].includes(params.mode);
  params.cutaway = params.mode === "Cutaway";
  rebuildModel();
}

const gui = new GUI({ title: "Conical gravity model" });
gui.add(params, "mode", ["Geometry", "Density", "Gravity", "Cutaway"]).name("Mode").onChange(applyMode);

gui.add(params, "topRadiusKm", 10000, 30000, 500).name("Top radius km").onFinishChange(rebuildModel);
gui.add(params, "baseRadiusKm", 25000, 50000, 500).name("Base radius km").onFinishChange(rebuildModel);
gui.add(params, "heightKm", 1000, 9000, 100).name("Height km").onFinishChange(rebuildModel);
gui.add(params, "profilePower", 0.5, 3.5, 0.05).name("Profile power").onFinishChange(rebuildModel);
gui.add(params, "surfaceCurveKm", 50000, 180000, 1000).name("Surface curve km").onFinishChange(rebuildModel);
gui.add(params, "verticalScale", 0.4, 3.0, 0.05).name("Vertical scale").onFinishChange(rebuildModel);

const visibility = gui.addFolder("Visibility");
visibility.add(params, "showBody").name("Body").onChange(rebuildModel);
visibility.add(params, "showSurface").name("Surface disk").onChange(rebuildModel);
visibility.add(params, "showDensityLayers").name("Density layers").onChange(rebuildModel);
visibility.add(params, "showHellCavity").name("Ад cavity").onChange(rebuildModel);
visibility.add(params, "showGravityVectors").name("Gravity vectors").onChange(rebuildModel);
visibility.add(params, "showEdgeRing").name("Edge ring").onChange(rebuildModel);
visibility.add(params, "showGrid").name("Grid").onChange(rebuildModel);
visibility.add(params, "cutaway").name("Manual cutaway").onChange(rebuildModel);

const vectors = gui.addFolder("Vectors");
vectors.add(params, "vectorCount", 8, 72, 1).name("Vector count").onFinishChange(rebuildModel);
vectors.add(params, "vectorLength", 2, 18, 0.5).name("Vector length").onFinishChange(rebuildModel);

function resize() {
  const rect = viewer.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

resize();
rebuildModel();
animate();
