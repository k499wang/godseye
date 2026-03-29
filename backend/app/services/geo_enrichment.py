from __future__ import annotations

import json
import re
from typing import Any

from app.core.llm_client import MODEL_GEMINI_FLASH, llm_client

_SAFE_LAT_MIN = -60.0
_SAFE_LAT_MAX = 60.0
_GEMINI_BATCH_SIZE = 20

_LEAGUE_TAGS: dict[str, tuple[str, ...]] = {
    "nba": ("nba", "basketball", "pro-basketball"),
    "nfl": ("nfl", "football", "nfl-football"),
    "nhl": ("nhl", "hockey", "ice-hockey"),
    "mlb": ("mlb", "baseball"),
    "ncaa": (
        "ncaa",
        "ncaa-basketball",
        "college-basketball",
        "march-madness",
        "mens-college-basketball",
        "womens-college-basketball",
    ),
}

_TEAM_NAME_SPLIT_RE = re.compile(
    r"\s+(?:vs\.?|v\.?|versus|at|@)\s+",
    flags=re.IGNORECASE,
)


def _build_team_aliases(
    entries: list[tuple[str, float, float, list[str]]],
) -> dict[str, tuple[float, float, str]]:
    aliases: dict[str, tuple[float, float, str]] = {}

    def normalize(value: str) -> str:
        value = value.lower().replace("&", "and")
        value = re.sub(r"[^\w\s]", " ", value)
        return re.sub(r"\s+", " ", value).strip()

    for canonical_name, lat, lng, raw_aliases in entries:
        names = {normalize(canonical_name), *{normalize(alias) for alias in raw_aliases}}
        for name in names:
            aliases[name] = (lat, lng, canonical_name)
    return aliases


_SPORTS_TEAM_COORDS: dict[str, dict[str, tuple[float, float, str]]] = {
    "nba": _build_team_aliases([
        ("Atlanta Hawks", 33.7573, -84.3963, ["hawks", "atlanta", "atlanta hawks"]),
        ("Boston Celtics", 42.3662, -71.0621, ["celtics", "boston", "boston celtics"]),
        ("Brooklyn Nets", 40.6826, -73.9754, ["nets", "brooklyn", "brooklyn nets"]),
        ("Charlotte Hornets", 35.2251, -80.8392, ["hornets", "charlotte", "charlotte hornets"]),
        ("Chicago Bulls", 41.8807, -87.6742, ["bulls", "chicago", "chicago bulls"]),
        ("Cleveland Cavaliers", 41.4965, -81.6882, ["cavaliers", "cavs", "cleveland", "cleveland cavaliers"]),
        ("Dallas Mavericks", 32.7905, -96.8103, ["mavericks", "mavs", "dallas", "dallas mavericks"]),
        ("Denver Nuggets", 39.7487, -105.0077, ["nuggets", "denver", "denver nuggets"]),
        ("Detroit Pistons", 42.3410, -83.0550, ["pistons", "detroit", "detroit pistons"]),
        ("Golden State Warriors", 37.7680, -122.3877, ["warriors", "golden state", "golden state warriors"]),
        ("Houston Rockets", 29.7508, -95.3621, ["rockets", "houston", "houston rockets"]),
        ("Indiana Pacers", 39.7639, -86.1555, ["pacers", "indiana", "indiana pacers"]),
        ("LA Clippers", 34.0430, -118.2673, ["clippers", "la clippers", "los angeles clippers"]),
        ("Los Angeles Lakers", 34.0430, -118.2673, ["lakers", "la lakers", "los angeles lakers"]),
        ("Memphis Grizzlies", 35.1382, -90.0506, ["grizzlies", "memphis", "memphis grizzlies"]),
        ("Miami Heat", 25.7814, -80.1870, ["heat", "miami", "miami heat"]),
        ("Milwaukee Bucks", 43.0451, -87.9172, ["bucks", "milwaukee", "milwaukee bucks"]),
        ("Minnesota Timberwolves", 44.9795, -93.2760, ["timberwolves", "wolves", "minnesota", "minnesota timberwolves"]),
        ("New Orleans Pelicans", 29.9490, -90.0821, ["pelicans", "new orleans", "new orleans pelicans"]),
        ("New York Knicks", 40.7505, -73.9934, ["knicks", "new york", "new york knicks"]),
        ("Oklahoma City Thunder", 35.4634, -97.5151, ["thunder", "oklahoma city", "oklahoma city thunder", "okc"]),
        ("Orlando Magic", 28.5392, -81.3839, ["magic", "orlando", "orlando magic"]),
        ("Philadelphia 76ers", 39.9012, -75.1720, ["76ers", "sixers", "philadelphia", "philadelphia 76ers"]),
        ("Phoenix Suns", 33.4457, -112.0712, ["suns", "phoenix", "phoenix suns"]),
        ("Portland Trail Blazers", 45.5316, -122.6668, ["trail blazers", "blazers", "portland", "portland trail blazers"]),
        ("Sacramento Kings", 38.5802, -121.4996, ["kings", "sacramento", "sacramento kings"]),
        ("San Antonio Spurs", 29.4270, -98.4375, ["spurs", "san antonio", "san antonio spurs"]),
        ("Toronto Raptors", 43.6435, -79.3791, ["raptors", "toronto", "toronto raptors"]),
        ("Utah Jazz", 40.7683, -111.9011, ["jazz", "utah", "utah jazz"]),
        ("Washington Wizards", 38.8981, -77.0209, ["wizards", "washington", "washington wizards"]),
    ]),
    "nfl": _build_team_aliases([
        ("Arizona Cardinals", 33.5276, -112.2626, ["cardinals", "arizona", "arizona cardinals"]),
        ("Atlanta Falcons", 33.7554, -84.4008, ["falcons", "atlanta", "atlanta falcons"]),
        ("Baltimore Ravens", 39.2780, -76.6227, ["ravens", "baltimore", "baltimore ravens"]),
        ("Buffalo Bills", 42.7738, -78.7868, ["bills", "buffalo", "buffalo bills"]),
        ("Carolina Panthers", 35.2258, -80.8528, ["panthers", "carolina", "carolina panthers"]),
        ("Chicago Bears", 41.8623, -87.6167, ["bears", "chicago", "chicago bears"]),
        ("Cincinnati Bengals", 39.0954, -84.5160, ["bengals", "cincinnati", "cincinnati bengals"]),
        ("Cleveland Browns", 41.5061, -81.6995, ["browns", "cleveland", "cleveland browns"]),
        ("Dallas Cowboys", 32.7473, -97.0945, ["cowboys", "dallas", "dallas cowboys"]),
        ("Denver Broncos", 39.7439, -105.0201, ["broncos", "denver", "denver broncos"]),
        ("Detroit Lions", 42.3400, -83.0456, ["lions", "detroit", "detroit lions"]),
        ("Green Bay Packers", 44.5013, -88.0622, ["packers", "green bay", "green bay packers"]),
        ("Houston Texans", 29.6847, -95.4107, ["texans", "houston", "houston texans"]),
        ("Indianapolis Colts", 39.7601, -86.1639, ["colts", "indianapolis", "indianapolis colts"]),
        ("Jacksonville Jaguars", 30.3239, -81.6373, ["jaguars", "jags", "jacksonville", "jacksonville jaguars"]),
        ("Kansas City Chiefs", 39.0490, -94.4839, ["chiefs", "kansas city", "kansas city chiefs"]),
        ("Las Vegas Raiders", 36.0908, -115.1830, ["raiders", "las vegas", "las vegas raiders"]),
        ("Los Angeles Chargers", 33.9535, -118.3392, ["chargers", "los angeles chargers", "la chargers"]),
        ("Los Angeles Rams", 33.9535, -118.3392, ["rams", "los angeles rams", "la rams"]),
        ("Miami Dolphins", 25.9580, -80.2389, ["dolphins", "miami", "miami dolphins"]),
        ("Minnesota Vikings", 44.9738, -93.2581, ["vikings", "minnesota", "minnesota vikings"]),
        ("New England Patriots", 42.0909, -71.2643, ["patriots", "new england", "new england patriots"]),
        ("New Orleans Saints", 29.9511, -90.0812, ["saints", "new orleans", "new orleans saints"]),
        ("New York Giants", 40.8135, -74.0745, ["giants", "new york giants", "ny giants"]),
        ("New York Jets", 40.8135, -74.0745, ["jets", "new york jets", "ny jets"]),
        ("Philadelphia Eagles", 39.9008, -75.1675, ["eagles", "philadelphia", "philadelphia eagles"]),
        ("Pittsburgh Steelers", 40.4468, -80.0158, ["steelers", "pittsburgh", "pittsburgh steelers"]),
        ("San Francisco 49ers", 37.4030, -121.9700, ["49ers", "niners", "san francisco", "san francisco 49ers"]),
        ("Seattle Seahawks", 47.5952, -122.3316, ["seahawks", "seattle", "seattle seahawks"]),
        ("Tampa Bay Buccaneers", 27.9759, -82.5033, ["buccaneers", "bucs", "tampa bay", "tampa bay buccaneers"]),
        ("Tennessee Titans", 36.1662, -86.7713, ["titans", "tennessee", "tennessee titans"]),
        ("Washington Commanders", 38.9078, -76.8645, ["commanders", "washington", "washington commanders"]),
    ]),
    "nhl": _build_team_aliases([
        ("Anaheim Ducks", 33.8078, -117.8765, ["ducks", "anaheim", "anaheim ducks"]),
        ("Boston Bruins", 42.3662, -71.0621, ["bruins", "boston", "boston bruins"]),
        ("Buffalo Sabres", 42.8750, -78.8766, ["sabres", "buffalo", "buffalo sabres"]),
        ("Calgary Flames", 51.0374, -114.0519, ["flames", "calgary", "calgary flames"]),
        ("Carolina Hurricanes", 35.8033, -78.7218, ["hurricanes", "canes", "carolina", "carolina hurricanes"]),
        ("Chicago Blackhawks", 41.8807, -87.6742, ["blackhawks", "hawks", "chicago", "chicago blackhawks"]),
        ("Colorado Avalanche", 39.7487, -105.0077, ["avalanche", "avs", "colorado", "colorado avalanche"]),
        ("Columbus Blue Jackets", 39.9693, -83.0060, ["blue jackets", "jackets", "columbus", "columbus blue jackets"]),
        ("Dallas Stars", 32.7905, -96.8103, ["stars", "dallas", "dallas stars"]),
        ("Detroit Red Wings", 42.3411, -83.0551, ["red wings", "wings", "detroit", "detroit red wings"]),
        ("Edmonton Oilers", 53.5461, -113.4971, ["oilers", "edmonton", "edmonton oilers"]),
        ("Florida Panthers", 26.1584, -80.3257, ["panthers", "florida", "florida panthers"]),
        ("Los Angeles Kings", 34.0430, -118.2673, ["kings", "los angeles kings", "la kings"]),
        ("Minnesota Wild", 44.9448, -93.1012, ["wild", "minnesota", "minnesota wild"]),
        ("Montreal Canadiens", 45.4960, -73.5693, ["canadiens", "habs", "montreal", "montreal canadiens"]),
        ("Nashville Predators", 36.1591, -86.7785, ["predators", "preds", "nashville", "nashville predators"]),
        ("New Jersey Devils", 40.7336, -74.1710, ["devils", "new jersey", "new jersey devils"]),
        ("New York Islanders", 40.7229, -73.5907, ["islanders", "new york islanders", "ny islanders"]),
        ("New York Rangers", 40.7505, -73.9934, ["rangers", "new york rangers", "ny rangers"]),
        ("Ottawa Senators", 45.2969, -75.9272, ["senators", "ottawa", "ottawa senators"]),
        ("Philadelphia Flyers", 39.9012, -75.1719, ["flyers", "philadelphia", "philadelphia flyers"]),
        ("Pittsburgh Penguins", 40.4395, -79.9894, ["penguins", "pens", "pittsburgh", "pittsburgh penguins"]),
        ("San Jose Sharks", 37.3328, -121.9012, ["sharks", "san jose", "san jose sharks"]),
        ("Seattle Kraken", 47.6220, -122.3540, ["kraken", "seattle", "seattle kraken"]),
        ("St. Louis Blues", 38.6268, -90.2026, ["blues", "st louis", "st. louis", "st. louis blues", "st louis blues"]),
        ("Tampa Bay Lightning", 27.9427, -82.4518, ["lightning", "tampa bay", "tampa bay lightning"]),
        ("Toronto Maple Leafs", 43.6435, -79.3791, ["maple leafs", "leafs", "toronto", "toronto maple leafs"]),
        ("Utah Hockey Club", 40.7683, -111.9011, ["utah hockey club", "utah"]),
        ("Vancouver Canucks", 49.2777, -123.1089, ["canucks", "vancouver", "vancouver canucks"]),
        ("Vegas Golden Knights", 36.1028, -115.1781, ["golden knights", "knights", "vegas", "vegas golden knights"]),
        ("Washington Capitals", 38.8981, -77.0209, ["capitals", "caps", "washington", "washington capitals"]),
        ("Winnipeg Jets", 49.8927, -97.1430, ["jets", "winnipeg", "winnipeg jets"]),
    ]),
    "mlb": _build_team_aliases([
        ("Arizona Diamondbacks", 33.4455, -112.0667, ["diamondbacks", "dbacks", "arizona", "arizona diamondbacks"]),
        ("Atlanta Braves", 33.8907, -84.4677, ["braves", "atlanta", "atlanta braves"]),
        ("Baltimore Orioles", 39.2838, -76.6217, ["orioles", "baltimore", "baltimore orioles"]),
        ("Boston Red Sox", 42.3467, -71.0972, ["red sox", "sox", "boston", "boston red sox"]),
        ("Chicago Cubs", 41.9484, -87.6553, ["cubs", "chicago cubs"]),
        ("Chicago White Sox", 41.8300, -87.6338, ["white sox", "chicago white sox"]),
        ("Cincinnati Reds", 39.0979, -84.5082, ["reds", "cincinnati", "cincinnati reds"]),
        ("Cleveland Guardians", 41.4962, -81.6852, ["guardians", "cleveland", "cleveland guardians"]),
        ("Colorado Rockies", 39.7561, -104.9942, ["rockies", "colorado", "colorado rockies"]),
        ("Detroit Tigers", 42.3390, -83.0485, ["tigers", "detroit", "detroit tigers"]),
        ("Houston Astros", 29.7573, -95.3555, ["astros", "houston", "houston astros"]),
        ("Kansas City Royals", 39.0517, -94.4803, ["royals", "kansas city", "kansas city royals"]),
        ("Los Angeles Angels", 33.8003, -117.8827, ["angels", "los angeles angels", "la angels"]),
        ("Los Angeles Dodgers", 34.0739, -118.2400, ["dodgers", "los angeles dodgers", "la dodgers"]),
        ("Miami Marlins", 25.7781, -80.2197, ["marlins", "miami", "miami marlins"]),
        ("Milwaukee Brewers", 43.0280, -87.9712, ["brewers", "milwaukee", "milwaukee brewers"]),
        ("Minnesota Twins", 44.9817, -93.2776, ["twins", "minnesota", "minnesota twins"]),
        ("New York Mets", 40.7571, -73.8458, ["mets", "new york mets", "ny mets"]),
        ("New York Yankees", 40.8296, -73.9262, ["yankees", "new york yankees", "ny yankees"]),
        ("Oakland Athletics", 37.7516, -122.2005, ["athletics", "as", "a's", "oakland athletics"]),
        ("Philadelphia Phillies", 39.9061, -75.1665, ["phillies", "philadelphia", "philadelphia phillies"]),
        ("Pittsburgh Pirates", 40.4469, -80.0057, ["pirates", "pittsburgh", "pittsburgh pirates"]),
        ("San Diego Padres", 32.7076, -117.1570, ["padres", "san diego", "san diego padres"]),
        ("San Francisco Giants", 37.7786, -122.3893, ["giants", "san francisco giants", "sf giants"]),
        ("Seattle Mariners", 47.5914, -122.3325, ["mariners", "seattle", "seattle mariners"]),
        ("St. Louis Cardinals", 38.6226, -90.1928, ["cardinals", "st louis cardinals", "st. louis cardinals", "st louis", "st. louis"]),
        ("Tampa Bay Rays", 27.7682, -82.6534, ["rays", "tampa bay", "tampa bay rays"]),
        ("Texas Rangers", 32.7513, -97.0825, ["rangers", "texas", "texas rangers"]),
        ("Toronto Blue Jays", 43.6414, -79.3894, ["blue jays", "jays", "toronto", "toronto blue jays"]),
        ("Washington Nationals", 38.8730, -77.0074, ["nationals", "nats", "washington", "washington nationals"]),
    ]),
    "ncaa": _build_team_aliases([
        ("Alabama Crimson Tide", 33.2080, -87.5504, ["alabama", "crimson tide", "bama", "alabama crimson tide"]),
        ("Arizona Wildcats", 32.2319, -110.9501, ["arizona", "wildcats", "arizona wildcats"]),
        ("Arkansas Razorbacks", 36.0687, -94.1764, ["arkansas", "razorbacks", "arkansas razorbacks"]),
        ("Auburn Tigers", 32.6025, -85.4896, ["auburn", "auburn tigers"]),
        ("Baylor Bears", 31.5493, -97.1143, ["baylor", "baylor bears"]),
        ("Connecticut Huskies", 41.8077, -72.2540, ["uconn", "connecticut", "huskies", "connecticut huskies"]),
        ("Creighton Bluejays", 41.2650, -95.9490, ["creighton", "bluejays", "creighton bluejays"]),
        ("Duke Blue Devils", 35.9956, -78.9428, ["duke", "blue devils", "duke blue devils"]),
        ("Florida Gators", 29.6502, -82.3479, ["florida", "gators", "florida gators"]),
        ("Florida State Seminoles", 30.4383, -84.2807, ["florida state", "seminoles", "fsu", "florida state seminoles"]),
        ("Gonzaga Bulldogs", 47.6677, -117.4022, ["gonzaga", "bulldogs", "gonzaga bulldogs"]),
        ("Houston Cougars", 29.7199, -95.3422, ["houston", "cougars", "houston cougars"]),
        ("Illinois Fighting Illini", 40.1020, -88.2272, ["illinois", "fighting illini", "illini", "illinois fighting illini"]),
        ("Indiana Hoosiers", 39.1653, -86.5264, ["indiana", "hoosiers", "indiana hoosiers"]),
        ("Iowa State Cyclones", 42.0213, -93.6357, ["iowa state", "cyclones", "iowa state cyclones"]),
        ("Kansas Jayhawks", 38.9543, -95.2526, ["kansas", "jayhawks", "kansas jayhawks"]),
        ("Kansas State Wildcats", 39.2009, -96.5820, ["kansas state", "k-state", "wildcats", "kansas state wildcats"]),
        ("Kentucky Wildcats", 38.0406, -84.5037, ["kentucky", "kentucky wildcats"]),
        ("Louisville Cardinals", 38.2050, -85.7588, ["louisville", "louisville cardinals"]),
        ("Marquette Golden Eagles", 43.0387, -87.9280, ["marquette", "golden eagles", "marquette golden eagles"]),
        ("Maryland Terrapins", 38.9881, -76.9447, ["maryland", "terrapins", "terps", "maryland terrapins"]),
        ("Michigan State Spartans", 42.7294, -84.4877, ["michigan state", "spartans", "msu", "michigan state spartans"]),
        ("Michigan Wolverines", 42.2658, -83.7487, ["michigan", "wolverines", "michigan wolverines"]),
        ("North Carolina Tar Heels", 35.9120, -79.0513, ["north carolina", "tar heels", "unc", "north carolina tar heels"]),
        ("Notre Dame Fighting Irish", 41.6986, -86.2382, ["notre dame", "fighting irish", "notre dame fighting irish"]),
        ("Ohio State Buckeyes", 40.0017, -83.0197, ["ohio state", "buckeyes", "ohio state buckeyes"]),
        ("Ole Miss Rebels", 34.3649, -89.5371, ["ole miss", "rebels", "ole miss rebels"]),
        ("Oregon Ducks", 44.0582, -123.0687, ["oregon", "oregon ducks"]),
        ("Purdue Boilermakers", 40.4331, -86.9237, ["purdue", "boilermakers", "purdue boilermakers"]),
        ("Saint John's Red Storm", 40.7216, -73.7947, ["saint johns", "st johns", "st. john's", "red storm", "saint john's red storm"]),
        ("San Diego State Aztecs", 32.7757, -117.0715, ["san diego state", "aztecs", "sdsu", "san diego state aztecs"]),
        ("Seton Hall Pirates", 40.7420, -74.2471, ["seton hall", "pirates", "seton hall pirates"]),
        ("Tennessee Volunteers", 35.9549, -83.9252, ["tennessee", "volunteers", "vols", "tennessee volunteers"]),
        ("Texas Longhorns", 30.2849, -97.7341, ["texas", "longhorns", "texas longhorns"]),
        ("Texas A&M Aggies", 30.6103, -96.3411, ["texas a&m", "aggies", "texas am", "texas a&m aggies"]),
        ("UCLA Bruins", 34.0689, -118.4452, ["ucla", "bruins", "ucla bruins"]),
        ("USC Trojans", 34.0224, -118.2851, ["usc", "trojans", "usc trojans"]),
        ("Villanova Wildcats", 40.0379, -75.3421, ["villanova", "villanova wildcats"]),
        ("Virginia Cavaliers", 38.0336, -78.5080, ["virginia", "cavaliers", "virginia cavaliers"]),
        ("Wisconsin Badgers", 43.0766, -89.4125, ["wisconsin", "badgers", "wisconsin badgers"]),
    ]),
}


def _normalize_alias(value: str) -> str:
    value = value.lower()
    value = value.replace("&", "and")
    value = re.sub(r"[^\w\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _detect_league(tag_slugs: list[str]) -> str | None:
    tag_set = {tag.lower() for tag in tag_slugs}
    for league in ("nba", "nfl", "nhl", "mlb", "ncaa"):
        if any(tag in tag_set for tag in _LEAGUE_TAGS[league]):
            return league
    return None


def _parse_team_names(title: str) -> list[str]:
    if not title:
        return []
    head = re.split(r"[:\-|(),?]", title, maxsplit=1)[0].strip()
    parts = [part.strip() for part in _TEAM_NAME_SPLIT_RE.split(head) if part.strip()]
    if len(parts) >= 2:
        return parts[:2]
    return []


def _candidate_team_keys(name: str) -> list[str]:
    normalized = _normalize_alias(name)
    if not normalized:
        return []

    tokens = normalized.split()
    candidates: list[str] = []

    def add(candidate: str) -> None:
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    add(normalized)
    if len(tokens) >= 2:
        add(" ".join(tokens[-2:]))
        add(" ".join(tokens[:2]))
    add(tokens[-1])
    add(tokens[0])
    return candidates


def _lookup_team_coords(team_name: str, league: str) -> tuple[float, float, str] | None:
    table = _SPORTS_TEAM_COORDS.get(league, {})
    for candidate in _candidate_team_keys(team_name):
        match = table.get(candidate)
        if match is not None:
            return match
    return None


def _coords_to_region(lat: float, lng: float) -> str:
    if 41.0 <= lat <= 84.0 and -141.0 <= lng <= -52.0:
        return "Canada"
    if 24.0 <= lat <= 49.5 and -125.0 <= lng <= -66.0:
        return "United States"
    if 14.0 <= lat <= 33.0 and -118.0 <= lng <= -86.0:
        return "Mexico"
    if 49.0 <= lat <= 60.0 and -10.0 <= lng <= 40.0:
        return "Europe"
    if -35.0 <= lat <= 37.0 and -20.0 <= lng <= 55.0:
        return "Africa"
    if 5.0 <= lat <= 60.0 and 40.0 <= lng <= 150.0:
        return "Asia"
    if -50.0 <= lat <= 10.0 and 110.0 <= lng <= 180.0:
        return "Oceania"
    if -56.0 <= lat <= 13.0 and -82.0 <= lng <= -34.0:
        return "South America"
    return "Global"


def _sanitize_lat_lng(lat: Any, lng: Any) -> tuple[float, float]:
    try:
        safe_lat = max(_SAFE_LAT_MIN, min(_SAFE_LAT_MAX, float(lat)))
        safe_lng = max(-180.0, min(180.0, float(lng)))
        return safe_lat, safe_lng
    except (TypeError, ValueError):
        return 0.0, 0.0


def _lookup_sports_coords(market: dict[str, Any], league: str) -> tuple[float, float, str] | None:
    title = str(market.get("title") or "")
    for team_name in _parse_team_names(title):
        match = _lookup_team_coords(team_name, league)
        if match is not None:
            lat, lng, _canonical_name = match
            return lat, lng, _coords_to_region(lat, lng)
    return None


async def _gemini_enrich(markets: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    if not markets:
        return {}

    geo_map: dict[str, dict[str, Any]] = {}
    for start in range(0, len(markets), _GEMINI_BATCH_SIZE):
        batch = markets[start:start + _GEMINI_BATCH_SIZE]
        items = [
            {
                "slug": str(m.get("slug") or ""),
                "title": str(m.get("title") or ""),
                "description": str(m.get("description") or "")[:280],
                "tag_slugs": m.get("tag_slugs") or [],
            }
            for m in batch
        ]
        prompt = (
            "You classify prediction markets to a single representative location.\n"
            "Use tags as primary hints. For sports, use the home city of the most relevant team.\n"
            "For politics/geopolitics, use the capital or geographic center of the country or region.\n"
            "For entertainment, use the city most associated with the event or subject.\n"
            "For finance/crypto/tech/abstract topics with no real location, return lat=0, lng=0, region='Global'.\n"
            "If uncertain, prefer Global instead of inventing a precise city.\n\n"
            f"Markets:\n{json.dumps(items, ensure_ascii=True)}\n\n"
            "Return JSON with a 'markets' array. Each item must have slug, lat, lng, region."
        )
        try:
            response = await llm_client.complete(
                prompt=prompt,
                model=MODEL_GEMINI_FLASH,
                response_format="json",
            )
            parsed = json.loads(response)
        except Exception:
            continue

        raw_items = parsed.get("markets", [])
        if not isinstance(raw_items, list):
            continue
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            slug = str(item.get("slug") or "").strip()
            if not slug:
                continue
            lat, lng = _sanitize_lat_lng(item.get("lat"), item.get("lng"))
            region = str(item.get("region") or "").strip() or (
                _coords_to_region(lat, lng) if (lat or lng) else "Global"
            )
            geo_map[slug] = {"lat": lat, "lng": lng, "region": region}

    return geo_map


async def enrich_with_geo(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not markets:
        return markets

    needs_gemini: list[dict[str, Any]] = []

    for market in markets:
        tag_slugs = [
            str(tag).strip().lower()
            for tag in market.get("tag_slugs", [])
            if str(tag).strip()
        ]
        market["tag_slugs"] = tag_slugs

        league = _detect_league(tag_slugs)
        if league is not None:
            sports_match = _lookup_sports_coords(market, league)
            if sports_match is not None:
                lat, lng, region = sports_match
                market["lat"] = lat
                market["lng"] = lng
                market["region"] = region
                continue

        needs_gemini.append(market)

    gemini_geo = await _gemini_enrich(needs_gemini)

    for market in needs_gemini:
        geo = gemini_geo.get(str(market.get("slug") or ""))
        if geo is not None:
            market["lat"] = geo["lat"]
            market["lng"] = geo["lng"]
            market["region"] = geo["region"]
            continue

        market["lat"] = 0.0
        market["lng"] = 0.0
        market["region"] = "Global"

    return markets
