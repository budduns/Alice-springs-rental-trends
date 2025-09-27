# Alice Springs Rental Trends

A public site showing daily-updated rental listings for Alice Springs Greater Region. Scrapes from realestate.com.au (single page only), updates via GitHub Actions, and displays a filterable table.

## How It Works
- Scraper runs daily at ~06:15 AEST, updates `data/listings.json` and `data/_meta.json`.
- Site loads JSON and renders interactive table with search, filters, sort, pagination.
- Hosted on GitHub Pages: https://budduns.github.io/Alice-springs-rental-trends/

## How to Re-Run
- Go to Actions tab > daily > Run workflow > Run.

## How to Adjust Cron
- Edit `.github/workflows/daily.yml` cron (UTC format).

## Common Fixes
- Site stale? Hard refresh (Ctrl+F5) or update ?v= in index.html links.
- _meta.json 404? Ensure .nojekyll exists.
- 0 listings? Re-run manually; check selectors if persistent.
- Cheerio error? Uses correct import; re-install in Actions.
