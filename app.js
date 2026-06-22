/**
 * RPi Home Signage - Display App
 * Loads config.json and renders clock, weather, messages
 *
 * Note: config.json is self-managed (not user-input from untrusted sources),
 * so DOM manipulation with known data is safe in this self-hosted context.
 */

const CONFIG_URL = 'config.json';
const WEATHER_API = 'https://api.openweathermap.org/data/2.5';

let config = null;
let messages = [];
let currentMessageIndex = 0;

// ============================================================
// INIT
// ============================================================
async function init() {
    try {
        config = await loadConfig();
        setupBackground();
        setupClock();
        setupWeather();
        setupMessages();
        setupAutoRefresh();
    } catch (err) {
        console.error('Failed to initialize:', err);
        document.getElementById('ticker-text').textContent = 'Error loading config. Check console.';
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
    // Set logo
    const logo = document.getElementById('building-logo');
    if (config.building.logo) {
        logo.src = config.building.logo;
        logo.alt = config.building.name;
    }
}

// ============================================================
// CLOCK
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
}

// ============================================================
// WEATHER
// ============================================================
async function setupWeather() {
    document.getElementById('weather-city').textContent = config.location.city;
    updateWeatherDay();

    await fetchWeather();
    // Refresh weather periodically
    setInterval(fetchWeather, (config.weather.refreshMinutes || 30) * 60 * 1000);
}

function updateWeatherDay() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    document.getElementById('weather-day').textContent = days[new Date().getDay()];
}

async function fetchWeather() {
    try {
        // Try OpenWeatherMap if API key provided
        if (config.weather.apiKey) {
            await fetchOpenWeatherMap();
        } else {
            // Fallback: use wttr.in (no API key needed)
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

    // Current weather
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

    // Forecast
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

    // Today's high/low
    const today = data.weather[0];
    document.getElementById('weather-high').textContent = today.maxtempC;
    document.getElementById('weather-low').textContent = today.mintempC;

    // Weather icon - hide img element for wttr fallback
    const iconEl = document.getElementById('weather-icon');
    iconEl.style.display = 'none';

    // Render forecast
    renderWttrForecast(data.weather);
}

function renderWttrForecast(weatherDays) {
    const container = document.getElementById('weather-forecast');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Clear existing forecast
    container.textContent = '';

    weatherDays.slice(1, 5).forEach(day => {
        const date = new Date(day.date);
        const dayName = days[date.getDay()];
        const icon = getWeatherEmoji(day.hourly[4].weatherCode);

        const dayEl = document.createElement('div');
        dayEl.className = 'forecast-day';

        const nameEl = document.createElement('div');
        nameEl.className = 'day-name';
        nameEl.textContent = dayName;

        const iconDivEl = document.createElement('div');
        iconDivEl.className = 'day-icon';
        iconDivEl.textContent = icon;

        const tempsEl = document.createElement('div');
        tempsEl.className = 'day-temps';
        tempsEl.textContent = `${day.maxtempC}° ${day.mintempC}°`;

        dayEl.appendChild(nameEl);
        dayEl.appendChild(iconDivEl);
        dayEl.appendChild(tempsEl);
        container.appendChild(dayEl);
    });
}

function renderForecast(forecastData) {
    const container = document.getElementById('weather-forecast');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Group by day, take noon reading
    const dailyMap = {};
    forecastData.list.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        const hour = parseInt(item.dt_txt.split(' ')[1]);
        if (hour === 12 || !dailyMap[date]) {
            dailyMap[date] = item;
        }
    });

    const dailyArr = Object.values(dailyMap).slice(1, 5);

    // Clear existing forecast
    container.textContent = '';

    dailyArr.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayName = days[date.getDay()];

        const dayEl = document.createElement('div');
        dayEl.className = 'forecast-day';

        const nameEl = document.createElement('div');
        nameEl.className = 'day-name';
        nameEl.textContent = dayName;

        const iconDivEl = document.createElement('div');
        iconDivEl.className = 'day-icon';
        const iconImg = document.createElement('img');
        iconImg.src = `https://openweathermap.org/img/wn/${item.weather[0].icon}.png`;
        iconImg.style.width = '32px';
        iconImg.style.height = '32px';
        iconImg.style.filter = 'invert(1)';
        iconImg.alt = item.weather[0].description;
        iconDivEl.appendChild(iconImg);

        const tempsEl = document.createElement('div');
        tempsEl.className = 'day-temps';
        tempsEl.textContent = `${Math.round(item.main.temp_max)}° ${Math.round(item.main.temp_min)}°`;

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
// MESSAGES (TICKER)
// ============================================================
function setupMessages() {
    messages = (config.messages || []).filter(m => m.active);

    if (messages.length === 0) {
        document.getElementById('ticker-text').textContent = 'No messages';
        return;
    }

    showCurrentMessage();
    setInterval(rotateMessage, (config.messageRotationSeconds || 8) * 1000);
}

function showCurrentMessage() {
    if (messages.length === 0) return;

    const ticker = document.getElementById('ticker-text');
    ticker.style.animation = 'none';
    ticker.offsetHeight; // trigger reflow
    ticker.style.animation = 'ticker-fade 0.5s ease-in-out';
    ticker.textContent = messages[currentMessageIndex].text;
}

function rotateMessage() {
    currentMessageIndex = (currentMessageIndex + 1) % messages.length;
    showCurrentMessage();
}

// ============================================================
// AUTO-REFRESH (reload config every 5 min to pick up changes)
// ============================================================
function setupAutoRefresh() {
    setInterval(async () => {
        try {
            const newConfig = await loadConfig();

            // Check if messages changed
            if (JSON.stringify(newConfig.messages) !== JSON.stringify(config.messages)) {
                config.messages = newConfig.messages;
                messages = config.messages.filter(m => m.active);
                currentMessageIndex = 0;
                showCurrentMessage();
                console.log('Messages updated from config');
            }

            // Check if background changed
            if (newConfig.building.background !== config.building.background) {
                config.building = newConfig.building;
                setupBackground();
            }

        } catch (err) {
            console.error('Auto-refresh failed:', err);
        }
    }, 5 * 60 * 1000); // every 5 minutes
}

// ============================================================
// START
// ============================================================
document.addEventListener('DOMContentLoaded', init);
