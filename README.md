# Leftover Yarn Pattern Finder

A static web app that matches your leftover yarn to free patterns from Wool and the Gang.

## Features

- Input yarn amount, yarn type, and yarn weight.
- Rank matching patterns with a simple scoring model.
- Tries a live catalog fetch first, then falls back to local JSON data.
- Works on GitHub Pages (no server required).

## Local run

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080)

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In your repository, go to **Settings > Pages**.
3. Set **Source** to **GitHub Actions**.
4. The included workflow will deploy on every push to `main`.

## Notes

- Wool and the Gang pages are JS-heavy, so live parsing can be partial.
- If live fetch cannot parse enough details, the app uses `data/patterns.json`.
- You can improve matching quality by expanding `data/patterns.json` with verified yarn requirement info.
