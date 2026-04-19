# YouTube Search Explorer

A Flask web app that connects to the **YouTube Data API v3** and gives you
a power-user interface for searching, filtering, analyzing, and playing
back results.

## Highlights

- **Every `search.list` parameter** exposed in a dark-themed sidebar form.
- **Post-API filters** layered on top: precise duration, view/like/comment
  ranges, engagement ratios, subscriber ranges, title/description regex,
  channel allowlist / blocklist.
- **Query power tools**: exclusion terms (`-foo`), OR groups, saved
  searches (localStorage), and shareable URL hash.
- **Results workflow**: client-side sort, grid / compact / list view
  modes, hide-watched toggle, favorites (★) with "starred only" filter,
  CSV / JSON export, bulk copy of URLs or IDs.
- **Playback**: click to play in a modal, hover to auto-preview muted,
  playback speed 0.5× – 2×, start/end clip input, autoplay-next queue.
- **Context**: top comments preview + "more from this channel" list
  inside the player modal.
- **Insights panel**: totals, averages, median duration, top channels,
  duration histogram, upload-time heatmap.
- **Quota meter**: live estimate of YouTube API units used this session.
- **Keyboard nav**: `j` / `k` / arrows to move, `Enter` to play, `s` to
  star, `Esc` to close modal, `/` to focus search.

## Setup

### 1. Get a YouTube Data API v3 key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create (or pick) a project.
3. Enable **YouTube Data API v3** under *APIs & Services → Library*.
4. Create an **API key** under *APIs & Services → Credentials*.

### 2. Configure the project

```powershell
copy .env.example .env
```

Open `.env` and paste your key:

```
YOUTUBE_API_KEY=AIzaSy...
```

### 3. Install dependencies

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 4. Run the app

```powershell
python app.py
```

Open <http://127.0.0.1:5000>.

## Feature reference

### Native API parameters

All of `search.list`: `q`, `type`, `order`, `maxResults`, `safeSearch`,
`publishedAfter`, `publishedBefore`, `regionCode`, `relevanceLanguage`,
`channelId`, `channelType`, `topicId`, `location`, `locationRadius`,
`eventType`, `videoDuration`, `videoDefinition`, `videoDimension`,
`videoCaption`, `videoCategoryId`, `videoType`, `videoLicense`,
`videoEmbeddable`, `videoSyndicated`, `videoPaidProductPlacement`,
`pageToken`.

### Query power tools

| Field | Effect |
| --- | --- |
| Exclude terms | Each term becomes `-term` in `q`. |
| Any-of (OR) terms | Combined into `(a\|b\|c)` in `q`. |
| Title/description regex | JavaScript-style regex applied server-side after results come back. |

### Post-API filters

Work by enriching results with `videos.list` (and optionally `channels.list`) and dropping items that don't match. Note: these reduce the returned count below `maxResults`.

| Field | Source |
| --- | --- |
| Precise duration (preset or custom min/max) | `contentDetails.duration` |
| Min/max views, likes, comments | `statistics.*` |
| Min like-to-view ratio (%) | `statistics.likeCount / viewCount` |
| Min comment-to-view ratio (%) | `statistics.commentCount / viewCount` |
| Min/max subscribers *(extra channels.list call)* | `statistics.subscriberCount` |
| Include / exclude channels (IDs or names) | Channel metadata |

Duration inputs accept seconds (`90`), `mm:ss` (`1:30`), `hh:mm:ss`, or
compact (`2m30s`, `1h15m`).

### Saved searches & shareable URLs

- Type a name and press **Save** to persist the full form to
  `localStorage` under `ytx.savedSearches`.
- The current filters are also written into `location.hash`, so any
  URL you bookmark or share reproduces the search.

### Results toolbar

- **Sort**: views / likes / comments / duration / published / title /
  like-ratio, asc/desc. Client-side, no extra quota.
- **View**: grid (default), compact (denser), list (row layout).
- **Hide watched** / **Starred only** toggles.
- **Insights** button opens the analytics panel.
- **CSV / JSON** download of the current visible results.
- **Copy URLs / Copy IDs** copies the list of visible results to the clipboard.
- **Clear watched** wipes the local watched history.

### Modal player

- YouTube IFrame API with **playback speed** buttons.
- **Start / end** clip inputs (seconds or `mm:ss`) — re-loads the
  video bounded by those timestamps.
- **Autoplay next result** when a video ends.
- **Top comments** (5 most relevant) from `commentThreads.list`.
- **More from this channel** grid (10 latest) from a `search.list`
  call with `channelId` + `order=date`.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus the search box |
| `j` / `↓` | Focus next card |
| `k` / `↑` | Focus previous card |
| `Enter` | Open focused card in modal |
| `s` | Star / unstar focused card |
| `Esc` | Close modal |

### Quota

Displayed in the top bar. Approximate cost per action:

| Action | Units |
| --- | --- |
| `search.list` (main search) | 100 |
| `search.list` (channel videos in modal) | 100 |
| `videos.list` enrichment | 1 per 50 videos |
| `channels.list` (subscriber filter) | 1 per 50 channels |
| `commentThreads.list` (modal comments) | 1 |

Click **reset** next to the quota to zero the counter (it doesn't affect
your real Google Cloud quota, which resets daily at midnight Pacific).

## Project structure

```
YT API/
├── app.py
├── requirements.txt
├── .env.example
├── templates/index.html
└── static/
    ├── style.css
    └── app.js
```

## Caveats

- Post-API filters can't expand the result pool, only shrink it. If a
  filter leaves you with fewer items than you want, raise
  `maxResults` to 50 and page through.
- The subscriber filter drops results whose subscriber count is hidden.
- Transcript / caption search is not included — it requires OAuth and
  caption downloads aren't available to third-party API keys.
