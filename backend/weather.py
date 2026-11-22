"""Open-Meteo weather client with SQLite caching and a clearly labelled demo fallback."""
import json
import math
import random
import time
from datetime import datetime, timedelta, timezone

import requests

from database import db

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
CACHE_SECONDS = 30 * 60
PAST_DAYS = 30
FORECAST_DAYS = 7

DAILY_VARS = [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_probability_max",
    "precipitation_hours",
    "et0_fao_evapotranspiration",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
]
HOURLY_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "precipitation_probability",
    "weather_code",
    "wind_speed_10m",
    "wind_gusts_10m",
    "soil_moisture_3_to_9cm",
]
CURRENT_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
]


def _cache_key(lat, lon):
    return f"forecast:{round(lat, 2)}:{round(lon, 2)}"


def _read_cache(key, max_age):
    with db() as conn:
        row = conn.execute(
            "SELECT payload, fetched_at FROM weather_cache WHERE cache_key = ?", (key,)
        ).fetchone()
    if row and time.time() - row["fetched_at"] < max_age:
        return json.loads(row["payload"])
    return None


def _write_cache(key, payload):
    with db() as conn:
        conn.execute(
            "INSERT INTO weather_cache (cache_key, payload, fetched_at) VALUES (?, ?, ?) "
            "ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at",
            (key, json.dumps(payload), time.time()),
        )


def _fetch_live(lat, lon):
    params = {
        "latitude": lat,
        "longitude": lon,
        "timezone": "auto",
        "past_days": PAST_DAYS,
        "forecast_days": FORECAST_DAYS,
        "daily": ",".join(DAILY_VARS),
        "hourly": ",".join(HOURLY_VARS),
        "current": ",".join(CURRENT_VARS),
        "wind_speed_unit": "kmh",
    }
    response = requests.get(FORECAST_URL, params=params, timeout=12)
    response.raise_for_status()
    data = response.json()
    if "daily" not in data or "hourly" not in data:
        raise ValueError("Incomplete forecast response")
    return data


def get_forecast(lat, lon):
    """Return normalized forecast data. Falls back to cached data, then demo data."""
    key = _cache_key(lat, lon)
    cached = _read_cache(key, CACHE_SECONDS)
    if cached:
        return cached

    try:
        raw = _fetch_live(lat, lon)
        payload = normalize(raw, is_demo=False)
        _write_cache(key, payload)
        return payload
    except Exception as exc:  # network error, API outage, bad response
        print(f"[weather] Live fetch failed ({exc}); trying stale cache / demo data")
        stale = _read_cache(key, 24 * 3600)
        if stale:
            stale["source"] = "Open-Meteo (cached, live update failed)"
            return stale
        return normalize(generate_demo(lat, lon), is_demo=True)


def normalize(raw, is_demo):
    offset = raw.get("utc_offset_seconds", 0)
    local_now = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=offset)
    today = local_now.date().isoformat()

    d = raw["daily"]
    days = []
    for i, date in enumerate(d["time"]):
        days.append({
            "date": date,
            "weather_code": _at(d, "weather_code", i),
            "temp_max": _at(d, "temperature_2m_max", i),
            "temp_min": _at(d, "temperature_2m_min", i),
            "rain_mm": _at(d, "precipitation_sum", i) or 0.0,
            "rain_probability": _at(d, "precipitation_probability_max", i),
            "rain_hours": _at(d, "precipitation_hours", i),
            "et0_mm": _at(d, "et0_fao_evapotranspiration", i) or 0.0,
            "wind_max": _at(d, "wind_speed_10m_max", i),
            "gust_max": _at(d, "wind_gusts_10m_max", i),
        })

    h = raw["hourly"]
    hours = []
    for i, t in enumerate(h["time"]):
        sm = _at(h, "soil_moisture_3_to_9cm", i)
        hours.append({
            "time": t,
            "temp": _at(h, "temperature_2m", i),
            "humidity": _at(h, "relative_humidity_2m", i),
            "rain_mm": _at(h, "precipitation", i) or 0.0,
            "rain_probability": _at(h, "precipitation_probability", i),
            "weather_code": _at(h, "weather_code", i),
            "wind": _at(h, "wind_speed_10m", i),
            "gust": _at(h, "wind_gusts_10m", i),
            "soil_moisture_pct": round(sm * 100, 1) if sm is not None else None,
        })

    return {
        "is_demo": is_demo,
        "source": "Demo data (live weather unavailable)" if is_demo else "Open-Meteo live forecast",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "timezone": raw.get("timezone", "UTC"),
        "utc_offset_seconds": offset,
        "today": today,
        "current": raw.get("current", {}),
        "past_days": [x for x in days if x["date"] < today],
        "forecast_days": [x for x in days if x["date"] >= today][:FORECAST_DAYS],
        "hours": hours,
    }


def local_now(forecast):
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        seconds=forecast.get("utc_offset_seconds", 0)
    )


def _at(block, name, i):
    values = block.get(name)
    if not values or i >= len(values):
        return None
    return values[i]


def generate_demo(lat, lon):
    """Synthetic but plausible weather used ONLY when the live API is unreachable."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0, tzinfo=None)
    rng = random.Random(f"{now.date()}:{round(lat, 1)}:{round(lon, 1)}")
    start = now.date() - timedelta(days=PAST_DAYS)
    total_days = PAST_DAYS + FORECAST_DAYS

    daily = {k: [] for k in ["time"] + DAILY_VARS}
    for i in range(total_days):
        date = start + timedelta(days=i)
        wet = rng.random() < 0.35
        rain = round(rng.uniform(1, 25), 1) if wet else 0.0
        tmax = round(28 + 5 * math.sin(i / 5) + rng.uniform(-2, 2), 1)
        daily["time"].append(date.isoformat())
        daily["weather_code"].append(rng.choice([61, 63, 80, 95]) if wet else rng.choice([0, 1, 2, 3]))
        daily["temperature_2m_max"].append(tmax)
        daily["temperature_2m_min"].append(round(tmax - rng.uniform(8, 12), 1))
        daily["precipitation_sum"].append(rain)
        daily["precipitation_probability_max"].append(rng.randint(60, 95) if wet else rng.randint(0, 30))
        daily["precipitation_hours"].append(rng.randint(1, 8) if wet else 0)
        daily["et0_fao_evapotranspiration"].append(round(rng.uniform(3.5, 6.0), 1))
        daily["wind_speed_10m_max"].append(round(rng.uniform(8, 30), 1))
        daily["wind_gusts_10m_max"].append(round(rng.uniform(15, 50), 1))

    hourly = {k: [] for k in ["time"] + HOURLY_VARS}
    hour_start = datetime.combine(start, datetime.min.time())
    for i in range(total_days * 24):
        t = hour_start + timedelta(hours=i)
        day_rain = daily["precipitation_sum"][i // 24]
        is_rain_hour = day_rain > 0 and 13 <= t.hour <= 17
        hourly["time"].append(t.strftime("%Y-%m-%dT%H:%M"))
        hourly["temperature_2m"].append(round(22 + 7 * math.sin((t.hour - 9) / 24 * 2 * math.pi), 1))
        hourly["relative_humidity_2m"].append(rng.randint(40, 90))
        hourly["precipitation"].append(round(day_rain / 5, 1) if is_rain_hour else 0.0)
        hourly["precipitation_probability"].append(daily["precipitation_probability_max"][i // 24])
        hourly["weather_code"].append(daily["weather_code"][i // 24] if is_rain_hour else 1)
        hourly["wind_speed_10m"].append(round(rng.uniform(5, 25), 1))
        hourly["wind_gusts_10m"].append(round(rng.uniform(10, 45), 1))
        hourly["soil_moisture_3_to_9cm"].append(round(rng.uniform(0.18, 0.32), 3))

    return {
        "timezone": "UTC",
        "utc_offset_seconds": 0,
        "current": {
            "temperature_2m": hourly["temperature_2m"][PAST_DAYS * 24 + now.hour],
            "relative_humidity_2m": 60,
            "precipitation": 0,
            "weather_code": 2,
            "wind_speed_10m": 12,
        },
        "daily": daily,
        "hourly": hourly,
    }


def geocode(query):
    response = requests.get(
        GEOCODE_URL, params={"name": query, "count": 6, "language": "en", "format": "json"}, timeout=10
    )
    response.raise_for_status()
    results = response.json().get("results", []) or []
    return [
        {
            "name": ", ".join(p for p in [r.get("name"), r.get("admin1"), r.get("country")] if p),
            "latitude": r["latitude"],
            "longitude": r["longitude"],
        }
        for r in results
    ]
