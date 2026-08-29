#!/usr/bin/env python3
"""One-way import of the World-Travel JSON atlas into TREK."""

import argparse
import json
import re
import sqlite3
import unicodedata
from calendar import monthrange
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


# User-confirmed correction for a source trip whose original record had no date.
DATE_OVERRIDES = {
    "midwest-road-trip": ("2026-08-15", "2026-08-16", "day", "Aug 15 – Aug 16, 2026"),
}

COUNTRY_CODES = {
    "Canada": "CA", "Egypt": "EG", "England": "GB", "France": "FR",
    "Italy": "IT", "Jordan": "JO", "Mexico": "MX", "Netherlands": "NL",
    "Spain": "ES", "Turkey": "TR", "United States of America": "US",
}
STATE_CODES = {
    "Illinois": "US-IL", "Iowa": "US-IA", "Wisconsin": "US-WI",
}


def json_file(path: Path):
    return json.loads(path.read_text())


def bounds(start, end, precision):
    if not start or not end:
        return None, None
    if precision == "day":
        return start, end
    start_parts = start[:7].split("-")
    end_parts = end[:7].split("-")
    start_year, start_month = int(start_parts[0]), int(start_parts[1]) if len(start_parts) > 1 else 1
    end_year, end_month = int(end_parts[0]), int(end_parts[1]) if len(end_parts) > 1 else 12
    return (
        f"{start_year:04d}-{start_month:02d}-01",
        f"{end_year:04d}-{end_month:02d}-{monthrange(end_year, end_month)[1]:02d}",
    )


def ensure_schema(db):
    for statement in (
        "ALTER TABLE trips ADD COLUMN source_id TEXT",
        "ALTER TABLE trips ADD COLUMN date_precision TEXT NOT NULL DEFAULT 'day'",
        "ALTER TABLE trips ADD COLUMN date_label TEXT",
        "ALTER TABLE places ADD COLUMN source_id TEXT",
    ):
        try:
            db.execute(statement)
        except sqlite3.OperationalError as error:
            if "duplicate column name" not in str(error):
                raise
    db.executescript("""
      CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_source_id ON trips(user_id, source_id) WHERE source_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_places_source_id ON places(trip_id, source_id) WHERE source_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS atlas_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, source_id TEXT NOT NULL,
        city TEXT, country TEXT NOT NULL, map_country TEXT, continent TEXT, map_state TEXT,
        lat REAL, lng REAL, status TEXT NOT NULL DEFAULT 'visited', date_start TEXT, date_end TEXT,
        date_precision TEXT, date_label TEXT, first_visited TEXT, notes TEXT,
        links_json TEXT NOT NULL DEFAULT '{}', UNIQUE(user_id, source_id)
      );
      CREATE TABLE IF NOT EXISTS atlas_wonders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
        country TEXT, map_country TEXT, region TEXT, significance TEXT NOT NULL DEFAULT 'notable',
        lat REAL, lng REAL, source_url TEXT, image_urls_json TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS trip_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, trip_id INTEGER,
        source_id TEXT NOT NULL, provider TEXT, kind TEXT NOT NULL DEFAULT 'album', title TEXT,
        external_url TEXT, cover_url TEXT, caption TEXT, image_urls_json TEXT NOT NULL DEFAULT '[]',
        video_urls_json TEXT NOT NULL DEFAULT '[]', geotags_json TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id, source_id)
      );
      CREATE TABLE IF NOT EXISTS imported_flight_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, trip_id INTEGER NOT NULL,
        source_id TEXT NOT NULL, label TEXT NOT NULL, origin_name TEXT NOT NULL,
        destination_name TEXT NOT NULL, origin_lat REAL NOT NULL, origin_lng REAL NOT NULL,
        destination_lat REAL NOT NULL, destination_lng REAL NOT NULL,
        UNIQUE(user_id, source_id)
      );
    """)


def normalize(value):
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()).strip()


def airport_lookup():
    path = Path(__file__).resolve().parents[1] / "server/assets/airports.json"
    airports = json_file(path)
    lookup = {}
    for airport in airports:
        city = normalize(airport.get("city") or "")
        if city and airport.get("lat") is not None and airport.get("lng") is not None:
            lookup.setdefault(city, []).append(airport)
    lookup["chicago"] = [a for a in lookup.get("chicago", []) if a.get("iata") == "ORD"] or lookup.get("chicago", [])
    return lookup


def category_ids(db, owner_id):
    return {name: category_id for name, category_id in db.execute(
        "SELECT name, id FROM categories WHERE user_id IS NULL OR user_id = ?", (owner_id,)
    ).fetchall()}


def item_category(item, categories):
    kind = item.get("kind")
    subtype = item.get("subtype") or ""
    label = normalize(item.get("label") or "")
    if kind == "lodging": return categories.get("Hotel")
    if kind == "transport": return categories.get("Transport")
    if kind == "food": return categories.get("Restaurant") if subtype in {"lunch", "dinner"} else categories.get("Bar/Cafe")
    if kind == "wonder": return categories.get("Attraction")
    if kind == "activity":
        if any(word in label for word in ("walk", "corniche", "waterfront", "beach", "dead sea", "wadi rum")):
            return categories.get("Nature")
        if any(word in label for word in ("bazaar", "market", "grand bazaar")):
            return categories.get("Shopping")
        if any(word in label for word in ("museum", "mosque", "temple", "palace", "church", "cathedral", "citadel", "theater", "tower", "pyramid", "sphinx", "fortress", "basilica")):
            return categories.get("Attraction")
        return categories.get("Activity")
    return categories.get("Other")


def import_flights(db, owner_id, trip_ids, travel):
    airports = airport_lookup()
    for source_trip in travel.get("trips", []):
        last_destination = None
        trip_id = trip_ids.get(source_trip["id"])
        for item in source_trip.get("items", []):
            if item.get("subtype") != "flight" or not trip_id:
                continue
            cities = [part.strip() for part in item.get("label", "").split("→") if part.strip()]
            if len(cities) < 2:
                continue
            item_point = (item.get("lat"), item.get("lon"))
            points = []
            for index in range(len(cities) - 1):
                origin = airports.get(normalize(cities[index]), [])
                destination = airports.get(normalize(cities[index + 1]), [])
                origin_point = (origin[0]["lat"], origin[0]["lng"]) if origin else last_destination
                destination_point = (destination[0]["lat"], destination[0]["lng"]) if destination else item_point
                if origin_point and destination_point and all(v is not None for v in (*origin_point, *destination_point)):
                    points.append((cities[index], cities[index + 1], *origin_point, *destination_point))
                    last_destination = destination_point
            for index, (origin, destination, olat, olng, dlat, dlng) in enumerate(points):
                source_id = f"{item['id']}:{index}"
                db.execute("""INSERT INTO imported_flight_segments
                    (user_id,trip_id,source_id,label,origin_name,destination_name,origin_lat,origin_lng,destination_lat,destination_lng)
                    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,source_id) DO UPDATE SET
                    trip_id=excluded.trip_id,label=excluded.label,origin_name=excluded.origin_name,
                    destination_name=excluded.destination_name,origin_lat=excluded.origin_lat,origin_lng=excluded.origin_lng,
                    destination_lat=excluded.destination_lat,destination_lng=excluded.destination_lng""",
                    (owner_id, trip_id, source_id, f"{origin} → {destination}", origin, destination, olat, olng, dlat, dlng))


def import_data(db, owner_id, source_dir):
    travel = json_file(source_dir / "data/travel.json")
    wonders = json_file(source_dir / "data/wonders.json")
    visits = {visit["id"]: visit for visit in travel.get("visits", [])}
    trip_ids = {}
    categories = category_ids(db, owner_id)
    counts = {"trips": 0, "places": 0, "days": 0, "visits": 0, "media": 0, "wonders": 0}

    for source_trip in travel.get("trips", []):
        precision = source_trip.get("datePrecision") or "day"
        start, end = bounds(source_trip.get("dateStart"), source_trip.get("dateEnd"), precision)
        start, end, precision, date_label = DATE_OVERRIDES.get(
            source_trip["id"], (start, end, precision, source_trip.get("dateLabel"))
        )
        row = db.execute(
            "SELECT id FROM trips WHERE user_id = ? AND (source_id = ? OR (source_id IS NULL AND title = ?))",
            (owner_id, source_trip["id"], source_trip["title"]),
        ).fetchone()
        values = (source_trip["title"], source_trip.get("notes"), start, end, source_trip.get("budget", {}).get("currency") or "EUR", source_trip["id"], precision, date_label)
        if row:
            trip_id = row[0]
            db.execute("UPDATE trips SET title=?,description=?,start_date=?,end_date=?,currency=?,source_id=?,date_precision=?,date_label=? WHERE id=?", (*values, trip_id))
        else:
            trip_id = db.execute("INSERT INTO trips (user_id,title,description,start_date,end_date,currency,source_id,date_precision,date_label) VALUES (?,?,?,?,?,?,?,?,?)", (owner_id, *values)).lastrowid
            counts["trips"] += 1
        trip_ids[source_trip["id"]] = trip_id

        day_ids = {}
        for day_number, source_day in enumerate(source_trip.get("days", []), 1):
            day_date = source_day.get("date") or None
            existing = db.execute("SELECT id FROM days WHERE trip_id=? AND day_number=?", (trip_id, day_number)).fetchone()
            if existing:
                day_id = existing[0]
                db.execute("UPDATE days SET date=?,title=?,notes=? WHERE id=?", (day_date, source_day.get("title"), source_day.get("notes"), day_id))
            else:
                day_id = db.execute("INSERT INTO days (trip_id,day_number,date,title,notes) VALUES (?,?,?,?,?)", (trip_id, day_number, day_date, source_day.get("title"), source_day.get("notes"))).lastrowid
                counts["days"] += 1
            day_ids[source_day["id"]] = day_id

        item_day = {item_id: day_id for source_day in source_trip.get("days", []) for item_id in source_day.get("itemIds", []) for day_id in [day_ids.get(source_day["id"])]}
        for item in source_trip.get("items", []):
            source_id = item["id"]
            row = db.execute("SELECT id FROM places WHERE trip_id=? AND source_id=?", (trip_id, source_id)).fetchone()
            notes = item.get("notes") or ""
            if item.get("kind"):
                notes = f"[{item['kind']}]" + (f" {notes}" if notes else "")
            place_values = (item.get("label") or "Untitled stop", notes, item.get("lat"), item.get("lon"), source_id, item.get("subtype") or "walking", item_category(item, categories))
            if row:
                place_id = row[0]
                db.execute("UPDATE places SET name=?,notes=?,lat=?,lng=?,source_id=?,transport_mode=?,category_id=? WHERE id=?", (*place_values, place_id))
            else:
                place_id = db.execute("INSERT INTO places (trip_id,name,notes,lat,lng,source_id,transport_mode,category_id) VALUES (?,?,?,?,?,?,?,?)", (trip_id, *place_values)).lastrowid
                counts["places"] += 1
            day_id = item_day.get(source_id)
            if day_id and not db.execute("SELECT 1 FROM day_assignments WHERE day_id=? AND place_id=?", (day_id, place_id)).fetchone():
                db.execute("INSERT INTO day_assignments (day_id,place_id,order_index,notes) VALUES (?,?,?,?)", (day_id, place_id, 0, item.get("timeBlock") or None))

        for visit_id in source_trip.get("placeIds", []):
            visit = visits.get(visit_id)
            if not visit or not visit.get("city"):
                continue
            row = db.execute("SELECT id FROM places WHERE trip_id=? AND source_id=?", (trip_id, visit_id)).fetchone()
            if row:
                db.execute("UPDATE places SET category_id=? WHERE id=?", (categories.get("Attraction"), row[0]))
            else:
                db.execute("INSERT INTO places (trip_id,name,description,lat,lng,address,source_id,category_id) VALUES (?,?,?,?,?,?,?,?)", (trip_id, visit["city"], visit.get("notes"), visit.get("lat"), visit.get("lon"), ", ".join(filter(None, [visit.get("city"), visit.get("country")])), visit_id, categories.get("Attraction")))
                counts["places"] += 1

    for visit in travel.get("visits", []):
        precision = visit.get("datePrecision") or "day"
        start, end = bounds(visit.get("dateStart"), visit.get("dateEnd"), precision)
        db.execute("""INSERT INTO atlas_visits (user_id,source_id,city,country,map_country,continent,map_state,lat,lng,status,date_start,date_end,date_precision,date_label,first_visited,notes,links_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,source_id) DO UPDATE SET city=excluded.city,country=excluded.country,map_country=excluded.map_country,continent=excluded.continent,map_state=excluded.map_state,lat=excluded.lat,lng=excluded.lng,status=excluded.status,date_start=excluded.date_start,date_end=excluded.date_end,date_precision=excluded.date_precision,date_label=excluded.date_label,first_visited=excluded.first_visited,notes=excluded.notes,links_json=excluded.links_json""", (owner_id, visit["id"], visit.get("city"), visit["country"], visit.get("mapCountry"), visit.get("continent"), visit.get("mapState"), visit.get("lat"), visit.get("lon"), visit.get("status") or "visited", start, end, precision, visit.get("dateLabel"), visit.get("firstVisited"), visit.get("notes"), json.dumps(visit.get("links") or {})))
        if visit.get("status") not in {"planned", "wishlist"} and visit.get("country") in COUNTRY_CODES:
            db.execute("INSERT OR IGNORE INTO visited_countries (user_id,country_code) VALUES (?,?)", (owner_id, COUNTRY_CODES[visit["country"]]))
        if visit.get("mapState") in STATE_CODES:
            db.execute("INSERT OR IGNORE INTO visited_regions (user_id,region_code,region_name,country_code) VALUES (?,?,?,?)", (owner_id, STATE_CODES[visit["mapState"]], visit["mapState"], "US"))
        counts["visits"] += 1

    for wonder in wonders.get("sites", []):
        db.execute("""INSERT INTO atlas_wonders (source_id,label,country,map_country,region,significance,lat,lng,source_url,image_urls_json)
          VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET label=excluded.label,country=excluded.country,map_country=excluded.map_country,region=excluded.region,significance=excluded.significance,lat=excluded.lat,lng=excluded.lng,source_url=excluded.source_url,image_urls_json=excluded.image_urls_json""", (wonder["id"], wonder["label"], wonder.get("country"), wonder.get("mapCountry"), wonder.get("region"), wonder.get("significance") or "notable", wonder.get("lat"), wonder.get("lon"), wonder.get("sourceUrl"), json.dumps(wonder.get("imageUrls") or [])))
        counts["wonders"] += 1

    for media in travel.get("media", []):
        trip_id = next((trip_ids[t["id"]] for t in travel["trips"] if media["id"] in t.get("mediaIds", []) and t["id"] in trip_ids), None)
        media_urls = [media.get("url"), media.get("coverUrl"), *(media.get("imageUrls") or [])]
        if any(urlparse(url).hostname == "example.com" for url in media_urls if url):
            # The source uses example.com for a placeholder image. Do not copy
            # fake stock media into TREK, and remove it if an earlier import did.
            db.execute("DELETE FROM trip_media WHERE user_id=? AND source_id=?", (owner_id, media["id"]))
            continue
        db.execute("""INSERT INTO trip_media (user_id,trip_id,source_id,provider,kind,title,external_url,cover_url,caption,image_urls_json,video_urls_json,geotags_json,sort_order)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,source_id) DO UPDATE SET trip_id=excluded.trip_id,provider=excluded.provider,kind=excluded.kind,title=excluded.title,external_url=excluded.external_url,cover_url=excluded.cover_url,caption=excluded.caption,image_urls_json=excluded.image_urls_json,video_urls_json=excluded.video_urls_json,geotags_json=excluded.geotags_json,sort_order=excluded.sort_order""", (owner_id, trip_id, media["id"], media.get("provider"), media.get("kind") or "album", media.get("title"), media.get("url"), media.get("coverUrl"), media.get("caption"), json.dumps(media.get("imageUrls") or []), json.dumps(media.get("videoUrls") or []), json.dumps(media.get("geotags") or []), media.get("sortOrder") or 0))
        counts["media"] += 1
    import_flights(db, owner_id, trip_ids, travel)
    return counts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="data/travel.db", type=Path)
    parser.add_argument("--source", default="../World-Travel", type=Path)
    parser.add_argument("--email", default="local.user@trek.test")
    args = parser.parse_args()
    db = sqlite3.connect(args.db, timeout=30)
    owner = db.execute("SELECT id FROM users WHERE email=?", (args.email,)).fetchone()
    if not owner:
        raise SystemExit(f"No TREK user found for {args.email}")
    ensure_schema(db)
    with db:
        print(json.dumps(import_data(db, owner[0], args.source), sort_keys=True))


if __name__ == "__main__":
    main()
