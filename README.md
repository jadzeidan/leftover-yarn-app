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

- The app only shows links discovered from the Wool and the Gang free-patterns source.
- Wool and the Gang pages are JS-heavy, so live parsing can be partial.
- Results are strictly filtered to patterns with known yarn requirements less than or equal to your entered amount.
- `data/patterns.json` is intentionally empty by default to avoid guessed links.
