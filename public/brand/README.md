# AkiMatch brand images

This directory is the single source for browser icons and social share images.
Do not place `icon.png`, `apple-icon.png`, `opengraph-image.png`, `twitter-image.png`, or `favicon.ico` directly under `src/app/`.

## Files

| File | Purpose | Recommended size |
| --- | --- | --- |
| `icon.png` | Browser favicon and app icon referenced from `metadata.icons.icon` | 1024x1024 PNG |
| `apple-icon.png` | iOS home screen icon referenced from `metadata.icons.apple` | 1024x1024 PNG |
| `opengraph-image.png` | URL share preview image referenced from `metadata.openGraph.images` | 1200x630 PNG |
| `twitter-image.png` | X/Twitter card image referenced from `metadata.twitter.images` | 1200x630 PNG |

## Generation prompt

Use one consistent visual direction for all four images:

```text
Create a clean, practical brand image for "AkiMatch", a Japanese scheduling tool that helps groups find overlapping available times. The visual should feel like a modern productivity app, not a marketing landing page. Use a readable calendar/time-grid motif with overlapping availability bars, crisp Japanese-friendly typography, and a calm palette with blue, green, white, and dark slate accents. Avoid clutter, mascot characters, stock-photo people, and excessive gradients.
```

For `icon.png` and `apple-icon.png`, generate a square composition with a simple symbol that remains recognizable at small sizes.

For `opengraph-image.png` and `twitter-image.png`, generate a 1200x630 composition with the AkiMatch name, a short scheduling/availability visual, and enough safe margin so it does not crop badly in previews.

## Placement rules

- Keep these files in `public/brand/`.
- Reference them from `src/app/layout.tsx` metadata.
- Do not rely on Next.js file-based metadata conventions in `src/app/` for these brand PNGs.
- Do not reuse the square icon as the OGP/Twitter image; keep share images at 1200x630.
- Do not restore `src/app/favicon.ico`; the favicon is `/brand/icon.png`.

## Checks

After replacing or adding images:

1. Run `pnpm lint`.
2. Run `pnpm build`.
3. Confirm the built metadata contains `/brand/icon.png`, `/brand/apple-icon.png`, `/brand/opengraph-image.png`, and `/brand/twitter-image.png`.
4. In a browser, confirm the tab icon comes from `/brand/icon.png`.
5. In URL share debuggers or social previews, confirm `opengraph-image.png` or `twitter-image.png` is used.

For deployed environments, set `NEXT_PUBLIC_SITE_URL` to the public origin, for example `https://example.com`.
Next.js uses `metadataBase` to turn the Open Graph and Twitter image paths into absolute URLs.
