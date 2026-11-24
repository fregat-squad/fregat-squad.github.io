(() => {
  const stage = document.querySelector("#jump");
  const canvas = document.querySelector("#jump-canvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.querySelector("#jump-overlay");
  const title = document.querySelector("#jump-title");
  const status = document.querySelector("#jump-status");
  const action = document.querySelector("#jump-action");
  const pause = document.querySelector("#jump-pause");
  const stick = document.querySelector("#jump-stick");
  const knob = stick.querySelector(".jump-stick-knob");
  const scoreOutput = document.querySelector("#jump-score");
  const bestOutput = document.querySelector("#jump-best");
  const board = window.fregatArcade.leaderboard({
    entry: document.querySelector("#jump-entry"),
    board: document.querySelector("#jump-leaders"),
    status, action, key: "fregat-jump-leaders", game: "jump", minimum: 150
  });
  const bestKey = "fregat-jump-best";
  const field = { width: 380, height: 560 };
  const player = { x: 190, y: 0, vx: 0, vy: 0, facing: 1 };
  const keys = new Set();
  const leftKeys = ["ArrowLeft", "KeyA"];
  const rightKeys = ["ArrowRight", "KeyD"];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const hero = sprite("leha.png");
  const rocket = sprite("leha-rocket.png", [248, 6, 395, 1768]);
  const spring = sprite("leha-spring.png", [219, 123, 1737, 443]);
  const cactus = new Path2D("M-6 0V-9H-11Q-16-9-16-14V-20Q-16-24-12-24T-8-20V-16H-6V-31Q-6-37 0-37T6-31V-20H8V-26Q8-30 12-30T16-26V-18Q16-13 11-13H6V0Z");
  let mode = "ready";
  let camera = 0;
  let platforms = [];
  let simulation, remainder = 0;
  let best = readBest();
  let score = 0;
  let elapsed = 0;
  let fuel = 0;
  let activePointer = null;
  let touchDirection = 0;
  let then = 0;
  let frameId = 0;

  bestOutput.value = best;
  resetRun();

  function readBest() {
    try { return Math.max(0, Number.parseInt(localStorage.getItem(bestKey), 10) || 0); }
    catch { return 0; }
  }

  function sprite(file, crop) {
    const image = new Image();
    image.addEventListener("load", () => { if (!stage.hidden && mode !== "playing") draw(); });
    image.src = "media/" + file;
    return { image, crop };
  }

  function clamp(value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  }

  function fit() {
    if (stage.hidden) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const density = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    field.height = field.width * height / width;
    ctx.setTransform(canvas.width / field.width, 0, 0, canvas.height / field.height, 0, 0);
    if (mode === "ready") resetRun();
    draw();
  }

  function resetRun(seed = 1, height = Math.round(field.height)) {
    simulation = fregatRunRules.jump(seed, height);
    remainder = 0;
    syncSimulation();
  }
  function syncSimulation() {
    Object.assign(player, simulation.player);
    camera = simulation.camera;
    platforms = simulation.platforms;
    fuel = simulation.fuel;
    elapsed = simulation.elapsed;
    scoreOutput.value = score = simulation.score;
  }
  function xOf(platform) { return simulation.xOf(platform); }

  function distanceAcrossField(a, b) {
    const distance = Math.abs(a - b);
    return Math.min(distance, field.width - distance);
  }

  function picture({ image, crop }, x, bottom, width, height) {
    if (image.complete && image.naturalWidth) {
      const source = crop ?? [0, 0, image.naturalWidth, image.naturalHeight];
      ctx.drawImage(image, ...source, x - width / 2, bottom - height, width, height);
    }
  }

  function drawPlatform(platform) {
    ctx.save();
    if (platform.spentAt !== undefined) ctx.globalAlpha = clamp(1 - (elapsed - platform.spentAt) / .23, 0, 1);
    const x = xOf(platform);
    const y = platform.y - camera;
    const left = x - platform.width / 2;
    const shade = ctx.createLinearGradient(0, y, 0, y + 12);
    shade.addColorStop(0, "#fbfdff");
    shade.addColorStop(.46, platform.travel ? "#adbed5b5" : "#d9e2eed1");
    shade.addColorStop(1, "#8999b0ac");
    ctx.beginPath();
    ctx.roundRect(left, y, platform.width, 10, 5);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = "#728094b5";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (platform.item === "fragile") {
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 1);
      ctx.lineTo(x + 2, y + 5);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x + 5, y + 9);
      ctx.moveTo(x + 2, y + 5);
      ctx.lineTo(x + 10, y + 3);
      ctx.strokeStyle = "#4f6077";
      ctx.stroke();
    } else if (platform.item === "spring") {
      picture(spring, x, y + 1, 50, 13);
    } else if (platform.item === "rocket") {
      picture(rocket, x, y - 12, 12, 44);
    } else if (platform.item === "cactus") {
      ctx.save();
      ctx.translate(x + platform.cactusSide * (platform.width / 2 - 13), y);
      ctx.fillStyle = "#648677";
      ctx.strokeStyle = "#344f45";
      ctx.lineWidth = 1.6;
      ctx.fill(cactus);
      ctx.stroke(cactus);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = "#f6faf0bd";
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(-4, -28 + i * 9);
        ctx.lineTo(-1, -25 + i * 9);
        ctx.moveTo(4, -25 + i * 8);
        ctx.lineTo(1, -22 + i * 8);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPlayer(foot, x) {
    ctx.save();
    ctx.translate(x, foot);
    ctx.scale(player.facing, 1);
    if (fuel > 0) {
      const flicker = reduced.matches ? 0 : Math.sin(elapsed * 48) * 5;
      ctx.beginPath();
      ctx.moveTo(-29, -13);
      ctx.quadraticCurveTo(-34, -2, -24, 13 + flicker);
      ctx.quadraticCurveTo(-16, 0, -19, -13);
      ctx.fillStyle = "#e3a24b";
      ctx.fill();
      picture(rocket, -24, -13, 11, 40);
    }
    const height = mode === "ready" ? 107 : 73;
    picture(hero, 0, 0, height * .8, height);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, field.width, field.height);
    ctx.strokeStyle = "#818da746";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = Math.ceil(camera / 90) * 90; y < camera + field.height; y += 90) {
      ctx.moveTo(8, y - camera);
      ctx.lineTo(22, y - camera);
      ctx.moveTo(field.width - 22, y - camera);
      ctx.lineTo(field.width - 8, y - camera);
    }
    ctx.stroke();
    for (const platform of platforms) {
      if (platform.y >= camera - 65 && platform.y <= camera + field.height + 12) drawPlatform(platform);
    }
    if (mode === "ready") drawPlayer(field.height * .37, field.width * .54);
    else {
      const foot = player.y - camera;
      drawPlayer(foot, player.x);
      // Include the wings and the rocket flame while the sprite straddles the seam.
      if (player.x < 35) drawPlayer(foot, player.x + field.width);
      if (player.x > field.width - 35) drawPlayer(foot, player.x - field.width);
    }
  }

  function showPanel(state, heading, message, buttonText, focus = true) {
    mode = state;
    cancelAnimationFrame(frameId);
    then = 0;
    keys.clear();
    releaseSteering();
    stick.hidden = true;
    title.textContent = heading;
    status.textContent = message;
    action.textContent = buttonText;
    overlay.hidden = false;
    pause.hidden = true;
    if (focus) action.focus({ preventScroll: true });
  }

  function end(reason) {
    if (score > best) {
      best = score;
      bestOutput.value = best;
      try { localStorage.setItem(bestKey, String(best)); }
      catch { /* Keep the record for the current tab. */ }
    }
    const eligible = board.offer(score);
    showPanel("over", reason, "Очки — " + score + ". Рекорд — " + best + ".",
      eligible ? "Пропустить и сыграть снова" : "Попробовать снова", !eligible);
    if (eligible) board.focus();
  }

  function readDirection() {
    const left = leftKeys.some(key => keys.has(key));
    const right = rightKeys.some(key => keys.has(key));
    return touchDirection || Number(right) - Number(left);
  }

  function frame(time) {
    remainder += then ? Math.min(.05, (time - then) / 1000) : 0;
    then = time;
    while (remainder >= fregatRunRules.tick && !simulation.over) {
      const direction = Math.round(readDirection() * 100);
      board.record(direction);
      simulation.step(direction);
      remainder -= fregatRunRules.tick;
    }
    syncSimulation();
    draw();
    if (simulation.over) end(simulation.over);
    else frameId = requestAnimationFrame(frame);
  }

  async function play() {
    if (mode === "playing" || mode === "starting") return;
    if (mode !== "paused") {
      mode = "starting";
      board.offer(0);
      const height = clamp(Math.round(field.height), 200, 1600);
      const seed = await board.start(height);
      resetRun(seed, height);
    }
    mode = "playing";
    if (stage.hidden || document.hidden) { suspend(false); return; }
    overlay.hidden = true;
    pause.hidden = false;
    stick.hidden = false;
    stage.focus({ preventScroll: true });
    frameId = requestAnimationFrame(frame);
  }

  function suspend(focus = true) {
    if (mode === "playing") showPanel("paused", "Пауза", "Высота и очки сохранены.", "Продолжить", focus);
  }

  function steer(event) {
    const control = event.currentTarget;
    const { left, width } = control.getBoundingClientRect();
    const offset = event.clientX - left - width / 2;
    if (control === canvas) {
      touchDirection = offset < 0 ? -1 : 1;
      return;
    }
    const travel = (width - knob.offsetWidth) / 2 - 3;
    const position = clamp(offset / travel, -1, 1);
    touchDirection = Math.abs(position) < .1 ? 0 : position;
    stick.style.setProperty("--stick-x", position * travel + "px");
  }

  function releaseSteering() {
    const pointer = activePointer;
    activePointer = null;
    touchDirection = 0;
    stick.removeAttribute("data-held");
    stick.style.removeProperty("--stick-x");
    if (pointer !== null) {
      for (const control of [canvas, stick]) {
        if (control.hasPointerCapture(pointer)) control.releasePointerCapture(pointer);
      }
    }
  }

  action.addEventListener("click", play);
  pause.addEventListener("click", () => suspend());
  for (const control of [canvas, stick]) {
    control.addEventListener("pointerdown", event => {
      if (mode !== "playing" || activePointer !== null || !event.isPrimary || event.button !== 0) return;
      activePointer = event.pointerId;
      control.setPointerCapture(activePointer);
      if (control === stick) stick.setAttribute("data-held", "");
      steer(event);
    });
    control.addEventListener("pointermove", event => {
      if (event.pointerId === activePointer) steer(event);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      control.addEventListener(type, event => {
        if (event.pointerId === activePointer) releaseSteering();
      });
    }
  }
  document.addEventListener("keydown", event => {
    if (stage.hidden || event.altKey || event.ctrlKey || event.metaKey || event.target.closest("input")) return;
    if (event.code === "Escape" || event.code === "KeyP") {
      if (event.repeat) return;
      if (mode === "playing") suspend();
      else if (mode === "paused") play();
    } else if (mode === "playing" && (leftKeys.includes(event.code) || rightKeys.includes(event.code))) {
      event.preventDefault();
      keys.add(event.code);
    } else if (event.code === "Space" && !event.repeat && !event.target.closest("button, a, summary") && !board.pending) {
      event.preventDefault();
      play();
    }
  });
  document.addEventListener("keyup", event => keys.delete(event.code));
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(false); });
  window.addEventListener("fregat:view", () => { if (stage.hidden) suspend(false); else fit(); });
  new ResizeObserver(fit).observe(stage);
  fit();
})();
