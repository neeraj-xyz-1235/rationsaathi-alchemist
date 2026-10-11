"""GET /api/shops/nearby: ration / fair-price shops near a point, from OpenStreetMap (Overpass).

OSM coverage of ration shops is patchy, so an empty list means "none mapped", not "none exist",
and the response says where the data came from. Nothing is invented. The exact coordinates are
never stored or logged; the third-party query only gets the point rounded to ~1 km."""
import logging
import math
import re
import time
from typing import Annotated

import httpx
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from app.auth import rate_limit as rl
from app.auth.deps import current_user
from app.db import mapping
from app.db import models as m
from app.db.session import get_db
from app.schemas import SavedShopIn, ShopsResponse
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api")
log = logging.getLogger("rationsaathi.shops")

# Public Overpass servers are often busy, so try a few in turn.
OVERPASS_URLS = ("https://overpass-api.de/api/interpreter",
                 "https://overpass.private.coffee/api/interpreter",
                 "https://maps.mail.ru/osm/tools/overpass/api/interpreter")
# Names that mean a ration / fair-price shop. "ration" must be a whole word, otherwise it matches
# Corporation, Administration, Federation... (no case-insensitive flag: it makes Overpass scan more).
# Cheap substring pattern for the server (anchors and word boundaries make Overpass time out);
# the strict whole-word rule below then removes Corporation, Administration, Federation...
NAME_PATTERN = "ration|Ration|RATION|Fair|FAIR|FPS|रेशन|राशन|स्वस्त|सस्ता गल्ला|उचित मूल्य"
# the strict rule: "ration" must be a whole word
_NAME_OK = re.compile(r"(?<![A-Za-z])(ration|fair\s+price|fps)(?![A-Za-z])|रेशन|राशन|स्वस्त धान्य|"
                      r"सस्ता गल्ला|उचित मूल्य", re.IGNORECASE)
CACHE_TTL_S = 600
_cache: dict[tuple, tuple[float, list]] = {}


def _client() -> httpx.Client:        # a seam for tests
    return httpx.Client(timeout=httpx.Timeout(20.0),
                        headers={"User-Agent": "RationSaathi/1.0 (hackathon project)"})


def _km(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 6371 * 2 * math.asin(math.sqrt(a))


def _address(tags: dict) -> str | None:
    parts = [tags.get(k) for k in ("addr:housenumber", "addr:street", "addr:suburb",
                                   "addr:city", "addr:postcode")]
    text = ", ".join(p for p in parts if p)
    return text or tags.get("addr:full") or None


def _fetch(lat: float, lon: float, radius_km: float) -> list[dict]:
    clat, clon = round(lat, 2), round(lon, 2)
    key = (clat, clon, radius_km)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
        return hit[1]
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(0.2, math.cos(math.radians(clat))))
    bbox = f"{clat - dlat:.4f},{clon - dlon:.4f},{clat + dlat:.4f},{clon + dlon:.4f}"
    query = f'[out:json][timeout:15];nwr["name"~"{NAME_PATTERN}"]({bbox});out center 80;'
    last: Exception | None = None
    resp = None
    with _client() as client:
        for url in OVERPASS_URLS:
            try:
                resp = client.post(url, data={"data": query})
                resp.raise_for_status()
                break
            except httpx.HTTPError as e:      # busy or down: try the next server
                last, resp = e, None
    if resp is None:
        raise last or httpx.HTTPError("no overpass server answered")
    shops = []
    for el in resp.json().get("elements", []):
        tags = el.get("tags") or {}
        s_lat = el.get("lat") or (el.get("center") or {}).get("lat")
        s_lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if s_lat is None or s_lon is None or not tags.get("name"):
            continue
        if not _NAME_OK.search(tags["name"]):
            continue
        shops.append({"id": f'{el["type"]}/{el["id"]}', "name": tags["name"][:120],
                      "lat": s_lat, "lon": s_lon, "address": _address(tags),
                      "phone": tags.get("phone") or tags.get("contact:phone"),
                      "opening_hours": tags.get("opening_hours"), "source": "OpenStreetMap"})
    if len(_cache) > 200:
        _cache.clear()
    _cache[key] = (time.monotonic(), shops)
    return shops


def _limit(request: Request) -> None:
    wait = rl.shops_ip_limiter.hit(rl.client_ip(request))
    if wait:
        raise rl.too_many(wait)


@router.get("/shops/nearby", response_model=ShopsResponse, dependencies=[Depends(_limit)])
def nearby(lat: Annotated[float, Query(ge=-90, le=90)],
           lon: Annotated[float, Query(ge=-180, le=180)],
           radius_km: Annotated[float, Query(ge=1, le=25)] = 5):
    try:
        found = _fetch(lat, lon, radius_km)
    except (httpx.HTTPError, ValueError) as e:
        log.warning("shop lookup failed (%s)", type(e).__name__)
        return {"status": "unavailable", "shops": [], "message_code": "SHOPS_LOOKUP_FAILED"}
    shops = []
    for s in found:
        d = _km(lat, lon, s["lat"], s["lon"])
        if d <= radius_km:
            shops.append({**s, "distance_km": round(d, 2)})
    shops.sort(key=lambda s: s["distance_km"])
    shops = shops[:40]
    return {"status": "ok" if shops else "empty", "shops": shops,
            "message_code": "SHOPS_FROM_OSM" if shops else "SHOPS_NONE_MAPPED"}


# ── shops the user pinned themselves ─────────────────────

MAX_SAVED = 50


def _saved_out(s: m.SavedShop) -> dict:
    return {"id": str(s.id), "name": s.name, "lat": s.lat, "lon": s.lon, "address": s.address,
            "phone": s.phone, "source": "You"}


@router.get("/shops/saved")
def list_saved(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(m.SavedShop).filter_by(user_id=user.id).order_by(
        m.SavedShop.created_at, m.SavedShop.id).all()
    return {"shops": [_saved_out(s) for s in rows]}


@router.post("/shops/saved", status_code=201)
def save_shop(body: SavedShopIn, user: m.User = Depends(current_user),
              db: Session = Depends(get_db)):
    if db.query(m.SavedShop).filter_by(user_id=user.id).count() >= MAX_SAVED:
        raise HTTPException(409, "TOO_MANY_SAVED_SHOPS")
    shop = m.SavedShop(id=uuid.uuid4(), user_id=user.id, **body.model_dump())
    db.add(shop)
    db.commit()
    return {"shop": _saved_out(shop)}


@router.delete("/shops/saved/{shop_id}", status_code=204)
def delete_saved(shop_id: str, user: m.User = Depends(current_user),
                 db: Session = Depends(get_db)):
    sid = mapping.parse_id(shop_id)
    shop = db.get(m.SavedShop, sid) if sid else None
    if shop is None or shop.user_id != user.id:
        raise HTTPException(404, "NOT_FOUND")
    db.delete(shop)
    db.commit()
    return Response(status_code=204)
