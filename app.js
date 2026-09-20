(function () {
  "use strict";

  const data = window.GALLERY_DATA || { categories: [], apps: [] };
  const categories = [...data.categories].sort((a, b) => a.order - b.order);
  const byCategory = new Map(categories.map(category => [
    category.id,
    data.apps
      .filter(app => app.category === category.id)
      .sort((a, b) => a.order - b.order)
  ]));

  const viewport = document.getElementById("gallery-viewport");
  const world = document.getElementById("gallery-world");
  const nav = document.getElementById("category-nav");
  const status = document.getElementById("webgl-status");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobileViewport = () => innerWidth < 680;

  const state = {
    categoryIndex: 0,
    rowByCategory: new Map(categories.map(category => [category.id, 0])),
    cardWidth: 360,
    cardHeight: 202.5,
    columnGap: 72,
    rowGap: 38,
    x: 0,
    y: 0,
    drag: null,
    suppressClickUntil: 0,
    wheelLockedUntil: 0
  };

  function cardPose(categoryIndex, rowIndex) {
    return {
      // Base values are deliberately noticeable. updateCardPoses() then fans
      // the columns around the currently selected category.
      ry: categoryIndex === 0 ? 14 : (categoryIndex === categories.length - 1 ? -14 : (rowIndex % 2 ? 9 : -9)),
      rx: 2.4 + ((rowIndex % 3) - 1) * .75,
      rz: ((categoryIndex + rowIndex) % 2 ? 1 : -1) * .48,
      floatAmp: 8.5 + ((categoryIndex * 3 + rowIndex) % 4) * 1.15,
      duration: 5.2 + ((categoryIndex + rowIndex) % 4) * .48,
      delay: -((categoryIndex * .83 + rowIndex * .61) % 4.7)
    };
  }

  function createCard(app, categoryIndex, rowIndex) {
    const stage = document.createElement("div");
    stage.className = "card-stage";
    const pose = cardPose(categoryIndex, rowIndex);
    stage.style.setProperty("--float-amp", `${pose.floatAmp}px`);
    stage.style.setProperty("--float-duration", `${pose.duration}s`);
    stage.style.setProperty("--float-delay", `${pose.delay}s`);

    const card = document.createElement("article");
    card.className = "app-card";
    card.dataset.appId = app.id;
    card.dataset.categoryIndex = String(categoryIndex);
    card.dataset.rowIndex = String(rowIndex);
    card.style.setProperty("--ry", `${pose.ry}deg`);
    card.style.setProperty("--rx", `${pose.rx}deg`);
    card.style.setProperty("--rz", `${pose.rz}deg`);
    card.setAttribute("aria-label", `${app.title}。${app.description}`);
    card.innerHTML = `
      <span class="card-icon" aria-hidden="true"></span>
      <h2></h2>
      <p class="card-description"></p>
      <a class="open-application" target="_blank" rel="noopener noreferrer">OPEN APPLICATION&nbsp; ↗</a>
    `;
    card.querySelector(".card-icon").textContent = app.icon;
    card.querySelector("h2").textContent = app.title;
    card.querySelector(".card-description").textContent = app.description;
    const link = card.querySelector(".open-application");
    link.href = app.url;
    link.setAttribute("aria-label", `${app.title}を新しいタブで開く`);

    card.addEventListener("click", event => {
      if (event.target.closest(".open-application")) return;
      if (performance.now() < state.suppressClickUntil) return;
      select(categoryIndex, rowIndex, true);
      flash(card);
    });

    // Interactive controls must never be swallowed by the drag gesture layer.
    link.addEventListener("pointerdown", event => event.stopPropagation());
    link.addEventListener("click", event => {
      if (performance.now() < state.suppressClickUntil) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      flash(card);
    });

    stage.append(card);
    return stage;
  }

  function buildGallery() {
    nav.style.setProperty("--category-count", categories.length);
    categories.forEach((category, categoryIndex) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "category-tab";
      tab.textContent = category.label;
      tab.dataset.categoryIndex = String(categoryIndex);
      tab.setAttribute("aria-label", `${category.label}カテゴリへ移動`);
      tab.addEventListener("click", () => select(categoryIndex, rememberedRow(categoryIndex)));
      nav.append(tab);

      const column = document.createElement("section");
      column.className = "app-column";
      column.dataset.categoryId = category.id;
      column.setAttribute("aria-label", category.label);
      const apps = byCategory.get(category.id) || [];
      apps.forEach((app, rowIndex) => column.append(createCard(app, categoryIndex, rowIndex)));
      world.append(column);
    });
  }

  function rememberedRow(categoryIndex) {
    const category = categories[categoryIndex];
    const apps = byCategory.get(category.id) || [];
    const remembered = state.rowByCategory.get(category.id) || 0;
    return Math.max(0, Math.min(remembered, Math.max(0, apps.length - 1)));
  }

  function selectedRow() {
    return rememberedRow(state.categoryIndex);
  }

  function select(categoryIndex, rowIndex, announce) {
    if (!categories.length) return;
    state.categoryIndex = Math.max(0, Math.min(categoryIndex, categories.length - 1));
    const category = categories[state.categoryIndex];
    const apps = byCategory.get(category.id) || [];
    const safeRow = Math.max(0, Math.min(rowIndex, Math.max(0, apps.length - 1)));
    state.rowByCategory.set(category.id, safeRow);
    updateSelection(announce);
    snapToSelection();
  }

  function updateCardPoses() {
    document.querySelectorAll(".app-card").forEach(card => {
      const categoryIndex = Number(card.dataset.categoryIndex);
      const rowIndex = Number(card.dataset.rowIndex);
      const relative = categoryIndex - state.categoryIndex;
      let ry;
      if (relative < 0) ry = 17.5;
      else if (relative > 0) ry = -17.5;
      else ry = rowIndex % 2 === 0 ? -10.5 : 10.5;
      const rx = 2.8 + ((rowIndex % 3) - 1) * .8;
      const rz = ((categoryIndex + rowIndex) % 2 ? 1 : -1) * .55;
      card.style.setProperty("--ry", `${ry}deg`);
      card.style.setProperty("--rx", `${rx}deg`);
      card.style.setProperty("--rz", `${rz}deg`);
    });
  }

  function updateSelection(announce) {
    const row = selectedRow();
    updateCardPoses();
    document.querySelectorAll(".app-card").forEach(card => {
      const active = Number(card.dataset.categoryIndex) === state.categoryIndex &&
        Number(card.dataset.rowIndex) === row;
      card.classList.toggle("is-selected", active);
      card.setAttribute("aria-current", active ? "true" : "false");
    });
    world.querySelectorAll(".app-column").forEach((column, index) => {
      column.classList.toggle("is-selected", index === state.categoryIndex);
    });
    nav.querySelectorAll(".category-tab").forEach((tab, index) => {
      tab.setAttribute("aria-current", index === state.categoryIndex ? "true" : "false");
    });
    updateMobileNav();

    if (announce) {
      const active = activeCard();
      if (active) active.setAttribute("aria-live", "polite");
      setTimeout(() => active?.removeAttribute("aria-live"), 500);
    }
  }

  function updateMobileNav() {
    if (innerWidth >= 680) {
      nav.style.setProperty("--nav-shift", "0px");
      return;
    }
    const tabWidth = innerWidth * .62;
    const gap = 10;
    const shift = innerWidth / 2 - tabWidth / 2 - state.categoryIndex * (tabWidth + gap);
    nav.style.setProperty("--nav-shift", `${shift}px`);
  }

  function activeCard() {
    return world.querySelector(
      `.app-card[data-category-index="${state.categoryIndex}"][data-row-index="${selectedRow()}"]`
    );
  }

  function measure() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const landscapePhone = innerHeight <= 560 && innerWidth > innerHeight;

    if (vw >= 1080) {
      state.cardWidth = Math.min(360, Math.max(300, (vw - 176) / 3));
      state.columnGap = Math.max(34, (vw - state.cardWidth * 3) / 2);
    } else if (vw >= 680) {
      state.cardWidth = Math.min(350, landscapePhone ? vh * 1.48 : vw * .42);
      state.columnGap = Math.max(34, vw * .075);
    } else {
      state.cardWidth = Math.min(360, vw * .84);
      state.columnGap = Math.max(48, vw * .20);
    }

    state.cardHeight = state.cardWidth * 9 / 16;
    state.rowGap = landscapePhone ? 24 : (vw < 680 ? 32 : 38);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--card-width", `${state.cardWidth}px`);
    rootStyle.setProperty("--card-height", `${state.cardHeight}px`);
    rootStyle.setProperty("--column-gap", `${state.columnGap}px`);
    rootStyle.setProperty("--row-gap", `${state.rowGap}px`);

    if (state.cardHeight > vh * .82) {
      state.cardHeight = vh * .82;
      state.cardWidth = state.cardHeight * 16 / 9;
      rootStyle.setProperty("--card-width", `${state.cardWidth}px`);
      rootStyle.setProperty("--card-height", `${state.cardHeight}px`);
    }
    updateMobileNav();
  }

  function targetPosition() {
    const columnStride = state.cardWidth + state.columnGap;
    const rowStride = state.cardHeight + state.rowGap;
    return {
      x: viewport.clientWidth / 2 - state.cardWidth / 2 - state.categoryIndex * columnStride,
      y: viewport.clientHeight / 2 - state.cardHeight / 2 - selectedRow() * rowStride
    };
  }

  function applyTransform(x, y) {
    state.x = x;
    state.y = y;
    world.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function snapToSelection() {
    const target = targetPosition();
    applyTransform(target.x, target.y);
  }

  function flash(card) {
    card.classList.remove("is-flashing");
    void card.offsetWidth;
    card.classList.add("is-flashing");
    setTimeout(() => card.classList.remove("is-flashing"), 3000);
  }

  function stepVertical(direction) {
    const row = selectedRow();
    select(state.categoryIndex, row + direction, true);
  }

  function stepHorizontal(direction) {
    const nextCategory = Math.max(0, Math.min(state.categoryIndex + direction, categories.length - 1));
    select(nextCategory, rememberedRow(nextCategory), true);
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest?.("a, button, input, select, textarea")) return;
    state.drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      moved: false,
      captured: false
    };
  }

  function onPointerMove(event) {
    if (!state.drag || state.drag.id !== event.pointerId) return;
    state.drag.dx = event.clientX - state.drag.startX;
    state.drag.dy = event.clientY - state.drag.startY;
    const distance = Math.hypot(state.drag.dx, state.drag.dy);
    if (distance > 8 && !state.drag.moved) {
      state.drag.moved = true;
      world.classList.add("is-dragging");
      viewport.classList.add("is-dragging");
      try {
        viewport.setPointerCapture?.(event.pointerId);
        state.drag.captured = true;
      } catch (_) { /* pointer may already have ended */ }
    }
    if (!state.drag.moved) return;
    const dampX = state.drag.dx * .72;
    const dampY = state.drag.dy * .72;
    const target = targetPosition();
    applyTransform(target.x + dampX, target.y + dampY);
  }

  function finishPointer(event, cancelled) {
    if (!state.drag || state.drag.id !== event.pointerId) return;
    const drag = state.drag;
    state.drag = null;
    world.classList.remove("is-dragging");
    viewport.classList.remove("is-dragging");
    if (drag.captured && viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);

    if (drag.moved) state.suppressClickUntil = performance.now() + 420;
    if (cancelled || !drag.moved) {
      snapToSelection();
      return;
    }

    const absX = Math.abs(drag.dx);
    const absY = Math.abs(drag.dy);
    const threshold = Math.min(54, Math.max(30, Math.min(innerWidth, innerHeight) * .07));
    if (absX > absY * 1.15 && absX > threshold) {
      // Drag right reveals the category on the left; drag left reveals the right.
      stepHorizontal(drag.dx > 0 ? -1 : 1);
    } else if (absY > absX * 1.15 && absY > threshold) {
      // Drag up reveals panels lower in the same column.
      stepVertical(drag.dy < 0 ? 1 : -1);
    } else {
      snapToSelection();
    }
  }

  function onWheel(event) {
    event.preventDefault();
    const now = performance.now();
    if (now < state.wheelLockedUntil || Math.abs(event.deltaY) < 2) return;
    state.wheelLockedUntil = now + (reducedMotion ? 100 : 310);
    // UAT: invert the original mapping. Wheel in the user's upward direction reveals lower panels.
    stepVertical(event.deltaY > 0 ? 1 : -1);
  }

  function onKeyDown(event) {
    const keepLinkFocus = Boolean(event.target.closest?.(".open-application"));

    if (event.key === "Enter" && innerWidth >= 680 && !keepLinkFocus && !event.target.closest?.("button, input, select, textarea")) {
      const card = activeCard();
      const link = card?.querySelector(".open-application");
      if (link) {
        event.preventDefault();
        flash(card);
        link.click();
      }
      return;
    }

    const actions = {
      ArrowUp: () => stepVertical(-1),
      ArrowDown: () => stepVertical(1),
      ArrowLeft: () => stepHorizontal(-1),
      ArrowRight: () => stepHorizontal(1)
    };
    if (!actions[event.key]) return;
    event.preventDefault();
    actions[event.key]();
    if (keepLinkFocus) activeCard()?.querySelector(".open-application")?.focus();
  }

  function initThreeScene() {
    const canvas = document.getElementById("night-scene");
    if (!window.THREE) throw new Error("Three.js is unavailable");
    const T = window.THREE;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobileViewport() ? 1.0 : 1.6));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new T.Scene();
    scene.fog = new T.FogExp2(0x08111a, .0015);

    const camera = new T.PerspectiveCamera(46, innerWidth / innerHeight, .1, 680);
    camera.position.set(0, 60, 84);
    camera.lookAt(0, 4, -188);

    const seed = { value: 72391 };
    const random = () => {
      seed.value = (seed.value * 1664525 + 1013904223) >>> 0;
      return seed.value / 4294967296;
    };

    const groundY = -20;

    function makeCanvas(width, height, draw) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      draw(c.getContext("2d"), width, height);
      return c;
    }

    function makeRidge(z, baseY, xs, ys, color, opacity) {
      const positions = [];
      for (let i = 0; i < xs.length - 1; i += 1) {
        const x1 = xs[i], x2 = xs[i + 1];
        const y1 = ys[i], y2 = ys[i + 1];
        positions.push(
          x1, baseY, z,  x2, baseY, z,  x1, y1, z,
          x1, y1, z,     x2, baseY, z,  x2, y2, z
        );
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      const material = new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: true });
      const mesh = new T.Mesh(geometry, material);
      scene.add(mesh);
      return mesh;
    }

    function addTexturePlane(width, height, texture, opts = {}) {
      const material = new T.MeshBasicMaterial({
        map: texture,
        transparent: opts.transparent !== false,
        opacity: opts.opacity ?? 1,
        depthWrite: opts.depthWrite ?? false,
        blending: opts.blending || T.NormalBlending,
        color: opts.color || 0xffffff
      });
      const mesh = new T.Mesh(new T.PlaneGeometry(width, height), material);
      mesh.rotation.x = opts.rx ?? -Math.PI / 2;
      mesh.rotation.y = opts.ry ?? 0;
      mesh.rotation.z = opts.rz ?? 0;
      mesh.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
      scene.add(mesh);
      return { mesh, material };
    }

    const skyTexture = new T.CanvasTexture(makeCanvas(1792, 896, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#020813");
      g.addColorStop(.38, "#07172a");
      g.addColorStop(.76, "#10253a");
      g.addColorStop(1, "#060c15");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const horizon = ctx.createRadialGradient(w * .52, h * .8, 20, w * .52, h * .78, w * .46);
      horizon.addColorStop(0, "rgba(93,132,170,.38)");
      horizon.addColorStop(.55, "rgba(66,101,138,.18)");
      horizon.addColorStop(1, "rgba(30,52,78,0)");
      ctx.fillStyle = horizon;
      ctx.fillRect(0, h * .42, w, h * .58);

      const skyGlow = ctx.createRadialGradient(w * .38, h * .22, 10, w * .38, h * .22, w * .22);
      skyGlow.addColorStop(0, "rgba(30,75,132,.10)");
      skyGlow.addColorStop(1, "rgba(30,75,132,0)");
      ctx.fillStyle = skyGlow;
      ctx.fillRect(0, 0, w, h * .55);
      // Stars are rendered as animated Three.js Points below so they can visibly twinkle.
    }));
    skyTexture.colorSpace = T.SRGBColorSpace;
    skyTexture.needsUpdate = true;
    addTexturePlane(620, 300, skyTexture, { x: 0, y: 102, z: -368, rx: 0, depthWrite: false, opacity: 1 });

    // 180 animated stars: reduced density, extended down toward the horizon, with visible sparkle peaks.
    const starPositions = [];
    const starColors = [];
    const starMeta = [];
    const starPalette = [
      [1.00, 0.97, 0.90],
      [0.88, 0.95, 1.00],
      [1.00, 0.89, 0.72]
    ];
    const starCount = 90;
    for (let i = 0; i < starCount; i += 1) {
      const x = (random() * 2 - 1) * 205;
      let y;
      const band = random();
      if (band < .45) y = 6 + random() * 30;       // horizon-near stars
      else if (band < .80) y = 32 + random() * 58; // lower-mid sky
      else y = 90 + random() * 76;                 // upper sky
      const z = -324 - random() * 26;
      const color = starPalette[Math.floor(random() * starPalette.length)];
      const base = .56 + random() * .34;
      const amp = .34 + random() * .44;
      const speed = .48 + random() * 1.8;
      const phase = random() * Math.PI * 2;
      const sparkleSpeed = 1.1 + random() * 2.4;
      const sparklePhase = random() * Math.PI * 2;
      starPositions.push(x, y, z);
      starColors.push(color[0] * base, color[1] * base, color[2] * base);
      starMeta.push({ color, base, amp, speed, phase, sparkleSpeed, sparklePhase });
    }
    const starGeometry = new T.BufferGeometry();
    starGeometry.setAttribute("position", new T.Float32BufferAttribute(starPositions, 3));
    const starColorAttribute = new T.Float32BufferAttribute(starColors, 3);
    starGeometry.setAttribute("color", starColorAttribute);
    const starMaterial = new T.PointsMaterial({
      size: innerWidth < 680 ? 2.15 : 1.75,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: .98,
      blending: T.AdditiveBlending,
      depthWrite: false
    });
    const starHaloMaterial = new T.PointsMaterial({
      size: innerWidth < 680 ? 4.2 : 3.4,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: .26,
      blending: T.AdditiveBlending,
      depthWrite: false
    });
    scene.add(new T.Points(starGeometry, starHaloMaterial));
    scene.add(new T.Points(starGeometry, starMaterial));

    const ridgeX = [-175,-155,-138,-118,-100,-82,-64,-45,-24,0,22,42,61,84,104,123,145,174];

    makeRidge(-120, -55, [-214,-168,-134,-102,-70,-36,-4,30,67,103,140,176,214], [-8,-2,8,3,11,5,13,8,12,7,11,4,-2], 0x081218, .98);
    makeRidge(-72, -61, [-214,-170,-132,-99,-64,-28,6,43,78,115,154,190,214], [-18,-11,-15,-10,-15,-11,-16,-12,-16,-11,-15,-8,-12], 0x050b10, 1);

    const basinBase = new T.Mesh(
      new T.PlaneGeometry(360, 330),
      new T.MeshBasicMaterial({ color: 0x111a22 })
    );
    basinBase.rotation.x = -Math.PI / 2;
    basinBase.position.set(0, groundY, -172);
    scene.add(basinBase);

    const basinGlowTexture = new T.CanvasTexture(makeCanvas(1024, 1024, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * .5, h * .62, 0, w * .5, h * .62, w * .5);
      grad.addColorStop(0, "rgba(255,195,110,.26)");
      grad.addColorStop(.36, "rgba(255,183,98,.14)");
      grad.addColorStop(.72, "rgba(94,151,190,.10)");
      grad.addColorStop(1, "rgba(16,31,44,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }));
    basinGlowTexture.colorSpace = T.SRGBColorSpace;
    basinGlowTexture.needsUpdate = true;
    const basinGlow = addTexturePlane(340, 280, basinGlowTexture, {
      x: 0, y: groundY + .22, z: -170,
      opacity: .76, depthWrite: false, blending: T.AdditiveBlending
    });

    const cityTextureCanvas = makeCanvas(2048, 1536, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const groundGrad = ctx.createLinearGradient(0, 0, 0, h);
      groundGrad.addColorStop(0, "rgba(9,17,24,.72)");
      groundGrad.addColorStop(1, "rgba(6,10,14,.96)");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 0, w, h);

      const cityMask = ctx.createRadialGradient(w * .5, h * .58, 20, w * .5, h * .6, w * .56);
      cityMask.addColorStop(0, "rgba(42,54,64,.72)");
      cityMask.addColorStop(.62, "rgba(22,28,34,.26)");
      cityMask.addColorStop(1, "rgba(7,11,16,0)");
      ctx.fillStyle = cityMask;
      ctx.fillRect(0, 0, w, h);

      const warm = [
        [255, 198, 110], [255, 226, 174], [247, 239, 209],
        [255, 182, 96], [255, 214, 146], [205, 223, 236]
      ];

      for (let i = 0; i < 12600; i += 1) {
        const band = random();
        let y;
        if (band < .54) y = h * (.48 + (random() - .5) * .34);
        else if (band < .84) y = h * (.36 + (random() - .5) * .24);
        else y = h * (.68 + (random() - .5) * .16);

        const yNorm = Math.abs((y / h) - .55) / .55;
        const span = w * (.18 + (1 - Math.min(1, yNorm * 1.08)) * .38);
        const x = w * .5 + (random() * 2 - 1) * span + (random() < .22 ? (random() < .5 ? -w * .14 : w * .14) : 0);
        if (x < 18 || x > w - 18) continue;

        const c = warm[Math.floor(random() * warm.length)];
        const a = .46 + random() * .66;
        const size = 1.0 + random() * 4.8;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a * .22).toFixed(3)})`;
        ctx.fillRect(x - 2.5, y - 2.5, size + 5, size + 5);
      }

      const roadColors = [
        "rgba(255,210,124,.25)", "rgba(255,228,182,.16)",
        "rgba(240,247,234,.12)", "rgba(255,196,104,.16)"
      ];
      const roadSeeds = [
        [[180,310],[430,420],[770,560],[1080,720],[1390,900],[1770,1120]],
        [[1850,320],[1600,500],[1350,680],[1120,870],[850,1080],[620,1290]],
        [[150,760],[460,730],[860,760],[1260,850],[1760,990]],
        [[260,1010],[500,925],[790,880],[1090,900],[1450,980],[1810,1130]]
      ];
      roadSeeds.forEach((pts, index) => {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = roadColors[index % roadColors.length];
        ctx.lineWidth = index < 2 ? 15 : 10;
        ctx.shadowBlur = index < 2 ? 36 : 24;
        ctx.shadowColor = index < 2 ? "rgba(255,205,120,.35)" : "rgba(235,244,234,.22)";
        ctx.beginPath();
        pts.forEach(([px, py], i) => {
          if (!i) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      });

      const clusterCenters = [
        [w * .48, h * .56, 250], [w * .32, h * .58, 190],
        [w * .64, h * .52, 220], [w * .74, h * .63, 170], [w * .24, h * .42, 150]
      ];
      clusterCenters.forEach(([x, y, r], i) => {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, i % 2 ? "rgba(255,219,164,.24)" : "rgba(255,188,106,.20)");
        grad.addColorStop(.54, i % 2 ? "rgba(255,210,150,.08)" : "rgba(255,178,88,.06)");
        grad.addColorStop(1, "rgba(255,180,90,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
    });

    const cityTexture = new T.CanvasTexture(cityTextureCanvas);
    cityTexture.colorSpace = T.SRGBColorSpace;
    cityTexture.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    cityTexture.needsUpdate = true;
    addTexturePlane(304, 246, cityTexture, { x: 0, y: groundY + .2, z: -170, opacity: .98, depthWrite: false });

    const cityGlowTexture = new T.CanvasTexture(makeCanvas(1024, 1024, (ctx, w, h) => {
      const overall = ctx.createRadialGradient(w * .5, h * .57, 10, w * .5, h * .57, w * .48);
      overall.addColorStop(0, "rgba(255,184,97,.42)");
      overall.addColorStop(.36, "rgba(255,174,88,.19)");
      overall.addColorStop(.72, "rgba(255,168,82,.08)");
      overall.addColorStop(1, "rgba(255,168,82,0)");
      ctx.fillStyle = overall;
      ctx.fillRect(0, 0, w, h);
      [[.34,.57,190],[.50,.52,250],[.65,.57,190],[.25,.42,140],[.76,.64,160]].forEach(([nx,ny,r], idx) => {
        const grad = ctx.createRadialGradient(w * nx, h * ny, 0, w * nx, h * ny, r);
        grad.addColorStop(0, idx % 2 ? "rgba(255,224,176,.22)" : "rgba(255,188,101,.20)");
        grad.addColorStop(.52, idx % 2 ? "rgba(255,214,150,.08)" : "rgba(255,178,90,.06)");
        grad.addColorStop(1, "rgba(255,180,90,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });
    }));
    cityGlowTexture.colorSpace = T.SRGBColorSpace;
    cityGlowTexture.needsUpdate = true;
    const cityGlow = addTexturePlane(326, 278, cityGlowTexture, {
      x: 0, y: groundY + .28, z: -170,
      opacity: .94, depthWrite: false, blending: T.AdditiveBlending
    });

    const boxGeometry = new T.BoxGeometry(1, 1, 1);
    const boxMaterial = new T.MeshBasicMaterial({ color: 0xffffff });
    const blockColors = [0x141f24, 0x18262c, 0x1c2c33, 0x203238];
    const blocks = [];
    for (let i = 0; i < 1400; i += 1) {
      const z = -82 - random() * 184;
      const zn = Math.abs((z + 174) / 104);
      const maxX = 114 * Math.sqrt(Math.max(.18, 1 - Math.min(.97, zn * zn)));
      let x = (random() * 2 - 1) * maxX;
      if (random() < .24) x = x * .55 + (random() < .5 ? -32 : 34);
      const w = .42 + random() * 1.8;
      const d = .42 + random() * 2.0;
      const h = .4 + random() * 2.2;
      blocks.push({ x, z, w, d, h, tone: random() });
    }
    const blocksMesh = new T.InstancedMesh(boxGeometry, boxMaterial, blocks.length);
    const dummy = new T.Object3D();
    blocks.forEach((b, i) => {
      dummy.position.set(b.x, groundY + b.h * .5, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.rotation.y = (random() - .5) * .22;
      dummy.updateMatrix();
      blocksMesh.setMatrixAt(i, dummy.matrix);
      blocksMesh.setColorAt(i, new T.Color(blockColors[Math.min(3, Math.floor(b.tone * 4))]));
    });
    blocksMesh.instanceMatrix.needsUpdate = true;
    if (blocksMesh.instanceColor) blocksMesh.instanceColor.needsUpdate = true;
    scene.add(blocksMesh);

    const elevatedPositions = [];
    const elevatedColors = [];
    const farPalette = [new T.Color(0xffca72), new T.Color(0xffe5b0), new T.Color(0xf3f0de), new T.Color(0xbdd6e5)];
    for (let i = 0; i < 2600; i += 1) {
      const side = random() < .5 ? -1 : 1;
      const x = side * (18 + random() * 82) + (random() - .5) * 12;
      const z = -110 - random() * 130;
      const rise = .6 + (Math.abs(x) / 118) * 7.6 + random() * 2.6;
      elevatedPositions.push(x, groundY + rise, z);
      const c = farPalette[Math.floor(random() * farPalette.length)].clone();
      const gain = .42 + random() * .48;
      elevatedColors.push(c.r * gain, c.g * gain, c.b * gain);
    }
    const elevatedGeometry = new T.BufferGeometry();
    elevatedGeometry.setAttribute("position", new T.Float32BufferAttribute(elevatedPositions, 3));
    elevatedGeometry.setAttribute("color", new T.Float32BufferAttribute(elevatedColors, 3));
    const elevatedMaterial = new T.PointsMaterial({
      size: innerWidth < 680 ? .46 : .34,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: .92,
      blending: T.AdditiveBlending,
      depthWrite: false
    });
    scene.add(new T.Points(elevatedGeometry, elevatedMaterial));

    const roadLampMaterials = [];
    function addRoad(points, color, opacity, lampColor, lampCount) {
      const curve = new T.CatmullRomCurve3(points);
      const lineGeom = new T.BufferGeometry().setFromPoints(curve.getPoints(140));
      scene.add(new T.Line(lineGeom, new T.LineBasicMaterial({ color, transparent: true, opacity })));
      const lampPos = [];
      for (let i = 0; i < lampCount; i += 1) {
        const p = curve.getPoint(i / (lampCount - 1));
        lampPos.push(p.x, p.y + .08, p.z);
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(lampPos, 3));
      const material = new T.PointsMaterial({
        color: lampColor,
        size: innerWidth < 680 ? .54 : .36,
        sizeAttenuation: true,
        transparent: true,
        opacity: .96,
        blending: T.AdditiveBlending,
        depthWrite: false
      });
      roadLampMaterials.push({ material, base: material.opacity, speed: .8 + random() * .55, phase: random() * Math.PI * 2, amp: .06 + random() * .05 });
      scene.add(new T.Points(g, material));
    }

    const roadY = groundY + .24;
    addRoad([
      new T.Vector3(-95, roadY, -78), new T.Vector3(-71, roadY, -102), new T.Vector3(-42, roadY, -126),
      new T.Vector3(-8, roadY, -153), new T.Vector3(24, roadY, -181), new T.Vector3(56, roadY, -210), new T.Vector3(95, roadY, -236)
    ], 0xe2b26d, .28, 0xffcf8c, 118);
    addRoad([
      new T.Vector3(92, roadY, -70), new T.Vector3(64, roadY, -101), new T.Vector3(37, roadY, -129),
      new T.Vector3(11, roadY, -154), new T.Vector3(-22, roadY, -182), new T.Vector3(-58, roadY, -210), new T.Vector3(-92, roadY, -232)
    ], 0xe8dfc4, .18, 0xf5ebc5, 104);
    addRoad([
      new T.Vector3(-104, roadY, -132), new T.Vector3(-65, roadY, -130), new T.Vector3(-20, roadY, -132),
      new T.Vector3(25, roadY, -138), new T.Vector3(75, roadY, -148), new T.Vector3(103, roadY, -166)
    ], 0xe0ba75, .17, 0xffd28d, 82);
    addRoad([
      new T.Vector3(-98, roadY, -182), new T.Vector3(-55, roadY, -175), new T.Vector3(-12, roadY, -174),
      new T.Vector3(40, roadY, -179), new T.Vector3(84, roadY, -192)
    ], 0xc8d3d6, .13, 0xf1eed3, 68);

    const riverCurve = new T.CatmullRomCurve3([
      new T.Vector3(-102, groundY + .10, -96), new T.Vector3(-77, groundY + .10, -117),
      new T.Vector3(-46, groundY + .10, -140), new T.Vector3(-10, groundY + .10, -164),
      new T.Vector3(28, groundY + .10, -190), new T.Vector3(67, groundY + .10, -220)
    ]);
    scene.add(new T.Line(
      new T.BufferGeometry().setFromPoints(riverCurve.getPoints(100)),
      new T.LineBasicMaterial({ color: 0x486f86, transparent: true, opacity: .22 })
    ));

    const redPos = [];
    for (let i = 0; i < 17; i += 1) {
      const x = -102 + i * 14.5 + (random() - .5) * 2.4;
      redPos.push(x, -4 + random() * 6, -254 - random() * 16);
    }
    const rg = new T.BufferGeometry();
    rg.setAttribute("position", new T.Float32BufferAttribute(redPos, 3));
    scene.add(new T.Points(rg, new T.PointsMaterial({
      color: 0xbc4b42,
      size: .24,
      sizeAttenuation: true,
      transparent: true,
      opacity: .78,
      depthWrite: false
    })));

    const treeGroup = new T.Group();
    const trunkMat = new T.MeshBasicMaterial({ color: 0x050806, transparent: true, opacity: .98 });
    const foliageMat = new T.MeshBasicMaterial({ color: 0x040906, transparent: true, opacity: .98 });
    for (let i = 0; i < 22; i += 1) {
      const trunk = new T.Mesh(new T.CylinderGeometry(.18, .26, 4.3, 6), trunkMat);
      const foliage = new T.Mesh(new T.ConeGeometry(1.4 + random() * .75, 5.8 + random() * 2.2, 6), foliageMat);
      const side = i < 11 ? -1 : 1;
      const x = side * (82 + random() * 64) + (random() - .5) * 12;
      const z = -46 - random() * 48;
      const yBase = groundY + 1.9 + random() * 1.6;
      trunk.position.set(x, yBase, z);
      foliage.position.set(x, yBase + 4.3, z);
      foliage.rotation.y = random() * Math.PI;
      treeGroup.add(trunk, foliage);
    }
    scene.add(treeGroup);

    // Dense fields of city lights that visibly twinkle in both the basin and the distant horizon.
    const twinklePalette = [
      [1.00, 0.82, 0.50],
      [1.00, 0.90, 0.68],
      [0.92, 0.94, 0.84],
      [0.74, 0.85, 0.93]
    ];

    function createTwinkleLayer({ count, zMin, zMax, sizeDesktop, sizeMobile, opacity, yFn, baseMin = .64, baseRange = .56, ampMin = .18, ampRange = .40, layerType = 'generic' }) {
      const positions = [];
      const colors = [];
      const meta = [];
      for (let i = 0; i < count; i += 1) {
        const z = -(zMin + random() * (zMax - zMin));
        const depthNorm = Math.abs((z + 178) / 118);
        const span = 116 * Math.sqrt(Math.max(.14, 1 - Math.min(.985, depthNorm * depthNorm)));
        const x = (random() * 2 - 1) * span + (random() < .20 ? (random() < .5 ? -24 : 24) : 0);
        const y = yFn(x, z);
        const color = twinklePalette[Math.floor(random() * twinklePalette.length)];
        const base = baseMin + random() * baseRange;
        const amp = ampMin + random() * ampRange;
        const speed = .65 + random() * 2.3;
        const phase = random() * Math.PI * 2;
        positions.push(x, y, z);
        colors.push(color[0] * base, color[1] * base, color[2] * base);
        meta.push({ color, base, amp, speed, phase });
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      const colorAttribute = new T.Float32BufferAttribute(colors, 3);
      geometry.setAttribute('color', colorAttribute);
      const material = new T.PointsMaterial({
        size: innerWidth < 680 ? sizeMobile : sizeDesktop,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity,
        blending: T.AdditiveBlending,
        depthWrite: false
      });
      const haloMaterial = new T.PointsMaterial({
        size: innerWidth < 680 ? sizeMobile * 1.85 : sizeDesktop * 1.85,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: opacity * .22,
        blending: T.AdditiveBlending,
        depthWrite: false
      });
      scene.add(new T.Points(geometry, haloMaterial));
      scene.add(new T.Points(geometry, material));
      return { material, haloMaterial, colorAttribute, meta, sizeDesktop, sizeMobile, layerType };
    }

    const nearTwinkles = createTwinkleLayer({
      count: innerWidth < 680 ? 2200 : 3400,
      zMin: 86,
      zMax: 246,
      sizeDesktop: 1.02,
      sizeMobile: 1.22,
      opacity: .99,
      baseMin: .98,
      baseRange: .88,
      ampMin: .54,
      ampRange: .82,
      layerType: 'near',
      yFn: (x, z) => {
        const nearLift = Math.max(0, Math.abs(x) - 56) * .03;
        const basinDrift = (z + 170) * -.002;
        return groundY + .18 + random() * .62 + nearLift + basinDrift;
      }
    });

    const farTwinkles = createTwinkleLayer({
      count: innerWidth < 680 ? 1500 : 2200,
      zMin: 190,
      zMax: 314,
      sizeDesktop: .68,
      sizeMobile: .82,
      opacity: .92,
      baseMin: .74,
      baseRange: .58,
      ampMin: .24,
      ampRange: .46,
      layerType: 'far',
      yFn: (x, z) => {
        const horizonRise = 4.6 + Math.max(0, Math.abs(x) - 34) * .055;
        const depthDrift = (Math.abs(z) - 190) * .020;
        return groundY + horizonRise + depthDrift + random() * 2.8;
      }
    });

    const twinkleLayers = [nearTwinkles, farTwinkles];

    function makeGlowTexture(innerColor, outerColor) {
      const tex = new T.CanvasTexture(makeCanvas(96, 96, (ctx, w, h) => {
        const grad = ctx.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, w * .48);
        grad.addColorStop(0, innerColor);
        grad.addColorStop(.32, outerColor);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }));
      tex.colorSpace = T.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }

    const headlightTexture = makeGlowTexture('rgba(255,244,206,1)', 'rgba(255,210,132,.52)');
    const taillightTexture = makeGlowTexture('rgba(255,110,88,1)', 'rgba(255,72,60,.46)');
    const carLightCars = [];

    function addLightCar(points, options = {}) {
      const {
        texture = headlightTexture,
        size = 2.7,
        separation = .9,
        duration = 60,
        phase = 0,
        pulseSpeed = 3.2,
        pulseAmp = .22,
        pulsePhase = random() * Math.PI * 2,
        opacity = .96
      } = options;
      const curve = new T.CatmullRomCurve3(points);
      const group = new T.Group();
      const sprites = [];
      for (const side of [-1, 1]) {
        const material = new T.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: T.AdditiveBlending,
          color: 0xffffff
        });
        const sprite = new T.Sprite(material);
        sprite.position.set(side * separation * .5, .18, 0);
        sprite.scale.set(size, size, 1);
        group.add(sprite);
        sprites.push(sprite);
      }
      scene.add(group);
      carLightCars.push({ curve, group, sprites, duration, phase, pulseSpeed, pulseAmp, pulsePhase, baseOpacity: opacity });
    }

    addLightCar([
      new T.Vector3(-110, groundY + .44, -88),
      new T.Vector3(-56, groundY + .44, -94),
      new T.Vector3(2, groundY + .44, -101),
      new T.Vector3(64, groundY + .44, -96),
      new T.Vector3(112, groundY + .44, -90)
    ], { texture: headlightTexture, size: 2.9, separation: 1.05, duration: 60, phase: 0, pulseSpeed: 3.0, pulseAmp: .20, opacity: .98 });

    addLightCar([
      new T.Vector3(110, groundY + .40, -118),
      new T.Vector3(58, groundY + .40, -123),
      new T.Vector3(4, groundY + .40, -128),
      new T.Vector3(-52, groundY + .40, -122),
      new T.Vector3(-108, groundY + .40, -116)
    ], { texture: taillightTexture, size: 2.5, separation: .95, duration: 60, phase: 15, pulseSpeed: 3.4, pulseAmp: .26, opacity: .92 });

    addLightCar([
      new T.Vector3(-16, groundY + .38, -58),
      new T.Vector3(-13, groundY + .39, -92),
      new T.Vector3(-10, groundY + .41, -126),
      new T.Vector3(-6, groundY + .44, -160),
      new T.Vector3(-2, groundY + .48, -198),
      new T.Vector3(2, groundY + .52, -232)
    ], { texture: headlightTexture, size: 2.7, separation: .72, duration: 60, phase: 30, pulseSpeed: 2.7, pulseAmp: .18, opacity: .97 });

    addLightCar([
      new T.Vector3(28, groundY + .52, -232),
      new T.Vector3(25, groundY + .48, -198),
      new T.Vector3(21, groundY + .45, -164),
      new T.Vector3(17, groundY + .42, -129),
      new T.Vector3(14, groundY + .40, -94),
      new T.Vector3(11, groundY + .39, -62)
    ], { texture: taillightTexture, size: 2.35, separation: .68, duration: 60, phase: 45, pulseSpeed: 2.9, pulseAmp: .24, opacity: .90 });

    // A slender radio tower on the ridge. Only the silhouette and the red
    // anti-collision lamp are meant to read from this distance.
    const towerGroup = new T.Group();
    const towerDark = new T.MeshBasicMaterial({ color: 0x05080b });
    const towerMetal = new T.MeshBasicMaterial({ color: 0x101820, transparent: true, opacity: .92 });
    const towerHeight = 12.5;
    const towerBaseY = 11.0;
    const towerX = 63.0;
    const towerZ = -121.5;

    // Tapered legs.
    const towerLegGeom = new T.CylinderGeometry(.12, .20, towerHeight, 5);
    const legOffsets = [
      [-1.05, -0.55], [1.05, -0.55], [-.56, .42], [.56, .42]
    ];
    legOffsets.forEach(([ox, oz]) => {
      const leg = new T.Mesh(towerLegGeom, towerMetal);
      leg.position.set(ox, towerHeight * .5, oz);
      leg.rotation.z = ox * -.013;
      towerGroup.add(leg);
    });

    // Cross members, deliberately simple so it reads as a distant lattice tower.
    const barGeom = new T.BoxGeometry(2.8, .11, .11);
    for (const y of [2.2, 4.6, 7.1, 9.5, 11.6]) {
      const bar = new T.Mesh(barGeom, towerDark);
      bar.position.set(0, y, 0);
      towerGroup.add(bar);
      const bar2 = new T.Mesh(barGeom, towerDark);
      bar2.position.set(0, y, 0);
      bar2.rotation.y = Math.PI / 2;
      towerGroup.add(bar2);
    }
    const mast = new T.Mesh(new T.CylinderGeometry(.075, .11, 2.2, 5), towerMetal);
    mast.position.set(0, towerHeight + 1.05, 0);
    towerGroup.add(mast);
    towerGroup.position.set(towerX, towerBaseY, towerZ);
    scene.add(towerGroup);

    const aviationLampTexture = makeGlowTexture('rgba(255,82,68,1)', 'rgba(255,46,40,.44)');
    const aviationLampMaterial = new T.SpriteMaterial({
      map: aviationLampTexture,
      color: 0xffffff,
      transparent: true,
      opacity: .98,
      blending: T.AdditiveBlending,
      depthWrite: false
    });
    const aviationLamp = new T.Sprite(aviationLampMaterial);
    aviationLamp.position.set(towerX, towerBaseY + towerHeight + 2.25, towerZ);
    aviationLamp.scale.set(3.4, 3.4, 1);
    scene.add(aviationLamp);

    // Airplane lights only. It crosses the sky for 30 seconds, once per 5 minutes.
    // The path rises 5 degrees from left to right in world space.
    const planeLightGroup = new T.Group();
    const planeWhiteTexture = makeGlowTexture('rgba(255,255,236,1)', 'rgba(228,242,255,.45)');
    const planeRedTexture = makeGlowTexture('rgba(255,78,68,1)', 'rgba(255,54,48,.36)');
    const planeGreenTexture = makeGlowTexture('rgba(142,255,181,1)', 'rgba(90,232,142,.30)');

    function addPlaneSprite(texture, x, size, opacity = 1) {
      const material = new T.SpriteMaterial({
        map: texture,
        color: 0xffffff,
        transparent: true,
        opacity,
        blending: T.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new T.Sprite(material);
      sprite.position.set(x, 0, 0);
      sprite.scale.set(size, size, 1);
      planeLightGroup.add(sprite);
      return { sprite, material };
    }

    const planeWhite = addPlaneSprite(planeWhiteTexture, 0, 4.6, 1);
    const planeRed = addPlaneSprite(planeRedTexture, -1.25, 2.4, .9);
    const planeGreen = addPlaneSprite(planeGreenTexture, 1.25, 2.2, .76);
    planeLightGroup.visible = false;
    scene.add(planeLightGroup);

    const planeLoopSeconds = 300;
    const planePassSeconds = 30;
    const planeStart = new T.Vector3(-218, 54, -305);
    const planeEndX = 218;
    const planeEndY = planeStart.y + Math.tan(T.MathUtils.degToRad(5)) * (planeEndX - planeStart.x);
    const planeEnd = new T.Vector3(planeEndX, planeEndY, -305);

    const clock = new T.Clock();
    const freezeAmbientTwinkleOnMobile = true;
    let lastLightFieldUpdate = -Infinity;

    function renderFrame() {
      const t = clock.getElapsedTime();
      const mobileLite = isMobileViewport();
      const allowAmbientTwinkle = !(mobileLite && freezeAmbientTwinkleOnMobile);
      const lightFieldInterval = mobileLite ? 1 / 24 : 1 / 60;
      const updateLightFields = allowAmbientTwinkle && (t - lastLightFieldUpdate >= lightFieldInterval);
      if (updateLightFields) {
        lastLightFieldUpdate = t;
        twinkleLayers.forEach(layer => {
          const colors = layer.colorAttribute.array;
          const isNear = layer.layerType === 'near';
          const isFar = layer.layerType === 'far';
          for (let i = 0; i < layer.meta.length; i += 1) {
            const light = layer.meta[i];
            const wave = .5 + .5 * Math.sin(t * light.speed + light.phase);
            const pulse = (isNear ? .34 : .46) + light.amp * (isNear ? 1.34 : .98) * wave;
            const flutter = 1 + (isNear ? .54 : .21) * Math.sin(t * (light.speed * (isNear ? 3.9 : 2.7)) + light.phase * 1.9);
            const sparklePower = isNear ? 5 : 11;
            const sparkleStrength = isNear ? 1.95 : .94;
            const sparkle = Math.pow(Math.max(0, Math.sin(t * (light.speed * (isFar ? 1.95 : 2.35)) + light.phase * 2.3)), sparklePower) * sparkleStrength;
            const burst = isNear ? Math.pow(Math.max(0, Math.sin(t * (light.speed * 4.8) + light.phase * 3.1)), 3) * .78 : 0;
            const gain = light.base * (pulse + sparkle + burst) * flutter;
            const idx = i * 3;
            colors[idx] = light.color[0] * gain;
            colors[idx + 1] = light.color[1] * gain;
            colors[idx + 2] = light.color[2] * gain;
          }
          layer.colorAttribute.needsUpdate = true;
        });

        const starColorArray = starColorAttribute.array;
        for (let i = 0; i < starMeta.length; i += 1) {
          const star = starMeta[i];
          const wave = .5 + .5 * Math.sin(t * star.speed + star.phase);
          const occasional = Math.pow(Math.max(0, Math.sin(t * star.sparkleSpeed + star.sparklePhase)), 16) * 1.08;
          const gain = Math.min(1.55, star.base * (.62 + star.amp * wave) + occasional);
          const idx = i * 3;
          starColorArray[idx] = star.color[0] * gain;
          starColorArray[idx + 1] = star.color[1] * gain;
          starColorArray[idx + 2] = star.color[2] * gain;
        }
        starColorAttribute.needsUpdate = true;
      }

      carLightCars.forEach(car => {
        const u = ((t + car.phase) % car.duration) / car.duration;
        const point = car.curve.getPointAt(u);
        const tangent = car.curve.getTangentAt(u).normalize();
        car.group.position.copy(point);
        car.group.rotation.y = Math.atan2(tangent.x, tangent.z);
        const pulse = 1 + Math.sin(t * car.pulseSpeed + car.pulsePhase) * car.pulseAmp;
        const sparkle = 1 + Math.pow(Math.max(0, Math.sin(t * (car.pulseSpeed * 1.6) + car.pulsePhase * 1.7)), 10) * .26;
        car.sprites.forEach(sprite => {
          sprite.material.opacity = Math.min(1.25, car.baseOpacity * pulse * sparkle);
        });
      });

      // Obstruction light: a short red double-flash followed by a pause.
      const towerCycle = t % 2.4;
      let towerFlash = .10;
      if (towerCycle < .12) towerFlash = 1.0;
      else if (towerCycle < .24) towerFlash = .15;
      else if (towerCycle < .36) towerFlash = .88;
      const towerSize = 2.8 + towerFlash * 2.4;
      const towerMobileScale = innerWidth < 680 ? 1.14 : 1;
      aviationLampMaterial.opacity = .08 + towerFlash * .92;
      aviationLamp.scale.set(towerSize * towerMobileScale, towerSize * towerMobileScale, 1);

      // The first pass begins immediately for easy UAT, then repeats every 5 minutes.
      const planeCycle = t % planeLoopSeconds;
      if (planeCycle < planePassSeconds) {
        planeLightGroup.visible = true;
        const u = planeCycle / planePassSeconds;
        planeLightGroup.position.lerpVectors(planeStart, planeEnd, u);
        const whitePulse = .84 + Math.sin(t * 6.2) * .12;
        const whiteSparkle = Math.pow(Math.max(0, Math.sin(t * 2.7 + .8)), 14) * .26;
        planeWhite.material.opacity = Math.min(1, whitePulse + whiteSparkle);
        planeRed.material.opacity = (Math.sin(t * 5.4) > .72) ? .96 : .18;
        planeGreen.material.opacity = (Math.sin(t * 4.8 + 1.7) > .76) ? .78 : .12;
      } else {
        planeLightGroup.visible = false;
      }

      if (allowAmbientTwinkle) {
        roadLampMaterials.forEach(item => {
          const wave = Math.sin(t * item.speed + item.phase);
          const sparkle = Math.pow(Math.max(0, Math.sin(t * (item.speed * 2.3) + item.phase * 1.6)), 12) * .12;
          item.material.opacity = Math.min(1, item.base + wave * item.amp * 1.7 + sparkle);
        });
        elevatedMaterial.opacity = .88 + Math.sin(t * .58 + .4) * .06;
        cityGlow.material.opacity = .90 + Math.sin(t * .72) * .07;
        basinGlow.material.opacity = .74 + Math.sin(t * .55 + .8) * .06;
      } else {
        roadLampMaterials.forEach(item => {
          item.material.opacity = item.base;
        });
        elevatedMaterial.opacity = .88;
        cityGlow.material.opacity = .90;
        basinGlow.material.opacity = .74;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(renderFrame);
    }

    renderFrame();

    return () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobileViewport() ? 1.0 : 1.6));
      renderer.setSize(innerWidth, innerHeight, false);
      elevatedMaterial.size = innerWidth < 680 ? .46 : .34;
      twinkleLayers.forEach(layer => {
        const size = innerWidth < 680 ? layer.sizeMobile : layer.sizeDesktop;
        layer.material.size = size;
        layer.haloMaterial.size = size * 1.85;
      });
      starMaterial.size = innerWidth < 680 ? 2.2 : 1.8;
      starHaloMaterial.size = innerWidth < 680 ? 4.3 : 3.5;
      roadLampMaterials.forEach(item => {
        item.material.size = innerWidth < 680 ? .54 : .36;
      });
      aviationLamp.userData.mobileScale = innerWidth < 680 ? 1.14 : 1;
      planeLightGroup.scale.setScalar(innerWidth < 680 ? 1.12 : 1);
      renderer.render(scene, camera);
    };
  }

  if (!categories.length || !data.apps.length) {
    status.hidden = false;
    status.textContent = "表示できるアプリが apps.js に登録されていません。";
    return;
  }

  buildGallery();
  measure();
  updateSelection();
  snapToSelection();

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", event => finishPointer(event, false));
  viewport.addEventListener("pointercancel", event => finishPointer(event, true));
  viewport.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("keydown", onKeyDown);

  let resizeThree = () => {};
  try {
    resizeThree = initThreeScene();
  } catch (error) {
    console.warn("WebGL background fallback:", error);
    document.body.classList.add("webgl-failed");
    status.hidden = false;
  }

  let resizeFrame = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      measure();
      snapToSelection();
      resizeThree();
    });
  });
}());
