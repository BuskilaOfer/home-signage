/**
 * RPi Home Signage - Display App
 * - RSS feed from Ynet in ticker
 * - Clock with pulse animation on each second
 * - Weather with 4-day forecast (Open-Meteo, free, no key)
 * - Auto-refresh config every 5 minutes
 */

var CONFIG_URL = 'config.json';
// rss2json is a reliable free RSS-to-JSON converter
var RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url=';
// Open-Meteo: free weather API, no key needed, 7-day forecast
var OPENMETEO_API = 'https://api.open-meteo.com/v1/forecast';

var config = null;
var rssItems = [];
var currentRssIndex = 0;
var rssInterval = null;

// ============================================================
// INIT
// ============================================================
async function init() {
    try {
        config = await loadConfig();
        setupBackground();
        setupClock();
        setupWeather();
        setupRSS();
        setupAutoRefresh();
    } catch (err) {
        console.error('Failed to initialize:', err);
        document.getElementById('ticker-text').textContent = 'Error loading. Check console.';
    }
}

// ============================================================
// CONFIG
// ============================================================
async function loadConfig() {
    var cacheBust = '?t=' + Date.now();
    var response = await fetch(CONFIG_URL + cacheBust);
    if (!response.ok) throw new Error('Failed to load config.json');
    return response.json();
}

// ============================================================
// BACKGROUND
// ============================================================
function setupBackground() {
    var bg = document.getElementById('background');
    if (config.building.background) {
        bg.style.backgroundImage = 'url(' + config.building.background + ')';
    }
    var logo = document.getElementById('building-logo');
    if (config.building.logo) {
        logo.src = config.building.logo;
        logo.alt = config.building.name;
    }
}

// ============================================================
// CLOCK (with pulse/flash on every second tick)
// ============================================================
function setupClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    var now = new Date();

    // Time
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    var seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock-time').textContent = hours + ':' + minutes + ':' + seconds;

    // Date
    var options = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('clock-date').textContent = now.toLocaleDateString('en-GB', options);

    // Pulse animation on the clock widget background
    var clockWidget = document.getElementById('clock-widget');
    clockWidget.classList.remove('clock-pulse');
    void clockWidget.offsetWidth; // force reflow
    clockWidget.classList.add('clock-pulse');
}

// ============================================================
// WEATHER - Open-Meteo (free, no API key, 7-day forecast)
// ============================================================
async function setupWeather() {
    document.getElementById('weather-city').textContent = config.location.city;
    updateWeatherDay();

    await fetchWeather();
    setInterval(fetchWeather, (config.weather.refreshMinutes || 30) * 60 * 1000);
}

function updateWeatherDay() {
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    document.getElementById('weather-day').textContent = days[new Date().getDay()];
}

async function fetchWeather() {
    try {
        var lat = config.location.lat;
        var lon = config.location.lon;
        var url = OPENMETEO_API +
            '?latitude=' + lat +
            '&longitude=' + lon +
            '&current=temperature_2m,weather_code' +
            '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
            '&timezone=auto' +
            '&forecast_days=5';

        var response = await fetch(url);
        var data = await response.json();

        // Current weather
        var currentTemp = Math.round(data.current.temperature_2m);
        document.getElementById('weather-temp').textContent = currentTemp + '°C';

        var currentCode = data.current.weather_code;
        document.getElementById('weather-desc').textContent = getWeatherDescription(currentCode);

        // Today's high/low
        document.getElementById('weather-high').textContent = Math.round(data.daily.temperature_2m_max[0]);
        document.getElementById('weather-low').textContent = Math.round(data.daily.temperature_2m_min[0]);

        // Hide the img icon (we use text descriptions)
        var iconEl = document.getElementById('weather-icon');
        iconEl.style.display = 'none';

        // Render 4-day forecast (skip today, show next 4 days)
        renderForecast(data.daily);

    } catch (err) {
        console.error('Weather fetch failed:', err);
    }
}

function renderForecast(daily) {
    var container = document.getElementById('weather-forecast');
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var numDays = (config.weather.forecastDays || 4);

    container.textContent = '';

    // Start from index 1 (tomorrow) and show numDays
    for (var i = 1; i <= numDays && i < daily.time.length; i++) {
        var date = new Date(daily.time[i]);
        var dayName = dayNames[date.getDay()];
        var icon = getWeatherEmoji(daily.weather_code[i]);
        var high = Math.round(daily.temperature_2m_max[i]);
        var low = Math.round(daily.temperature_2m_min[i]);

        var dayEl = document.createElement('div');
        dayEl.className = 'forecast-day';

        var nameEl = document.createElement('div');
        nameEl.className = 'day-name';
        nameEl.textContent = dayName;

        var iconDivEl = document.createElement('div');
        iconDivEl.className = 'day-icon';
        iconDivEl.textContent = icon;

        var tempsEl = document.createElement('div');
        tempsEl.className = 'day-temps';
        tempsEl.textContent = high + '° ' + low + '°';

        dayEl.appendChild(nameEl);
        dayEl.appendChild(iconDivEl);
        dayEl.appendChild(tempsEl);
        container.appendChild(dayEl);
    }
}

function getWeatherEmoji(code) {
    // WMO Weather interpretation codes
    if (code === 0) return '☀️';
    if (code === 1) return '🌤️';
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌦️';
    if (code >= 56 && code <= 57) return '🌧️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 66 && code <= 67) return '🌨️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code >= 80 && code <= 82) return '🌧️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 95 && code <= 99) return '⛈️';
    return '☀️';
}

function getWeatherDescription(code) {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 56 && code <= 57) return 'Freezing drizzle';
    if (code >= 61 && code <= 65) return 'Rain';
    if (code >= 66 && code <= 67) return 'Freezing rain';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Rain showers';
    if (code >= 85 && code <= 86) return 'Snow showers';
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Clear';
}

// ============================================================
// RSS FEED (Ynet news ticker)
// ============================================================
async function setupRSS() {
    await fetchRSS();
    // Refresh RSS every 10 minutes
    setInterval(fetchRSS, 10 * 60 * 1000);
}

async function fetchRSS() {
    try {
        var rssUrl = config.rss && config.rss.url;
        if (!rssUrl) {
            setupStaticMessages();
            return;
        }

        var apiUrl = RSS2JSON_API + encodeURIComponent(rssUrl);
        var response = await fetch(apiUrl);
        var data = await response.json();

        if (data.status !== 'ok' || !data.items || data.items.length === 0) {
            console.warn('RSS returned no items, trying fallback proxy...');
            await fetchRSSFallback(rssUrl);
            return;
        }

        var maxItems = (config.rss && config.rss.maxItems) || 15;
        rssItems = [];

        for (var i = 0; i < Math.min(data.items.length, maxItems); i++) {
            var title = data.items[i].title;
            if (title && title.trim()) {
                rssItems.push(title.trim());
            }
        }

        startRssRotation();

    } catch (err) {
        console.error('RSS fetch failed:', err);
        await fetchRSSFallback(rssUrl);
    }
}

// Fallback: try allorigins proxy with XML parsing
async function fetchRSSFallback(rssUrl) {
    try {
        var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(rssUrl);
        var response = await fetch(proxyUrl);
        var text = await response.text();

        var parser = new DOMParser();
        var xml = parser.parseFromString(text, 'text/xml');
        var items = xml.querySelectorAll('item');

        var maxItems = (config.rss && config.rss.maxItems) || 15;
        rssItems = [];

        for (var i = 0; i < Math.min(items.length, maxItems); i++) {
            var titleEl = items[i].querySelector('title');
            if (titleEl && titleEl.textContent && titleEl.textContent.trim()) {
                rssItems.push(titleEl.textContent.trim());
            }
        }

        startRssRotation();

    } catch (err) {
        console.error('RSS fallback also failed:', err);
        setupStaticMessages();
    }
}

function startRssRotation() {
    if (rssItems.length === 0) {
        document.getElementById('ticker-text').textContent = 'No news available';
        return;
    }

    currentRssIndex = 0;
    showCurrentRssItem();

    if (rssInterval) clearInterval(rssInterval);
    var rotationSec = (config.rss && config.rss.rotationSeconds) || 10;
    rssInterval = setInterval(rotateRssItem, rotationSec * 1000);
}

function showCurrentRssItem() {
    if (rssItems.length === 0) return;

    var ticker = document.getElementById('ticker-text');
    ticker.style.animation = 'none';
    void ticker.offsetWidth;
    ticker.style.animation = 'ticker-fade 0.5s ease-in-out';
    ticker.textContent = rssItems[currentRssIndex];
}

function rotateRssItem() {
    currentRssIndex = (currentRssIndex + 1) % rssItems.length;
    showCurrentRssItem();
}

// Fallback: static messages from config
function setupStaticMessages() {
    var messages = (config.messages || []).filter(function(m) { return m.active; });

    if (messages.length === 0) {
        document.getElementById('ticker-text').textContent = config.building.name || 'Urban Tower';
        return;
    }

    var idx = 0;
    document.getElementById('ticker-text').textContent = messages[0].text;

    setInterval(function() {
        idx = (idx + 1) % messages.length;
        var ticker = document.getElementById('ticker-text');
        ticker.style.animation = 'none';
        void ticker.offsetWidth;
        ticker.style.animation = 'ticker-fade 0.5s ease-in-out';
        ticker.textContent = messages[idx].text;
    }, (config.messageRotationSeconds || 8) * 1000);
}

// ============================================================
// AUTO-REFRESH (reload config every 5 min to pick up changes)
// ============================================================
function setupAutoRefresh() {
    setInterval(async function() {
        try {
            var newConfig = await loadConfig();

            // Check if RSS URL changed
            var oldRss = config.rss && config.rss.url;
            var newRss = newConfig.rss && newConfig.rss.url;
            if (oldRss !== newRss) {
                config = newConfig;
                fetchRSS();
                console.log('RSS source updated');
                return;
            }

            // Check if background changed
            if (newConfig.building.background !== config.building.background) {
                config.building = newConfig.building;
                setupBackground();
            }

            config = newConfig;
        } catch (err) {
            console.error('Auto-refresh failed:', err);
        }
    }, 5 * 60 * 1000);
}

// ============================================================
// START
// ============================================================
document.addEventListener('DOMContentLoaded', init);
