(() => {
  if (!window.gsap) return;

  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    let entrance;
    function reveal() {
      entrance?.revert();
      const game = document.querySelector("[data-game-view]:not([hidden])");
      const panels = game
        ? [game, document.querySelector(".player")]
        : gsap.utils.toArray(".intro, .gallery, .player, .game-tile");
      entrance = gsap.timeline().from(panels, {
        opacity: 0, y: 16, duration: .52, stagger: .055,
        ease: "power3.out", clearProps: "opacity,transform"
      });
    }
    reveal();
    window.addEventListener("fregat:view", reveal);

    const play = document.querySelector("#play");
    const vinyl = gsap.to(".record", { rotation: 360, repeat: -1, duration: 7, ease: "none", paused: true });
    function spin() { vinyl.paused(!play.hasAttribute("data-playing")); }
    const observer = new MutationObserver(spin);
    observer.observe(play, { attributes: true, attributeFilter: ["data-playing"] });
    spin();

    return () => {
      entrance?.revert();
      window.removeEventListener("fregat:view", reveal);
      observer.disconnect();
    };
  });

  media.add("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    for (const tile of document.querySelectorAll(".game-tile")) {
      const art = tile.querySelector(".game-art");
      const arrow = tile.querySelector(".tile-arrow");
      const lift = gsap.quickTo(art, "y", { duration: .4, ease: "power3.out" });
      const slide = gsap.quickTo(arrow, "x", { duration: .25 });
      const enter = () => { lift(-7); slide(2); };
      const leave = () => { lift(0); slide(0); };
      tile.addEventListener("pointerenter", enter, options);
      tile.addEventListener("pointerleave", leave, options);
      tile.addEventListener("focus", enter, options);
      tile.addEventListener("blur", leave, options);
    }
    return () => listeners.abort();
  });
})();
