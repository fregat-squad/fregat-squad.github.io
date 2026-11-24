(() => {
  const tick = 1 / 60;
  const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function flight(seed) {
    const random = seededRandom(seed);
    let elapsed = 0, score = 0, gateNumber = 0, over = false;
    const pilot = { y: 560 * .43, speed: -315, flapAt: 0 };
    const field = { height: 560 };
  function newGate(x, previousCenter) {
    const number = gateNumber++;
    const gap = Math.max(144, 201 - number * 2.1);
    const center = number === 0 ? field.height * .48 :
      clamp(previousCenter + (random() - .5) * 146, gap / 2 + 51, field.height - gap / 2 - 51);
    return { x, center, gap, moving: number >= 6 && number % 3 === 0, scored: false };
  }

  function gateCenter(gate) {
    return gate.center + (gate.moving ? Math.sin(elapsed * 1.7) * 25 : 0);
  }


    let gates = [newGate(272, pilot.y)];
    function step(flap) {
      if (over) return;
      if (flap) { pilot.speed = -315; pilot.flapAt = elapsed; }
      elapsed += tick;
      pilot.speed += 930 * tick;
      pilot.y += pilot.speed * tick;
      over = pilot.y + 18 >= 560 || pilot.y - 18 <= 0;
      if (over) return;
      const distance = Math.min(293, 170 + score * 4.5) * tick;
      for (const gate of gates) {
        gate.x -= distance;
        const center = gateCenter(gate);
        if (10 > gate.x && -10 < gate.x + 62 &&
            (pilot.y - 18 < center - gate.gap / 2 || pilot.y + 18 > center + gate.gap / 2)) {
          over = true;
          return;
        }
        if (!gate.scored && gate.x + 62 < -10) {
          gate.scored = true;
          score++;
        }
      }
      const tail = gates.at(-1);
      if (tail.x < 2200) gates.push(newGate(tail.x + 245, tail.center));
      if (gates[0].x < -280) gates.shift();
    }
    return { step, pilot, gateCenter, get gates(){ return gates; }, get elapsed(){return elapsed;},
      get score(){return score;}, get over(){return over;} };
  }

  function jump(seed, height) {
    const random = seededRandom(seed);
    const field = { width: 380, height };
    const player = { x: 190, y: 0, vx: 0, vy: -540, facing: 1 };
    let elapsed = 0, nextRow = 1, peak = 0, bonuses = 0, score = 0, fuel = 0, over = "";
    let camera = 66 - height;
    let platforms = [{ x: 190, y: 0, width: 114, travel: 0, item: "" }];
  function fillField() {
    while (platforms.at(-1).y > camera - 170) {
      const last = platforms.at(-1);
      const row = nextRow++;
      const difficulty = clamp((row - 3) / 27, 0, 1);
      const cactusPeriod = difficulty >= .52 ? 4 : 5;
      const item = row % 13 === 0 ? "rocket"
        : row % 6 === 0 ? "spring"
        : row > 4 && row % cactusPeriod === 0 ? "cactus"
        : row >= 13 && row % 5 === 2 ? "fragile" : "";
      const moving = !item && (difficulty >= .56 ? row % 2 === 1 : row >= 6 && row % 4 === 0);
      const travel = moving ? 15 + difficulty * 16 : 0;
      const width = Math.max(item === "cactus" ? 78 : 52, 100 - difficulty * 48);
      const margin = width / 2 + travel + 12;
      // Leave room for both platforms' travel within the distance of a normal jump.
      const reach = 84 + difficulty * 32 - last.travel - travel;
      const x = clamp(last.x + (random() * 2 - 1) * reach, margin, field.width - margin);
      const y = last.y - (70 + difficulty * 19 + random() * (19 + difficulty * 6));
      platforms.push({ x, y, width, item, travel, speed: 1.8 + difficulty * 1.8, phase: random() * Math.PI * 2,
        cactusSide: x >= last.x ? 1 : -1 });
    }
  }

  function xOf(platform) {
    return platform.x + (platform.travel ? Math.sin(elapsed * platform.speed + platform.phase) * platform.travel : 0);
  }

  function distanceAcrossField(a, b) {
    const distance = Math.abs(a - b);
    return Math.min(distance, field.width - distance);
  }


  function step(input) {
    if (over) return;
    const dt = tick;
    elapsed += dt;
    const direction = input / 100;
    if (direction) player.facing = Math.sign(direction);
    player.vx += (direction * 220 - player.vx) * Math.min(1, dt * 15);
    player.x = (player.x + player.vx * dt + field.width) % field.width;
    const wasY = player.y;
    fuel = Math.max(0, fuel - dt);
    player.vy = fuel > 0 ? -485 : player.vy + 1110 * dt;
    player.y += player.vy * dt;

    for (const platform of platforms) {
      if (platform.spentAt !== undefined) continue;
      const x = xOf(platform);
      const distance = distanceAcrossField(player.x, x);
      if (platform.item === "cactus" && fuel === 0 &&
          distanceAcrossField(player.x, x + platform.cactusSide * (platform.width / 2 - 13)) < 22 &&
          player.y > platform.y - 34 && player.y - 40 < platform.y) {
        over = "Кактус!";
        return;
      }
      if (platform.item === "rocket" && distance < 25 &&
          player.y > platform.y - 55 && player.y - 46 < platform.y - 11) {
        platform.item = "";
        fuel = 1.35;
        bonuses += 50;
        player.vy = -485;
      }
      if (player.vy <= 0 || distance > platform.width / 2 + 9) continue;
      const useSpring = platform.item === "spring" && distance < 27;
      const landing = platform.y - (useSpring ? 12 : 0);
      if (wasY <= landing && player.y >= landing) {
        player.y = landing;
        player.vy = useSpring ? -782 : -540;
        if (platform.item === "fragile") platform.spentAt = elapsed;
        if (useSpring) {
          platform.item = "";
          bonuses += 25;
        }
        break;
      }
    }

    peak = Math.max(peak, -player.y);
    const nextScore = Math.floor(peak / 10) + bonuses;
    score = nextScore;
    camera = Math.min(camera, player.y - field.height * .46);
    fillField();
    platforms = platforms.filter(platform => platform.y < camera + field.height + 100 &&
      (platform.spentAt === undefined || elapsed - platform.spentAt < .23));
    if (player.y > camera + field.height + 48) over = "Прыжок окончен";
  }


    fillField();
    return { step, player, xOf, get platforms(){return platforms;}, get camera(){return camera;},
      get fuel(){return fuel;}, get elapsed(){return elapsed;}, get score(){return score;}, get over(){return over;} };
  }
  const rules = { flight, jump, tick, maxTicks: 60 * 60 * 2 * 60 };
  if (typeof module !== "undefined" && module.exports) module.exports = rules;
  else window.fregatRunRules = rules;
})();
