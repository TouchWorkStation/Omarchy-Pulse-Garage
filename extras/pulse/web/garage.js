/* Omarchy Pulse: the garage scene ([pulse] scene = "garage"). Your PC is a car in a dark workshop: its gauges are
   your CPU, GPU, memory and disk, its fuel is the work you ship (commits, pushes, branches of the last 7 days), and
   your AI agents are the mechanics working on it. A mechanic that needs you turns the hazard lights on.
   Everything here is drawn from /api/state: nothing is made up. An original, unbranded car; no logos.
   (c) 2026 Marco Porro (x.com/MarcoPorro), MIT. */
(function () {
  "use strict";
  var P = {
    crimson: [196, 24, 44], neon: [255, 42, 62], silver: [196, 200, 208], white: [236, 238, 244],
    amber: [255, 176, 46], red: [255, 52, 66], green: [70, 214, 124], dim: [84, 88, 98], warm: [255, 226, 190]
  };
  var OVERALLS = [[150, 156, 168], [168, 34, 48], [70, 98, 142], [128, 118, 74], [150, 108, 72], [104, 78, 138], [62, 120, 118]];
  var RANK = { failed: 0, waiting: 1, working: 2, done: 3, idle: 4 };
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function dur(sec) {
    sec = Math.max(0, sec | 0);
    if (sec < 60) return sec + "s";
    if (sec < 3600) return Math.floor(sec / 60) + "m";
    return Math.floor(sec / 3600) + "h " + Math.floor(sec % 3600 / 60) + "m";
  }
  function bytes(n) {
    var u = ["B/s", "KB/s", "MB/s", "GB/s"], i = 0; n = +n || 0;
    while (n >= 1000 && i < 3) { n /= 1000; i++; }
    return (n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
  }
  // "claude · omarchytv" -> provider "claude", project "omarchytv". Any provider Pulse knows works: nothing is hardcoded.
  function split(name) {
    var p = String(name || "agent").split(" · ");
    return { who: p[0].trim() || "agent", project: p.slice(1).join(" · ").trim() };
  }

  var S = null, ui = {}, cfg = {}, mon = null;
  var W = 0, H = 0, L = null, bg = null, carC = null, FONT = "monospace";
  var t0 = performance.now();
  var lamps = {};                       // warning lights with hysteresis: on at the threshold, off 5% below
  var seen = {}, doneAt = {};           // agent states, to catch the moment one finishes
  var show = { cpu: 0, gpu: 0, ram: 0, disk: 0, temp: 0, fuel: 0 };   // needles ease towards the real values
  var refuel = [];                      // "+ commit · repo" floating up from the fuel gauge
  var hits = [], card = null, cardFor = null, cardAt = 0;
  var share = false;

  // ------------------------------------------------------------------ layout
  function layout() {
    var carLen = Math.min(W * 0.44, H * 1.05);
    var l = { gy: H * 0.705, cx: W * 0.5, k: carLen / 1000, wall: H * 0.62 };
    l.tool = { x: W * 0.045, y: H * 0.19, w: W * 0.215, h: H * 0.29 };
    l.win = { x: W * 0.735, y: H * 0.12, w: W * 0.2, h: H * 0.38 };
    l.arc = { x: l.cx, y: H * 0.255, r: H * 0.085 };
    var cw = Math.min(W * 0.58, H * 1.3);
    l.cl = { x: l.cx - cw / 2, y: H * 0.808, w: cw, h: H * 0.168 };
    return l;
  }
  function X(lx) { return L.cx + lx * L.k; }       // car units -> canvas
  function Y(ly) { return L.gy + ly * L.k; }

  // ------------------------------------------------------------------ the still part: built once per size
  function paintBackground() {
    bg = document.createElement("canvas"); bg.width = W; bg.height = H;
    var c = bg.getContext("2d"), i;
    // the wall
    var gw = c.createLinearGradient(0, 0, 0, L.wall);
    gw.addColorStop(0, "#060607"); gw.addColorStop(0.55, "#101013"); gw.addColorStop(1, "#17171b");
    c.fillStyle = gw; c.fillRect(0, 0, W, L.wall);
    c.strokeStyle = "rgba(255,255,255,0.025)"; c.lineWidth = 1;
    for (i = 1; i < 14; i++) { var px = W * i / 14 | 0; c.beginPath(); c.moveTo(px + 0.5, H * 0.07); c.lineTo(px + 0.5, L.wall); c.stroke(); }
    // ceiling and its light strips
    c.fillStyle = "#040405"; c.fillRect(0, 0, W, H * 0.07);
    [0.18, 0.5, 0.82].forEach(function (f) {
      var sx = W * f, sw = W * 0.16;
      var gl = c.createRadialGradient(sx, H * 0.07, 0, sx, H * 0.07, sw * 0.9);
      gl.addColorStop(0, rgba(P.neon, 0.16)); gl.addColorStop(1, rgba(P.neon, 0));
      c.fillStyle = gl; c.fillRect(sx - sw, H * 0.03, sw * 2, H * 0.25);
      c.fillStyle = rgba(P.neon, 0.9); c.fillRect(sx - sw / 2, H * 0.066, sw, Math.max(2, H * 0.004));
    });
    // the window: a red sun over a mountain, beyond the glass
    var w = L.win;
    var gs = c.createLinearGradient(0, w.y, 0, w.y + w.h);
    gs.addColorStop(0, "#14060a"); gs.addColorStop(0.6, "#3a0c14"); gs.addColorStop(1, "#1a070b");
    c.fillStyle = gs; c.fillRect(w.x, w.y, w.w, w.h);
    var sun = c.createRadialGradient(w.x + w.w * 0.62, w.y + w.h * 0.32, 0, w.x + w.w * 0.62, w.y + w.h * 0.32, w.h * 0.3);
    sun.addColorStop(0, "rgba(240,40,50,0.95)"); sun.addColorStop(0.42, "rgba(220,30,44,0.9)"); sun.addColorStop(0.46, "rgba(200,20,40,0.25)"); sun.addColorStop(1, "rgba(200,20,40,0)");
    c.fillStyle = sun; c.fillRect(w.x, w.y, w.w, w.h);
    c.fillStyle = "#0c0508"; c.beginPath(); c.moveTo(w.x, w.y + w.h * 0.86);
    c.lineTo(w.x + w.w * 0.22, w.y + w.h * 0.7); c.lineTo(w.x + w.w * 0.4, w.y + w.h * 0.5); c.lineTo(w.x + w.w * 0.47, w.y + w.h * 0.47);
    c.lineTo(w.x + w.w * 0.55, w.y + w.h * 0.53); c.lineTo(w.x + w.w * 0.78, w.y + w.h * 0.72); c.lineTo(w.x + w.w, w.y + w.h * 0.8);
    c.lineTo(w.x + w.w, w.y + w.h); c.lineTo(w.x, w.y + w.h); c.fill();
    c.fillStyle = "rgba(230,230,240,0.55)"; c.beginPath();   // snow on the peak
    c.moveTo(w.x + w.w * 0.4, w.y + w.h * 0.5); c.lineTo(w.x + w.w * 0.47, w.y + w.h * 0.47); c.lineTo(w.x + w.w * 0.55, w.y + w.h * 0.53);
    c.lineTo(w.x + w.w * 0.5, w.y + w.h * 0.545); c.lineTo(w.x + w.w * 0.465, w.y + w.h * 0.525); c.lineTo(w.x + w.w * 0.43, w.y + w.h * 0.55); c.fill();
    c.strokeStyle = "#202024"; c.lineWidth = Math.max(3, H * 0.007);
    c.strokeRect(w.x, w.y, w.w, w.h);
    for (i = 1; i < 3; i++) { c.beginPath(); c.moveTo(w.x + w.w * i / 3, w.y); c.lineTo(w.x + w.w * i / 3, w.y + w.h); c.stroke(); }
    c.beginPath(); c.moveTo(w.x, w.y + w.h * 0.5); c.lineTo(w.x + w.w, w.y + w.h * 0.5); c.stroke();
    // a little red maple by the window
    var tx = Math.min(W - H * 0.07, w.x + w.w + H * 0.05), ty = L.wall + H * 0.005, R = function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }(7);
    c.fillStyle = "#1b1b1f"; c.fillRect(tx - H * 0.025, ty - H * 0.045, H * 0.05, H * 0.045);
    c.strokeStyle = "#2a1a16"; c.lineWidth = H * 0.006; c.beginPath(); c.moveTo(tx, ty - H * 0.045); c.quadraticCurveTo(tx - H * 0.02, ty - H * 0.1, tx + H * 0.01, ty - H * 0.15); c.stroke();
    for (i = 0; i < 70; i++) {
      var a = R() * Math.PI * 2, rr = R() * H * 0.06;
      c.fillStyle = "rgba(" + (170 + R() * 60 | 0) + "," + (14 + R() * 20 | 0) + ",30," + (0.55 + R() * 0.4).toFixed(2) + ")";
      c.beginPath(); c.arc(tx + Math.cos(a) * rr * 1.3, ty - H * 0.16 + Math.sin(a) * rr * 0.6, H * (0.006 + R() * 0.008), 0, 7); c.fill();
    }
    // the tool wall: a pegboard and the outlines of the tools
    var t = L.tool;
    c.fillStyle = "#0e0e11"; c.fillRect(t.x, t.y, t.w, t.h);
    c.strokeStyle = "#232328"; c.lineWidth = Math.max(2, H * 0.004); c.strokeRect(t.x, t.y, t.w, t.h);
    c.fillStyle = "rgba(255,255,255,0.05)";
    for (var gy = t.y + H * 0.018; gy < t.y + t.h; gy += H * 0.022)
      for (var gx = t.x + H * 0.018; gx < t.x + t.w; gx += H * 0.022) c.fillRect(gx, gy, 2, 2);
    c.strokeStyle = rgba(P.silver, 0.38); c.lineCap = "round";
    for (i = 0; i < 8; i++) {   // wrenches, small to large
      var wx = t.x + t.w * (0.08 + i * 0.055), wl = t.h * (0.16 + i * 0.018);
      c.lineWidth = Math.max(2, H * (0.0035 + i * 0.0004));
      c.beginPath(); c.moveTo(wx, t.y + t.h * 0.07); c.lineTo(wx, t.y + t.h * 0.07 + wl); c.stroke();
      c.beginPath(); c.arc(wx, t.y + t.h * 0.07 + wl, H * 0.006, 0, 7); c.stroke();
    }
    c.lineWidth = Math.max(2, H * 0.005);
    [[0.6, 0.3], [0.7, 0.26], [0.8, 0.34], [0.9, 0.28]].forEach(function (p) {   // screwdrivers
      var sx2 = t.x + t.w * p[0];
      c.strokeStyle = rgba(P.crimson, 0.6); c.beginPath(); c.moveTo(sx2, t.y + t.h * 0.07); c.lineTo(sx2, t.y + t.h * 0.15); c.stroke();
      c.strokeStyle = rgba(P.silver, 0.38); c.beginPath(); c.moveTo(sx2, t.y + t.h * 0.15); c.lineTo(sx2, t.y + t.h * p[1]); c.stroke();
    });
    // the tool chest under it
    var bx = t.x + t.w * 0.06, bw = t.w * 0.62, by = L.wall - H * 0.15, bh = H * 0.15 + (L.gy - L.wall) * 0.4;
    var gc = c.createLinearGradient(0, by, 0, by + bh);
    gc.addColorStop(0, "#5a0c16"); gc.addColorStop(1, "#22060a");
    c.fillStyle = gc; c.fillRect(bx, by, bw, bh);
    c.strokeStyle = "rgba(0,0,0,0.55)"; c.lineWidth = Math.max(1, H * 0.002);
    for (i = 1; i < 6; i++) { c.beginPath(); c.moveTo(bx, by + bh * i / 6); c.lineTo(bx + bw, by + bh * i / 6); c.stroke(); }
    c.fillStyle = rgba(P.silver, 0.5);
    for (i = 0; i < 6; i++) c.fillRect(bx + bw * 0.35, by + bh * (i + 0.45) / 6, bw * 0.3, Math.max(1, H * 0.0025));
    // the floor: dark, polished, with the lines of the bays
    var gf = c.createLinearGradient(0, L.wall, 0, H);
    gf.addColorStop(0, "#0d0d10"); gf.addColorStop(0.3, "#08080a"); gf.addColorStop(1, "#030304");
    c.fillStyle = gf; c.fillRect(0, L.wall, W, H - L.wall);
    var gb = c.createLinearGradient(0, L.wall - H * 0.03, 0, L.wall + H * 0.05);   // the neon along the base of the wall
    gb.addColorStop(0, rgba(P.neon, 0)); gb.addColorStop(0.4, rgba(P.neon, 0.22)); gb.addColorStop(1, rgba(P.neon, 0));
    c.fillStyle = gb; c.fillRect(0, L.wall - H * 0.03, W, H * 0.08);
    c.fillStyle = rgba(P.neon, 0.85); c.fillRect(0, L.wall - 1, W, Math.max(2, H * 0.003));
    c.strokeStyle = "rgba(255,255,255,0.035)"; c.lineWidth = 1;
    for (i = -9; i <= 9; i++) { c.beginPath(); c.moveTo(L.cx + i * W * 0.035, L.wall); c.lineTo(L.cx + i * W * 0.2, H); c.stroke(); }
    // the bay around the car, red lines on the floor
    var by0 = L.gy - H * 0.035, by1 = L.gy + H * 0.06, bx0 = X(-560), bx1 = X(560), sk = W * 0.035;
    c.strokeStyle = rgba(P.neon, 0.5); c.lineWidth = Math.max(1.5, H * 0.0025);
    c.beginPath(); c.moveTo(bx0 + sk * 0.5, by0); c.lineTo(bx1 - sk * 0.5, by0); c.lineTo(bx1 + sk, by1); c.lineTo(bx0 - sk, by1); c.closePath(); c.stroke();
    // the neon arc on the wall
    var A = L.arc;
    var ga = c.createRadialGradient(A.x, A.y, A.r * 0.5, A.x, A.y, A.r * 2.2);
    ga.addColorStop(0, rgba(P.neon, 0.14)); ga.addColorStop(1, rgba(P.neon, 0));
    c.fillStyle = ga; c.fillRect(A.x - A.r * 2.3, A.y - A.r * 2.3, A.r * 4.6, A.r * 4.6);
    c.lineCap = "butt";
    c.strokeStyle = rgba(P.neon, 0.35); c.lineWidth = A.r * 0.36; c.beginPath(); c.arc(A.x, A.y + A.r * 0.35, A.r, Math.PI, 0); c.stroke();
    c.strokeStyle = rgba(P.neon, 0.95); c.lineWidth = A.r * 0.2; c.beginPath(); c.arc(A.x, A.y + A.r * 0.35, A.r, Math.PI, 0); c.stroke();
    c.strokeStyle = "rgba(255,190,190,0.7)"; c.lineWidth = A.r * 0.05; c.beginPath(); c.arc(A.x, A.y + A.r * 0.35, A.r, Math.PI, 0); c.stroke();
    // the car and its reflection on the floor
    paintCar();
    c.save(); c.globalAlpha = 0.2;
    c.translate(0, 2 * L.gy); c.scale(1, -1); c.drawImage(carC, 0, 0); c.restore();
    var fade = c.createLinearGradient(0, L.gy, 0, L.gy + H * 0.2);
    fade.addColorStop(0, "rgba(5,5,6,0)"); fade.addColorStop(1, "rgba(5,5,6,1)");
    c.fillStyle = fade; c.fillRect(X(-560), L.gy, X(560) - X(-560), H * 0.21);
    var sh = c.createRadialGradient(L.cx, L.gy, 0, L.cx, L.gy, 560 * L.k);   // the shadow under it
    sh.addColorStop(0, "rgba(0,0,0,0.85)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    c.save(); c.translate(L.cx, L.gy); c.scale(1, 0.09); c.translate(-L.cx, -L.gy); c.fillStyle = sh; c.fillRect(X(-600), L.gy - 600 * L.k, 1200 * L.k, 1200 * L.k); c.restore();
    c.drawImage(carC, 0, 0);
  }

  // an original coupe, side on, nose to the right: long hood, low roof, fastback. Drawn in car units (1000 long).
  function body(c) {
    var wf = 315, wr = -305;
    c.beginPath();
    c.moveTo(468, -52);
    c.lineTo(wf + 92, -46); c.arc(wf, -88, 101, 0.43, Math.PI - 0.43, true);
    c.lineTo(wr + 92, -46); c.arc(wr, -88, 101, 0.43, Math.PI - 0.43, true);
    c.lineTo(-470, -52);
    c.bezierCurveTo(-488, -60, -498, -95, -496, -140);
    c.bezierCurveTo(-494, -168, -478, -184, -440, -194);
    c.bezierCurveTo(-330, -214, -210, -298, -70, -302);
    c.bezierCurveTo(10, -304, 70, -282, 118, -246);
    c.bezierCurveTo(230, -222, 380, -204, 446, -182);
    c.bezierCurveTo(484, -170, 500, -150, 500, -126);
    c.bezierCurveTo(500, -100, 494, -70, 468, -52);
    c.closePath();
  }
  function paintCar() {
    carC = document.createElement("canvas"); carC.width = W; carC.height = H;
    var c = carC.getContext("2d"), k = L.k;
    c.setTransform(k, 0, 0, k, L.cx, L.gy);
    // paint: deep black with a silver sky on the roof and a crimson stripe of light along the shoulder
    body(c);
    var gp = c.createLinearGradient(0, -305, 0, -40);
    gp.addColorStop(0, "#565a63"); gp.addColorStop(0.12, "#2a2c32"); gp.addColorStop(0.32, "#141519");
    gp.addColorStop(0.5, "#202227"); gp.addColorStop(0.58, "#0d0e11"); gp.addColorStop(0.8, "#121317"); gp.addColorStop(1, "#060607");
    c.fillStyle = gp; c.fill();
    c.save(); body(c); c.clip();
    var gs = c.createLinearGradient(-500, 0, 500, 0);   // the neon of the room, reflected along the shoulder
    gs.addColorStop(0, rgba(P.neon, 0)); gs.addColorStop(0.3, rgba(P.neon, 0.55)); gs.addColorStop(0.7, rgba(P.neon, 0.4)); gs.addColorStop(1, rgba(P.neon, 0.1));
    c.fillStyle = gs; c.fillRect(-500, -192, 1000, 7);
    c.fillStyle = "rgba(255,255,255,0.10)"; c.fillRect(-500, -184, 1000, 2);
    var gl = c.createLinearGradient(0, -300, 0, -230);   // the sky on the roof and the hood
    gl.addColorStop(0, "rgba(255,255,255,0.18)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = gl; c.fillRect(-500, -310, 1000, 90);
    c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(-500, -74, 1000, 36);   // the sill in shadow
    c.fillStyle = "rgba(220,224,234,0.12)"; c.fillRect(-500, -80, 1000, 2);   // the rocker catches the floor light
    var gd = c.createLinearGradient(-500, 0, 500, 0);   // and a crimson line low on the side, from the floor neon
    gd.addColorStop(0, rgba(P.neon, 0.05)); gd.addColorStop(0.5, rgba(P.neon, 0.3)); gd.addColorStop(1, rgba(P.neon, 0.05));
    c.fillStyle = gd; c.fillRect(-500, -110, 1000, 3);
    c.restore();
    // the side window
    c.beginPath();
    c.moveTo(-352, -206);
    c.bezierCurveTo(-270, -230, -180, -284, -70, -287);
    c.bezierCurveTo(-5, -288, 50, -270, 96, -238);
    c.lineTo(88, -214); c.lineTo(-330, -204); c.closePath();
    var gg = c.createLinearGradient(-350, -290, 100, -205);
    gg.addColorStop(0, "#0a0b0e"); gg.addColorStop(0.55, "#1b1d23"); gg.addColorStop(0.6, "#2b2e36"); gg.addColorStop(1, "#08090b");
    c.fillStyle = gg; c.fill();
    c.strokeStyle = rgba(P.silver, 0.5); c.lineWidth = 2.2; c.stroke();
    c.fillStyle = "#050506"; c.fillRect(-128, -280, 10, 72);   // B-pillar
    // the door, the side vent, the mirror, the handle
    c.strokeStyle = "rgba(0,0,0,0.85)"; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(108, -232); c.bezierCurveTo(120, -170, 112, -110, 96, -58); c.stroke();
    c.beginPath(); c.moveTo(-130, -205); c.bezierCurveTo(-140, -150, -136, -100, -118, -56); c.stroke();
    c.fillStyle = "rgba(220,224,232,0.55)"; c.fillRect(-40, -186, 48, 4);
    c.fillStyle = "#0a0a0c"; c.beginPath(); c.moveTo(150, -150); c.lineTo(222, -158); c.lineTo(214, -132); c.lineTo(156, -128); c.closePath(); c.fill();
    c.strokeStyle = rgba(P.silver, 0.3); c.lineWidth = 1.5; c.stroke();
    c.fillStyle = "#0b0b0d"; c.beginPath(); c.moveTo(70, -238); c.quadraticCurveTo(104, -262, 122, -246); c.lineTo(112, -226); c.lineTo(78, -226); c.closePath(); c.fill();
    c.strokeStyle = rgba(P.silver, 0.35); c.lineWidth = 1.5; c.stroke();
    // the lights: a slim headlight, a light bar at the back (lit in draw())
    c.fillStyle = "#15161a"; c.beginPath(); c.moveTo(440, -172); c.quadraticCurveTo(478, -168, 494, -150); c.lineTo(486, -143); c.quadraticCurveTo(462, -156, 432, -160); c.closePath(); c.fill();
    c.fillStyle = "#2a070c"; c.fillRect(-497, -158, 22, 9);
    // the splitter and the diffuser
    c.fillStyle = "#050506"; c.fillRect(390, -50, 105, 9); c.fillRect(-488, -60, 70, 12);
    // the wheels: tyre, a ten-spoke rim, a crimson caliper
    [315, -305].forEach(function (wx) {
      c.fillStyle = "#070708"; c.beginPath(); c.arc(wx, -86, 86, 0, 7); c.fill();
      c.strokeStyle = "#141417"; c.lineWidth = 3; c.beginPath(); c.arc(wx, -86, 80, 0, 7); c.stroke();
      var gr = c.createRadialGradient(wx - 15, -100, 5, wx, -86, 62);
      gr.addColorStop(0, "#3c3f46"); gr.addColorStop(0.7, "#17181c"); gr.addColorStop(1, "#0d0d10");
      c.fillStyle = gr; c.beginPath(); c.arc(wx, -86, 61, 0, 7); c.fill();
      c.fillStyle = rgba(P.crimson, 0.9); c.beginPath(); c.arc(wx, -86, 44, -2.5, -1.2); c.arc(wx, -86, 30, -1.2, -2.5, true); c.closePath(); c.fill();
      c.strokeStyle = "#5a5e68"; c.lineWidth = 5; c.lineCap = "round";
      for (var s = 0; s < 10; s++) {
        var a = s * Math.PI / 5 + (s % 2 ? 0.12 : 0);
        c.beginPath(); c.moveTo(wx + Math.cos(a) * 12, -86 + Math.sin(a) * 12); c.lineTo(wx + Math.cos(a) * 58, -86 + Math.sin(a) * 58); c.stroke();
      }
      c.strokeStyle = rgba(P.silver, 0.35); c.lineWidth = 2; c.beginPath(); c.arc(wx, -86, 60, 0, 7); c.stroke();
      c.fillStyle = "#26282e"; c.beginPath(); c.arc(wx, -86, 11, 0, 7); c.fill();
    });
    // the wheel arches have a lip
    c.strokeStyle = "rgba(200,204,214,0.22)"; c.lineWidth = 2.5;
    [315, -305].forEach(function (wx) { c.beginPath(); c.arc(wx, -88, 103, Math.PI + 0.45, -0.45); c.stroke(); });
    // the outline catches the light
    body(c); c.strokeStyle = "rgba(210,214,224,0.16)"; c.lineWidth = 1.6; c.stroke();
  }

  // ------------------------------------------------------------------ helpers for the moving part
  function txt(g, s, x, y, size, col, align, weight, spacing) {
    g.font = (weight || 500) + " " + Math.round(size) + "px " + FONT;
    g.textAlign = align || "left"; g.textBaseline = "middle";
    if ("letterSpacing" in g) g.letterSpacing = (spacing || 0) + "px";
    g.fillStyle = col; g.fillText(s, x, y);
    if ("letterSpacing" in g) g.letterSpacing = "0px";
  }
  function glow(g, x, y, r, col, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function lamp(id, v, th, extra) {   // on at th, off again 5 below: no flicker around the line
    if (v == null) { lamps[id] = false; return false; }
    lamps[id] = lamps[id] ? v >= th - 5 : v >= th;
    if (extra) lamps[id] = lamps[id] || extra;
    return lamps[id];
  }
  function motion() { return cfg.motion || "full"; }

  // ------------------------------------------------------------------ the mechanics: your agents
  var SLOTS = [{ x: 730, pose: "stand", face: -1, row: 0 }, { x: -730, pose: "stand", face: 1, row: 0 },
               { x: 545, pose: "crouch", face: -1, row: 1 }, { x: -545, pose: "crouch", face: 1, row: 1 }];
  function agentsNow() {
    var list = ((S && S.agents) || []).filter(function (a) { return !a.crew && a.state !== "gone"; });
    list.sort(function (a, b) { return (RANK[a.state] == null ? 5 : RANK[a.state]) - (RANK[b.state] == null ? 5 : RANK[b.state]) || (a.since || 0) - (b.since || 0); });
    return list;
  }
  function waitedMin(a) { return (Date.now() / 1000 - (a.changed || a.t || Date.now() / 1000)) / 60; }
  function stateCol(a) {
    if (a.state === "working") return P.white;
    if (a.state === "waiting") return waitedMin(a) >= (+cfg.wait_red || 10) ? P.red : P.amber;
    if (a.state === "failed") return P.red;
    if (a.state === "done") return P.green;
    return P.dim;
  }
  function drawMechanic(g, a, slot, t) {
    var k = L.k, s = slot.face, x = X(slot.x), y = L.gy, nm = split(a.name);
    var col = OVERALLS[hash(nm.who) % OVERALLS.length], st = a.state, mv = motion() === "full";
    var sc = stateCol(a), working = st === "working";
    // the work light: a warm pool on the car where the mechanic works
    if (working) {
      g.save(); g.globalCompositeOperation = "lighter";
      glow(g, X(slot.x + s * (slot.pose === "stand" ? 190 : 120)), Y(slot.pose === "stand" ? -170 : -100), 190 * k, P.warm, 0.2 + (mv ? 0.03 * Math.sin(t * 3) : 0));
      g.restore();
    }
    var fin = doneAt[a.name] ? (performance.now() - doneAt[a.name]) / 1000 : 99;
    if (fin < 2.6) {   // finished: a green ring, once
      var fr = 60 + fin * 160;
      g.strokeStyle = rgba(P.green, Math.max(0, 0.8 - fin * 0.3)); g.lineWidth = 3 * k * 2;
      g.beginPath(); g.ellipse(x, y, fr * k, fr * k * 0.22, 0, 0, 7); g.stroke();
    }
    g.save(); g.translate(x, y); g.scale(k * s, k);   // facing the car: +x is towards it
    var dark = "#0b0b0d", ov = "rgb(" + col.map(function (v) { return v * 0.62 | 0; }).join(",") + ")";
    var hi = rgba(col, 0.9), swing = working && mv ? Math.sin(t * 5 + hash(a.name)) * 0.35 : 0;
    var slump = st === "failed" ? 18 : 0;
    g.lineCap = "round"; g.lineJoin = "round";
    if (slot.pose === "stand") {
      g.fillStyle = dark; rr(g, -26, -16, 30, 16, 5); g.fill(); rr(g, 6, -16, 32, 16, 5); g.fill();   // boots
      g.strokeStyle = ov; g.lineWidth = 26;
      g.beginPath(); g.moveTo(-12, -20); g.lineTo(-8, -128); g.stroke(); g.beginPath(); g.moveTo(20, -20); g.lineTo(12, -128); g.stroke();
      g.fillStyle = ov; rr(g, -30, -236 + slump, 62, 120, 22); g.fill();   // torso
      g.fillStyle = hi; g.fillRect(-28, -232 + slump, 6, 100);                // the rim of light on the back
      // the back arm hangs; the front one works on the car (a wrench), or rests
      g.strokeStyle = ov; g.lineWidth = 18;
      g.beginPath(); g.moveTo(-14, -220 + slump); g.lineTo(-22, -140 + slump); g.stroke();
      var ang = working ? -0.9 + swing : st === "waiting" ? 0.25 : st === "failed" ? 0.05 : 0.15;
      var ex = 8 + Math.sin(ang + 1.57) * 70, ey = -218 + slump + Math.cos(ang + 1.57) * -70;
      g.beginPath(); g.moveTo(10, -218 + slump); g.lineTo(ex, ey); g.stroke();
      if (working) { g.strokeStyle = rgba(P.silver, 0.95); g.lineWidth = 6; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + 34, ey - 16); g.stroke(); }
      g.fillStyle = "#c9a68a"; g.beginPath(); g.arc(4, -262 + slump, 22, 0, 7); g.fill();   // head and cap
      g.fillStyle = ov; g.beginPath(); g.arc(4, -268 + slump, 23, Math.PI, 0); g.fill(); g.fillRect(4, -270 + slump, 34, 7);
      g.save(); g.scale(s, 1);   // the badge letter, never mirrored
      txt(g, nm.who.charAt(0).toUpperCase(), 1, -196 + slump, 30, "rgba(240,240,244,0.85)", "center", 700);
      g.restore();
    } else {   // crouched at a wheel
      g.fillStyle = dark; rr(g, -40, -16, 34, 16, 5); g.fill(); rr(g, 14, -16, 32, 16, 5); g.fill();
      g.strokeStyle = ov; g.lineWidth = 26;
      g.beginPath(); g.moveTo(-26, -20); g.lineTo(-30, -70); g.lineTo(10, -78); g.stroke();
      g.beginPath(); g.moveTo(26, -20); g.lineTo(34, -64); g.stroke();
      g.save(); g.translate(0, -76); g.rotate(0.32 + (st === "failed" ? 0.25 : 0));
      g.fillStyle = ov; rr(g, -30, -112, 60, 112, 22); g.fill();
      g.fillStyle = hi; g.fillRect(-28, -106, 6, 90);
      g.strokeStyle = ov; g.lineWidth = 18;
      var ca = working ? 0.4 + swing * 0.6 : 0.9;
      g.beginPath(); g.moveTo(10, -96); g.lineTo(10 + Math.cos(ca) * 74, -96 + Math.sin(ca) * 74); g.stroke();
      if (working) { g.strokeStyle = rgba(P.silver, 0.95); g.lineWidth = 6; g.beginPath(); g.moveTo(10 + Math.cos(ca) * 74, -96 + Math.sin(ca) * 74); g.lineTo(10 + Math.cos(ca) * 74 + 30, -96 + Math.sin(ca) * 74 + 6); g.stroke(); }
      g.fillStyle = "#c9a68a"; g.beginPath(); g.arc(8, -136, 21, 0, 7); g.fill();
      g.fillStyle = ov; g.beginPath(); g.arc(8, -142, 22, Math.PI, 0); g.fill(); g.fillRect(8, -144, 32, 7);
      g.save(); g.scale(s, 1); txt(g, nm.who.charAt(0).toUpperCase(), 0, -58, 28, "rgba(240,240,244,0.85)", "center", 700); g.restore();
      g.restore();
    }
    g.restore();
    // over the head: what it needs from you
    var top = Y(slot.pose === "stand" ? -330 : -250), pulse = mv ? 0.6 + 0.4 * Math.sin(t * 4) : 1;
    var mark = st === "waiting" ? "!" : st === "failed" ? "✕" : fin < 2.6 ? "✓" : "";
    if (mark) {
      glow(g, x, top, 70 * k, sc, 0.35 * pulse);
      g.fillStyle = rgba(sc, 0.25 + 0.6 * pulse); g.beginPath(); g.arc(x, top, 24 * k, 0, 7); g.fill();
      g.strokeStyle = rgba(sc, 1); g.lineWidth = Math.max(1.5, 3 * k); g.stroke();
      txt(g, mark, x, top + 1, 30 * k, "#fff", "center", 700);
    }
    // the tag on the floor: who, on what, for how long
    var fs = Math.max(10, H * 0.0135), ty = L.gy + H * 0.03 + (slot.row ? fs * 2.75 : 0);
    var who = nm.who.toUpperCase() + (nm.project && !share ? " · " + nm.project : "");
    var since = st === "working" ? a.since : (a.changed || a.t);
    var line2 = (st === "waiting" ? (sc === P.red ? "waiting " : "needs you · ") : st === "failed" ? "failed · " : st === "done" ? "done · " : st === "idle" ? "idle · " : "") +
      (share || st === "waiting" ? "" : (a.text || "")) + (since ? (st === "waiting" ? "" : " · ") + dur(Date.now() / 1000 - since) : "");
    if (who.length > 26) who = who.slice(0, 25) + "…";
    if (line2.length > 30) line2 = line2.slice(0, 29) + "…";
    g.fillStyle = rgba(sc, 1); g.beginPath(); g.arc(x - (measure(g, who, fs, 600) + who.length) / 2 - fs * 0.6, ty, fs * 0.28, 0, 7); g.fill();
    txt(g, who, x, ty, fs, "rgba(236,238,244,0.92)", "center", 600, 1);
    txt(g, line2, x, ty + fs * 1.35, fs * 0.88, rgba(sc === P.white ? P.silver : sc, 0.85), "center", 400);
    var hw = Math.max(measure(g, who, fs, 600), 60 * k) / 2 + fs;
    hits.push({ x: x - hw, y: top - 40 * k, w: hw * 2, h: ty + fs * 2 - (top - 40 * k), kind: "agent", a: a });
  }
  function measure(g, s, size, weight) { g.font = (weight || 500) + " " + Math.round(size) + "px " + FONT; return g.measureText(s).width; }

  // ------------------------------------------------------------------ the tool wall: your repositories
  function drawProjects(g) {
    if (cfg.projects === false) return;
    var repos = ((S && S.git) || []).slice(0, 6), t = L.tool, fs = Math.max(9, H * 0.0125);
    var y0 = t.y + t.h * 0.56, rowH = (t.h * 0.42) / 6;
    txt(g, "PROJECTS", t.x + t.w * 0.06, t.y + t.h * 0.5, fs * 0.85, rgba(P.silver, 0.45), "left", 600, 2);
    if (!repos.length) { txt(g, "no repositories found ([git] root)", t.x + t.w * 0.06, y0 + rowH * 0.6, fs * 0.9, rgba(P.dim, 0.9), "left"); return; }
    repos.forEach(function (r, i) {
      var y = y0 + rowH * (i + 0.6), col = r.ci === "ok" ? P.green : r.ci === "fail" ? P.red : r.ci === "run" ? P.amber : P.dim;
      g.fillStyle = rgba(col, r.ci ? 1 : 0.6); g.beginPath(); g.arc(t.x + t.w * 0.07, y, fs * 0.32, 0, 7); g.fill();
      if (r.ci === "run" || r.ci === "fail") glow(g, t.x + t.w * 0.07, y, fs * 1.4, col, 0.35);
      var nm = share ? "repo " + (i + 1) : String(r.name || "");
      if (nm.length > 18) nm = nm.slice(0, 17) + "…";
      txt(g, nm, t.x + t.w * 0.12, y, fs, "rgba(230,232,238,0.88)", "left", 500);
      txt(g, (r.week || 0) + " this wk" + (r.dirty ? " · ●" : ""), t.x + t.w * 0.95, y, fs * 0.85, rgba(P.silver, 0.6), "right");
    });
  }

  // ------------------------------------------------------------------ the instrument cluster
  function gauge(g, x, y, r, v, label, valTxt, warn, crit) {
    var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, n = 40, i;
    g.fillStyle = "rgba(4,4,6,0.9)"; g.beginPath(); g.arc(x, y, r * 1.08, 0, 7); g.fill();
    g.strokeStyle = rgba(P.silver, 0.25); g.lineWidth = Math.max(1, r * 0.03); g.stroke();
    for (i = 0; i <= n; i++) {
      var f = i / n, a = a0 + (a1 - a0) * f, big = i % 5 === 0;
      var c = f * 100 >= crit ? P.red : f * 100 >= warn ? P.amber : P.white;
      g.strokeStyle = rgba(c, f <= v / 100 ? 0.95 : 0.22); g.lineWidth = big ? r * 0.035 : r * 0.02;
      g.beginPath(); g.moveTo(x + Math.cos(a) * r * (big ? 0.78 : 0.84), y + Math.sin(a) * r * (big ? 0.78 : 0.84));
      g.lineTo(x + Math.cos(a) * r * 0.94, y + Math.sin(a) * r * 0.94); g.stroke();
    }
    var av = a0 + (a1 - a0) * clamp(v / 100, 0, 1);
    g.strokeStyle = rgba(P.neon, 1); g.lineWidth = r * 0.04; g.lineCap = "round";
    g.beginPath(); g.moveTo(x - Math.cos(av) * r * 0.12, y - Math.sin(av) * r * 0.12); g.lineTo(x + Math.cos(av) * r * 0.86, y + Math.sin(av) * r * 0.86); g.stroke();
    g.fillStyle = "#18191d"; g.beginPath(); g.arc(x, y, r * 0.1, 0, 7); g.fill();
    txt(g, valTxt, x, y + r * 0.4, r * 0.25, "rgba(240,240,244,0.95)", "center", 600);
    txt(g, label, x, y + r * 0.66, r * 0.1, rgba(P.silver, 0.6), "center", 600, 1);
  }
  function fuelText(f) {
    if (!f) return "";
    if (f.level >= 0.75) return "FULL TANK · KEEP SHIPPING";
    if (f.level >= 0.35) return "CRUISING";
    if (f.level >= 0.15) return "RUNNING LOW · PUSH SOMETHING";
    return "ON FUMES · COMMIT TO REFUEL";
  }
  function drawCluster(g, t, lampList) {
    var mode = cfg.cluster || "full";
    if (mode === "off") return;
    var c = L.cl, sys = (S && S.sys) || {}, f = S && S.fuel, fs = Math.max(9, H * 0.012);
    if (mode === "compact") {
      var cy = H * 0.94, cw = c.w * 0.7, cx0 = L.cx - cw / 2;
      rr(g, cx0, cy - H * 0.025, cw, H * 0.05, H * 0.025); g.fillStyle = "rgba(6,6,8,0.86)"; g.fill();
      g.strokeStyle = rgba(P.silver, 0.15); g.lineWidth = 1; g.stroke();
      txt(g, "FUEL", cx0 + H * 0.02, cy, fs, rgba(P.silver, 0.7), "left", 600, 2);
      var bx = cx0 + H * 0.07, bw = cw * 0.38;
      g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(bx, cy - 3, bw, 6);
      g.fillStyle = rgba(show.fuel < 0.15 ? P.red : P.white, 0.9); g.fillRect(bx, cy - 3, bw * show.fuel, 6);
      drawLamps(g, lampList, bx + bw + H * 0.02, cy, cx0 + cw - H * 0.02, fs);
      return;
    }
    rr(g, c.x, c.y, c.w, c.h, c.h * 0.2);
    var gb = g.createLinearGradient(0, c.y, 0, c.y + c.h);
    gb.addColorStop(0, "rgba(16,16,19,0.92)"); gb.addColorStop(1, "rgba(4,4,5,0.94)");
    g.fillStyle = gb; g.fill(); g.strokeStyle = rgba(P.silver, 0.16); g.lineWidth = 1.2; g.stroke();
    g.fillStyle = rgba(P.neon, 0.5); g.fillRect(c.x + c.h * 0.3, c.y, c.w - c.h * 0.6, 1.5);
    var r = c.h * 0.36, gy = c.y + c.h * 0.43;
    var cpuWarn = +cfg.cpu || 85, gpuWarn = +cfg.gpu || 90;
    gauge(g, c.x + c.w * 0.13, gy, r, show.cpu, "ENGINE · CPU", Math.round(show.cpu) + "%", cpuWarn - 15, cpuWarn);
    if (sys.gpu != null) gauge(g, c.x + c.w * 0.87, gy, r, show.gpu, "BOOST · GPU", Math.round(show.gpu) + "%", gpuWarn - 15, gpuWarn);
    else gauge(g, c.x + c.w * 0.87, gy, r, show.temp, "TEMP", sys.temp != null ? Math.round(sys.temp) + "°" : "--", 70, +cfg.temp || 90);
    // the fuel: the hero of the cluster
    var fx = L.cx, fy = c.y + c.h * 0.5, fr = c.h * 0.42, segs = 24, a0 = Math.PI * 1.1, a1 = Math.PI * 1.9, i;
    for (i = 0; i < segs; i++) {
      var s0 = a0 + (a1 - a0) * i / segs + 0.012, s1 = a0 + (a1 - a0) * (i + 1) / segs - 0.012, on = (i + 0.5) / segs <= show.fuel;
      var col = show.fuel < 0.15 ? P.red : i < segs * 0.15 ? P.amber : P.white;
      g.strokeStyle = rgba(col, on ? 0.95 : 0.12); g.lineWidth = fr * 0.11; g.lineCap = "butt";
      g.beginPath(); g.arc(fx, fy, fr, s0, s1); g.stroke();
    }
    txt(g, "E", fx + Math.cos(a0) * fr * 1.13, fy + Math.sin(a0) * fr * 1.13, fs, rgba(P.silver, 0.6), "center", 600);
    txt(g, "F", fx + Math.cos(a1) * fr * 1.13, fy + Math.sin(a1) * fr * 1.13, fs, rgba(P.silver, 0.6), "center", 600);
    if (f) {
      txt(g, Math.round(show.fuel * 100) + "%", fx, fy - fr * 0.42, fr * 0.36, "rgba(244,244,248,0.97)", "center", 600);
      txt(g, "FUEL · " + f.points + " / " + f.goal + " PTS", fx, fy - fr * 0.08, fs, rgba(P.silver, 0.7), "center", 600, 2);
      txt(g, f.commits + " commits · " + f.pushed + " pushed · " + f.branches + " branches · " + f.today + " today", fx, fy + fr * 0.16, fs * 0.92, rgba(P.silver, 0.55), "center");
      txt(g, fuelText(f), fx, fy + fr * 0.4, fs * 1.05, rgba(f.level < 0.15 ? P.red : f.level < 0.35 ? P.amber : P.white, 0.9), "center", 600, 2);
    } else {
      txt(g, "FUEL", fx, fy - fr * 0.3, fs * 1.4, rgba(P.silver, 0.6), "center", 600, 3);
      txt(g, "reading your repositories…", fx, fy, fs, rgba(P.dim, 1), "center");
    }
    // the small readouts between the gauges
    var mx0 = c.x + c.w * 0.245, mx1 = c.x + c.w * 0.755, rows = [["RAM", show.ram], ["DISK", show.disk]];
    rows.forEach(function (row, j) {
      var yy = c.y + c.h * (0.28 + j * 0.2), lx = j < 2 ? mx0 : mx1;
      txt(g, row[0], mx0, yy, fs * 0.9, rgba(P.silver, 0.6), "left", 600, 1);
      var bw2 = c.w * 0.09, bx2 = mx0 + c.w * 0.045, warn = row[0] === "RAM" ? +cfg.ram || 85 : +cfg.disk || 90;
      g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(bx2, yy - 2, bw2, 4);
      g.fillStyle = rgba(row[1] >= warn ? P.amber : P.white, 0.85); g.fillRect(bx2, yy - 2, bw2 * clamp(row[1] / 100, 0, 1), 4);
    });
    txt(g, "NET", mx1, c.y + c.h * 0.28, fs * 0.9, rgba(P.silver, 0.6), "right", 600, 1);
    txt(g, "↓ " + bytes(sys.rx) + "  ↑ " + bytes(sys.tx), mx1, c.y + c.h * 0.48, fs * 0.9, "rgba(230,232,238,0.8)", "right");
    drawLamps(g, lampList, c.x + c.w * 0.06, c.y + c.h * 0.88, c.x + c.w * 0.94, fs);
  }
  function drawLamps(g, list, x0, y, x1, fs) {
    var n = list.length, w = (x1 - x0) / n, mv = motion() !== "off";
    list.forEach(function (l, i) {
      var x = x0 + w * (i + 0.5), on = l.on, blink = on && l.blink && mv ? 0.55 + 0.45 * Math.sin(performance.now() / 180) : 1;
      if (on) glow(g, x, y, w * 0.55, l.col, 0.22 * blink);
      txt(g, l.label, x, y, fs * 0.85, on ? rgba(l.col, blink) : "rgba(120,124,134,0.32)", "center", 700, 1);
      hits.push({ x: x - w / 2, y: y - fs, w: w, h: fs * 2, kind: "lamp", l: l });
    });
  }

  // ------------------------------------------------------------------ the frame
  function draw(g, w, h, now, flags) {
    share = !!(flags && (flags.share || flags.privacy));
    if (w !== W || h !== H || !bg) {
      W = w; H = h; L = layout();
      FONT = (getComputedStyle(document.body).fontFamily || "monospace");
      paintBackground();
    }
    hits = [];
    var t = (now - t0) / 1000, sys = (S && S.sys) || {}, mv = motion();
    var ease = mv === "off" ? 1 : 0.12;
    show.cpu += ((sys.cpu || 0) - show.cpu) * ease; show.gpu += ((sys.gpu || 0) - show.gpu) * ease;
    show.ram += ((sys.ram || 0) - show.ram) * ease; show.disk += ((sys.disk || 0) - show.disk) * ease;
    show.temp += ((sys.temp || 0) - show.temp) * ease;
    show.fuel += (((S && S.fuel && S.fuel.level) || 0) - show.fuel) * (mv === "off" ? 1 : 0.04);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bg, 0, 0);
    var k = L.k, ag = agentsNow();
    var waiting = ag.filter(function (a) { return a.state === "waiting"; }), failed = ag.filter(function (a) { return a.state === "failed"; });
    // the warning lights, with their thresholds from [garage]
    var lampList = [
      { id: "fail", label: "CHECK", on: failed.length > 0, col: P.red, tip: failed.length + " agent(s) failed" },
      { id: "wait", label: "ATTN", on: waiting.length > 0, col: P.amber, blink: true, tip: waiting.length + " agent(s) need you" },
      { id: "cpu", label: "ENG", on: lamp("cpu", sys.cpu, +cfg.cpu || 85), col: P.amber, tip: "CPU " + Math.round(sys.cpu || 0) + "%" },
      { id: "gpu", label: "GPU", on: lamp("gpu", sys.gpu, +cfg.gpu || 90), col: P.amber, tip: sys.gpu == null ? "no GPU reading" : "GPU " + Math.round(sys.gpu) + "%" },
      { id: "ram", label: "MEM", on: lamp("ram", sys.ram, +cfg.ram || 85), col: P.amber, tip: "RAM " + Math.round(sys.ram || 0) + "%" },
      { id: "disk", label: "DISK", on: lamp("disk", sys.disk, +cfg.disk || 90), col: P.red, tip: "disk " + Math.round(sys.disk || 0) + "% full" },
      { id: "temp", label: "TEMP", on: lamp("temp", sys.temp, +cfg.temp || 90), col: P.red, tip: sys.temp == null ? "no temperature reading" : Math.round(sys.temp) + " °C" },
      { id: "net", label: "NET", on: "ip" in sys && !sys.ip, col: P.amber, tip: sys.ip ? "connected · " + (share ? "" : sys.ip) : "no network" },
      { id: "fuel", label: "FUEL", on: !!(S && S.fuel && S.fuel.level < 0.15), col: P.amber, tip: "low fuel: commit, push, branch to refill" }
    ];
    // the car comes alive: running lights, the engine bay with the CPU, the underglow with the GPU
    g.save(); g.globalCompositeOperation = "lighter";
    var under = 0.12 + clamp((sys.gpu || 0) / 100, 0, 1) * 0.35 + (mv === "full" ? 0.02 * Math.sin(t * 1.3) : 0);
    g.save(); g.translate(L.cx, L.gy); g.scale(1, 0.12);
    glow(g, 0, 0, 520 * k, P.neon, under); g.restore();
    var eng = clamp(((sys.cpu || 0) - 30) / 70, 0, 1);
    if (eng > 0) glow(g, X(330), Y(-200), 170 * k, P.neon, eng * 0.28);
    glow(g, X(482), Y(-156), 60 * k, P.white, 0.55);                       // running lights
    g.fillStyle = "rgba(240,246,255,0.95)"; g.fillRect(X(444), Y(-166), 46 * k, 4 * k);
    glow(g, X(-488), Y(-153), 50 * k, P.neon, 0.45);
    g.fillStyle = rgba(P.neon, 0.95); g.fillRect(X(-497), Y(-157), 22 * k, 6 * k);
    var hz = waiting.length && (mv === "off" || Math.sin(t * 5.2) > 0);  // hazards: an agent needs you
    if (hz) { glow(g, X(490), Y(-118), 70 * k, P.amber, 0.8); glow(g, X(-490), Y(-130), 70 * k, P.amber, 0.8); }
    if (failed.length) glow(g, X(340), Y(-205), 120 * k, P.red, 0.3 + (mv === "full" ? 0.1 * Math.sin(t * 2) : 0));
    g.restore();
    // the mechanics
    if (cfg.mechanics !== false) {
      ag.slice(0, SLOTS.length).forEach(function (a, i) { drawMechanic(g, a, SLOTS[i], t); });
      if (ag.length > SLOTS.length) {
        var ox = X(-650), oy = Y(-420), fs0 = Math.max(10, H * 0.014);
        rr(g, ox - fs0 * 2.2, oy - fs0, fs0 * 4.4, fs0 * 2, fs0); g.fillStyle = "rgba(10,10,12,0.85)"; g.fill();
        g.strokeStyle = rgba(P.silver, 0.3); g.stroke();
        txt(g, "+" + (ag.length - SLOTS.length), ox, oy, fs0, "rgba(236,238,244,0.9)", "center", 600);
        hits.push({ x: ox - fs0 * 2.2, y: oy - fs0, w: fs0 * 4.4, h: fs0 * 2, kind: "more", list: ag.slice(SLOTS.length) });
      }
    }
    drawProjects(g);
    // the header: the name of the garage, the clock, who is on shift
    var fs = Math.max(10, H * 0.016), d = new Date(), hh = d.getHours(), mm = d.getMinutes();
    if (ui.clock === "12h") hh = hh % 12 || 12;
    txt(g, "BUILDGARAGE", W * 0.045, H * 0.105, fs * 1.5, "rgba(236,238,244,0.94)", "left", 700, 4);
    g.fillStyle = rgba(P.neon, 0.9); g.fillRect(W * 0.045, H * 0.128, fs * 3, 2);
    var shift = ag.filter(function (a) { return a.state === "working"; }).length;
    var sub = ag.length ? shift + " on shift" + (waiting.length ? " · " + waiting.length + " need" + (waiting.length > 1 ? "" : "s") + " you" : "") +
      (failed.length ? " · " + failed.length + " failed" : "") : "the bay is quiet · no agents";
    txt(g, sub.toUpperCase(), W * 0.045, H * 0.15 - H * 0.0, fs * 0.8, rgba(waiting.length ? P.amber : P.silver, 0.75), "left", 600, 2);
    txt(g, (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm, W * 0.955, H * 0.105, fs * 2.2, "rgba(236,238,244,0.94)", "right", 600, 2);
    var DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    txt(g, DAYS[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()], W * 0.955, H * 0.142, fs * 0.8, rgba(P.silver, 0.6), "right", 600, 3);
    if (S && S.focus) txt(g, "FOCUS · " + Math.max(0, Math.ceil((S.focus.until - Date.now() / 1000) / 60)) + "m LEFT", W * 0.955, H * 0.17, fs * 0.8, rgba(P.neon, 0.85), "right", 600, 2);
    drawCluster(g, t, lampList);
    // refuel: every commit and push floats up from the gauge
    refuel = refuel.filter(function (r) { return now - r.t < 3200; });
    refuel.forEach(function (r, i) {
      var p = (now - r.t) / 3200;
      txt(g, r.text, L.cx, L.cl.y - H * 0.02 - p * H * 0.06 - i * H * 0.022, fs * 0.9, rgba(P.green, 1 - p), "center", 600, 2);
    });
    if (!S) txt(g, "waiting for the Pulse hub…", L.cx, H * 0.5, fs, rgba(P.silver, 0.6), "center");
    if (card && cardFor && now - cardAt > 12000) hideCard();
  }

  // ------------------------------------------------------------------ data in
  function update(st, m) {
    S = st; mon = m; ui = (st && st.ui) || {}; cfg = ui.garage || {};
    agentsNow().forEach(function (a) {
      if (seen[a.name] && seen[a.name] !== "done" && a.state === "done") doneAt[a.name] = performance.now();
      seen[a.name] = a.state;
    });
    if (card && cardFor && cardFor.kind === "agent") {   // keep an open card in step with the agent
      var cur = agentsNow().filter(function (a) { return a.name === cardFor.a.name; })[0];
      if (!cur) hideCard(); else { cardFor.a = cur; fillCard(cardFor); }
    }
  }
  function fx(f) {
    if (f.kind === "push") refuel.push({ t: performance.now(), text: "+ REFUEL · " + (share ? "pushed" : f.text) });
    else if (f.kind === "commit") refuel.push({ t: performance.now(), text: "+ COMMIT · " + (share ? "repo" : f.text) });
    if (refuel.length > 4) refuel.shift();
  }

  // ------------------------------------------------------------------ clicks: a small card, nothing invented
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hideCard() { if (card) card.hidden = true; cardFor = null; }
  function fillCard(h) {
    var rows = [], title = "";
    if (h.kind === "agent") {
      var a = h.a, nm = split(a.name), now = Date.now() / 1000;
      title = nm.who;
      rows.push(["status", a.state + (a.state === "waiting" ? " · " + dur(now - (a.changed || a.t)) : "")]);
      if (nm.project) rows.push(["project", nm.project]);
      if (a.text) rows.push(["doing", a.text]);
      if (a.since && a.state === "working") rows.push(["working for", dur(now - a.since)]);
      if (a.t) rows.push(["last activity", dur(now - a.t) + " ago"]);
    } else if (h.kind === "lamp") {
      title = h.l.label; rows.push([h.l.on ? "on" : "off", h.l.tip]);
    } else if (h.kind === "more") {
      title = h.list.length + " more agents";
      h.list.forEach(function (a) { rows.push([split(a.name).who, a.state + (a.text ? " · " + a.text : "")]); });
    }
    card.innerHTML = "<b>" + esc(title) + "</b>" + rows.map(function (r) { return "<div><span>" + esc(r[0]) + "</span><i>" + esc(r[1]) + "</i></div>"; }).join("");
  }
  function hitAt(e) {
    var cv = document.getElementById("scene"), r = cv.width / innerWidth, x = e.clientX * r, y = e.clientY * r;
    for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; }
    return null;
  }
  function onClick(e) {
    if (!document.body.classList.contains("garage")) return;
    var h = hitAt(e);
    if (!h) { hideCard(); return; }
    if (!card) { card = document.createElement("div"); card.id = "gcard"; document.body.appendChild(card); }
    cardFor = h; cardAt = performance.now(); fillCard(h); card.hidden = false;
    var cw = card.offsetWidth || 260, ch = card.offsetHeight || 120;
    card.style.left = clamp(e.clientX + 14, 8, innerWidth - cw - 8) + "px";
    card.style.top = clamp(e.clientY - ch - 14, 8, innerHeight - ch - 8) + "px";
  }
  addEventListener("click", onClick);
  addEventListener("mousemove", function (e) {
    if (!document.body.classList.contains("garage")) return;
    var cv = document.getElementById("scene"); if (cv) cv.style.cursor = hitAt(e) ? "pointer" : "";
  }, { passive: true });

  window.PulseGarage = { draw: draw, update: update, fx: fx, reset: function () { bg = null; } };
})();
