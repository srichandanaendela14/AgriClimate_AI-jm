"""Web Push (VAPID) key management and notification delivery."""
import base64
import json
import os

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid01
from pywebpush import WebPushException, webpush

from database import INSTANCE_DIR, db

KEY_FILE = os.path.join(INSTANCE_DIR, "vapid_private.pem")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@agriclimate.local")

_vapid = None


def _load_vapid():
    """Load VAPID keys from env (VAPID_PRIVATE_KEY_FILE) or create them once in backend/instance/."""
    global _vapid
    if _vapid:
        return _vapid
    key_file = os.environ.get("VAPID_PRIVATE_KEY_FILE", KEY_FILE)
    if os.path.exists(key_file):
        _vapid = Vapid01.from_file(key_file)
    else:
        os.makedirs(os.path.dirname(key_file), exist_ok=True)
        _vapid = Vapid01()
        _vapid.generate_keys()
        _vapid.save_key(key_file)
        os.chmod(key_file, 0o600)
        print(f"[push] Generated new VAPID key at {key_file}")
    return _vapid


def public_key():
    raw = _load_vapid().public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def save_subscription(farmer_id, subscription):
    keys = subscription.get("keys", {})
    endpoint = subscription.get("endpoint")
    if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
        raise ValueError("Invalid push subscription")
    with db() as conn:
        conn.execute(
            "INSERT INTO push_subscriptions (farmer_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(endpoint) DO UPDATE SET farmer_id = excluded.farmer_id, "
            "p256dh = excluded.p256dh, auth = excluded.auth",
            (farmer_id, endpoint, keys["p256dh"], keys["auth"]),
        )


def delete_subscription(endpoint):
    with db() as conn:
        conn.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))


def subscription_count(farmer_id):
    with db() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM push_subscriptions WHERE farmer_id = ?", (farmer_id,)
        ).fetchone()[0]


def send_to_farmer(farmer_id, title, body, url="/alerts", tag=None):
    """Send a notification to every device the farmer subscribed. Returns number delivered."""
    with db() as conn:
        subs = conn.execute(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE farmer_id = ?", (farmer_id,)
        ).fetchall()

    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag or title})
    delivered = 0
    for sub in subs:
        info = {"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}}
        try:
            webpush(
                subscription_info=info,
                data=payload,
                vapid_private_key=_load_vapid(),
                vapid_claims={"sub": VAPID_SUBJECT},
                ttl=3 * 3600,
            )
            delivered += 1
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):
                delete_subscription(sub["endpoint"])
                print("[push] Removed expired subscription")
            else:
                print(f"[push] Delivery failed: {exc}")
    return delivered
