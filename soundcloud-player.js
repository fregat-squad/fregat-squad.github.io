(() => {
  let sdk;

  function loadWidget() {
    if (window.SC?.Widget) return Promise.resolve(window.SC.Widget);
    if (!sdk) {
      const script = document.createElement("script");
      script.src = "https://w.soundcloud.com/player/api.js";
      sdk = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("SoundCloud timed out")), 12000);
        script.onload = () => {
          clearTimeout(timer);
          if (window.SC?.Widget) resolve(window.SC.Widget);
          else reject(new Error("SoundCloud Widget API is unavailable"));
        };
        script.onerror = () => {
          clearTimeout(timer);
          reject(new Error("SoundCloud Widget API failed to load"));
        };
        document.head.append(script);
      }).catch(error => {
        sdk = undefined;
        script.remove();
        throw error;
      });
    }
    return sdk;
  }

  window.openSoundCloudTrack = function (host, slug, events) {
    const url = "https://soundcloud.com/anonymousfregatclub/" + slug;
    const frame = document.createElement("iframe");
    frame.title = "SoundCloud · dj fregat";
    frame.allow = "autoplay";
    let widget;
    let widgetEvents;
    let closed = false;
    let failed = false;
    let ready = false;
    let wantPlay = true;
    let level = events.volume;
    const fail = () => {
      if (closed || failed) return;
      failed = true;
      clearTimeout(timeout);
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Открыть трек на SoundCloud";
      frame.hidden = true;
      host.replaceChildren(link);
      events.error();
    };
    const timeout = setTimeout(fail, 15000);

    loadWidget().then(Widget => {
      if (closed || failed) return;
      const parameters = new URLSearchParams({ url, auto_play: "false", show_comments: "false", show_reposts: "false" });
      frame.src = "https://w.soundcloud.com/player/?" + parameters;
      host.replaceChildren(frame);
      const Events = Widget.Events;
      widgetEvents = [Events.READY, Events.PLAY, Events.PAUSE, Events.FINISH, Events.PLAY_PROGRESS, Events.SEEK, Events.ERROR];
      widget = Widget(frame);
      widget.bind(Events.READY, () => {
        if (closed || failed) return;
        clearTimeout(timeout);
        ready = true;
        widget.setVolume(level);
        widget.getDuration(ms => { if (!closed) events.duration(ms / 1000); });
        if (wantPlay) widget.play();
      });
      widget.bind(Events.PLAY, () => { if (!closed) { wantPlay = true; events.play(); } });
      widget.bind(Events.PAUSE, () => { if (!closed) { wantPlay = false; events.pause(); } });
      widget.bind(Events.FINISH, () => { if (!closed) events.finish(); });
      const position = data => { if (!closed && Number.isFinite(data.currentPosition)) events.position(data.currentPosition / 1000); };
      widget.bind(Events.PLAY_PROGRESS, position);
      widget.bind(Events.SEEK, position);
      widget.bind(Events.ERROR, fail);
    }).catch(fail);

    return {
      get failed() { return failed; },
      toggle() {
        wantPlay = ready && !failed ? !events.playing() : !wantPlay;
        if (ready && !failed) {
          if (wantPlay) widget.play();
          else widget.pause();
        }
      },
      setVolume(value) {
        level = value;
        if (ready && !failed) widget.setVolume(level);
      },
      seek(seconds) {
        if (ready && !failed) widget.seekTo(seconds * 1000);
      },
      close() {
        closed = true;
        clearTimeout(timeout);
        if (widget) for (const event of widgetEvents) widget.unbind(event);
        host.replaceChildren();
      }
    };
  };
})();
