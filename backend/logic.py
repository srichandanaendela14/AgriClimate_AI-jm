"""Agronomic decision logic: rainfall summary, irrigation advice, drought risk and weather hazards."""
from datetime import datetime, timedelta

from weather import local_now

# min_moisture: soil moisture (%) below which the crop becomes water-stressed.
# kc: FAO-56 mid-season crop coefficient used to convert reference ET0 into crop water use.
CROPS = {
    "rice":       {"label": "Rice",        "min_moisture": 60, "kc": 1.20},
    "wheat":      {"label": "Wheat",       "min_moisture": 35, "kc": 1.15},
    "maize":      {"label": "Maize",       "min_moisture": 40, "kc": 1.20},
    "cotton":     {"label": "Cotton",      "min_moisture": 35, "kc": 1.15},
    "sugarcane":  {"label": "Sugarcane",   "min_moisture": 50, "kc": 1.25},
    "soybean":    {"label": "Soybean",     "min_moisture": 40, "kc": 1.15},
    "vegetables": {"label": "Vegetables",  "min_moisture": 45, "kc": 1.05},
    "pulses":     {"label": "Pulses",      "min_moisture": 30, "kc": 1.00},
    "millet":     {"label": "Millet",      "min_moisture": 25, "kc": 1.00},
}

# Fraction of rainfall that actually stays in the root zone for each soil type.
SOILS = {
    "sandy": {"label": "Sandy", "rain_efficiency": 0.6},
    "loam":  {"label": "Loam",  "rain_efficiency": 0.8},
    "clay":  {"label": "Clay",  "rain_efficiency": 0.7},
    "silt":  {"label": "Silt",  "rain_efficiency": 0.8},
}

THUNDERSTORM_CODES = {95, 96, 99}
HEAVY_RAIN_MM_PER_HOUR = 7.5
STRONG_WIND_KMH = 40
STRONG_GUST_KMH = 60
EXTREME_HEAT_C = 40
EXTREME_COLD_C = 2


def rainfall_summary(forecast):
    days = forecast["forecast_days"]
    total = round(sum(d["rain_mm"] for d in days), 1)
    rainy_days = sum(1 for d in days if d["rain_mm"] >= 1)
    wettest = max(days, key=lambda d: d["rain_mm"]) if days else None
    probs = [d["rain_probability"] for d in days if d["rain_probability"] is not None]
    return {
        "total_mm": total,
        "rainy_days": rainy_days,
        "average_probability": round(sum(probs) / len(probs)) if probs else None,
        "wettest_day": wettest,
    }


def _rain_next_hours(forecast, hours):
    now = local_now(forecast)
    end = now + timedelta(hours=hours)
    window = [h for h in forecast["hours"] if now <= _parse(h["time"]) < end]
    rain = sum(h["rain_mm"] for h in window)
    probs = [h["rain_probability"] for h in window if h["rain_probability"] is not None]
    return round(rain, 1), (max(probs) if probs else 0)


def current_model_soil_moisture(forecast):
    now = local_now(forecast)
    past = [h for h in forecast["hours"] if _parse(h["time"]) <= now and h["soil_moisture_pct"] is not None]
    return past[-1]["soil_moisture_pct"] if past else None


def irrigation_advice(forecast, crop_type, soil_moisture, soil_type="loam", farm_size_ha=1.0):
    crop = CROPS.get(crop_type, CROPS["maize"])
    soil = SOILS.get(soil_type, SOILS["loam"])
    threshold = crop["min_moisture"]
    target = threshold + 15

    rain_48h, prob_48h = _rain_next_hours(forecast, 48)
    next3 = forecast["forecast_days"][:3]
    crop_water_use = round(sum(d["et0_mm"] for d in next3) * crop["kc"], 1)
    effective_rain = round(rain_48h * soil["rain_efficiency"] * (prob_48h / 100), 1)
    rain_likely = rain_48h >= 10 and prob_48h >= 60

    # A 1% soil moisture deficit in the top ~15 cm of soil is roughly 1.5 mm of water.
    deficit_mm = max(0.0, (target - soil_moisture) * 1.5)
    water_mm = round(max(0.0, deficit_mm + crop_water_use - effective_rain), 1)

    if soil_moisture >= target:
        decision, status = "No irrigation needed", "ok"
        reason = f"Soil moisture ({soil_moisture:.0f}%) is above the comfortable level for {crop['label'].lower()}."
        water_mm = 0.0
    elif rain_likely and soil_moisture >= threshold - 10:
        decision, status = "Wait for rain", "wait"
        reason = (f"About {rain_48h} mm of rain is expected in the next 48 hours "
                  f"({prob_48h}% chance). Delay irrigation to save water.")
        water_mm = 0.0
    elif soil_moisture < threshold:
        decision, status = "Irrigate now", "urgent"
        reason = (f"Soil moisture ({soil_moisture:.0f}%) is below the {threshold}% stress level for "
                  f"{crop['label'].lower()} and little rain is expected.")
    else:
        decision, status = "Light irrigation recommended", "light"
        reason = (f"Soil moisture is acceptable but the crop will use about {crop_water_use} mm "
                  f"of water over the next 3 days.")
        water_mm = round(max(0.0, crop_water_use - effective_rain), 1)

    gusty_today = any((d["wind_max"] or 0) >= 30 for d in forecast["forecast_days"][:1])
    tips = ["Irrigate early in the morning (5–9 AM) or in the evening to reduce evaporation."]
    if gusty_today:
        tips.append("Winds are strong today. Prefer drip or furrow irrigation over sprinklers.")
    if soil_type == "sandy":
        tips.append("Sandy soil drains fast. Split the water into two smaller applications.")
    if soil_type == "clay":
        tips.append("Clay soil absorbs slowly. Apply water gradually to avoid runoff.")

    return {
        "decision": decision,
        "status": status,
        "reason": reason,
        "water_mm": water_mm,
        "water_liters_total": round(water_mm * 10000 * farm_size_ha),
        "crop": crop["label"],
        "soil": soil["label"],
        "soil_moisture": soil_moisture,
        "stress_threshold": threshold,
        "target_moisture": target,
        "rain_next_48h_mm": rain_48h,
        "rain_probability_48h": prob_48h,
        "crop_water_use_3d_mm": crop_water_use,
        "tips": tips,
    }


def drought_assessment(forecast, soil_moisture=None):
    past = forecast["past_days"]
    rain_30 = round(sum(d["rain_mm"] for d in past), 1)
    et0_30 = round(sum(d["et0_mm"] for d in past), 1)
    ratio = round(rain_30 / et0_30, 2) if et0_30 else 1.0

    dry_days = 0
    for d in reversed(past):
        if d["rain_mm"] >= 1:
            break
        dry_days += 1

    rain_7_forecast = round(sum(d["rain_mm"] for d in forecast["forecast_days"]), 1)
    if soil_moisture is None:
        soil_moisture = current_model_soil_moisture(forecast)

    factors = []
    score = 0

    if ratio < 0.3:
        pts, note = 3, "Rainfall covered less than 30% of crop water demand"
    elif ratio < 0.5:
        pts, note = 2, "Rainfall covered only 30–50% of water demand"
    elif ratio < 0.8:
        pts, note = 1, "Rainfall slightly below water demand"
    else:
        pts, note = 0, "Rainfall kept up with water demand"
    score += pts
    factors.append({"name": "30-day water balance", "value": f"{rain_30} mm rain vs {et0_30} mm evaporation",
                    "points": pts, "note": note})

    pts = 3 if dry_days >= 21 else 2 if dry_days >= 14 else 1 if dry_days >= 7 else 0
    score += pts
    factors.append({"name": "Consecutive dry days", "value": f"{dry_days} days", "points": pts,
                    "note": "Days in a row with less than 1 mm of rain"})

    pts = 2 if rain_7_forecast < 2 else 1 if rain_7_forecast < 10 else 0
    score += pts
    factors.append({"name": "Next 7 days rainfall", "value": f"{rain_7_forecast} mm", "points": pts,
                    "note": "Low forecast rain means no relief is coming" if pts else "Rain expected soon"})

    if soil_moisture is not None:
        pts = 2 if soil_moisture < 20 else 1 if soil_moisture < 30 else 0
        score += pts
        factors.append({"name": "Soil moisture", "value": f"{soil_moisture:.0f}%", "points": pts,
                        "note": "Very dry soil" if pts == 2 else "Dry soil" if pts else "Soil moisture is adequate"})

    if score >= 8:
        level = "Severe"
    elif score >= 5:
        level = "High"
    elif score >= 3:
        level = "Moderate"
    else:
        level = "Low"

    advice = {
        "Low": ["Normal farming activities can continue.", "Keep monitoring rainfall weekly."],
        "Moderate": ["Check soil moisture every 2–3 days.", "Use mulch to reduce evaporation.",
                     "Plan irrigation for sensitive growth stages."],
        "High": ["Prioritise water for crops at flowering and grain-filling stage.",
                 "Switch to drip irrigation where possible.", "Avoid sowing new water-intensive crops."],
        "Severe": ["Use available water only for the most valuable crops.",
                   "Contact your local agriculture office for drought relief support.",
                   "Consider drought-tolerant crops such as millet or pulses."],
    }[level]

    return {
        "level": level,
        "score": score,
        "max_score": 10,
        "rain_30d_mm": rain_30,
        "et0_30d_mm": et0_30,
        "water_balance_ratio": ratio,
        "dry_days": dry_days,
        "rain_7d_forecast_mm": rain_7_forecast,
        "soil_moisture": soil_moisture,
        "factors": factors,
        "advice": advice,
        "history": [{"date": d["date"], "rain_mm": d["rain_mm"], "et0_mm": d["et0_mm"]} for d in past],
    }


def detect_hazards(forecast, hours_ahead=48):
    """Group consecutive risky hours into events and return the start of each event."""
    now = local_now(forecast)
    end = now + timedelta(hours=hours_ahead)
    window = [h for h in forecast["hours"] if now - timedelta(hours=1) < _parse(h["time"]) <= end]

    checks = {
        "thunderstorm": lambda h: h["weather_code"] in THUNDERSTORM_CODES,
        "heavy_rain": lambda h: h["rain_mm"] >= HEAVY_RAIN_MM_PER_HOUR and (h["rain_probability"] or 100) >= 50,
        "strong_wind": lambda h: (h["wind"] or 0) >= STRONG_WIND_KMH or (h["gust"] or 0) >= STRONG_GUST_KMH,
        "extreme_heat": lambda h: (h["temp"] or 0) >= EXTREME_HEAT_C,
        "extreme_cold": lambda h: h["temp"] is not None and h["temp"] <= EXTREME_COLD_C,
    }

    events = []
    for kind, test in checks.items():
        current = None
        for h in window:
            if test(h):
                if current is None:
                    current = {"type": kind, "start": h["time"], "end": h["time"], "hours": [h]}
                else:
                    current["end"] = h["time"]
                    current["hours"].append(h)
            elif current:
                events.append(current)
                current = None
        if current:
            events.append(current)

    result = []
    for e in events:
        start = _parse(e["start"])
        lead_hours = round((start - now).total_seconds() / 3600, 1)
        result.append({**_describe(e), "type": e["type"], "start": e["start"], "end": e["end"],
                       "lead_hours": lead_hours})
    return sorted(result, key=lambda x: x["start"])


def _describe(event):
    hours = event["hours"]
    kind = event["type"]
    if kind == "thunderstorm":
        rain = round(sum(h["rain_mm"] for h in hours), 1)
        return {"title": "Thunderstorm expected", "severity": "severe",
                "message": f"Thunderstorm with about {rain} mm of rain. Stay away from open fields and trees, "
                           "and secure livestock.",
                "advice": "Unplug electric pumps and avoid using metal tools outdoors."}
    if kind == "heavy_rain":
        peak = max(h["rain_mm"] for h in hours)
        total = round(sum(h["rain_mm"] for h in hours), 1)
        return {"title": "Heavy rainfall expected", "severity": "severe" if peak >= 15 else "warning",
                "message": f"Heavy rain up to {peak} mm/hour ({total} mm total). Check field drainage.",
                "advice": "Postpone spraying and fertiliser application. Clear drainage channels."}
    if kind == "strong_wind":
        gust = max((h["gust"] or 0) for h in hours)
        return {"title": "Strong winds expected", "severity": "severe" if gust >= 80 else "warning",
                "message": f"Wind gusts up to {round(gust)} km/h. Secure greenhouses, sheds and young plants.",
                "advice": "Do not spray pesticides and avoid sprinkler irrigation."}
    if kind == "extreme_heat":
        peak = max(h["temp"] for h in hours)
        return {"title": "Extreme heat expected", "severity": "severe" if peak >= 44 else "warning",
                "message": f"Temperatures up to {round(peak)}°C. Protect crops and livestock from heat stress.",
                "advice": "Irrigate in the early morning and provide shade and water for animals."}
    low = min(h["temp"] for h in hours)
    return {"title": "Frost / extreme cold expected", "severity": "severe" if low <= -2 else "warning",
            "message": f"Temperatures down to {round(low)}°C. Frost may damage sensitive crops.",
            "advice": "Cover seedlings and irrigate lightly in the evening to reduce frost damage."}


def _parse(t):
    return datetime.fromisoformat(t)
