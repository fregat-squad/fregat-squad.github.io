(() => {
  const views = Array.from(document.querySelectorAll("[data-game-view]"));
  const home = document.querySelector(".hero");
  const homeLink = document.querySelector(".arcade-home");
  const links = document.querySelectorAll('.game-nav a[href^="#"]');
  let active = null;

  function showView() {
    const fragment = location.hash.slice(1);
    const route = fragment.startsWith("dossiers/") ? "dossiers" : fragment;
    const mazeOpen = route === "night-maze";
    const next = views.find(view => view.dataset.gameView === route) ?? null;
    if (next === active) return;
    active = next;
    const mazeView = document.querySelector(".maze-view");
    document.body.classList.toggle("in-maze", mazeOpen);
    document.body.classList.remove("maze-expanded");
    if (mazeOpen) {
      document.querySelector("#play[data-playing]")?.click();
      const frame = document.createElement("iframe");
      frame.title = "Ночной лабиринт";
      frame.allowFullscreen = true;
      frame.src = "games/night-maze/index.html";
      mazeView.replaceChildren(frame);
    } else {
      mazeView.replaceChildren();
    }
    for (const view of views) view.hidden = view !== active;
    for (const link of links) {
      if (active && link.hash === location.hash) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.body.classList.toggle("arcade", Boolean(active));
    home.hidden = Boolean(active);
    if (active) homeLink.removeAttribute("aria-current");
    else homeLink.setAttribute("aria-current", "page");
    document.title = active ? active.dataset.gameTitle + " · FREGAT SQUAD" : "FREGAT SQUAD";
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event("fregat:view"));
  }

  function leaderboard({ entry, board, status, action, key, game, minimum }) {
    const nickname = entry.querySelector("input");
    const submit = entry.querySelector("button");
    const compact = matchMedia("(max-width: 680px)");
    const table = board.querySelector("table");
    const scroll = table.parentElement;
    const empty = board.querySelector("p");
    const fullList = board.querySelector("[data-leaders-more]");
    const importButton = board.querySelector("[data-leaders-import]");
    const feedback = board.querySelector("[data-leaders-feedback]");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    const server = document.body.dataset.leaderboardUrl;
    const endpoint = (local ? "/.netlify/functions/leaderboard" : server) + "?game=" + game;
    let pending = null;
    let leaders = [];
    let saved = [];
    let expanded = false;
    let writing = false;
    let requestNumber = 0;
    try {
      const previous = JSON.parse(localStorage.getItem(key));
      if (!localStorage.getItem(key + "-imported") && Array.isArray(previous)) {
        saved = previous.filter(item => item && typeof item.name === "string" &&
          item.name.trim() && item.name.length <= 20 && !/[\p{Cc}\p{Cf}]/u.test(item.name) &&
          Number.isSafeInteger(item.score) && item.score >= minimum);
      }
    } catch {}
    importButton.hidden = saved.length === 0;

    function render() {
      const rows = leaders.slice(0, expanded ? leaders.length : 10).map(({ name, score, imported }, index) => {
        const row = document.createElement("tr");
        [index + 1, imported ? name + " *" : name, score].forEach(value => { row.insertCell().textContent = value; });
        row.cells[1].title = imported ? name + " · Импортированный рекорд" : name;
        return row;
      });
      const fragment = document.createDocumentFragment();
      for (const row of rows) fragment.append(row);
      table.tBodies[0].replaceChildren(fragment);
      table.hidden = rows.length === 0;
      scroll.hidden = table.hidden;
      empty.hidden = rows.length > 0;
      fullList.hidden = leaders.length <= 10;
      fullList.textContent = expanded ? "Показать топ-10" : "Все рекорды (" + leaders.length + ")";
      fullList.setAttribute("aria-expanded", String(expanded));
    }

    async function request(body) {
      const response = await fetch(endpoint, body ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      } : {});
      if (!response.ok) throw new Error("Leaderboard unavailable");
      return response.json();
    }

    async function refresh() {
      if (board.closest("[data-game-view]").hidden || !board.open || writing) return;
      const id = ++requestNumber;
      try {
        const result = await request();
        if (id !== requestNumber) return;
        leaders = result.leaders;
        feedback.textContent = leaders.some(item => item.imported) ? "* Импортированный рекорд" : "";
        render();
      } catch {
        if (id === requestNumber) feedback.textContent = "Таблица пока недоступна.";
      }
    }

    function offer(score) {
      pending = score >= minimum ? score : null;
      entry.reset();
      nickname.setCustomValidity("");
      entry.hidden = pending === null;
      return pending !== null;
    }

    async function publish(body) {
      writing = true;
      requestNumber++;
      submit.disabled = importButton.disabled = true;
      try {
        const result = await request(body);
        leaders = result.leaders;
        feedback.textContent = leaders.some(item => item.imported) ? "* Импортированный рекорд" : "";
        render();
        return result;
      } finally {
        writing = false;
        submit.disabled = importButton.disabled = false;
      }
    }

    entry.addEventListener("submit", async event => {
      event.preventDefault();
      if (pending === null || writing) return;
      const name = nickname.value.trim().replace(/\s+/g, " ");
      if (!name || /[\p{Cc}\p{Cf}]/u.test(name)) {
        nickname.setCustomValidity("Проверь никнейм.");
        nickname.reportValidity();
        return;
      }
      const score = pending;
      try {
        const result = await publish({ name, score });
        if (pending !== score) return;
        status.textContent = result.changed ? "Результат в общей таблице." : "У этого ника уже есть такой же или лучший результат.";
      } catch {
        if (pending === score) status.textContent = "Запись не удалась. Попробуй ещё раз.";
        return;
      }
      offer(0);
      board.open = true;
      action.textContent = "Попробовать снова";
      action.focus({ preventScroll: true });
    });

    fullList.addEventListener("click", () => {
      expanded = !expanded;
      render();
      scroll.scrollTop = 0;
      refresh();
    });
    importButton.addEventListener("click", async () => {
      if (writing) return;
      try {
        while (saved.length) {
          await publish({ imported: true, entries: saved.slice(0, 100) });
          saved = saved.slice(100);
        }
        importButton.hidden = true;
        try { localStorage.setItem(key + "-imported", "1"); } catch {}
      } catch {
        feedback.textContent = "Перенос не завершён. Попробуй ещё раз.";
      }
    });
    nickname.addEventListener("input", () => nickname.setCustomValidity(""));
    board.open = !compact.matches;
    compact.addEventListener("change", () => { board.open = !compact.matches; });
    board.addEventListener("toggle", refresh);
    window.addEventListener("fregat:view", refresh);
    window.addEventListener("focus", refresh);
    render();
    refresh();
    return { offer, focus: () => nickname.focus({ preventScroll: true }), get pending() { return pending !== null; } };
  }

  window.fregatArcade = { leaderboard };
  showView();
  window.addEventListener("hashchange", showView);
})();
