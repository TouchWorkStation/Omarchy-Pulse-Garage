/* Omarchy Pulse: CommitCanopy ([pulse] scene = "canopy"). A red maple on a rock in a lake at dusk, that grows with your
   code: commits add leaves, branches add limbs, releases make it bloom (GitHub or local Git, see canopy_growth in the
   hub). It never shrinks. Everything Pulse does is here too: the panels, the weather (rain rings the lake, the wind
   moves the leaves, snow), the music (the canopy breathes with the bass), the alerts (a ripple runs across the water),
   your AI agents (fireflies: amber when one waits for you), a push (a gust), a release (the tree blooms).
   Drawn in layers at full resolution: the sky, the mountains and the trunk are cached; only the water, the leaves and
   the fireflies move. (c) 2026 Marco Porro (x.com/MarcoPorro), MIT. */
(function () {
  "use strict";
  var S = null, cfg = {}, view = null, share = false;
  var W = 0, H = 0, L = null;
  var sky = null, skyKey = "", refl = null, sprites = null, spriteKey = "";
  var tree = null, treeSeed = -1, limbsKey = -1;
  var bass = 0, audioAt = 0, gust = 0, bloomFlash = 0, ripples = [], petals = [], sparks = [], drops = [], flies = {};
  var toastEl = null, toastT = null, lastT = 0;

  // ------------------------------------------------------------------ small helpers
  function rnd(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (a == null ? 1 : a) + ")"; }
  function noise1(seed) {   // smooth 1D value noise, a few octaves: the mountains
    var R = rnd(seed), v = []; for (var i = 0; i < 512; i++) v.push(R());
    function n(x) { var i = Math.floor(x), f = x - i, a = v[i & 511], b = v[(i + 1) & 511]; f = f * f * (3 - 2 * f); return a + (b - a) * f; }
    return function (x) { return n(x) * 0.55 + n(x * 2.1 + 7) * 0.27 + n(x * 4.7 + 3) * 0.12 + n(x * 11 + 1) * 0.06; };
  }
  function night() {   // [canopy] sky = "dusk" (always the setting sun), "night", or "auto" (night from 20:00 to 6:00)
    var m = cfg.sky || "dusk", h = new Date().getHours();
    return m === "night" || (m === "auto" && (h >= 20 || h < 6));
  }
  function wxKind() {
    var w = S && S.weather; if (!w || w.error) return "";
    var c = +w.code;
    if (c >= 95) return "storm"; if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rain"; if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
    return "";
  }
  function windNow() { var w = S && S.weather; return clamp(((w && !w.error && +w.wind) || 8) / 30, 0.15, 1.4); }

  // ------------------------------------------------------------------ layout: the lake, the sun, the island
  function layout() {
    var l = { hz: H * 0.64 };
    l.sun = { x: W * 0.37, y: l.hz - H * 0.075, r: H * 0.11 };
    l.isle = { x: W * 0.63, y: l.hz + H * 0.05 };
    l.treeH = H * 0.42; l.treeW = W * 0.6;   // a full-grown tree: wide, its crown under the clock
    return l;
  }

  // ------------------------------------------------------------------ the sky, the sun, the mountains (cached)
  function paintSky(nt) {
    var c = document.createElement("canvas"); c.width = W; c.height = Math.ceil(L.hz) + 2;
    var g = c.getContext("2d"), i, R = rnd(7);
    var gs = g.createLinearGradient(0, 0, 0, L.hz);
    if (nt) { gs.addColorStop(0, "#04050a"); gs.addColorStop(0.6, "#0b0c16"); gs.addColorStop(1, "#24101a"); }
    else { gs.addColorStop(0, "#07080e"); gs.addColorStop(0.45, "#160c14"); gs.addColorStop(0.8, "#3a1218"); gs.addColorStop(1, "#6a1a1c"); }
    g.fillStyle = gs; g.fillRect(0, 0, W, L.hz + 2);
    if (nt) {   // stars
      for (i = 0; i < 260; i++) {
        var a = 0.2 + R() * 0.7; g.fillStyle = "rgba(235,230,240," + (a * (1 - i / 400)).toFixed(2) + ")";
        g.fillRect(R() * W, R() * L.hz * 0.8, R() < 0.1 ? 2 : 1, R() < 0.1 ? 2 : 1);
      }
    }
    var su = L.sun;
    var glow = g.createRadialGradient(su.x, su.y, su.r * 0.6, su.x, su.y, su.r * 4.2);   // the glow over the horizon
    glow.addColorStop(0, nt ? "rgba(220,200,210,0.16)" : "rgba(255,70,50,0.42)"); glow.addColorStop(1, "rgba(255,60,50,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, L.hz + 2);
    // the sun (at night the moon): a disc cut by thin bands of sky as it sets
    g.save(); g.beginPath(); g.arc(su.x, su.y, su.r, 0, Math.PI * 2); g.clip();
    var gd = g.createLinearGradient(0, su.y - su.r, 0, su.y + su.r);
    if (nt) { gd.addColorStop(0, "#e9e2e6"); gd.addColorStop(1, "#b8a8b4"); } else { gd.addColorStop(0, "#ff6a48"); gd.addColorStop(0.55, "#f2322f"); gd.addColorStop(1, "#c4162a"); }
    g.fillStyle = gd; g.fillRect(su.x - su.r, su.y - su.r, su.r * 2, su.r * 2);
    if (!nt) {
      g.globalCompositeOperation = "destination-out";
      for (i = 0; i < 7; i++) {
        var by = su.y + su.r * (-0.08 + i * 0.15), bh = su.r * (0.025 + i * 0.016);
        g.fillStyle = "rgba(0,0,0,0.92)"; g.fillRect(su.x - su.r, by, su.r * 2, bh);
      }
      g.globalCompositeOperation = "source-over";
    }
    g.restore();
    // long thin clouds across the sun
    for (i = 0; i < 9; i++) {
      var cx = W * (0.08 + R() * 0.84), cy = L.hz * (0.25 + R() * 0.55), cw = W * (0.06 + R() * 0.16), ch = H * (0.004 + R() * 0.01);
      var near = Math.abs(cx - su.x) < W * 0.25;
      var gc = g.createLinearGradient(cx - cw, 0, cx + cw, 0);
      var col = nt ? "60,50,70" : near ? "255,90,70" : "150,40,50";
      gc.addColorStop(0, "rgba(" + col + ",0)"); gc.addColorStop(0.5, "rgba(" + col + "," + (near ? 0.55 : 0.35) + ")"); gc.addColorStop(1, "rgba(" + col + ",0)");
      g.fillStyle = gc; g.beginPath(); g.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2); g.fill();
    }
    // three ridges of mountains: far and hazy, then darker, then a dark shore on the left
    var ridges = [
      { seed: 11, base: 0.86, amp: 0.36, freq: 3.2, col: nt ? [26, 24, 38] : [52, 26, 38], snow: true },
      { seed: 23, base: 0.93, amp: 0.2, freq: 5.5, col: nt ? [15, 15, 24] : [28, 18, 28], snow: false },
      { seed: 37, base: 0.985, amp: 0.07, freq: 9, col: [10, 10, 15], snow: false }
    ];
    ridges.forEach(function (rd, k) {
      var n = noise1(rd.seed), pts = [];
      for (var x = 0; x <= W; x += Math.max(2, W / 600)) {
        var u = x / W, ridgeH = n(u * rd.freq) * rd.amp;
        if (k === 0) ridgeH *= 0.55 + 0.45 * Math.exp(-Math.pow((u - 0.62) / 0.16, 2)) + 0.35 * Math.exp(-Math.pow((u - 0.12) / 0.12, 2));   // a peak behind the island, one on the left
        pts.push([x, L.hz * (rd.base - ridgeH)]);
      }
      var gm = g.createLinearGradient(0, L.hz * (rd.base - rd.amp), 0, L.hz);
      gm.addColorStop(0, rgb(rd.col)); gm.addColorStop(1, rgb(mix(rd.col, [8, 8, 12], 0.5)));
      g.fillStyle = gm; g.beginPath(); g.moveTo(0, L.hz + 2);
      pts.forEach(function (p) { g.lineTo(p[0], p[1]); }); g.lineTo(W, L.hz + 2); g.closePath(); g.fill();
      if (rd.snow) {   // snow on the high peaks, lit from the sun's side
        g.save(); g.clip();
        var top = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
        for (var j = 1; j < pts.length - 1; j++) {
          var p = pts[j], depth = p[1] - top;
          if (depth < L.hz * 0.06 && pts[j - 1][1] > p[1] - 1) {
            g.fillStyle = nt ? "rgba(200,200,220,0.16)" : "rgba(255,190,190,0.18)";
            g.fillRect(p[0], p[1], Math.max(2, W / 600), (L.hz * 0.06 - depth) * 0.8);
          }
        }
        g.restore();
      }
      // a red rim of light along the ridge from the sun
      if (!nt) {
        g.strokeStyle = "rgba(255,80,60," + (k === 0 ? 0.22 : 0.12) + ")"; g.lineWidth = Math.max(1, H / 900);
        g.beginPath(); pts.forEach(function (p, i2) { if (i2) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
      }
    });
    // the haze on the water line
    var gh = g.createLinearGradient(0, L.hz - H * 0.05, 0, L.hz);
    gh.addColorStop(0, "rgba(120,30,40,0)"); gh.addColorStop(1, nt ? "rgba(40,30,50,0.35)" : "rgba(150,40,40,0.35)");
    g.fillStyle = gh; g.fillRect(0, L.hz - H * 0.05, W, H * 0.05 + 2);
    var v = g.createRadialGradient(W / 2, H * 0.55, H * 0.4, W / 2, H * 0.55, W * 0.72);   // darker at the edges, under the panels
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = v; g.fillRect(0, 0, W, L.hz + 2);
    return c;
  }

  // ------------------------------------------------------------------ the tree: built once per seed, revealed by growth
  // Every limb and every bunch of leaves has a "birth" (0..1): at growth g, what was born before g is there.
  function buildTree(seed, limbs) {
    var R = rnd(seed * 7 + 13), segs = [], leaves = [];
    var mains = clamp(3 + Math.floor(Math.log(1 + limbs) / Math.LN2 / 1.8), 3, 7);   // your branches: more main limbs
    function seg(x, y, ang, len, w0, w1, depth, birth, span, bendAmt) {
      var bend = bendAmt == null ? (R() - 0.5) * 0.5 : bendAmt;
      var x1 = x + Math.cos(ang + bend) * len, y1 = y + Math.sin(ang + bend) * len;
      var cx = x + Math.cos(ang) * len * 0.55, cy = y + Math.sin(ang) * len * 0.55;
      segs.push({ x0: x, y0: y, cx: cx, cy: cy, x1: x1, y1: y1, w0: w0, w1: w1, d: depth, b: birth, e: birth + span });
      return { x: x1, y: y1, a: Math.atan2(y1 - cy, x1 - cx) };
    }
    function pad(x, y, size, birth) {   // a cloud of leaves, wide and flat, like a maple's layered crown
      var n = 4 + Math.floor(R() * 3);
      for (var k = 0; k < n; k++) {
        var u = (k / (n - 1) - 0.5) * 2;
        leaves.push({ x: x + u * size * 1.25 + (R() - 0.5) * size * 0.3, y: y - (1 - u * u) * size * 0.35 + (R() - 0.5) * size * 0.2,
                      r: size * (0.55 + R() * 0.25) * (1 - Math.abs(u) * 0.25), b: birth + R() * 0.03, ph: R() * 6.28 });
      }
    }
    function limb(x, y, ang, len, w, depth, birth) {
      // limbs reach out and level off: pulled towards the horizontal on their own side
      var side = Math.cos(ang) < 0 ? -1 : 1, level = side < 0 ? -Math.PI + 0.25 : -0.25;
      var a = ang * 0.7 + level * 0.3 + (R() - 0.5) * 0.25;
      var e = seg(x, y, a, len, w, w * 0.62, depth, birth, 0.1, (R() - 0.5) * 0.35);
      var end = birth + 0.1;
      // leaves come with their limb (a young tree is leafy, not a bare frame); the pads at the tips stay
      if (depth >= 4 || w < 9) { pad(e.x, e.y, 120 + R() * 50, birth + 0.03); return; }
      if (depth >= 2 && R() < 0.75) pad((x + e.x) / 2, (y + e.y) / 2 - 30, 85 + R() * 30, birth + 0.02);
      var n = depth === 1 ? 3 : 2;
      for (var i = 0; i < n; i++) {
        var f = n === 1 ? 0 : i / (n - 1) - 0.5;
        limb(e.x, e.y, a + f * (0.9 + R() * 0.3) - 0.15, len * (0.66 + R() * 0.12), w * 0.64, depth + 1, end - 0.01 + i * 0.012);
      }
    }
    // the trunk: thick, leaning, with a twist, to about a third of the height
    var p = seg(0, 0, -Math.PI / 2 - 0.25, 170, 150, 118, 0, 0, 0.12, 0.35);
    p = seg(p.x, p.y, -Math.PI / 2 + 0.25, 150, 118, 92, 0, 0.1, 0.12, -0.3);
    for (var i = 0; i < mains; i++) {
      var f = i / (mains - 1);   // from far left (over the water) to the right
      var ang = -Math.PI + 0.12 + f * (Math.PI - 0.3) + (R() - 0.5) * 0.15;
      var len = (f < 0.35 ? 340 : f > 0.75 ? 260 : 200) + R() * 60;
      limb(p.x, p.y, ang, len, 78 - Math.abs(f - 0.4) * 30, 1, 0.2 + i * 0.03);
    }
    pad(p.x, p.y - 120, 150, 0.35);   // the crown's heart
    // the trunk's flare into the rock
    segs.unshift({ x0: -95, y0: 8, cx: -40, cy: -8, x1: 0, y1: -60, w0: 70, w1: 110, d: 0, b: 0, e: 0.05 });
    segs.unshift({ x0: 105, y0: 8, cx: 45, cy: -6, x1: 0, y1: -60, w0: 60, w1: 100, d: 0, b: 0, e: 0.05 });
    // births on one scale: the whole tree is there at 0.8, leaves come in from the first days
    var last = 0; segs.forEach(function (s) { last = Math.max(last, s.e); }); leaves.forEach(function (l) { last = Math.max(last, l.b); });
    var fb = 0.8 / last;
    segs.forEach(function (s) { s.b *= fb; s.e *= fb; }); leaves.forEach(function (l) { l.b = Math.min(0.95, l.b * fb); });
    for (var sp = 0; sp < 5; sp++) leaves.push({ x: (sp - 2) * 70, y: -330 - (sp % 2) * 50, r: 95, b: 0, ph: sp * 2 });   // the seedling's first leaves
    leaves.sort(function (a, b) { return a.b - b.b; });
    var minX = 0, maxX = 0, minY = 0;
    leaves.forEach(function (l) { minX = Math.min(minX, l.x - l.r); maxX = Math.max(maxX, l.x + l.r); minY = Math.min(minY, l.y - l.r); });
    return { segs: segs, leaves: leaves, minX: minX, maxX: maxX, minY: minY, h: -minY, w: maxX - minX };
  }
  function scaleNow(g) { return Math.min(L.treeH / tree.h, L.treeW / tree.w) * (0.3 + 0.7 * smooth(Math.pow(g, 0.7))); }
  function bez(s, t) {
    var u = 1 - t;
    return [u * u * s.x0 + 2 * u * t * s.cx + t * t * s.x1, u * u * s.y0 + 2 * u * t * s.cy + t * t * s.y1];
  }
  function paintWood(g, gr) {   // the trunk and the limbs
    var k = scaleNow(gr), ox = L.isle.x, oy = L.isle.y - H * 0.012;
    g.lineCap = "round"; g.lineJoin = "round";
    tree.segs.forEach(function (s) {
      if (s.b > gr) return;
      var f = clamp((gr - s.b) / Math.max(0.01, s.e - s.b), 0, 1);   // still growing: part of its length
      var steps = 10, pts = [];
      for (var i = 0; i <= steps; i++) { var p = bez(s, i / steps * f); pts.push([ox + p[0] * k, oy + p[1] * k, (s.w0 + (s.w1 - s.w0) * i / steps) * k * (0.5 + 0.5 * f)]); }
      // the bark: dark, a crimson rim on the sun's side, a hint of texture
      for (i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        g.strokeStyle = "#1c1114"; g.lineWidth = Math.max(1, b[2]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      for (i = 1; i < pts.length; i++) {
        a = pts[i - 1]; b = pts[i];
        var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
        if (nx > 0) { nx = -nx; ny = -ny; }   // the left edge: towards the sun
        var off = b[2] * 0.36;
        g.strokeStyle = "rgba(255,90,70,0.42)"; g.lineWidth = Math.max(1, b[2] * 0.12);
        g.beginPath(); g.moveTo(a[0] + nx * off, a[1] + ny * off); g.lineTo(b[0] + nx * off, b[1] + ny * off); g.stroke();
        if (s.d <= 1 && b[2] > 8) {
          g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = Math.max(1, b[2] * 0.05);
          g.beginPath(); g.moveTo(a[0] - nx * off * 0.2, a[1] - ny * off * 0.2); g.lineTo(b[0] - nx * off * 0.3, b[1] - ny * off * 0.3); g.stroke();
        }
      }
    });
  }
  function paintIsland(c) {   // the rocks the tree grows on: craggy, dark, lit red from the left
    {
      var R = rnd(91), ix = L.isle.x, iy = L.isle.y, rocks = [];
      for (var i = 0; i < 22; i++) {
        var u = (R() - 0.42) * 2, hump = Math.max(0, 1 - Math.abs(u) * 0.9);
        rocks.push({ x: ix + u * W * 0.12, y: iy + H * 0.012 + R() * H * 0.02 - hump * H * 0.02, r: H * (0.014 + R() * 0.026) * (0.5 + hump), s: R() * 1000 });
      }
      rocks.sort(function (a, b) { return a.y - b.y; });
      rocks.forEach(function (r) {
        var Rr = rnd(r.s | 0 || 1), n = 9, pts = [];
        for (var j = 0; j <= n; j++) {   // a craggy top, a flat waterline
          var a = Math.PI + Math.PI * j / n, rr = r.r * (0.75 + Rr() * 0.4);
          pts.push([r.x + Math.cos(a) * rr * 1.5, r.y + Math.sin(a) * rr * (0.9 + Rr() * 0.3)]);
        }
        var gr = c.createLinearGradient(r.x - r.r * 1.4, r.y - r.r, r.x + r.r, r.y);
        gr.addColorStop(0, "#3a1a1e"); gr.addColorStop(0.35, "#1a1114"); gr.addColorStop(1, "#070608");
        c.fillStyle = gr; c.beginPath(); pts.forEach(function (p, k) { if (k) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fill();
        c.strokeStyle = "rgba(255,80,60,0.4)"; c.lineWidth = Math.max(1, H / 700);   // the sun on the left faces
        c.beginPath(); for (var k = 0; k < 4; k++) { if (k) c.lineTo(pts[k][0], pts[k][1]); else c.moveTo(pts[k][0], pts[k][1]); } c.stroke();
      });
    }
  }
  // bunches of maple leaves: a few sprites, drawn once per size and colour
  function leafShape(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
    for (var i = 0; i < 5; i++) {   // five pointed lobes
      var a = -Math.PI / 2 + (i - 2) * 0.62, a1 = a - 0.22, a2 = a + 0.22;
      g.lineTo(Math.cos(a1) * s * 0.45, Math.sin(a1) * s * 0.45);
      g.lineTo(Math.cos(a) * s * (i === 2 ? 1 : i === 0 || i === 4 ? 0.62 : 0.85), Math.sin(a) * s * (i === 2 ? 1 : i === 0 || i === 4 ? 0.62 : 0.85));
      g.lineTo(Math.cos(a2) * s * 0.45, Math.sin(a2) * s * 0.45);
    }
    g.lineTo(0, s * 0.25); g.closePath(); g.fill(); g.restore();
  }
  function makeSprites(vigor, nt) {
    var out = [], size = Math.max(48, Math.round(H * 0.07)), R = rnd(5);
    // the colours: lush crimson when you ship, darker and drier when the week is quiet
    var lit = mix([170, 52, 48], [255, 92, 72], vigor), mid = mix([110, 22, 30], [205, 28, 38], vigor), dark = mix([30, 8, 12], [70, 10, 18], vigor);
    if (nt) { lit = mix(lit, [90, 60, 80], 0.35); mid = mix(mid, [60, 30, 50], 0.3); }
    [["dark", dark, 0.92], ["mid", mid, 0.85], ["lit", lit, 0.9]].forEach(function (tone) {
      for (var v = 0; v < 5; v++) {
        var c = document.createElement("canvas"); c.width = c.height = size * 2;
        var g = c.getContext("2d"), n = tone[0] === "lit" ? 34 : 52, top = tone[0] === "lit";
        var massA = tone[0] === "dark" ? 0.85 : tone[0] === "mid" ? 0.45 : 0;   // the bunch's shadowed body
        if (massA) {
          var mass = g.createRadialGradient(size * 0.9, size * 0.85, size * 0.1, size, size, size * 0.85);
          mass.addColorStop(0, rgb(tone[1], massA)); mass.addColorStop(0.7, rgb(mix(tone[1], [0, 0, 0], 0.3), massA * 0.7)); mass.addColorStop(1, rgb(tone[1], 0));
          g.fillStyle = mass; g.beginPath(); g.ellipse(size, size, size * 0.88, size * 0.66, 0, 0, Math.PI * 2); g.fill();
        }
        for (var i = 0; i < n; i++) {
          var a = top ? -Math.PI * (0.1 + R() * 0.8) : R() * Math.PI * 2, d = Math.pow(R(), 0.5) * size * (top ? 0.75 : 0.8), x = size + Math.cos(a) * d * 1.1, y = size + Math.sin(a) * d * 0.8;
          var lift = clamp(0.5 - (y - size) / size * 0.6 - (x - size) / size * 0.25, 0, 1);   // lighter towards the sun (up, left)
          var col = mix(tone[1], mix(tone[1], [255, 120, 100], 0.25), lift * (tone[0] === "dark" ? 0.2 : 0.7));
          g.fillStyle = rgb(mix(col, [0, 0, 0], R() * 0.25), tone[2]);
          leafShape(g, x, y, size * (0.13 + R() * 0.1), R() * 6.28);
        }
        out.push({ tone: tone[0], c: c, size: size });
      }
    });
    // a blossom: pale pink and white, for each release
    var b = document.createElement("canvas"), bs = Math.round(size * 0.5); b.width = b.height = bs * 2;
    var gb = b.getContext("2d"), glw = gb.createRadialGradient(bs, bs, 0, bs, bs, bs);
    glw.addColorStop(0, "rgba(255,230,235,0.9)"); glw.addColorStop(0.3, "rgba(255,170,190,0.55)"); glw.addColorStop(1, "rgba(255,120,150,0)");
    gb.fillStyle = glw; gb.fillRect(0, 0, bs * 2, bs * 2);
    for (var i2 = 0; i2 < 9; i2++) { gb.fillStyle = "rgba(255,240,244,0.95)"; var aa = R() * 6.28, dd = R() * bs * 0.35; gb.beginPath(); gb.arc(bs + Math.cos(aa) * dd, bs + Math.sin(aa) * dd, bs * 0.09, 0, 7); gb.fill(); }
    out.bloom = { c: b, size: bs };
    return out;
  }

  // ------------------------------------------------------------------ the frame
  function visibleLeaves(gr) {   // commits add leaves: the more you committed, the fuller the crown it has grown
    var dens = view ? 0.35 + 0.65 * (1 - Math.exp(-(view.leaves || 0) / 900)) : 0.6;
    return tree.leaves.filter(function (l, i) { return l.b <= gr && ((i * 0.618) % 1) < dens + 0.05; });
  }
  function drawLeaves(g, list, gr, t, mv, reflect) {
    var k = scaleNow(gr), ox = L.isle.x, oy = L.isle.y - H * 0.012, wind = (cfg.wind === false ? 0.3 : windNow()) + gust * 1.5 + bass * 0.6;
    var tones = { dark: sprites.filter(function (s) { return s.tone === "dark"; }), mid: sprites.filter(function (s) { return s.tone === "mid"; }), lit: sprites.filter(function (s) { return s.tone === "lit"; }) };
    ["dark", "mid", "lit"].forEach(function (tone, ti) {
      list.forEach(function (l, i) {
        var grow = clamp((gr - l.b) / 0.04, 0.15, 1);   // a new bunch unfolds
        var h = clamp(-l.y / tree.h, 0, 1), amp = mv === "full" && !reflect ? H * 0.004 * wind * (0.4 + h) : 0;
        var sx = amp * Math.sin(t * 0.7 + l.ph) + amp * 0.4 * Math.sin(t * 1.9 + l.ph * 2);
        var sy = amp * 0.35 * Math.cos(t * 0.9 + l.ph);
        var sp = tones[tone][i % 5], r = l.r * k * grow * (tone === "lit" ? 0.62 : tone === "dark" ? 1.12 : 0.95);
        var x = ox + l.x * k + sx + (tone === "dark" ? r * 0.18 : tone === "lit" ? -r * 0.2 : 0), y = oy + l.y * k + sy + (tone === "dark" ? r * 0.15 : tone === "lit" ? -r * 0.22 : 0);
        g.drawImage(sp.c, x - r, y - r, r * 2, r * 2);
      });
    });
    // blooms: one for each release, at the edge of the crown
    var nb = Math.min(60, (view && view.blooms) || 0), bl = sprites.bloom;
    if (nb && list.length) {
      g.save(); g.globalCompositeOperation = "lighter";
      for (var j = 0; j < nb; j++) {
        var l = list[(j * 37) % list.length], r2 = l.r * k * 0.32 * (1 + bloomFlash * 0.8);
        g.globalAlpha = 0.35 + bloomFlash * 0.5;
        g.drawImage(bl.c, ox + (l.x + Math.cos(l.ph) * l.r * 0.6) * k - r2, oy + (l.y + Math.sin(l.ph) * l.r * 0.5) * k - r2, r2 * 2, r2 * 2);
      }
      g.restore();
    }
  }
  // the tree, cached in two pictures the size of its box: the island and the wood, then the crown (which the wind
  // sways in thin bands, like the water: smooth, and cheap even at 4K)
  var treeC = null, crownC = null, box = null, treeKey = "";
  function treeBox(gr) {
    var k = scaleNow(gr), ox = L.isle.x, oy = L.isle.y - H * 0.012, x0 = L.isle.x - W * 0.17, x1 = L.isle.x + W * 0.17, y0 = oy - H * 0.05;
    tree.leaves.forEach(function (l) { if (l.b > gr) return; x0 = Math.min(x0, ox + (l.x - l.r * 1.3) * k); x1 = Math.max(x1, ox + (l.x + l.r * 1.3) * k); y0 = Math.min(y0, oy + (l.y - l.r * 1.3) * k); });
    tree.segs.forEach(function (s2) { if (s2.b > gr) return; y0 = Math.min(y0, oy + Math.min(s2.y0, s2.y1) * k - 40 * k); });
    var pad = H * 0.02;
    x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(W, Math.ceil(x1 + pad));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, Math.ceil(L.isle.y + H * 0.07 - y0)) };
  }
  function ensure(now) {
    var nt = night(), gr = view ? view.growth : 0.6, vig = Math.round(((view && view.vigor) || 0.6) * 10) / 10;
    if (!L || !sky || skyKey !== W + "x" + H + nt) { L = layout(); sky = paintSky(nt); skyKey = W + "x" + H + nt; treeKey = ""; spriteKey = ""; }
    var seed = (view && view.seed) || 4242, limbs = (view && view.limbs) || 4, dens = view ? Math.round((1 - Math.exp(-(view.leaves || 0) / 900)) * 50) : 25;
    var lk = Math.min(6, Math.floor(Math.log(1 + limbs) / Math.LN2 / 1.8));
    if (!tree || treeSeed !== seed || limbsKey !== lk) { tree = buildTree(seed, limbs); treeSeed = seed; limbsKey = lk; treeKey = ""; }
    var sk = W + "x" + H + vig + nt;
    if (spriteKey !== sk) { sprites = makeSprites(vig, nt); spriteKey = sk; treeKey = ""; }
    var key = W + "x" + H + gr.toFixed(3) + seed + lk + dens + "|" + ((view && view.blooms) || 0) + sk;
    if (treeKey === key) return;
    treeKey = key; box = treeBox(gr);
    treeC = document.createElement("canvas"); treeC.width = box.w; treeC.height = box.h;
    var g = treeC.getContext("2d"); g.translate(-box.x, -box.y); paintIsland(g); paintWood(g, gr);
    crownC = document.createElement("canvas"); crownC.width = box.w; crownC.height = box.h;
    g = crownC.getContext("2d"); g.translate(-box.x, -box.y); drawLeaves(g, visibleLeaves(gr), gr, 0, "off", true);
    // what the lake reflects: the sky and the still tree, in one picture
    refl = document.createElement("canvas"); refl.width = W; refl.height = Math.ceil(L.hz);
    g = refl.getContext("2d"); g.drawImage(sky, 0, 0); g.drawImage(treeC, box.x, box.y); g.drawImage(crownC, box.x, box.y);
  }
  function drawCrown(g, t, mv) {
    var still = mv !== "full", wind = (cfg.wind === false ? 0.3 : windNow()) + gust * 1.5 + bass * 0.6;
    if (still) { g.drawImage(crownC, box.x, box.y); return; }
    var n = Math.max(24, Math.round(box.h / (H / 180))), bh = box.h / n, amp = H * 0.0035 * wind;
    for (var i = 0; i < n; i++) {   // the top moves most, the leaves near the trunk barely
      var y = i * bh, hf = 1 - i / n;
      var dx = amp * hf * (Math.sin(t * 0.7 + i * 0.22) + 0.4 * Math.sin(t * 1.7 + i * 0.5));
      g.drawImage(crownC, 0, y, box.w, bh + 1, box.x + dx, box.y + y, box.w, bh + 1);
    }
    if (bloomFlash > 0.03 && view && view.blooms) {   // a release: the blossoms flare
      g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = bloomFlash * 0.6; g.drawImage(crownC, box.x, box.y); g.restore();
    }
  }
  function drawWater(g, t, mv) {
    var hz = L.hz, wh = H - hz, nt = night();
    g.fillStyle = nt ? "#05060a" : "#0a070b"; g.fillRect(0, hz, W, wh);
    // the reflection, in thin strips that sway: the lake barely moves
    var strip = Math.max(3, Math.round(H / 360)), still = mv === "off";
    for (var y = 0; y < wh; y += strip) {
      var depth = y / wh, sy = hz - y * 1.02 - strip;
      if (sy < 0) break;
      var amp = still ? 0 : (0.6 + depth * 5.5) * (H / 1080) * (1 + bass * 0.5);
      var dx = amp * Math.sin(t * 0.9 + y * 0.09 / (H / 1080)) + amp * 0.5 * Math.sin(t * 0.43 - y * 0.031 / (H / 1080));
      g.globalAlpha = 0.6 * (1 - depth * 0.8);
      g.drawImage(refl, 0, sy, W, strip, dx, hz + y, W, strip);
    }
    g.globalAlpha = 1;
    // the sun's path on the water: short bright lines that come and go
    var su = L.sun, R = rnd(3);
    g.save(); g.globalCompositeOperation = "lighter";
    for (var i = 0; i < 46; i++) {
      var ly = hz + Math.pow(R(), 1.6) * wh * 0.8, spread = su.r * (0.6 + (ly - hz) / wh * 1.8);
      var lx = su.x + (R() - 0.5) * 2 * spread, lw = su.r * (0.15 + R() * 0.6) * (0.5 + (ly - hz) / wh);
      var a = still ? 0.25 : 0.25 + 0.25 * Math.sin(t * (0.6 + R()) + i);
      g.fillStyle = nt ? "rgba(220,215,230," + (a * 0.5).toFixed(3) + ")" : "rgba(255,80,60," + a.toFixed(3) + ")";
      g.fillRect(lx - lw / 2, ly, lw, Math.max(1, H / 1080 * 1.5));
    }
    g.restore();
    // the shoreline glow under the island
    var gi = g.createRadialGradient(L.isle.x, L.isle.y + H * 0.02, 0, L.isle.x, L.isle.y + H * 0.02, W * 0.16);
    gi.addColorStop(0, "rgba(255,60,50,0.10)"); gi.addColorStop(1, "rgba(255,60,50,0)");
    g.fillStyle = gi; g.fillRect(L.isle.x - W * 0.17, hz, W * 0.34, H * 0.1);
  }
  function drawRipples(g, now) {   // rain rings, an alert's ripple, a falling petal's touch
    ripples = ripples.filter(function (r) { return now - r.t < r.life; });
    ripples.forEach(function (r) {
      var p = (now - r.t) / r.life, rad = r.r * (0.1 + p);
      g.strokeStyle = r.col.replace("A", (r.a * (1 - p)).toFixed(3)); g.lineWidth = Math.max(1, H / 900) * (r.big ? 2 : 1);
      g.beginPath(); g.ellipse(r.x, r.y, rad, rad * 0.18, 0, 0, Math.PI * 2); g.stroke();
    });
  }
  function drawWeather(g, t, now, mv) {
    var k = wxKind(); if (!k || mv === "off") return;
    if (!drops.length) { var R = rnd(17); for (var i = 0; i < 160; i++) drops.push([R(), R(), 0.6 + R() * 0.8]); }
    g.save();
    g.strokeStyle = k === "snow" ? "rgba(240,238,245,0.7)" : "rgba(210,190,200,0.22)"; g.lineWidth = k === "snow" ? Math.max(2, H / 400) : Math.max(1, H / 1080);
    g.lineCap = "round"; g.beginPath();
    var slant = windNow() * 0.25;
    drops.forEach(function (d) {
      var sp = k === "snow" ? 0.04 : 0.55, y = ((d[1] + t * sp * d[2]) % 1) * H, x = (d[0] * W + y * slant + (k === "snow" ? Math.sin(t + d[0] * 9) * H * 0.01 : 0)) % W;
      if (k === "snow") { g.moveTo(x, y); g.lineTo(x + 0.5, y + 0.5); } else { g.moveTo(x, y); g.lineTo(x - H * 0.006 * slant * 4, y + H * 0.022); }
    });
    g.stroke(); g.restore();
    if (k !== "snow" && Math.random() < 0.5) ripples.push({ x: Math.random() * W, y: L.hz + Math.pow(Math.random(), 0.7) * (H - L.hz), r: H * 0.012, t: now, life: 1400, a: 0.4, col: "rgba(220,200,210,A)" });
    if (k === "storm" && (t % 11) < 0.1) { g.fillStyle = "rgba(230,220,255,0.12)"; g.fillRect(0, 0, W, L.hz); }
  }
  function drawPetals(g, now, dt, mv) {   // leaves that let go: a few always, a gust of them when you push
    if (mv !== "off" && petals.length < 14 && Math.random() < 0.02 + (1 - ((view && view.vigor) || 0.5)) * 0.03) spawnPetal();
    petals = petals.filter(function (p) { return p.y < p.floor; });
    petals.forEach(function (p) {
      p.vy += 0.000008 * H * dt; p.x += (p.vx + windNow() * H * 0.00003) * dt; p.y += p.vy * dt * 0.05 + 0.00004 * H * dt; p.rot += p.vr * dt;
      if (p.y >= p.floor) ripples.push({ x: p.x, y: p.floor, r: H * 0.01, t: now, life: 1600, a: 0.35, col: "rgba(255,90,80,A)" });
      g.fillStyle = p.col; leafShape(g, p.x, p.y, H * 0.008, p.rot);
    });
  }
  function spawnPetal(bloom) {
    if (!tree) return;
    var ls = visibleLeaves(view ? view.growth : 0.6); if (!ls.length) return;
    var l = ls[(Math.random() * ls.length) | 0], k = scaleNow(view ? view.growth : 0.6);
    petals.push({ x: L.isle.x + l.x * k, y: L.isle.y + l.y * k, vx: (Math.random() - 0.6) * H * 0.00004, vy: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.004,
      floor: L.hz + H * (0.04 + Math.random() * 0.25), col: bloom ? "rgba(255,225,235,0.9)" : "rgba(" + (190 + Math.random() * 60 | 0) + ",40,45,0.9)" });
  }
  // your agents: fireflies around the crown; one that waits for you hangs by the trunk and pulses amber
  function drawFlies(g, t, mv) {
    if (cfg.fireflies === false) return;
    var ag = ((S && S.agents) || []).filter(function (a) { return !a.crew && a.state !== "gone"; }), k = scaleNow(view ? view.growth : 0.6);
    g.save(); g.globalCompositeOperation = "lighter";
    ag.slice(0, 12).forEach(function (a, i) {
      var h = 0; for (var j = 0; j < a.name.length; j++) h = (h * 31 + a.name.charCodeAt(j)) | 0;
      var ph = (Math.abs(h) % 628) / 100, tt = mv === "off" ? 0 : t;
      var x, y, col, rr = H * 0.006, al = 0.9;
      if (a.state === "waiting") {
        x = L.isle.x + (i % 2 ? 1 : -1) * H * 0.05; y = L.isle.y - H * 0.06 - (i % 3) * H * 0.02;
        col = "255,180,60"; rr *= 1.6; al = mv === "off" ? 1 : 0.5 + 0.5 * Math.sin(t * 4);
      } else {
        var cx = L.isle.x + (tree.minX + tree.maxX) / 2 * k, cy = L.isle.y - tree.h * k * 0.6;
        x = cx + Math.sin(tt * 0.31 + ph) * (tree.maxX - tree.minX) * k * 0.55 + Math.sin(tt * 1.3 + ph * 3) * H * 0.01;
        y = cy + Math.sin(tt * 0.23 + ph * 2) * tree.h * k * 0.35 + Math.cos(tt * 1.1 + ph) * H * 0.008;
        col = a.state === "failed" ? "255,60,60" : a.state === "done" ? "90,220,140" : a.state === "working" ? "255,235,190" : "160,150,170";
        al = a.state === "idle" ? 0.35 : 0.85 + 0.15 * Math.sin(t * 3 + ph);
      }
      var gl = g.createRadialGradient(x, y, 0, x, y, rr * 6);
      gl.addColorStop(0, "rgba(" + col + "," + (al * 0.9).toFixed(2) + ")"); gl.addColorStop(0.2, "rgba(" + col + "," + (al * 0.35).toFixed(2) + ")"); gl.addColorStop(1, "rgba(" + col + ",0)");
      g.fillStyle = gl; g.fillRect(x - rr * 6, y - rr * 6, rr * 12, rr * 12);
    });
    g.restore();
  }
  function draw(g, w, h, now, flags) {
    share = !!(flags && (flags.share || flags.privacy));
    if (w !== W || h !== H) { W = w; H = h; L = null; sky = null; drops = []; }
    var mv = cfg.motion || "full", t = now / 1000, dt = lastT ? Math.min(200, now - lastT) : 16; lastT = now;
    ensure(now);
    if (performance.now() - audioAt > 600) bass *= 0.9;
    gust *= 0.985; bloomFlash *= 0.97;
    var gr = view ? view.growth : 0.6;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    g.drawImage(sky, 0, 0);
    // clouds drifting very slowly over the sky
    drawWater(g, t, mv);
    drawRipples(g, now);
    g.drawImage(treeC, box.x, box.y);
    drawCrown(g, t, mv);
    drawPetals(g, now, dt, mv);
    drawFlies(g, t, mv);
    drawWeather(g, t, now, mv);
  }

  // ------------------------------------------------------------------ the panel: how the tree is doing
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function setH(e, html) { if (e._h !== html) { e._h = html; e.innerHTML = html; } }
  function panels(st, left, right, panel, bodyOf) {
    S = st; cfg = (st.ui && st.ui.canopy) || {}; view = st.canopy || view;
    if (window.PulseGarage && window.PulseGarage.agentsPanel)
      left.unshift(window.PulseGarage.agentsPanel(st, panel, bodyOf, cfg, "in the grove", "the grove is quiet"));
    if (cfg.panel === false) return;
    var v = view, pc = panel("c-tree", "canopy · " + (v ? v.stage : "planting"), "");
    if (!v) { setH(bodyOf(pc), '<div class="c-note">reading your repositories…</div>'); right.unshift(pc); return; }
    var vig = v.vigor >= 0.75 ? "lush" : v.vigor >= 0.35 ? "growing" : v.vigor >= 0.15 ? "thirsty" : "dry · commit to water it";
    var gn = v.grown || {};
    var rows = [["leaves", v.leaves, "commits", gn.leaves], ["limbs", v.limbs, "branches", gn.limbs], ["blooms", v.blooms, "releases", gn.blooms]];
    setH(bodyOf(pc), '<div class="c-head"><div class="c-pct"><span>' + Math.round(v.growth * 100) + '</span><small>%</small></div><div><b>' + esc(v.stage) +
      "</b><span>planted " + (v.days ? v.days + (v.days === 1 ? " day" : " days") + " ago" : "today") + "</span></div></div>" +
      '<div class="c-bar"><i style="width:' + (v.growth * 100).toFixed(1) + '%"></i></div>' +
      rows.map(function (r) { return '<div class="c-row"><span class="k">' + r[0] + '</span><span class="n">' + Number(r[1] || 0).toLocaleString("en-US") +
        '</span><span class="s">' + r[2] + (r[3] ? ' · <b>+' + r[3] + "</b>" : "") + "</span></div>"; }).join("") +
      '<div class="c-vig">this week · <b class="' + (v.vigor < 0.15 ? "crit" : v.vigor < 0.35 ? "warn" : "ok") + '">' + vig + "</b></div>" +
      // every GitHub account that feeds the tree, with its week
      ((v.accounts || []).length ? '<div class="c-accts">' + v.accounts.map(function (a, i) {
        return '<div class="c-acct"><span class="at">' + esc(share ? "account " + (i + 1) : "@" + a.login) + '</span><span>' + a.commits + " commits · " + a.pushes + " pushes" +
          (a.releases ? " · " + a.releases + " rel" : "") + "</span></div>";
      }).join("") + "</div>" : ""));
    right.unshift(pc);
  }

  // ------------------------------------------------------------------ data in
  function toast(text) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "c-toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = text; toastEl.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 3200);
  }
  function update(st) {
    S = st; cfg = (st && st.ui && st.ui.canopy) || {}; view = (st && st.canopy) || view;
    document.body.classList.toggle("c-still", cfg.motion === "off");
  }
  function fx(f) {
    if (!L) return;
    var now = performance.now();
    if (f.kind === "commit") { toast("+ LEAF · " + (share ? "commit" : f.text)); for (var i = 0; i < 3; i++) spawnPetal(); }
    else if (f.kind === "push") { toast("+ GROWTH · " + (share ? "pushed" : f.text)); gust = 1; for (i = 0; i < 8; i++) spawnPetal(); }
    else if (f.kind === "fireworks" || f.kind === "burst") { bloomFlash = 1; for (i = 0; i < 10; i++) spawnPetal(true); }   // Pulse shows the text
    if (f.kind === "push" || f.kind === "fireworks") ripples.push({ x: L.isle.x, y: L.isle.y + H * 0.03, r: W * 0.25, t: now, life: 3500, a: 0.5, col: "rgba(255,120,100,A)", big: true });
  }
  function audio(a) {
    if (!a || !a.length) return;
    var n = Math.max(1, Math.floor(a.length / 4)), s = 0;
    for (var i = 0; i < n; i++) s += +a[i] || 0;
    bass = bass * 0.6 + Math.min(1, s / n / 100) * 0.4; audioAt = performance.now();
  }
  function alert(level) {   // an alert: a ripple runs out across the whole lake
    if (!L) return;
    ripples.push({ x: L.isle.x, y: L.isle.y + H * 0.04, r: W * 0.6, t: performance.now(), life: 4000, a: 0.8, col: level === "crit" ? "rgba(255,60,60,A)" : "rgba(255,180,60,A)", big: true });
  }

  (window.PulseScenes = window.PulseScenes || {}).canopy = window.PulseCanopy = { hd: true, fps: 24, draw: draw, update: update, panels: panels, fx: fx, audio: audio, alert: alert };
})();
