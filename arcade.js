(() => {
  const views = Array.from(document.querySelectorAll("[data-game-view]"));
  const home = document.querySelector(".hero");
  const homeLink = document.querySelector(".arcade-home");
  const links = document.querySelectorAll('.game-nav a[href^="#"]');
  let active = null;

  function showView() {
    const route = location.hash.slice(1);
    const next = views.find(view => view.dataset.gameView === route) ?? null;
    if (next === active) return;
    active = next;
    for (const view of views) view.hidden = view !== active;
    for (const link of links) {
      if (active && link.hash === location.hash) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.body.classList.toggle("arcade", Boolean(active));
    home.hidden = Boolean(active);
    homeLink.hidden = !active;
    document.title = active ? active.dataset.gameTitle + " · FREGAT SQUAD" : "FREGAT SQUAD";
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event("fregat:view"));
  }

  function leaderboard({ entry, board, status, action, key, minimum }) {
    const nickname = entry.querySelector("input");
    const compact = matchMedia("(max-width: 680px)");
    const table = board.querySelector("table");
    const empty = board.querySelector("p");
    let pending = null;
    const rank = items => items.sort((a, b) => b.score - a.score);
    let leaders = [];
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(saved)) {
        leaders = rank(saved.filter(item => item && typeof item.name === "string" &&
          item.name.trim() && item.name.length <= 20 && Number.isSafeInteger(item.score) && item.score >= minimum));
      }
    } catch {
      // A leaderboard still works in memory when storage is unavailable.
    }

    function render() {
      const rows = leaders.slice(0, 5).map(({ name, score }, index) => {
        const row = document.createElement("tr");
        [index + 1, name, score].forEach(value => { row.insertCell().textContent = value; });
        row.cells[1].title = name;
        return row;
      });
      table.tBodies[0].replaceChildren(...rows);
      table.hidden = rows.length === 0;
      empty.hidden = rows.length > 0;
    }

    function offer(score) {
      pending = score >= minimum ? score : null;
      entry.reset();
      nickname.setCustomValidity("");
      entry.hidden = pending === null;
      return pending !== null;
    }

    entry.addEventListener("submit", event => {
      event.preventDefault();
      if (pending === null) return;
      const name = nickname.value.trim().replace(/\s+/g, " ");
      if (!name) {
        nickname.setCustomValidity("Введи никнейм.");
        nickname.reportValidity();
        return;
      }
      const nameKey = name.normalize("NFC").toLowerCase();
      const previous = leaders.find(item => item.name.normalize("NFC").toLowerCase() === nameKey);
      if (!previous || pending > previous.score) {
        leaders = rank([...leaders.filter(item => item !== previous), { name, score: pending }]);
        try {
          localStorage.setItem(key, JSON.stringify(leaders));
          status.textContent = "Результат записан.";
        } catch {
          status.textContent = "Результат сохранён в этой вкладке.";
        }
        render();
      } else {
        status.textContent = "У этого ника уже есть результат: " + previous.score + ".";
      }
      offer(0);
      board.open = true;
      action.textContent = "Попробовать снова";
      action.focus({ preventScroll: true });
    });

    nickname.addEventListener("input", () => nickname.setCustomValidity(""));
    board.open = !compact.matches;
    compact.addEventListener("change", () => { board.open = !compact.matches; });
    render();
    return { offer, focus: () => nickname.focus({ preventScroll: true }), get pending() { return pending !== null; } };
  }

  window.fregatArcade = { leaderboard };
  showView();
  window.addEventListener("hashchange", showView);
})();
