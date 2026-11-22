"""Background job that watches hourly forecasts and pushes alerts ~2-3 hours before hazards."""
import os
import threading
import time
from datetime import datetime

from database import db
from logic import detect_hazards
from push import send_to_farmer
from weather import get_forecast

CHECK_INTERVAL_MINUTES = float(os.environ.get("ALERT_CHECK_MINUTES", "15"))
# Notify when a hazard starts between 0.5 and 3 hours from now. With a 15-minute
# check interval, most alerts go out roughly 2.75-3 hours before the event.
NOTIFY_MIN_LEAD_HOURS = 0.5
NOTIFY_MAX_LEAD_HOURS = 3.0

_started = False


def _format_time(iso):
    return datetime.fromisoformat(iso).strftime("%I:%M %p").lstrip("0")


def check_farmer(farmer):
    """Check one farmer's location. Returns the list of newly sent alerts."""
    forecast = get_forecast(farmer["latitude"], farmer["longitude"])
    if forecast["is_demo"]:
        # Never send real notifications based on synthetic data.
        return []

    sent = []
    for hazard in detect_hazards(forecast, hours_ahead=6):
        if not (NOTIFY_MIN_LEAD_HOURS <= hazard["lead_hours"] <= NOTIFY_MAX_LEAD_HOURS):
            continue
        key = f"{farmer['id']}:{hazard['type']}:{hazard['start']}"
        lead = hazard["lead_hours"]
        body = (f"Expected around {_format_time(hazard['start'])} (in about {lead:g} hours) at "
                f"{farmer['location_name']}. {hazard['message']}")
        with db() as conn:
            cur = conn.execute(
                "INSERT OR IGNORE INTO alerts (farmer_id, alert_type, severity, title, message, event_time, dedupe_key) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (farmer["id"], hazard["type"], hazard["severity"], hazard["title"], body, hazard["start"], key),
            )
            is_new = cur.rowcount == 1
        if not is_new:
            continue
        delivered = send_to_farmer(farmer["id"], f"⚠ {hazard['title']}", body, tag=key)
        with db() as conn:
            conn.execute("UPDATE alerts SET sent_count = ? WHERE dedupe_key = ?", (delivered, key))
        sent.append({**hazard, "delivered": delivered})
    return sent


def run_check():
    with db() as conn:
        farmers = [dict(r) for r in conn.execute("SELECT * FROM farmers").fetchall()]
    results = {}
    for farmer in farmers:
        try:
            results[farmer["id"]] = check_farmer(farmer)
        except Exception as exc:
            print(f"[scheduler] Check failed for farmer {farmer['id']}: {exc}")
    return results


def _loop():
    while True:
        run_check()
        time.sleep(CHECK_INTERVAL_MINUTES * 60)


def start():
    global _started
    if _started:
        return
    _started = True
    threading.Thread(target=_loop, name="alert-scheduler", daemon=True).start()
    print(f"[scheduler] Weather alert checks every {CHECK_INTERVAL_MINUTES:g} minutes")
