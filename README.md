# 🌿 Skincare Routine Tracker

A simple, aesthetic skincare tracker that runs entirely in your browser. No build step, no dependencies, no server.

Check off your morning and evening products each day, and keep an eye on when you last used your actives (like tretinoin).

## Features

- **Daily grid**: products on the left, every day of the month across the top, with today highlighted
- **Morning and Evening routines** tracked separately
- **Active ingredient badges**: flag a product (e.g. Tretinoin) as an active to see how many days ago you last used it
  - green = used today or yesterday, amber = 2-3 days ago, pink = 4+ days or never logged
- **"Last used" label** under every product
- **Drag and drop** the ⠿ handle to reorder products within a routine
- **Add / remove products** anytime
- **Month navigation** to look back at (or plan ahead for) other months
- **Autosave** to your browser's local storage
- **Export to Markdown**: download a snapshot of the month as `progress-YYYY-MM.md`

## Usage

1. Clone or download this repo
2. Open `index.html` in your browser (just double-click it)
3. Click the circles to log your routine

```bash
git clone https://github.com/sheyolarte/skincare-tracker.git
cd skincare-tracker
open index.html
```

## Where is my data stored?

Progress is saved in your browser's `localStorage`, tied to the exact location you open the page from. Always open it the same way (same file path or same URL) to see your history, and use **Save progress to Markdown** for a backup you can keep.

Clearing your browser's site data will erase tracked progress.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Styling |
| `script.js` | Tracker logic, storage, drag-and-drop, Markdown export |

## Customizing

The default products are defined at the top of `script.js` in `defaultData()`. Edit those names, or just use the **+ Add product** buttons in the app.
