/**
 * RPi Home Signage - Display App
 * - RSS feed from Ynet in ticker
 * - Clock with pulse animation on each second
 * - Weather with 4-day forecast
 * - Auto-refresh config every 5 minutes
 */

const CONFIG_URL = 'config.json';
const WEATHER_API = 'https://api.openweathermap.org/data/2.5';
// CORS proxy for RSS (GitHub Pages can't fetch RSS directly due to CORS)
const RSS_PROXY = 'https://api.allorigins.win/raw?url=';

let config = null;
let rssItems = [];
let currentRssIndex = 0;
let rssInterval = null;

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
    const cacheBust = `?t=${Date.now()}`;
    const response = await fetch(CONFIG_URL + cacheBust);
    if (!response.ok) throw new Error('Failed to load config.json');
    return response.json();
}

// ============================================================
// BACKGROUND
// ============================================================
function setupBackground() {
    const bg = document.getElementById('background');
    if (config.building.background) {
        bg.style.backgroundImage = `url(${config.building.background})`;
    }
    const logo = document.getElementById('building-logo');
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
    const now = new Date();

    // Time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock-time').textContent = `${hours}:${minutes}:${seconds}`;

    // Date
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('clock-date').textContent = now.toLocaleDateString('en-GB', options);

    // Pulse animation on the clock widget background
    const clockWidget = document.getElementById('clock-widget');
    clockWidget.classList.remove('clock-pulse');
    // Force reflow to restart animation
    void clockWidget.offsetWidth;
    clockWidget.classList.add('clock-pulse');
}

// ============================================================
// WEATHER (4-day forecast)
// ============================================================
async function setupWeather() {
    document.getElementById('weather-city').textContent = config.location.city;
    updateWeatherDay();

    await fetchWeather();
    setInterval(fetchWeather, (config.weather.refreshMinutes || 30) * 60 * 1000);
}

function updateWeatherDay() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    document.getElementById('weather-day').textContent = days[new Date().getDay()];
}

async function fetchWeather() {
    try {
        if (config.weather.apiKey) {
            await fetchOpenWeatherMap();
        } else {
            await fetchWttr();
        }
    } catch (err) {
        console.error('Weather fetch failed:', err);
    }
}

async function fetchOpenWeatherMap() {
    const { lat, lon } = config.location;
    const key = config.weather.apiKey;
    const units = config.weather.units || 'metric';

    const currentRes = await fetch(
        `${WEATHER_API}/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${key}`
    );
    const current = await currentRes.json();

    document.getElementById('weather-temp').textContent = `${Math.round(current.main.temp)}°C`;
    document.getElementById('weather-high').textContent = Math.round(current.main.temp_max);
    document.getElementById('weather-low').textContent = Math.round(current.main.temp_min);
    document.getElementById('weather-desc').textContent = current.weather[0].description;
    document.getElementById('weather-icon').src =
        `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`;

    const forecastRes = await fetch(
        `${WEATHER_API}/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${key}`
    );
    const forecast = await forecastRes.json();
    renderForecast(forecast);
}

async function fetchWttr() {
    const city = encodeURIComponent(config.location.city);
    const res = await fetch(`https://wttr.in/${city}?format=j1`);
    const data = await res.json();

    const current = data.current_condition[0];
    document.getElementById('weather-temp').textContent = `${current.temp_C}°C`;
    document.getElementById('weather-desc').textContent = current.weatherDesc[0].value;

    const today = data.weather[0];
    document.getElementById('weather-high').textContent = today.maxtempC;
    document.getElementById('weather-low').textContent = today.mintempC;

    // Hide the img icon for wttr
    const iconEl = document.getElementById('weather-icon');
    iconEl.style.display = 'none';

    // Render 4-day forecast
    renderWttrForecast(data.weather);
}

function renderWttrForecast(weatherDays) {
    const container = document.getElementById('weather-forecast');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const numDays = (config.weather.forecastDays || 4);

    // Clear existing forecast
    container.textContent = '';

    // Skip today (index 0), show next N days
    weatherDays.slice(1, numDays + 1).forEach(function(day) {
        var date = new Date(day.date);
        var dayName = days[date.getDay()];
        var icon = getWeatherEmoji(day.hourly[4].weatherCode);

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
        tempsEl.textContent = day.maxtempC + '° ' + day.mintempC + '°';

        dayEl.appendChild(nameEl);
        dayEl.appendChild(iconDivEl);
        dayEl.appendChild(tempsEl);
        container.appendChild(dayEl);
    });
}

function renderForecast(forecastData) {
    var container = document.getElementById('weather-forecast');
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var numDays = (config.weather.forecastDays || 4);

    var dailyMap = {};
    forecastData.list.forEach(function(item) {
        var date = item.dt_txt.split(' ')[0];
        var hour = parseInt(item.dt_txt.split(' ')[1]);
        if (hour === 12 || !dailyMap[date]) {
            dailyMap[date] = item;
        }
    });

    var dailyArr = Object.values(dailyMap).slice(1, numDays + 1);

    container.textContent = '';

    dailyArr.forEach(function(item) {
        var date = new Date(item.dt * 1000);
        var dayName = days[date.getDay()];

        var dayEl = document.createElement('div');
        dayEl.className = 'forecast-day';

        var nameEl = document.createElement('div');
        nameEl.className = 'day-name';
        nameEl.textContent = dayName;

        var iconDivEl = document.createElement('div');
        iconDivEl.className = 'day-icon';
        var iconImg = document.createElement('img');
        iconImg.src = 'https://openweathermap.org/img/wn/' + item.weather[0].icon + '.png';
        iconImg.style.width = '32px';
        iconImg.style.height = '32px';
        iconImg.style.filter = 'invert(1)';
        iconImg.alt = item.weather[0].description;
        iconDivEl.appendChild(iconImg);

        var tempsEl = document.createElement('div');
        tempsEl.className = 'day-temps';
        tempsEl.textContent = Math.round(item.main.temp_max) + '° ' + Math.round(item.main.temp_min) + '°';

        dayEl.appendChild(nameEl);
        dayEl.appendChild(iconDivEl);
        dayEl.appendChild(tempsEl);
        container.appendChild(dayEl);
    });
}

function getWeatherEmoji(code) {
    code = parseInt(code);
    if (code === 113) return '☀️';
    if (code === 116) return '⛅';
    if (code <= 122) return '☁️';
    if (code <= 200) return '🌫️';
    if (code <= 299) return '🌦️';
    if (code <= 399) return '🌧️';
    if (code <= 499) return '⛈️';
    if (code <= 599) return '🌨️';
    return '☀️';
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
            // Fallback to static messages if no RSS configured
            setupStaticMessages();
            return;
        }

        var proxyUrl = RSS_PROXY + encodeURIComponent(rssUrl);
        var response = await fetch(proxyUrl);
        var text = await response.text();

        var parser = new DOMParser();
        var xml = parser.parseFromString(text, 'text/xml');
        var items = xml.querySelectorAll('item');

        var maxItems = (config.rss && config.rss.maxItems) || 15;
        rssItems = [];

        for (var i = 0; i < Math.min(items.length, maxItems); i++) {
            var titleEl = items[i].querySelector('title');
            if (titleEl && titleEl.textContent) {
                rssItems.push(titleEl.textContent.trim());
            }
        }

        if (rssItems.length === 0) {
            document.getElementById('ticker-text').textContent = 'No news available';
            return;
        }

        // Start rotating RSS items
        currentRssIndex = 0;
        showCurrentRssItem();

        // Clear previous interval if exists
        if (rssInterval) clearInterval(rssInterval);
        var rotationSec = (config.rss && config.rss.rotationSeconds) || 10;
        rssInterval = setInterval(rotateRssItem, rotationSec * 1000);

    } catch (err) {
        console.error('RSS fetch failed:', err);
        // Fallback to static messages
        setupStaticMessages();
    }
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
        document.getElementById('ticker-text').textContent = 'Urban Tower';
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
