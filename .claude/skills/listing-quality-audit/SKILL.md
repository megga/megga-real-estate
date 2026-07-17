---
name: listing-quality-audit
description: Use when auditing market_listings data quality, adding new scraping sources, or debugging listing display issues
---

# Listing Quality Audit

## Overview

MEGGA has 38K+ listings from RealAdvisor in `market_listings`. Data quality directly impacts user trust. Bad data = lost users.

**Core principle:** Every listing displayed must pass quality checks. Suspect data is hidden, not shown with caveats.

## When to Use

- After a scraping run (new data ingested)
- When listings display incorrectly (wrong prices, missing photos, bad coordinates)
- Before launching in a new canton or city
- When adding a new data source

## Quality Score System

Each listing has a `quality_score` (0-100) calculated by `scripts/_shared/validate-listing.mjs`.

### Scoring Criteria

| Factor | Weight | Rule |
|---|---|---|
| **Price/m²** | 30 pts | Within 2 standard deviations of canton median |
| **Surface** | 20 pts | 10-1000 m² for apartments, 30-5000 m² for houses |
| **Photos** | 20 pts | At least 1 photo, ideally 3+ |
| **Coordinates** | 15 pts | Valid lat/lng within Switzerland bounds |
| **Address** | 15 pts | Has street, city, and postal code |

### Quality Tiers

- **80-100**: Excellent — displayed normally
- **50-79**: Acceptable — displayed with reduced visibility
- **< 50**: Suspect — **hidden from search** (`quality_score < 50` filtered out)

## Audit Checklist

### 1. Global Stats

```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE quality_score >= 80) as excellent,
  COUNT(*) FILTER (WHERE quality_score >= 50 AND quality_score < 80) as acceptable,
  COUNT(*) FILTER (WHERE quality_score < 50) as suspect,
  COUNT(*) FILTER (WHERE photos IS NULL OR array_length(photos, 1) IS NULL) as no_photos,
  COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) as no_coords,
  COUNT(*) FILTER (WHERE price IS NULL OR price <= 0) as no_price
FROM market_listings;
```

### 2. Canton Distribution

```sql
SELECT canton, COUNT(*) as count,
  ROUND(AVG(quality_score)) as avg_score,
  ROUND(AVG(price / NULLIF(surface_m2, 0))) as avg_price_m2
FROM market_listings
WHERE quality_score >= 50
GROUP BY canton
ORDER BY count DESC;
```

### 3. Price Outliers

```sql
-- Listings with suspicious price/m²
SELECT id, title, city, canton, price, surface_m2,
  ROUND(price / NULLIF(surface_m2, 0)) as price_m2,
  quality_score
FROM market_listings
WHERE price / NULLIF(surface_m2, 0) < 1000
   OR price / NULLIF(surface_m2, 0) > 50000
ORDER BY quality_score ASC
LIMIT 20;
```

### 4. Stale Listings

```sql
-- Listings not updated in 30+ days
SELECT COUNT(*) as stale_count
FROM market_listings
WHERE updated_at < NOW() - INTERVAL '30 days'
  AND status = 'active';
```

### 5. Photo Validation

- [ ] Photos load correctly (CDN URLs valid)
- [ ] No broken image URLs (404s)
- [ ] Photos are property photos (not logos, maps, or icons)

### 6. Coordinate Validation

Switzerland bounds:
- Latitude: 45.8° to 47.8°
- Longitude: 5.9° to 10.5°

```sql
SELECT COUNT(*) as out_of_bounds
FROM market_listings
WHERE lat NOT BETWEEN 45.8 AND 47.8
   OR lng NOT BETWEEN 5.9 AND 10.5;
```

## Scraping Scripts

| Script | Purpose | Duration |
|---|---|---|
| `scripts/scrape-paginated.mjs` | Full scrape (590 price ranges) | ~20 min |
| `scripts/scrape-delta.mjs` | Daily update (50 ranges) | ~3 min |
| `scripts/scrape-extra.mjs` | Complementary strategies | ~5 min |
| `scripts/recalculate-quality.mjs` | Recalc quality_score on all | ~2 min |

### Post-Scrape Checklist

- [ ] Run `recalculate-quality.mjs` after any scrape
- [ ] Check suspect count hasn't spiked (normal: < 20)
- [ ] Verify no duplicate listings (same external_id)
- [ ] Check DB size hasn't exceeded 400 MB (plan limit: 500 MB)

## Data Source Rules

### RealAdvisor (current source)
- API: `/api/listings?offerType_eq=buy&salePrice_gte=X&salePrice_lte=Y`
- Rate limit: 2-4s between requests, max 1 full scan/day
- Photos via CDN: `img.realadvisor.ch` (no upload needed)
- No pagination (offset ignored) — use price range slicing

### Adding New Sources
- [ ] Respect robots.txt
- [ ] Rate limit requests (min 2s between calls)
- [ ] Map fields to `market_listings` schema
- [ ] Run quality validation on imported data
- [ ] Log source in `source` column for traceability
- [ ] Test with small batch (1 canton) before full import

## Display Rules

- **Price format**: CHF with Swiss apostrophe (`CHF 720'000`)
- **Surface format**: `120 m²`
- **Rooms**: `4.5 pièces` (Swiss convention — half rooms count)
- **Photos**: Minimum 1 shown, fallback `Building2` icon if none
- **Freshness badge**: "Nouveau" if `first_seen_at` < 7 days, "Xj en ligne" if > 30 days
- **Price drop badge**: "Baisse -X%" if `price_drop_pct >= 1`
