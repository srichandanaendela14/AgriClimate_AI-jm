"""AgriClimate AI - Flask REST API."""
import os

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import push
import scheduler
from database import db, get_farmer, init_db
from logic import (CROPS, SOILS, current_model_soil_moisture, detect_hazards, drought_assessment,
                   irrigation_advice, rainfall_summary)
from weather import geocode, get_forecast

FARMER_ID = 1  # Single-farmer app; the schema supports multiple farmers.

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.environ.get("CORS_ORIGINS", "*")}})


def _farmer_or_404():
    farmer = get_farmer(FARMER_ID)
    if not farmer:
        return None, (jsonify({"error": "Farmer profile not found"}), 404)
    return farmer, None


def _meta(forecast, farmer):
    return {
        "is_demo": forecast["is_demo"],
        "source": forecast["source"],
        "fetched_at": forecast["fetched_at"],
        "timezone": forecast["timezone"],
        "location": {
            "name": farmer["location_name"],
            "latitude": farmer["latitude"],
            "longitude": farmer["longitude"],
        },
    }


def _soil_moisture(farmer, forecast):
    if farmer.get("soil_moisture") is not None:
        return float(farmer["soil_moisture"]), "farmer"
    model = current_model_soil_moisture(forecast)
    return (model if model is not None else 30.0), "model"


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/options")
def options():
    return jsonify({
        "crops": [{"value": k, "label": v["label"]} for k, v in CROPS.items()],
        "soils": [{"value": k, "label": v["label"]} for k, v in SOILS.items()],
    })


@app.get("/api/profile")
def get_profile():
    farmer, err = _farmer_or_404()
    if err:
        return err
    farmer["push_devices"] = push.subscription_count(FARMER_ID)
    return jsonify(farmer)


@app.put("/api/profile")
def update_profile():
    data = request.get_json(silent=True) or {}
    errors = {}

    name = str(data.get("name", "")).strip()[:80]
    if not name:
        errors["name"] = "Name is required"
    location_name = str(data.get("location_name", "")).strip()[:120]
    if not location_name:
        errors["location_name"] = "Location is required"
    try:
        lat = float(data.get("latitude"))
        lon = float(data.get("longitude"))
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError
    except (TypeError, ValueError):
        errors["latitude"] = "Choose a valid location"
        lat = lon = None
    crop = data.get("crop_type")
    if crop not in CROPS:
        errors["crop_type"] = "Choose a crop"
    soil = data.get("soil_type")
    if soil not in SOILS:
        errors["soil_type"] = "Choose a soil type"
    try:
        size = float(data.get("farm_size_ha", 1))
        if not 0 < size <= 100000:
            raise ValueError
    except (TypeError, ValueError):
        errors["farm_size_ha"] = "Farm size must be a positive number"
        size = None
    moisture = data.get("soil_moisture")
    if moisture in ("", None):
        moisture = None
    else:
        try:
            moisture = float(moisture)
            if not 0 <= moisture <= 100:
                raise ValueError
        except (TypeError, ValueError):
            errors["soil_moisture"] = "Soil moisture must be between 0 and 100"

    if errors:
        return jsonify({"error": "Please fix the highlighted fields", "fields": errors}), 400

    with db() as conn:
        conn.execute(
            """UPDATE farmers SET name = ?, phone = ?, location_name = ?, latitude = ?, longitude = ?,
               crop_type = ?, soil_type = ?, farm_size_ha = ?, soil_moisture = ?, updated_at = datetime('now')
               WHERE id = ?""",
            (name, str(data.get("phone", "")).strip()[:30], location_name, lat, lon,
             crop, soil, size, moisture, FARMER_ID),
        )
    return get_profile()


@app.get("/api/geocode")
def search_location():
    query = request.args.get("q", "").strip()
    if len(query) < 2:
        return jsonify([])
    try:
        return jsonify(geocode(query[:100]))
    except Exception:
        return jsonify({"error": "Location search is unavailable right now"}), 503


@app.get("/api/rainfall")
def rainfall():
    farmer, err = _farmer_or_404()
    if err:
        return err
    forecast = get_forecast(farmer["latitude"], farmer["longitude"])
    return jsonify({
        **_meta(forecast, farmer),
        "summary": rainfall_summary(forecast),
        "days": forecast["forecast_days"],
    })


@app.get("/api/irrigation")
def irrigation():
    farmer, err = _farmer_or_404()
    if err:
        return err
    forecast = get_forecast(farmer["latitude"], farmer["longitude"])

    crop = request.args.get("crop", farmer["crop_type"])
    soil = request.args.get("soil", farmer["soil_type"])
    moisture_source = "farmer"
    try:
        moisture = float(request.args["moisture"])
        moisture = max(0.0, min(100.0, moisture))
    except (KeyError, ValueError):
        moisture, moisture_source = _soil_moisture(farmer, forecast)

    advice = irrigation_advice(forecast, crop, moisture, soil, farmer["farm_size_ha"])

    if request.args.get("save") == "1":
        with db() as conn:
            conn.execute(
                "INSERT INTO irrigation_checks (farmer_id, crop_type, soil_moisture, decision, water_mm, is_demo) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (FARMER_ID, crop, moisture, advice["decision"], advice["water_mm"], int(forecast["is_demo"])),
            )

    return jsonify({
        **_meta(forecast, farmer),
        "advice": advice,
        "moisture_source": moisture_source,
        "model_soil_moisture": current_model_soil_moisture(forecast),
    })


@app.get("/api/irrigation/history")
def irrigation_history():
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM irrigation_checks WHERE farmer_id = ? ORDER BY id DESC LIMIT 10", (FARMER_ID,)
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/drought")
def drought():
    farmer, err = _farmer_or_404()
    if err:
        return err
    forecast = get_forecast(farmer["latitude"], farmer["longitude"])
    moisture = farmer["soil_moisture"]
    return jsonify({**_meta(forecast, farmer), **drought_assessment(forecast, moisture)})


@app.get("/api/alerts")
def alerts():
    farmer, err = _farmer_or_404()
    if err:
        return err
    forecast = get_forecast(farmer["latitude"], farmer["longitude"])
    with db() as conn:
        history = conn.execute(
            "SELECT * FROM alerts WHERE farmer_id = ? ORDER BY created_at DESC LIMIT 20", (FARMER_ID,)
        ).fetchall()
    return jsonify({
        **_meta(forecast, farmer),
        "upcoming": [h for h in detect_hazards(forecast, 48) if h["lead_hours"] > -1],
        "history": [dict(r) for r in history],
        "push_devices": push.subscription_count(FARMER_ID),
        "check_interval_minutes": scheduler.CHECK_INTERVAL_MINUTES,
    })


@app.post("/api/alerts/check")
def alerts_check_now():
    results = scheduler.run_check()
    return jsonify({"sent": results.get(FARMER_ID, [])})


@app.get("/api/dashboard")
def dashboard():
    farmer, err = _farmer_or_404()
    if err:
        return err
    forecast = get_forecast(farmer["latitude"], farmer["longitude"])
    moisture, moisture_source = _soil_moisture(farmer, forecast)
    advice = irrigation_advice(forecast, farmer["crop_type"], moisture, farmer["soil_type"], farmer["farm_size_ha"])
    risk = drought_assessment(forecast, farmer["soil_moisture"])
    return jsonify({
        **_meta(forecast, farmer),
        "farmer": {"name": farmer["name"], "crop": CROPS[farmer["crop_type"]]["label"]},
        "current": forecast["current"],
        "today": forecast["forecast_days"][0] if forecast["forecast_days"] else None,
        "days": forecast["forecast_days"],
        "rainfall": rainfall_summary(forecast),
        "irrigation": {**advice, "moisture_source": moisture_source},
        "drought": {k: risk[k] for k in ("level", "score", "max_score", "dry_days", "rain_30d_mm")},
        "hazards": detect_hazards(forecast, 48),
    })


@app.get("/api/push/public-key")
def push_public_key():
    return jsonify({"publicKey": push.public_key()})


@app.post("/api/push/subscribe")
def push_subscribe():
    try:
        push.save_subscription(FARMER_ID, request.get_json(silent=True) or {})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"ok": True, "devices": push.subscription_count(FARMER_ID)})


@app.post("/api/push/unsubscribe")
def push_unsubscribe():
    endpoint = (request.get_json(silent=True) or {}).get("endpoint")
    if endpoint:
        push.delete_subscription(endpoint)
    return jsonify({"ok": True, "devices": push.subscription_count(FARMER_ID)})


@app.post("/api/push/test")
def push_test():
    delivered = push.send_to_farmer(
        FARMER_ID,
        "AgriClimate AI test alert",
        "Notifications are working. You will be alerted about 2–3 hours before severe weather.",
        tag="test",
    )
    if delivered == 0:
        return jsonify({"error": "No subscribed devices. Enable notifications first."}), 400
    return jsonify({"ok": True, "delivered": delivered})


DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")


@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def frontend(path):
    """In production, serve the built React app (run `npm run build` first)."""
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    if not os.path.isdir(DIST_DIR):
        return jsonify({"message": "AgriClimate AI API is running. Start the React app with `npm run dev`."})
    file_path = os.path.join(DIST_DIR, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


init_db()
push.public_key()  # create VAPID keys on first run
if os.environ.get("DISABLE_SCHEDULER") != "1":
    scheduler.start()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False, threaded=True)
