---
name: figma-to-section
description: Port a Figma node to a production-ready React section in one pass — fetches design context + screenshot, downloads assets locally, converts Tailwind classes to inline styles using PX.* tokens. Use when the user gives a Figma node ID/URL and wants a `.tsx` file for the propertyx marketplace.
---

# Figma → Section (PropertyX)

You are porting a Figma node to a React component for the MEGGA propertyx marketplace. The codebase uses **inline styles** with the `PX.*` design tokens (see `src/components/propertyx/tokens.ts`) — NOT Tailwind classes. One Figma node = one `.tsx` file in `src/components/propertyx/sections/`. No iteration loop, no guessing.

## Inputs

User provides:
- A Figma node ID (e.g. `11754:25966`) or full URL (e.g. `figma.com/design/fZovI4RREX4XHpLazsz8JB/...?node-id=11754-25966`)
- Optional: target file name (e.g. `PxExploreCTA.tsx`)

If only a URL: extract `fileKey` from `/design/<fileKey>/` and `nodeId` from `?node-id=` (convert `-` to `:`).

## Workflow (do all steps in order, single pass)

### 1. Fetch design context

```
mcp__47d86dc7-...__get_design_context(fileKey, nodeId, clientFrameworks=react, clientLanguages=typescript)
```

This returns React+Tailwind code + asset URLs (`imgElement…`). Save the structural skeleton — it is the source of truth for layout, dimensions, text content.

### 2. Fetch screenshot for sanity check

```
mcp__47d86dc7-...__get_screenshot(fileKey, nodeId)
```

Download via `curl -o /tmp/figma-<nodeId>.png "<url>"` then `Read` it. Use to verify the structure matches before writing code.

### 3. Download every asset locally

Asset URLs from the MCP **expire in 7 days**. Move them to `/public/images/sections/<section-slug>/`:

```bash
mkdir -p /home/user/megga-real-estate/public/images/sections/<section-slug>
curl -s -o /home/user/megga-real-estate/public/images/sections/<section-slug>/<asset-name>.png "<figma-mcp-url>"
```

Name assets descriptively (`hero-couple.jpg`, `card-1.jpg`). If an asset > 1 MB, prefer hosting on Unsplash with the same look (search by content — "couple laptop", "modern living room") rather than committing huge files.

For iPad / iPhone / device frames, use the PNG asset from Figma — they have specific bezels that can't be faked.

### 4. Convert Tailwind to inline styles

The Figma MCP returns code like:

```tsx
<div className="bg-[var(--colors\/neutrals-colors\/700,#14161c)] content-stretch flex gap-[6px] items-center pl-[6px] pr-[12px] py-[6px] rounded-[var(--numbers\/radius\/pill,200px)]">
```

Convert to:

```tsx
<div style={{
  background: PX.neutral700,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  paddingLeft: 6,
  paddingRight: 12,
  paddingTop: 6,
  paddingBottom: 6,
  borderRadius: PX.radius.pill,
}}>
```

Token mapping (cheat sheet, see `tokens.ts` for full list):
- `#FFFFFF` → `PX.neutral100`
- `#FAFAFB` → `PX.neutral200`
- `#EEEFF1` → `PX.neutral300`
- `#A4A6B0` → `PX.neutral400`
- `#464851` → `PX.neutral500`
- `#202127` → `PX.neutral600`
- `#14161C` → `PX.neutral700`
- `rounded-[200px]` → `borderRadius: PX.radius.pill`
- `rounded-[24px]` → `borderRadius: PX.radius.large`
- `rounded-[16px]` → `borderRadius: PX.radius.medium`
- `rounded-[12px]` → `borderRadius: PX.radius.small`
- `rounded-[8px]` → `borderRadius: PX.radius.tiny`
- `font-['Objectivity:Medium']` → `fontFamily: PX.font.display, fontWeight: 500`
- `font-['Objectivity:Regular']` → `fontFamily: PX.font.display, fontWeight: 400`
- `font-['Objectivity:Bold']` → `fontFamily: PX.font.display, fontWeight: 700`

### 5. Icons

Tailwind output references icons as `<img src={imgElementXX} />`. Don't keep `<img>` for icons — use the project's icon system:

- Real-estate icons (key, tag, location, surface, bed, bath, parking, home-poi) → `PxFigmaIcon name="<name>"` (loads `/public/icons/figma/<name>.svg`)
- UI icons (chevron-right, plus, search) → either `PxFigmaIcon` if available, or `PxIcon` (generic line-stroke)
- Badge eyebrow icons (star, check, etc.) → `PxFigmaIcon name="badge-<context>-<icon>"` — list in `PxFigmaIcon.tsx`

If a needed icon is missing in `/public/icons/figma/`, extract its SVG from the Figma asset URL (`curl <url>`), convert the SVG `fill="var(--…)"` to `fill="currentColor"`, save as `<name>.svg`, and add the name to the `PxFigmaIconName` union in `src/components/propertyx/PxFigmaIcon.tsx`.

### 6. Output the component

Write the file to `src/components/propertyx/sections/<PxSectionName>.tsx`. Structure:

```tsx
// MEGGA Marketplace — Property X "<Section Name>" section.
// Source : Figma node <node-id> — code Figma EXACT (texte, dimensions, position).

import { PX, PxButton, PxIcon, PxFigmaIcon } from '..'

// Sub-components for repeated patterns (badges, cards, etc.)
function <ComponentName>() { ... }

export default function <PxSectionName>() {
  return (
    <section style={{ ... }}>
      ...
    </section>
  )
}
```

Rules:
- Use the EXACT pixel values from Figma (`width: 851`, `top: 76.37`) — don't round or "improve".
- Keep the EXACT text content from Figma (English Lorem ipsum, English labels) — unless the user has explicitly localized.
- Mirror the Figma layout structure (flex / grid / absolute positioning) — don't refactor to "cleaner" alternatives.
- Add a short header comment with the Figma node ID for traceability.

### 7. Wire the section into the page (if it replaces or adds to the home)

If the section already exists (e.g. `PxExploreCTA.tsx`) → overwrite. If it's new → add to `src/pages/public/PropertyXHomePage.tsx` in the right position.

### 8. Verify build before committing

```bash
# If node_modules is available locally
npm run build 2>&1 | tail -20

# Otherwise: visually verify no obvious syntax errors, then push and let CI validate
```

## Don'ts

- Don't iterate "fix dimension → push → ask user → fix again". One pass = pixel exact Figma values.
- Don't substitute Figma assets with Unsplash unless they're > 1 MB AND visually equivalent.
- Don't translate text to French unless the user has explicitly said "localize this section to FR".
- Don't add Tailwind classes. Stay inline styles + `PX.*` tokens for consistency with the rest of propertyx.
- Don't skip the screenshot step — visual sanity check catches missed elements before they ship.

## Output to user

When done, summarize in 3 lines:
1. Component path created/updated
2. Asset(s) downloaded (count + path)
3. Any element you couldn't port faithfully and why (e.g. "Lottie animation not supported → static placeholder")
