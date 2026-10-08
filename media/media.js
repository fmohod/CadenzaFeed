/* ============================================================
   MODEL AUCTIONS — media/media.js
   The "live TV" wrapper over YouTube-hosted video.

   Nothing here streams. Each channel is a lineup of published
   YouTube videos that loops forever against a fixed epoch, so
   every visitor computes the same "what is on right now" from
   the clock alone — no server, no state. Nothing loads from
   YouTube until someone clicks; until then the page is poster
   images and arithmetic.

   Contract: MEDIA.md in the repo root. Data: channels.json.
   ============================================================ */
(function () {
  'use strict';

  var MANIFEST_URL = 'channels.json';
  var THUMB = function (id, size) {
    return 'https://i.ytimg.com/vi/' + id + '/' + (size || 'hqdefault') + '.jpg';
  };

  var state = {
    manifest: null,
    channels: [],          // normalized: {number,id,name,tagline,lineup:[{id,title,dur,...}],total}
    view: 'guide',
    player: null,          // YT.Player once created
    apiReady: false,
    apiLoading: false,
    playing: null,         // {channel, index, joinedLive}
    tickTimer: null
  };

  // ── helpers ────────────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDur(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? h + ':' + pad(m) + ':' + pad(sec) : m + ':' + pad(sec);
  }
  function fmtClock(d) {
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + pad(m) + ' ' + ampm;
  }
  function parseDur(v) {
    // accepts seconds (number) or "m:ss" / "h:mm:ss"
    if (typeof v === 'number') return v;
    var parts = String(v).split(':').map(Number);
    var s = 0;
    for (var i = 0; i < parts.length; i++) s = s * 60 + parts[i];
    return s;
  }

  // ── schedule math ──────────────────────────────────────────
  // Position of a channel's loop at time t (ms since epoch).
  function channelPosition(ch, t) {
    var epoch = state.manifest.epochMs;
    var elapsed = ((t - epoch) / 1000) % ch.total;
    if (elapsed < 0) elapsed += ch.total;
    var acc = 0;
    for (var i = 0; i < ch.lineup.length; i++) {
      var v = ch.lineup[i];
      if (elapsed < acc + v.dur) {
        return { index: i, offset: elapsed - acc, startsAt: t - (elapsed - acc) * 1000, video: v };
      }
      acc += v.dur;
    }
    return { index: 0, offset: 0, startsAt: t, video: ch.lineup[0] };
  }

  // Every program that touches the window [from, to] on a channel.
  function channelBlocks(ch, from, to) {
    var blocks = [];
    var pos = channelPosition(ch, from);
    var cursor = pos.startsAt;
    var idx = pos.index;
    var guard = 0;
    while (cursor < to && guard++ < 2000) {
      var v = ch.lineup[idx];
      blocks.push({ video: v, index: idx, start: cursor, end: cursor + v.dur * 1000 });
      cursor += v.dur * 1000;
      idx = (idx + 1) % ch.lineup.length;
    }
    return blocks;
  }

  // ── rendering: player ──────────────────────────────────────
  function renderPoster() {
    var poster = $('#poster');
    var now = Date.now();
    var ch = state.channels[0];
    var pos = channelPosition(ch, now);
    poster.style.backgroundImage = 'url(' + THUMB(pos.video.id, 'maxresdefault') + '), url(' + THUMB(pos.video.id) + ')';
    $('#poster-ch').textContent = 'CH ' + ch.number + ' · ' + ch.name;
    $('#poster-title').textContent = pos.video.title;
    $('#poster-sub').textContent = 'On now · ' + fmtDur(pos.offset) + ' in · click to join';
    poster.onclick = function () { play(ch, pos.index, true); };
  }

  function setNowBar(ch, index, joinedLive) {
    var v = ch.lineup[index];
    var next = ch.lineup[(index + 1) % ch.lineup.length];
    $('#now-ch').textContent = 'CH ' + ch.number + ' · ' + ch.name;
    $('#now-title').textContent = v.title;
    $('#now-meta').textContent = (joinedLive ? 'Joined in progress' : 'From the top') + ' · ' + fmtDur(v.dur) + (v.location ? ' · ' + v.location : '');
    $('#now-next').textContent = 'Up next: ' + next.title;
    $('#now-yt').href = 'https://www.youtube.com/watch?v=' + v.id;
    $('#now-bar').hidden = false;
  }

  function loadApi(cb) {
    if (state.apiReady) return cb();
    if (state.apiLoading) { document.addEventListener('yt-ready', cb, { once: true }); return; }
    state.apiLoading = true;
    window.onYouTubeIframeAPIReady = function () {
      state.apiReady = true;
      document.dispatchEvent(new Event('yt-ready'));
    };
    document.addEventListener('yt-ready', cb, { once: true });
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  function play(ch, index, joinLive) {
    var v = ch.lineup[index];
    var start = 0;
    if (joinLive) {
      var pos = channelPosition(ch, Date.now());
      if (pos.index === index) start = Math.floor(pos.offset);
    }
    state.playing = { channel: ch, index: index, joinedLive: !!joinLive };
    $('#poster').hidden = true;
    $('#player-shell').hidden = false;
    setNowBar(ch, index, joinLive);
    markActiveChannel(ch);
    $('#stage').scrollIntoView({ behavior: 'smooth', block: 'start' });

    loadApi(function () {
      if (state.player) {
        state.player.loadVideoById({ videoId: v.id, startSeconds: start });
        return;
      }
      state.player = new YT.Player('player', {
        host: 'https://www.youtube-nocookie.com',
        videoId: v.id,
        playerVars: { autoplay: 1, start: start, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: function (e) { e.target.playVideo(); },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.ENDED && state.playing) {
              var p = state.playing;
              var nextIndex = (p.index + 1) % p.channel.lineup.length;
              play(p.channel, nextIndex, false);
            }
          }
        }
      });
    });
  }

  function markActiveChannel(ch) {
    $$('.guide-row').forEach(function (r) { r.classList.toggle('is-active', r.dataset.ch === ch.id); });
  }

  // ── rendering: guide ───────────────────────────────────────
  function renderGuide() {
    var wrap = $('#guide');
    wrap.innerHTML = '';
    var m = state.manifest;
    var now = Date.now();
    var stepMs = m.guideStepMin * 60000;
    var from = Math.floor(now / stepMs) * stepMs;      // snap to the step
    var to = from + m.guideWindowMin * 60000;
    var span = to - from;

    // header row: time marks
    var head = el('div', 'guide-row guide-head');
    head.appendChild(el('div', 'guide-ch', 'Channel'));
    var track = el('div', 'guide-track');
    for (var t = from; t < to; t += stepMs) {
      var mark = el('div', 'guide-mark', fmtClock(new Date(t)));
      mark.style.left = ((t - from) / span * 100) + '%';
      track.appendChild(mark);
    }
    head.appendChild(track);
    wrap.appendChild(head);

    state.channels.forEach(function (ch) {
      var row = el('div', 'guide-row');
      row.dataset.ch = ch.id;
      var cell = el('div', 'guide-ch');
      cell.appendChild(el('span', 'guide-num', String(ch.number)));
      var names = el('div', 'guide-names');
      names.appendChild(el('span', 'guide-name', ch.name));
      names.appendChild(el('span', 'guide-tag', ch.tagline || ''));
      cell.appendChild(names);
      cell.onclick = function () { var p = channelPosition(ch, Date.now()); play(ch, p.index, true); };
      row.appendChild(cell);

      var tr = el('div', 'guide-track');
      var blocks;
      if (ch.total * 1000 < stepMs) {
        // A loop shorter than one guide column would draw as confetti.
        // Show it as what it is: one continuous program that loops.
        blocks = [{ video: { id: ch.lineup[0].id, title: ch.name + ' · loops every ' + fmtDur(ch.total), dur: ch.total }, index: channelPosition(ch, now).index, start: from, end: to, isLoop: true }];
      } else {
        blocks = channelBlocks(ch, from, to);
      }
      blocks.forEach(function (b) {
        var s = Math.max(b.start, from), e = Math.min(b.end, to);
        var block = el('button', 'guide-block');
        block.type = 'button';
        block.style.left = ((s - from) / span * 100) + '%';
        block.style.width = ((e - s) / span * 100) + '%';
        if (b.start < now && b.end > now) block.classList.add('is-now');
        if (b.start < from) block.classList.add('is-clipped');
        block.appendChild(el('span', 'guide-block-title', b.video.title));
        block.appendChild(el('span', 'guide-block-time', fmtClock(new Date(b.start)) + ' · ' + fmtDur(b.video.dur)));
        block.title = b.video.title + ' — ' + fmtClock(new Date(b.start));
        block.onclick = (function (b) {
          return function () {
            var live = b.start <= Date.now() && b.end > Date.now();
            play(ch, b.index, live);
          };
        })(b);
        tr.appendChild(block);
      });
      var nowLine = el('div', 'guide-now');
      nowLine.style.left = ((now - from) / span * 100) + '%';
      tr.appendChild(nowLine);
      row.appendChild(tr);
      wrap.appendChild(row);
    });

    if (state.playing) markActiveChannel(state.playing.channel);
    $('#guide-window').textContent = 'Next ' + m.guideWindowMin + ' minutes · ' + fmtClock(new Date(now));
  }

  // ── rendering: browse ──────────────────────────────────────
  function tile(v, ch, index) {
    var t = el('button', 'tile');
    t.type = 'button';
    var img = el('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = THUMB(v.id);
    t.appendChild(img);
    t.appendChild(el('span', 'tile-dur', fmtDur(v.dur)));
    var body = el('div', 'tile-body');
    body.appendChild(el('span', 'tile-title', v.title));
    body.appendChild(el('span', 'tile-meta', (v.location || '') + (v.year ? (v.location ? ' · ' : '') + v.year : '')));
    if (v.desc) body.appendChild(el('span', 'tile-desc', v.desc));
    t.appendChild(body);
    t.onclick = function () {
      if (ch) play(ch, index, false);
      else playLoose(v);
    };
    return t;
  }

  // A video outside every lineup plays as a one-item channel.
  function playLoose(v) {
    var ch = { number: '·', id: 'loose-' + v.id, name: 'On demand', tagline: '', lineup: [v], total: v.dur };
    play(ch, 0, false);
  }

  function renderBrowse() {
    var wrap = $('#browse');
    wrap.innerHTML = '';
    var now = Date.now();

    // hero: what is on each channel right now
    var hero = el('div', 'browse-hero');
    state.channels.forEach(function (ch) {
      var pos = channelPosition(ch, now);
      var card = el('button', 'hero-card');
      card.type = 'button';
      card.style.backgroundImage = 'url(' + (ch.art || THUMB(pos.video.id)) + ')';
      var inner = el('div', 'hero-inner');
      inner.appendChild(el('span', 'hero-ch', 'CH ' + ch.number + ' · ' + ch.name));
      inner.appendChild(el('span', 'hero-title', pos.video.title));
      inner.appendChild(el('span', 'hero-sub', 'On now · ' + fmtDur(pos.offset) + ' in'));
      card.appendChild(inner);
      card.onclick = function () { play(ch, pos.index, true); };
      hero.appendChild(card);
    });
    wrap.appendChild(hero);

    // one row per channel, in lineup order
    state.channels.forEach(function (ch) {
      var row = el('section', 'browse-row');
      var h = el('div', 'browse-row-head');
      h.appendChild(el('h3', null, 'Channel ' + ch.number + ' — ' + ch.name));
      h.appendChild(el('span', 'browse-row-sub', ch.lineup.length + ' videos · ' + fmtDur(ch.total) + ' loop'));
      row.appendChild(h);
      var strip = el('div', 'tile-strip');
      ch.lineup.forEach(function (v, i) { strip.appendChild(tile(v, ch, i)); });
      row.appendChild(strip);
      wrap.appendChild(row);
    });

    // everything not in a lineup
    var inLineup = {};
    state.channels.forEach(function (ch) { ch.lineup.forEach(function (v) { inLineup[v.id] = true; }); });
    var loose = Object.keys(state.manifest.videos).filter(function (id) { return !inLineup[id]; });
    if (loose.length) {
      var row2 = el('section', 'browse-row');
      var h2 = el('div', 'browse-row-head');
      h2.appendChild(el('h3', null, 'Also on the channel'));
      h2.appendChild(el('span', 'browse-row-sub', 'Not in a lineup yet'));
      row2.appendChild(h2);
      var strip2 = el('div', 'tile-strip');
      loose.forEach(function (id) { strip2.appendChild(tile(state.manifest.videos[id], null, 0)); });
      row2.appendChild(strip2);
      wrap.appendChild(row2);
    }
  }

  // ── rendering: app (the phone streaming-app shape) ─────────
  // Portrait cards cut from 16:9 thumbnails, a billboard for what
  // is on, a "continue" row with the loop's progress, a picks row,
  // then one row per channel. Chips filter the rows by channel.
  var appFilter = 'all';

  function appCard(v, ch, index, opts) {
    opts = opts || {};
    var c = el('button', 'app-card' + (opts.wide ? ' app-card-wide' : ''));
    c.type = 'button';
    var img = el('img');
    img.loading = 'lazy'; img.alt = ''; img.src = THUMB(v.id);
    c.appendChild(img);
    c.appendChild(el('span', 'app-card-scrim'));
    if (opts.corner) c.appendChild(el('span', 'app-corner', opts.corner));
    if (opts.play) c.appendChild(el('span', 'app-card-play', '▶'));
    var t = el('span', 'app-card-title', shortTitle(v.title));
    c.appendChild(t);
    if (opts.badge) c.appendChild(el('span', 'app-badge', opts.badge));
    if (opts.progress != null) {
      var bar = el('span', 'app-progress');
      var fill = el('span', 'app-progress-fill');
      fill.style.width = Math.round(opts.progress * 100) + '%';
      bar.appendChild(fill);
      c.appendChild(bar);
    }
    c.onclick = function () {
      if (ch) play(ch, index, !!opts.live); else playLoose(v);
    };
    return c;
  }

  function shortTitle(t) {
    // "Title | Venue, City" → "Title" for the card face; the full title is on the player
    return String(t).split(' | ')[0];
  }

  function appRow(title, sub, cards) {
    var row = el('section', 'app-row');
    var head = el('div', 'app-row-head');
    head.appendChild(el('h3', null, title));
    if (sub) head.appendChild(el('span', 'app-row-sub', sub));
    row.appendChild(head);
    var strip = el('div', 'app-strip');
    cards.forEach(function (c) { strip.appendChild(c); });
    row.appendChild(strip);
    return row;
  }

  function renderApp() {
    var chips = $('#app-chips');
    var body = $('#app-body');
    chips.innerHTML = ''; body.innerHTML = '';
    var now = Date.now();

    // chips: All + one per channel
    [{ id: 'all', name: 'All' }].concat(state.channels).forEach(function (c) {
      var b = el('button', 'app-chip' + (appFilter === c.id ? ' is-active' : ''), c.name);
      b.type = 'button';
      b.onclick = function () { appFilter = c.id; renderApp(); };
      chips.appendChild(b);
    });

    var shown = state.channels.filter(function (c) { return appFilter === 'all' || c.id === appFilter; });

    // billboard: what is on the first shown channel right now
    var feat = shown[0];
    var fpos = channelPosition(feat, now);
    var bb = el('div', 'app-billboard');
    bb.style.backgroundImage = 'url(' + THUMB(fpos.video.id, 'maxresdefault') + '), url(' + THUMB(fpos.video.id) + ')';
    var bbInner = el('div', 'app-billboard-inner');
    bbInner.appendChild(el('span', 'app-billboard-mark'));
    var bbText = el('div', 'app-billboard-text');
    bbText.appendChild(el('span', 'app-billboard-title', shortTitle(fpos.video.title)));
    var tags = ['Channel ' + feat.number, feat.name];
    if (fpos.video.location) tags.push(fpos.video.location);
    tags.push(fmtDur(fpos.video.dur));
    bbText.appendChild(el('span', 'app-billboard-tags', tags.join('  ·  ')));
    var btns = el('div', 'app-billboard-btns');
    var b1 = el('button', 'app-btn app-btn-primary', '▶  Play');
    b1.type = 'button'; b1.onclick = function () { play(feat, fpos.index, false); };
    var b2 = el('button', 'app-btn app-btn-secondary', '⦿  Join live · ' + fmtDur(fpos.offset) + ' in');
    b2.type = 'button'; b2.onclick = function () { play(feat, fpos.index, true); };
    btns.appendChild(b1); btns.appendChild(b2);
    bbText.appendChild(btns);
    bbInner.appendChild(bbText);
    bb.appendChild(bbInner);
    body.appendChild(bb);

    // "on now" row: every shown channel, with the loop's progress
    body.appendChild(appRow('On now across the channels', null, shown.map(function (ch) {
      var p = channelPosition(ch, now);
      return appCard(p.video, ch, p.index, { play: true, live: true, badge: 'CH ' + ch.number + ' · on now', progress: p.offset / p.video.dur });
    })));

    // picks: the longest video in each shown channel, numbered
    var picks = [];
    shown.forEach(function (ch) {
      var best = 0;
      ch.lineup.forEach(function (v, i) { if (v.dur > ch.lineup[best].dur) best = i; });
      picks.push({ v: ch.lineup[best], ch: ch, i: best });
    });
    body.appendChild(appRow('Top picks', 'Longest on each channel', picks.map(function (p, n) {
      return appCard(p.v, p.ch, p.i, { corner: 'TOP ' + (n + 1), badge: p.ch.name });
    })));

    // one row per shown channel
    shown.forEach(function (ch) {
      body.appendChild(appRow(ch.name, ch.lineup.length + ' videos · loops every ' + fmtDur(ch.total), ch.lineup.map(function (v, i) {
        return appCard(v, ch, i, { badge: fmtDur(v.dur) });
      })));
    });

    // loose videos, only on "All"
    if (appFilter === 'all') {
      var inLineup = {};
      state.channels.forEach(function (ch) { ch.lineup.forEach(function (v) { inLineup[v.id] = true; }); });
      var loose = Object.keys(state.manifest.videos).filter(function (id) { return !inLineup[id]; });
      if (loose.length) {
        body.appendChild(appRow('Also on the channel', 'Not in a lineup yet', loose.map(function (id) {
          var v = state.manifest.videos[id];
          return appCard(v, null, 0, { badge: fmtDur(v.dur) });
        })));
      }
    }
  }

  // ── view switching ─────────────────────────────────────────
  function setView(v) {
    state.view = v;
    $$('.view-tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === v); });
    $$('.app-tab[data-view]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === v); });
    $('#guide').hidden = v !== 'guide';
    $('#guide-window').hidden = v !== 'guide';
    $('#browse').hidden = v !== 'browse';
    $('#app').hidden = v !== 'app';
    document.body.classList.toggle('media-app-mode', v === 'app');
    if (v === 'app') renderApp();
    // masthead: Streaming is the guide; Media is everything else
    var navMedia = $('#nav-media'), navStreaming = $('#nav-streaming');
    if (navMedia && navStreaming) {
      navMedia.classList.toggle('active', v !== 'guide');
      navStreaming.classList.toggle('active', v === 'guide');
    }
  }

  // Which view to open on arrival (owner ruling 2026-09-04):
  //   ?view=guide|browse|app  → that view (the masthead's Streaming link sends ?view=guide)
  //   otherwise               → App on a phone, Browse on anything wider
  function initialView() {
    var m = /[?&]view=(guide|browse|app)\b/.exec(location.search);
    if (m) return m[1];
    return window.matchMedia('(max-width: 768px)').matches ? 'app' : 'browse';
  }

  // ── boot ───────────────────────────────────────────────────
  function normalize(m) {
    var videos = {};
    Object.keys(m.videos).forEach(function (id) {
      var v = m.videos[id];
      videos[id] = {
        id: id, title: v.title, dur: parseDur(v.duration),
        location: v.location || '', year: v.year || '', desc: v.desc || ''
      };
    });
    var channels = m.channels.map(function (c) {
      var lineup = (c.lineup || []).concat(c.extra || []).map(function (id) {
        if (!videos[id]) throw new Error('channels.json: lineup references unknown video ' + id);
        return videos[id];
      });
      var total = lineup.reduce(function (a, v) { return a + v.dur; }, 0);
      return { number: c.number, id: c.id, name: c.name, tagline: c.tagline || '', playlist: c.playlist || '', art: c.art || '', lineup: lineup, total: total };
    });
    return {
      epochMs: new Date(m.epoch).getTime(),
      guideWindowMin: m.guide_window_min || 30,
      guideStepMin: m.guide_step_min || 5,
      videos: videos,
      channels: channels
    };
  }

  function tick() {
    // The guide is a function of the clock; redraw it on the step boundary
    // and keep the now-line honest in between.
    renderGuide();
    if (!state.playing) renderPoster();
    if (state.view === 'app') renderApp();
  }

  fetch(MANIFEST_URL, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('channels.json ' + r.status); return r.json(); })
    .then(function (m) {
      state.manifest = normalize(m);
      state.channels = state.manifest.channels;
      // How many channels THIS site carries, for the copy that says so: the
      // engine is mirrored between two sites with different lineups, so the
      // number is never written into the page.
      var channelCount = state.channels.length;
      $$('[data-channel-count]').forEach(function (el) {
        el.textContent = channelCount + (channelCount === 1 ? ' channel' : ' channels');
      });
      renderPoster();
      renderGuide();
      renderBrowse();
      setView(initialView());
      $$('.view-tab, .app-tab[data-view]').forEach(function (b) {
        b.onclick = function () {
          setView(b.dataset.view);
          if (b.classList.contains('app-tab')) $('#stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
      });
      $('#now-restart').onclick = function () {
        if (state.playing) play(state.playing.channel, state.playing.index, false);
      };
      $('#now-live').onclick = function () {
        if (state.playing) {
          var p = channelPosition(state.playing.channel, Date.now());
          play(state.playing.channel, p.index, true);
        }
      };
      state.tickTimer = setInterval(tick, 15000);
      $('#media-status').textContent = '';
    })
    .catch(function (err) {
      $('#media-status').textContent = 'The channel guide could not load: ' + err.message;
    });
})();
