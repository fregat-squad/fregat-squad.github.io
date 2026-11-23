const deck = document.querySelector(".deck");
const cards = [...deck.querySelectorAll(".card")];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const dotWave = document.querySelector(".dot-wave");
const dotLight = document.querySelector(".dot-light");
const dotContext = dotWave.getContext("2d");
const equalizer = document.querySelector("#equalizer");
const equalizerContext = equalizer.getContext("2d");
let dotSize;
let dotFrame = 0;
let lastDotPaint = -Infinity;
let wavePhase = 0;

document.addEventListener("pointermove", event => {
  if (event.pointerType !== "mouse" || reducedMotion.matches) return;
  dotLight.style.setProperty("--light-x", event.clientX + "px");
  dotLight.style.setProperty("--light-y", event.clientY + "px");
  dotLight.setAttribute("data-visible", "");
}, { passive: true });
document.documentElement.addEventListener("pointerleave", () => dotLight.removeAttribute("data-visible"));

function fitCanvas(canvas, context) {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height };
}

function drawDotWave() {
  const { width, height } = dotSize;
  const step = Math.max(width < 680 ? 8 : 11, Math.sqrt(width * height / 14000));
  const layers = Array.from({ length: 12 }, () => new Path2D());
  dotContext.clearRect(0, 0, width, height);
  for (let x = 0; x <= width + step; x += step) {
    const column = x / Math.max(width, 1);
    for (let row = -60; row < height + 60; row += step) {
      const phase = column * 9 + row * .012 - wavePhase;
      const y = row + 26 * Math.sin(phase) + 11 * Math.cos(phase * .64);
      const crest = Math.pow(.5 + .5 * Math.sin(phase - 1), 2.6);
      const depth = .22 + .78 * Math.abs(y / Math.max(height, 1) - .45) * 1.65;
      const radius = step * (.065 + .36 * crest * depth);
      const layer = layers[Math.min(layers.length - 1, Math.round(crest * depth * (layers.length - 1)))];
      layer.moveTo(x + radius, y);
      layer.arc(x, y, radius, 0, 2 * Math.PI);
    }
  }
  layers.forEach((layer, index) => {
    dotContext.fillStyle = "rgba(28, 31, 35, " + (.12 + .57 * index / (layers.length - 1)) + ")";
    dotContext.fill(layer);
  });
}

function animateDotWave(timestamp) {
  if (timestamp - lastDotPaint >= 32) {
    if (Number.isFinite(lastDotPaint)) wavePhase += Math.min(timestamp - lastDotPaint, 64) * .00165;
    lastDotPaint = timestamp;
    drawDotWave();
  }
  dotFrame = requestAnimationFrame(animateDotWave);
}

function syncDotMotion() {
  cancelAnimationFrame(dotFrame);
  lastDotPaint = -Infinity;
  if (!reducedMotion.matches) dotFrame = requestAnimationFrame(animateDotWave);
}

let rotating = false;

async function rotateDeck() {
  if (rotating) return;
  rotating = true;
  const outgoing = cards.shift();

  if (!reducedMotion.matches) {
    await outgoing.animate([
      { transform: "translateX(0) rotate(0)" },
      { transform: "translateX(-35%) rotate(-16deg) scale(.94)", opacity: 0 }
    ], { duration: 110, easing: "ease-in", fill: "forwards" }).finished;
  }

  cards.push(outgoing);
  cards.forEach((card, depth) => {
    card.dataset.depth = depth;
    if (depth === 0) card.removeAttribute("aria-hidden");
    else card.setAttribute("aria-hidden", "true");
  });
  outgoing.getAnimations().forEach(animation => animation.cancel());
  if (!reducedMotion.matches) {
    outgoing.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 175 });
  }
  rotating = false;
}

const deckHome = deck.closest(".hero");
let deckTimer;
function scheduleDeck() {
  clearTimeout(deckTimer);
  if (!reducedMotion.matches && !document.hidden && !deckHome.hidden) {
    deckTimer = setTimeout(advanceDeck, 2750);
  }
}
function advanceDeck() {
  rotateDeck();
  scheduleDeck();
}
deck.addEventListener("click", advanceDeck);
document.addEventListener("visibilitychange", scheduleDeck);
window.addEventListener("fregat:view", scheduleDeck);
reducedMotion.addEventListener("change", scheduleDeck);
scheduleDeck();

const audio = document.querySelector("#audio");
const playlist = document.querySelector("#playlist");
const tracks = [...playlist.querySelectorAll("button")];
const trackToggle = document.querySelector("#track-toggle");
const trackTitle = document.querySelector("#track-title");
const playButton = document.querySelector("#play");
const soundToggle = document.querySelector("#sound-toggle");
const soundPanel = document.querySelector("#sound-panel");
const volume = document.querySelector("#volume");
const volumeValue = document.querySelector("#volume-value");
const status = document.querySelector("#player-status");
const seek = document.querySelector("#seek");
const elapsed = document.querySelector("#elapsed");
const duration = document.querySelector("#duration");
const soundCloudHost = document.querySelector("#soundcloud-host");
let waitingForClick = false;
let playRequest = 0;
let currentTrack = 0;
let openPanel = null;
let cloudPlayer = null;
const cloudState = { playing: false, position: 0, duration: 0 };
function updateMusicVolume() {
  audio.volume = Number(volume.value) / 100;
  cloudPlayer?.setVolume(Number(volume.value));
  volumeValue.value = volume.value + "%";
  volume.style.setProperty("--position", volumeValue.value);
  soundToggle.toggleAttribute("data-muted", audio.volume === 0);
}

updateMusicVolume();
const bandCount = 14;
const framesPerSecond = 15;
let waveform = "";
let equalizerFrame = 0;
let equalizerSize;
let equalizerPlaying = false;
let equalizerTint = 0;
let equalizerMusicMix = 0;
let lastEqualizerPaint = -Infinity;
const bandLevels = new Float32Array(bandCount);

function loadSpectrum() {
  // Read measured frequency bands by position so seeking and file:// playback stay in sync.
  waveform = atob(trackSpectra[tracks[currentTrack].dataset.file] || "");
}

function drawEqualizer(timestamp, delta = 0) {
  const { width, height } = equalizerSize;
  const active = equalizerPlaying && waveform.length >= bandCount;
  const targetMix = active ? 1 : 0;
  equalizerMusicMix += (targetMix - equalizerMusicMix) * (1 - Math.exp(-delta / (active ? 160 : 240)));
  const frame = Math.min(Math.max(0, audio.currentTime) * framesPerSecond, waveform.length / bandCount - 1);
  const frameIndex = Math.floor(frame);
  const nextFrameIndex = Math.min(frameIndex + 1, waveform.length / bandCount - 1);
  const frameMix = frame - frameIndex;
  const barCount = Math.max(2, Math.round(width / (width < 550 ? 6 : 10)));
  const step = (width + 3) / barCount;
  const barWidth = step - 3;
  equalizerContext.clearRect(0, 0, width, height);

  if (active) {
    for (let band = 0; band < bandCount; band++) {
      const current = waveform.charCodeAt(frameIndex * bandCount + band);
      const next = waveform.charCodeAt(nextFrameIndex * bandCount + band);
      bandLevels[band] = (current + (next - current) * frameMix) / 255;
    }
  }

  const treble = active ? (bandLevels[10] + bandLevels[11] + bandLevels[12] + bandLevels[13]) / 4 : 0;
  const targetTint = Math.min(1, Math.max(0, (treble - .54) / .38));
  const fadeTime = targetTint > equalizerTint ? 95 : 270;
  equalizerTint += (targetTint - equalizerTint) * (1 - Math.exp(-delta / fadeTime));

  const bars = new Path2D();
  const glints = new Path2D();
  const phase = reducedMotion.matches ? 0 : timestamp / 1000;
  for (let i = 0; i < barCount; i++) {
    const position = i / (barCount - 1);
    const contour = .5 + .5 * Math.cos((position - .12) * Math.PI * 5);
    const texture = .88 + .12 * Math.cos(i * .66);
    const sweep = .5 + .5 * Math.cos(position * Math.PI * 6 - phase * 2.4);
    const swell = .5 + .5 * Math.cos(position * Math.PI * 3 + phase * 1.4);
    const idle = (.09 + .22 * sweep + .14 * swell) * texture;
    const frequency = (1 - contour) * (bandCount - 1);
    const low = Math.floor(frequency);
    const high = Math.min(low + 1, bandCount - 1);
    const energy = bandLevels[low] + (bandLevels[high] - bandLevels[low]) * (frequency - low);
    const music = (.08 + .12 * contour + .8 * energy) * texture;
    const strength = idle + (music - idle) * equalizerMusicMix;
    const barHeight = 8 + Math.pow(strength, 1.12) * (height - 8);
    const x = i * step;
    const y = height - barHeight;
    bars.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0]);
    glints.moveTo(x + barWidth * .32, y + 3);
    glints.lineTo(x + barWidth * .32, y + barHeight * .72);
  }

  const hue = 203 + 32 * equalizerTint;
  const saturation = 9 + 53 * equalizerTint;
  const glass = equalizerContext.createLinearGradient(0, 0, 0, height);
  glass.addColorStop(0, "#ffffffbf");
  glass.addColorStop(.25, `hsla(${hue}, ${saturation}%, 82%, .46)`);
  glass.addColorStop(.65, `hsla(${hue}, ${saturation}%, 55%, ${.22 + equalizerTint * .18})`);
  glass.addColorStop(1, `hsla(${hue}, ${saturation}%, 73%, .47)`);
  equalizerContext.fillStyle = glass;
  equalizerContext.fill(bars);
  equalizerContext.lineWidth = .85;
  equalizerContext.strokeStyle = `hsla(${hue}, ${saturation}%, 40%, .48)`;
  equalizerContext.stroke(bars);
  equalizerContext.lineWidth = .85;
  equalizerContext.strokeStyle = "#ffffffa8";
  equalizerContext.stroke(glints);
}

function animateEqualizer(timestamp) {
  equalizerFrame = 0;
  const delta = timestamp - lastEqualizerPaint;
  if (delta >= (reducedMotion.matches ? 150 : equalizerPlaying ? 16 : 32)) {
    drawEqualizer(timestamp, Math.min(delta, 150));
    lastEqualizerPaint = timestamp;
  }
  syncEqualizerMotion();
}

function syncEqualizerMotion() {
  const visible = !document.hidden && !document.body.classList.contains("arcade");
  const moving = !reducedMotion.matches || equalizerPlaying || equalizerMusicMix > .008 || equalizerTint > .008;
  if (visible && moving && !equalizerFrame) {
    equalizerFrame = requestAnimationFrame(animateEqualizer);
  } else if ((!visible || !moving) && equalizerFrame) {
    cancelAnimationFrame(equalizerFrame);
    equalizerFrame = 0;
  }
  if (visible && !moving) drawEqualizer(performance.now());
}

function stopEqualizer() {
  equalizerPlaying = false;
  syncEqualizerMotion();
}

function resizeArtwork() {
  dotSize = fitCanvas(dotWave, dotContext);
  drawDotWave();
  equalizerSize = fitCanvas(equalizer, equalizerContext);
  drawEqualizer(performance.now());
}

loadSpectrum();
resizeArtwork();
syncDotMotion();
syncEqualizerMotion();
reducedMotion.addEventListener("change", syncDotMotion);
reducedMotion.addEventListener("change", syncEqualizerMotion);
window.addEventListener("resize", resizeArtwork);
window.addEventListener("fregat:view", syncEqualizerMotion);
document.addEventListener("visibilitychange", syncEqualizerMotion);
audio.addEventListener("playing", () => {
  equalizerPlaying = true;
  syncEqualizerMotion();
});
["pause", "ended", "waiting", "emptied"].forEach(event => audio.addEventListener(event, stopEqualizer));

function closePanel(restoreFocus = false) {
  if (!openPanel) return;
  const { toggle, panel } = openPanel;
  if (restoreFocus) toggle.focus();
  toggle.setAttribute("aria-expanded", "false");
  panel.inert = true;
  openPanel = null;
}

function bindPanel(toggle, panel) {
  toggle.addEventListener("click", () => {
    const wasOpen = openPanel?.panel === panel;
    closePanel();
    if (wasOpen) return;
    openPanel = { toggle, panel };
    panel.inert = false;
    toggle.setAttribute("aria-expanded", "true");
  });
}

bindPanel(trackToggle, playlist);
bindPanel(soundToggle, soundPanel);

document.addEventListener("click", event => {
  if (openPanel && !openPanel.panel.contains(event.target) && !openPanel.toggle.contains(event.target)) closePanel();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && openPanel) {
    event.preventDefault();
    closePanel(true);
  }
});

volume.addEventListener("input", () => {
  updateMusicVolume();
  if (waitingForClick && audio.volume > 0) playTrack();
});

async function playTrack() {
  const request = ++playRequest;
  waitingForClick = false;
  try {
    await audio.play();
  } catch (error) {
    if (request !== playRequest) return;
    if (error.name === "NotAllowedError") {
      waitingForClick = true;
      status.textContent = "Нажми, чтобы слушать";
    } else if (error.name !== "AbortError") {
      status.textContent = "Трек недоступен";
    }
  }
}

function changeTrack(index) {
  cloudPlayer?.close();
  cloudPlayer = null;
  soundCloudHost.hidden = true;
  tracks[currentTrack].removeAttribute("aria-current");
  currentTrack = (index + tracks.length) % tracks.length;
  const selected = tracks[currentTrack];
  selected.setAttribute("aria-current", "true");
  trackTitle.textContent = selected.textContent;
  loadSpectrum();
  if (selected.dataset.soundcloud) {
    playRequest++;
    waitingForClick = false;
    audio.pause();
    stopEqualizer();
    Object.assign(cloudState, { playing: false, position: 0, duration: 0 });
    status.textContent = "Загрузка SoundCloud";
    soundCloudHost.hidden = false;
    cloudPlayer = window.openSoundCloudTrack(soundCloudHost, selected.dataset.soundcloud, {
      volume: Number(volume.value),
      playing: () => cloudState.playing,
      play() { cloudState.playing = true; status.textContent = ""; updatePlaying(); },
      pause() { cloudState.playing = false; updatePlaying(); },
      finish() { changeTrack(currentTrack + 1); },
      position(seconds) { cloudState.position = seconds; updateTimeline(); },
      duration(seconds) { cloudState.duration = seconds; updateTimeline(); },
      error() { cloudState.playing = false; status.textContent = "SoundCloud недоступен"; updatePlaying(); }
    });
  } else {
    audio.src = "media/music/" + selected.dataset.file;
    playTrack();
  }
  updateTimeline();
  updatePlaying();
}

function updatePlaying() {
  const playing = cloudPlayer ? cloudState.playing : !audio.paused && !audio.ended;
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Пауза" : "Воспроизвести");
}

function formatTime(value) {
  const total = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function updateTimeline() {
  const length = cloudPlayer ? cloudState.duration : audio.duration;
  const position = cloudPlayer ? cloudState.position : audio.currentTime;
  const canSeek = Number.isFinite(length) && length > 0;
  seek.disabled = !canSeek;
  seek.value = canSeek ? position / length * 1000 : 0;
  seek.style.setProperty("--position", Number(seek.value) / 10 + "%");
  elapsed.textContent = formatTime(position);
  duration.textContent = formatTime(length);
}

playButton.addEventListener("click", () => {
  if (cloudPlayer?.failed) changeTrack(currentTrack);
  else if (cloudPlayer) cloudPlayer.toggle();
  else if (audio.paused) playTrack();
  else {
    playRequest++;
    waitingForClick = false;
    audio.pause();
  }
});
document.querySelector("#previous").addEventListener("click", () => changeTrack(currentTrack - 1));
document.querySelector("#next").addEventListener("click", () => changeTrack(currentTrack + 1));
tracks.forEach((track, index) => {
  track.addEventListener("click", () => {
    closePanel(true);
    if (index !== currentTrack) changeTrack(index);
    else if (cloudPlayer?.failed) changeTrack(index);
    else if (cloudPlayer && !cloudState.playing) cloudPlayer.toggle();
    else if (!cloudPlayer && audio.paused) playTrack();
  });
});
audio.addEventListener("ended", () => { if (!cloudPlayer) changeTrack(currentTrack + 1); });
audio.addEventListener("play", () => {
  if (cloudPlayer) return;
  waitingForClick = false;
  status.textContent = "";
  updatePlaying();
});
audio.addEventListener("pause", updatePlaying);
audio.addEventListener("error", () => { if (!cloudPlayer) status.textContent = "Трек недоступен"; });
["timeupdate", "durationchange", "emptied"].forEach(event => audio.addEventListener(event, updateTimeline));
seek.addEventListener("input", () => {
  if (seek.disabled) return;
  const fraction = Number(seek.value) / 1000;
  if (cloudPlayer) cloudPlayer.seek(fraction * cloudState.duration);
  else audio.currentTime = fraction * audio.duration;
});
document.addEventListener("click", event => {
  if (waitingForClick && !event.target.closest(".player, a")) playTrack();
});

playTrack();

const bottleButton = document.querySelector(".bottle-button");
const bottleLayer = document.querySelector(".bottle-layer");
const bottleTemplate = document.querySelector("#bottle-template");

function animateBottle(index, viewport) {
  const bottle = bottleTemplate.content.firstElementChild.cloneNode(true);
  const size = Math.min(58, Math.max(24, viewport.width / 14)) * (.86 + Math.random() * .27);
  const length = size * 409 / 128;
  const padding = Math.min(length / 2, viewport.width / 6);
  const origin = padding + Math.random() * (viewport.width - 2 * padding);
  const drift = (Math.random() * 2 - 1) * Math.min(viewport.width * .14, 142);
  const angle = (Math.random() * 2 - 1) * 78;
  const direction = Math.random() < .5 ? -1 : 1;
  const contactAngle = angle + direction * (30 + Math.random() * 85);
  const apexAngle = contactAngle + direction * (25 + Math.random() * 38);
  const bounceHeight = viewport.height * (.35 + Math.random() * .08);
  const floor = viewport.height - 12;
  const dropDuration = Math.min(1800, Math.max(960, 1310 * Math.sqrt(viewport.height / 760))) + Math.random() * 260;
  const riseDuration = 560 + Math.random() * 180;
  const delay = Math.random() * 460;
  const fall = "cubic-bezier(.46,.04,.81,.62)";
  const rise = "cubic-bezier(.16,.48,.55,1)";

  function driftX(distance) {
    return Math.max(padding, Math.min(viewport.width - padding, origin + drift * distance));
  }

  function touchY(rotation) {
    const radians = rotation * Math.PI / 180;
    return floor - (length * Math.abs(Math.cos(radians)) + size * Math.abs(Math.sin(radians))) / 2;
  }

  function at(x, y, rotation, opacity = 1, easing = "linear") {
    return {
      transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${rotation}deg)`,
      visibility: "visible",
      opacity,
      easing
    };
  }

  bottle.style.width = size + "px";
  bottleLayer.append(bottle);

  const secondImpactAngle = apexAngle + direction * 21;
  const landingTime = dropDuration + riseDuration * 2;
  const trajectory = [
    { time: 0, ...at(origin, -length / 2 - 24 - Math.random() * viewport.height * .07, angle, 1, fall) },
    { time: dropDuration, ...at(driftX(1), touchY(contactAngle), contactAngle, 1, rise) },
    { time: dropDuration + riseDuration, ...at(driftX(1.45), touchY(apexAngle) - bounceHeight, apexAngle, 1, fall) }
  ];
  if (index % 2 === 0) {
    trajectory.push(
      { time: landingTime, ...at(driftX(1.9), touchY(secondImpactAngle), secondImpactAngle) },
      { time: landingTime + 75, ...at(driftX(1.98), touchY(secondImpactAngle) + 3, secondImpactAngle + direction * 6, 1, fall) }
    );
  }
  const duration = landingTime + (index % 2 === 0 ? 380 : 220);
  trajectory.push({ time: duration, ...at(driftX(2.18), viewport.height + length / 2 + 20, secondImpactAngle + direction * 24, .3) });

  const animation = reducedMotion.matches
    ? bottle.animate([at(origin, touchY(angle), angle, 0), at(origin, touchY(angle), angle), at(origin, touchY(angle), angle, 0)], { duration: 320, delay })
    : bottle.animate(trajectory.map(({ time, ...frame }) => ({ ...frame, offset: time / duration })), { duration, delay });
  animation.finished.then(() => bottle.remove(), () => bottle.remove());
}

bottleButton.addEventListener("click", () => {
  const viewport = { width: bottleLayer.clientWidth, height: bottleLayer.clientHeight };
  const count = 8;
  for (let index = 0; index < count; index++) animateBottle(index, viewport);
});
