'use strict';

var CONFIG_URL    = 'config.json';
var RSS2JSON_API  = 'https://api.rss2json.com/v1/api.json?rss_url=';
var OPENMETEO_API = 'https://api.open-meteo.com/v1/forecast';

var config          = null;
var rssItems        = [];
var currentRssIndex = 0;
var rssInterval     = null;

// ── INIT ─────────────────────────────────────────────────────────
async function init() {
    try {
        config = await loadConfig();
        setupBackground();
        setupYoutube();
        setupClock();
        setupWeather();
        setupRSS();
        setupAutoRefresh();
    } catch (err) {
        console.error('Init failed:', err);
    }
}

// ── CONFIG ───────────────────────────────────────────────────────
async function loadConfig() {
    var r = await fetch(CONFIG_URL + '?t=' + Date.now());
    if (!r.ok) throw new Error('Failed to load config.json');
    return r.json();
}

// ── BACKGROUND ───────────────────────────────────────────────────
function setupBackground() {
    document.getElementById('bg-img').src        = config.building.background || 'assets/video.gif';
    document.getElementById('building-logo').src = config.building.logo        || 'assets/logo.svg';
}

// ── YOUTUBE ──────────────────────────────────────────────────────
function setupYoutube() {
    var yt = document.getElementById('yt-player');
    if (!yt) return;
    var playlist = config.youtube && config.youtube.playlist;
    if (playlist) {
        var match = playlist.match(/list=([A-Za-z0-9_-]+)/);
        if (match) {
            var listId = match[1];
            yt.src = 'https://www.youtube.com/embed/videoseries?list=' + listId +
                     '&autoplay=1&mute=1&controls=0&loop=1&modestbranding=1' +
                     '&rel=0&iv_load_policy=3&disablekb=1&playsinline=1';
        }
    }
}

// ── CLOCK ────────────────────────────────────────────────────────
function setupClock() { updateClock(); setInterval(updateClock, 1000); }

function updateClock() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    var s = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('clock-time').textContent = h+':'+m+':'+s;
    document.getElementById('clock-date').textContent =
        now.toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'});
    var w = document.getElementById('clock-widget');
    w.classList.remove('clock-pulse');
    void w.offsetWidth;
    w.classList.add('clock-pulse');
}

// ── WEATHER ──────────────────────────────────────────────────────
async function setupWeather() {
    document.getElementById('weather-city').textContent = config.location.city;
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    document.getElementById('weather-day').textContent = days[new Date().getDay()];
    await fetchWeather();
    setInterval(fetchWeather, (config.weather.refreshMinutes || 30) * 60000);
}

async function fetchWeather() {
    try {
        var url = OPENMETEO_API
            + '?latitude='  + config.location.lat
            + '&longitude=' + config.location.lon
            + '&current=temperature_2m,weather_code'
            + '&daily=weather_code,temperature_2m_max,temperature_2m_min'
            + '&timezone=auto&forecast_days=5';
        var data = await (await fetch(url)).json();
        var temp = Math.round(data.current.temperature_2m);
        var code = data.current.weather_code;
        document.getElementById('weather-temp').textContent = temp + '°C';
        document.getElementById('weather-desc').textContent = getWeatherDesc(code);
        document.getElementById('weather-high').textContent = Math.round(data.daily.temperature_2m_max[0]);
        document.getElementById('weather-low').textContent  = Math.round(data.daily.temperature_2m_min[0]);
        document.getElementById('weather-main-icon').innerHTML = weatherSVG(code, 88);
        renderForecast(data.daily);
    } catch(e) { console.error('Weather error:', e); }
}

function renderForecast(daily) {
    var c = document.getElementById('weather-forecast');
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    c.innerHTML = '';
    var n = config.weather.forecastDays || 4;
    for (var i = 1; i <= n && i < daily.time.length; i++) {
        var d    = new Date(daily.time[i]);
        var high = Math.round(daily.temperature_2m_max[i]);
        var low  = Math.round(daily.temperature_2m_min[i]);
        var el   = document.createElement('div');
        el.className = 'forecast-day';
        el.innerHTML =
            '<div class="fc-name">'  + days[d.getDay()] + '</div>' +
            '<div class="fc-icon">'  + weatherSVG(daily.weather_code[i], 30) + '</div>' +
            '<div class="fc-temps">' + high + '° ' + low + '°</div>';
        c.appendChild(el);
    }
}

function weatherSVG(code, size) {
    var s = size || 40;
    var w = 'stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var tag = '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" '+w+'>';
    if (code <= 1) return tag +
        '<circle cx="12" cy="12" r="4.5"/>' +
        '<line x1="12" y1="2"    x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/>' +
        '<line x1="2"  y1="12"   x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/>' +
        '<line x1="4.93" y1="4.93" x2="6.7" y2="6.7"/><line x1="17.3" y1="17.3" x2="19.07" y2="19.07"/>' +
        '<line x1="19.07" y1="4.93" x2="17.3" y2="6.7"/><line x1="6.7" y1="17.3" x2="4.93" y2="19.07"/>' +
        '</svg>';
    if (code === 2) return tag +
        '<circle cx="9.5" cy="9" r="3"/>' +
        '<line x1="9.5" y1="3" x2="9.5" y2="4.5"/><line x1="9.5" y1="13.5" x2="9.5" y2="15"/>' +
        '<line x1="3.5" y1="9" x2="5" y2="9"/><line x1="14" y1="9" x2="15.5" y2="9"/>' +
        '<path d="M7 18h8a3.5 3.5 0 0 0 0-7h-1.5a4.5 4.5 0 0 0-8.5 1.5"/>' +
        '</svg>';
    if (code === 3) return tag +
        '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>' +
        '</svg>';
    if ((code >= 61 && code <= 82) || (code >= 51 && code <= 57)) return tag +
        '<path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>' +
        '<line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="19" x2="12" y2="21"/><line x1="16" y1="19" x2="16" y2="21"/>' +
        '</svg>';
    if (code >= 71 && code <= 77) return tag +
        '<path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>' +
        '<circle cx="8" cy="20" r="1"/><circle cx="12" cy="20" r="1"/><circle cx="16" cy="20" r="1"/>' +
        '</svg>';
    return tag +
        '<circle cx="12" cy="12" r="4.5"/>' +
        '<line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/>' +
        '<line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/>' +
        '</svg>';
}

function getWeatherDesc(code) {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 61 && code <= 65) return 'Rain';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Showers';
    if (code >= 95) return 'Thunderstorm';
    return 'Clear';
}

// ── RSS ──────────────────────────────────────────────────────────
async function setupRSS() {
    await fetchRSS();
    setInterval(fetchRSS, 10 * 60 * 1000);
}

async function fetchRSS() {
    var rssUrl = config.rss && config.rss.url;
    if (!rssUrl) { useStaticMessages(); return; }
    try {
        var data = await (await fetch(RSS2JSON_API + encodeURIComponent(rssUrl))).json();
        if (data.status !== 'ok' || !data.items || !data.items.length) throw new Error('empty');
        var max = (config.rss && config.rss.maxItems) || 15;
        rssItems = data.items.slice(0, max).map(function(item) {
            var img = item.thumbnail ||
                (item.enclosure && item.enclosure.link && item.enclosure.type &&
                 /image/.test(item.enclosure.type) ? item.enclosure.link : '');
            return {
                title:       (item.title       || '').trim(),
                description: stripHtml(item.description || '').substring(0, 280).trim(),
                image:       img || '',
                pubDate:     item.pubDate || ''
            };
        }).filter(function(i) { return i.title; });
        startRssRotation();
    } catch(e) {
        console.error('RSS primary failed:', e);
        fetchRSSFallback(rssUrl);
    }
}

async function fetchRSSFallback(rssUrl) {
    try {
        var text = await (await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(rssUrl))).text();
        var xml  = new DOMParser().parseFromString(text, 'text/xml');
        var max  = (config.rss && config.rss.maxItems) || 15;
        rssItems = Array.from(xml.querySelectorAll('item')).slice(0, max).map(function(item) {
            var title = ((item.querySelector('title') || {}).textContent || '').trim();
            var desc  = stripHtml((item.querySelector('description') || {}).textContent || '').substring(0, 280).trim();
            var encl  = item.querySelector('enclosure');
            var img   = (encl && /image/.test(encl.getAttribute('type') || '')) ? (encl.getAttribute('url') || '') : '';
            if (!img) {
                var mc = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
                if (mc) img = mc.getAttribute('url') || '';
            }
            return { title: title, description: desc, image: img,
                     pubDate: ((item.querySelector('pubDate') || {}).textContent || '') };
        }).filter(function(i) { return i.title; });
        startRssRotation();
    } catch(e) {
        console.error('RSS fallback failed:', e);
        useStaticMessages();
    }
}

function startRssRotation() {
    if (!rssItems.length) { useStaticMessages(); return; }
    currentRssIndex = 0;
    showCurrentRssItem();
    if (rssInterval) clearInterval(rssInterval);
    var sec = (config.rss && config.rss.rotationSeconds) || 10;
    rssInterval = setInterval(function() {
        currentRssIndex = (currentRssIndex + 1) % rssItems.length;
        showCurrentRssItem();
    }, sec * 1000);
}

function showCurrentRssItem() {
    var item = rssItems[currentRssIndex];
    var next = rssItems[(currentRssIndex + 1) % rssItems.length];

    ['rss-headline','rss-description'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.opacity = '0';
    });

    setTimeout(function() {
        document.getElementById('rss-headline').textContent    = item.title;
        document.getElementById('rss-description').textContent = item.description || '';
        document.getElementById('rss-time-ago').textContent    = getTimeAgo(item.pubDate);

        // Thumbnails — only in the news bar (no featured image in main area)
        var t1 = document.getElementById('rss-thumb-1');
        var t2 = document.getElementById('rss-thumb-2');
        if (t1) { if (item.image) { t1.src = item.image; t1.classList.add('visible'); }
                  else             { t1.classList.remove('visible'); } }
        if (t2) { if (next && next.image) { t2.src = next.image; t2.classList.add('visible'); }
                  else                    { t2.classList.remove('visible'); } }

        ['rss-headline','rss-description'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.opacity = '1';
        });
    }, 250);
}

function getTimeAgo(pubDate) {
    if (!pubDate) return '';
    var pub = new Date(pubDate);
    if (isNaN(pub.getTime())) return '';
    var diffMin = Math.floor((Date.now() - pub.getTime()) / 60000);
    if (diffMin < 1)  return 'עכשיו';
    if (diffMin < 60) return 'לפני ' + diffMin + ' דקות';
    var h = Math.floor(diffMin / 60);
    if (h < 24)       return 'לפני ' + h + ' שעות';
    return 'לפני ' + Math.floor(h / 24) + ' ימים';
}

function stripHtml(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent || d.innerText || '';
}

function useStaticMessages() {
    var msgs = (config.messages || []).filter(function(m) { return m.active; });
    rssItems = msgs.length
        ? msgs.map(function(m) { return { title: m.text, description: '', image: '', pubDate: '' }; })
        : [{ title: config.building.name || 'Urban Tower', description: '', image: '', pubDate: '' }];
    startRssRotation();
}

// ── AUTO-REFRESH ─────────────────────────────────────────────────
function setupAutoRefresh() {
    setInterval(async function() {
        try {
            var nc = await loadConfig();
            if (nc.rss && nc.rss.url !== (config.rss && config.rss.url)) {
                config = nc; fetchRSS();
            } else if (nc.building && nc.building.background !== config.building.background) {
                config = nc; setupBackground();
            } else { config = nc; }
        } catch(e) { console.error('Auto-refresh failed:', e); }
    }, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
