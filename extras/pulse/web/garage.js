/* Omarchy Pulse: the garage scene ([pulse] scene = "garage"). Your PC is a car in a dark workshop.
   The picture (the "plate": your own render or photo, [garage] plate) is the scene; Pulse lights it with your data:
   the headlights flash when you push or an agent finishes, the hazards blink while an agent waits for you, the
   underglow breathes with your GPU and your music, rain runs down the window when it really rains, the neon sign
   flares with an alert. Around it: the bar, your agents, your repositories, the fuel (the work you ship), your
   builds and the dashboard lights. Everything comes from /api/state: nothing is made up.
   (c) 2026 Marco Porro (x.com/MarcoPorro), MIT. */
(function () {
  "use strict";
  var Q = new URLSearchParams(location.search), TOKEN = Q.get("token") || "";
  var I = {   // original line icons (24x24)
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    gpu: '<rect x="2.5" y="6" width="19" height="11" rx="1.5"/><circle cx="9" cy="11.5" r="2.6"/><circle cx="15.5" cy="11.5" r="2.6"/><path d="M5 17v2.5M19 17v2.5"/>',
    ram: '<rect x="2.5" y="7" width="19" height="8" rx="1"/><path d="M6 10h2M10 10h2M14 10h2M4.5 15v2.5M8 15v2.5M12 15v2.5M16 15v2.5M19.5 15v2.5"/>',
    vram: '<rect x="2.5" y="6" width="19" height="11" rx="1.5"/><rect x="6" y="9" width="5" height="5"/><rect x="13" y="9" width="5" height="5"/>',
    disk: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    net: '<path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3"/>',
    engine: '<path d="M4 10h2V8h5V6h3v2h3l2 3h2v5h-2l-2 2h-6l-2-2H6v-2H4z"/><path d="M2 11v4"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.3" r="1"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-6 4-12 8"/>',
    bot: '<rect x="4.5" y="8" width="15" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M2 13v3M22 13v3"/><circle cx="12" cy="3.5" r="1"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.4"/>',
    cube: '<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/>',
    commit: '<circle cx="12" cy="12" r="3.5"/><path d="M2 12h6.5M15.5 12H22"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    spin: '<path d="M12 3a9 9 0 1 0 9 9" />', pulse: '<path d="M2 12h4l2.5-6 4 13 3-9 2 2H22"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M15 9h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3M7 7h5v4H7z"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24">' + (I[n] || "") + "</svg>"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pct(v) { return v == null ? "--" : Math.round(v) + "%"; }
  function rate(n) {
    var u = ["B/s", "KB/s", "MB/s", "GB/s"], i = 0; n = +n || 0;
    while (n >= 1000 && i < 3) { n /= 1000; i++; }
    return (n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
  }
  function dur(sec) {
    sec = Math.max(0, sec | 0);
    if (sec < 60) return sec + "s";
    if (sec < 3600) return Math.floor(sec / 60) + "m";
    return Math.floor(sec / 3600) + "h " + Math.floor(sec % 3600 / 60) + "m";
  }
  function thousands(n) { return (+n || 0).toLocaleString("en-US"); }
  function split(name) { var p = String(name || "agent").split(" · "); return { who: p[0].trim() || "agent", project: p.slice(1).join(" · ").trim() }; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var STATE = { working: "Working", waiting: "Waiting for input", failed: "Failed", done: "Done", idle: "Idle" };
  var RANK = { failed: 0, waiting: 1, working: 2, done: 3, idle: 4 };

  var S = null, cfg = {}, share = false, lamps = {}, seen = {}, root = null, card = null, cardFor = null;
  var plate = null, plateKey = null, anchors = {}, cache = null, cacheKey = "";
  var beam = 0, alertAt = -1e9, alertCol = null, bass = 0, audioAt = 0, drops = [];
  var toastT = null;

  // ------------------------------------------------------------------ the plate and its lights
  function loadPlate() {
    var key = String(cfg.plate || "");
    if (key === plateKey) return;
    plateKey = key; plate = null; cache = null; anchors = {};
    var im = new Image();
    im.onload = function () { plate = im; cache = null; };
    im.src = "/api/garage/plate?token=" + encodeURIComponent(TOKEN) + "&k=" + encodeURIComponent(key);
    fetch("/api/garage/anchors?token=" + encodeURIComponent(TOKEN)).then(function (r) { return r.json(); }).then(function (a) { anchors = a || {}; cache = null; drops = []; }).catch(function () {});
  }
  function fit(W, H) {   // cover the screen, keeping the plate's focus point (anchors.focus) in view
    var iw = plate.naturalWidth, ih = plate.naturalHeight;
    if (anchors.place) {   // a tighter picture: placed at [x, y, width] (fractions of the screen), the rest is its own glow
      var pw = anchors.place[2] * W, ph = pw * ih / iw;
      return { x: anchors.place[0] * W, y: anchors.place[1] * H, w: pw, h: ph, placed: true };
    }
    var s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
    var f = anchors.focus || [0.5, 0.55];
    return { x: Math.min(0, Math.max(W - dw, W / 2 - f[0] * dw)), y: Math.min(0, Math.max(H - dh, H * 0.5 - f[1] * dh)), w: dw, h: dh };
  }
  function base(W, H) {
    var key = W + "x" + H + (plate ? plate.src : "none");
    if (cache && cacheKey === key) return cache;
    cache = document.createElement("canvas"); cache.width = W; cache.height = H; cacheKey = key;
    var c = cache.getContext("2d");
    c.fillStyle = "#050506"; c.fillRect(0, 0, W, H);
    if (plate) {
      var r = fit(W, H);
      if (r.placed) {
        // around it, the same garage out of focus: the plate shrunk to a few pixels and stretched back, darker
        var tiny = document.createElement("canvas"), tc = tiny.getContext("2d"); tiny.width = 48; tiny.height = 27;
        tc.drawImage(plate, 0, 0, 48, 27);
        c.imageSmoothingEnabled = true; c.globalAlpha = 0.55; c.drawImage(tiny, 0, 0, W, H); c.globalAlpha = 1;
        // the sharp picture, its edges melting into the blur
        var pc = document.createElement("canvas"), px = pc.getContext("2d"); pc.width = Math.ceil(r.w); pc.height = Math.ceil(r.h);
        px.drawImage(plate, 0, 0, r.w, r.h); px.globalCompositeOperation = "destination-in";
        var e = Math.min(r.w, r.h) * 0.14, gx = px.createLinearGradient(0, 0, r.w, 0);
        gx.addColorStop(0, "rgba(0,0,0,0)"); gx.addColorStop(e / r.w, "#000"); gx.addColorStop(1 - e / r.w, "#000"); gx.addColorStop(1, "rgba(0,0,0,0)");
        px.fillStyle = gx; px.fillRect(0, 0, r.w, r.h);
        var gy2 = px.createLinearGradient(0, 0, 0, r.h);
        gy2.addColorStop(0, "rgba(0,0,0,0)"); gy2.addColorStop(e / r.h, "#000"); gy2.addColorStop(1 - e / r.h, "#000"); gy2.addColorStop(1, "rgba(0,0,0,0)");
        px.fillStyle = gy2; px.fillRect(0, 0, r.w, r.h);
        c.drawImage(pc, r.x, r.y);
      } else c.drawImage(plate, r.x, r.y, r.w, r.h);
      cache.fit = r;
    }
    else {   // no plate yet: an empty, dark bay (and the README says how to add one)
      var gw = c.createLinearGradient(0, 0, 0, H);
      gw.addColorStop(0, "#08080a"); gw.addColorStop(0.62, "#141418"); gw.addColorStop(0.63, "#0b0b0d"); gw.addColorStop(1, "#030304");
      c.fillStyle = gw; c.fillRect(0, 0, W, H);
      c.fillStyle = "rgba(255,42,62,.85)"; c.fillRect(0, H * 0.62, W, Math.max(2, H * 0.003));
      cache.fit = { x: 0, y: 0, w: W, h: H };
    }
    // keep the panels readable: a little darker at the edges
    var v = c.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    return cache;
  }
  function glow(g, x, y, rx, ry, col, a) {
    if (a <= 0.003) return;
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, "rgba(" + col + "," + a + ")"); gr.addColorStop(1, "rgba(" + col + ",0)");
    g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  }
  var RED = "255,42,62", AMBER = "255,176,46", WHITE = "235,242,255", GREEN = "62,214,110";
  function draw(g, W, H, now, flags) {
    share = !!(flags && (flags.share || flags.privacy));
    var b = base(W, H), r = b.fit, t = now / 1000, mv = cfg.motion || "full", sys = (S && S.sys) || {};
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.drawImage(b, 0, 0);
    var P = function (a) { return [r.x + a[0] * r.w, r.y + a[1] * r.h]; }, sz = r.w / 1000;
    var ag = agentsNow(), waiting = ag.some(function (a) { return a.state === "waiting"; }), failed = ag.some(function (a) { return a.state === "failed"; });
    if (performance.now() - audioAt > 600) bass *= 0.9;
    g.globalCompositeOperation = "lighter";
    // the underglow: your GPU, and the beat of your music
    var fl = anchors.floor || [0.5, 0.86, 0.36, 0.06], fp = P(fl);
    var under = 0.16 + Math.min(1, (sys.gpu || 0) / 100) * 0.22 + bass * 0.4 + (mv === "full" ? 0.03 * Math.sin(t * 1.2) : 0);
    glow(g, fp[0], fp[1], fl[2] * r.w, fl[3] * r.h, failed ? RED : RED, under);
    // the headlights: running lights, a flash when you push or an agent finishes, the hazards while one waits
    beam *= mv === "off" ? 0 : 0.93;
    var hz = waiting && (mv === "off" || (t * 1.6) % 1 < 0.55);
    (anchors.headlights || []).forEach(function (h) {
      var p = P(h), s2 = (h[2] || 40) * sz;
      glow(g, p[0], p[1], s2 * 1.2, s2 * 0.7, WHITE, 0.1 + (mv === "full" ? 0.03 * Math.sin(t * 0.8) : 0));
      if (beam > 0.02) glow(g, p[0], p[1], s2 * 4, s2 * 2, WHITE, beam * 0.55);
      if (hz) glow(g, p[0], p[1], s2 * 2.2, s2 * 1.4, AMBER, 0.75);
    });
    (anchors.tail || []).forEach(function (h) {
      var p = P(h), s2 = (h[2] || 30) * sz;
      glow(g, p[0], p[1], s2 * 1.5, s2, RED, 0.35);
      if (hz) glow(g, p[0], p[1], s2 * 2.2, s2 * 1.4, AMBER, 0.75);
    });
    if (failed) {   // a failed agent: the bay glows red under the hood, like a check-engine light
      var hp = P(anchors.hood || [fl[0], fl[1] - 0.12]);
      glow(g, hp[0], hp[1], 160 * sz, 90 * sz, RED, 0.22 + (mv === "full" ? 0.08 * Math.sin(t * 2) : 0));
    }
    var sinceAlert = (performance.now() - alertAt) / 1000;   // an alert: the neon sign flares
    if (sinceAlert < 3 && anchors.sign) { var sp = P(anchors.sign); glow(g, sp[0], sp[1], 220 * sz, 160 * sz, alertCol || RED, 0.5 * (1 - sinceAlert / 3)); }
    g.globalCompositeOperation = "source-over";
    rain(g, P, r, t, mv);
  }
  function wxKind() {
    var w = S && S.weather; if (!w || w.error) return "";
    var c = +w.code;
    if (c >= 95) return "storm"; if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rain"; if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
    return "";
  }
  function rain(g, P, r, t, mv) {   // the real weather, on the window
    var k = wxKind(), wn = anchors.window;
    if (!k || !wn || mv === "off") return;
    var a = P([wn[0], wn[1]]), b = P([wn[2], wn[3]]), w = b[0] - a[0], h = b[1] - a[1];
    if (!drops.length) for (var i = 0; i < 60; i++) drops.push([Math.random(), Math.random(), 0.6 + Math.random() * 0.8]);
    g.save(); g.beginPath(); g.rect(a[0], a[1], w, h); g.clip();
    g.strokeStyle = k === "snow" ? "rgba(235,238,245,.55)" : "rgba(200,210,230,.28)"; g.lineWidth = k === "snow" ? 2.5 : 1;
    g.beginPath();
    drops.forEach(function (d) {
      var y = a[1] + ((d[1] + t * (k === "snow" ? 0.05 : 0.6) * d[2]) % 1) * h, x = a[0] + d[0] * w;
      if (k === "snow") { g.moveTo(x, y); g.lineTo(x + 0.5, y + 0.5); } else { g.moveTo(x, y); g.lineTo(x - h * 0.01, y + h * 0.05); }
    });
    g.stroke();
    if (k === "storm" && (t % 9) < 0.12) { g.fillStyle = "rgba(230,235,255,.35)"; g.fillRect(a[0], a[1], w, h); }
    g.restore();
  }

  // ------------------------------------------------------------------ Pulse's panels, the garage's own among them
  // The garage keeps Marco's layout: the clock, the system and network panels, every [[source]], the AI brief, the
  // weather, the ticker. It adds three panels in the same style (agents, fuel, builds) and the dashboard lights.
  function lamp(id, v, th) {   // on at the threshold, off 5 below it: a light never flickers on the line
    if (v == null) { lamps[id] = false; return false; }
    lamps[id] = lamps[id] ? v >= th - 5 : v >= th;
    return lamps[id];
  }
  function agentsNow() {
    var list = ((S && S.agents) || []).filter(function (a) { return !a.crew && a.state !== "gone"; });
    return list.sort(function (a, b) { return (RANK[a.state] == null ? 5 : RANK[a.state]) - (RANK[b.state] == null ? 5 : RANK[b.state]) || (b.t || 0) - (a.t || 0); });
  }
  function waitCls(a) { return (Date.now() / 1000 - (a.changed || a.t || 0)) / 60 >= (+cfg.wait_red || 10) ? "crit" : "warn"; }
  function setH(e, html) { if (e._h !== html) { e._h = html; e.innerHTML = html; } }
  // the agents panel, shared with the canopy (canopy.js): where = "in the bay" / "in the grove"
  function agentsPanel(st, panel, bodyOf, conf, where, quiet) {
    S = st; cfg = conf || {};
    var now = Date.now() / 1000, ag = agentsNow();
    var nWait = ag.filter(function (a) { return a.state === "waiting"; }).length, nFail = ag.filter(function (a) { return a.state === "failed"; }).length;
    var pa = panel("g-agents", "agents · " + (ag.length ? ag.length + " " + where : "none"), "");
    pa.classList.toggle("warn", nWait > 0 && !nFail); pa.classList.toggle("crit", nFail > 0);
    var rows = ag.slice(0, 5).map(function (a) {
      var nm = split(a.name), c = a.state === "waiting" ? waitCls(a) : a.state === "failed" ? "crit" : a.state === "working" || a.state === "done" ? "ok" : "";
      var sub = a.state === "working" ? (a.text || "working") + " · " + dur(now - (a.since || now)) : a.state === "waiting" ? "needs you · " + dur(now - (a.changed || a.t)) : STATE[a.state] || a.state;
      return '<div class="g-arow ' + c + '" data-agent="' + esc(a.name) + '"><span class="dot ' + c + '"></span><b>' + esc(nm.who) + "</b>" +
        (nm.project && !share ? "<em>" + esc(nm.project) + "</em>" : "") + "<span>" + esc(sub) + "</span></div>";
    });
    if (ag.length > 5) rows.push('<div class="g-arow"><span>+ ' + (ag.length - 5) + " more</span></div>");
    if (!ag.length) rows.push('<div class="g-arow"><span>' + quiet + ' · omarchy-pulse hook claude</span></div>');
    setH(bodyOf(pa), rows.join(""));
    return pa;
  }
  function panels(st, left, right, panel, bodyOf) {
    S = st; cfg = (st.ui && st.ui.garage) || {};
    var now = Date.now() / 1000, ag = agentsNow(), f = st.fuel || null, repos = st.git || [];
    left.unshift(agentsPanel(st, panel, bodyOf, cfg, "in the bay", "the bay is quiet"));
    // fuel: the work you ship
    var fl = f ? f.level : 0, msg = !f ? "reading your repos" : fl >= 0.75 ? "full tank · keep shipping" : fl >= 0.35 ? "cruising" : fl >= 0.15 ? "running low · push something" : "on fumes · commit to refuel";
    var linked = f && f.source === "github";
    var pf = panel("g-fuel", "fuel · " + (linked ? "github · 7 days" : "last 7 days"), "");
    pf.classList.toggle("clickable", !!linked);
    pf.dataset.gh = linked && !share ? f.login : "";
    pf.classList.toggle("warn", !!f && fl < 0.35 && fl >= 0.15); pf.classList.toggle("crit", !!f && fl < 0.15);
    var bf = bodyOf(pf);
    if (!bf._built) { bf.innerHTML = '<div class="g-fuel"><canvas width="220" height="124"></canvas><div class="g-fi"></div></div><div class="meters g-fm"></div>'; bf._built = true; }
    setH(bf.querySelector(".g-fi"), '<div class="big"><span>' + (f ? Math.round(fl * 100) : "--") + "</span><small>%</small></div><div class='msg'>" + esc(msg) + "</div>" +
      (f ? "<div class='pts'>" + f.points + " / " + f.goal + " pts</div>" : ""));
    fuelGauge(bf.querySelector("canvas"), fl, !!f);
    // each row: what it is, how much of a full tank it put in, the count
    var fr = !f ? [] : linked ? [["commits", f.commits, 1], ["pushes", f.pushes, 2], ["branches", f.branches, 3], ["merged PR", f.merged, 5], ["releases", f.shipped, 10]]
      : [["commits", f.commits, 1], ["pushed", f.pushed, 1], ["branches", f.branches, 3], ["today", f.today, 0]];
    setH(bf.querySelector(".g-fm"), f ? fr.map(function (r) {
      var w = r[2] ? Math.min(100, r[1] * r[2] / Math.max(1, f.goal) * 100) : Math.min(100, r[1] / Math.max(1, f.goal) * 100);
      return '<div class="meter"><span class="k">' + r[0] + '</span><div class="seg"><i style="width:' + w.toFixed(0) + '%"></i></div><span class="v">' + r[1] + "</span></div>";
    }).join("") + '<div class="g-tot">' + thousands(f.allCommits) + " commits · " + f.releases + " releases · " + f.repos + " active projects</div>" : "");
    // builds: the CI of your repositories
    var withCi = repos.filter(function (r) { return r.ci; });
    if (withCi.length) {
      var run = withCi.filter(function (r) { return r.ci === "run"; }), fail = withCi.filter(function (r) { return r.ci === "fail"; });
      var pb = panel("g-builds", "builds · " + (run.length ? "running" : fail.length ? "failed" : "all green"), "");
      pb.classList.toggle("warn", run.length > 0 && !fail.length); pb.classList.toggle("crit", fail.length > 0);
      setH(bodyOf(pb), withCi.slice(0, 5).map(function (r, i) {
        var c = r.ci === "ok" ? ["ok", "passed"] : r.ci === "fail" ? ["crit", "failed"] : ["run", "running"];
        return '<div class="g-ci"><span class="dot ' + c[0] + '"></span><span class="n">' + esc(share ? "repo " + (i + 1) : r.name) + "</span><em>" + (r.week || 0) + " this wk</em><b class='" + c[0] + "'>" + c[1] + "</b></div>";
      }).join(""));
      right.unshift(pb);
    }
    right.unshift(pf);
    dash();
  }
  function dash() {   // the dashboard lights, on the floor in front of the car
    if (!root) {
      root = document.createElement("div"); root.id = "garage";
      root.innerHTML = '<div class="g-dash panel"><div class="legend">dashboard</div><div class="body"></div></div><div class="g-toast"></div>';
      document.body.appendChild(root);
    }
    var sys = S.sys || {}, ag = agentsNow(), repos = S.git || [], th = { cpu: +cfg.cpu || 85, gpu: +cfg.gpu || 90, ram: +cfg.ram || 85, vram: +cfg.vram || 90, disk: +cfg.disk || 90 };
    var nWork = ag.filter(function (a) { return a.state === "working"; }).length, nWait = ag.filter(function (a) { return a.state === "waiting"; }).length;
    var nFail = ag.filter(function (a) { return a.state === "failed"; }).length, ciFail = repos.some(function (r) { return r.ci === "fail"; }), ciRun = repos.some(function (r) { return r.ci === "run"; });
    var offline = "ip" in sys && !sys.ip, lowFuel = !!(S.fuel && S.fuel.level < 0.15);
    var L = [
      ["engine", "engine", "cpu " + pct(sys.cpu), lamp("cpu", sys.cpu, th.cpu) ? "warn" : "ok"],   // high CPU is work, never a failure
      ["gpu", "graphics", sys.gpu == null ? "no reading" : "gpu " + pct(sys.gpu), sys.gpu == null ? "" : lamp("gpu", sys.gpu, th.gpu) ? "warn" : "ok"],
      ["ram", "memory", sys.vram != null ? "ram " + pct(sys.ram) + " · vram " + pct(sys.vram) : "ram " + pct(sys.ram), (lamp("ram", sys.ram, th.ram) || lamp("vram", sys.vram, th.vram)) ? "warn" : "ok"],
      ["disk", "storage", "disk " + pct(sys.disk), lamp("disk", sys.disk, th.disk) ? "crit" : "ok"],
      ["wifi", "network", offline ? "offline" : "online", offline ? "warn" : "ok"],
      ["fuel", "fuel", S.fuel ? Math.round(S.fuel.level * 100) + "%" : "--", lowFuel ? "warn" : S.fuel ? "ok" : ""],
      ["code", "repos", ciFail ? "ci failed" : ciRun ? "building" : "git", ciFail ? "crit" : ciRun ? "warn blink" : repos.length ? "ok" : ""],
      ["bot", "agents", nFail ? nFail + " failed" : nWait ? nWait + " waiting" : nWork + " working", nFail ? "crit" : nWait ? "warn blink" : nWork ? "ok" : ""]
    ];
    root._lamps = L;
    root.classList.toggle("off", cfg.dash === false);
    setH(root.querySelector(".g-dash .body"), L.map(function (l, i) { return '<div class="g-lamp ' + l[3] + '" data-lamp="' + i + '">' + ic(l[0]) + "<b>" + l[1] + "</b><small>" + esc(l[2]) + "</small></div>"; }).join(""));
  }
  function fuelGauge(cv, v, known) {
    var c = cv.getContext("2d"), w = cv.width, h = cv.height, cx = w / 2, cy = h * 0.92, R = h * 0.76, n = 18;
    var css = getComputedStyle(document.body), acc = (css.getPropertyValue("--accent-rgb") || "255,42,62").trim();
    c.clearRect(0, 0, w, h);
    for (var i = 0; i < n; i++) {
      var a0 = Math.PI + Math.PI * i / n + 0.03, a1 = Math.PI + Math.PI * (i + 1) / n - 0.03, on = known && (i + 0.5) / n <= v;
      c.strokeStyle = on ? (v < 0.15 ? "rgb(255,52,66)" : i < n * 0.2 ? "rgb(255,176,46)" : "rgb(" + acc + ")") : "rgba(255,255,255,.1)";
      c.lineWidth = R * 0.18; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    }
    var a = Math.PI + Math.PI * Math.max(0, Math.min(1, v));
    c.strokeStyle = "rgba(240,242,248,.95)"; c.lineWidth = 3; c.lineCap = "round";
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84); c.stroke();
    c.fillStyle = "rgba(255,255,255,.5)"; c.font = "600 17px monospace"; c.textAlign = "center";
    c.fillText("E", cx - R, cy - R * 0.02 - 22); c.fillText("F", cx + R, cy - R * 0.02 - 22);
  }

  // ------------------------------------------------------------------ clicks: a small card, nothing invented
  function hideCard() { if (card) card.hidden = true; cardFor = null; }
  function fillCard(h) {
    var rows = [], title = "", now = Date.now() / 1000;
    if (h.agent) {
      var a = agentsNow().filter(function (x) { return x.name === h.agent; })[0];
      if (!a) { hideCard(); return; }
      var nm = split(a.name); title = cap(nm.who);
      rows.push(["status", (STATE[a.state] || a.state) + (a.state === "waiting" ? " · " + dur(now - (a.changed || a.t)) : "")]);
      if (nm.project && !share) rows.push(["project", nm.project]);
      if (a.text && !share) rows.push(["doing", a.text]);
      if (a.since && a.state === "working") rows.push(["working for", dur(now - a.since)]);
      if (a.t) rows.push(["last activity", dur(now - a.t) + " ago"]);
    } else if (h.lamp != null && root._lamps) {
      var l = root._lamps[h.lamp]; title = l[1]; rows.push([l[3] ? l[3].split(" ")[0].replace("crit", "warning").replace("warn", "attention") : "off", l[2]]);
    }
    card.innerHTML = "<b>" + esc(title) + "</b>" + rows.map(function (r) { return "<div><span>" + esc(r[0]) + "</span><i>" + esc(r[1]) + "</i></div>"; }).join("");
  }
  function onClick(e) {
    var row = e.target.closest("[data-agent],[data-lamp]");
    if (!row) return;
    e.stopPropagation();
    if (!card) { card = document.createElement("div"); card.id = "gcard"; document.body.appendChild(card); card.addEventListener("click", hideCard); }
    cardFor = row.hasAttribute("data-agent") ? { agent: row.getAttribute("data-agent") } : { lamp: +row.getAttribute("data-lamp") };
    fillCard(cardFor); card.hidden = false;
    var rc = row.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight;
    card.style.left = Math.max(8, Math.min(innerWidth - cw - 8, rc.right + 10)) + "px";
    card.style.top = Math.max(8, Math.min(innerHeight - ch - 8, rc.top)) + "px";
    if (rc.right + cw + 18 > innerWidth) { card.style.left = Math.max(8, rc.left - cw - 10) + "px"; }
    if (row.hasAttribute("data-lamp")) { card.style.left = Math.max(8, Math.min(innerWidth - cw - 8, rc.left + rc.width / 2 - cw / 2)) + "px"; card.style.top = Math.max(8, rc.top - ch - 10) + "px"; }
  }

  // ------------------------------------------------------------------ data in
  function q(sel) { return root ? root.querySelector(sel) : null; }
  function toast(text, col) {
    var e = q(".g-toast"); if (!e) return;
    e.textContent = text; e.style.color = col || ""; e.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { e.classList.remove("on"); }, 3200);
  }
  function update(st) {
    S = st; cfg = (st && st.ui && st.ui.garage) || {};
    document.body.classList.toggle("g-still", cfg.motion === "off");
    loadPlate();
    agentsNow().forEach(function (a) {   // an agent just finished: high beams
      if (seen[a.name] && seen[a.name] !== "done" && a.state === "done") { beam = 1; toast(cap(split(a.name).who) + " · DONE", "rgb(62,214,110)"); }
      seen[a.name] = a.state;
    });
    try { if (root) dash(); if (cardFor) fillCard(cardFor); } catch (e) { if (window.PULSE_DEBUG) console.error("garage: " + e + " " + e.stack); }
  }
  function fx(f) {
    if (f.kind === "push") { beam = 1; toast("+ REFUEL · " + (share ? "pushed" : f.text)); }
    else if (f.kind === "commit") toast("+ COMMIT · " + (share ? "repo" : f.text));
    else if (f.kind === "fireworks" || f.kind === "burst") { beam = 1; if (f.text) toast(String(f.text).toUpperCase()); }
  }
  function audio(a) {   // cava bars: the low end drives the underglow
    if (!a || !a.length) return;
    var n = Math.max(1, Math.floor(a.length / 4)), s = 0;
    for (var i = 0; i < n; i++) s += +a[i] || 0;
    bass = bass * 0.6 + Math.min(1, s / n / 100) * 0.4; audioAt = performance.now();
  }
  function alert(level) { alertAt = performance.now(); alertCol = level === "crit" ? RED : AMBER; }

  document.addEventListener("click", function (e) {   // the agents' cards, the lights, the fuel (garage and canopy)
    if (!document.body.classList.contains("garage") && !document.body.classList.contains("canopy")) return;
    var fp = e.target.closest && e.target.closest(".panel.clickable[data-gh]");
    if (fp && fp.dataset.gh) { fetch("/api/click/garage-fuel?token=" + encodeURIComponent(TOKEN), { method: "POST" }); return; }
    if (e.target.closest && e.target.closest("[data-agent],[data-lamp]")) onClick(e); else if (card && e.target !== card) hideCard();
  });
  (window.PulseScenes = window.PulseScenes || {}).garage = window.PulseGarage = { hd: true, fps: 15, draw: draw, update: update, panels: panels, agentsPanel: agentsPanel, fx: fx, audio: audio, alert: alert, reset: function () { cache = null; } };
})();
