(() => {
  const members = window.fregatDossiers;
  const desk = document.querySelector("#dossier-desk");
  const viewer = document.querySelector("#dossier-viewer");
  const image = viewer.querySelector(".viewer-image");
  const close = viewer.querySelector(".viewer-close");
  const archiveLink = document.querySelector(".archive-link");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const pad = n => String(n).padStart(2, "0");
  const file = document.querySelector("#member-file");
  const paper = document.querySelector("#member-file-paper");
  const posters = new Map();
  const amount = new Intl.NumberFormat("ru-RU");
  let displayed = null;
  let exitAnimation = null;
  let onBoard = false;
  let slides = [], slide = 0, trigger;

  function element(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function link(cls, href, text) {
    const a = element("a", cls, text);
    a.href = href;
    return a;
  }
  function picture(src, alt, cls) {
    const img = element("img", cls);
    img.src = src;
    img.alt = alt;
    return img;
  }


  function openViewer(items, index, source) {
    slides = items;
    slide = index;
    trigger = source;
    paintSlide();
    viewer.showModal();
    close.focus();
    if (!reduced.matches) window.gsap?.fromTo(".viewer-frame", { y: 12, opacity: .55 }, { y: 0, opacity: 1, duration: .25, overwrite: true });
  }
  function paintSlide() {
    const photo = slides[slide];
    image.src = photo.src;
    image.alt = photo.caption;
    viewer.querySelector("#viewer-caption").textContent = photo.caption;
    viewer.querySelector("#viewer-position").textContent = pad(slide + 1) + " / " + pad(slides.length);
    viewer.querySelectorAll("[data-step]").forEach(btn => { btn.hidden = slides.length < 2; });
  }
  function stepBy(step) {
    if (!viewer.open || slides.length < 2) return;
    slide = (slide + step + slides.length) % slides.length;
    paintSlide();
    if (!reduced.matches) window.gsap?.fromTo(image, { x: step * 15, opacity: .5 }, { x: 0, opacity: 1, duration: .22, overwrite: true });
  }
  viewer.querySelectorAll("[data-step]").forEach(btn => btn.addEventListener("click", () => stepBy(Number(btn.dataset.step))));
  close.addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", event => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener("close", () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); });
  viewer.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      stepBy(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  let touchStart;
  image.addEventListener("touchstart", e => { touchStart = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  image.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - touchStart;
    if (touchStart !== null && Math.abs(dx) > 48) stepBy(dx < 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });

  function portraitsFor(member) {
    const primary = member.portrait || "dossiers/" + member.id + "/print.png";
    const second = member.profile || (member.demo ? "dossiers/" + member.id + "/profile.png" : null);
    return [primary, second].filter(Boolean).map((src, index) => ({
      src, caption: member.name + (index ? " · второй ракурс" : " · портрет")
    }));
  }

  function poster(member, index) {
    const a = link("wanted-poster", "#dossiers/" + member.id);
    a.setAttribute("aria-label", "Открыть досье · " + member.name);
    a.setAttribute("aria-haspopup", "dialog");
    a.style.setProperty("--tilt", [-3, 2, -1, 3, 1, -2][index % 6] + "deg");
    const texture = element("span", "wanted-paper");
    texture.setAttribute("aria-hidden", "true");
    texture.append(element("i"), element("i"), element("i"));
    const frame = element("span", "pasted-photo");
    const crop = element("span", "poster-crop");
    crop.style.backgroundImage = 'url("' + portraitsFor(member)[0].src + '")';
    crop.dataset.member = member.id;
    frame.append(crop);
    a.append(texture, frame, element("span", "poster-reward", "$" + amount.format(member.reward)));
    a.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      history.pushState({ fromWantedBoard: true }, "", a.hash);
      render();
    });
    posters.set(member.id, a);
    return a;
  }

  function buildBoard() {
    const left = element("div", "poster-wing");
    const right = element("div", "poster-wing");
    const centre = element("div", "wanted-centre");
    const heading = element("header", "wanted-heading");
    heading.append(element("h1", "", "WANTED"), element("span", "", "Досье Фрегата"));
    centre.append(heading);
    members.filter(member => !member.chief).forEach((member, index) => {
      const slot = element("div", "pin-slot");
      slot.append(poster(member, index));
      (index % 4 < 2 ? left : right).append(slot);
    });
    const chief = members.find(member => member.chief);
    if (chief) {
      const slot = element("div", "chief-slot");
      slot.append(poster(chief, 2));
      centre.append(slot, element("strong", "chief-label", chief.role));
    }
    desk.append(left, centre, right);
  }

  function fillFile(member) {
    paper.replaceChildren();
    const heading = element("header", "document-head");
    heading.append(picture("media/logo.jpg", "", "file-seal"), element("b", "", "FREGAT SQUAD"), element("small", "", member.code));
    const dismiss = element("button", "file-dismiss", "×");
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Закрыть досье");
    dismiss.addEventListener("click", leaveFile);
    heading.append(dismiss);

    const identity = element("div", "file-identity");
    const text = element("div");
    const name = element("h2", "", member.name);
    name.id = "member-file-name";
    text.append(element("small", "file-kicker", "Личное досье"), name);
    const fields = element("dl", "file-fields");
    for (const [label, value] of [["Возраст", member.age + " лет"], ["Роль", member.role], ["Награда", "$" + amount.format(member.reward)]]) {
      fields.append(element("dt", "", label), element("dd", "", value));
    }
    text.append(fields);
    if (member.stamp) text.append(element("b", "file-alert-stamp", member.stamp));
    const shots = portraitsFor(member);
    const portrait = element("button", "file-photo");
    portrait.type = "button";
    portrait.setAttribute("aria-label", "Увеличить портрет · " + member.name);
    portrait.append(picture(shots[0].src, shots[0].caption, ""));
    portrait.addEventListener("click", () => openViewer(shots, 0, portrait));
    identity.append(text, portrait);
    const description = member.description || (member.chief
      ? "Место главы сквада. Портрет и история появятся здесь позже."
      : "Портрет и описание этого участника скоро появятся.");
    const notes = member.notes || [{ title: "Об участнике", lines: description.split("\n").filter(Boolean) }];
    const sections = notes.map(note => {
      const section = element("section", "file-notes");
      section.append(element("h3", "", note.title));
      for (const line of note.lines) section.append(element("p", "", line));
      return section;
    });
    const album = element("section", "file-album");
    const photos = member.photos || [];
    album.append(element("h3", "", "Фотоальбом"));
    if (photos.length) {
      const strip = element("div", "document-prints");
      photos.forEach((photo, index) => {
        const button = element("button");
        button.type = "button";
        button.setAttribute("aria-label", "Открыть снимок · " + photo.caption);
        button.append(picture(photo.src, "", ""));
        button.addEventListener("click", () => openViewer(photos, index, button));
        strip.append(button);
      });
      album.append(strip);
    } else album.append(element("p", "", "Снимки ещё не добавлены."));
    const foot = element("footer", "document-foot");
    foot.append(element("small", "", member.demo ? "Демонстрационный профиль" : member.reserved ? "Портрет ожидается" : member.code), element("b", "squad-stamp", "FREGAT SQUAD"));
    paper.append(heading, identity, ...sections, album, foot);
  }

  function leaveFile() {
    if (history.state?.fromWantedBoard) history.back();
    else location.replace("#dossiers");
  }

  function hideFile(animate) {
    if (!file.open || exitAnimation) return;
    const previous = displayed;
    const finish = () => {
      file.close();
      file.classList.remove("file-leaving");
      exitAnimation = null;
      displayed = null;
      if (location.hash === "#dossiers") posters.get(previous)?.focus({ preventScroll: true });
    };
    if (animate && !reduced.matches) {
      file.classList.add("file-leaving");
      exitAnimation = file.animate([{opacity: 1, transform: "none"}, {opacity: 0, transform: "translateY(20px) scale(.985)"}], {duration: 180, easing: "ease-in", fill: "forwards"});
      exitAnimation.finished.then(() => { exitAnimation.cancel(); finish(); }, () => {});
    } else finish();
  }

  function render() {
    const [section, id] = location.hash.slice(1).split("/");
    const active = section === "dossiers";
    if (active) archiveLink.setAttribute("aria-current", "page");
    else archiveLink.removeAttribute("aria-current");
    if (viewer.open) viewer.close();
    const member = active && members.find(item => item.id === id);
    if (active && !onBoard && !reduced.matches) {
      window.gsap?.fromTo(".wanted-poster", {opacity: .35, y: 6}, {opacity: 1, y: 0, duration: .28, stagger: .023, clearProps: "opacity,transform"});
    }
    onBoard = active;
    if (!member) {
      hideFile(active);
      if (active) document.title = "Досье Фрегата · FREGAT SQUAD";
      return;
    }
    if (exitAnimation) { exitAnimation.cancel(); exitAnimation = null; file.classList.remove("file-leaving"); }
    if (file.open && displayed === id) return;
    displayed = id;
    fillFile(member);
    if (!file.open) file.showModal();
    file.scrollTop = 0;
    paper.querySelector(".file-dismiss").focus({preventScroll: true});
    if (!reduced.matches) {
      file.animate([{opacity: 0, transform: "translateY(64px) rotate(-2deg) scale(.96)"}, {opacity: 1, transform: "none"}], {duration: 430, easing: "cubic-bezier(.16,1,.3,1)"});
    }
    document.title = member.name + " · Досье FREGAT SQUAD";
  }
  file.addEventListener("cancel", event => { event.preventDefault(); leaveFile(); });
  file.addEventListener("click", event => { if (event.target === file) leaveFile(); });
  buildBoard();
  window.addEventListener("hashchange", render);
  render();
})();
