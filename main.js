import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'https://unpkg.com/lil-gui@0.19.1/dist/lil-gui.esm.js';

const container = document.getElementById('viewer');
const loading = document.getElementById('loading');

const params = {
  topRadius: 20000,
  bottomRadius: 38000,
  height: 4800,
  profilePower: 1.5,
  curvatureRadius: 111000,
  verticalScale: 1.0,
  modelOpacity: 0.62,
  showBody: true,
  showDensityLayers: true,
  showHabitableDisk: true,
  showHellCavity: true,
  showGravityVectors: true,
  showWireframe: true,
  showCutPlane: false,
  rotate: true,
  densityA: 3,
  densityB: 3,
  vectorLength: 1500,
  resetCamera,
  rebuildModel,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.Fog(0x070a12, 42000, 125000);

const camera = new THREE.PerspectiveCamera(45, 1, 1, 250000);
camera.position.set(52000, 21000, 52000);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -2100, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxDistance = 150000;
controls.minDistance = 10000;

const hemi = new THREE.HemisphereLight(0xffffff, 0x202030, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(30000, 50000, 40000);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x66e2d5, 0.8);
rim.position.set(-60000, 20000, -30000);
scene.add(rim);

const root = new THREE.Group();
scene.add(root);

let bodyMesh, diskMesh, cavityMesh, wireMesh, vectorGroup, layerGroup, cutPlane;

const KM_TO_SCENE = 1;
function yDepth(z) { return -z * params.verticalScale * KM_TO_SCENE; }
function radiusAtDepth(z) {
  return params.topRadius + (params.bottomRadius - params.topRadius) * Math.pow(z / params.height, params.profilePower);
}
function surfaceBulge(r) {
  const Rc = params.curvatureRadius;
  return Rc - Math.sqrt(Math.max(0, Rc * Rc - r * r));
}
function densityFactor(r, z) {
  const radial = 1 + params.densityA * Math.pow(r / params.bottomRadius, 2.5);
  const depth = 1 + params.densityB * Math.pow(z / params.height, 2);
  return radial * depth;
}

function makeBodyGeometry(radialSegments = 160, depthSegments = 52) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  for (let iz = 0; iz <= depthSegments; iz++) {
    const z = params.height * iz / depthSegments;
    const r = radiusAtDepth(z);
    const y = yDepth(z);
    const density = densityFactor(r, z);
    const t = Math.min(1, (density - 1) / 18);
    const color = new THREE.Color().setHSL(0.12 - 0.12 * t, 0.92, 0.56 - 0.32 * t);

    for (let ia = 0; ia <= radialSegments; ia++) {
      const a = 2 * Math.PI * ia / radialSegments;
      positions.push(r * Math.cos(a), y, r * Math.sin(a));
      normals.push(Math.cos(a), 0.35, Math.sin(a));
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = radialSegments + 1;
  for (let iz = 0; iz < depthSegments; iz++) {
    for (let ia = 0; ia < radialSegments; ia++) {
      const a = iz * row + ia;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // top cap
  const topCenter = positions.length / 3;
  positions.push(0, yDepth(0), 0);
  normals.push(0, 1, 0);
  colors.push(0.12, 0.55, 0.18);
  for (let ia = 0; ia < radialSegments; ia++) indices.push(topCenter, ia + 1, ia);

  // bottom cap
  const bottomCenter = positions.length / 3;
  positions.push(0, yDepth(params.height), 0);
  normals.push(0, -1, 0);
  colors.push(0.38, 0.02, 0.01);
  const bottomStart = depthSegments * row;
  for (let ia = 0; ia < radialSegments; ia++) indices.push(bottomCenter, bottomStart + ia, bottomStart + ia + 1);

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeHabitableDisk() {
  const segments = 160;
  const rings = 42;
  const positions = [];
  const colors = [];
  const indices = [];
  for (let ir = 0; ir <= rings; ir++) {
    const r = params.topRadius * ir / rings;
    const y = surfaceBulge(r) * 0.16;
    for (let ia = 0; ia <= segments; ia++) {
      const a = 2 * Math.PI * ia / segments;
      positions.push(r * Math.cos(a), y + 80, r * Math.sin(a));
      const green = 0.35 + 0.18 * Math.sin(a * 3 + ir * 0.4);
      const blue = 0.18 + 0.12 * Math.cos(a * 5);
      colors.push(0.08, Math.max(0.2, green), Math.max(0.12, blue));
    }
  }
  const row = segments + 1;
  for (let ir = 0; ir < rings; ir++) {
    for (let ia = 0; ia < segments; ia++) {
      const a = ir * row + ia;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Obyvatelný disk';
  return mesh;
}

function makeCavity() {
  const geo = new THREE.SphereGeometry(1, 96, 32, 0, Math.PI * 2, 0, Math.PI * 0.55);
  geo.scale(10500, 1350 * params.verticalScale, 6200);
  geo.translate(0, yDepth(params.height * 0.86), 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.65, metalness: 0.05, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

function makeDensityLayers() {
  const group = new THREE.Group();
  const layerData = [
    { z: 650, color: 0xffd06b, opacity: 0.18 },
    { z: 1450, color: 0xffa13a, opacity: 0.18 },
    { z: 2400, color: 0xff6b1a, opacity: 0.20 },
    { z: 3450, color: 0xdc1c13, opacity: 0.22 },
    { z: 4480, color: 0x850000, opacity: 0.26 },
  ];
  for (const layer of layerData) {
    const r = radiusAtDepth(layer.z);
    const geo = new THREE.CylinderGeometry(r, r, 35 * params.verticalScale, 160, 1, true);
    geo.translate(0, yDepth(layer.z), 0);
    const mat = new THREE.MeshStandardMaterial({ color: layer.color, transparent: true, opacity: layer.opacity, side: THREE.DoubleSide, roughness: 0.7 });
    group.add(new THREE.Mesh(geo, mat));
  }
  return group;
}

function makeGravityVectors() {
  const group = new THREE.Group();
  const positions = [0, 5000, 10000, 15000, 19000];
  for (const r of positions) {
    const count = r === 0 ? 1 : Math.max(8, Math.round(2 * Math.PI * r / 7500));
    for (let i = 0; i < count; i++) {
      const a = count === 1 ? 0 : 2 * Math.PI * i / count;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      const y = surfaceBulge(r) * 0.16 + 1400;
      const dir = new THREE.Vector3(0, -1, 0);
      const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(x, y, z), params.vectorLength, 0x66e2d5, 340, 170);
      group.add(arrow);
    }
  }
  return group;
}

function makeCutPlane() {
  const geo = new THREE.BoxGeometry(params.bottomRadius * 2.25, params.height * params.verticalScale * 1.25, 75);
  const mat = new THREE.MeshBasicMaterial({ color: 0x9fb6ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = yDepth(params.height / 2);
  return mesh;
}

function createFlatEarthSurfaceMap(radius, y) {
  const group = new THREE.Group();
  group.name = "Azimuthal Flat Earth Surface";

  // horní obyvatelný disk
  const diskGeometry = new THREE.CircleGeometry(radius, 256);
  const diskMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d6f8f,
    roughness: 0.8,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  });

  const disk = new THREE.Mesh(diskGeometry, diskMaterial);
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = y + 8;
  group.add(disk);

  // azimutální poledníky
  const meridianMaterial = new THREE.LineBasicMaterial({
    color: 0xd8e8ff,
    transparent: true,
    opacity: 0.35
  });

  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const points = [
      new THREE.Vector3(0, y + 14, 0),
      new THREE.Vector3(Math.cos(a) * radius * 0.96, y + 14, Math.sin(a) * radius * 0.96)
    ];

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      meridianMaterial
    );

    group.add(line);
  }

  // soustředné kružnice azimutální projekce
  for (let i = 1; i <= 6; i++) {
    const r = radius * (i / 7);
    const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2, false, 0);
    const points2d = curve.getPoints(256);
    const points3d = points2d.map(p => new THREE.Vector3(p.x, y + 16, p.y));

    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points3d),
      meridianMaterial
    );

    group.add(ring);
  }

  // ledová zeď / Antarktida po obvodu
  const iceWallGeometry = new THREE.CylinderGeometry(
    radius * 1.015,
    radius * 1.015,
    3000,
    256,
    1,
    true
  );

  const iceWallMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8f8ff,
    roughness: 0.55,
    metalness: 0.02,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });

  const iceWall = new THREE.Mesh(iceWallGeometry, iceWallMaterial);
  iceWall.position.y = y + 1500;
  group.add(iceWall);

  // horní hrana ledové zdi
  const iceCapGeometry = new THREE.TorusGeometry(radius * 1.015, 300, 16, 256);
  const iceCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6
  });

  const iceCap = new THREE.Mesh(iceCapGeometry, iceCapMaterial);
  iceCap.rotation.x = Math.PI / 2;
  iceCap.position.y = y + 3000;
  group.add(iceCap);

  // severní pól ve středu
  const poleGeometry = new THREE.CylinderGeometry(45, 45, 700, 32);
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3333,
    roughness: 0.4
  });

  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.y = y + 350;
  group.add(pole);

  const poleSphere = new THREE.Mesh(
    new THREE.SphereGeometry(130, 32, 16),
    poleMaterial
  );
  poleSphere.position.y = y + 730;
  group.add(poleSphere);

  return group;
}

function rebuildModel() {
  root.clear();

  bodyMesh = new THREE.Mesh(
    makeBodyGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: params.modelOpacity, roughness: 0.7, metalness: 0.03, side: THREE.DoubleSide })
  );
  bodyMesh.visible = params.showBody;
  root.add(bodyMesh);

  wireMesh = new THREE.LineSegments(
    new THREE.WireframeGeometry(bodyMesh.geometry),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10 })
  );
  wireMesh.visible = params.showWireframe;
  root.add(wireMesh);

  diskMesh = makeHabitableDisk();
  diskMesh.visible = params.showHabitableDisk;
  root.add(diskMesh);

  const flatEarthMap = createFlatEarthSurfaceMap(
  params.topRadius,
  surfaceBulge(0) + 20
);

root.add(flatEarthMap);

  layerGroup = makeDensityLayers();
  layerGroup.visible = params.showDensityLayers;
  root.add(layerGroup);

  cavityMesh = makeCavity();
  cavityMesh.visible = params.showHellCavity;
  root.add(cavityMesh);

  vectorGroup = makeGravityVectors();
  vectorGroup.visible = params.showGravityVectors;
  root.add(vectorGroup);

  cutPlane = makeCutPlane();
  cutPlane.visible = params.showCutPlane;
  root.add(cutPlane);
}

function updateVisibility() {
  if (bodyMesh) bodyMesh.visible = params.showBody;
  if (wireMesh) wireMesh.visible = params.showWireframe;
  if (diskMesh) diskMesh.visible = params.showHabitableDisk;
  if (layerGroup) layerGroup.visible = params.showDensityLayers;
  if (cavityMesh) cavityMesh.visible = params.showHellCavity;
  if (vectorGroup) vectorGroup.visible = params.showGravityVectors;
  if (cutPlane) cutPlane.visible = params.showCutPlane;
  if (bodyMesh) bodyMesh.material.opacity = params.modelOpacity;
}

function resetCamera() {
  camera.position.set(52000, 21000, 52000);
  controls.target.set(0, -2100, 0);
  controls.update();
}

const gui = new GUI({ title: 'Ovládání modelu' });
gui.add(params, 'topRadius', 10000, 26000, 500).name('Horní radius').onFinishChange(rebuildModel);
gui.add(params, 'bottomRadius', 24000, 52000, 500).name('Spodní radius').onFinishChange(rebuildModel);
gui.add(params, 'height', 1500, 9000, 100).name('Výška těla').onFinishChange(rebuildModel);
gui.add(params, 'profilePower', 0.6, 3.0, 0.05).name('Profil n').onFinishChange(rebuildModel);
gui.add(params, 'curvatureRadius', 60000, 180000, 1000).name('Zakřivení povrchu').onFinishChange(rebuildModel);
gui.add(params, 'verticalScale', 0.25, 2.5, 0.05).name('Vertikální měřítko').onFinishChange(rebuildModel);
gui.add(params, 'modelOpacity', 0.15, 1, 0.01).name('Průhlednost těla').onChange(updateVisibility);

const folder = gui.addFolder('Zobrazení');
folder.add(params, 'showBody').name('Tělo').onChange(updateVisibility);
folder.add(params, 'showDensityLayers').name('Hustotní vrstvy').onChange(updateVisibility);
folder.add(params, 'showHabitableDisk').name('Obyvatelný disk').onChange(updateVisibility);
folder.add(params, 'showHellCavity').name('Dutina Ад').onChange(updateVisibility);
folder.add(params, 'showGravityVectors').name('Gravitační vektory').onChange(updateVisibility);
folder.add(params, 'showWireframe').name('Síť').onChange(updateVisibility);
folder.add(params, 'showCutPlane').name('Řezová rovina').onChange(updateVisibility);
folder.add(params, 'rotate').name('Automatická rotace');

const density = gui.addFolder('Hustota');
density.add(params, 'densityA', 0, 8, 0.1).name('Růst k okraji').onFinishChange(rebuildModel);
density.add(params, 'densityB', 0, 8, 0.1).name('Růst do hloubky').onFinishChange(rebuildModel);
density.add(params, 'vectorLength', 600, 3500, 50).name('Délka vektorů').onFinishChange(rebuildModel);

gui.add(params, 'resetCamera').name('Reset kamery');
gui.add(params, 'rebuildModel').name('Přepočítat model');

function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);

function animate() {
  requestAnimationFrame(animate);
  if (params.rotate) root.rotation.y += 0.0016;
  controls.update();
  renderer.render(scene, camera);
}

document.getElementById('screenshotBtn')?.addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = 'trismegistic-conical-gravity-field.png';
  a.click();
});

try {
  rebuildModel();
  resize();
  animate();
  if (loading) loading.style.display = 'none';
} catch (err) {
  console.error(err);
  if (loading) loading.textContent = 'Chyba při načítání 3D modelu – otevři konzoli F12.';
}
