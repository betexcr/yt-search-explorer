"""
YouTube Search Explorer
A Flask app that lets you search the YouTube Data API v3 using every
parameter supported by `search.list`, plus a large set of post-API
filters, analytics, and UI tools.
"""

import os
import re
import threading
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()

app = Flask(__name__)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
COMMENT_THREADS_URL = "https://www.googleapis.com/youtube/v3/commentThreads"
CATEGORIES_URL = "https://www.googleapis.com/youtube/v3/videoCategories"

# --- Simple in-memory quota tracker (per-process) ---------------------------
_quota_lock = threading.Lock()
_quota_used = 0


def _add_quota(units: int) -> int:
    global _quota_used
    with _quota_lock:
        _quota_used += units
        return _quota_used


def _get_quota() -> int:
    with _quota_lock:
        return _quota_used


# --- Search params ----------------------------------------------------------
PASSTHROUGH_PARAMS = [
    "channelId",
    "channelType",
    "eventType",
    "location",
    "locationRadius",
    "maxResults",
    "order",
    "pageToken",
    "publishedAfter",
    "publishedBefore",
    "regionCode",
    "relevanceLanguage",
    "safeSearch",
    "topicId",
    "type",
    "videoCaption",
    "videoCategoryId",
    "videoDefinition",
    "videoDimension",
    "videoDuration",
    "videoEmbeddable",
    "videoLicense",
    "videoPaidProductPlacement",
    "videoSyndicated",
    "videoType",
]

DURATION_PRESETS = {
    "shorts":  (0, 60),
    "under1":  (0, 60),
    "1to4":    (60, 240),
    "under5":  (0, 300),
    "4to10":   (240, 600),
    "5to15":   (300, 900),
    "10to20":  (600, 1200),
    "15to30":  (900, 1800),
    "20to60":  (1200, 3600),
    "over30":  (1800, None),
    "over60":  (3600, None),
}


# --- Helpers ----------------------------------------------------------------
def _iso_duration_to_seconds(iso):
    if not iso:
        return None
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso)
    if not m:
        return None
    d, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _parse_duration_input(raw):
    if not raw:
        return None
    raw = raw.strip().lower()
    if raw.isdigit():
        return int(raw)
    if ":" in raw:
        try:
            parts = [int(p) for p in raw.split(":")]
        except ValueError:
            return None
        while len(parts) < 3:
            parts.insert(0, 0)
        h, m, s = parts[-3], parts[-2], parts[-1]
        return h * 3600 + m * 60 + s
    m = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?", raw)
    if not m or not any(m.groups()):
        return None
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s


def _rfc3339(value):
    if not value:
        return ""
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return value


def _int_or_none(s):
    if s is None:
        return None
    s = str(s).strip().replace(",", "").replace("_", "")
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def _float_or_none(s):
    if s is None:
        return None
    s = str(s).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _split_csv(s):
    if not s:
        return []
    return [x.strip() for x in re.split(r"[,\n]+", s) if x.strip()]


def _build_q(form):
    q = (form.get("q") or "").strip()
    excludes = _split_csv(form.get("excludeTerms") or "")
    ors = _split_csv(form.get("orTerms") or "")
    parts = []
    if q:
        parts.append(q)
    if ors:
        parts.append("(" + "|".join(ors) + ")")
    for e in excludes:
        parts.append(e if e.startswith("-") else f"-{e}")
    return " ".join(parts)


def _build_params(form):
    params = {"key": YOUTUBE_API_KEY, "part": "snippet"}
    for key in PASSTHROUGH_PARAMS:
        value = (form.get(key) or "").strip()
        if value == "":
            continue
        if key in ("publishedAfter", "publishedBefore"):
            value = _rfc3339(value)
        params[key] = value

    q_combined = _build_q(form)
    if q_combined:
        params["q"] = q_combined

    video_only = {
        "eventType", "videoCaption", "videoCategoryId", "videoDefinition",
        "videoDimension", "videoDuration", "videoEmbeddable", "videoLicense",
        "videoPaidProductPlacement", "videoSyndicated", "videoType",
    }
    if any(k in params for k in video_only) and "type" not in params:
        params["type"] = "video"

    return params


def _fetch_video_stats(video_ids):
    if not video_ids:
        return {}
    out = {}
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        resp = requests.get(
            VIDEOS_URL,
            params={
                "key": YOUTUBE_API_KEY,
                "part": "statistics,contentDetails,status",
                "id": ",".join(chunk),
            },
            timeout=15,
        )
        _add_quota(1)
        if not resp.ok:
            continue
        for item in resp.json().get("items", []):
            out[item["id"]] = {
                "statistics": item.get("statistics", {}),
                "contentDetails": item.get("contentDetails", {}),
                "status": item.get("status", {}),
            }
    return out


def _fetch_channel_stats(channel_ids):
    if not channel_ids:
        return {}
    out = {}
    for i in range(0, len(channel_ids), 50):
        chunk = channel_ids[i:i + 50]
        resp = requests.get(
            CHANNELS_URL,
            params={
                "key": YOUTUBE_API_KEY,
                "part": "statistics,snippet",
                "id": ",".join(chunk),
            },
            timeout=15,
        )
        _add_quota(1)
        if not resp.ok:
            continue
        for item in resp.json().get("items", []):
            out[item["id"]] = item
    return out


# --- Routes -----------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html", has_key=bool(YOUTUBE_API_KEY))


@app.route("/api/quota")
def quota():
    return jsonify({"used": _get_quota()})


@app.route("/api/reset-quota", methods=["POST"])
def reset_quota():
    global _quota_used
    with _quota_lock:
        _quota_used = 0
    return jsonify({"used": 0})


@app.route("/api/search")
def search():
    if not YOUTUBE_API_KEY:
        return jsonify({"error": "Missing YOUTUBE_API_KEY. Copy .env.example to .env and set your key."}), 400

    params = _build_params(request.args)

    # --- Precise duration ---------------------------------------------------
    preset = (request.args.get("durationPreset") or "").strip()
    min_raw = (request.args.get("minDuration") or "").strip()
    max_raw = (request.args.get("maxDuration") or "").strip()
    min_sec = max_sec = None
    if min_raw or max_raw:
        min_sec = _parse_duration_input(min_raw)
        max_sec = _parse_duration_input(max_raw)
    elif preset and preset in DURATION_PRESETS:
        min_sec, max_sec = DURATION_PRESETS[preset]

    # --- Range filters ------------------------------------------------------
    min_views = _int_or_none(request.args.get("minViews"))
    max_views = _int_or_none(request.args.get("maxViews"))
    min_likes = _int_or_none(request.args.get("minLikes"))
    max_likes = _int_or_none(request.args.get("maxLikes"))
    min_comments = _int_or_none(request.args.get("minComments"))
    max_comments = _int_or_none(request.args.get("maxComments"))
    min_like_ratio = _float_or_none(request.args.get("minLikeRatio"))
    min_comment_ratio = _float_or_none(request.args.get("minCommentRatio"))
    min_subs = _int_or_none(request.args.get("minSubscribers"))
    max_subs = _int_or_none(request.args.get("maxSubscribers"))

    title_regex_raw = (request.args.get("titleRegex") or "").strip()
    title_regex = None
    if title_regex_raw:
        try:
            title_regex = re.compile(title_regex_raw, re.IGNORECASE)
        except re.error as exc:
            return jsonify({"error": f"Invalid regex: {exc}"}), 400

    include_channels = {c.lower() for c in _split_csv(request.args.get("includeChannels") or "")}
    exclude_channels = {c.lower() for c in _split_csv(request.args.get("excludeChannels") or "")}

    needs_channel_stats = min_subs is not None or max_subs is not None
    any_video_filter = (
        any(x is not None for x in (
            min_views, max_views, min_likes, max_likes,
            min_comments, max_comments, min_like_ratio,
            min_comment_ratio, min_sec, max_sec,
        ))
        or title_regex is not None
    )
    if (any_video_filter or needs_channel_stats) and "type" not in params:
        params["type"] = "video"

    # --- Search -------------------------------------------------------------
    try:
        resp = requests.get(SEARCH_URL, params=params, timeout=15)
    except requests.RequestException as exc:
        return jsonify({"error": f"Network error: {exc}"}), 502

    _add_quota(100)

    if not resp.ok:
        try:
            message = resp.json().get("error", {}).get("message", resp.text)
        except ValueError:
            message = resp.text
        return jsonify({"error": message, "status": resp.status_code}), resp.status_code

    data = resp.json()
    items = data.get("items", [])

    video_ids = [
        it["id"]["videoId"]
        for it in items
        if it.get("id", {}).get("kind") == "youtube#video"
    ]
    stats_map = _fetch_video_stats(video_ids)

    channel_ids_needed = set()
    if needs_channel_stats:
        for it in items:
            cid = it.get("snippet", {}).get("channelId")
            if cid:
                channel_ids_needed.add(cid)
    channel_stats_map = (
        _fetch_channel_stats(sorted(channel_ids_needed))
        if channel_ids_needed else {}
    )

    results = []
    for it in items:
        kind = it.get("id", {}).get("kind", "")
        snippet = it.get("snippet", {})
        thumb = (
            snippet.get("thumbnails", {}).get("medium")
            or snippet.get("thumbnails", {}).get("default")
            or {}
        )
        entry = {
            "kind": kind.replace("youtube#", ""),
            "title": snippet.get("title", ""),
            "description": snippet.get("description", ""),
            "channelTitle": snippet.get("channelTitle", ""),
            "channelId": snippet.get("channelId", ""),
            "publishedAt": snippet.get("publishedAt", ""),
            "thumbnail": thumb.get("url", ""),
        }
        id_obj = it.get("id", {})
        if kind == "youtube#video":
            vid = id_obj.get("videoId")
            entry["id"] = vid
            entry["url"] = f"https://www.youtube.com/watch?v={vid}"
            if vid in stats_map:
                entry["statistics"] = stats_map[vid]["statistics"]
                cd = stats_map[vid]["contentDetails"]
                entry["duration"] = cd.get("duration", "")
                entry["definition"] = cd.get("definition", "")
                yt_rating = (cd.get("contentRating") or {}).get("ytRating", "")
                entry["ageRestricted"] = yt_rating == "ytAgeRestricted"
                st = stats_map[vid].get("status") or {}
                embeddable = st.get("embeddable")
                entry["embeddable"] = True if embeddable is None else bool(embeddable)
                entry["privacyStatus"] = st.get("privacyStatus", "")
        elif kind == "youtube#channel":
            cid = id_obj.get("channelId")
            entry["id"] = cid
            entry["url"] = f"https://www.youtube.com/channel/{cid}"
        elif kind == "youtube#playlist":
            pid = id_obj.get("playlistId")
            entry["id"] = pid
            entry["url"] = f"https://www.youtube.com/playlist?list={pid}"

        ch_id = snippet.get("channelId", "")
        if ch_id in channel_stats_map:
            cs = channel_stats_map[ch_id].get("statistics", {})
            entry["channelStats"] = {
                "subscriberCount": cs.get("subscriberCount"),
                "videoCount": cs.get("videoCount"),
                "viewCount": cs.get("viewCount"),
            }

        results.append(entry)

    # --- Apply filters ------------------------------------------------------
    filtered_out = 0
    kept = []
    for e in results:
        ct_id = (e.get("channelId") or "").lower()
        ct_name = (e.get("channelTitle") or "").lower()

        if include_channels and not (ct_id in include_channels or ct_name in include_channels):
            filtered_out += 1
            continue
        if exclude_channels and (ct_id in exclude_channels or ct_name in exclude_channels):
            filtered_out += 1
            continue

        if min_subs is not None or max_subs is not None:
            subs = _int_or_none((e.get("channelStats") or {}).get("subscriberCount"))
            if subs is None:
                filtered_out += 1
                continue
            if min_subs is not None and subs < min_subs:
                filtered_out += 1
                continue
            if max_subs is not None and subs > max_subs:
                filtered_out += 1
                continue

        if title_regex is not None:
            hay = f"{e.get('title', '')} {e.get('description', '')}"
            if not title_regex.search(hay):
                filtered_out += 1
                continue

        if e["kind"] == "video":
            secs = _iso_duration_to_seconds(e.get("duration", ""))
            if min_sec is not None or max_sec is not None:
                if secs is None:
                    filtered_out += 1; continue
                if min_sec is not None and secs < min_sec:
                    filtered_out += 1; continue
                if max_sec is not None and secs > max_sec:
                    filtered_out += 1; continue

            stats = e.get("statistics", {})
            views = _int_or_none(stats.get("viewCount"))
            likes = _int_or_none(stats.get("likeCount"))
            comments = _int_or_none(stats.get("commentCount"))

            def _out_of_range(v, lo, hi):
                if lo is not None and (v is None or v < lo):
                    return True
                if hi is not None and (v is None or v > hi):
                    return True
                return False

            if _out_of_range(views, min_views, max_views):
                filtered_out += 1; continue
            if _out_of_range(likes, min_likes, max_likes):
                filtered_out += 1; continue
            if _out_of_range(comments, min_comments, max_comments):
                filtered_out += 1; continue

            if min_like_ratio is not None:
                if not views or likes is None:
                    filtered_out += 1; continue
                if (likes / views) * 100 < min_like_ratio:
                    filtered_out += 1; continue
            if min_comment_ratio is not None:
                if not views or comments is None:
                    filtered_out += 1; continue
                if (comments / views) * 100 < min_comment_ratio:
                    filtered_out += 1; continue

        kept.append(e)

    debug_params = {k: v for k, v in params.items() if k != "key"}
    if min_sec is not None or max_sec is not None:
        debug_params["precise_duration"] = (
            f"{min_sec if min_sec is not None else 0}s"
            f" – {max_sec if max_sec is not None else '∞'}"
        )

    return jsonify({
        "items": kept,
        "nextPageToken": data.get("nextPageToken"),
        "prevPageToken": data.get("prevPageToken"),
        "pageInfo": data.get("pageInfo", {}),
        "requestParams": debug_params,
        "filteredOut": filtered_out,
        "quotaUsed": _get_quota(),
    })


@app.route("/api/comments")
def comments():
    video_id = (request.args.get("videoId") or "").strip()
    if not video_id:
        return jsonify({"error": "videoId required"}), 400
    try:
        resp = requests.get(
            COMMENT_THREADS_URL,
            params={
                "key": YOUTUBE_API_KEY,
                "part": "snippet",
                "videoId": video_id,
                "maxResults": 5,
                "order": "relevance",
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        return jsonify({"error": f"Network error: {exc}"}), 502
    _add_quota(1)
    if not resp.ok:
        try:
            message = resp.json().get("error", {}).get("message", resp.text)
        except ValueError:
            message = resp.text
        return jsonify({"error": message}), resp.status_code
    items = []
    for item in resp.json().get("items", []):
        top = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
        items.append({
            "author": top.get("authorDisplayName", ""),
            "authorImage": top.get("authorProfileImageUrl", ""),
            "text": top.get("textDisplay", ""),
            "likeCount": top.get("likeCount", 0),
            "publishedAt": top.get("publishedAt", ""),
        })
    return jsonify({"items": items, "quotaUsed": _get_quota()})


@app.route("/api/categories")
def categories():
    region = (request.args.get("regionCode") or "US").strip() or "US"
    try:
        resp = requests.get(
            CATEGORIES_URL,
            params={
                "key": YOUTUBE_API_KEY,
                "part": "snippet",
                "regionCode": region,
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        return jsonify({"error": f"Network error: {exc}"}), 502
    _add_quota(1)
    if not resp.ok:
        try:
            message = resp.json().get("error", {}).get("message", resp.text)
        except ValueError:
            message = resp.text
        return jsonify({"error": message}), resp.status_code

    items = []
    for it in resp.json().get("items", []):
        sn = it.get("snippet", {})
        items.append({
            "id": it.get("id"),
            "title": sn.get("title", ""),
            "assignable": bool(sn.get("assignable")),
        })
    items.sort(key=lambda x: x["title"])
    return jsonify({"items": items, "regionCode": region, "quotaUsed": _get_quota()})


@app.route("/api/channel-videos")
def channel_videos():
    channel_id = (request.args.get("channelId") or "").strip()
    if not channel_id:
        return jsonify({"error": "channelId required"}), 400
    try:
        resp = requests.get(
            SEARCH_URL,
            params={
                "key": YOUTUBE_API_KEY,
                "part": "snippet",
                "channelId": channel_id,
                "type": "video",
                "order": "date",
                "maxResults": 10,
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        return jsonify({"error": f"Network error: {exc}"}), 502
    _add_quota(100)
    if not resp.ok:
        try:
            message = resp.json().get("error", {}).get("message", resp.text)
        except ValueError:
            message = resp.text
        return jsonify({"error": message}), resp.status_code
    out = []
    for item in resp.json().get("items", []):
        sn = item.get("snippet", {})
        out.append({
            "id": item.get("id", {}).get("videoId"),
            "title": sn.get("title", ""),
            "thumbnail": (sn.get("thumbnails", {}).get("medium") or {}).get("url", ""),
            "publishedAt": sn.get("publishedAt", ""),
            "channelTitle": sn.get("channelTitle", ""),
        })
    return jsonify({"items": out, "quotaUsed": _get_quota()})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
