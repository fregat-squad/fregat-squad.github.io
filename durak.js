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

  function render(force = false) {
    const nextSignature = JSON.stringify(state);
    if (!force && signature === nextSignature) return;
    signature = nextSignature;
    const playing = state.phase === "match";
    lobby.hidden = state.phase !== "lobby";
    search.hidden = state.phase !== "search";
    match.hidden = !playing;
    get("table-actions").hidden = !playing;
    get("deck").hidden = !playing;
    hand.replaceChildren();
    center.replaceChildren();
    get("opponent-hand").replaceChildren();
    get("opponent").textContent = "Соперник";
    get("player-name").textContent = "Твои карты";
    if (!playing) {
      get("table-status").textContent = state.phase === "search" ? "Идёт поиск соперника." : "Найди соперника, чтобы начать матч.";
      return;
    }

    get("opponent").textContent = state.opponent + " · " + state.opponentCards;
    get("opponent-hand").replaceChildren(...Array.from({ length: Math.min(10, state.opponentCards) }, () => document.createElement("span")));
    get("player-name").textContent = state.name + (state.role === "attack" ? " · атакующий" : " · защищающийся");
    get("deck-count").textContent = state.deckCount;
    get("trump").textContent = suits[Math.floor(state.trump / 9)];
    get("trump").classList.toggle("durak-red", [1, 2].includes(Math.floor(state.trump / 9)));
    const allowed = new Set(state.legal.moves.map(move => move.card));
    hand.replaceChildren(...state.hand.map(card => picture(card, allowed.has(card), true)));
    center.replaceChildren(...state.table.map(({ attack, defense }) => {
      const pair = document.createElement("div");
      pair.className = "durak-pair";
      pair.append(picture(attack));
      if (defense !== null) pair.append(picture(defense));
      return pair;
    }));
    take.hidden = !state.legal.take;
    done.hidden = !state.legal.done;
    leave.hidden = Boolean(state.result);
    retry.hidden = !state.result;

    const result = state.result?.outcome;
    get("match-title").textContent = result === "win" ? "Победа" : result === "loss" ? "Поражение" : result === "draw" ? "Ничья" : "Матч 1 на 1";
    get("table-status").textContent = result
      ? { leave: "Матч завершён сдачей.", disconnect: "Соперник потерял связь.", complete: "Партия окончена." }[state.result.reason]
      : state.opponentAway ? "Ждём возвращения соперника."
      : !state.yourTurn ? "Ход соперника."
      : state.role === "defend" ? "Отбей карту или возьми карты со стола."
      : state.table.length ? "Подкинь карту того же номинала или нажми «Бито»." : "Твой ход. Выбери карту для атаки.";
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
