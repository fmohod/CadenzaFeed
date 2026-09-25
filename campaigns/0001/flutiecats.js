/* ==========================================================================
   Flutie Cats: the flying game, embedded on campaign 0001
   ==========================================================================
   The owner's scope, 2026-09-18: a small playable Flutie Cats on this
   campaign page, right above the give buttons. The flying game only (no
   lasers, no other mode), a standalone game just for this page. No
   background music and no flute controls: touch, mouse click and keyboard
   only. The sound effects are beeps and boops made by the browser's own Web
   Audio oscillators; there is no audio file.

   The high-score table (owner, 2026-09-24): the top ten scores made on this
   page persist, with initials and the date, so everybody can see them. The
   page is static, so the table lives in the Worker "campaign-board" (CAMT
   shell\campaign-board.worker.js) at the same-origin path board, next to
   this page: one GET when this script starts, and one POST when a run makes
   the top ten and the player types initials and presses Save. What crosses
   the network is initials (1-3 letters or digits), the score, and nothing
   else; the server adds the date. The best score for the visit still lives
   in this closure.

   The lifetime counters (owner, later the same day): under the table, one
   line of all-time totals for everybody who has ever played here: flights,
   time in the air, trees cleared, flaps. The same Worker keeps them; every
   run posts one small record when it ends (seconds in the air, gates
   cleared, presses), scored or not, and the reply carries the new totals.
   Nothing in that record says who flew.

   Share (owner, same ask): after a run that scored, the cabinet offers a
   picture to post: Randy in his suit, a headline drawn at random from
   HEADLINES, the score, the initials if they were saved, and this page's
   address. It is drawn on a canvas here, from randy.png in this folder, and
   never leaves the browser until the visitor presses a button. Share uses
   the device's own share sheet (Web Share, with the picture where the
   browser allows files); X and Facebook open that site's compose page in a
   new tab with the text and the link, and save the picture first so it can
   be attached; TikTok has no web compose, so it is the share sheet on a
   phone and a saved picture plus a one-line hint elsewhere. No social
   script is loaded on this page, ever.

   How it behaves on a page that takes money:
     - Nothing runs and nothing sounds until the visitor presses Play. Until
       then the stage is one painted frame: no animation loop, no audio
       context.
     - Touches, the space bar and the up arrow are taken only while the stage
       has focus and a game is live. A reader's scrolling and space bar are
       left alone.
     - It pauses when it scrolls out of view, when the tab is hidden, when
       focus leaves it or on Escape, and waits for Resume.
     - Requests to board (above) and no other: one read at start, one write
       when a run ends, one write on Save. No storage in the browser, no
       cookie. The score and the best score for the visit live in this
       closure; a reload starts them at zero. If the board cannot be reached
       the game plays exactly as before and the table says so.
     - The share buttons open nothing and send nothing until pressed, and
       load no third-party code: they are links to X's and Facebook's own
       compose pages and the browser's share sheet.
     - The give buttons below it are plain links this file never touches.
     - With scripts off the section stays hidden, so the page is as before.

   The art (drawCritter and Rocco's record) and the flight tune (GK, GK_REF,
   gkFor, RAMP, FLY_ACCEL, and the tap pulse) are copied from the full game,
   CAMT jobs/flute.py. What differs, on purpose:
     - One character, Rocco, who leads the roster in the full game.
     - Flight is the hold rule plus the tap pulse. The trill tiers (glide,
       hover, emergency lift) are the flute's idiom and are left out.
     - A press also catches a fall (a falling vy is zeroed before the pulse),
       so one tap or click always hops. In the full game a single tap from a
       full-speed fall only slows it, because the pulse (1350 x 0.3 s) is
       smaller than the top fall speed (460). Holding is unchanged.
     - The character is sized to this small stage (CAT_R_FRAC) instead of
       the full game's full-screen catR, so Rocco reads at a few hundred
       pixels tall. His hitbox is never wider than his drawn body.
     - No trail, no select screen, no intro film. The leaderboard is this
       page's own (above), not the full game's.
   ========================================================================== */
(function () {
  "use strict";

  var embed = document.getElementById("fc-embed");
  var stage = document.getElementById("fc-stage");
  var cv = document.getElementById("fc-canvas");
  var btnPlay = document.getElementById("fc-play");
  var btnMute = document.getElementById("fc-mute");
  if (!embed || !stage || !cv || !btnPlay || !cv.getContext) return;
  var cx = cv.getContext("2d");
  if (!cx) return;
  var elScore = document.getElementById("fc-score");
  var elBest = document.getElementById("fc-best");
  var elStatus = document.getElementById("fc-status");
  var elBoard = document.getElementById("fc-board-body");
  var elBoardSub = document.getElementById("fc-board-sub");
  var elStats = document.getElementById("fc-stats");
  var elShare = document.getElementById("fc-share");
  var elShareImg = document.getElementById("fc-share-img");
  var elShareH = document.getElementById("fc-share-h");
  var elShareMsg = document.getElementById("fc-share-msg");
  var formIn = document.getElementById("fc-initials");
  var inIn = document.getElementById("fc-initials-in");
  var inScore = document.getElementById("fc-initials-score");
  var inSkip = document.getElementById("fc-initials-skip");
  var inMsg = document.getElementById("fc-initials-msg");
  var btnInstall = document.getElementById("fc-install");
  var elInstallMsg = document.getElementById("fc-install-msg");

  /* ---------------------------------------------------------------- art --
     Copied from the full game. The critters are painted parametrically, so
     there is no image file. Every detail is an accuracy constraint from
     life: Rocco has NO TAIL (never drawn), one big radar ear plus a small
     flop, and a tricolor coat. */
  var ROCCO = {
    id: "rocco", name: "Rocco", sub: "the good boy · sings along",
    scale: 0.8, accent: "#b06e2e", body: "#26221f", tan: "#b06e2e",
    bib: "#f2f0ea", ears: "radar", tailStyle: "none"
  };

  // Side view facing right, centered on (0,0); every coordinate is in
  // u = r/8 grid cells so the critter stays blocky at any size.
  function drawCritter(cx, ch, r, dead, fluteUp) {
    var u = r / 8;
    var C = function (c) { return dead ? "#d07070" : c; };   // flushes red
    var D = function (c) { return dead ? "#b25c5c" : c; };
    var R = function (x, y, w, h, c) {
      cx.fillStyle = c; cx.fillRect(x * u, y * u, w * u, h * u);
    };
    var body = C(ch.body), dark = D(ch.dark || ch.body),
        lite = C(ch.light || ch.body), white = C("#f2f0ea");
    switch (ch.tailStyle) {                        // tails live behind
      case "none": break;                          // Rocco: never, ever
      case "curlUp":
        R(-11, -1, 3, 2, body); R(-12, -4, 2, 4, body); R(-11, -6, 3, 2, body); break;
      case "sickle":
        R(-10, -4, 2, 5, body); R(-9, -6, 3, 2, body); R(-7, -8, 3, 2, dark); break;
      case "hookUp":
        R(-9, -11, 2, 11, body); R(-8, -13, 4, 2, body); R(-5, -12, 2, 2, body); break;
      case "plume":
        R(-15, -3, 3, 6, body); R(-13, -5, 4, 9, lite); R(-10, -4, 2, 8, body); break;
      default:
        R(-11, -1, 3, 2, body); R(-13, -4, 2, 4, body);
        if (ch.dark) R(-13, -3, 2, 1, dark);
    }
    var legC = C(ch.tan || ch.body);
    R(-7, 5, 2, 5, legC); R(-3, 5, 2, 5, legC);    // legs
    R(2, 5, 2, 5, legC); R(6, 5, 2, 5, legC);
    if (ch.id === "elvis") {                       // white paws
      R(-7, 8.6, 2, 1.4, white); R(-3, 8.6, 2, 1.4, white);
      R(2, 8.6, 2, 1.4, white); R(6, 8.6, 2, 1.4, white);
    }
    R(-8, -6, 16, 12, body);                       // the body block
    if (ch.belly) R(-5, 6, 9, 1.6, body);
    if (ch.id === "randy") {
      R(-6, -6, 2, 9, dark); R(-2, -6, 2, 10, dark); R(2, -6, 2, 9, dark); R(6, -6, 1, 4, dark);
    }
    if (ch.id === "smokey") {
      R(-8, 4, 2, 2, lite); R(-4, 4, 2, 2, lite); R(0, 4, 2, 2, lite); R(4, 4, 2, 2, lite);
      R(5, -3, 3, 7, lite);
    }
    if (ch.bib) R(5, -2, 3, 8, C(ch.bib));         // white chest bib
    if (ch.patch) R(5.5, 1.5, 2.5, 4.5, C(ch.patch));
    R(8, -5, 2.6, 3.6, ch.id === "ella" ? dark : body);   // muzzle
    if (ch.id === "ella") R(6, -6, 2, 4, dark);
    if (ch.id === "rocco" || ch.id === "elvis")    // white muzzle / blaze
      R(8.6, -4.2, 2, 2.8, white);
    if (ch.chin) R(8.4, -2.2, 2.2, 1.2, C(ch.chin));
    if (ch.tongue) {
      R(8.8, -1.4, 1.8, 1, D("#2a2226")); R(9.2, -0.6, 1.4, 2.2, C(ch.tongue));
    }
    cx.fillStyle = body; cx.beginPath();           // ears, per style
    if (ch.ears === "radar") {                     // Rocco: one big dish...
      cx.moveTo(1.5 * u, -6 * u); cx.lineTo(4 * u, -12.5 * u); cx.lineTo(6.5 * u, -6 * u);
      cx.moveTo(-0.5 * u, -6 * u); cx.lineTo(0.5 * u, -8.5 * u); cx.lineTo(2 * u, -6 * u);
    } else if (ch.ears === "flop") {
      cx.rect(0.5 * u, -7.6 * u, 2.6 * u, 2.2 * u);
      cx.rect(5 * u, -7.6 * u, 2.6 * u, 2.2 * u);
    } else if (ch.ears === "point") {
      cx.moveTo(1 * u, -6 * u); cx.lineTo(2.5 * u, -11 * u); cx.lineTo(4.5 * u, -6 * u);
      cx.moveTo(5 * u, -6 * u); cx.lineTo(6.5 * u, -10.5 * u); cx.lineTo(8 * u, -6 * u);
    } else {                                       // cat
      cx.moveTo(2 * u, -6 * u); cx.lineTo(3 * u, -9 * u); cx.lineTo(4.5 * u, -6 * u);
      cx.moveTo(5.5 * u, -6 * u); cx.lineTo(6.8 * u, -9 * u); cx.lineTo(8 * u, -6 * u);
    }
    cx.fill();
    if (ch.tan) {                                  // Rocco: eyebrow + cheek
      R(4.6, -5.4, 1.2, 1.2, C(ch.tan)); R(7.6, -1.6, 1.6, 1.6, C(ch.tan));
    }
    R(5.6, -4.6, 1.2, 1.2, C(ch.eye || "#101214"));   // the eye
    if (fluteUp) {                                 // pressing = flute raised
      R(9, -3.6, 8, 1.1, C("#c6ccd4"));
      R(11, -3.9, 1, 0.6, C("#e8c860"));
      R(13.5, -3.9, 1, 0.6, C("#e8c860"));
      R(16.6, -3.8, 1.4, 1.5, C("#c6ccd4"));
    }
  }

  /* ------------------------------------------------------------ physics --
     The full game's flight tune. Lift slightly outmuscles gravity; the
     ceiling bonks (vy zeroed) and only the floor or a trunk ends a run.
     gkFor() is axis-true: horizontal quantities follow width, vertical ones
     follow height, so every stage size gets the same seconds of runway. */
  var GK = { gravity: 1150, lift: -1350, maxVy: 460, speed: 265,
             gapFrac: 0.34, obsEveryS: 1.9, obsW: 64, catR: 24 };
  var GK_REF = { W: 1920, H: 940 };
  var RAMP = { gap0: 0.5, speed0: 0.68, gates: 8 };    // the game eases in
  var FLY_ACCEL = { everyS: 5, factor: 1.05, max: 6 }; // and then speeds up
  var TAP_HOLD_S = 0.3;      // full game's FLAP.tapHoldS: a tap always lifts
  var CAT_R_FRAC = 0.0625;   // this embed only: radius / stage height, before
                             // the character's own scale (Rocco 0.8 -> 5%)

  function gkFor(W, H) {
    var sx = W / GK_REF.W, sy = H / GK_REF.H;
    return { gravity: GK.gravity * sy, lift: GK.lift * sy, maxVy: GK.maxVy * sy,
             speed: GK.speed * sx, gapFrac: GK.gapFrac, obsEveryS: GK.obsEveryS,
             obsW: Math.max(10, GK.obsW * sx),
             catRx: Math.max(4, GK.catR * sx),
             catRy: Math.max(10, GK.catR * sy) };
  }

  // mode: "idle" (before Play), "ready" (waiting for the first press),
  // "flying", "over" (the run ended), "paused".
  var mode = "idle";
  var G = { W: 0, H: 0, k: null, rx: 0, ry: 0, y: 0, vy: 0, airT: 0,
            held: false, holdUntil: 0, dead: false, deadAt: 0,
            score: 0, best: 0, obs: [], toNext: 1.2, t: 0, flaps: 0 };

  function isLive() { return mode === "ready" || mode === "flying" || mode === "over"; }

  function sizeGame() {
    var rect = stage.getBoundingClientRect();
    var W = Math.max(160, Math.round(rect.width));
    var H = Math.max(120, Math.round(rect.height));
    var d = window.devicePixelRatio || 1;
    // The backing store follows the device's real resolution; the canvas's
    // CSS size is 100% of the stage, so it can never push the page wider.
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cx.setTransform(d, 0, 0, d, 0, 0);
    G.W = W; G.H = H; G.k = gkFor(W, H);
    G.ry = H * CAT_R_FRAC * ROCCO.scale;
    // Axis-true width, as in the full game, but never wider than the body
    // actually drawn: nothing may end a run without visibly touching.
    G.rx = Math.min(G.ry, G.ry * (G.k.catRx / G.k.catRy));
    if (mode === "idle") G.y = H * 0.45;
    G.y = Math.max(G.ry, Math.min(H - G.ry, G.y));
  }

  /* -------------------------------------------------------------- audio --
     Beeps and boops from oscillators only. NO AudioContext exists until the
     visitor presses Play (or turns sound back on after pressing it). */
  var AC = null, master = null, muted = false;
  var VOL = 0.5;

  function quiet(p) { if (p && p.catch) p.catch(function () {}); }

  function audioStart() {
    if (muted) return;
    if (AC) { if (AC.state === "suspended") quiet(AC.resume()); return; }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;                              // no Web Audio: play on
    try {
      AC = new Ctor();
      master = AC.createGain();
      master.gain.value = VOL;
      master.connect(AC.destination);
      if (AC.state === "suspended") quiet(AC.resume());
    } catch (e) { AC = null; master = null; }
  }

  // One beep: an oscillator, a gain envelope, and a hard stop.
  function beep(freq, ms, type, vol, slideTo) {
    if (!AC || muted) return;
    try {
      var t0 = AC.currentTime, dur = ms / 1000;
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* a sound is never worth an exception */ }
  }

  var sfx = {
    start: function () { beep(392, 80, "square", 0.09);
                         setTimeout(function () { beep(493.88, 110, "square", 0.09); }, 90); },
    flap:  function () { beep(330, 70, "triangle", 0.08, 560); },
    gate:  function () { beep(880, 70, "square", 0.10); },
    bonk:  function () { beep(120, 90, "sine", 0.16); },
    die:   function () { beep(420, 420, "sawtooth", 0.14, 70); }
  };

  function setMuted(m) {
    muted = m;
    if (btnMute) btnMute.textContent = m ? "Sound: off" : "Sound: on";
    if (!AC) { if (!m && mode !== "idle") audioStart(); return; }
    try { master.gain.setValueAtTime(m ? 0 : VOL, AC.currentTime); } catch (e) { /* ignore */ }
    if (m) { if (AC.state === "running") quiet(AC.suspend()); }
    else audioStart();
  }

  /* ---------------------------------------------------------- the round -- */
  function setHUD() {
    if (elScore) elScore.textContent = String(G.score);
    if (elBest) elBest.textContent = String(G.best);
  }
  function say(text) { if (elStatus) elStatus.textContent = text; }

  function reset() {
    G.y = G.H * 0.45; G.vy = 0; G.airT = 0; G.held = false; G.holdUntil = 0;
    G.dead = false; G.score = 0; G.obs = []; G.toNext = 1.2; G.flaps = 0;
    setHUD();
  }

  function showButton(label, takeFocus) {
    btnPlay.textContent = label;
    btnPlay.hidden = false;
    if (takeFocus) { try { btnPlay.focus({ preventScroll: true }); } catch (e) { btnPlay.focus(); } }
  }

  function focusStage() {
    try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
  }

  function setLive(on) {
    if (on) stage.classList.add("fc-live"); else stage.classList.remove("fc-live");
  }

  function play() {
    audioStart();                          // Play is the gesture audio needs
    if (mode === "idle" || G.dead) reset();
    mode = "ready"; G.held = false; G.holdUntil = 0; G.vy = 0;
    btnPlay.hidden = true;
    setLive(true);
    focusStage();
    say("");
    sfx.start();
    startLoop();
  }

  function die() {
    if (G.dead) return;
    G.dead = true; G.deadAt = performance.now();
    G.held = false; G.holdUntil = 0;
    mode = "over";
    if (G.score > G.best) G.best = G.score;
    sfx.die();
    setHUD();
    say("Game over. Score " + G.score + ". Best this visit " + G.best + ".");
    setTimeout(function () { if (mode === "over") showButton("Play again", false); }, 600);
    postRun(Math.round(G.airT), G.score, G.flaps);
    if (qualifies(G.score)) offerInitials(G.score);
    else if (G.score > 0) offerShare(G.score, "");
    else hideShare();
  }

  function pause(takeFocus) {
    if (!isLive()) return;
    stopLoop();
    G.held = false; G.holdUntil = 0;
    mode = "paused";
    setLive(false);
    render();
    showButton(G.dead ? "Play again" : "Resume", takeFocus);
  }

  function press() {
    var now = performance.now();
    if (mode === "over") {
      if (now - G.deadAt < 600) return;    // no instant restart
      reset(); mode = "ready";
      btnPlay.hidden = true; say("");
    }
    if (mode === "ready") mode = "flying";
    if (mode !== "flying") return;
    G.held = true; G.flaps++;
    G.holdUntil = now + TAP_HOLD_S * 1000;
    if (G.vy > 0) G.vy = 0;                // this embed: a press catches a fall
    sfx.flap();
  }
  function release() { G.held = false; }

  function step(dt, now) {
    if (mode !== "flying") return;
    var W = G.W, H = G.H, k = G.k;

    // The first RAMP.gates gates open wider and arrive slower; then flight
    // gets 5% faster every 5 seconds in the air, compounding, up to 6x.
    var prog = Math.min(1, G.score / RAMP.gates);
    var gapF = k.gapFrac + (RAMP.gap0 - k.gapFrac) * (1 - prog);
    var accel = Math.min(FLY_ACCEL.max,
                Math.pow(FLY_ACCEL.factor, G.airT / FLY_ACCEL.everyS));
    var speed = k.speed * (RAMP.speed0 + (1 - RAMP.speed0) * prog) * accel;
    var spawnS = k.obsEveryS * (k.speed / speed);   // keep spacing, not rate
    var catX = W * 0.24;

    G.airT += dt;
    var heldNow = G.held || now < G.holdUntil;
    G.vy += (heldNow ? k.lift : k.gravity) * dt;
    G.vy = Math.max(-k.maxVy, Math.min(k.maxVy, G.vy));
    G.y += G.vy * dt;
    if (G.y < G.ry) {                              // the ceiling bonks
      if (G.vy < -k.maxVy * 0.25) sfx.bonk();
      G.y = G.ry; G.vy = 0;
    }
    if (G.y > H - G.ry) { G.y = H - G.ry; die(); return; }   // the floor ends it

    G.toNext -= dt;
    if (G.toNext <= 0) {
      G.toNext = spawnS;
      var gap = H * gapF, m = H * 0.043;
      var c = gap / 2 + m + Math.random() * (H - gap - 2 * m);
      G.obs.push({ x: W + k.obsW, top: c - gap / 2, bot: c + gap / 2, passed: false });
    }
    for (var i = 0; i < G.obs.length; i++) {
      var o = G.obs[i];
      o.x -= speed * dt;
      if (!o.passed && o.x + k.obsW < catX - G.rx) {
        o.passed = true; G.score++; setHUD(); sfx.gate();
      }
      if (catX + G.rx > o.x && catX - G.rx < o.x + k.obsW &&
          (G.y - G.ry < o.top || G.y + G.ry > o.bot)) { die(); return; }
    }
    G.obs = G.obs.filter(function (o) { return o.x > -k.obsW; });
  }

  // The arcade font the cabinet under the canvas uses (the page loads it);
  // the pixel face runs wide, so the canvas draws it a size down.
  function text(str, x, y, px, weight, color) {
    cx.fillStyle = color;
    cx.font = weight + " " + Math.round(px * 0.8) + "px 'Press Start 2P', 'IBM Plex Mono', monospace";
    cx.fillText(str, x, y);
  }

  function render() {
    var W = G.W, H = G.H, k = G.k;
    var catX = W * 0.24;
    cx.fillStyle = "#0b0d0f"; cx.fillRect(0, 0, W, H);
    for (var j = 0; j < G.obs.length; j++) {        // obstacles: tree trunks
      var ob = G.obs[j];
      cx.fillStyle = "#15304a";
      cx.fillRect(ob.x, 0, k.obsW, ob.top);
      cx.fillRect(ob.x, ob.bot, k.obsW, H - ob.bot);
    }
    var now = performance.now();
    var drawY = G.y;
    if (mode === "ready") drawY += Math.sin(G.t * 2.2) * G.ry * 0.35;   // idle bob
    cx.save();
    cx.translate(catX, drawY);
    cx.rotate(Math.max(-0.35, Math.min(0.35, G.vy / (4 * k.maxVy))));
    drawCritter(cx, ROCCO, G.ry, G.dead,
                mode === "flying" && (G.held || now < G.holdUntil));
    cx.restore();

    var fpx = Math.max(13, Math.round(Math.min(W, H * 1.6) * 0.038));
    cx.textAlign = "center";
    if (mode === "flying") {
      cx.textAlign = "right";
      text(String(G.score), W - 12, fpx + 8, fpx, "700", "#e8e6e3");
    } else if (mode === "ready") {
      text("hold to fly", W / 2, H * 0.36, fpx, "700", "#e8c860");
      text("touch, click or space bar", W / 2, H * 0.36 + fpx * 1.2,
           Math.round(fpx * 0.72), "400", "#aab0b6");
    } else if (G.dead) {
      text("score " + G.score + (G.score >= G.best && G.score > 0 ? "  (best!)" : ""),
           W / 2, H * 0.24, fpx, "700", "#e8e6e3");
      text("best this visit " + G.best, W / 2, H * 0.24 + fpx * 1.25,
           Math.round(fpx * 0.72), "400", "#aab0b6");
    } else if (mode === "paused") {
      cx.fillStyle = "rgba(11,13,15,0.55)"; cx.fillRect(0, 0, W, H);
      text("paused", W / 2, H * 0.3, fpx, "700", "#e8e6e3");
    }
  }

  var rafId = 0, looping = false, last = 0;

  function tick(now) {
    if (!looping) return;
    rafId = requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - last) / 1000 || 0);   // clamp after a stall
    last = now; G.t += dt;
    sightT += dt;
    if (sightT >= 0.25) {                 // four times a second is plenty
      sightT = 0;
      if (shownFraction() < 0.35) { pause(false); return; }
    }
    step(dt, now);
    render();
  }
  function startLoop() {
    if (looping) return;
    looping = true; last = performance.now(); sightT = 0;
    rafId = requestAnimationFrame(tick);
  }
  function stopLoop() {
    looping = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* -------------------------------------------------------------- input --
     Touch, mouse and keyboard. No microphone, no flute, no getUserMedia. */
  btnPlay.addEventListener("click", function (e) {
    e.stopPropagation();
    if (G.dead && performance.now() - G.deadAt < 600) return;
    play();
  });

  // A pointer on the stage flies only while a game is live. Before Play a
  // touch there is an ordinary scroll, left to the browser.
  stage.addEventListener("pointerdown", function (e) {
    if (e.target !== stage && e.target !== cv) return;   // the button's own
    if (!isLive()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    focusStage();
    press();
  });
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("contextmenu", function (e) {   // a long hold is play
    if (isLive()) e.preventDefault();
  });

  // Keys only while the stage itself has focus and a game is live, so the
  // space bar never steals the page's scrolling from someone reading.
  function isFly(e) {
    return e.code === "Space" || e.key === " " || e.key === "Spacebar" ||
           e.code === "ArrowUp" || e.key === "ArrowUp";
  }
  stage.addEventListener("keydown", function (e) {
    if (e.target !== stage || !isLive()) return;
    if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); pause(true); return; }
    if (!isFly(e)) return;
    e.preventDefault();
    if (e.repeat) return;
    press();
  });
  stage.addEventListener("keyup", function (e) {
    if (e.target !== stage || !isFly(e)) return;
    if (isLive()) e.preventDefault();
    release();
  });
  stage.addEventListener("blur", function (e) {
    release();
    var to = e.relatedTarget;
    if (to && embed.contains(to)) return;          // still inside the game
    pause(false);
  });

  if (btnMute) {
    // Clicking Sound keeps focus where it was, so a game in progress
    // does not pause itself.
    btnMute.addEventListener("mousedown", function (e) { e.preventDefault(); });
    btnMute.addEventListener("click", function () { setMuted(!muted); });
  }

  /* ------------------------------------------------ stop when unwatched --
     Never run where nobody is looking: a hidden tab, or a stage scrolled
     mostly out of sight, pauses the game, and only Resume starts it again.
     "Out of sight" counts the site's sticky masthead, which covers the top
     of the window, so a game scrolled up under it pauses too. Checked from
     the running loop only, so an idle page does no work at all. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(false);
  });
  var masthead = document.querySelector(".masthead");
  function coveredTop() {
    if (!masthead) return 0;
    var pos = window.getComputedStyle(masthead).position;
    if (pos !== "sticky" && pos !== "fixed") return 0;
    return Math.max(0, masthead.getBoundingClientRect().bottom);
  }
  function shownFraction() {
    var r = stage.getBoundingClientRect();
    if (!r.height) return 0;
    var top = Math.max(r.top, coveredTop());
    var bottom = Math.min(r.bottom, window.innerHeight || document.documentElement.clientHeight);
    return Math.max(0, bottom - top) / r.height;
  }
  var sightT = 0;

  /* --------------------------------------------------- the high scores --
     The top ten made on this page, from the campaign-board Worker at the
     same-origin path "board" (see the header). Loaded once, when this script
     starts, so a reader sees the table without playing. A score that makes
     the ten opens the initials form under the game; Save posts it, Skip
     drops it. The give tiers are never touched by any of this. */
  var BOARD_URL = "board";
  var BOARD_TOP = 10;
  var board = { ok: false, rows: [] };
  var posting = false;

  // Arcade style: "SEP 24 '26". The full date sits in the cell's title.
  var MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return MONTHS[d.getMonth()] + " " + d.getDate() + " '" + String(d.getFullYear()).slice(-2);
  }
  function fullDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try { return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
    catch (e) { return iso.slice(0, 10); }
  }
  function ordinal(n) {
    var s = ["TH", "ST", "ND", "RD"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function esc(str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function renderBoard(highlight) {
    if (!elBoard) return;
    if (!board.ok) {
      elBoard.innerHTML = '<p class="fc-board-empty">High scores unavailable right now<br>The game still plays</p>';
      return;
    }
    if (!board.rows.length) {
      elBoard.innerHTML = '<p class="fc-board-empty">No scores yet<br>Clear a gate to go on the board</p>';
      return;
    }
    var rows = "";
    for (var i = 0; i < board.rows.length && i < BOARD_TOP; i++) {
      var r = board.rows[i];
      var hl = (highlight && r.name === highlight.name && r.score === highlight.score && r.at === highlight.at);
      rows += "<tr" + (hl ? ' class="fc-board-you"' : "") + "><td>" + ordinal(i + 1) + "</td><td>" + esc(r.name) +
              "</td><td>" + esc(r.score) + '</td><td title="' + esc(fullDate(r.at)) + '">' + esc(fmtDate(r.at)) + "</td></tr>";
    }
    elBoard.innerHTML = '<table><thead><tr><th scope="col">Rank</th><th scope="col">Name</th>' +
      '<th scope="col">Score</th><th scope="col">Date</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }
  function takeBoard(d) {
    if (d && takeStats(d.stats)) renderStats();
    if (!d || d.ok !== true || !Array.isArray(d.top)) return false;
    board.ok = true;
    board.rows = d.top.filter(function (r) {
      return r && typeof r.name === "string" && typeof r.score === "number" && typeof r.at === "string";
    });
    return true;
  }
  function loadBoard() {
    if (!elBoard || !window.fetch) { renderBoard(); return; }
    fetch(BOARD_URL, { cache: "no-store", credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { takeBoard(d); renderBoard(); })
      .catch(function () { renderBoard(); });
  }
  // A run makes the table when there is room, or it beats the last row.
  function qualifies(score) {
    if (!board.ok || !formIn || score < 1) return false;
    if (board.rows.length < BOARD_TOP) return true;
    return score > board.rows[BOARD_TOP - 1].score;
  }
  function offerInitials(score) {
    if (!formIn) return;
    formIn.hidden = false;
    inScore.textContent = String(score);
    formIn.setAttribute("data-score", String(score));
    inIn.value = ""; inMsg.textContent = "";
    try { inIn.focus({ preventScroll: true }); } catch (e) { inIn.focus(); }
    say("New high score, " + score + ". Type your initials and press Save, or Skip.");
  }
  function closeInitials(takeFocus) {
    if (!formIn) return;
    formIn.hidden = true;
    inMsg.textContent = "";
    if (takeFocus) showButton("Play again", true);
  }
  function postScore(name, score) {
    if (posting) return;
    posting = true;
    inMsg.textContent = "Saving…";
    fetch(BOARD_URL, { method: "POST", cache: "no-store", credentials: "omit",
                       headers: { "Content-Type": "application/json" },
                       body: JSON.stringify({ kind: "campaign_score", name: name, score: score }) })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (x) {
        posting = false;
        if (x.status === 200 && takeBoard(x.d)) {
          var mine = null;
          if (x.d.rank) mine = board.rows[x.d.rank - 1] || null;
          renderBoard(mine);
          closeInitials(true);
          offerShare(score, name);
          say(x.d.rank ? "Saved. You are number " + x.d.rank + " on the board." : "Saved, but the board moved on and that score no longer makes the ten.");
          return;
        }
        inMsg.textContent = (x.d && x.d.error) ? "Not saved: " + x.d.error + "." : "Not saved. Try again.";
        try { inIn.focus({ preventScroll: true }); } catch (e) { inIn.focus(); }
      })
      .catch(function () {
        posting = false;
        inMsg.textContent = "Not saved: the board could not be reached.";
      });
  }
  if (formIn) {
    formIn.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (inIn.value || "").trim().toUpperCase();
      var score = parseInt(formIn.getAttribute("data-score"), 10) || 0;
      if (!/^[A-Z0-9]{1,3}$/.test(name)) {
        inMsg.textContent = "One to three letters or digits.";
        try { inIn.focus({ preventScroll: true }); } catch (err) { inIn.focus(); }
        return;
      }
      postScore(name, score);
    });
    inSkip.addEventListener("click", function () { closeInitials(true); offerShare(parseInt(formIn.getAttribute("data-score"), 10) || 0, ""); });
    inIn.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); closeInitials(true); }
    });
  }


  /* ------------------------------------------------ lifetime counters --
     Everybody, all time: flights, time in the air, trees cleared, flaps.
     Read with the board; one POST when a run ends, with the reply's totals
     drawn straight in. Silent when the Worker is away. */
  var stats = { ok: false, runs: 0, seconds: 0, gates: 0, flaps: 0 };
  function takeStats(st) {
    if (!st || typeof st !== "object") return false;
    var keys = ["runs", "seconds", "gates", "flaps"];
    for (var i = 0; i < keys.length; i++)
      if (typeof st[keys[i]] !== "number" || !(st[keys[i]] >= 0)) return false;
    stats.ok = true; stats.runs = st.runs; stats.seconds = st.seconds; stats.gates = st.gates; stats.flaps = st.flaps;
    return true;
  }
  function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function fmtTime(sec) {
    if (sec < 60) return fmtNum(sec) + " sec";
    var m = Math.round(sec / 60);
    if (m < 60) return fmtNum(m) + " min";
    var h = Math.floor(m / 60);
    return fmtNum(h) + " hr " + (m % 60) + " min";
  }
  function renderStats() {
    if (!elStats) return;
    if (!stats.ok || !stats.runs) { elStats.hidden = true; return; }
    elStats.innerHTML = "Everyone, all time &nbsp;&middot;&nbsp; <b>" + fmtNum(stats.runs) + "</b> flight" + (stats.runs === 1 ? "" : "s") +
      " &nbsp;&middot;&nbsp; <b>" + fmtTime(stats.seconds) + "</b> in the air" +
      " &nbsp;&middot;&nbsp; <b>" + fmtNum(stats.gates) + "</b> tree" + (stats.gates === 1 ? "" : "s") + " cleared" +
      " &nbsp;&middot;&nbsp; <b>" + fmtNum(stats.flaps) + "</b> flap" + (stats.flaps === 1 ? "" : "s");
    elStats.hidden = false;
  }
  function postRun(seconds, gates, flaps) {
    if (!window.fetch) return;
    var body = { kind: "campaign_run", seconds: Math.max(0, Math.min(600, seconds)),
                 gates: Math.max(0, Math.min(999, gates)), flaps: Math.max(0, Math.min(5000, flaps)) };
    try {
      fetch(BOARD_URL, { method: "POST", cache: "no-store", credentials: "omit", keepalive: true,
                         headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && takeStats(d.stats)) renderStats(); })
        .catch(function () {});
    } catch (e) {}
  }

  /* --------------------------------------------------------- share it --
     A picture of the score to post, drawn here from randy.png and the
     page's own words. See the header for what each button does. */
  var HEADLINES = [
    "This game is so infuriating I can't believe it's free",
    "I flew a cat into a tree for charity and I'd do it again",
    "Rocco deserved a better pilot",
    "Local cat cannot stop hitting trees. Experts baffled",
    "I have never been this angry at a pixel",
    "One more go, I said, forty minutes ago",
    "A flute-powered cat has ruined my afternoon",
    "They said it was for the kids. Nobody said it was hard",
    "Rocco flies for the kids. I fly into trees",
    "The hardest I've ever worked for a flute I don't get to keep",
    "Beat this or the cat wins",
    "My thumb has filed a complaint"
  ];
  var SHARE_URL = (function () {
    var og = document.querySelector('meta[property="og:url"]');
    if (og && og.content) return og.content;
    return location.origin + location.pathname.replace(/index\.html$/, "");
  })();
  var SHARE_TITLE = "Flutie Cats";
  var share = { score: 0, name: "", headline: "", blob: null, url: null, seq: 0 };
  var randyImg = null, randyState = "";
  function loadRandy(cb) {
    if (randyState === "ok") { cb(randyImg); return; }
    if (randyState === "bad") { cb(null); return; }
    var im = new Image();
    im.onload = function () { randyImg = im; randyState = "ok"; cb(im); };
    im.onerror = function () { randyState = "bad"; cb(null); };
    im.src = "randy.png";
  }
  function pickHeadline() { return HEADLINES[Math.floor(Math.random() * HEADLINES.length)]; }
  function shareText() {
    return SHARE_TITLE + " high score: " + share.score + ". " + share.headline + ". " +
           "Play it, beat it, and put a flute in a Houston kid's hands: " + SHARE_URL + " #FlutieCats";
  }
  function cardFont(px, weight) {
    return (weight || "400") + " " + px + "px 'Press Start 2P', 'IBM Plex Mono', monospace";
  }
  function wrapLines(c, str, maxW) {
    var words = str.split(" "), lines = [], line = "";
    for (var i = 0; i < words.length; i++) {
      var probe = line ? line + " " + words[i] : words[i];
      if (c.measureText(probe).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = probe;
    }
    if (line) lines.push(line);
    return lines;
  }
  function drawCard(randy) {
    var Wc = 1200, Hc = 630;
    var card = document.createElement("canvas");
    card.width = Wc; card.height = Hc;
    var c = card.getContext("2d");
    c.fillStyle = "#0b0d0f"; c.fillRect(0, 0, Wc, Hc);
    var glow = c.createRadialGradient(230, 330, 20, 230, 330, 420);
    glow.addColorStop(0, "rgba(232,200,96,0.22)"); glow.addColorStop(1, "rgba(232,200,96,0)");
    c.fillStyle = glow; c.fillRect(0, 0, Wc, Hc);
    c.fillStyle = "#e8c860"; c.fillRect(0, Hc - 34, Wc, 3);        // the floor line
    if (randy) {
      var rh = 560, rw = Math.round(randy.width * rh / randy.height);
      c.drawImage(randy, 70, Hc - 34 - rh + 8, rw, rh);
    }
    var x = 450, y = 92;
    c.textBaseline = "alphabetic"; c.textAlign = "left";
    c.shadowColor = "#000"; c.shadowOffsetX = 5; c.shadowOffsetY = 5; c.shadowBlur = 0;
    c.font = cardFont(52, "400"); c.fillStyle = "#e8e6e3";
    c.fillText("FLUTIE ", x, y);
    var w1 = c.measureText("FLUTIE ").width;
    c.fillStyle = "#e8c860"; c.fillText("CATS", x + w1, y);
    c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    c.font = cardFont(19, "400"); c.fillStyle = "#e8e6e3";
    var lines = wrapLines(c, "“" + share.headline.toUpperCase() + "”", Wc - x - 60);
    y = 150;
    for (var i = 0; i < lines.length && i < 4; i++) { c.fillText(lines[i], x, y); y += 32; }
    y = Math.max(y + 26, 300);
    c.font = cardFont(18, "400"); c.fillStyle = "#8a9096";
    c.fillText("HIGH SCORE", x, y);
    c.shadowOffsetX = 6; c.shadowOffsetY = 6;
    c.font = cardFont(112, "400"); c.fillStyle = "#e8c860";
    c.fillText(String(share.score), x - 4, y + 122);
    c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    if (share.name) {
      c.font = cardFont(26, "400"); c.fillStyle = "#7dc87d";
      c.fillText(share.name.split("").join(" "), x + 8 + c.measureText(String(share.score)).width * 4.3, y + 122);
    }
    c.font = cardFont(15, "400"); c.fillStyle = "#e8e6e3";
    c.fillText("PLAY IT. BEAT IT. PUT A FLUTE IN A KID'S HANDS.", x, Hc - 92);
    c.fillStyle = "#8a9096";
    c.fillText(SHARE_URL.replace(/^https?:\/\//, "").toUpperCase(), x, Hc - 60);
    // scanlines, like the cabinet
    c.fillStyle = "rgba(255,255,255,0.035)";
    for (var sy = 0; sy < Hc; sy += 3) c.fillRect(0, sy, Wc, 1);
    return card;
  }
  function buildCard() {
    var seq = ++share.seq;
    loadRandy(function (randy) {
      if (seq !== share.seq) return;
      var card;
      try { card = drawCard(randy); } catch (e) { return; }
      var done = function (blob) {
        if (seq !== share.seq || !blob) return;
        if (share.url) { try { URL.revokeObjectURL(share.url); } catch (e) {} }
        share.blob = blob; share.url = URL.createObjectURL(blob);
        if (elShareImg) { elShareImg.src = share.url; elShareImg.alt = "Share picture: Randy in his suit with his flute, " + SHARE_TITLE + " high score " + share.score; }
      };
      if (card.toBlob) card.toBlob(done, "image/png");
      else { try { var d = card.toDataURL("image/png"), bin = atob(d.split(",")[1]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); done(new Blob([arr], { type: "image/png" })); } catch (e) {} }
    });
  }
  function offerShare(score, name) {
    if (!elShare || !document.createElement("canvas").getContext) return;
    if (score !== share.score || !share.headline) share.headline = pickHeadline();
    share.score = score; share.name = name || "";
    if (elShareH) elShareH.textContent = "“" + share.headline + "”";
    if (elShareMsg) { elShareMsg.textContent = ""; elShareMsg.hidden = true; }
    elShare.hidden = false;
    buildCard();
  }
  function hideShare() { if (elShare) elShare.hidden = true; }
  function shareMsg(text) { if (elShareMsg) { elShareMsg.textContent = text; elShareMsg.hidden = false; } }
  function shareFile() {
    try { return share.blob ? new File([share.blob], "flutie-cats-score-" + share.score + ".png", { type: "image/png" }) : null; }
    catch (e) { return null; }
  }
  function canShareFiles() {
    var f = shareFile();
    try { return !!(f && navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); }
    catch (e) { return false; }
  }
  function webShare() {
    var data = { title: SHARE_TITLE + " high score " + share.score, text: shareText() };
    if (canShareFiles()) data.files = [shareFile()]; else data.url = SHARE_URL;
    try {
      navigator.share(data).then(function () { shareMsg("Shared."); },
                                function (e) { if (!e || e.name !== "AbortError") shareMsg("The share sheet did not open. Save the picture and post it yourself."); });
    } catch (e) { shareMsg("The share sheet did not open. Save the picture and post it yourself."); }
  }
  function saveCard() {
    if (!share.url) { shareMsg("The picture is still drawing. Try again in a moment."); return false; }
    var a = document.createElement("a");
    a.href = share.url; a.download = "flutie-cats-score-" + share.score + ".png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    return true;
  }
  function openCompose(url) {
    var w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) shareMsg("The browser blocked the new tab. Allow pop-ups for this page and try again.");
  }
  function shareTo(where) {
    if (where === "share") { webShare(); return; }
    if (canShareFiles()) { webShare(); return; }        // a phone: the sheet has X, Facebook and TikTok in it
    if (where === "save") { if (saveCard()) shareMsg("Saved to your downloads."); return; }
    var saved = saveCard();
    if (where === "x") {
      openCompose("https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText()));
      shareMsg(saved ? "The picture is saved to your downloads. Attach it to the post." : "");
    } else if (where === "facebook") {
      openCompose("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(SHARE_URL) + "&quote=" + encodeURIComponent(shareText()));
      shareMsg(saved ? "The picture is saved to your downloads. Add it to the post." : "");
    } else if (where === "tiktok") {
      shareMsg(saved ? "TikTok posts from its app: the picture is saved to your downloads. Send it to your phone and post it from there." : "");
    }
  }
  if (elShare) {
    elShare.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("button[data-share]") : null;
      if (!b) return;
      e.preventDefault();
      shareTo(b.getAttribute("data-share"));
    });
    var btnWeb = elShare.querySelector('button[data-share="share"]');
    if (btnWeb && !navigator.share) btnWeb.hidden = true;
  }

  /* ------------------------------------------------ home-screen shortcut --
     "Save to home screen" (owner, 2026-09-24): a way back to the game later.
     Chrome, Edge and Android fire beforeinstallprompt when the page's
     manifest qualifies; the button then opens the browser's own install
     prompt. Everywhere else (iPhone Safari, Firefox, desktop Safari) there is
     no prompt to open, so the button shows the one-line instruction for that
     device instead. Hidden when the page is already running as an installed
     app. No storage, no network: the manifest is a plain link in the head. */
  var installPrompt = null;
  function standalone() {
    try {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
             window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function installHint() {
    var ua = navigator.userAgent || "";
    var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios) return "On iPhone or iPad: tap Share, then \u201cAdd to Home Screen\u201d.";
    if (/Android/.test(ua)) return "In your browser menu, choose \u201cAdd to Home screen\u201d or \u201cInstall app\u201d.";
    var mac = /Mac/.test(navigator.platform || "");
    return "Bookmark this page (" + (mac ? "\u2318D" : "Ctrl+D") + "), or drag the icon in the address bar onto your desktop.";
  }
  function showInstallMsg(text) {
    if (!elInstallMsg) return;
    elInstallMsg.textContent = text;
    elInstallMsg.hidden = false;
  }
  if (btnInstall && !standalone()) {
    btnInstall.hidden = false;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();                  // keep the browser's own banner quiet; the button asks
      installPrompt = e;
    });
    window.addEventListener("appinstalled", function () {
      installPrompt = null;
      btnInstall.hidden = true;
      showInstallMsg("Saved. Flutie Cats is on your home screen.");
    });
    btnInstall.addEventListener("mousedown", function (e) { e.preventDefault(); });
    btnInstall.addEventListener("click", function () {
      if (installPrompt) {
        var p = installPrompt; installPrompt = null;
        try {
          p.prompt();
          if (p.userChoice && p.userChoice.then)
            p.userChoice.then(function (r) {
              if (!r || r.outcome !== "accepted") { installPrompt = p; showInstallMsg(installHint()); }
            }, function () { showInstallMsg(installHint()); });
        } catch (e) { showInstallMsg(installHint()); }
        return;
      }
      showInstallMsg(installHint());
    });
  }

  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { sizeGame(); if (!looping) render(); }, 120);
  });

  /* ------------------------------------------------------- first paint --
     One still frame so the reader sees the game, not a black box: Rocco and
     two trunks. No loop runs until Play. */
  embed.hidden = false;
  // repaint the still frame once the arcade font arrives, so the first
  // "hold to fly" is not drawn in the fallback face
  if (document.fonts && document.fonts.ready && document.fonts.ready.then)
    document.fonts.ready.then(function () { if (!looping) render(); }, function () {});
  sizeGame();
  G.obs = [{ x: G.W * 0.66, top: G.H * 0.16, bot: G.H * 0.64 },
           { x: G.W * 0.9, top: G.H * 0.36, bot: G.H * 0.84 }];
  setHUD();
  render();
  loadBoard();
})();
