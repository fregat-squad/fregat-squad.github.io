(() => {
  const view = document.querySelector(".durak");
  const get = id => view.querySelector("#durak-" + id);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const sameHost = local || location.hostname.endsWith(".netlify.app");
  const endpoint = sameHost ? "/.netlify/functions/durak" : view.dataset.multiplayerUrl;
  const lobby = get("lobby");
  const search = get("search");
  const match = get("match");
  const nickname = get("nickname");
  const notice = get("notice");
  const hand = get("hand");
  const center = get("center");
  const take = get("take");
  const done = get("done");
  const leave = get("leave");
  const retry = get("retry");
  const rankNames = ["6", "7", "8", "9", "10", "В", "Д", "К", "Т"];
  const rankFiles = ["06", "07", "08", "09", "10", "J", "Q", "K", "A"];
  const suitFiles = ["spades", "hearts", "diamonds", "clubs"];
  const suits = ["♠", "♥", "♦", "♣"];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let state = { phase: "lobby" };
  let signature = "";
  let busy = false;
  let pending;
  let timer;
  let token;

  function session() {
    try {
      const saved = sessionStorage.getItem("fregat-durak-session");
      if (saved) return saved;
      const fresh = crypto.randomUUID();
      sessionStorage.setItem("fregat-durak-session", fresh);
      return fresh;
    } catch {
      return crypto.randomUUID();
    }
  }

  function picture(card, playable = false, button = false) {
    const type = button ? "button" : "div";
    const element = document.createElement(type);
    element.className = "durak-card";
    element.dataset.card = card;
    const img = document.createElement("img");
    const suit = Math.floor(card / 9);
    const rank = card % 9;
    const label = rankNames[rank] + suits[suit];
    img.src = "media/durak/" + suitFiles[suit] + "-" + rankFiles[rank] + ".png";
    img.alt = button ? "" : label;
    img.width = 480;
    img.height = 672;
    element.append(img);
    if (button) {
      element.type = "button";
      element.disabled = !playable;
      element.setAttribute("aria-label", label);
      element.addEventListener("click", () => request("card", { card }));
    }
    return element;
  }

  function animateCard(node, dx, dy, delay = 0) {
    if (view.hidden || reducedMotion.matches) return;
    node.animate([
      { translate: dx + "px " + dy + "px", rotate: "-6deg", opacity: .35 },
      { translate: "0 0", rotate: "0deg", opacity: 1 }
    ], { duration: 320, delay, easing: "cubic-bezier(.18,.75,.24,1)", fill: "backwards" });
  }

  function updateCards() {
    const previousHand = new Map(Array.from(hand.children, el => [Number(el.dataset.card), el]));
    const previousTable = new Set(Array.from(center.querySelectorAll("[data-card]"), el => Number(el.dataset.card)));
    const allowed = new Set(state.legal.moves.map(move => move.card));
    const origins = new Map();
    for (const [id, node] of previousHand) {
      if (!state.hand.includes(id)) {
        origins.set(id, node.getBoundingClientRect());
        node.remove();
      }
    }
    state.hand.forEach((id, index) => {
      const existing = previousHand.get(id);
      if (existing) existing.disabled = !allowed.has(id);
      else {
        const node = picture(id, allowed.has(id), true);
        hand.insertBefore(node, hand.children[index] || null);
        animateCard(node, 15, 25, previousHand.size ? 0 : Math.min(index, 6) * 35);
      }
    });
    center.replaceChildren(...state.table.map(({ attack, defense }) => {
      const pair = document.createElement("div");
      pair.className = "durak-pair";
      pair.append(picture(attack));
      if (defense !== null) pair.append(picture(defense));
      return pair;
    }));
    for (const node of center.querySelectorAll("[data-card]")) {
      const id = Number(node.dataset.card);
      if (previousTable.has(id)) continue;
      const from = origins.get(id);
      const to = node.getBoundingClientRect();
      animateCard(node, from ? from.left - to.left : 0, from ? from.top - to.top : -60);
    }
  }

  function render(force = false) {
    const nextSignature = JSON.stringify(state);
    if (!force && signature === nextSignature) return;
    signature = nextSignature;
    const playing = state.phase === "match";
    view.dataset.phase = state.phase;
    lobby.hidden = state.phase !== "lobby";
    search.hidden = state.phase !== "search";
    match.hidden = !playing;
    get("table-actions").hidden = !playing;
    get("deck").hidden = !playing;
    get("opponent-hand").replaceChildren();
    get("opponent").textContent = "Соперник";
    get("player-name").textContent = "Твои карты";
    if (!playing) {
      hand.replaceChildren();
      center.replaceChildren();
      return;
    }

    get("opponent").textContent = state.opponent + " · карт: " + state.opponentCards;
    view.querySelector(".durak-person b").textContent = Array.from(state.opponent)[0]?.toUpperCase() || "С";
    get("opponent-hand").replaceChildren(...Array.from({ length: Math.min(10, state.opponentCards) }, () => document.createElement("span")));
    get("player-name").textContent = "Твои карты · " + state.hand.length;
    get("deck-count").textContent = state.deckCount;
    get("trump").textContent = suits[Math.floor(state.trump / 9)];
    get("trump").classList.toggle("durak-red", [1, 2].includes(Math.floor(state.trump / 9)));
    updateCards();
    take.hidden = !state.legal.take;
    done.hidden = !state.legal.done;
    leave.hidden = Boolean(state.result);
    retry.hidden = !state.result;

    const result = state.result?.outcome;
    view.toggleAttribute("data-your-turn", state.yourTurn);
    get("match-title").textContent = result === "win" ? "Ты выиграл!" : result === "loss" ? "Ты проиграл" : result === "draw" ? "Ничья" : state.yourTurn ? "Твой ход" : "Ход соперника";
    get("table-status").textContent = result
      ? { leave: result === "win" ? "Соперник сдался." : "Ты сдался.", disconnect: "Соперник потерял связь.", complete: "Партия окончена." }[state.result.reason]
      : state.opponentAway ? "Ждём возвращения соперника."
      : !state.yourTurn ? (state.role === "attack" ? "Соперник отбивается." : "Соперник выбирает ход.")
      : state.role === "defend" ? (state.legal.moves.length ? "Отбей картой старше той же масти или козырем." : "Отбиться нечем. Нажми «Взять карты».")
      : state.table.length ? (state.legal.moves.length ? "Подкинь карту того же достоинства или нажми «Бито»." : "Всё отбито. Нажми «Бито».") : "Выбери любую карту для атаки.";
  }

  async function request(action, extra = {}) {
    if (!endpoint) return;
    if (busy) {
      if (action !== "state") pending = [action, extra];
      return;
    }
    busy = true;
    clearTimeout(timer);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token: token ??= session(), version: state.version, ...extra }),
        signal: AbortSignal.timeout(9000)
      });
      const data = await response.json();
      if (!response.ok) {
        notice.textContent = data.error;
        return;
      }
      if (action !== "state" || notice.dataset.network) notice.textContent = "";
      delete notice.dataset.network;
      state = data;
      render();
    } catch {
      notice.dataset.network = "1";
      notice.textContent = "Связь с сервером потеряна. Пробуем подключиться снова.";
    } finally {
      busy = false;
      if (pending) {
        const next = pending;
        pending = null;
        request(...next);
      } else if (state.phase === "search" || (state.phase === "match" && !state.result) || notice.dataset.network) {
        timer = setTimeout(() => request("state"), 1800);
      }
    }
  }

  lobby.addEventListener("submit", event => {
    event.preventDefault();
    const name = nickname.value.trim();
    if (!name) {
      nickname.setCustomValidity("Введи ник.");
      nickname.reportValidity();
      return;
    }
    request("join", { name });
  });
  nickname.addEventListener("input", () => nickname.setCustomValidity(""));
  get("cancel-search").addEventListener("click", () => request("cancel"));
  take.addEventListener("click", () => request("take"));
  done.addEventListener("click", () => request("done"));
  leave.addEventListener("click", () => request("leave"));
  retry.addEventListener("click", () => request("join", { name: state.name }));

  function checkConnection() {
    if (view.hidden || state.phase !== "lobby" || !endpoint) return;
    request("state");
  }

  if (!endpoint) {
    lobby.querySelector("button").disabled = true;
    notice.textContent = location.protocol === "file:"
      ? "Открой эту страницу через локальный сервер или сайт."
      : "Сервер матчей ещё не подключён к сайту.";
  }
  render();
  checkConnection();
  window.addEventListener("fregat:view", checkConnection);
})();
