"""Downloads real photos of boxes from BGG's user galleries ("BoxFront" tag) for every game in
data/covers.json, as data/gallery/<bggId>~<imageId>.jpg (the evaluation reads the id before "~").

  .venv/bin/python fetch_gallery.py [per_game]     # default 3 photos per game

Uses the gallery API behind boardgamegeek.com's own pages (not the documented XML API): one listing call
per game, with a pause, and only games not fetched yet. The photos belong to the people who uploaded them:
they stay in data/ (git-ignored) and are only used for this evaluation.
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

DATA = Path(__file__).parent / "data"
OUT = DATA / "gallery"
PAUSE = 1.5
MAX_SIDE = 1600
AGENT = {"User-Agent": "meeple-scan-eval/1.0"}
# "BoxFront" photos that don't show the front of the box: what's inside, the back, play, people.
NOT_A_BOX_FRONT = re.compile(
    r"content|component|inside|insert|organi[sz]|back|set ?up|in play|playing|game ?play|designer|author|"
    r"sleeve|unbox|punch|paint|mini|tray|token|cards|meeple|table|essen|convention|prototype|spine|side",
    re.IGNORECASE,
)


def listing(bgg_id: int) -> list[dict]:
    query = urllib.parse.urlencode(
        {
            "ajax": 1,
            "gallery": "all",
            "nosession": 1,
            "objectid": bgg_id,
            "objecttype": "thing",
            "pageid": 1,
            "showcount": 25,
            "size": "thumb",
            "sort": "hot",
            "tag": "BoxFront",
        }
    )
    with urllib.request.urlopen(urllib.request.Request(f"https://api.geekdo.com/api/images?{query}", headers=AGENT), timeout=30) as res:
        return json.load(res).get("images", [])


def main() -> None:
    per_game = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    OUT.mkdir(exist_ok=True)
    games = json.loads((DATA / "covers.json").read_text())
    done = {p.name.split("~")[0] for p in OUT.glob("*.jpg")}
    for game in games:
        bgg_id = game["bggId"]
        if str(bgg_id) in done:
            continue
        try:
            images = listing(bgg_id)
        except Exception as error:  # noqa: BLE001 - one game failing shouldn't stop the run
            print(f"{bgg_id} {game['name']}: listing failed ({error})", flush=True)
            time.sleep(PAUSE * 4)
            continue
        kept = 0
        for image in images:
            url = image.get("imageurl_lg") or image.get("imageurl")
            if kept >= per_game or not url or NOT_A_BOX_FRONT.search(image.get("caption") or ""):
                continue
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=60) as res:
                    img = Image.open(BytesIO(res.read())).convert("RGB")
            except Exception:  # noqa: BLE001
                continue
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            img.save(OUT / f"{bgg_id}~{image['imageid']}.jpg", "JPEG", quality=88)
            kept += 1
        print(f"{bgg_id} {game['name']}: {kept} of {len(images)} photos", flush=True)
        time.sleep(PAUSE)


if __name__ == "__main__":
    main()
