"""SQLite database setup and small helper functions."""
import os
import sqlite3
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(INSTANCE_DIR, "agriclimate.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS farmers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    phone         TEXT,
    location_name TEXT NOT NULL,
    latitude      REAL NOT NULL,
    longitude     REAL NOT NULL,
    crop_type     TEXT NOT NULL DEFAULT 'maize',
    soil_type     TEXT NOT NULL DEFAULT 'loam',
    farm_size_ha  REAL NOT NULL DEFAULT 1.0,
    soil_moisture REAL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id  INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id   INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    alert_type  TEXT NOT NULL,
    severity    TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    event_time  TEXT NOT NULL,
    dedupe_key  TEXT NOT NULL UNIQUE,
    sent_count  INTEGER NOT NULL DEFAULT 0,
    is_demo     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS irrigation_checks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id      INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    crop_type      TEXT NOT NULL,
    soil_moisture  REAL NOT NULL,
    decision       TEXT NOT NULL,
    water_mm       REAL NOT NULL,
    is_demo        INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weather_cache (
    cache_key  TEXT PRIMARY KEY,
    payload    TEXT NOT NULL,
    fetched_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

DEFAULT_FARMER = {
    "name": "Demo Farmer",
    "phone": "",
    "location_name": "Pune, Maharashtra, India",
    "latitude": 18.5204,
    "longitude": 73.8567,
    "crop_type": "maize",
    "soil_type": "loam",
    "farm_size_ha": 1.0,
    "soil_moisture": 35.0,
}


def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with db() as conn:
        conn.executescript(SCHEMA)
        if conn.execute("SELECT COUNT(*) FROM farmers").fetchone()[0] == 0:
            conn.execute(
                """INSERT INTO farmers (name, phone, location_name, latitude, longitude,
                   crop_type, soil_type, farm_size_ha, soil_moisture)
                   VALUES (:name, :phone, :location_name, :latitude, :longitude,
                   :crop_type, :soil_type, :farm_size_ha, :soil_moisture)""",
                DEFAULT_FARMER,
            )


def row_to_dict(row):
    return dict(row) if row else None


def get_farmer(farmer_id=1):
    with db() as conn:
        return row_to_dict(conn.execute("SELECT * FROM farmers WHERE id = ?", (farmer_id,)).fetchone())


def get_setting(key):
    with db() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None


def set_setting(key, value):
    with db() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
