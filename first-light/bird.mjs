// Local axes: beak +X, crown +Y, open wings ±Z. Shared resources are per THREE instance.
const resources = new WeakMap();
const palettes = {
  hero: { body: 0x087f82, head: 0x08a6a0, back: 0x075561, breast: 0xd98a46, cream: 0xffdda0, wing: 0x168d94, covert: 0x39b4aa, tail: 0x126578, rim: 0xe5b36d },
  gold: { body: 0xd3a247, head: 0xf0c96e, back: 0x95703a, breast: 0xf6d28d, cream: 0xffeed0, wing: 0xd5a65b, covert: 0xf0cf7e, tail: 0x9d773f, rim: 0x795630 },
  white: { body: 0xe2e7df, head: 0xfff9e6, back: 0xb9d0cf, breast: 0xf2e4d0, cream: 0xfff4df, wing: 0xcbdedc, covert: 0xf5f3e5, tail: 0x8caeae, rim: 0xc39665 },
};

function shared(THREE) {
  if (resources.has(THREE)) return resources.get(THREE);
  const sphere = new THREE.SphereGeometry(1, 28, 20);
  // A cambered, asymmetric vane with a rounded shoulder and drawn-out tip.
  const positions = [], colors = [], indices = [];
  const rows = 16, columns = 8;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const width = (0.035 + 0.965 * Math.pow(Math.sin(Math.PI * t), 0.67)) * (1 - 0.22 * t);
    for (let column = 0; column <= columns; column++) {
      const u = column / columns * 2 - 1;
      positions.push(-0.19 * t * t + u * width * (u < 0 ? 0.56 : 0.44), 0.075 * (1 - u * u) * Math.sin(Math.PI * t) - 0.045 * t * t, t);
      const edge = Math.pow(Math.abs(u), 8) * 0.3;
      const tip = Math.max(0, (t - 0.79) / 0.21);
      const shade = (0.72 + edge + 0.15 * (1 - Math.abs(u))) * (1 - 0.7 * tip);
      colors.push(shade, shade, shade);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const feather = new THREE.BufferGeometry();
  feather.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  feather.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  feather.setIndex(indices);
  feather.computeVertexNormals();
  const cache = { sphere, feather, materials: new Map(), ring: new THREE.TorusGeometry(1, 0.105, 8, 36) };
  resources.set(THREE, cache);
  return cache;
}

export function createBird(THREE, { variant = 'hero', detail = true } = {}) {
  const cache = shared(THREE), palette = palettes[variant] || palettes.hero;
  const material = (color, feather = false, gloss = false) => {
    const key = `${color}/${feather}/${gloss}`;
    if (!cache.materials.has(key)) cache.materials.set(key, new THREE.MeshStandardMaterial({
      color, roughness: gloss ? 0.12 : feather ? 0.48 : 0.4, metalness: gloss ? 0.05 : 0.12,
      vertexColors: feather, side: feather ? THREE.DoubleSide : THREE.FrontSide,
    }));
    return cache.materials.get(key);
  };
  const bird = new THREE.Group();
  bird.name = `first-light-${variant}`;
  const body = new THREE.Group();
  bird.add(body);
  const mesh = (parent, geometry, color, position, scale, feather = false, gloss = false) => {
    const node = new THREE.Mesh(geometry, material(color, feather, gloss));
    node.position.set(...position);
    node.scale.set(...scale);
    node.castShadow = true;
    node.receiveShadow = true;
    parent.add(node);
    return node;
  };
  const oval = (parent, color, position, scale, gloss = false) => mesh(parent, cache.sphere, color, position, scale, false, gloss);
  const vane = (parent, color, position, width, length, angle = 0) => {
    const node = mesh(parent, cache.feather, color, position, [width, 1, length], true);
    node.rotation.y = angle;
    return node;
  };
  // Pear-shaped thorax: the warm ventral mass meets a narrower, sloped rump.
  const torso = oval(body, palette.body, [-0.06, 0, 0], [0.58, 0.32, 0.285]);
  torso.rotation.z = 0.13;
  const breast = oval(body, palette.breast, [0.19, -0.095, 0], [0.365, 0.283, 0.263]);
  breast.rotation.z = 0.27;
  oval(body, palette.cream, [0.30, -0.10, 0], [0.25, 0.225, 0.24]);
  oval(body, palette.back, [-0.29, 0.15, 0], [0.38, 0.17, 0.25]);
  const head = new THREE.Group();
  head.position.set(0.43, 0.235, 0);
  body.add(head);
  const skull = oval(head, palette.head, [0.085, 0.085, 0], [0.29, 0.263, 0.235]);
  skull.rotation.z = -0.12;
  oval(head, palette.cream, [0.185, -0.085, 0], [0.175, 0.135, 0.18]);
  const eyes = [];
  for (const side of [-1, 1]) {
    oval(head, palette.back, [0.175, 0.105, side * 0.199], [0.12, 0.077, 0.024]);
    const eye = new THREE.Group();
    eye.position.set(0.205, 0.119, side * 0.226);
    eye.rotation.y = side * 0.15;
    head.add(eye);
    oval(eye, 0x110e0b, [0, 0, 0], [0.067, 0.07, 0.032], true);
    const lid = mesh(eye, cache.ring, palette.rim, [0, 0, side * 0.011], [0.07, 0.074, 0.07]);
    if (detail) {
      oval(eye, 0xffffff, [0.019, 0.024, side * 0.029], [0.017, 0.017, 0.008], true);
      oval(eye, 0xb9f0ef, [-0.022, -0.018, side * 0.03], [0.006, 0.007, 0.005], true);
    }
    eyes.push(eye);
    lid.name = 'eyelid';
  }
  // Elliptical beak rings taper to a fine, slightly downturned point, not a cone.
  const beakPositions = [], beakIndices = [];
  const sections = [[0.25, 0.057, 0.072, 0.028], [0.35, 0.04, 0.053, 0.025], [0.52, 0.006, 0.006, -0.015]];
  for (let ring = 0; ring < sections.length; ring++) {
    const [x, ry, rz, y] = sections[ring];
    for (let j = 0; j < 12; j++) {
      const angle = j / 12 * Math.PI * 2;
      beakPositions.push(x, y + Math.sin(angle) * ry, Math.cos(angle) * rz);
      if (ring < sections.length - 1) {
        const a = ring * 12 + j, b = ring * 12 + (j + 1) % 12;
        beakIndices.push(a, a + 12, b, b, a + 12, b + 12);
      }
    }
  }
  const beakGeometry = new THREE.BufferGeometry();
  beakGeometry.setAttribute('position', new THREE.Float32BufferAttribute(beakPositions, 3));
  beakGeometry.setIndex(beakIndices);
  beakGeometry.computeVertexNormals();
  mesh(head, beakGeometry, 0x172d30, [0, 0, 0], [1, 1, 1]);
  if (detail) {
    for (const side of [-1, 1]) {
      oval(head, 0x020d10, [0.326, 0.052, side * 0.05], [0.019, 0.008, 0.004]);
      oval(head, 0x607777, [0.369, 0.026, side * 0.039], [0.077, 0.003, 0.003]);
    }
    for (let i = 0; i < 5; i++) {
      const crest = vane(head, i % 2 ? palette.head : palette.covert, [0.12, 0.317 - Math.abs(i - 2) * 0.009, (i - 2) * 0.042], 0.095, 0.31, -Math.PI / 2);
      crest.rotation.z = -0.11;
    }
  }
  const tail = new THREE.Group();
  tail.position.set(-0.49, 0.02, 0);
  body.add(tail);
  const tailCount = detail ? 9 : 5;
  for (let i = 0; i < tailCount; i++) {
    const spread = i / (tailCount - 1) * 2 - 1;
    vane(tail, i % 2 ? palette.wing : palette.tail, [0, -Math.abs(spread) * 0.012, spread * 0.047], detail ? 0.155 : 0.22, 0.77 - 0.13 * Math.abs(spread), -Math.PI / 2 + spread * 0.22);
  }
  const wings = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.035, 0.135, side * 0.215);
    shoulder.scale.z = side;
    body.add(shoulder);
    oval(shoulder, palette.back, [-0.075, -0.005, 0.29], [0.26, 0.082, 0.41]);
    const secondaries = detail ? 9 : 5;
    for (let i = 0; i < secondaries; i++) {
      const p = i / (secondaries - 1);
      vane(shoulder, palette.wing, [0.015 - p * 0.13, -0.019 - i * 0.002, 0.08 + p * 0.55], detail ? 0.19 : 0.27, 0.51 - p * 0.08, -1.06 + p * 0.26);
    }
    const wrist = new THREE.Group();
    wrist.position.set(-0.115, 0.002, 0.60);
    shoulder.add(wrist);
    const primaries = detail ? 10 : 6;
    for (let i = 0; i < primaries; i++) {
      const p = i / (primaries - 1);
      vane(wrist, i % 3 === 0 ? palette.tail : palette.wing, [-p * 0.11, -0.012 - i * 0.0025, p * 0.22], detail ? 0.18 : 0.25, 0.64 + 0.1 * Math.sin(p * Math.PI), -0.12 - p * 0.98);
    }
    // Coverts shingle over flight-feather roots, including across the wrist hinge.
    const coverts = detail ? 8 : 4;
    for (let row = 0; row < (detail ? 2 : 1); row++) {
      for (let i = 0; i < coverts; i++) {
        const p = i / (coverts - 1);
        vane(shoulder, row ? palette.wing : palette.covert, [0.09 - row * 0.095 - p * 0.10, 0.048 + row * 0.008 - p * 0.016, 0.02 + p * 0.65], detail ? 0.14 : 0.22, 0.24 + row * 0.055, -0.62);
      }
    }
    for (let i = 0; i < (detail ? 5 : 3); i++) {
      vane(wrist, palette.covert, [0.025 - i * 0.025, 0.047 - i * 0.004, i * 0.075], 0.14, 0.24, -0.35 - i * 0.12);
    }
    wings.push({ shoulder, wrist, side });
  }
  const feet = [];
  for (const side of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(-0.03, -0.225, side * 0.15);
    body.add(foot);
    oval(foot, palette.breast, [0, -0.018, 0], [0.067, 0.116, 0.065]);
    oval(foot, 0x655144, [-0.012, -0.16, 0], [0.022, 0.115, 0.021]);
    if (detail) {
      for (let toe = -1; toe <= 2; toe++) {
        const rear = toe === 2;
        const endX = rear ? -0.14 : 0.13;
        const endZ = rear ? 0 : toe * 0.055;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.015, -0.25, 0), new THREE.Vector3(endX * 0.48, -0.257, endZ * 0.6),
          new THREE.Vector3(endX, -0.275, endZ), new THREE.Vector3(endX * 1.07, -0.307, endZ),
        ]);
        mesh(foot, new THREE.TubeGeometry(curve, 8, 0.010, 5, false), 0x665043, [0, 0, 0], [1, 1, 1]);
        oval(foot, 0x182626, [endX * 1.07, -0.305, endZ], [0.011, 0.021, 0.009]);
      }
    }
    feet.push(foot);
  }
  bird.userData.rig = { body, head, eyes, wings, feet, tail };
  poseBird(bird, 0);
  return bird;
}

export function poseBird(bird, time, { flight = 1, flapSpeed = 3.2, glide = 0, look = 0 } = {}) {
  const { body, head, eyes, wings, feet, tail } = bird.userData.rig;
  flight = Math.max(0, Math.min(1, flight));
  glide = Math.max(0, Math.min(1, glide));
  const phase = time * flapSpeed * Math.PI * 2;
  const stroke = Math.sin(phase), flex = Math.sin(phase - 0.65);
  body.position.y = Math.sin(time * 2.1) * 0.006 * (1 - flight);
  head.rotation.y = look * 0.38 + Math.sin(time * 0.91) * 0.035;
  head.rotation.z = Math.sin(time * 1.31) * 0.026 - flight * 0.055;
  const blinkPhase = ((time + 0.83) % 4.7 + 4.7) % 4.7;
  const blink = Math.max(0, 1 - Math.abs(blinkPhase - 0.13) / 0.105);
  for (const eye of eyes) eye.scale.y = 1 - 0.965 * blink;
  for (const { shoulder, wrist, side } of wings) {
    shoulder.rotation.x = side * (flight * ((1 - glide) * (-0.68 * stroke + 0.08) + glide * (-0.11 + 0.035 * Math.sin(time * 1.8))) + (1 - flight) * 0.15);
    shoulder.rotation.y = -side * (1 - flight) * 1.31;
    shoulder.rotation.z = -0.045 * flight * (1 - glide) * flex;
    wrist.rotation.x = flight * ((1 - glide) * (-0.25 * flex) + glide * 0.055 * Math.sin(time * 1.8 - 0.8));
    wrist.rotation.y = -(1 - flight) * 0.59 + flight * (1 - glide) * 0.12 * (1 - stroke);
  }
  for (const foot of feet) {
    foot.rotation.z = -flight * 1.12;
    foot.position.y = -0.225 + flight * 0.09;
    foot.scale.setScalar(1 - flight * 0.28);
  }
  tail.rotation.z = 0.07 + flight * 0.025 * Math.sin(phase - 0.7);
  tail.rotation.y = Math.sin(time * 1.2) * 0.025;
}
