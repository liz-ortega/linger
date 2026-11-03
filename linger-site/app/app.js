/* Linger app: plain JavaScript on Supabase (auth, database, storage, realtime). */
(function () {
"use strict";

/* ================= setup ================= */
var CFG = window.LINGER_CONFIG || {};
var sb = (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase)
  ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
var app = document.getElementById("app");

var COVERS = [
  "linear-gradient(135deg,#F7A733,#D9542A)", "linear-gradient(135deg,#F28C7E,#B93B65)",
  "linear-gradient(135deg,#3FB3A0,#1B6585)", "linear-gradient(135deg,#7F7FD5,#433A99)",
  "linear-gradient(135deg,#E6A93A,#A8661A)", "linear-gradient(135deg,#5BA474,#1C6446)",
  "linear-gradient(135deg,#4F9EF0,#1D3E8C)", "linear-gradient(135deg,#D58BBE,#7E3672)"
];
var PEOPLE_COLORS = ["#D9622B", "#2E8C9E", "#7A5BC9", "#C9466F", "#3F8F4F", "#B0702A", "#4C6FD1", "#A64CA6", "#1F7A6B", "#B8483A"];
var LINK_KINDS = ["Flights", "Trains & buses", "Stays", "Tickets", "Getting around", "Other"];
var CURRENCIES = ["EUR", "USD", "DKK", "SEK", "NOK", "GBP", "CHF", "CZK", "HUF", "PLN", "TRY", "JPY", "KRW", "MXN", "CAD", "AUD"];
var TABS = [["plan", "Plan"], ["inspo", "Inspo"], ["links", "Links"], ["when", "When"], ["split", "Split"]];
var ICONS = {
  trips: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  prep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
};

var S = {
  session: null, profile: null, people: {}, trips: null, t: null, contacts: null,
  view: "loading", tripId: null, tab: "plan", inspoBoard: "places", prepTab: "todo",
  sent: null, offline: !navigator.onLine, chan: null, chanId: null
};

/* ================= helpers ================= */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function safeUrl(u) { u = String(u || "").trim(); if (!u) return ""; if (!/^https?:\/\//i.test(u)) u = "https://" + u; try { var x = new URL(u); return (x.protocol === "http:" || x.protocol === "https:") ? x.href : ""; } catch (e) { return ""; } }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function uid() { return S.session && S.session.user.id; }
function must(res) { if (res && res.error) throw res.error; return res ? res.data : null; }
function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("on"); }, 2600);
}
function errMsg(e) {
  if (!navigator.onLine) return "You're offline. Try again when you're back online.";
  var m = (e && (e.message || e.error_description)) || "Something went wrong.";
  if (/JWT|token/i.test(m)) return "Your session expired. Please sign in again.";
  return m;
}
function hashCode(s) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function person(id) { return S.people[id] || { id: id, name: "" }; }
function nameOf(id) { if (id === uid()) return "You"; var p = person(id); return p.name || "Someone"; }
function firstName(id) { if (id === uid()) return "you"; var n = person(id).name || "Someone"; return n.split(/\s+/)[0]; }
function initials(id) { var n = (person(id).name || "?").trim(); return n.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase() || "?"; }
function colorOf(id) { return PEOPLE_COLORS[hashCode(id) % PEOPLE_COLORS.length]; }
function av(id, size) {
  size = size || 28;
  return '<span class="av" title="' + esc(nameOf(id)) + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.4) + 'px;background:' + colorOf(id) + '">' + esc(initials(id)) + '</span>';
}
function avs(ids, size) { return '<span class="avs">' + ids.map(function (i) { return av(i, size); }).join("") + "</span>"; }
function cover(i) { return COVERS[(i || 0) % COVERS.length]; }
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pd(s) { var p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function dayDiff(a, b) { return Math.round((a - b) / 864e5); }
function rangeLabel(a, b) {
  var s = pd(a), e = pd(b), y = new Date().getFullYear();
  var left = MON[s.getMonth()] + " " + s.getDate();
  var right = (e.getMonth() === s.getMonth() && e.getFullYear() === s.getFullYear()) ? String(e.getDate()) : MON[e.getMonth()] + " " + e.getDate();
  var lab = a === b ? left : left + "–" + right;
  if (e.getFullYear() !== y) lab += ", " + e.getFullYear();
  return lab;
}
function money(n, cur) { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR", maximumFractionDigits: 2 }).format(n); } catch (e) { return (Math.round(n * 100) / 100) + " " + cur; } }
function myTz() { return (S.profile && S.profile.tz) || guessTz(); }
function guessTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Copenhagen"; } catch (e) { return "Europe/Copenhagen"; } }
function allZones() {
  var z = [];
  try { if (Intl.supportedValuesOf) z = Intl.supportedValuesOf("timeZone"); } catch (e) {}
  if (!z.length) z = ["Europe/Copenhagen", "Europe/Stockholm", "Europe/London", "Europe/Paris", "Europe/Madrid", "Europe/Rome", "Europe/Berlin", "Europe/Amsterdam", "Europe/Prague", "Europe/Lisbon", "Europe/Athens", "Europe/Istanbul", "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Mexico_City", "America/Sao_Paulo", "Pacific/Honolulu"];
  return z;
}
function zoneOptions(sel) { return allZones().map(function (z) { return '<option value="' + esc(z) + '"' + (z === sel ? " selected" : "") + ">" + esc(z.replace(/_/g, " ").replace("/", " · ")) + "</option>"; }).join(""); }
function curOptions(sel) { return CURRENCIES.map(function (c) { return '<option' + (c === sel ? " selected" : "") + ">" + c + "</option>"; }).join(""); }
function hourIn(tz, d) { try { return +new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d); } catch (e) { return d.getHours(); } }
function timeIn(tz, d) { try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d); } catch (e) { return ""; } }
function dayIn(tz, d) { try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d); } catch (e) { return ""; } }
function inviteUrl(t) { return location.origin + "/app#/join/" + t.join_code; }
async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg || "Copied"); }
  catch (e) { window.prompt("Copy this:", text); }
}

/* ================= routing ================= */
function parts() { return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean); }
function go(h) { if (location.hash === h) route(); else location.hash = h; }

async function route() {
  if (!sb) { S.view = "noconfig"; return render(); }
  var p = parts();
  if (p[0] === "join" && p[1]) {
    lsSet("linger.pendingJoin", p[1]);
    if (!S.session) { S.view = "auth"; S.authMode = "signup"; loadPreview(p[1]); return render(); }
    if (!S.profile || !S.profile.name) { S.view = "setup"; return render(); }
    return doPendingJoin();
  }
  if (!S.session) { S.view = "auth"; S.authMode = p[0] === "signup" ? "signup" : "login"; if (lsGet("linger.pendingJoin")) loadPreview(lsGet("linger.pendingJoin")); return render(); }
  if (!S.profile) { S.view = "loading"; render(); return; }
  if (!S.profile.name) { S.view = "setup"; return render(); }
  if (p[0] === "trip" && p[1]) {
    var tab = TABS.some(function (x) { return x[0] === p[2]; }) ? p[2] : "plan";
    S.view = "trip"; S.tab = tab;
    if (S.tripId !== p[1] || !S.t) { S.tripId = p[1]; S.t = lsGet("linger.trip." + p[1], null); render(); await loadTrip(p[1]); subscribeTrip(p[1]); }
    return render();
  }
  unsubscribeTrip();
  if (p[0] === "map") {
    S.view = "map"; if (p[1]) ML.planTrip = p[1];
    if (!S.trips) S.trips = lsGet("linger.trips." + uid(), null);
    render();
    await Promise.all([S.trips && S.trips.length ? null : loadTrips(), loadMapData()]);
    return render();
  }
  if (p[0] === "home") { S.view = "home"; if (!S.contacts) { render(); await loadContacts(); } return render(); }
  if (p[0] === "prep") { S.view = "prep"; return render(); }
  if (p[0] === "profile") { S.view = "profile"; return render(); }
  S.view = "trips";
  if (!S.trips) { S.trips = lsGet("linger.trips." + uid(), null); render(); }
  await loadTrips();
  render();
}

async function loadPreview(code) {
  if (S.preview && S.preview.code === code) return;
  S.preview = { code: code };
  try {
    var d = must(await sb.rpc("trip_preview", { p_code: code }));
    if (d && d[0]) { S.preview = { code: code, name: d[0].name, place: d[0].place, members: d[0].members }; render(); }
  } catch (e) {}
}

async function doPendingJoin() {
  var code = lsGet("linger.pendingJoin");
  if (!code) return go("#/trips");
  lsDel("linger.pendingJoin");
  try {
    var tid = must(await sb.rpc("join_trip", { p_code: code }));
    S.trips = null; toast("You're in!");
    location.replace("#/trip/" + tid + "/plan");
  } catch (e) { toast(errMsg(e)); location.replace("#/trips"); }
}

/* ================= data ================= */
async function afterLogin() {
  if (S._afterLogin) return S._afterLogin;
  S._afterLogin = (async function () {
    try {
      var p = must(await sb.from("profiles").select("*").eq("id", uid()).maybeSingle());
      if (!p) p = must(await sb.from("profiles").upsert({ id: uid(), tz: guessTz() }).select().single());
      S.profile = p; S.people[p.id] = p;
      lsSet("linger.profile." + uid(), p);
    } catch (e) {
      var cached = lsGet("linger.profile." + uid(), null);
      if (cached) { S.profile = cached; S.people[cached.id] = cached; S.offline = true; }
      else { toast(errMsg(e)); }
    }
    await route();
  })();
  return S._afterLogin;
}

async function loadTrips() {
  try {
    var rows = must(await sb.from("trips")
      .select("id,name,place,cover,join_code,locked_option,created_by,created_at,locked:date_options!trips_locked_option_fkey(start_date,end_date),trip_members(user_id)")
      .order("created_at", { ascending: false }));
    var ids = {};
    rows.forEach(function (t) { (t.trip_members || []).forEach(function (m) { ids[m.user_id] = 1; }); });
    await loadPeople(Object.keys(ids));
    S.trips = rows; S.offline = false;
    lsSet("linger.trips." + uid(), rows);
  } catch (e) { if (!S.trips) S.trips = []; S.offline = !navigator.onLine || S.offline; if (navigator.onLine) toast(errMsg(e)); }
}

async function loadPeople(ids) {
  var need = ids.filter(function (i) { return i && !S.people[i]; });
  if (!need.length) return;
  var rows = must(await sb.from("profiles").select("id,name,home_base,tz,currency").in("id", need));
  rows.forEach(function (p) { S.people[p.id] = p; });
}

async function loadTrip(id) {
  try {
    var r = await Promise.all([
      sb.from("trips").select("*").eq("id", id).maybeSingle(),
      sb.from("trip_members").select("user_id,role,joined_at").eq("trip_id", id).order("joined_at"),
      sb.from("spots").select("*").eq("trip_id", id).order("position").order("created_at"),
      sb.from("votes").select("spot_id,user_id").eq("trip_id", id),
      sb.from("inspo").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
      sb.from("links").select("*").eq("trip_id", id).order("created_at"),
      sb.from("date_options").select("*").eq("trip_id", id).order("start_date"),
      sb.from("availability").select("option_id,user_id,status").eq("trip_id", id),
      sb.from("rsvps").select("user_id,status").eq("trip_id", id),
      sb.from("costs").select("*").eq("trip_id", id).order("created_at")
    ]);
    var d = r.map(must);
    if (!d[0]) { toast("That trip isn't available. You may have left it."); lsDel("linger.trip." + id); S.t = null; go("#/trips"); return; }
    var members = d[1].map(function (m) { return m.user_id; });
    var fresh = members.filter(function (m) { return m !== uid(); });
    fresh.forEach(function (m) { delete S.people[m]; });
    await loadPeople(members);
    S.t = { trip: d[0], members: members, roles: d[1], spots: d[2], votes: d[3], inspo: d[4], links: d[5], options: d[6], avail: d[7], rsvps: d[8], costs: d[9], people: members.map(person) };
    S.offline = false;
    lsSet("linger.trip." + id, S.t);
  } catch (e) {
    if (S.t && S.t.people) S.t.people.forEach(function (p) { if (p && p.id) S.people[p.id] = S.people[p.id] || p; });
    S.offline = !navigator.onLine;
    if (!S.t) { toast(errMsg(e)); go("#/trips"); }
    else if (navigator.onLine) toast(errMsg(e));
  }
}

async function loadContacts() {
  try { S.contacts = must(await sb.from("contacts").select("*").order("created_at")); lsSet("linger.contacts." + uid(), S.contacts); }
  catch (e) { S.contacts = lsGet("linger.contacts." + uid(), []); if (navigator.onLine) toast(errMsg(e)); }
}

/* live sync: tell the crew something changed; they reload */
function subscribeTrip(id) {
  if (S.chanId === id && S.chan) return;
  unsubscribeTrip();
  S.chanId = id;
  S.chan = sb.channel("trip-" + id, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "changed" }, function () { scheduleReload(); })
    .subscribe();
}
function unsubscribeTrip() { if (S.chan) { try { sb.removeChannel(S.chan); } catch (e) {} } S.chan = null; S.chanId = null; }
function ping() { if (S.chan) { try { S.chan.send({ type: "broadcast", event: "changed", payload: {} }); } catch (e) {} } }
var reloadTimer = null;
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async function () { if (S.view !== "trip" || !S.tripId) return; await loadTrip(S.tripId); softRender(); }, 250);
}
/* run a change, reload the trip, tell the crew */
async function act(fn, okMsg) {
  try { await fn(); if (S.tripId && S.view === "trip") { await loadTrip(S.tripId); ping(); } render(); if (okMsg) toast(okMsg); return true; }
  catch (e) { toast(errMsg(e)); render(); return false; }
}

/* ================= rendering ================= */
function typing() { var a = document.activeElement; return a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "checkbox"; }
function softRender() { if (typing()) { S.pending = true; return; } render(); }
document.addEventListener("focusout", function () { setTimeout(function () { if (S.pending && !typing()) { S.pending = false; render(); } }, 50); });

function render() {
  // keep half-typed drafts and focus across re-renders
  var keep = {}, focusId = document.activeElement && document.activeElement.id;
  app.querySelectorAll("input[id],textarea[id],select[id]").forEach(function (el) {
    if (el.type === "file" || el.type === "checkbox" || el.type === "radio") return;
    if (el.dataset.nokeep !== undefined) return;
    keep[el.id] = el.value;
  });
  var html;
  switch (S.view) {
    case "noconfig": html = viewNoConfig(); break;
    case "auth": html = viewAuth(); break;
    case "setup": html = viewSetup(); break;
    case "loading": html = '<div class="center"><div class="spinner" role="status" aria-label="Loading"></div></div>'; break;
    default: html = shell(viewBody());
  }
  app.innerHTML = html;
  Object.keys(keep).forEach(function (id) { var el = document.getElementById(id); if (el && !el.value && keep[id]) el.value = keep[id]; });
  if (focusId) { var f = document.getElementById(focusId); if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} } }
  document.title = titleFor();
  if (S.view === "map") mountMap(); else if (ML.el && ML.el.parentNode) ML.el.parentNode.removeChild(ML.el);
}
function titleFor() {
  if (S.view === "trip" && S.t) return S.t.trip.name + " | linger";
  var T = { trips: "Trips", map: "Map", home: "Home", prep: "Prep", profile: "Profile" }; return T[S.view] ? T[S.view] + " | linger" : "linger";
}
function viewBody() {
  switch (S.view) {
    case "trips": return viewTrips();
    case "trip": return viewTrip();
    case "map": return viewMap();
    case "home": return viewHome();
    case "prep": return viewPrep();
    case "profile": return viewProfile();
  }
  return "";
}
function shell(body) {
  var cur = S.view === "trip" ? "trips" : S.view;
  var nav = [["trips", "#/trips", "Trips"], ["map", "#/map", "Map"], ["home", "#/home", "Home"], ["prep", "#/prep", "Prep"], ["profile", "#/profile", "Profile"]];
  return '<div class="shell">' +
    '<aside class="side"><a class="wordmark" href="/" title="linger website">linge<span class="r">r</span></a>' +
      nav.map(function (n) { return '<a class="nav-btn" href="' + n[1] + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + ICONS[n[0]] + n[2] + "</a>"; }).join("") +
      '<div class="foot"><div class="row" style="gap:10px;margin-bottom:10px">' + av(uid(), 32) + '<div><div style="font-weight:600">' + esc(S.profile.name) + '</div><div class="muted small">' + esc(S.profile.home_base || "") + '</div></div></div><a href="/" class="muted">linger website ↗</a></div>' +
    "</aside>" +
    '<main class="main" id="main">' + (S.offline ? '<div class="offline">You\'re offline. You can read what you opened recently; changes need a connection.</div>' : "") + body + "</main>" +
    '<nav class="bottom" aria-label="App">' + nav.map(function (n) { return '<a href="' + n[1] + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + ICONS[n[0]] + n[2] + "</a>"; }).join("") + "</nav>" +
  "</div>";
}

/* ---------- no config / auth / setup ---------- */
function viewNoConfig() {
  return '<div class="center"><div class="auth"><a class="wordmark" href="/">linge<span class="r">r</span></a><h1>Almost ready.</h1><p class="muted">The app isn\'t connected to its database yet. Check back soon.</p><a class="btn ghost" href="/">Back to the website</a></div></div>';
}
function viewAuth() {
  var signup = S.authMode === "signup", pv = S.preview && S.preview.name ? S.preview : null;
  var head = pv
    ? '<div class="eyebrow">You\'re invited</div><h1>Join ' + esc(pv.name) + (pv.place ? " · " + esc(pv.place) : "") + '</h1><p class="muted">' + pv.members + (pv.members === 1 ? " person is" : " people are") + ' planning this trip in Linger. Sign in with your email to join them.</p>'
    : signup ? '<div class="eyebrow">Create your account</div><h1>Plan your next weekend.</h1><p class="muted">No password. We\'ll email you a link to sign in.</p>'
    : '<div class="eyebrow">Welcome back</div><h1>Log in to Linger.</h1><p class="muted">We\'ll email you a link to sign in.</p>';
  var body;
  if (S.sent) {
    body = '<div class="card"><h2 style="font-size:22px">Check your inbox</h2><p class="muted">We sent a sign-in link to <b>' + esc(S.sent) + '</b>. Open it on this device. It can take a minute, so check spam too. On a phone, open the link in the same browser you\'ll use Linger in.</p>' +
      '<div class="wrap-row"><button class="btn ghost small" data-act="resend" type="button">Send again</button><button class="btn ghost small" data-act="authReset" type="button">Use a different email</button></div></div>';
  } else {
    body = '<form class="card" data-form="auth"><label class="f" for="email">Email</label><input id="email" type="email" autocomplete="email" required placeholder="you@school.edu"><div style="height:12px"></div><button class="btn" type="submit" style="width:100%">' + (signup ? "Create account" : "Email me a sign-in link") + "</button></form>" +
      '<p class="muted small" style="margin-top:14px;text-align:center">' + (signup ? 'Already have an account? <a href="#/login">Log in</a>' : 'New to Linger? <a href="#/signup">Create an account</a>') + "</p>";
  }
  return '<div class="center"><div class="auth"><a class="wordmark" href="/">linge<span class="r">r</span></a>' + head + body + '<p class="muted small" style="text-align:center"><a href="/">← Back to the website</a></p></div></div>';
}
function viewSetup() {
  var p = S.profile || {};
  return '<div class="center"><div class="auth"><a class="wordmark" href="/">linge<span class="r">r</span></a><div class="eyebrow" style="margin-top:18px">One quick thing</div><h1>What should your crew call you?</h1><p class="muted">Your initials mark every vote, pin and RSVP, so friends know who\'s who.</p>' +
    '<form class="card" data-form="setup"><div class="field"><label class="f" for="sName">Your name</label><input id="sName" type="text" required maxlength="40" autocomplete="given-name" value="' + esc(p.name || "") + '"></div>' +
    '<div class="field"><label class="f" for="sBase">Where you\'re studying (optional)</label><input id="sBase" type="text" maxlength="60" placeholder="e.g. Copenhagen" value="' + esc(p.home_base || "") + '"></div>' +
    '<div class="field"><label class="f" for="sTz">Your time zone</label><select id="sTz">' + zoneOptions(p.tz && p.tz !== "Europe/Copenhagen" ? p.tz : guessTz()) + "</select></div>" +
    '<button class="btn" type="submit" style="width:100%">Continue</button></form></div></div>';
}

/* ---------- trips ---------- */
function stageOf(t) {
  if (!t.locked) return "planning";
  return dayDiff(pd(t.locked.end_date), today0()) < 0 ? "traveled" : "soon";
}
function viewTrips() {
  var trips = S.trips;
  var head = '<div class="page-head"><div><div class="eyebrow">Your trips</div><h1>Where to next' + (S.profile.name ? ", " + esc(S.profile.name.split(" ")[0]) : "") + '?</h1></div><div class="wrap-row"><button class="btn ghost small" data-act="joinCode" type="button">Join with a link</button><button class="btn small" data-act="newTrip" type="button">+ New trip</button></div></div>';
  if (!trips) return head + '<div class="spinner"></div>';
  var welcome = !trips.length ? '<div class="welcome"><h2 style="font-size:22px">Your first trip takes five minutes.</h2><ol><li>Tap <b>New trip</b> and name it, like "Prague".</li><li>Tap <b>Invite</b> inside the trip and paste the link in your group chat.</li><li>Everyone votes on spots and marks the dates they can do.</li><li>Lock in the dates and send the invite.</li></ol><div style="margin-top:14px"><button class="btn" data-act="newTrip" type="button">Start a trip</button></div></div>' : "";
  var groups = [["soon", "Happening soon", "Lock a date in a trip's When tab and it moves here."], ["planning", "Planning", ""], ["traveled", "Traveled", "Trips you've taken land here, with everything you saved."]];
  var html = groups.map(function (g) {
    var list = trips.filter(function (t) { return stageOf(t) === g[0]; });
    if (!trips.length && g[0] !== "planning") return "";
    if (!list.length && g[0] === "planning" && !trips.length) return "";
    return '<div class="sec-title"><h2>' + g[1] + '</h2><span class="muted small">' + list.length + (list.length === 1 ? " trip" : " trips") + "</span></div>" +
      (list.length ? '<div class="trips">' + list.map(folder).join("") + "</div>" : '<div class="empty">' + (g[2] || "No trips here yet.") + "</div>");
  }).join("");
  return head + welcome + html;
}
function folder(t) {
  var st = stageOf(t), crew = (t.trip_members || []).map(function (m) { return m.user_id; });
  var status = "Finding a date";
  if (st === "soon") { var n = dayDiff(pd(t.locked.start_date), today0()); status = n <= 0 ? "Happening now" : "In " + n + (n === 1 ? " day" : " days"); }
  if (st === "traveled") status = "Traveled";
  return '<a class="folder" href="#/trip/' + t.id + '/plan"><span class="tab" style="background:' + cover(t.cover) + '"></span><span class="body">' +
    '<span class="cover" style="background:' + cover(t.cover) + ';text-shadow:0 1px 8px rgba(0,0,0,.25)"><b>' + esc(t.name) + "</b><span>" + esc(t.place || "") + (t.locked ? " · " + rangeLabel(t.locked.start_date, t.locked.end_date) : "") + "</span></span>" +
    '<span class="meta"><span class="status ' + st + '">' + status + "</span>" + avs(crew.slice(0, 6), 26) + "</span></span></a>";
}

/* ---------- one trip ---------- */
function viewTrip() {
  var D = S.t;
  if (!D || !D.trip) return '<div class="spinner"></div>';
  var t = D.trip, opt = lockedOpt();
  var tabs = '<nav class="tabs" aria-label="Trip sections">' + TABS.map(function (x) { return '<a href="#/trip/' + t.id + "/" + x[0] + '"' + (S.tab === x[0] ? ' aria-current="page"' : "") + ">" + x[1] + "</a>"; }).join("") + "</nav>";
  var hero = '<div class="hero" style="background:' + cover(t.cover) + ';text-shadow:0 1px 8px rgba(0,0,0,.22)">' +
    '<div class="top"><a class="back" href="#/trips">‹ All trips</a><div class="wrap-row"><a class="btn ghost small" href="#/map/' + t.id + '" style="text-shadow:none">Map</a><button class="btn ghost small" data-act="invite" type="button" style="text-shadow:none">Invite</button><button class="btn ghost small" data-act="tripSettings" type="button" style="text-shadow:none" aria-label="Trip settings">•••</button></div></div>' +
    "<h1>" + esc(t.name) + '</h1><div class="sub">' + esc(t.place || "") + (t.place ? " · " : "") + (opt ? rangeLabel(opt.start_date, opt.end_date) : "Dates not set") + "</div>" +
    '<div class="row">' + avs(D.members, 32) + '<span class="small" style="opacity:.95">' + D.members.length + (D.members.length === 1 ? " person" : " people") + "</span></div></div>";
  var body = { plan: tabPlan, inspo: tabInspo, links: tabLinks, when: tabWhen, split: tabSplit }[S.tab]();
  return hero + tabs + body;
}
function lockedOpt() { var D = S.t; return D && D.trip.locked_option ? D.options.find(function (o) { return o.id === D.trip.locked_option; }) : null; }
function isCreator() { return S.t && S.t.trip.created_by === uid(); }

/* Plan */
function votesFor(id) { return S.t.votes.filter(function (v) { return v.spot_id === id; }).map(function (v) { return v.user_id; }); }
function need() { return Math.floor(S.t.members.length / 2) + 1; }
function listSpots() {
  var n = need();
  return S.t.spots.filter(function (s) { return votesFor(s.id).length >= n; })
    .sort(function (a, b) { return (a.position - b.position) || (a.created_at < b.created_at ? -1 : 1); });
}
function mapsFor(sp) { return safeUrl(sp.maps) || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(sp.name + (S.t.trip.place ? ", " + S.t.trip.place : "")); }
function tabPlan() {
  var D = S.t, n = need(), list = listSpots(), me = uid();
  var pending = D.spots.filter(function (s) { return votesFor(s.id).length < n; })
    .sort(function (a, b) { return votesFor(b.id).length - votesFor(a.id).length; });
  var route = "";
  if (list.length >= 2) {
    var q = function (s) { return encodeURIComponent(s.name + (D.trip.place ? ", " + D.trip.place : "")); };
    var pts = list.slice(0, 10);
    route = "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=" + q(pts[0]) + "&destination=" + q(pts[pts.length - 1]) + (pts.length > 2 ? "&waypoints=" + pts.slice(1, -1).map(q).join("%7C") : "");
  }
  var listHtml = list.length ? list.map(function (sp, i) {
    var v = votesFor(sp.id), mine = v.indexOf(me) >= 0;
    var det = [sp.hours, sp.cost].filter(Boolean).map(esc).join(" · ");
    var prevLocked = i > 0 && list[i - 1].locked, nextLocked = i < list.length - 1 && list[i + 1].locked;
    return '<div class="item"><span class="num">' + (i + 1) + '</span><div class="grow"><div class="name">' + esc(sp.name) + (sp.locked ? '<span class="lock">Locked</span>' : "") + "</div>" +
      (det ? '<div class="det">' + det + "</div>" : "") + (sp.note ? '<div class="det">' + esc(sp.note) + "</div>" : "") +
      '<div class="det">' + (safeUrl(sp.website) ? '<a href="' + esc(safeUrl(sp.website)) + '" target="_blank" rel="noopener">Website ↗</a>' : "") + '<a href="' + esc(mapsFor(sp)) + '" target="_blank" rel="noopener">Google Maps ↗</a></div>' +
      '<div class="row" style="margin-top:6px">' + avs(v, 22) + "</div></div>" +
      '<div class="wrap-row" style="justify-content:flex-end;max-width:170px">' +
        '<button class="icon-btn" data-act="move" data-id="' + sp.id + '" data-dir="-1" aria-label="Move ' + esc(sp.name) + ' up"' + (i === 0 || sp.locked || prevLocked ? " disabled" : "") + ">↑</button>" +
        '<button class="icon-btn" data-act="move" data-id="' + sp.id + '" data-dir="1" aria-label="Move ' + esc(sp.name) + ' down"' + (i === list.length - 1 || sp.locked || nextLocked ? " disabled" : "") + ">↓</button>" +
        '<button class="icon-btn" data-act="lockSpot" data-id="' + sp.id + '" aria-pressed="' + sp.locked + '" aria-label="' + (sp.locked ? "Unlock " : "Lock ") + esc(sp.name) + '">' + (sp.locked ? "🔒" : "🔓") + "</button>" +
        '<button class="icon-btn" data-act="editSpot" data-id="' + sp.id + '" aria-label="Edit ' + esc(sp.name) + '">✎</button>' +
        '<button class="vote" data-act="vote" data-id="' + sp.id + '" aria-pressed="' + mine + '">' + (mine ? "✓ Voted" : "Vote") + "</button>" +
      "</div></div>";
  }).join("") : '<div class="empty">Nothing on the list yet. A spot joins when most of the crew (' + n + " of " + D.members.length + ") votes for it.</div>";
  var pendHtml = pending.length ? pending.map(function (sp) {
    var v = votesFor(sp.id), mine = v.indexOf(me) >= 0;
    return '<div class="item"><div class="grow"><div class="name">' + esc(sp.name) + '</div><div class="det">' + v.length + " of " + n + " votes needed" + (sp.created_by ? " · added by " + esc(firstName(sp.created_by)) : "") + '</div><div class="meter"><i style="width:' + Math.min(100, Math.round(v.length / n * 100)) + '%"></i></div><div class="row" style="margin-top:6px">' + avs(v, 22) + "</div></div>" +
      '<div class="wrap-row"><button class="icon-btn" data-act="editSpot" data-id="' + sp.id + '" aria-label="Edit ' + esc(sp.name) + '">✎</button><button class="vote" data-act="vote" data-id="' + sp.id + '" aria-pressed="' + mine + '">' + (mine ? "✓ Voted" : "Vote") + "</button></div></div>";
  }).join("") : '<p class="muted">No spots waiting for votes. Add one below, or send places over from Inspo.</p>';
  return '<div class="cols">' +
    '<div class="card block"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2>The list</h2>' + (route ? '<a class="btn ghost tiny" href="' + esc(route) + '" target="_blank" rel="noopener">Route it in Google Maps ↗</a>' : "") + '</div><p class="muted small">Reorder with the arrows. Lock what\'s set. Edit hours, cost and links.</p>' + listHtml + "</div>" +
    '<div class="card block"><h2>Vote</h2><p class="muted small">Tap to vote. Your initials show on every vote.</p>' + pendHtml +
      '<form data-form="addSpot" class="row" style="margin-top:14px"><label class="sr" for="newSpot">Add a spot to vote on</label><input id="newSpot" type="text" maxlength="80" placeholder="Add a spot to vote on" required><button class="btn small" type="submit">Add</button></form></div>' +
  "</div>";
}

/* Inspo */
function platform(u) {
  var h = host(u);
  if (/tiktok/.test(h)) return { label: "TikTok", bg: "linear-gradient(135deg,#25F4EE,#111 55%,#FE2C55)" };
  if (/instagram/.test(h)) return { label: "Instagram", bg: "linear-gradient(135deg,#FEDA75,#D62976 55%,#4F5BD5)" };
  if (/pinterest|pin\.it/.test(h)) return { label: "Pinterest", bg: "linear-gradient(135deg,#E60023,#8C0016)" };
  if (/youtube|youtu\.be/.test(h)) return { label: "YouTube", bg: "linear-gradient(135deg,#FF4E45,#9E0E0E)" };
  if (/google\.[a-z.]+\/maps|maps\.app|goo\.gl/.test(h + new URL(u).pathname)) return { label: "Maps", bg: "linear-gradient(135deg,#34A853,#1A73E8)" };
  return { label: h || "Link", bg: "linear-gradient(135deg,#3B4A75,#1B2340)" };
}
function imgUrl(path) { return sb.storage.from("inspo").getPublicUrl(path).data.publicUrl; }
function tabInspo() {
  var D = S.t, b = S.inspoBoard;
  var pins = D.inspo.filter(function (x) { return x.board === b; });
  var seg = '<div class="seg" role="group" aria-label="Board"><button type="button" data-act="board" data-b="places" aria-pressed="' + (b === "places") + '">Places</button><button type="button" data-act="board" data-b="photo" aria-pressed="' + (b === "photo") + '">Photo inspo</button></div>';
  var add = '<div class="card" style="margin:14px 0"><form data-form="addPin"><div class="wrap-row"><label class="sr" for="pinUrl">Paste a link</label><input id="pinUrl" type="text" placeholder="Paste an Instagram, TikTok or Pinterest link" style="flex:2;min-width:220px"><label class="sr" for="pinTitle">What is it?</label><input id="pinTitle" type="text" maxlength="80" placeholder="' + (b === "places" ? "What is it? e.g. Torvehallerne" : "What's the shot?") + '" style="flex:1;min-width:160px"><button class="btn small" type="submit">Pin</button></div></form>' +
    '<div class="wrap-row" style="margin-top:10px"><label class="btn ghost small" for="pinFile" style="cursor:pointer">Upload a photo or screenshot</label><input id="pinFile" type="file" accept="image/*" class="sr" data-change="upload"><span class="muted small">Up to 6 MB</span></div></div>';
  var grid = pins.length ? '<div class="pins">' + pins.map(function (x) {
    var u = safeUrl(x.url), pf = u ? platform(u) : null, mine = x.created_by === me();
    var top = x.image_path ? '<img src="' + esc(imgUrl(x.image_path)) + '" alt="' + esc(x.title || "Inspo photo") + '" loading="lazy">'
      : '<div class="ph" style="background:' + pf.bg + '"><b>' + esc(pf.label) + "</b><span>" + esc(x.title || host(u)) + "</span></div>";
    return '<div class="pin">' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener" aria-label="Open ' + esc(x.title || pf.label) + '">' + top + "</a>" : top) +
      '<div class="pf">' + (x.title && x.image_path ? '<div class="t">' + esc(x.title) + "</div>" : "") +
      '<div class="row" style="justify-content:space-between">' + av(x.created_by, 22) + '<div class="wrap-row" style="gap:6px">' +
        (b === "places" ? '<button class="btn ghost tiny" data-act="pinToPlan" data-id="' + x.id + '" type="button">To Plan</button>' : "") +
        (mine || isCreator() ? '<button class="btn ghost tiny" data-act="delPin" data-id="' + x.id + '" type="button" aria-label="Remove pin">✕</button>' : "") +
      "</div></div></div></div>";
  }).join("") + "</div>"
    : '<div class="empty">' + (b === "places" ? "Pin places from TikTok, Instagram or Pinterest, or upload a screenshot. Send the good ones to Plan to vote." : "Save shots and poses you want to recreate on the trip.") + "</div>";
  return seg + add + grid;
}
function me() { return uid(); }

/* Links */
function tabLinks() {
  var D = S.t;
  var totals = {};
  D.links.forEach(function (l) { if (l.price != null) totals[l.currency] = (totals[l.currency] || 0) + Number(l.price); });
  var groups = LINK_KINDS.map(function (k) {
    var items = D.links.filter(function (l) { return (LINK_KINDS.indexOf(l.kind) >= 0 ? l.kind : "Other") === k; });
    if (!items.length) return "";
    return '<div class="grp"><h3>' + k + "</h3>" + items.map(function (l) {
      var u = safeUrl(l.url);
      return '<div class="item"><div class="grow"><div class="name">' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(l.name) + " ↗</a>" : esc(l.name)) + "</div>" +
        (l.details ? '<div class="det">' + esc(l.details) + "</div>" : "") + (u ? '<div class="det">' + esc(host(u)) + "</div>" : "") +
        '<div style="margin-top:6px">' + (l.booked_by ? '<span class="booked">' + av(l.booked_by, 18) + "Booked by " + esc(firstName(l.booked_by)) + "</span>" : '<span class="muted small">Not booked yet</span>') + "</div></div>" +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">' + (l.price != null ? '<span class="price">' + money(l.price, l.currency) + "</span>" : "") +
        '<div class="wrap-row" style="gap:6px;justify-content:flex-end"><button class="btn ghost tiny" data-act="book" data-id="' + l.id + '" type="button">' + (l.booked_by === me() ? "Unmark" : l.booked_by ? "I booked it" : "I booked this") + '</button><button class="icon-btn" data-act="editLink" data-id="' + l.id + '" aria-label="Edit ' + esc(l.name) + '">✎</button></div></div></div>';
    }).join("") + "</div>";
  }).join("");
  var tot = Object.keys(totals).map(function (c) { return money(totals[c], c); }).join(" + ");
  return '<div class="cols"><div class="card block"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2>Bookings &amp; getting around</h2>' + (tot ? '<span class="muted small">Listed: <b>' + tot + "</b></span>" : "") + "</div>" +
    (groups || '<div class="empty" style="margin-top:10px">No links yet. Flights, stays, tickets and transit passes land here.</div>') + "</div>" +
    '<form class="card block" data-form="addLink"><h2>Add a link</h2><p class="muted small">Paste a flight, stay, ticket or transit link.</p>' + linkFields({ kind: "Stays", currency: (S.profile.currency === "USD" ? "EUR" : S.profile.currency) || "EUR" }, "nl") +
    '<button class="btn" type="submit" style="width:100%">Save to this trip</button></form></div>';
}
function linkFields(l, p) {
  return '<div class="field"><label class="f" for="' + p + 'Kind">Type</label><select id="' + p + 'Kind">' + LINK_KINDS.map(function (k) { return "<option" + (k === l.kind ? " selected" : "") + ">" + k + "</option>"; }).join("") + "</select></div>" +
    '<div class="field"><label class="f" for="' + p + 'Name">Name</label><input id="' + p + 'Name" type="text" maxlength="100" required placeholder="e.g. Generator Hostel, 2 nights" value="' + esc(l.name || "") + '"></div>' +
    '<div class="field"><label class="f" for="' + p + 'Url">Link</label><input id="' + p + 'Url" type="text" placeholder="https://" value="' + esc(l.url || "") + '"></div>' +
    '<div class="field"><label class="f" for="' + p + 'Det">Details (optional)</label><input id="' + p + 'Det" type="text" maxlength="140" placeholder="e.g. Female dorm, breakfast included" value="' + esc(l.details || "") + '"></div>' +
    '<div class="row"><div class="field" style="flex:1"><label class="f" for="' + p + 'Price">Price (optional)</label><input id="' + p + 'Price" type="number" min="0" step="0.01" inputmode="decimal" value="' + (l.price != null ? esc(l.price) : "") + '"></div><div class="field" style="width:110px"><label class="f" for="' + p + 'Cur">Currency</label><select id="' + p + 'Cur">' + curOptions(l.currency || "EUR") + "</select></div></div>";
}

/* When + invite */
function availOf(optId, who) { var a = S.t.avail.find(function (x) { return x.option_id === optId && x.user_id === who; }); return a ? a.status : ""; }
function tabWhen() {
  var D = S.t, me_ = me(), opt = lockedOpt();
  var scored = D.options.map(function (o) {
    var y = 0, m = 0; D.members.forEach(function (u) { var s = availOf(o.id, u); if (s === "yes") y++; else if (s === "maybe") m++; });
    return { o: o, y: y, m: m, score: y + m / 2 };
  });
  var best = scored.reduce(function (a, b) { return b.score > a ? b.score : a; }, 0);
  var label = { yes: "Yes", maybe: "Maybe", no: "No", "": "·" };
  var table = D.options.length ? '<div class="scroll-x"><table class="when"><thead><tr><th scope="col">Dates</th>' +
    D.members.map(function (u) { return '<th scope="col">' + av(u, 28) + '<span class="sr">' + esc(nameOf(u)) + "</span></th>"; }).join("") + '<th scope="col">Free</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>' +
    scored.map(function (s) {
      var o = s.o, isLocked = opt && opt.id === o.id;
      return '<tr class="' + (isLocked ? "locked" : (best > 0 && s.score === best ? "best" : "")) + '"><td><b>' + rangeLabel(o.start_date, o.end_date) + "</b>" + (isLocked ? ' <span class="lock">Locked</span>' : "") + "</td>" +
        D.members.map(function (u) {
          var st = availOf(o.id, u);
          return "<td>" + (u === me_ ? '<button type="button" class="cell ' + st + '" data-act="avail" data-id="' + o.id + '" aria-label="Your answer for ' + rangeLabel(o.start_date, o.end_date) + ": " + (st || "not marked") + '. Tap to change.">' + (st ? label[st] : "Tap") + "</button>" : '<span class="cell ' + st + '">' + label[st] + "</span>") + "</td>";
        }).join("") +
        '<td><b>' + s.y + "</b>" + (s.m ? '<span class="muted small"> +' + s.m + "?</span>" : "") + "/" + D.members.length + "</td>" +
        '<td><div class="wrap-row" style="gap:4px;justify-content:flex-end;flex-wrap:nowrap">' + (isLocked ? '<button class="btn ghost tiny" data-act="lock" data-id="" type="button">Unlock</button>' : '<button class="btn tiny" data-act="lock" data-id="' + o.id + '" type="button">Lock in</button>') +
        '<button class="icon-btn" data-act="delOpt" data-id="' + o.id + '" aria-label="Remove ' + rangeLabel(o.start_date, o.end_date) + '" style="width:32px;height:32px">✕</button></div></td></tr>';
    }).join("") + "</tbody></table></div>"
    : '<div class="empty">No date options yet. Add a few weekends that could work below.</div>';
  var summary = "";
  if (!opt && D.options.length && best > 0) {
    var top = scored.filter(function (s) { return s.score === best; })[0];
    summary = '<p style="margin:0 0 10px"><b>' + (top.y === D.members.length ? "Everyone's free " : top.y + " of " + D.members.length + " free ") + rangeLabel(top.o.start_date, top.o.end_date) + ".</b> " + (top.y === D.members.length ? "Lock it in." : "Nudge the rest, or add more options.") + "</p>";
  }
  var whenCard = '<div class="card block"><h2>When</h2><p class="muted small">Tap your column to mark yes, maybe or no. The highlighted row works for the most people.</p>' + summary + table +
    '<form data-form="addOpt" class="wrap-row" style="margin-top:14px"><div style="flex:1;min-width:130px"><label class="f" for="optStart">From</label><input id="optStart" type="date" required></div><div style="flex:1;min-width:130px"><label class="f" for="optEnd">To</label><input id="optEnd" type="date"></div><button class="btn small" type="submit" style="align-self:flex-end">Add dates</button></form></div>';
  return '<div class="cols">' + whenCard + inviteCard() + "</div>";
}
function inviteCard() {
  var D = S.t, opt = lockedOpt(), t = D.trip;
  if (!opt) return '<div class="card block"><h2>The invite</h2><p class="muted">Once you lock in dates, a shareable invite with RSVPs shows up here.</p></div>';
  var mine = (D.rsvps.find(function (r) { return r.user_id === me(); }) || {}).status || "";
  var by = { going: [], maybe: [], no: [], none: [] };
  D.members.forEach(function (u) { var r = D.rsvps.find(function (x) { return x.user_id === u; }); by[r ? r.status : "none"].push(u); });
  var line = function (k, l) { return by[k].length ? '<div class="item"><div class="grow"><div class="name">' + l + " · " + by[k].length + '</div><div class="det">' + by[k].map(function (u) { return esc(nameOf(u)); }).join(", ") + "</div></div>" + avs(by[k], 24) + "</div>" : ""; };
  return '<div><div class="invite" style="background:' + cover(t.cover) + ';text-shadow:0 1px 8px rgba(0,0,0,.25)"><div class="eyebrow" style="color:#fff">You\'re invited</div><h2>' + esc(t.name) + '</h2><div style="font-size:16px">' + rangeLabel(opt.start_date, opt.end_date) + (t.place ? " · " + esc(t.place) : "") + "</div></div>" +
    '<div class="card" style="margin-top:12px"><b>Are you in?</b><div class="rsvp" role="group" aria-label="Your RSVP">' +
      [["going", "Going"], ["maybe", "Maybe"], ["no", "Can't go"]].map(function (x) { return '<button type="button" data-act="rsvp" data-s="' + x[0] + '" aria-pressed="' + (mine === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<div style="margin-top:12px">' + line("going", "Going") + line("maybe", "Maybe") + line("no", "Can't go") + line("none", "Hasn't answered") + "</div>" +
      '<button class="btn ghost small" data-act="copyInvite" type="button" style="margin-top:10px">Copy invite for the group chat</button></div></div>';
}

/* Split */
function tabSplit() {
  var D = S.t, me_ = me();
  var bal = {};
  D.costs.forEach(function (c) {
    var who = (c.split_between && c.split_between.length ? c.split_between : D.members);
    var share = Number(c.amount) / who.length, b = bal[c.currency] = bal[c.currency] || {};
    if (c.paid_by) b[c.paid_by] = (b[c.paid_by] || 0) + Number(c.amount);
    who.forEach(function (u) { b[u] = (b[u] || 0) - share; });
  });
  var settles = [];
  Object.keys(bal).forEach(function (cur) {
    var b = bal[cur], cred = [], debt = [];
    Object.keys(b).forEach(function (u) { var v = Math.round(b[u] * 100) / 100; if (v > 0.009) cred.push([u, v]); else if (v < -0.009) debt.push([u, -v]); });
    cred.sort(function (a, c) { return c[1] - a[1]; }); debt.sort(function (a, c) { return c[1] - a[1]; });
    var i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      var x = Math.min(debt[i][1], cred[j][1]);
      settles.push({ from: debt[i][0], to: cred[j][0], amt: x, cur: cur });
      debt[i][1] -= x; cred[j][1] -= x;
      if (debt[i][1] < 0.01) i++; if (cred[j][1] < 0.01) j++;
    }
  });
  var settleHtml = settles.length ? settles.map(function (s) {
    return '<div class="settle">' + av(s.from, 28) + '<span style="flex:1"><b>' + esc(nameOf(s.from)) + "</b> " + (s.from === me_ ? "pay" : "pays") + " <b>" + esc(nameOf(s.to)) + "</b></span>" + '<span class="price">' + money(s.amt, s.cur) + "</span></div>";
  }).join("") : '<p class="muted">Everyone\'s even.</p>';
  var list = D.costs.length ? D.costs.slice().reverse().map(function (c) {
    var who = c.split_between && c.split_between.length ? c.split_between : D.members;
    return '<div class="item"><div class="grow"><div class="name">' + esc(c.what) + '</div><div class="det">' + esc(c.paid_by ? nameOf(c.paid_by) : "Someone") + " paid · split " + (who.length === D.members.length ? "with everyone" : "between " + who.map(firstName).map(esc).join(", ")) + "</div></div>" +
      '<span class="price">' + money(c.amount, c.currency) + "</span>" + (c.created_by === me_ || c.paid_by === me_ || isCreator() ? '<button class="icon-btn" data-act="delCost" data-id="' + c.id + '" aria-label="Delete ' + esc(c.what) + '">✕</button>' : "") + "</div>";
  }).join("") : '<p class="muted">No costs yet.</p>';
  var form = '<form class="card block" data-form="addCost"><h2>Add a cost</h2>' +
    '<div class="field"><label class="f" for="cWhat">What</label><input id="cWhat" type="text" maxlength="80" required placeholder="e.g. Hostel, 2 nights"></div>' +
    '<div class="row"><div class="field" style="flex:1"><label class="f" for="cAmt">Amount</label><input id="cAmt" type="number" min="0.01" step="0.01" inputmode="decimal" required></div><div class="field" style="width:110px"><label class="f" for="cCur">Currency</label><select id="cCur">' + curOptions(lsGet("linger.lastCur", "EUR")) + "</select></div></div>" +
    '<div class="field"><label class="f" for="cPaid">Paid by</label><select id="cPaid">' + D.members.map(function (u) { return '<option value="' + u + '"' + (u === me_ ? " selected" : "") + ">" + esc(nameOf(u)) + "</option>"; }).join("") + "</select></div>" +
    '<fieldset class="field" style="border:0;padding:0;margin:0 0 14px"><legend class="f" style="font-weight:600;font-size:13px;margin-bottom:6px">Split between</legend><div class="checks">' + D.members.map(function (u) { return '<label><input type="checkbox" name="split" value="' + u + '" checked> ' + esc(nameOf(u)) + "</label>"; }).join("") + "</div></fieldset>" +
    '<button class="btn" type="submit" style="width:100%">Add cost</button></form>';
  return '<div class="cols"><div><div class="card block"><h2>Settle up</h2>' + settleHtml + '</div><div class="card block" style="margin-top:16px"><h2>Trip costs</h2>' + list + "</div></div>" + form + "</div>";
}


/* ---------- Map ---------- */
var ML = { map: null, el: null, markers: [], loading: null, data: null, sel: null, results: null, planTrip: null, home: null, focus: null };
var MAPLIBRE = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl";
var KINDS = { museum: "Museum", gallery: "Gallery", attraction: "Sight", viewpoint: "Viewpoint", castle: "Castle", monument: "Monument", memorial: "Memorial", church: "Church", cathedral: "Cathedral", park: "Park", garden: "Garden", cafe: "Café", restaurant: "Restaurant", bar: "Bar", pub: "Pub", bakery: "Bakery", station: "Station", train_station: "Station", halt: "Station", bus_station: "Bus station", aerodrome: "Airport", city: "City", town: "Town", village: "Village", hostel: "Hostel", hotel: "Hotel", beach: "Beach", market: "Market", marketplace: "Market", theatre: "Theatre", zoo: "Zoo", library: "Library", university: "University" };
function loadMapLib() {
  if (window.maplibregl) return Promise.resolve();
  if (ML.loading) return ML.loading;
  ML.loading = new Promise(function (res, rej) {
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = MAPLIBRE + ".css"; document.head.appendChild(l);
    var sc = document.createElement("script"); sc.src = MAPLIBRE + ".js"; sc.onload = res;
    sc.onerror = function () { ML.loading = null; rej(new Error("The map couldn't load. Check your connection.")); };
    document.head.appendChild(sc);
  });
  return ML.loading;
}
async function loadMapData() {
  try {
    var r = await Promise.all([
      sb.from("spots").select("id,trip_id,name,lat,lng,address,position,locked,created_at,hours,cost").order("position").order("created_at"),
      sb.from("votes").select("spot_id,user_id,trip_id"),
      sb.from("trip_members").select("trip_id,user_id")
    ]);
    var d = r.map(must);
    ML.data = { spots: d[0], votes: d[1], members: d[2] };
    lsSet("linger.map." + uid(), ML.data);
  } catch (e) { ML.data = ML.data || lsGet("linger.map." + uid(), { spots: [], votes: [], members: [] }); if (navigator.onLine) toast(errMsg(e)); }
}
function tripById(id) { return (S.trips || []).find(function (t) { return t.id === id; }); }
function tripColor(t) { var m = cover(t ? t.cover : 0).match(/#[0-9A-Fa-f]{6}/g); return m ? m[m.length - 1] : "#1B2340"; }
function mapOrder(tripId) {
  var D = ML.data; if (!D) return { list: [], other: [] };
  var n = D.members.filter(function (m) { return m.trip_id === tripId; }).length || 1, need_ = Math.floor(n / 2) + 1;
  var spots = D.spots.filter(function (s) { return s.trip_id === tripId; });
  var votes = function (id) { return D.votes.filter(function (v) { return v.spot_id === id; }).length; };
  var list = spots.filter(function (s) { return votes(s.id) >= need_; }).sort(function (a, b) { return (a.position - b.position) || (a.created_at < b.created_at ? -1 : 1); });
  var other = spots.filter(function (s) { return list.indexOf(s) < 0; });
  return { list: list, other: other };
}
function km(a, b) { var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r; var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.pow(Math.sin(dLng / 2), 2); return 2 * R * Math.asin(Math.sqrt(h)); }
function walkText(d) { if (d < 0.15) return "next door"; var min = Math.max(1, Math.round(d / 4.8 * 60)); return d.toFixed(1) + " km · " + (min > 90 ? "transit or a ride" : "about " + min + " min walk"); }
function hasLL(s) { return typeof s.lat === "number" && typeof s.lng === "number"; }
async function geocode(q, bias, limit) {
  var u = "https://photon.komoot.io/api/?q=" + encodeURIComponent(q) + "&limit=" + (limit || 7) + "&lang=en";
  if (bias) u += "&lat=" + bias.lat.toFixed(4) + "&lon=" + bias.lng.toFixed(4);
  var res = await fetch(u);
  if (!res.ok) throw new Error("Search isn't working right now. Try again in a minute.");
  var j = await res.json();
  return (j.features || []).map(function (f) {
    var p = f.properties || {}, c = f.geometry.coordinates;
    var where = [p.city && p.city !== p.name ? p.city : "", p.state && !p.city ? p.state : "", p.country].filter(Boolean).join(", ");
    return { name: p.name || p.street || q, lat: c[1], lng: c[0], kind: KINDS[p.osm_value] || (p.osm_value ? p.osm_value.replace(/_/g, " ") : "Place"), where: where, address: [p.street ? (p.street + (p.housenumber ? " " + p.housenumber : "")) : "", p.city].filter(Boolean).join(", ") };
  });
}
async function homeLL() {
  var hb = (S.profile.home_base || "").trim(); if (!hb) return null;
  if (ML.home && ML.home.q === hb) return ML.home;
  var cache = lsGet("linger.homeLL", null);
  if (cache && cache.q === hb) return (ML.home = cache);
  try { var r = await geocode(hb, null, 1); if (r[0]) { ML.home = { q: hb, lat: r[0].lat, lng: r[0].lng, name: hb }; lsSet("linger.homeLL", ML.home); return ML.home; } } catch (e) {}
  return null;
}
async function mountMap() {
  var host = document.getElementById("mapHost"); if (!host) return;
  if (!ML.el) { ML.el = document.createElement("div"); ML.el.style.cssText = "width:100%;height:100%"; }
  host.appendChild(ML.el);
  try { await loadMapLib(); } catch (e) { host.innerHTML = '<div class="empty" style="margin:16px">' + esc(e.message) + "</div>"; return; }
  if (!ML.map) {
    ML.map = new maplibregl.Map({ container: ML.el, style: "https://tiles.openfreemap.org/styles/liberty", center: [10, 50], zoom: 3.3, attributionControl: { compact: true } });
    ML.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    ML.map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");
    ML.fitted = false;
  } else { ML.map.resize(); }
  drawMarkers();
  if (!ML.fitted && ML.data) { ML.fitted = true; fitMap(); }
}
function mk(cls, color, text, title) {
  var el = document.createElement("button"); el.type = "button"; el.className = "mk " + cls; el.title = title; el.setAttribute("aria-label", title);
  if (color) el.style.background = color; el.textContent = text || "";
  return el;
}
function drawMarkers() {
  if (!ML.map || !ML.data) return;
  ML.markers.forEach(function (m) { m.remove(); }); ML.markers = [];
  var plan = ML.planTrip;
  ML.data.spots.filter(hasLL).forEach(function (s) {
    var t = tripById(s.trip_id); if (!t) return;
    var order = mapOrder(s.trip_id), idx = order.list.indexOf(s);
    var faded = plan && plan !== s.trip_id;
    var el = mk(idx >= 0 ? "num" : "dot" + (faded ? " faded" : ""), tripColor(t), idx >= 0 && !faded ? String(idx + 1) : "", s.name + " · " + t.name);
    if (faded && idx >= 0) el.className = "mk dot faded";
    el.addEventListener("click", function (ev) { ev.stopPropagation(); ML.sel = null; ML.focus = s.id; ML.planTrip = s.trip_id; render(); });
    ML.markers.push(new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(ML.map));
  });
  if (ML.home) ML.markers.push(new maplibregl.Marker({ element: mk("home", null, "⌂", "Home base: " + ML.home.name) }).setLngLat([ML.home.lng, ML.home.lat]).addTo(ML.map));
  if (ML.sel) ML.markers.push(new maplibregl.Marker({ element: mk("sel", null, "", ML.sel.name) }).setLngLat([ML.sel.lng, ML.sel.lat]).addTo(ML.map));
}
async function fitMap() {
  if (!ML.map) return;
  var pts = ML.data.spots.filter(hasLL).filter(function (s) { return !ML.planTrip || s.trip_id === ML.planTrip; });
  if (!pts.length) {
    var t = tripById(ML.planTrip);
    if (t && t.place) { try { var r = await geocode(t.place, null, 1); if (r[0]) return ML.map.flyTo({ center: [r[0].lng, r[0].lat], zoom: 12 }); } catch (e) {} }
    var h = await homeLL(); drawMarkers();
    if (h) return ML.map.flyTo({ center: [h.lng, h.lat], zoom: 5 });
    return;
  }
  if (pts.length === 1) return ML.map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: 14 });
  var b = new maplibregl.LngLatBounds();
  pts.forEach(function (p) { b.extend([p.lng, p.lat]); });
  ML.map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 600 });
}
function viewMap() {
  var trips = S.trips || [], D = ML.data;
  if (!ML.home && S.profile.home_base) homeLL().then(function (h) { if (h) drawMarkers(); });
  var plan = ML.planTrip && tripById(ML.planTrip) ? ML.planTrip : "";
  var side = "";
  // search
  side += '<form class="card" data-form="mapSearch" style="margin-bottom:12px"><label class="f" for="mapQ">Search any city or place</label><div class="row"><input id="mapQ" type="text" placeholder="e.g. Lisbon, or Tivoli Gardens" autocomplete="off"><button class="btn small" type="submit">Search</button></div>' +
    (ML.results ? (ML.results.length ? '<div style="margin-top:8px">' + ML.results.map(function (r, i) { return '<button type="button" class="res" data-act="mapPick" data-i="' + i + '"><b>' + esc(r.name) + '</b><span>' + esc(r.kind) + (r.where ? " · " + esc(r.where) : "") + "</span></button>"; }).join("") + "</div>" : '<p class="muted small" style="margin:8px 0 0">Nothing found. Try the nearest larger city, or add the city name.</p>') : "") + "</form>";
  // selected place
  if (ML.sel) {
    side += '<div class="card" style="margin-bottom:12px"><div class="eyebrow">' + esc(ML.sel.kind) + '</div><h3 style="font-size:22px;margin:4px 0">' + esc(ML.sel.name) + '</h3><p class="muted small" style="margin:0 0 10px">' + esc(ML.sel.where || ML.sel.address || "") + "</p>" +
      (trips.length ? '<form data-form="mapSave"><label class="f" for="mapSaveTrip">Trip to add it to</label><div class="row"><select id="mapSaveTrip" data-nokeep>' + trips.map(function (t) { return '<option value="' + t.id + '"' + (t.id === plan ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + '</select><button class="btn small" type="submit">Save</button></div><p class="muted small" style="margin:6px 0 0">It lands in the trip\'s Vote list.</p></form>'
        : '<p class="muted small">Make a trip first, then save places to it.</p><button class="btn small" data-act="newTrip" type="button">+ New trip</button>') +
      '<div class="wrap-row" style="margin-top:10px"><a class="btn ghost tiny" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + ML.sel.lat + "%2C" + ML.sel.lng + '">Google Maps ↗</a><button class="btn ghost tiny" data-act="mapClear" type="button">Close</button></div></div>';
  }
  // plan the day
  var withSpots = trips.filter(function (t) { return D && D.spots.some(function (s) { return s.trip_id === t.id; }); });
  side += '<div class="card"><h3 style="font-size:22px">Plan the day</h3><p class="muted small" style="margin:2px 0 10px">The list for a trip, in order, with walking times between stops.</p>';
  if (!D) side += '<div class="spinner"></div>';
  else if (!trips.length) side += '<p class="muted">No trips yet. Make one, then save places here.</p>';
  else {
    side += '<label class="f" for="mapTrip">Trip</label><select id="mapTrip" data-change="mapTrip" data-nokeep><option value="">All trips</option>' + trips.map(function (t) { return '<option value="' + t.id + '"' + (t.id === plan ? " selected" : "") + ">" + esc(t.name) + (withSpots.indexOf(t) < 0 ? " (no spots yet)" : "") + "</option>"; }).join("") + "</select>";
    if (plan) {
      var o = mapOrder(plan), t = tripById(plan), prev = null, total = 0, html = "";
      o.list.forEach(function (s, i) {
        var leg = prev && hasLL(prev) && hasLL(s) ? km(prev, s) : null; if (leg != null) total += leg;
        html += (leg != null ? '<div class="leg">↓ ' + walkText(leg) + "</div>" : "") +
          '<button type="button" class="stop' + (ML.focus === s.id ? " on" : "") + '" data-act="mapFocus" data-id="' + s.id + '"><span class="num" style="background:' + tripColor(t) + ';color:#fff">' + (i + 1) + '</span><span style="flex:1;text-align:left"><b>' + esc(s.name) + "</b>" + (s.locked ? ' <span class="lock">Locked</span>' : "") + '<span class="muted small" style="display:block">' + esc([s.hours, s.cost].filter(Boolean).join(" · ") || (hasLL(s) ? "" : "Not on the map yet")) + "</span></span></button>";
        if (hasLL(s)) prev = s;
      });
      side += '<div style="margin-top:12px">' + (html || '<p class="muted small">Nothing on this trip\'s list yet. Spots join the list when most of the crew votes for them.</p>') + "</div>";
      var pts = o.list.filter(hasLL);
      if (pts.length >= 2) {
        var ll = function (p) { return p.lat.toFixed(6) + "%2C" + p.lng.toFixed(6); };
        var url = "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=" + ll(pts[0]) + "&destination=" + ll(pts[pts.length - 1]) + (pts.length > 2 ? "&waypoints=" + pts.slice(1, -1).slice(0, 8).map(ll).join("%7C") : "");
        side += (total >= 0.1 ? '<p class="small" style="margin:10px 0 0"><b>About ' + total.toFixed(1) + " km</b> of walking in all.</p>" : "") + '<a class="btn small" style="margin-top:8px" target="_blank" rel="noopener" href="' + url + '">Turn-by-turn walking directions ↗</a>';
      }
      if (o.other.length) side += '<p class="muted small" style="margin:14px 0 4px">Still being voted on: ' + o.other.map(function (s) { return esc(s.name); }).join(", ") + "</p>";
      var missing = o.list.concat(o.other).filter(function (s) { return !hasLL(s); });
      if (missing.length) side += '<button class="btn ghost small" data-act="mapPlace" type="button" style="margin-top:10px">Put ' + missing.length + (missing.length === 1 ? " spot" : " spots") + " on the map</button>";
      side += '<div style="margin-top:12px"><a href="#/trip/' + plan + '/plan" class="small">Open ' + esc(t.name) + " ›</a></div>";
    } else {
      side += '<p class="muted small" style="margin:10px 0 0">Pick a trip to see its stops in order. Numbers on the map are each trip\'s list; dots are spots still being voted on.</p>';
    }
  }
  side += "</div>";
  return '<div class="page-head"><div><div class="eyebrow">Map</div><h1>Where to, and what first.</h1></div></div><div class="map-grid"><div class="map-host" id="mapHost"></div><div class="map-side">' + side + "</div></div>";
}
async function mapAfterChange(tripId) {
  await loadMapData();
  if (S.t && S.t.trip.id === tripId) { S.tripId = null; }
  S.trips = null; loadTrips().then(function () { render(); });
  render();
}

/* ---------- Home ---------- */
function goodHours(tzA, tzB) {
  var base = new Date(); base.setMinutes(0, 0, 0); var out = [];
  for (var k = 0; k < 24; k++) { var t = new Date(base.getTime() + k * 36e5); var a = hourIn(tzA, t), b = hourIn(tzB, t); out.push({ t: t, ok: a >= 8 && a < 23 && b >= 8 && b < 23 }); }
  return out;
}
function viewHome() {
  var cs = S.contacts, tz = myTz(), now = new Date();
  var list = !cs ? '<div class="spinner"></div>' : cs.length ? cs.map(function (c) {
    var hrs = goodHours(tz, c.tz), first = hrs.findIndex(function (h) { return h.ok; });
    var when = first === -1 ? "No easy overlap today. Try a weekend morning." : first === 0 ? "Good time to reach them now." : "Next good time: " + timeIn(tz, hrs[first].t) + " your time (" + timeIn(c.tz, hrs[first].t) + " for them).";
    var digits = String(c.phone || "").replace(/[^\d+]/g, "");
    return '<div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><div><h3 style="font-size:20px">' + esc(c.name) + '</h3><div class="muted small">' + esc(timeIn(c.tz, now)) + " " + esc(dayIn(c.tz, now)) + " there · " + esc(c.tz.replace(/_/g, " ")) + '</div></div><div class="wrap-row" style="gap:6px">' +
      (digits ? '<a class="btn ghost tiny" href="tel:' + esc(digits) + '">Call</a><a class="btn ghost tiny" href="sms:' + esc(digits) + '">Text</a><a class="btn ghost tiny" href="https://wa.me/' + esc(digits.replace("+", "")) + '" target="_blank" rel="noopener">WhatsApp</a>' : "") +
      '<button class="icon-btn" data-act="delContact" data-id="' + c.id + '" aria-label="Remove ' + esc(c.name) + '">✕</button></div></div>' +
      '<p style="margin:10px 0 0;font-weight:600">' + esc(when) + '</p><div class="hrs" aria-hidden="true">' + hrs.map(function (h, i) { return '<i class="' + (h.ok ? "ok" : "") + (i === 0 ? " now" : "") + '" title="' + timeIn(tz, h.t) + '"></i>'; }).join("") + '</div><div class="muted small" style="display:flex;justify-content:space-between;margin-top:4px"><span>Now</span><span>+12h</span><span>+24h</span></div></div>';
  }).join("") : '<div class="empty">Add the people you call. They don\'t need the app.</div>';
  return '<div class="page-head"><div><div class="eyebrow">Home</div><h1>Stay close to your people.</h1><p class="muted" style="margin:6px 0 0">It\'s ' + esc(timeIn(tz, now)) + ' for you. Orange hours are when you\'re both awake (8am–11pm).</p></div></div>' +
    '<div class="cols"><div>' + list + "</div><div>" +
    '<form class="card block" data-form="addContact"><h2>Add someone</h2><div class="field"><label class="f" for="hName">Name</label><input id="hName" type="text" maxlength="40" required placeholder="e.g. Mom"></div>' +
    '<div class="field"><label class="f" for="hTz">Their time zone</label><select id="hTz">' + zoneOptions(lsGet("linger.lastTz", "America/Los_Angeles")) + "</select></div>" +
    '<div class="field"><label class="f" for="hPhone">Phone, for Call, Text and WhatsApp (optional)</label><input id="hPhone" type="tel" placeholder="+1 555 123 4567"></div><button class="btn" type="submit" style="width:100%">Add</button></form>' +
    '<div class="note" style="margin-top:16px"><b>Homesick is part of it.</b> Culture shock often hits a few weeks in. Your program office and your home campus counseling center can still help while you\'re abroad. In a crisis, call the local emergency number (112 across the EU). In the US, call or text 988.</div></div></div>';
}

/* ---------- Prep ---------- */
var PREP = {
  todo: { label: "To-do", groups: [
    { name: "Before you go", items: ["Check your passport is valid for 6 months after you're back", "Find out if you need a visa or residence permit, and start early", "Book a health checkup and refill prescriptions", "Make a sick plan: know your go-to remedies and where to buy them", "Talk to a professional and make a plan for the hard days", "Check the medicine rules for your country", "Tell your bank you're traveling; get a card with no foreign fees", "Sort your phone plan or eSIM", "Get plug adapters for every country you'll visit", "Give family copies of your passport, insurance and housing address", "Set rough call times with family", "Write down your 2–3 goals for the semester", "Start a little Duolingo", "Apply to scholarships or build a cushion with a side gig"] },
    { name: "First weeks there", items: ["Keep the first weekends free for any required appointments (like biometrics)", "Register locally if your country requires it", "Find the nearest pharmacy and clinic", "Save the local emergency number in your phone", "Get a transit card or pass", "Go to program events: find your people", "Pick how you'll keep keepsakes (photos, posts, a journal)"] }
  ] },
  pack: { label: "Packing", groups: [
    { name: "Documents", items: ["Passport, plus a copy of the photo page", "Visa or residence permit papers, if needed", "Printed flight itinerary and housing address", "Student ID and health insurance card"] },
    { name: "Clothes", items: ["Layers you can mix and match", "Warm coat, if it'll be cold", "Rain jacket", "Comfortable shoes for lots of walking", "Something nicer for an internship or dinner out"] },
    { name: "Tech", items: ["Laptop and charger", "Phone and charger", "Plug adapters", "Small power strip", "Portable battery", "Headphones"] },
    { name: "Health", items: ["Prescription medicine in original packaging, in your carry-on", "Your go-to cold and allergy basics", "Your comfort remedy (tea and honey?)", "Glasses or contacts, plus spares"] },
    { name: "Extras", items: ["Backpack for day trips", "Small duffel for weekend trips", "Water bottle", "Umbrella", "Padlock for hostel lockers", "Something small from home"] }
  ] },
  weekend: { label: "Weekend bag", groups: [
    { name: "For a 2–3 night trip", items: ["Passport or ID", "Residence permit card, if you have one", "Phone, charger and plug adapter", "Portable battery", "Padlock for the hostel locker", "Layers and a rain jacket", "Comfortable shoes", "Medicine", "Water bottle", "Toothbrush and travel-size toiletries"] }
  ] }
};
function prepState() { var p = S.profile.prep || {}; ["checks", "gone", "added"].forEach(function (k) { if (!p[k] || typeof p[k] !== "object") p[k] = {}; }); S.profile.prep = p; return p; }
function prepItems(k) { var p = prepState(), out = []; PREP[k].groups.forEach(function (g, gi) { g.items.forEach(function (x, ii) { var id = k + ":" + gi + ":" + ii; if (!p.gone[id]) out.push(id); }); }); (p.added[k] || []).forEach(function (x) { out.push(x.id); }); return out; }
function prepLeft(k) { var p = prepState(); return prepItems(k).filter(function (id) { return !p.checks[id]; }).length; }
function viewPrep() {
  var p = prepState(), k = PREP[S.prepTab] ? S.prepTab : "todo";
  var all = prepItems(k), done = all.length - prepLeft(k);
  var row = function (id, text, custom) { var on = !!p.checks[id];
    return '<label class="check' + (on ? " done" : "") + '"><input type="checkbox" data-change="prepCheck" data-id="' + esc(id) + '"' + (on ? " checked" : "") + '><span style="flex:1">' + esc(text) + '</span><button type="button" class="btn ghost tiny" data-act="prepRm" data-id="' + esc(id) + '" aria-label="Remove ' + esc(text) + '">' + (custom ? "Delete" : "Skip") + "</button></label>"; };
  var groups = PREP[k].groups.map(function (g, gi) {
    var rows = g.items.map(function (x, ii) { var id = k + ":" + gi + ":" + ii; return p.gone[id] ? "" : row(id, x, false); }).join("");
    return rows ? '<div class="card"><h3 style="font-size:19px;margin-bottom:4px">' + esc(g.name) + "</h3>" + rows + "</div>" : "";
  }).join("");
  var mine = p.added[k] || [];
  if (mine.length) groups += '<div class="card"><h3 style="font-size:19px;margin-bottom:4px">Your own</h3>' + mine.map(function (x) { return row(x.id, x.text, true); }).join("") + "</div>";
  return '<div class="page-head"><div><div class="eyebrow">Prep</div><h1>Get ready.</h1><p class="muted" style="margin:6px 0 0">Check things off as you go. Add your own and skip what you don\'t need. <a href="/before-you-go">Read the tips ↗</a></p></div></div>' +
    '<div class="seg" role="group" aria-label="Lists" style="margin-bottom:14px">' + Object.keys(PREP).map(function (x) { var n = prepLeft(x); return '<button type="button" data-act="prepTab" data-k="' + x + '" aria-pressed="' + (x === k) + '">' + PREP[x].label + (n ? " · " + n : " ✓") + "</button>"; }).join("") + "</div>" +
    '<div class="card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between"><b>' + done + " of " + all.length + ' done</b><button class="btn ghost tiny" data-act="prepReset" type="button">Reset this list</button></div><div class="progress"><i style="width:' + (all.length ? Math.round(done / all.length * 100) : 0) + '%"></i></div>' +
    '<form data-form="prepAdd" class="row" style="margin-top:12px"><label class="sr" for="prepNew">Add your own</label><input id="prepNew" type="text" maxlength="80" placeholder="Add your own" required><button class="btn small" type="submit">Add</button></form></div>' +
    '<div class="prep-cols">' + groups + "</div>";
}
var prepTimer = null;
function savePrep() {
  lsSet("linger.profile." + uid(), S.profile);
  clearTimeout(prepTimer);
  prepTimer = setTimeout(async function () { try { must(await sb.from("profiles").update({ prep: S.profile.prep }).eq("id", uid())); } catch (e) { toast(errMsg(e)); } }, 600);
}

/* ---------- Profile ---------- */
function viewProfile() {
  var p = S.profile;
  return '<div class="page-head"><div><div class="eyebrow">Profile</div><h1>You</h1></div></div>' +
    '<div class="cols"><form class="card block" data-form="profile"><div class="row" style="gap:14px;margin-bottom:16px">' + av(uid(), 56) + '<div><div style="font-weight:600;font-size:18px">' + esc(p.name) + '</div><div class="muted small">' + esc(S.session.user.email || "") + "</div></div></div>" +
    '<div class="field"><label class="f" for="pName">Your name</label><input id="pName" type="text" maxlength="40" required value="' + esc(p.name) + '"></div>' +
    '<div class="field"><label class="f" for="pBase">Where you\'re studying</label><input id="pBase" type="text" maxlength="60" value="' + esc(p.home_base || "") + '"></div>' +
    '<div class="field"><label class="f" for="pTz">Your time zone</label><select id="pTz">' + zoneOptions(p.tz) + '</select><div class="muted small" style="margin-top:4px">It\'s ' + esc(timeIn(p.tz, new Date())) + ' for you right now. Home uses this for good call times.</div></div>' +
    '<div class="field"><label class="f" for="pCur">Home currency</label><select id="pCur">' + curOptions(p.currency || "USD") + "</select></div>" +
    '<button class="btn" type="submit">Save</button></form>' +
    '<div class="card block"><h2>Help</h2><p class="muted">New here? The how-it-works page walks through your first trip.</p><div class="wrap-row"><a class="btn ghost small" href="/how-it-works">How it works ↗</a><a class="btn ghost small" href="/">linger website ↗</a></div>' +
    '<h2 style="margin-top:20px">Install on your phone</h2><p class="muted">In your phone\'s browser, open the share or menu button and choose <b>Add to Home Screen</b>. Trips you\'ve opened stay readable offline.</p>' +
    '<button class="btn ghost" data-act="signOut" type="button" style="margin-top:8px">Sign out</button></div></div>';
}

/* ================= modals ================= */
var modal = document.getElementById("modal");
function openModal(html, onSubmit, onAct) {
  modal.innerHTML = '<form class="m" method="dialog">' + html + "</form>";
  var f = modal.querySelector("form");
  f.addEventListener("submit", async function (e) { e.preventDefault(); var b = f.querySelector('[type="submit"]'); if (b) b.disabled = true; var ok = await onSubmit(f); if (b) b.disabled = false; if (ok !== false) closeModal(); });
  f.addEventListener("click", async function (e) {
    var b = e.target.closest("[data-m]"); if (!b) return; e.preventDefault();
    if (b.dataset.m === "close") return closeModal();
    if (onAct) { var r = await onAct(b.dataset.m, b); if (r !== false) closeModal(); }
  });
  if (modal.showModal) modal.showModal(); else modal.setAttribute("open", "");
  var first = f.querySelector("input,select,textarea"); if (first) first.focus();
}
function closeModal() { if (modal.close) modal.close(); else modal.removeAttribute("open"); modal.innerHTML = ""; }
function val(f, id) { var el = f.querySelector("#" + id); return el ? el.value.trim() : ""; }

function modalTrip(t) {
  var editing = !!t; t = t || { name: "", place: "", cover: Math.floor(Math.random() * COVERS.length) };
  openModal('<h2>' + (editing ? "Trip settings" : "New trip") + "</h2>" +
    '<div class="field"><label class="f" for="mtName">Trip name</label><input id="mtName" type="text" maxlength="60" required placeholder="e.g. Prague weekend" value="' + esc(t.name) + '"></div>' +
    '<div class="field"><label class="f" for="mtPlace">Where</label><input id="mtPlace" type="text" maxlength="60" placeholder="e.g. Prague" value="' + esc(t.place) + '"></div>' +
    '<fieldset class="field" style="border:0;padding:0"><legend class="f" style="font-weight:600;font-size:13px;margin-bottom:6px">Folder color</legend><div class="covers">' + COVERS.map(function (c, i) { return '<label style="background:' + c + '"><input type="radio" name="cover" value="' + i + '"' + (i === t.cover % COVERS.length ? " checked" : "") + '><span></span><span class="sr">Color ' + (i + 1) + "</span></label>"; }).join("") + "</div></fieldset>" +
    '<div class="m-actions"><div class="wrap-row">' + (editing ? (isCreator() ? '<button class="btn danger small" data-m="delete" type="button">Delete trip</button>' : '<button class="btn danger small" data-m="leave" type="button">Leave trip</button>') : "") + '</div><div class="wrap-row"><button class="btn ghost" data-m="close" type="button">Cancel</button><button class="btn" type="submit">' + (editing ? "Save" : "Create trip") + "</button></div></div>",
  async function (f) {
    var name = val(f, "mtName"), place = val(f, "mtPlace"), cv = +((f.querySelector('input[name="cover"]:checked') || {}).value || 0);
    if (!name) return false;
    try {
      if (editing) { await act(async function () { must(await sb.from("trips").update({ name: name, place: place, cover: cv }).eq("id", t.id)); }); S.trips = null; }
      else { var id = must(await sb.rpc("create_trip", { p_name: name, p_place: place, p_cover: cv })); S.trips = null; go("#/trip/" + id + "/plan"); setTimeout(function () { toast("Trip made. Tap Invite to bring your crew."); }, 400); }
    } catch (e) { toast(errMsg(e)); return false; }
  },
  async function (m) {
    if (m === "delete") { if (!confirm("Delete " + t.name + " for everyone? This can't be undone.")) return false; try { must(await sb.from("trips").delete().eq("id", t.id)); ping(); lsDel("linger.trip." + t.id); S.trips = null; S.t = null; S.tripId = null; go("#/trips"); toast("Trip deleted"); } catch (e) { toast(errMsg(e)); return false; } }
    if (m === "leave") { if (!confirm("Leave " + t.name + "? You'll need a new invite to come back.")) return false; try { must(await sb.from("trip_members").delete().eq("trip_id", t.id).eq("user_id", uid())); ping(); lsDel("linger.trip." + t.id); S.trips = null; S.t = null; S.tripId = null; go("#/trips"); toast("You left the trip"); } catch (e) { toast(errMsg(e)); return false; } }
  });
}
function modalSpot(sp) {
  openModal("<h2>Edit spot</h2>" +
    '<div class="field"><label class="f" for="msName">Name</label><input id="msName" type="text" maxlength="80" required value="' + esc(sp.name) + '"></div>' +
    '<div class="row"><div class="field" style="flex:1"><label class="f" for="msHours">When it\'s open</label><input id="msHours" type="text" maxlength="80" placeholder="e.g. 10–18, closed Mon" value="' + esc(sp.hours) + '"></div><div class="field" style="flex:1"><label class="f" for="msCost">Cost</label><input id="msCost" type="text" maxlength="40" placeholder="e.g. Free, €6 student" value="' + esc(sp.cost) + '"></div></div>' +
    '<div class="field"><label class="f" for="msWeb">Website</label><input id="msWeb" type="text" placeholder="https://" value="' + esc(sp.website) + '"></div>' +
    '<div class="field"><label class="f" for="msMaps">Google Maps link (optional)</label><input id="msMaps" type="text" placeholder="Leave blank to search by name" value="' + esc(sp.maps) + '"></div>' +
    '<div class="field"><label class="f" for="msNote">Note</label><input id="msNote" type="text" maxlength="140" placeholder="e.g. Rain plan: go to the museum instead" value="' + esc(sp.note) + '"></div>' +
    '<div class="m-actions"><button class="btn danger small" data-m="delete" type="button">Delete spot</button><div class="wrap-row"><button class="btn ghost" data-m="close" type="button">Cancel</button><button class="btn" type="submit">Save</button></div></div>',
  function (f) {
    var row = { name: val(f, "msName"), hours: val(f, "msHours"), cost: val(f, "msCost"), website: safeUrl(val(f, "msWeb")), maps: safeUrl(val(f, "msMaps")), note: val(f, "msNote") };
    if (!row.name) return false;
    return act(async function () { must(await sb.from("spots").update(row).eq("id", sp.id)); });
  },
  async function (m) { if (m === "delete") { if (!confirm("Delete " + sp.name + "?")) return false; return act(async function () { must(await sb.from("spots").delete().eq("id", sp.id)); }, "Spot deleted"); } });
}
function modalLink(l) {
  openModal("<h2>Edit link</h2>" + linkFields(l, "ml") +
    '<div class="m-actions"><button class="btn danger small" data-m="delete" type="button">Delete</button><div class="wrap-row"><button class="btn ghost" data-m="close" type="button">Cancel</button><button class="btn" type="submit">Save</button></div></div>',
  function (f) {
    var row = linkRow(f, "ml"); if (!row.name) return false;
    return act(async function () { must(await sb.from("links").update(row).eq("id", l.id)); });
  },
  async function (m) { if (m === "delete") { if (!confirm("Delete " + l.name + "?")) return false; return act(async function () { must(await sb.from("links").delete().eq("id", l.id)); }, "Link deleted"); } });
}
function linkRow(f, p) {
  var price = val(f, p + "Price");
  return { kind: val(f, p + "Kind"), name: val(f, p + "Name"), url: safeUrl(val(f, p + "Url")), details: val(f, p + "Det"), price: price === "" ? null : Number(price), currency: val(f, p + "Cur") || "EUR" };
}
function modalJoin() {
  openModal('<h2>Join a trip</h2><p class="muted">Paste the invite link a friend sent you.</p><div class="field"><label class="f" for="mjCode">Invite link or code</label><input id="mjCode" type="text" required placeholder="https://…/app#/join/…"></div><div class="m-actions"><span></span><div class="wrap-row"><button class="btn ghost" data-m="close" type="button">Cancel</button><button class="btn" type="submit">Join</button></div></div>',
  function (f) {
    var v = val(f, "mjCode"), m = v.match(/join\/([a-z0-9]+)/i), code = m ? m[1] : v.replace(/[^a-z0-9]/gi, "");
    if (!code) return false;
    lsSet("linger.pendingJoin", code); doPendingJoin();
  });
}

/* ================= events ================= */
app.addEventListener("click", async function (e) {
  var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
  var a = b.dataset.act, id = b.dataset.id, D = S.t, me_ = me();
  switch (a) {
    case "newTrip": return modalTrip(null);
    case "joinCode": return modalJoin();
    case "tripSettings": return modalTrip(D.trip);
    case "invite": return copy(inviteUrl(D.trip), "Invite link copied. Paste it in the group chat.");
    case "resend": return sendLink(S.sent);
    case "authReset": S.sent = null; return render();
    case "signOut": unsubscribeTrip(); await sb.auth.signOut(); return;
    case "vote": {
      var has = votesFor(id).indexOf(me_) >= 0;
      return act(async function () { if (has) must(await sb.from("votes").delete().eq("spot_id", id).eq("user_id", me_)); else must(await sb.from("votes").insert({ spot_id: id, user_id: me_, trip_id: D.trip.id })); });
    }
    case "move": {
      var list = listSpots(), i = list.findIndex(function (s) { return s.id === id; }), j = i + Number(b.dataset.dir);
      if (i < 0 || j < 0 || j >= list.length) return;
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      return act(async function () { await Promise.all(list.map(function (s, k) { return s.position === k ? null : sb.from("spots").update({ position: k }).eq("id", s.id).then(must); })); });
    }
    case "lockSpot": { var sp = D.spots.find(function (s) { return s.id === id; }); return act(async function () { must(await sb.from("spots").update({ locked: !sp.locked }).eq("id", id)); }); }
    case "editSpot": return modalSpot(D.spots.find(function (s) { return s.id === id; }));
    case "board": S.inspoBoard = b.dataset.b; return render();
    case "pinToPlan": {
      var p = D.inspo.find(function (x) { return x.id === id; });
      var nm = (p.title || host(p.url) || "New spot").slice(0, 80);
      return act(async function () { must(await sb.from("spots").insert({ trip_id: D.trip.id, name: nm, website: safeUrl(p.url) })); }, nm + " added to Plan");
    }
    case "delPin": {
      var pin = D.inspo.find(function (x) { return x.id === id; });
      return act(async function () { must(await sb.from("inspo").delete().eq("id", id)); if (pin.image_path) { try { await sb.storage.from("inspo").remove([pin.image_path]); } catch (e2) {} } });
    }
    case "book": {
      var l = D.links.find(function (x) { return x.id === id; });
      return act(async function () { must(await sb.from("links").update({ booked_by: l.booked_by === me_ ? null : me_ }).eq("id", id)); });
    }
    case "editLink": return modalLink(D.links.find(function (x) { return x.id === id; }));
    case "avail": {
      var cur = availOf(id, me_), next = { "": "yes", yes: "maybe", maybe: "no", no: "" }[cur];
      return act(async function () {
        if (next) must(await sb.from("availability").upsert({ option_id: id, user_id: me_, trip_id: D.trip.id, status: next }, { onConflict: "option_id,user_id" }));
        else must(await sb.from("availability").delete().eq("option_id", id).eq("user_id", me_));
      });
    }
    case "lock": return act(async function () { must(await sb.from("trips").update({ locked_option: id || null }).eq("id", D.trip.id)); S.trips = null; }, id ? "Locked in. Send the invite!" : "Unlocked");
    case "delOpt": if (!confirm("Remove these dates?")) return; return act(async function () { must(await sb.from("date_options").delete().eq("id", id)); });
    case "rsvp": return act(async function () { must(await sb.from("rsvps").upsert({ trip_id: D.trip.id, user_id: me_, status: b.dataset.s }, { onConflict: "trip_id,user_id" })); });
    case "copyInvite": { var o = lockedOpt(); return copy("You're invited: " + D.trip.name + (D.trip.place ? " in " + D.trip.place : "") + ", " + rangeLabel(o.start_date, o.end_date) + ". RSVP in Linger: " + inviteUrl(D.trip), "Invite copied"); }
    case "delCost": if (!confirm("Delete this cost?")) return; return act(async function () { must(await sb.from("costs").delete().eq("id", id)); });
    case "delContact": try { must(await sb.from("contacts").delete().eq("id", id)); S.contacts = S.contacts.filter(function (c) { return c.id !== id; }); render(); } catch (e3) { toast(errMsg(e3)); } return;
    case "mapPick": { var r = ML.results[+b.dataset.i]; ML.sel = r; ML.focus = null; render(); if (ML.map) ML.map.flyTo({ center: [r.lng, r.lat], zoom: /City|Town|Village/.test(r.kind) ? 12 : 15 }); return; }
    case "mapClear": ML.sel = null; return render();
    case "mapFocus": {
      ML.focus = id; render();
      var sp0 = ML.data.spots.find(function (s) { return s.id === id; });
      if (sp0 && hasLL(sp0) && ML.map) ML.map.flyTo({ center: [sp0.lng, sp0.lat], zoom: 15 });
      else if (sp0) toast("Not on the map yet. Tap Put spots on the map.");
      return;
    }
    case "mapPlace": {
      var tp = tripById(ML.planTrip), o2 = mapOrder(ML.planTrip), miss = o2.list.concat(o2.other).filter(function (s) { return !hasLL(s); }), placed = 0;
      b.disabled = true; toast("Finding " + miss.length + " on the map…");
      var bias = null; try { if (tp && tp.place) { var g = await geocode(tp.place, null, 1); if (g[0]) bias = g[0]; } } catch (e4) {}
      for (var mi = 0; mi < miss.length; mi++) {
        try {
          var hit = (await geocode(miss[mi].name + (tp && tp.place ? " " + tp.place : ""), bias, 1))[0];
          if (hit && (!bias || km(hit, bias) < 80)) { must(await sb.from("spots").update({ lat: hit.lat, lng: hit.lng, address: hit.address || "" }).eq("id", miss[mi].id)); placed++; }
        } catch (e5) {}
        await new Promise(function (r) { setTimeout(r, 350); });
      }
      toast(placed === miss.length ? "All on the map" : "Placed " + placed + " of " + miss.length + ". Search for the rest and save them.");
      await mapAfterChange(ML.planTrip); fitMap(); return;
    }
    case "prepTab": S.prepTab = b.dataset.k; return render();
    case "prepRm": { e.preventDefault(); var ps = prepState(), k = S.prepTab; if (id.indexOf("u") === 0) ps.added[k] = (ps.added[k] || []).filter(function (x) { return x.id !== id; }); else ps.gone[id] = 1; delete ps.checks[id]; savePrep(); return render(); }
    case "prepReset": {
      if (!confirm("Reset this list? Checks clear and skipped items come back.")) return;
      var pr = prepState(), kk = S.prepTab;
      Object.keys(pr.checks).forEach(function (x) { if (x.indexOf(kk + ":") === 0) delete pr.checks[x]; });
      (pr.added[kk] || []).forEach(function (x) { delete pr.checks[x.id]; });
      Object.keys(pr.gone).forEach(function (x) { if (x.indexOf(kk + ":") === 0) delete pr.gone[x]; });
      pr.added[kk] = []; savePrep(); return render();
    }
  }
});

app.addEventListener("change", async function (e) {
  var el = e.target, c = el.dataset.change; if (!c) return;
  if (c === "mapTrip") { ML.planTrip = el.value || null; ML.focus = null; ML.sel = null; render(); fitMap(); return; }
  if (c === "prepCheck") { var p = prepState(); if (el.checked) p.checks[el.dataset.id] = 1; else delete p.checks[el.dataset.id]; savePrep(); return render(); }
  if (c === "upload") {
    var file = el.files && el.files[0]; el.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast("Pick an image file.");
    if (file.size > 6 * 1024 * 1024) return toast("That image is over 6 MB. Try a screenshot instead.");
    var D = S.t, ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    var path = D.trip.id + "/" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)) + "." + ext;
    toast("Uploading…");
    var title = (document.getElementById("pinTitle") || {}).value || "";
    return act(async function () {
      must(await sb.storage.from("inspo").upload(path, file, { contentType: file.type, upsert: false }));
      must(await sb.from("inspo").insert({ trip_id: D.trip.id, board: S.inspoBoard, image_path: path, title: title.trim().slice(0, 80) }));
      var tEl = document.getElementById("pinTitle"); if (tEl) tEl.value = "";
    }, "Pinned");
  }
});

app.addEventListener("submit", async function (e) {
  var f = e.target, k = f.dataset.form; if (!k) return;
  e.preventDefault();
  var D = S.t, me_ = me();
  var clear = function () { f.querySelectorAll("input:not([type=checkbox]):not([type=radio]),textarea").forEach(function (x) { x.value = ""; }); };
  var btn = f.querySelector('[type="submit"]'); if (btn) btn.disabled = true;
  try {
    switch (k) {
      case "auth": await sendLink(val(f, "email")); break;
      case "code": {
        var code = val(f, "otp").replace(/\s/g, "");
        if (!code) break;
        try { must(await sb.auth.verifyOtp({ email: S.sent, token: code, type: "email" })); }
        catch (err) { toast(/expired|invalid/i.test(err.message || "") ? "That code didn't work. Check it, or send a new one." : errMsg(err)); }
        break;
      }
      case "setup": {
        var row = { id: uid(), name: val(f, "sName"), home_base: val(f, "sBase"), tz: val(f, "sTz") };
        if (!row.name) break;
        S.profile = Object.assign({}, S.profile, must(await sb.from("profiles").upsert(row).select().single()));
        S.people[uid()] = S.profile; lsSet("linger.profile." + uid(), S.profile);
        if (lsGet("linger.pendingJoin")) await doPendingJoin(); else { location.hash = "#/trips"; await route(); }
        break;
      }
      case "profile": {
        var up = { name: val(f, "pName"), home_base: val(f, "pBase"), tz: val(f, "pTz"), currency: val(f, "pCur") };
        if (!up.name) break;
        S.profile = Object.assign({}, S.profile, must(await sb.from("profiles").update(up).eq("id", uid()).select().single()));
        S.people[uid()] = S.profile; lsSet("linger.profile." + uid(), S.profile); render(); toast("Saved");
        break;
      }
      case "addSpot": { var nm = val(f, "newSpot"); if (!nm) break; clear(); await act(async function () { must(await sb.from("spots").insert({ trip_id: D.trip.id, name: nm.slice(0, 80) })); }); break; }
      case "addPin": {
        var u = safeUrl(val(f, "pinUrl")), ti = val(f, "pinTitle");
        if (!u) { toast("Paste a link, or upload a photo."); break; }
        clear();
        await act(async function () { must(await sb.from("inspo").insert({ trip_id: D.trip.id, board: S.inspoBoard, url: u, title: ti.slice(0, 80) })); }, "Pinned");
        break;
      }
      case "addLink": { var lr = linkRow(f, "nl"); if (!lr.name) break; lr.trip_id = D.trip.id; clear(); await act(async function () { must(await sb.from("links").insert(lr)); }, "Saved"); break; }
      case "addOpt": {
        var a = val(f, "optStart"), b = val(f, "optEnd") || a;
        if (!a) break;
        if (b < a) { var x = a; a = b; b = x; }
        clear(); await act(async function () { must(await sb.from("date_options").insert({ trip_id: D.trip.id, start_date: a, end_date: b })); });
        break;
      }
      case "addCost": {
        var amt = Number(val(f, "cAmt")), what = val(f, "cWhat"), split = Array.prototype.map.call(f.querySelectorAll('input[name="split"]:checked'), function (x) { return x.value; });
        if (!what || !(amt > 0)) { toast("Add what it was and an amount above 0."); break; }
        if (!split.length) { toast("Pick at least one person to split with."); break; }
        var cur = val(f, "cCur"); lsSet("linger.lastCur", cur);
        var cr = { trip_id: D.trip.id, what: what, amount: Math.round(amt * 100) / 100, currency: cur, paid_by: val(f, "cPaid") || me_, split_between: split.length === D.members.length ? [] : split };
        f.querySelector("#cWhat").value = ""; f.querySelector("#cAmt").value = "";
        await act(async function () { must(await sb.from("costs").insert(cr)); }, "Added");
        break;
      }
      case "addContact": {
        var cn = val(f, "hName"), tz = val(f, "hTz"), ph = val(f, "hPhone");
        if (!cn) break; lsSet("linger.lastTz", tz);
        var c = must(await sb.from("contacts").insert({ name: cn, tz: tz, phone: ph }).select().single());
        S.contacts = (S.contacts || []).concat([c]); clear(); render();
        break;
      }
      case "mapSearch": {
        var q = val(f, "mapQ"); if (!q) break;
        var c0 = ML.map ? ML.map.getCenter() : null;
        ML.results = await geocode(q, c0 && ML.map.getZoom() > 4 ? { lat: c0.lat, lng: c0.lng } : null, 7);
        render(); break;
      }
      case "mapSave": {
        var tid = val(f, "mapSaveTrip"), se = ML.sel; if (!tid || !se) break;
        must(await sb.from("spots").insert({ trip_id: tid, name: se.name.slice(0, 80), lat: se.lat, lng: se.lng, address: se.address || "" }));
        ML.sel = null; ML.results = null; ML.planTrip = tid;
        var mq = document.getElementById("mapQ"); if (mq) mq.value = "";
        toast(se.name + " saved to " + (tripById(tid) || {}).name + ". It's in the Vote list.");
        await mapAfterChange(tid); break;
      }
      case "prepAdd": { var t = val(f, "prepNew"); if (!t) break; var ps = prepState(); (ps.added[S.prepTab] = ps.added[S.prepTab] || []).push({ id: "u" + Date.now().toString(36), text: t.slice(0, 80) }); clear(); savePrep(); render(); break; }
    }
  } catch (err) { toast(errMsg(err)); }
  if (btn && document.body.contains(btn)) btn.disabled = false;
});

async function sendLink(email) {
  if (!email) return;
  try {
    must(await sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + "/app", shouldCreateUser: true } }));
    S.sent = email; render();
  } catch (e) {
    var m = e.message || "";
    toast(/rate|seconds|too many/i.test(m) ? "Too many emails just now. Wait a minute and try again." : errMsg(e));
  }
}

/* ================= boot ================= */
window.addEventListener("hashchange", route);
window.addEventListener("online", function () { S.offline = false; if (S.view === "trip" && S.tripId) scheduleReload(); else render(); });
window.addEventListener("offline", function () { S.offline = true; render(); });
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && S.view === "trip" && S.tripId) scheduleReload(); });

(async function boot() {
  if (!sb) { S.view = "noconfig"; return render(); }
  sb.auth.onAuthStateChange(function (ev, session) {
    var was = !!S.session; S.session = session;
    if (session && !was) { setTimeout(afterLogin, 0); }
    if (!session && was) { S.profile = null; S.trips = null; S.t = null; S.tripId = null; S.contacts = null; S.sent = null; S._afterLogin = null; S.people = {}; location.hash = "#/login"; route(); }
  });
  var res = await sb.auth.getSession();
  S.session = res.data.session;
  if (S.session) await afterLogin(); else route();
})();

if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/app/sw.js", { scope: "/app" }).catch(function () {}); }); }
})();
