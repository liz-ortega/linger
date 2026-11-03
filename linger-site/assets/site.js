/* Shared header, footer and helpers for the public Linger pages. */
(function(){
  "use strict";
  var PAGES = [
    ["/", "Home"],
    ["/before-you-go", "Before you go"],
    ["/packing", "What to pack"],
    ["/scholarships", "Scholarships"],
    ["/how-it-works", "The app"]
  ];
  var path = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  var head = document.getElementById("site-header");
  if (head) {
    head.className = "top";
    head.innerHTML =
      '<div class="wrap">' +
        '<a class="wordmark" href="/" aria-label="linger home">linge<span class="r">r</span></a>' +
        '<nav class="links" id="siteNav" aria-label="Main">' +
          PAGES.map(function(p){ return '<a href="' + p[0] + '"' + (p[0] === path ? ' aria-current="page"' : "") + ">" + p[1] + "</a>"; }).join("") +
        "</nav>" +
        '<div class="top-actions">' +
          '<a class="btn ghost small login" href="/app">Log in</a>' +
          '<a class="btn small login" href="/app#/signup">Try the app</a>' +
          '<button class="btn ghost small menu-btn" type="button" aria-expanded="false" aria-controls="siteNav">Menu</button>' +
        "</div>" +
      "</div>";
    var btn = head.querySelector(".menu-btn"), nav = head.querySelector("nav");
    btn.addEventListener("click", function(){
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Close" : "Menu";
    });
  }
  var foot = document.getElementById("site-footer");
  if (foot) {
    foot.innerHTML =
      '<div class="wrap">' +
        '<div><a class="wordmark" href="/" style="font-size:22px">linge<span class="r">r</span></a><div>Stay a while.</div></div>' +
        '<nav aria-label="Footer">' + PAGES.map(function(p){ return '<a href="' + p[0] + '">' + p[1] + "</a>"; }).join("") + '<a href="/app">Open the app</a></nav>' +
        '<div style="max-width:42ch">Linger began as Always Through (2021). Scholarship details change often; Linger isn\'t affiliated with any program listed.</div>' +
      "</div>";
  }

  window.Linger = {
    esc: function(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); },
    get: function(k, d){ try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
    set: function(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
    toast: function(msg){
      var t = document.getElementById("toast");
      if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
      t.textContent = msg; t.classList.add("on");
      clearTimeout(t._h); t._h = setTimeout(function(){ t.classList.remove("on"); }, 2200);
    }
  };
})();
