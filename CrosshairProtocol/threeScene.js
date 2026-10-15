// 3D Desert Village and Sniper Rifle Environment powered by Three.js
class DesertSniperWorld {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.isMenuMode = !!options.isMenuMode;
    this.targets = [];
    this.onHitCallback = options.onHit || null;
    this.onMissCallback = options.onMiss || null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.rifleGroup = null;
    this.characterGroup = null;
    this.dustPoints = null;

    // Aiming state
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.isZoomed = false;
    this.currentZoom = 1.0;
    this.targetZoom = 1.0;
    this.baseFov = 60;
    this.swayTime = 0;
    this.isHoldingBreath = false;

    // Wind & Environment
    this.animFrameId = null;
    this.clock = new THREE.Clock();
    this.currentWeaponData = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    // Warm desert atmospheric fog
    this.scene.background = new THREE.Color(0xd4a373);
    this.scene.fog = new THREE.FogExp2(0xd4a373, 0.0035);

    // 2. Camera: Fixed sniper vantage point overlooking the village
    this.camera = new THREE.PerspectiveCamera(this.baseFov, width / height, 0.1, 1500);
    this.camera.position.set(0, 16, 115);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.setupLighting();

    // 5. Desert Environment: Sandstone buildings, roads, water tower, wooden doors, crates, barrels, palm trees, hills
    this.buildDesertEnvironment();

    // 6. 3D Sniper Rifle Model
    this.buildSniperRifle();

    // 7. Character 3D Model for Menu showcase
    if (this.isMenuMode) {
      this.buildCharacterShowcase();
    }

    // 8. Event listeners
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);

    // Start render loop
    this.animate();
  }

  setupLighting() {
    // Warm desert ambient light
    const ambientLight = new THREE.AmbientLight(0xffecd1, 0.7);
    this.scene.add(ambientLight);

    // Direct desert sunlight casting realistic shadows
    const sunLight = new THREE.DirectionalLight(0xfff1cf, 1.4);
    sunLight.position.set(120, 200, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 600;
    const d = 250;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    // Tactical blue rim-light for high-tech silhouette
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    rimLight.position.set(-60, 40, -40);
    this.scene.add(rimLight);
  }

  buildDesertEnvironment() {
    // 1. Vast Terrain (Desert sand ground with natural dunes)
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const dune = Math.sin(vx * 0.015) * Math.cos(vz * 0.015) * 6 + Math.sin(vx * 0.005) * 12;
      pos.setY(i, dune);
    }
    groundGeo.computeVertexNormals();

    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xdeb887,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, sandMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Dusty Village Roads & Alleys
    const roadMat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.95 });
    const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(24, 600).rotateX(-Math.PI / 2), roadMat);
    mainRoad.position.set(0, 0.2, -100);
    mainRoad.receiveShadow = true;
    this.scene.add(mainRoad);

    const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(350, 18).rotateX(-Math.PI / 2), roadMat);
    crossRoad.position.set(0, 0.25, -120);
    crossRoad.receiveShadow = true;
    this.scene.add(crossRoad);

    // 3. Distant Desert Mountains & Canyons
    this.buildMountains();

    // 4. Sandstone Adobe Buildings & Rooftops
    this.buildVillageBuildings();

    // 5. Environmental Details: Wooden Crates, Barrels, Doors, Sandbags, Water Tower, Market Tents
    this.buildVillageProps();

    // 6. Floating Desert Dust Particles
    this.buildDustParticles();
  }

  buildMountains() {
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.95 });
    const mPositions = [
      { x: -350, z: -450, scale: 90, height: 140 },
      { x: -180, z: -550, scale: 120, height: 180 },
      { x: 10, z: -580, scale: 140, height: 210 },
      { x: 220, z: -500, scale: 110, height: 160 },
      { x: 380, z: -430, scale: 95, height: 130 },
      { x: -450, z: -200, scale: 80, height: 110 },
      { x: 450, z: -200, scale: 85, height: 120 }
    ];

    mPositions.forEach(p => {
      const geo = new THREE.ConeGeometry(p.scale, p.height, 7);
      const mesh = new THREE.Mesh(geo, mountainMat);
      mesh.position.set(p.x, p.height / 2 - 10, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    });
  }

  buildVillageBuildings() {
    const adobeMat1 = new THREE.MeshStandardMaterial({ color: 0xe0c39e, roughness: 0.85 });
    const adobeMat2 = new THREE.MeshStandardMaterial({ color: 0xd6b286, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4a27, roughness: 0.7 });
    const darkInteriorMat = new THREE.MeshBasicMaterial({ color: 0x1f1914 });

    const buildingConfigs = [
      // Close Village Ring (Levels 1-4)
      { x: -35, z: -50, w: 22, d: 20, h: 16 },
      { x: 35, z: -55, w: 24, d: 22, h: 18 },
      { x: -75, z: -70, w: 20, d: 25, h: 14 },
      { x: 75, z: -65, w: 22, d: 24, h: 22 },
      { x: 0, z: -100, w: 28, d: 24, h: 15 },
      // Mid Village Cluster (Levels 5-10)
      { x: -50, z: -140, w: 26, d: 22, h: 20 },
      { x: 45, z: -150, w: 30, d: 26, h: 24 },
      { x: -110, z: -120, w: 24, d: 20, h: 16 },
      { x: 110, z: -130, w: 25, d: 22, h: 18 },
      // Distant Village Compounds & Citadel (Levels 11-20)
      { x: -60, z: -220, w: 32, d: 28, h: 26 },
      { x: 70, z: -240, w: 35, d: 30, h: 28 },
      { x: -140, z: -200, w: 22, d: 22, h: 16 },
      { x: 140, z: -210, w: 24, d: 20, h: 18 },
      { x: 0, z: -290, w: 44, d: 38, h: 32 }
    ];

    buildingConfigs.forEach((b, idx) => {
      const bGroup = new THREE.Group();
      const mat = idx % 2 === 0 ? adobeMat1 : adobeMat2;

      // Main adobe structure
      const box = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      box.position.y = b.h / 2;
      box.castShadow = true;
      box.receiveShadow = true;
      bGroup.add(box);

      // Rooftop sniper parapet / half-walls
      const wallH = 2.2;
      const wallThick = 0.8;
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(b.w, wallH, wallThick), mat);
      frontWall.position.set(0, b.h + wallH / 2, b.d / 2 - wallThick / 2);
      frontWall.castShadow = true;
      bGroup.add(frontWall);

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(b.w, wallH, wallThick), mat);
      backWall.position.set(0, b.h + wallH / 2, -b.d / 2 + wallThick / 2);
      backWall.castShadow = true;
      bGroup.add(backWall);

      // Wooden beams projecting from adobe walls
      for (let i = -b.w / 2 + 2; i <= b.w / 2 - 2; i += 4) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, b.d + 3), woodMat);
        beam.rotateX(Math.PI / 2);
        beam.position.set(i, b.h - 1.2, 0);
        beam.castShadow = true;
        bGroup.add(beam);
      }

      // Windows and wooden door frames
      const winGeo = new THREE.PlaneGeometry(2.5, 3.5);
      const win = new THREE.Mesh(winGeo, darkInteriorMat);
      win.position.set(0, b.h * 0.6, b.d / 2 + 0.05);
      bGroup.add(win);

      // Wooden front door
      const door = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 5.5), woodMat);
      door.position.set(0, 2.75, b.d / 2 + 0.05);
      bGroup.add(door);

      bGroup.position.set(b.x, 0, b.z);
      this.scene.add(bGroup);
    });
  }

  buildVillageProps() {
    const woodCrateMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const metalBarrelMat = new THREE.MeshStandardMaterial({ color: 0x2b3e50, metalness: 0.7, roughness: 0.4 });
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xb59570, roughness: 0.95 });

    // 1. Wooden Crates scattered in alleys and corners
    const crateCoords = [
      [-12, -42], [14, -40], [-25, -60], [28, -65],
      [-5, -95], [10, -98], [-40, -130], [35, -135]
    ];
    crateCoords.forEach(([cx, cz]) => {
      const crate1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), woodCrateMat);
      crate1.position.set(cx, 1.1, cz);
      crate1.castShadow = true;
      this.scene.add(crate1);

      const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), woodCrateMat);
      crate2.position.set(cx + 0.8, 2.9, cz + 0.2);
      crate2.rotation.y = 0.3;
      crate2.castShadow = true;
      this.scene.add(crate2);
    });

    // 2. Oil / Fuel Barrels
    const barrelCoords = [
      [-15, -45], [18, -42], [-20, -92], [22, -90],
      [-45, -135], [40, -140], [-8, -125]
    ];
    barrelCoords.forEach(([bx, bz]) => {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.8, 12), metalBarrelMat);
      barrel.position.set(bx, 1.4, bz);
      barrel.castShadow = true;
      this.scene.add(barrel);
    });

    // 3. Sandbag Barricades
    const sbConfigs = [
      { x: 0, z: -35, rot: 0 },
      { x: -25, z: -40, rot: 0.3 },
      { x: 28, z: -42, rot: -0.4 },
      { x: -10, z: -130, rot: 0.2 },
      { x: 12, z: -130, rot: -0.2 }
    ];
    sbConfigs.forEach(s => {
      for (let r = 0; r < 3; r++) {
        for (let c = -3; c <= 3; c++) {
          const bag = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.4), sandbagMat);
          bag.position.set(s.x + c * 2, 0.45 + r * 0.85, s.z);
          bag.rotation.y = s.rot;
          bag.castShadow = true;
          this.scene.add(bag);
        }
      }
    });

    // 4. Tall Village Water Tower
    this.buildWaterTower();

    // 5. Palm Trees
    this.buildPalmTrees();
  }

  buildWaterTower() {
    const towerGroup = new THREE.Group();
    const legsMat = new THREE.MeshStandardMaterial({ color: 0x5a5a60, metalness: 0.8, roughness: 0.3 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.4, roughness: 0.5 });

    const legGeo = new THREE.CylinderGeometry(0.5, 0.8, 38);
    [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legsMat);
      leg.position.set(lx, 19, lz);
      leg.castShadow = true;
      towerGroup.add(leg);
    });

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 12, 16), tankMat);
    tank.position.y = 44;
    tank.castShadow = true;
    towerGroup.add(tank);

    towerGroup.position.set(120, 0, -180);
    this.scene.add(towerGroup);
  }

  buildPalmTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x60452b, roughness: 0.9 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });

    const palmCoords = [
      [-45, -30], [55, -28], [-90, -90], [95, -80],
      [-30, -170], [60, -190], [-130, -150], [140, -170]
    ];

    palmCoords.forEach(([px, pz]) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 18, 8), trunkMat);
      trunk.position.y = 9;
      trunk.rotation.z = (Math.random() - 0.5) * 0.15;
      trunk.castShadow = true;
      tree.add(trunk);

      for (let i = 0; i < 7; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(2, 9, 3), frondMat);
        frond.position.set(0, 18, 0);
        frond.rotation.z = Math.PI / 2.8;
        frond.rotation.y = (i / 7) * Math.PI * 2;
        frond.castShadow = true;
        tree.add(frond);
      }

      tree.position.set(px, 0, pz);
      this.scene.add(tree);
    });
  }

  buildDustParticles() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 600;
      positions[i + 1] = Math.random() * 40 + 2;
      positions[i + 2] = (Math.random() - 0.5) * 600 - 100;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xdeb887,
      size: 1.5,
      transparent: true,
      opacity: 0.5
    });

    this.dustPoints = new THREE.Points(geometry, material);
    this.scene.add(this.dustPoints);
  }

  // 3D Sniper Rifle in First-Person View with unique designs for all 5 rifles
  buildSniperRifle(weaponData = null) {
    if (this.rifleGroup) {
      this.camera.remove(this.rifleGroup);
    }

    const weapon = weaponData || window.GAME_DATA.WEAPONS[0];
    this.currentWeaponData = weapon;

    this.rifleGroup = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.85, roughness: 0.25 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: weapon.color || 0x22c55e,
      emissive: weapon.color || 0x22c55e,
      emissiveIntensity: 0.45,
      roughness: 0.3
    });
    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.2 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.85
    });

    // 1. Rifle Receiver Chassis
    const chassisW = weapon.id === "w_crosshair_x" ? 0.26 : 0.2;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(chassisW, 0.32, 2.3), metalMat);
    this.rifleGroup.add(chassis);

    // 2. Precision Barrel customized by barrel length and type
    const barrelLen = weapon.barrelLength || 2.0;
    const barrelRadius = weapon.id === "w_phantom_x" ? 0.065 : 0.048;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius, barrelRadius + 0.01, barrelLen, 16).rotateX(Math.PI / 2), metalMat);
    barrel.position.set(0, 0.05, -barrelLen / 2 - 0.85);
    this.rifleGroup.add(barrel);

    // 3. Muzzle Device (Slender, Fluted, Heavy Brake, Suppressor, Hex Rail Coil)
    if (weapon.id === "w_crosshair_x") {
      for (let c = 0; c < 4; c++) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), accentMat);
        coil.position.set(0, 0.05, -1.0 - c * 0.4);
        this.rifleGroup.add(coil);
      }
    } else if (weapon.id === "w_phantom_x") {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.65, 16).rotateX(Math.PI / 2), metalMat);
      can.position.set(0, 0.05, -barrelLen - 1.0);
      this.rifleGroup.add(can);
    } else {
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.38), accentMat);
      muzzle.position.set(0, 0.05, -barrelLen - 0.95);
      this.rifleGroup.add(muzzle);
    }

    // 4. Optical Scope with Mounts
    const scopeR = weapon.id === "w_crosshair_x" ? 0.11 : 0.09;
    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(scopeR, scopeR, 0.95, 16).rotateX(Math.PI / 2), scopeMat);
    scopeBody.position.set(0, 0.3, -0.2);
    this.rifleGroup.add(scopeBody);

    const scopeLensFront = new THREE.Mesh(new THREE.CircleGeometry(scopeR * 0.9, 16), lensMat);
    scopeLensFront.position.set(0, 0.3, -0.68);
    scopeLensFront.rotateY(Math.PI);
    this.rifleGroup.add(scopeLensFront);

    // 5. Stock & Cheek Pad
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.95), metalMat);
    stock.position.set(0, -0.05, 1.25);
    this.rifleGroup.add(stock);

    const cheekPad = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.5), accentMat);
    cheekPad.position.set(0, 0.19, 1.15);
    this.rifleGroup.add(cheekPad);

    // 6. Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.32), metalMat);
    mag.position.set(0, -0.34, 0.1);
    mag.rotation.x = 0.2;
    this.rifleGroup.add(mag);

    this.rifleGroup.position.set(0.65, -0.55, -1.35);
    this.camera.add(this.rifleGroup);
    this.scene.add(this.camera);
  }

  // 3D Sniper character model on Menu screen with live outfit customization
  buildCharacterShowcase(outfitConfig = null) {
    if (this.characterGroup) {
      this.scene.remove(this.characterGroup);
    }

    const outfit = outfitConfig || {
      colorHex: "#d4a373",
      accentHex: "#38bdf8",
      headgear: "hg_none",
      facewear: "fw_none",
      jacket: "jk_vest",
      trousers: "tr_cargo",
      gloves: "gl_standard",
      boots: "bt_desert"
    };

    const colorHex = outfit.colorHex || outfit.camoColor || "#d4a373";
    const accentHex = outfit.accentHex || outfit.accentColor || "#38bdf8";

    this.characterGroup = new THREE.Group();

    // 1. MATERIALS
    // Realistic skin tone - FIXED, does NOT change with outfit camo palette!
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.65 });
    // Clothing suit material - changes with chosen color palette (green, blue, red, tan, black)
    const suitMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex), roughness: 0.75 });
    // Tactical gear materials
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
    const darkClothMat = new THREE.MeshStandardMaterial({ color: 0x181e29, roughness: 0.85 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentHex),
      emissive: new THREE.Color(accentHex),
      emissiveIntensity: 0.65
    });

    // 2. HEAD (Realistic human skin tone)
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 1.4), skinMat);
    head.position.y = 10.1;
    head.castShadow = true;
    this.characterGroup.add(head);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 12), skinMat);
    neck.position.y = 9.15;
    this.characterGroup.add(neck);

    // 3. TORSO & JACKET
    // Base shirt / jacket body in palette camo color
    const jacketType = outfit.jacket || "jk_vest";
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(2.35, 3.1, 1.35), suitMat);
    torsoMesh.position.y = 7.5;
    torsoMesh.castShadow = true;
    this.characterGroup.add(torsoMesh);

    // Jacket Variations
    if (jacketType === "jk_vest") {
      // Tactical Rig Plate Carrier over torso
      const vestPlate = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.5, 1.55), vestMat);
      vestPlate.position.set(0, 7.6, 0);
      this.characterGroup.add(vestPlate);
      // Ammo pouches
      for (let p = -1; p <= 1; p++) {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), darkClothMat);
        pouch.position.set(p * 0.65, 7.2, 0.9);
        this.characterGroup.add(pouch);
      }
    } else if (jacketType === "jk_camo") {
      // Full Combat Jacket with heavy collar and double pouches
      const collar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.6), suitMat);
      collar.position.set(0, 8.9, 0);
      this.characterGroup.add(collar);
      const shoulderPadL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.2), suitMat);
      shoulderPadL.position.set(-1.6, 8.6, 0);
      const shoulderPadR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.2), suitMat);
      shoulderPadR.position.set(1.6, 8.6, 0);
      this.characterGroup.add(shoulderPadL);
      this.characterGroup.add(shoulderPadR);
    } else if (jacketType === "jk_ghillie") {
      // Dune Ghillie Shroud with textured camo strips
      const ghillieColor = new THREE.Color(colorHex).multiplyScalar(0.9);
      const ghillieMat = new THREE.MeshStandardMaterial({ color: ghillieColor, roughness: 0.95 });
      const shroud = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.4, 1.7), ghillieMat);
      shroud.position.set(0, 7.6, 0);
      this.characterGroup.add(shroud);
      // Ghillie strands
      for (let s = 0; s < 8; s++) {
        const strand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.15), ghillieMat);
        strand.position.set((Math.random() - 0.5) * 2.4, 7.0 + (Math.random() - 0.5) * 2, 0.9);
        strand.rotation.z = (Math.random() - 0.5) * 0.6;
        this.characterGroup.add(strand);
      }
    } else if (jacketType === "jk_armored") {
      // Heavy Ceradyne Titanium Plate Armor
      const armorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.7, 1.6), armorMat);
      chestPlate.position.set(0, 7.6, 0);
      this.characterGroup.add(chestPlate);
      // Glowing tech core on chest
      const techLight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.2), accentMat);
      techLight.position.set(0, 7.9, 0.9);
      this.characterGroup.add(techLight);
    }

    // 4. ARMS & GLOVES
    const gloveType = outfit.gloves || "gl_standard";
    let gloveMat = darkClothMat;
    if (gloveType === "gl_knuckle") {
      gloveMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.6, roughness: 0.4 });
    } else if (gloveType === "gl_thermal") {
      gloveMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    }

    [-1, 1].forEach(side => {
      // Sleeve (in palette camo color)
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.75), suitMat);
      sleeve.position.set(side * 1.55, 7.9, 0);
      this.characterGroup.add(sleeve);

      // Forearm (skin or covered)
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.65), gloveType === "gl_thermal" ? gloveMat : skinMat);
      forearm.position.set(side * 1.55, 6.4, 0);
      this.characterGroup.add(forearm);

      // Glove / Hand
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.7), gloveMat);
      hand.position.set(side * 1.55, 5.5, 0);
      this.characterGroup.add(hand);

      if (gloveType === "gl_knuckle") {
        // Knuckle guard plates
        const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.25), accentMat);
        knuckle.position.set(side * 1.55, 5.5, 0.4);
        this.characterGroup.add(knuckle);
      }
    });

    // 5. TROUSERS (Legs in camo palette)
    const trouserType = outfit.trousers || "tr_cargo";
    const legGeo = new THREE.BoxGeometry(0.95, 3.4, 1.05);
    const legL = new THREE.Mesh(legGeo, suitMat);
    legL.position.set(-0.75, 4.4, 0);
    this.characterGroup.add(legL);
    const legR = new THREE.Mesh(legGeo, suitMat);
    legR.position.set(0.75, 4.4, 0);
    this.characterGroup.add(legR);

    // Trouser Variations
    if (trouserType === "tr_cargo") {
      // Cargo side pockets
      const pocketL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.6), darkClothMat);
      pocketL.position.set(-1.3, 4.3, 0);
      const pocketR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.6), darkClothMat);
      pocketR.position.set(1.3, 4.3, 0);
      this.characterGroup.add(pocketL);
      this.characterGroup.add(pocketR);
    } else if (trouserType === "tr_hex") {
      // Hex combat knee guards with accent trim
      const kneeL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.3), accentMat);
      kneeL.position.set(-0.75, 3.8, 0.6);
      const kneeR = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.3), accentMat);
      kneeR.position.set(0.75, 3.8, 0.6);
      this.characterGroup.add(kneeL);
      this.characterGroup.add(kneeR);
    } else if (trouserType === "tr_armored") {
      // Heavy ballistic shin plates
      const armorPlateMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 });
      const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.3), armorPlateMat);
      plateL.position.set(-0.75, 3.9, 0.6);
      const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.3), armorPlateMat);
      plateR.position.set(0.75, 3.9, 0.6);
      this.characterGroup.add(plateL);
      this.characterGroup.add(plateR);
    }

    // 6. BOOTS
    const bootType = outfit.boots || "bt_desert";
    let bootColor = 0xb48a5c; // Desert suede
    let bootHeight = 1.4;
    if (bootType === "bt_combat") {
      bootColor = 0x111827; // Steel-toe black combat
      bootHeight = 1.6;
    } else if (bootType === "bt_silent") {
      bootColor = 0x334155; // Stealth dark grey creepers
      bootHeight = 1.3;
    }
    const bootMat = new THREE.MeshStandardMaterial({ color: bootColor, roughness: 0.7 });

    const bootL = new THREE.Mesh(new THREE.BoxGeometry(1.05, bootHeight, 1.55), bootMat);
    bootL.position.set(-0.75, bootHeight / 2, 0.2);
    bootL.castShadow = true;
    this.characterGroup.add(bootL);

    const bootR = new THREE.Mesh(new THREE.BoxGeometry(1.05, bootHeight, 1.55), bootMat);
    bootR.position.set(0.75, bootHeight / 2, 0.2);
    bootR.castShadow = true;
    this.characterGroup.add(bootR);

    // Steel toe cap for combat boots
    if (bootType === "bt_combat") {
      const toeCapMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
      const toeL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.4), toeCapMat);
      toeL.position.set(-0.75, 0.25, 0.9);
      const toeR = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.4), toeCapMat);
      toeR.position.set(0.75, 0.25, 0.9);
      this.characterGroup.add(toeL);
      this.characterGroup.add(toeR);
    }

    // 7. FACEWEAR
    const faceType = outfit.facewear || "fw_none";
    if (faceType === "fw_none") {
      // Tactical Glasses
      const glasses = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.3), accentMat);
      glasses.position.set(0, 10.2, 0.75);
      this.characterGroup.add(glasses);
    } else if (faceType === "fw_shemagh") {
      // Desert Shemagh Scarf wrapped around neck and lower face (in camo palette)
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.4, 10, 20).rotateX(Math.PI / 2), suitMat);
      scarf.position.set(0, 9.4, 0);
      this.characterGroup.add(scarf);
    } else if (faceType === "fw_balaclava") {
      // Ghost Balaclava covering face except eye slit
      const mask = new THREE.Mesh(new THREE.BoxGeometry(1.44, 1.1, 1.44), darkClothMat);
      mask.position.set(0, 9.75, 0);
      this.characterGroup.add(mask);
      // Eye opening
      const eyeSlot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.25), skinMat);
      eyeSlot.position.set(0, 10.15, 0.72);
      this.characterGroup.add(eyeSlot);
    } else if (faceType === "fw_respirator") {
      // Hazard Gas Filter respirator mask
      const respMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });
      const filterMask = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), respMat);
      filterMask.position.set(0, 9.7, 0.65);
      this.characterGroup.add(filterMask);
      // Dual cylindrical gas canister filters
      const canGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12).rotateZ(Math.PI / 2);
      const canL = new THREE.Mesh(canGeo, new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
      canL.position.set(-0.65, 9.6, 0.75);
      const canR = new THREE.Mesh(canGeo, new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
      canR.position.set(0.65, 9.6, 0.75);
      this.characterGroup.add(canL);
      this.characterGroup.add(canR);
    } else if (faceType === "fw_cyber") {
      // Crosshair HUD Visor with glowing digital telemetry
      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.4), accentMat);
      visor.position.set(0, 10.15, 0.78);
      this.characterGroup.add(visor);
    }

    // 8. HEADGEAR
    const headType = outfit.headgear || "hg_none";
    if (headType === "hg_none") {
      // Tactical Comms Headset over ears
      const earMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 16).rotateX(Math.PI / 2), earMat);
      band.position.set(0, 10.95, 0);
      this.characterGroup.add(band);
      const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12).rotateZ(Math.PI / 2), earMat);
      earL.position.set(-0.8, 10.1, 0);
      const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12).rotateZ(Math.PI / 2), earMat);
      earR.position.set(0.8, 10.1, 0);
      this.characterGroup.add(earL);
      this.characterGroup.add(earR);
      // Mic boom
      const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6).rotateZ(Math.PI / 3), earMat);
      mic.position.set(0.85, 9.8, 0.35);
      this.characterGroup.add(mic);
    } else if (headType === "hg_cap") {
      // Recon Patrol Cap with visor (in camo palette)
      const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.5, 16), suitMat);
      capCrown.position.set(0, 10.9, 0);
      const capVisor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.8), suitMat);
      capVisor.position.set(0, 10.75, 0.85);
      this.characterGroup.add(capCrown);
      this.characterGroup.add(capVisor);
    } else if (headType === "hg_boonie") {
      // Desert Boonie Hat with wide brim (in camo palette)
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.55, 16), suitMat);
      crown.position.set(0, 10.9, 0);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.1, 24), suitMat);
      brim.position.set(0, 10.7, 0);
      this.characterGroup.add(crown);
      this.characterGroup.add(brim);
    } else if (headType === "hg_helmet") {
      // Ballistic Operator Kevlar Helmet with NVG mount
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(1.08, 16, 16), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 }));
      helmet.position.set(0, 10.6, 0);
      this.characterGroup.add(helmet);
      // NVG Mount Plate
      const nvgPlate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.15), accentMat);
      nvgPlate.position.set(0, 10.8, 1.05);
      this.characterGroup.add(nvgPlate);
    } else if (headType === "hg_beret") {
      // Elite Protocol Beret
      const beret = new THREE.Mesh(new THREE.SphereGeometry(0.88, 14, 14), accentMat);
      beret.position.set(0.25, 10.85, 0);
      beret.scale.set(1.25, 0.42, 1.25);
      this.characterGroup.add(beret);
      // Gold insignia badge
      const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9 }));
      badge.position.set(0.4, 10.8, 0.7);
      this.characterGroup.add(badge);
    }

    // Pedestal
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.5, 0.8, 32), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    pedestal.position.y = -0.4;
    this.characterGroup.add(pedestal);

    this.characterGroup.position.set(15, 6, 85);
    this.characterGroup.rotation.y = -0.65;
    this.scene.add(this.characterGroup);
  }

  // Spawns interactive 3D tactical targets across the desert village with full health and level progression
  spawnTargetsForLevel(levelConfig) {
    // Clear existing targets
    this.targets.forEach(t => this.scene.remove(t.mesh));
    this.targets = [];

    const count = levelConfig.targetCount || 3;
    const isLevel1to4 = levelConfig.level <= 4;
    const isLevel5 = levelConfig.level === 5;
    const isStarMission = levelConfig.targetShape === 'STAR';

    // Predetermined vantage points across the village
    const spawnPoints = [
      { x: -35, y: 16.5, z: -50, label: "West Roof 1" },
      { x: 35, y: 18.5, z: -55, label: "East Roof 1" },
      { x: 0, y: 1.5, z: -38, label: "Barricade Road" },
      { x: -75, y: 14.5, z: -70, label: "Adobe Alley" },
      { x: 75, y: 22.5, z: -65, label: "East Sentry Tower" },
      { x: 120, y: 38.0, z: -180, label: "Water Reservoir Silo" },
      { x: -50, y: 20.5, z: -140, label: "Mid Adobe Compound" },
      { x: 45, y: 24.5, z: -150, label: "Crossroads Lookout" },
      { x: 0, y: 1.5, z: -100, label: "Bazaar Square" },
      { x: -110, y: 16.5, z: -120, label: "Perimeter Depot" },
      { x: 0, y: 32.5, z: -290, label: "Warlord Citadel" },
      { x: -60, y: 26.5, z: -220, label: "High Minaret" },
      { x: 70, y: 28.5, z: -240, label: "Eastern Ridge" },
      { x: -140, y: 16.5, z: -200, label: "Aqueduct Outpost" },
      { x: 140, y: 18.5, z: -210, label: "Distant Outpost" }
    ];

    for (let i = 0; i < count; i++) {
      const sp = spawnPoints[i % spawnPoints.length];
      
      // Determine if this target should be a moving Star Target
      // Level 5 introduces star targets exclusively. Levels 6-20 mix them or specialize.
      let isStar = isStarMission || (levelConfig.level >= 5 && (i % 2 === 1 || isLevel5));
      if (isLevel1to4) {
        isStar = false; // Levels 1-4 are strictly stationary humanoid drills
      }

      const targetMesh = isStar ? this.createStarTargetMesh(levelConfig.level >= 15) : this.createHostileTargetMesh(i === 0 && levelConfig.level >= 10);
      
      // Scale targets so they are clear and well-proportioned through the sniper scope
      const distanceFactor = Math.abs(sp.z - 115) / 100; // distance from camera z=115
      const baseScale = isStar ? 1.5 : 1.7;
      const scaleMult = baseScale + distanceFactor * 0.35;
      targetMesh.scale.set(scaleMult, scaleMult, scaleMult);

      const jitterZ = (Math.random() - 0.5) * 8;
      targetMesh.position.set(sp.x + (i >= spawnPoints.length ? ((i - spawnPoints.length + 1) * 12) : 0), sp.y + (isStar ? 4 : 0), sp.z + jitterZ);

      // Create target data object with actual health and health bar
      const targetObj = {
        id: `target_${i}`,
        mesh: targetMesh,
        isStar,
        headMesh: isStar ? targetMesh.getObjectByName("star_core") : targetMesh.getObjectByName("target_head"),
        bodyMesh: isStar ? targetMesh.getObjectByName("star_hull") : targetMesh.getObjectByName("target_body"),
        initialX: targetMesh.position.x,
        initialY: targetMesh.position.y,
        initialZ: targetMesh.position.z,
        isStatic: isLevel1to4,
        patrolRange: isStar ? (18 + levelConfig.level * 1.5) : (12 + levelConfig.level * 0.8),
        speed: (levelConfig.speed || 1.2) * (i % 2 === 0 ? 1 : -1),
        currentHp: levelConfig.targetHealth || 100,
        maxHp: levelConfig.targetHealth || 100,
        isEliminated: false,
        distanceMeters: Math.round(Math.abs(targetMesh.position.z - this.camera.position.z)),
        movementPattern: isLevel1to4 ? "NONE" : (isStar ? (levelConfig.movementType || "HORIZONTAL_PATROL") : "HORIZONTAL_PATROL"),
        timeSeed: Math.random() * 10
      };

      // Add a tactical 3D floating health indicator above target
      this.attachHealthBarToTarget(targetObj);

      this.scene.add(targetMesh);
      this.targets.push(targetObj);
    }
  }

  // Create moving Star-Shaped Target (Introduced in Level 5)
  createStarTargetMesh(isElite = false) {
    const group = new THREE.Group();

    // Golden / Amber neon star material
    const starColor = isElite ? 0xf59e0b : 0xfacc15;
    const starMat = new THREE.MeshStandardMaterial({
      color: starColor,
      emissive: starColor,
      emissiveIntensity: 0.8,
      metalness: 0.7,
      roughness: 0.2
    });

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Red center bullseye
      emissive: 0xef4444,
      emissiveIntensity: 1.0,
      roughness: 0.1
    });

    // Construct 5-pointed star geometry
    const starShape = new THREE.Shape();
    const points = 5;
    const outerRadius = 2.4;
    const innerRadius = 1.1;

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();

    const extrudeSettings = { depth: 0.5, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.1, bevelThickness: 0.1 };
    const starGeo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
    starGeo.center();

    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.name = "star_hull";
    starMesh.castShadow = true;
    group.add(starMesh);

    // Glowing bullseye core in center (high-value critical hit target)
    const coreGeo = new THREE.SphereGeometry(0.65, 16, 16);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.name = "star_core";
    coreMesh.position.z = 0.25;
    group.add(coreMesh);

    // Tactical warning halo
    const haloGeo = new THREE.RingGeometry(2.6, 2.75, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    group.add(halo);

    return group;
  }

  // Create Humanoid Hostile Target Mesh
  createHostileTargetMesh(isBoss = false) {
    const group = new THREE.Group();

    const bodyColor = isBoss ? 0xb91c1c : 0xef4444;
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfee2e2, roughness: 0.4 });
    const gearMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });

    // Torso / Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.9), bodyMat);
    body.name = "target_body";
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);

    // Headshot target
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), headMat);
    head.name = "target_head";
    head.position.y = 2.75;
    head.castShadow = true;
    group.add(head);

    // Hostile red glint
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    glint.position.set(0, 2.7, 0.6);
    group.add(glint);

    // Weapon
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 1.8), gearMat);
    gun.position.set(0.6, 1.4, 0.4);
    group.add(gun);

    return group;
  }

  // Attach a visible health bar indicator above the target
  attachHealthBarToTarget(targetObj) {
    const barGroup = new THREE.Group();

    // Background track (Dark red/black)
    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide })
    );
    barGroup.add(bgMesh);

    // Green/Red Health Fill
    const fillMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
    );
    fillMesh.position.z = 0.02;
    fillMesh.name = "health_fill";
    barGroup.add(fillMesh);

    barGroup.position.y = targetObj.isStar ? 3.2 : 3.8;
    targetObj.healthBarMesh = barGroup;
    targetObj.healthFillMesh = fillMesh;
    targetObj.mesh.add(barGroup);
  }

  // Update target health bar visual fill
  updateTargetHealthDisplay(targetObj) {
    if (!targetObj.healthFillMesh) return;
    const hpRatio = Math.max(0, targetObj.currentHp / targetObj.maxHp);
    targetObj.healthFillMesh.scale.x = hpRatio;
    targetObj.healthFillMesh.position.x = -(1 - hpRatio) * 1.15;
    
    // Color changes to red as health drops
    if (hpRatio < 0.35) {
      targetObj.healthFillMesh.material.color.setHex(0xef4444);
    } else if (hpRatio < 0.65) {
      targetObj.healthFillMesh.material.color.setHex(0xf59e0b);
    } else {
      targetObj.healthFillMesh.material.color.setHex(0x22c55e);
    }
  }

  // Handle Raycasting shot against 3D targets with accurate crosshair registration and damage
  fireShot(windOffset = { x: 0, y: 0 }, bulletDamage = 100) {
    // 1. Recoil animation on 3D rifle
    if (this.rifleGroup) {
      this.rifleGroup.position.z += 0.35;
      this.rifleGroup.rotation.x -= 0.18;
      setTimeout(() => {
        if (this.rifleGroup) {
          this.rifleGroup.position.z = -1.35;
          this.rifleGroup.rotation.x = 0;
        }
      }, 150);
    }

    // 2. Muzzle Flash Particle Burst
    this.createMuzzleFlash();

    // 3. Compute raycast from center of screen (crosshair always fires dead center)
    const raycaster = new THREE.Raycaster();
    // Very small wind offset — don't make it feel like the gun is wildly inaccurate
    const screenX = windOffset.x * 0.005;
    const screenY = windOffset.y * 0.005;
    raycaster.setFromCamera(new THREE.Vector2(screenX, screenY), this.camera);

    // Collect ALL meshes from active (alive) target groups for recursive intersection
    const activeTargetGroups = [];
    this.targets.filter(t => !t.isEliminated).forEach(t => {
      activeTargetGroups.push(t.mesh);
    });

    // Raycast against entire target groups recursively (catches all child meshes)
    const intersects = raycaster.intersectObjects(activeTargetGroups, true);

    // Helper: given a hit Three.js object, find which of our target objects it belongs to
    const findTargetForHitObj = (hitObj) => {
      // Walk up the parent chain to find which target group this mesh belongs to
      let obj = hitObj;
      while (obj) {
        const match = this.targets.find(t => t.mesh === obj);
        if (match) return match;
        obj = obj.parent;
      }
      // Fallback: check named meshes
      return this.targets.find(t => t.headMesh === hitObj || t.bodyMesh === hitObj);
    };

    if (intersects.length > 0) {
      // Filter to only hits on target meshes (skip health bar planes etc)
      for (let k = 0; k < intersects.length; k++) {
        const hitObj = intersects[k].object;
        const hitPoint = intersects[k].point;
        
        // Skip health bar meshes
        if (hitObj.name === "health_fill") continue;
        if (hitObj.parent && hitObj.parent === this.targets.find(t => t.healthBarMesh === hitObj.parent)?.healthBarMesh) continue;

        const isCritical = hitObj.name === "target_head" || hitObj.name === "star_core";

        const targetObj = findTargetForHitObj(hitObj);
        if (targetObj && !targetObj.isEliminated) {
          // Apply damage: Critical headshots/bullseyes do 2.5x damage!
          const damageDealt = isCritical ? Math.round(bulletDamage * 2.5) : bulletDamage;
          targetObj.currentHp -= damageDealt;
          this.updateTargetHealthDisplay(targetObj);

          // Flash target white/red briefly
          this.flashTargetDamage(targetObj);

          const isEliminated = targetObj.currentHp <= 0;
          if (isEliminated) {
            targetObj.isEliminated = true;
            this.animateTargetDeath(targetObj);
          }

          // Particle sparks
          this.createHitImpact(hitPoint, true, isCritical);

          if (this.onHitCallback) {
            this.onHitCallback({
              target: targetObj,
              isCritical,
              damageDealt,
              isEliminated,
              remainingHp: Math.max(0, targetObj.currentHp),
              distance: targetObj.distanceMeters,
              hitPoint
            });
          }
          return { hit: true, isCritical, isEliminated, target: targetObj };
        }
      }
    }

    // === PROXIMITY FALLBACK ===
    // If the precise raycast missed, check if the ray passes close to any target's world center.
    // This gives a generous hitbox so the game feels fair — targets are far away and small on screen.
    const rayOrigin = raycaster.ray.origin;
    const rayDir = raycaster.ray.direction;
    let closestTarget = null;
    let closestDist = Infinity;
    let closestPoint = null;

    this.targets.filter(t => !t.isEliminated).forEach(t => {
      // Get target center in world coordinates
      const targetWorldPos = new THREE.Vector3();
      t.mesh.getWorldPosition(targetWorldPos);

      // Project target center onto ray to find closest approach
      const toTarget = new THREE.Vector3().subVectors(targetWorldPos, rayOrigin);
      const projLength = toTarget.dot(rayDir);
      if (projLength < 0) return; // target is behind camera

      const closestOnRay = new THREE.Vector3().copy(rayOrigin).addScaledVector(rayDir, projLength);
      const perpDist = closestOnRay.distanceTo(targetWorldPos);

      // Tight proximity tolerance: only catches shots that graze the target silhouette
      // Prevents distant near-misses from erroneously counting as hits
      const baseRadius = t.isStar ? 1.6 : 1.4;
      const scaledRadius = baseRadius * (t.mesh.scale.x || 1);

      if (perpDist < scaledRadius && perpDist < closestDist) {
        closestDist = perpDist;
        closestTarget = t;
        closestPoint = closestOnRay;
      }
    });

    if (closestTarget) {
      // Determine if it's a critical hit based on proximity to head/core
      let isCritical = false;
      if (closestTarget.headMesh) {
        const headWorldPos = new THREE.Vector3();
        closestTarget.headMesh.getWorldPosition(headWorldPos);
        const headDist = closestPoint.distanceTo(headWorldPos);
        isCritical = headDist < 0.9 * (closestTarget.mesh.scale.x || 1);
      }

      const damageDealt = isCritical ? Math.round(bulletDamage * 2.5) : bulletDamage;
      closestTarget.currentHp -= damageDealt;
      this.updateTargetHealthDisplay(closestTarget);
      this.flashTargetDamage(closestTarget);

      const isEliminated = closestTarget.currentHp <= 0;
      if (isEliminated) {
        closestTarget.isEliminated = true;
        this.animateTargetDeath(closestTarget);
      }

      this.createHitImpact(closestPoint, true, isCritical);

      if (this.onHitCallback) {
        this.onHitCallback({
          target: closestTarget,
          isCritical,
          damageDealt,
          isEliminated,
          remainingHp: Math.max(0, closestTarget.currentHp),
          distance: closestTarget.distanceMeters,
          hitPoint: closestPoint
        });
      }
      return { hit: true, isCritical, isEliminated, target: closestTarget };
    }

    // Truly missed — bullet impacts environment
    const envIntersects = raycaster.intersectObjects(this.scene.children, true);
    if (envIntersects.length > 0) {
      const missPoint = envIntersects[0].point;
      this.createHitImpact(missPoint, false, false);
    }

    if (this.onMissCallback) {
      this.onMissCallback();
    }
    return { hit: false };
  }

  flashTargetDamage(targetObj) {
    if (!targetObj.mesh) return;
    targetObj.mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        const origColor = child.material.emissive.getHex();
        const origInt = child.material.emissiveIntensity || 0;
        child.material.emissive.setHex(0xffffff);
        child.material.emissiveIntensity = 2.0;
        setTimeout(() => {
          if (child.material && child.material.emissive) {
            child.material.emissive.setHex(origColor);
            child.material.emissiveIntensity = origInt;
          }
        }, 120);
      }
    });
  }

  createMuzzleFlash() {
    const flashLight = new THREE.PointLight(0xffedd5, 8, 30);
    flashLight.position.set(0.65, -0.4, -2.5);
    this.camera.add(flashLight);
    setTimeout(() => {
      this.camera.remove(flashLight);
    }, 60);
  }

  createHitImpact(position, isFlesh = false, isCritical = false) {
    const particleCount = isCritical ? 24 : 14;
    const pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);
    const vel = [];

    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = position.x;
      pos[i * 3 + 1] = position.y;
      pos[i * 3 + 2] = position.z;
      vel.push({
        x: (Math.random() - 0.5) * 3,
        y: Math.random() * 4 + 1,
        z: (Math.random() - 0.5) * 3
      });
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pColor = isCritical ? 0x22c55e : (isFlesh ? 0xef4444 : 0xdeb887);
    const pMat = new THREE.PointsMaterial({ color: pColor, size: 0.8 });
    const pSystem = new THREE.Points(pGeo, pMat);
    this.scene.add(pSystem);

    let life = 0;
    const interval = setInterval(() => {
      life += 1;
      const positions = pSystem.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += vel[i].x * 0.1;
        positions[i * 3 + 1] += vel[i].y * 0.1;
        positions[i * 3 + 2] += vel[i].z * 0.1;
        vel[i].y -= 0.15;
      }
      pSystem.geometry.attributes.position.needsUpdate = true;
      if (life > 20) {
        clearInterval(interval);
        this.scene.remove(pSystem);
      }
    }, 20);
  }

  animateTargetDeath(targetObj) {
    let fallProgress = 0;
    const fallInterval = setInterval(() => {
      fallProgress += 0.08;
      targetObj.mesh.rotation.x += 0.12;
      targetObj.mesh.position.y -= 0.18;
      if (fallProgress >= 1.5) {
        clearInterval(fallInterval);
        this.scene.remove(targetObj.mesh);
      }
    }, 20);
  }

  setZoom(isScoped, factor = 3.5) {
    this.isZoomed = isScoped;
    this.targetZoom = isScoped ? factor : 1.0;
    // Hide/show the rifle model when scoping for a cleaner ADS view
    if (this.rifleGroup) {
      this.rifleGroup.visible = !isScoped;
    }
  }

  setAimAngles(yaw, pitch) {
    this.targetYaw = yaw;
    this.targetPitch = pitch;
  }

  updateRifleAppearance(weaponData) {
    this.buildSniperRifle(weaponData);
  }

  updateCharacterAppearance(charData) {
    this.buildCharacterShowcase(charData);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animFrameId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    this.swayTime += delta;

    // Smooth aim interpolation
    this.yaw += (this.targetYaw - this.yaw) * 0.18;
    this.pitch += (this.targetPitch - this.pitch) * 0.18;

    // Breathing sway calculation
    const swayAmp = this.isHoldingBreath ? 0.0006 : (this.isZoomed ? 0.0025 : 0.005);
    const swayX = Math.sin(this.swayTime * 1.5) * swayAmp;
    const swayY = Math.cos(this.swayTime * 3.0) * (swayAmp * 0.6);

    this.camera.rotation.y = this.yaw + swayX;
    this.camera.rotation.x = this.pitch + swayY;

    // Smooth FOV zoom
    const targetFov = this.isZoomed ? (this.baseFov / this.targetZoom) : this.baseFov;
    this.camera.fov += (targetFov - this.camera.fov) * 0.18;
    this.camera.updateProjectionMatrix();

    // Menu mode rotation
    if (this.isMenuMode) {
      if (this.characterGroup) {
        this.characterGroup.rotation.y += 0.004;
      }
      this.camera.position.x = Math.sin(this.swayTime * 0.15) * 8;
      this.camera.position.y = 16 + Math.cos(this.swayTime * 0.1) * 2;
    }

    // Move targets according to their level-specific trajectory patterns
    this.targets.forEach(t => {
      if (t.isEliminated || t.isStatic) return;

      const tTime = this.swayTime + t.timeSeed;

      // 1. Star targets spin gracefully on their own axis
      if (t.isStar) {
        t.mesh.rotation.z += 0.03;
      }

      // Always billboard health bars towards the sniper camera
      if (t.healthBarMesh) {
        t.healthBarMesh.lookAt(this.camera.position);
      }

      // 2. Trajectory patterns
      if (t.movementPattern === "HORIZONTAL_PATROL") {
        t.mesh.position.x += t.speed * delta * 12;
        if (Math.abs(t.mesh.position.x - t.initialX) > t.patrolRange) {
          t.speed = -t.speed;
        }
      } else if (t.movementPattern === "OSCILLATING_VERTICAL") {
        t.mesh.position.y = t.initialY + Math.sin(tTime * t.speed * 2.2) * 6;
      } else if (t.movementPattern === "ZIG_ZAG") {
        t.mesh.position.x = t.initialX + Math.sin(tTime * t.speed) * t.patrolRange;
        t.mesh.position.y = t.initialY + Math.abs(Math.sin(tTime * t.speed * 2.5)) * 4;
      } else if (t.movementPattern === "CIRCULAR_ORBIT") {
        t.mesh.position.x = t.initialX + Math.cos(tTime * t.speed * 1.5) * (t.patrolRange * 0.6);
        t.mesh.position.y = t.initialY + Math.sin(tTime * t.speed * 1.5) * 4;
      } else if (t.movementPattern === "MULTI_PATTERN" || t.movementPattern === "SUPREME_PATTERNS") {
        t.mesh.position.x = t.initialX + Math.sin(tTime * t.speed) * t.patrolRange;
        t.mesh.position.y = t.initialY + Math.cos(tTime * t.speed * 1.8) * 5;
      }
    });

    // Dust particles drift
    if (this.dustPoints) {
      const pos = this.dustPoints.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += 0.15;
        if (pos[i] > 300) pos[i] = -300;
      }
      this.dustPoints.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    if (this.renderer && this.renderer.domElement && this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

window.DesertSniperWorld = DesertSniperWorld;
