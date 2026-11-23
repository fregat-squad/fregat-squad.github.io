(() => {
  const flight = document.querySelector("#flight");
  const canvas = document.querySelector("#flight-canvas");
  const ctx = canvas.getContext("2d");
  const scoreOutput = document.querySelector("#flight-score");
  const bestOutput = document.querySelector("#flight-best");
  const overlay = document.querySelector("#flight-overlay");
  const title = document.querySelector("#flight-title");
  const status = document.querySelector("#flight-status");
  const action = document.querySelector("#flight-action");
  const pause = document.querySelector("#flight-pause");
  const leaderboard = window.fregatArcade.leaderboard({
    entry: document.querySelector("#flight-entry"),
    board: document.querySelector("#flight-leaders"),
    status, action, key: "fregat-flappy-leaders", game: "flappy", minimum: 21
  });
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const recordKey = "fregat-flappy-best";

  const field = { width: 0, height: 560 };
  const pilot = { x: 0, y: 185, speed: 0, flapAt: 0 };
  const bottle = new Image();
  const bottleOutline = new Path2D("M199 21 Q224 16 245 22 L249 88 258 109 258 152 252 174 259 188 282 204 286 219 286 414 Q284 426 273 426 H173 Q161 425 161 413 V220 L166 209 189 191 198 173 190 151 189 111 199 90Z");
  const wing = new Path2D("M5 2C10-4 19-13 32-12 30-9 27-5 23-3 26-4 29-4 31-3 29 0 24 3 21 4 24 3 26 4 27 5 23 9 14 12 5 7Z");
  const wingDetails = new Path2D("M11 4Q19 0 25-7M13 6Q19 4 23 1M14 8Q19 7 22 5");

  const gateWidth = 62;
  const gateSpacing = 245;
  const gravity = 930;
  const lift = -315;
  let gates = [];
  let mode = "ready";
  let score = 0;
  let best = readRecord();
  let elapsed = 0;
  let lastTime = 0;
  let frameRequest = 0;
  let gateNumber = 0;

  bestOutput.value = best;
  bottle.src = "media/steersman.png";
  bottle.addEventListener("load", draw);
  function readRecord() {
    try {
      return Math.max(0, Number.parseInt(localStorage.getItem(recordKey), 10) || 0);
    } catch {
      return 0;
    }
  }

  function saveRecord() {
    try {
      localStorage.setItem(recordKey, String(best));
    } catch {
      // The current session still keeps the score if storage is unavailable.
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fitField() {
    const { width, height } = flight.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const density = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    field.width = width / height * field.height;
    const previousX = pilot.x;
    pilot.x = clamp(field.width * .24, 52, 194);
    const shift = pilot.x - previousX;
    gates.forEach(gate => { gate.x += shift; });
    ctx.setTransform(canvas.width / field.width, 0, 0, canvas.height / field.height, 0, 0);
    draw();
  }

  function newGate(x, previousCenter) {
    const number = gateNumber++;
    const gap = Math.max(144, 201 - number * 2.1);
    const center = number === 0 ? field.height * .48 :
      clamp(previousCenter + (Math.random() - .5) * 146, gap / 2 + 51, field.height - gap / 2 - 51);
    return { x, center, gap, moving: number >= 6 && number % 3 === 0, scored: false };
  }

  function gateCenter(gate) {
    return gate.center + (gate.moving ? Math.sin(elapsed * 1.7) * 25 : 0);
  }

  function drawShield(x, y, height, topShield) {
    if (height < 1) return;
    const glaze = ctx.createLinearGradient(x, y, x + gateWidth, y);
    glaze.addColorStop(0, "#2a2d3480");
    glaze.addColorStop(.08, "#f5f5f670");
    glaze.addColorStop(.22, "#cbced046");
    glaze.addColorStop(.72, "#3d414650");
    glaze.addColorStop(.94, "#8b8e9380");
    glaze.addColorStop(1, "#e4e5e88c");
    const end = ctx.createLinearGradient(x, topShield ? y + height : y, x, topShield ? y + height - 24 : y + 24);
    end.addColorStop(0, "#f6f7f898");
    end.addColorStop(.24, "#a9aaad5e");
    end.addColorStop(1, "#dadcde00");
    ctx.beginPath();
    ctx.roundRect(x, y, gateWidth, height, topShield ? [0, 0, 12, 12] : [12, 12, 0, 0]);
    ctx.fillStyle = glaze;
    ctx.fill();
    ctx.fillStyle = end;
    ctx.fill();
    ctx.strokeStyle = "#373b457d";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  function drawWings() {
    const stroke = Math.max(0, 1 - (elapsed - pilot.flapAt) / .3);
    const beat = motion.matches ? 0 : Math.sin(elapsed * 30) * (.15 + stroke * .72);
    const silver = ctx.createLinearGradient(0, -12, 0, 10);
    silver.addColorStop(0, "#ffffff");
    silver.addColorStop(1, "#a8b6c6");
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(beat);
      ctx.fillStyle = silver;
      ctx.strokeStyle = "#384b61";
      ctx.lineWidth = 1.4;
      ctx.fill(wing);
      ctx.stroke(wing);
      ctx.lineWidth = .8;
      ctx.strokeStyle = "#76899b";
      ctx.stroke(wingDetails);
      ctx.restore();
    }
  }

  function drawPilot() {
    const tilt = clamp(pilot.speed / 760, -.42, .62);
    ctx.save();
    ctx.translate(pilot.x, pilot.y);
    ctx.rotate(tilt);
    drawWings();
    ctx.scale(.12, .12);
    ctx.translate(-223.5, -223.5);
    ctx.save();
    ctx.clip(bottleOutline);
    if (bottle.naturalWidth) ctx.drawImage(bottle, 0, 0);
    else {
      ctx.fillStyle = "#bc8e52";
      ctx.fill(bottleOutline);
    }
    ctx.restore();
    ctx.lineWidth = 11;
    ctx.strokeStyle = "#263241";
    ctx.stroke(bottleOutline);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, field.width, field.height);
    for (const gate of gates) {
      const center = gateCenter(gate);
      const bottom = center + gate.gap / 2;
      drawShield(gate.x, 0, center - gate.gap / 2, true);
      drawShield(gate.x, bottom, field.height - bottom, false);
    }
    drawPilot();
  }

  function stopFrame() {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    lastTime = 0;
  }

  function showPanel(nextMode, heading, message, label, focus = true) {
    stopFrame();
    mode = nextMode;
    title.textContent = heading;
    status.textContent = message;
    action.textContent = label;
    pause.hidden = true;
    overlay.hidden = false;
    if (focus) action.focus({ preventScroll: true });
  }

  function finish() {
    const eligible = leaderboard.offer(score);
    showPanel("over", "Полёт окончен", "Счёт — " + score + ". Рекорд — " + best + ".",
      eligible ? "Пропустить и сыграть снова" : "Попробовать снова", !eligible);
    if (eligible) leaderboard.focus();
  }

  function update(dt) {
    elapsed += dt;
    pilot.speed += gravity * dt;
    pilot.y += pilot.speed * dt;
    const halfHeight = 18;
    if (pilot.y + halfHeight >= field.height || pilot.y - halfHeight <= 0) {
      pilot.y = clamp(pilot.y, halfHeight, field.height - halfHeight);
      finish();
      return;
    }

    const distance = Math.min(293, 170 + score * 4.5) * dt;
    for (const gate of gates) {
      gate.x -= distance;
      const center = gateCenter(gate);
      if (pilot.x + 10 > gate.x && pilot.x - 10 < gate.x + gateWidth &&
          (pilot.y - halfHeight < center - gate.gap / 2 || pilot.y + halfHeight > center + gate.gap / 2)) {
        finish();
        return;
      }
      if (!gate.scored && gate.x + gateWidth < pilot.x - 10) {
        gate.scored = true;
        scoreOutput.value = ++score;
        if (score > best) {
          bestOutput.value = best = score;
          saveRecord();
        }
      }
    }
    const tail = gates.at(-1);
    if (tail.x < field.width - gateSpacing + gateWidth) gates.push(newGate(tail.x + gateSpacing, tail.center));
    gates = gates.filter(gate => gate.x + gateWidth > 0);
  }

  function frame(time) {
    const dt = lastTime ? Math.min(.032, (time - lastTime) / 1000) : 0;
    lastTime = time;
    update(dt);
    draw();
    if (mode === "playing") frameRequest = requestAnimationFrame(frame);
  }

  function flap() {
    pilot.speed = lift;
    pilot.flapAt = elapsed;
  }

  function play() {
    if (mode !== "paused") {
      leaderboard.offer(0);
      elapsed = 0;
      score = 0;
      scoreOutput.value = 0;
      gateNumber = 0;
      pilot.y = field.height * .43;
      gates = [newGate(Math.min(field.width + 15, pilot.x + 272), pilot.y)];
      flap();
    }
    mode = "playing";
    overlay.hidden = true;
    pause.hidden = false;
    flight.focus({ preventScroll: true });
    frameRequest = requestAnimationFrame(frame);
  }

  function pauseGame(focus = true) {
    if (mode === "playing") showPanel("paused", "Пауза", "Полёт продолжится с того же места.", "Продолжить", focus);
  }

  function fly() {
    if (mode === "playing") flap();
    else if (!leaderboard.pending) play();
  }

  action.addEventListener("click", play);
  pause.addEventListener("click", () => pauseGame());
  flight.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest("button, form, details")) return;
    event.preventDefault();
    fly();
  });
  document.addEventListener("keydown", event => {
    if (flight.hidden || event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.code === "Escape" || event.code === "KeyP") {
      if (mode === "playing") pauseGame();
      else if (mode === "paused") play();
      return;
    }
    if (event.code !== "Space" && event.code !== "ArrowUp") return;
    if (event.target.closest("button, a, input, summary")) return;
    event.preventDefault();
    fly();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame(false);
  });

  window.addEventListener("fregat:view", () => {
    if (flight.hidden) pauseGame(false);
    else fitField();
  });
  if (!flight.hidden) fitField();
  new ResizeObserver(fitField).observe(flight);
})();
