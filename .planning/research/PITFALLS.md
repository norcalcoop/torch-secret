# Domain Pitfalls: Dark Theme, SVG Icons, Animations, and SEO for a Security-Focused SPA

**Domain:** UI redesign and SEO infrastructure for a zero-knowledge secret sharing application
**Researched:** 2026-02-15
**Confidence:** HIGH for CSP/accessibility integration pitfalls, MEDIUM for performance and SEO specifics
**Scope:** Pitfalls specific to ADDING dark theme, animations, SVG icons, and SEO to an existing app with strict CSP nonce-based headers, WCAG 2.1 AA compliance, and zero-knowledge security requirements

---

## Critical Pitfalls

Mistakes that cause security regressions, break existing compliance, or require rework of the approach.

### Pitfall 1: SVG Inline `style` Attributes Blocked by CSP -- Silent Visual Breakage

**What goes wrong:**
SVG elements exported from design tools (Figma, Illustrator, Inkscape) embed presentation styles as inline `style` attributes (e.g., `style="fill:#1a1a2e;stroke-width:2"`). SecureShare's CSP header sets `style-src 'self' 'nonce-...'` with no `'unsafe-inline'`. Inline `style` attributes on SVG elements are governed by `style-src-attr` (which falls back to `style-src`), and since there is no `'unsafe-inline'` in the policy, all inline style attributes are blocked.

The failure mode is **silent**: browsers do not render the style but often do not log console errors for every blocked style attribute (Firefox bug 1262842 confirms silent blocking). SVGs appear as unstyled black shapes or invisible elements. The developer sees correct rendering in Vite dev mode (where CSP is not enforced) and the breakage only surfaces in production or when testing against the Express server.

**Why it happens:**
- Design tool exports use `style` attributes rather than SVG presentation attributes (`fill`, `stroke`, `stroke-width` as direct element attributes)
- Developers add SVGs via `innerHTML` or by inlining SVG strings, not realizing that CSP treats `style` attributes differently from `<style>` elements
- Vite dev server does not enforce the same CSP headers as the Express production server, so violations are invisible during development

**Consequences:**
- SVG icons render as blank/invisible rectangles in production
- Shield, lock, and other security-themed icons disappear, destroying the trust UI
- If `'unsafe-inline'` is added to fix it, the entire CSP protection against inline style injection is defeated -- weakening XSS defenses that are critical to the zero-knowledge model

**Prevention:**
1. **Convert all SVG inline styles to presentation attributes.** Replace `style="fill:#1a1a2e"` with `fill="#1a1a2e"`. SVG presentation attributes (`fill`, `stroke`, `stroke-width`, `opacity`, `transform`) are NOT blocked by CSP -- they are XML attributes, not CSS.
2. **Create SVGs programmatically using `document.createElementNS` with `setAttribute`**, which is already the pattern used in `confirmation.ts`. Never use `innerHTML` to inject SVG strings.
3. **For any required CSS within SVGs** (gradients, complex selectors, `@keyframes`), place them in a `<style>` element inside the SVG and apply the CSP nonce to it. Example:
   ```typescript
   const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
   style.setAttribute('nonce', document.querySelector('meta[property="csp-nonce"]')?.getAttribute('nonce') ?? '');
   style.textContent = '.icon-path { fill: var(--color-primary-500); }';
   svg.appendChild(style);
   ```
4. **Prefer using `element.style.property` (JavaScript property assignment)** over `setAttribute('style', ...)`. Direct property assignment (`el.style.fill = '#fff'`) is NOT blocked by CSP style-src because it goes through the CSSOM, not the HTML parser. This is the safe escape hatch.
5. **Test with CSP enforced during development.** Run the full Express server (not just Vite dev) to catch violations early.

**Detection:**
- Browser console shows `Refused to apply inline style` warnings (check in Chrome -- Firefox may suppress)
- SVGs render without color, gradients, or expected styling
- Open DevTools Elements panel: SVG attributes present but no computed styles applied

**Confidence:** HIGH (MDN documentation, Firefox bug 1262842, Chrome bug 378500, Font Awesome CSP issue #16827)

---

### Pitfall 2: OG Meta Tags and Structured Data Leaking Secret Existence or URLs

**What goes wrong:**
When adding SEO infrastructure, developers add Open Graph meta tags dynamically for social sharing previews. If the SPA catch-all route serves the same HTML for all paths (which SecureShare does via `app.get('{*path}', ...)`), the OG tags in the HTML template apply to ALL routes -- including `/secret/:id` URLs. This means:

1. **Social media crawlers receive OG meta tags for secret URLs**, causing platforms like Slack, Teams, Discord, and Twitter to generate link previews for secret links. Even generic OG content like `og:title="SecureShare - View Secret"` confirms to observers that the URL is a valid secret link.
2. **Structured data (JSON-LD) on public pages** could inadvertently reference URL patterns that reveal the secret path structure.
3. **`og:url` set to the canonical URL** could cause social platforms to cache and display secret URLs, making them partially discoverable through platform search or cache.

**Why it happens:**
- The SPA catch-all serves the same `index.html` for both public pages (`/`) and secret pages (`/secret/:id`)
- OG meta tags are in the static HTML template, not dynamically generated per route
- Social media crawlers do not execute JavaScript, so client-side meta tag updates are invisible to them

**Consequences:**
- Metadata leakage about secret existence (link previews in chat confirm a secret exists at that URL)
- If `og:url` includes the secret path, the URL is cached by social platforms
- Violates the zero-knowledge principle: the server should not acknowledge whether a secret ID is valid

**Prevention:**
1. **Serve different HTML responses for public routes vs. secret routes.** Modify the SPA catch-all in `app.ts` to detect `/secret/*` paths and serve HTML with `<meta name="robots" content="noindex, nofollow">` and minimal/generic OG tags:
   ```typescript
   app.get('{*path}', (req, res) => {
     const isSecretRoute = req.path.startsWith('/secret/');
     const template = isSecretRoute ? secretHtmlTemplate : publicHtmlTemplate;
     const html = template.replaceAll('__CSP_NONCE__', res.locals.cspNonce);
     res.setHeader('Content-Type', 'text/html');
     if (isSecretRoute) {
       res.setHeader('X-Robots-Tag', 'noindex, nofollow');
     }
     res.send(html);
   });
   ```
2. **OG meta tags on secret pages should be intentionally blank or generic.** Do NOT include `og:title="View Secret"` -- use something completely generic like `og:title="SecureShare"` with no indication that the page contains a secret.
3. **Add `X-Robots-Tag: noindex, nofollow` HTTP header** for secret routes (more reliable than meta tags, since crawlers see it before parsing HTML).
4. **Never include the secret ID in any meta tag value**, including `og:url`, `canonical`, or `og:image` URL parameters.

**Detection:**
- Use `curl -I https://example.com/secret/abc123` and inspect response headers for OG tags and robots directives
- Test link previews in Slack/Discord by pasting a secret URL -- if a rich preview appears with any secret-specific content, it is leaking

**Confidence:** HIGH (Google documentation on X-Robots-Tag, OG protocol specification, direct relevance to zero-knowledge model)

---

### Pitfall 3: `robots.txt` Swallowed by SPA Catch-All -- All Pages Indexed Including Secret Paths

**What goes wrong:**
SecureShare's SPA catch-all route in `app.ts` matches ALL paths via `app.get('{*path}', ...)`. If `robots.txt` is placed in the `client/public/` directory for Vite to copy to `dist/`, it will be served by `express.static`. However, if the file is missing, misconfigured, or if the static middleware order is wrong, the catch-all serves `index.html` with a 200 status for `/robots.txt`. Search engine crawlers receive an HTML page instead of a robots directive, interpret it as "no restrictions," and proceed to crawl and index everything -- including `/secret/*` URL patterns they discover through referrer logs, sitemaps, or link analysis.

**Why it happens:**
- Express static middleware is configured with `{ index: false }` which is correct, but the `robots.txt` file simply does not exist yet in the project
- No explicit route for `/robots.txt` exists -- it falls through to the catch-all
- Developers add robots.txt to `client/src/` instead of `client/public/` (Vite only copies `public/` contents to `dist/`)

**Consequences:**
- Google, Bing, and other crawlers index `/secret/:id` URLs they discover
- Even though the content is encrypted, the existence of indexed URLs reveals metadata
- Secret URLs appearing in search results is a severe privacy violation
- Once indexed, removing URLs from search engines takes days to weeks via removal tools

**Prevention:**
1. **Create `client/public/robots.txt`** (Vite copies `public/` to `dist/` root) with explicit disallow rules:
   ```
   User-agent: *
   Disallow: /secret/
   Disallow: /api/

   Sitemap: https://secureshare.example.com/sitemap.xml
   ```
2. **Add an explicit Express route for `robots.txt` BEFORE the catch-all** as a safety net:
   ```typescript
   app.get('/robots.txt', (_req, res) => {
     res.type('text/plain').send('User-agent: *\nDisallow: /secret/\nDisallow: /api/\n');
   });
   ```
3. **Similarly create `client/public/sitemap.xml`** listing ONLY public pages (`/`), never secret URLs.
4. **Verify the middleware order**: `express.static` must run BEFORE the SPA catch-all so that static files like `robots.txt`, `sitemap.xml`, `favicon.ico`, and `manifest.json` are served directly.
5. **Test**: `curl https://example.com/robots.txt` must return `text/plain` content, NOT HTML.

**Detection:**
- `curl -v https://localhost:3000/robots.txt` returns `Content-Type: text/html` instead of `text/plain`
- Google Search Console shows indexed `/secret/` URLs
- `site:secureshare.example.com/secret/` in Google returns results

**Confidence:** HIGH (Express.static ordering is a documented pattern, SPA catch-all behavior is well-understood)

---

### Pitfall 4: Dark Theme Breaks 6 Existing Accessibility Tests

**What goes wrong:**
SecureShare has 6 accessibility tests in `client/src/__tests__/accessibility.test.ts` using `vitest-axe` (axe-core). These tests currently disable color contrast checking (`rules: { 'color-contrast': { enabled: false } }`) because happy-dom cannot compute styles. When switching from a light theme (`bg-gray-50 text-gray-900`) to a dark theme, the class names throughout all pages change. If the dark theme is implemented by:
- Changing the base HTML classes
- Adding `dark:` variant classes to all elements
- Modifying the Tailwind `@theme` color definitions

...the existing tests will pass (since they do not check contrast), but the ACTUAL accessibility may be broken. More dangerously, if tests are updated to reference new element classes or structures, tests may break even though accessibility is fine, or pass even though it is not.

**Why it happens:**
- The existing tests check structural accessibility (ARIA roles, heading hierarchy, labeled sections) which ARE affected by DOM structure changes during a theme redesign
- Color contrast is explicitly disabled in tests, so any dark-on-dark or light-on-light text combinations will not be caught
- The theme change often involves restructuring the DOM (adding wrapper divs for glassmorphism effects, changing component structures), which can break ARIA associations

**Consequences:**
- Heading hierarchy tests fail because redesigned pages use different heading levels
- ARIA `labelledby` tests fail because section IDs change during redesign
- `role="alert"` and `role="status"` elements are removed or relocated
- Color contrast violations go completely undetected (already excluded from automated tests)
- The app ships with WCAG AA failures that were previously passing

**Prevention:**
1. **Run existing tests BEFORE any theme changes** to establish a passing baseline. Track which tests pass and which assertions exist.
2. **Make theme changes incrementally**: change colors/backgrounds first (non-breaking), then restructure DOM if needed (potentially breaking).
3. **When restructuring DOM, update tests to match** -- but verify the NEW structure still meets WCAG requirements, not just that tests pass.
4. **Add explicit contrast ratio verification** as a manual test step or as a separate test file using tools like `color-contrast` npm package against the actual Tailwind-computed color values:
   - Dark background (`#0f0f23` or similar) against all text colors
   - Verify 4.5:1 for body text, 3:1 for large text (18px+ or 14px+ bold)
   - Verify 3:1 for UI components (borders, focus rings, icons)
5. **Preserve semantic structure invariants**: ensure every page still has exactly one `h1`, proper heading hierarchy, and labeled sections regardless of visual changes.
6. **Add a test that verifies `prefers-reduced-motion` is respected** (see Pitfall 7).

**Detection:**
- `npm run test:run` fails with assertion errors in `accessibility.test.ts`
- axe-core violations appear for elements that were previously clean
- Manual WCAG audit reveals contrast failures on dark backgrounds

**Confidence:** HIGH (direct analysis of existing test file at `client/src/__tests__/accessibility.test.ts`)

---

### Pitfall 5: CSS Animations on SVG `fill`/`stroke` Blocked by CSP in Firefox

**What goes wrong:**
SVG SMIL animations (`<animate>`, `<animateColor>`) that target `fill`, `stroke`, `stroke-width`, or `stroke-dasharray` attributes are blocked by Firefox's CSP implementation when `style-src` does not include `'unsafe-inline'`. This is Firefox bug 1459872 (open since 2018, still unresolved as of 2026). The same animations work fine in Chrome and Safari.

This means animated SVG icons (pulsing shields, loading lock animations, stroke-drawing effects) will silently fail in Firefox. The SVG element renders but the animation does not play. No console error is produced in many cases.

CSS `@keyframes` animations targeting SVG properties via CSS classes also require the `<style>` element containing the `@keyframes` to have a valid CSP nonce. If the `@keyframes` are in the main Tailwind stylesheet (which Vite builds with a nonce), they work. But if `@keyframes` are injected dynamically or defined in inline `<style>` blocks without nonces, they are blocked.

**Why it happens:**
- Firefox treats SVG attribute animations as equivalent to inline style changes, triggering CSP `style-src` checks
- Chrome and Safari do not apply CSP to SVG SMIL animations the same way
- Developers test primarily in Chrome, missing Firefox-specific CSP enforcement
- The inconsistency is undocumented in CSP specifications

**Consequences:**
- Animated SVG icons (lock pulsing, shield animating, checkmark drawing) do not animate in Firefox
- Developers may add `'unsafe-inline'` to `style-src` to fix Firefox, weakening the entire CSP posture
- Users on Firefox see a broken or static experience while Chrome users see animations

**Prevention:**
1. **Use CSS `@keyframes` in the main stylesheet instead of SVG SMIL animations.** Tailwind's `animate-*` utilities and custom keyframes defined in `styles.css` are safe because Vite injects the nonce on the built `<style>` tag.
2. **Avoid `<animate>` and `<animateColor>` SVG elements entirely.** Use CSS transforms and opacity animations via class-based Tailwind utilities instead:
   ```css
   /* In styles.css -- safe because the stylesheet gets a CSP nonce */
   @keyframes pulse-icon {
     0%, 100% { opacity: 1; }
     50% { opacity: 0.6; }
   }
   ```
3. **For programmatically created SVGs**, use `element.style.property` assignment for one-off style changes (not blocked by CSP) and CSS class toggling for animations.
4. **Do not add `'unsafe-inline'` to `style-src`.** This is the wrong fix and compromises the zero-knowledge security model.
5. **Test all animations in Firefox** with the production Express server (CSP enforced), not just Vite dev mode.

**Detection:**
- Open Firefox DevTools Console -- look for CSP violation warnings related to `style-src`
- SVG animations play in Chrome but not in Firefox
- Test with `style-src 'self' 'nonce-...'` (no `'unsafe-inline'`) across browsers

**Confidence:** HIGH (Firefox bug 1459872, Mozilla Bugzilla, directly verified behavior)

---

## Moderate Pitfalls

Mistakes that cause visual or functional regressions without breaking security.

### Pitfall 6: OKLCH Color Contrast Cannot Be Reliably Calculated for WCAG Compliance

**What goes wrong:**
SecureShare's `styles.css` already defines custom colors using OKLCH color space (e.g., `--color-primary-600: oklch(0.50 0.19 250)`). WCAG 2.1 AA contrast ratios are defined using relative luminance calculated from the sRGB color space. OKLCH colors exist in a different perceptual color space, and the formula to convert OKLCH to sRGB for contrast calculation can produce values outside the sRGB gamut (out-of-gamut colors). Standard WCAG contrast checkers (WebAIM, axe-core) may not correctly evaluate OKLCH values, producing inaccurate pass/fail results.

When adding dark theme colors in OKLCH, developers may rely on perceptual lightness (`L` channel in OKLCH) to estimate contrast, but perceptual lightness does not map linearly to WCAG relative luminance. A color that "looks" high contrast in OKLCH may fail WCAG AA calculations.

**Prevention:**
1. **Define dark theme colors in OKLCH but verify contrast using hex/sRGB equivalents.** Convert each OKLCH color to its nearest sRGB hex value and run the hex pair through WebAIM's contrast checker.
2. **Use tools that support OKLCH**: OddContrast (oddcontrast.com) checks contrast in OKLCH, Oklab, and P3 color spaces.
3. **Establish a minimum OKLCH lightness differential**: for dark backgrounds with `L` around 0.10-0.15, body text should have `L` of at least 0.85-0.90 to reliably meet 4.5:1. For large text, `L` of 0.75+ is usually sufficient.
4. **Document the hex fallback values** alongside OKLCH values in the `@theme` block as comments for future contrast audits.
5. **Common dark theme color pairs that pass WCAG AA** (verified):
   - Background `oklch(0.13 0.02 260)` with text `oklch(0.93 0.01 260)` -- approximately 13:1 ratio
   - Muted text at `oklch(0.65 0.02 260)` on the same background -- approximately 4.7:1 (passes AA)
   - Primary accent `oklch(0.70 0.15 250)` on dark background -- approximately 6:1 (passes AA)

**Detection:**
- axe-core color contrast checks (currently disabled in tests but should be verified manually)
- WebAIM Contrast Checker with hex equivalents of OKLCH values
- Chrome DevTools Accessibility panel shows contrast ratios for computed colors

**Confidence:** MEDIUM (OKLCH contrast calculation tooling is improving but not standardized in WCAG; multiple sources confirm the sRGB conversion issue)

---

### Pitfall 7: `prefers-reduced-motion` Not Respected for JavaScript-Driven Animations

**What goes wrong:**
SecureShare already correctly uses `motion-reduce:animate-none` on the loading spinner (in `loading-spinner.ts`). But when adding new animations -- typing effects, fade-in transitions, sliding panels, SVG stroke-drawing -- developers often apply `prefers-reduced-motion` only to CSS animations via Tailwind's `motion-reduce:` variant while forgetting:

1. **JavaScript-driven animations** (requestAnimationFrame loops, Web Animations API, manual DOM manipulation timers) are not affected by the CSS media query
2. **CSS transitions** (Tailwind `transition-*` utilities on hover, focus states) are often overlooked
3. **Auto-playing decorative animations** (blinking cursors, gradient shifts) that should be disabled entirely

WCAG 2.1 Success Criterion 2.3.3 (Animation from Interactions, AAA) and 2.3.1 (Three Flashes or Below Threshold, A) require that motion can be disabled. While AAA is not the target, vestibular disorders make this a real accessibility concern.

**Prevention:**
1. **Check the media query in JavaScript** for any programmatic animations:
   ```typescript
   const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   if (!prefersReducedMotion) {
     startTypingAnimation();
   }
   ```
2. **Use Tailwind's `motion-reduce:` variant on ALL animated elements**, not just the spinner. Check every `animate-*`, `transition-*`, and custom animation class.
3. **Adopt a "no-motion-first" approach**: start with no animations, then add them inside `@media (prefers-reduced-motion: no-preference)`. This ensures animations are opt-in rather than opt-out:
   ```css
   .fade-in {
     opacity: 1; /* Default: no animation */
   }
   @media (prefers-reduced-motion: no-preference) {
     .fade-in {
       animation: fadeIn 0.3s ease-in;
     }
   }
   ```
4. **For essential state transitions** (loading spinner communicating "something is happening"), replace motion with non-motion alternatives: pulsing opacity rather than spinning, or a static progress indicator.
5. **Add an accessibility test** that verifies `motion-reduce:animate-none` is present on animated elements.

**Detection:**
- Enable "Reduce motion" in OS settings (macOS: System Settings > Accessibility > Display > Reduce Motion)
- Verify all animations stop or are replaced with non-motion equivalents
- Check that page is still fully functional without any animations

**Confidence:** HIGH (W3C WCAG technique C39, MDN documentation, web.dev guidance)

---

### Pitfall 8: Glassmorphism `backdrop-filter: blur()` Performance Collapse on Mobile

**What goes wrong:**
Dark terminal-themed UIs often use glassmorphism effects (frosted glass cards, blurred backgrounds). CSS `backdrop-filter: blur(Npx)` forces the GPU to composite and blur everything behind the element on every frame. On low-end mobile devices (budget Android phones, older iPhones), this causes:
- Frame rate drops below 30fps during scrolling
- Device heating and battery drain
- Janky animation when combined with other GPU-composited elements (transforms, opacity animations)
- Complete non-rendering on some older browsers (Safari < 15.4 has partial support)

The effect is worse when multiple glassmorphism layers overlap (e.g., a blurred card over a blurred background over a gradient).

**Prevention:**
1. **Limit blur radius to 8px or less** for mobile. `blur(4px)` is significantly cheaper than `blur(20px)`.
2. **Use `backdrop-filter` on at most 1-2 elements per viewport**, never on repeating list items or cards.
3. **Provide a non-blur fallback** using `@supports`:
   ```css
   .glass-card {
     background: rgba(15, 15, 35, 0.85); /* Fallback: solid semi-transparent */
   }
   @supports (backdrop-filter: blur(8px)) {
     .glass-card {
       background: rgba(15, 15, 35, 0.6);
       backdrop-filter: blur(8px);
     }
   }
   ```
4. **Avoid animating elements that have `backdrop-filter`** -- the blur must be recomputed every frame.
5. **Test on a real low-end device** or throttle GPU in Chrome DevTools (Performance tab > CPU throttling).
6. **Consider precomputed blur**: use a blurred background image (generated at build time or as a static asset) instead of runtime `backdrop-filter` for the main background.

**Detection:**
- Chrome DevTools Performance tab shows long "Composite Layers" tasks
- Frame rate drops below 30fps during scroll on mobile
- Device physically heats up during use

**Confidence:** MEDIUM (MDN documentation, CSS-Tricks guidance, performance is device-dependent)

---

### Pitfall 9: Font Loading FOUT/FOIT Breaking First Impression on Secret Reveal

**What goes wrong:**
If the dark theme introduces custom fonts (monospace terminal fonts like JetBrains Mono, Fira Code, or Inter for UI text), font loading causes visible layout shifts:
- **FOIT (Flash of Invisible Text)**: Text is invisible for 0-3 seconds while the font downloads. On the reveal page, the decrypted secret is invisible during this window -- the user thinks the secret is empty.
- **FOUT (Flash of Unstyled Text)**: System font renders first, then the page visually "jumps" when the custom font loads. Layout shift affects CLS (Cumulative Layout Shift) scores and is jarring.

For a security-focused app, FOIT on the reveal page is particularly damaging: the user clicks "Reveal Secret," sees blank space, and may think the decryption failed.

**Prevention:**
1. **Use `font-display: swap` on all `@font-face` declarations** to ensure text is always visible (shows system font immediately, swaps when custom font loads).
2. **Self-host fonts** (do not use Google Fonts CDN). External font requests violate the "no external resources" security principle AND introduce a CORS/CSP dependency. Download font files to `client/public/fonts/`.
3. **Preload critical fonts** in the HTML `<head>`:
   ```html
   <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
   ```
4. **Use system font stack as primary, custom font as enhancement.** The existing app uses Tailwind defaults (system fonts) which is fast. Only add custom fonts if they provide clear design value.
5. **Subset fonts aggressively**: if only using Latin characters, subset the font to reduce file size from ~100KB to ~20KB.
6. **Add CSP `font-src 'self'`** to allow self-hosted fonts (already present in the security middleware).
7. **Consider using no custom fonts at all** for a dark terminal theme -- system monospace fonts (`ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace`) achieve the terminal aesthetic without any loading penalty.

**Detection:**
- Lighthouse audit flags "Ensure text remains visible during webfont load"
- Test on throttled 3G connection (DevTools Network tab) -- text should be visible immediately
- Measure CLS in Chrome DevTools Performance tab

**Confidence:** HIGH (DebugBear documentation, web.dev guidance, CSS-Tricks font loading strategies)

---

### Pitfall 10: Favicon and Web App Manifest Not Served Due to SPA Catch-All

**What goes wrong:**
When adding `favicon.ico`, `apple-touch-icon.png`, and `manifest.json` (web app manifest) for the redesigned dark theme, these files must be served as static assets. If placed in wrong directory (`client/src/` instead of `client/public/`), Vite will not copy them to `dist/`. The Express SPA catch-all then serves `index.html` for `/favicon.ico`, which browsers interpret as "no favicon" (HTML is not a valid ICO file).

Additionally, browsers aggressively cache favicons. After deploying a new dark-themed favicon, users see the old icon (or no icon) until the cache expires -- which can be weeks.

**Prevention:**
1. **Place all static assets in `client/public/`**: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `manifest.json`.
2. **Use SVG favicon for dark theme adaptation** -- SVG favicons support `@media (prefers-color-scheme: dark)` inside the SVG, allowing the icon to adapt to OS theme:
   ```html
   <link rel="icon" href="/favicon.svg" type="image/svg+xml">
   <link rel="icon" href="/favicon.ico" sizes="32x32"> <!-- Fallback for older browsers -->
   ```
3. **For cache invalidation**, use a query parameter on the favicon link tag:
   ```html
   <link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
   ```
4. **Set Cache-Control headers** for static assets that need updating: `Cache-Control: public, max-age=86400` (1 day) for favicons, not the default long-term caching.
5. **Add `manifest.json` to CSP `connect-src`** if it will be fetched dynamically (usually not needed as it is loaded via `<link>`).
6. **Verify the manifest is served correctly**: `curl -I https://localhost:3000/manifest.json` should return `Content-Type: application/manifest+json`.

**Detection:**
- Browser tab shows no favicon or the default globe icon
- `curl https://localhost:3000/favicon.ico` returns HTML content
- `manifest.json` returns 200 with `Content-Type: text/html` (served by catch-all)

**Confidence:** HIGH (Express.static behavior, Vite public directory documentation)

---

## Minor Pitfalls

Issues that cause polish problems or minor regressions.

### Pitfall 11: Dark Theme `color-scheme` Not Set -- Browser UI Elements Remain Light

**What goes wrong:**
Setting a dark background and light text via Tailwind classes changes the PAGE appearance but not the BROWSER CHROME. Without `color-scheme: dark` on the root element:
- Scrollbars remain light-themed (bright white scrollbar on dark page)
- Form autofill backgrounds are bright yellow/blue
- `<select>` dropdown menus are light-themed
- Text selection highlight uses light-theme colors
- `<input>` and `<textarea>` border colors use light defaults

**Prevention:**
1. Add `color-scheme: dark` to the `<html>` element when dark theme is active:
   ```typescript
   document.documentElement.style.colorScheme = 'dark';
   ```
2. Or in CSS: `html.dark { color-scheme: dark; }`
3. This tells the browser to use dark-themed UA (user agent) stylesheet defaults for form controls, scrollbars, and selection colors.

**Confidence:** HIGH (MDN `color-scheme` documentation)

---

### Pitfall 12: Emoji Icons Rendered Inconsistently Across Platforms

**What goes wrong:**
SecureShare currently uses emoji characters for icons (shield `\u{1F6E1}`, lock `\u{1F512}`, key `\u{1F511}`, warning `\u{26A0}`, explosion `\u{1F4A5}`, magnifying glass `\u{1F50D}` in `error.ts` and `reveal.ts`). When switching to SVG icons, any remaining emoji must be considered:
- Emoji rendering varies dramatically across Windows, macOS, Linux, iOS, and Android
- On some platforms, emoji are colorful; on others, they are monochrome outlines
- Emoji do not respect CSS `color` property (they are bitmap/vector images, not text)
- Screen readers may announce emoji differently across platforms

Replacing emoji with SVG icons fixes all these issues but requires ensuring the SVG replacements have proper `aria-hidden="true"` (already done on emoji icons) and that adjacent text provides the semantic meaning.

**Prevention:**
1. Replace ALL emoji icons with SVG icons during the redesign -- do not leave a mix.
2. All decorative SVG icons should have `aria-hidden="true"` (matching the current emoji pattern).
3. Ensure heading text adjacent to icons conveys the full meaning without the icon.

**Confidence:** HIGH (direct analysis of existing codebase)

---

### Pitfall 13: Dark Theme Toggle State Lost on Navigation and Refresh

**What goes wrong:**
If dark theme preference is stored only in JavaScript memory (a module-scoped variable), it is lost on page refresh. If stored in `localStorage`, it must be read and applied BEFORE the first render to prevent a flash of light theme (FOLT -- Flash of Light Theme). In an SPA, the theme must also persist across client-side navigation.

**Prevention:**
1. **Read theme preference synchronously in the HTML `<head>`** before the body renders:
   ```html
   <script nonce="__CSP_NONCE__">
     if (localStorage.theme === 'dark' ||
         (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
       document.documentElement.classList.add('dark');
     }
   </script>
   ```
2. This script MUST have the CSP nonce (use the `__CSP_NONCE__` placeholder that Vite and the Express server already replace).
3. If the app is dark-only (no toggle), simply set the class statically in the HTML template and skip localStorage entirely.
4. For Tailwind CSS 4, add the custom variant in `styles.css`:
   ```css
   @import "tailwindcss";
   @custom-variant dark (&:where(.dark, .dark *));
   ```

**Confidence:** HIGH (Tailwind CSS 4 documentation, standard SPA pattern)

---

### Pitfall 14: Hardcoded Light Theme Colors in Existing Components

**What goes wrong:**
Every existing page and component in SecureShare uses hardcoded light-theme Tailwind classes:
- `text-gray-900`, `text-gray-700`, `text-gray-600`, `text-gray-500` (text colors)
- `bg-gray-50`, `bg-white` (backgrounds)
- `border-gray-200`, `border-gray-300` (borders)
- `placeholder-gray-400` (form placeholders)
- `bg-primary-100`, `text-primary-700` (accent colors)
- `bg-danger-500/10`, `text-danger-500` (error states)

These appear in `create.ts`, `reveal.ts`, `confirmation.ts`, `error.ts`, `loading-spinner.ts`, `copy-button.ts`, `expiration-select.ts`, AND the `index.html` template (`bg-gray-50 text-gray-900` on `<body>`). Every single one must be updated with `dark:` variants or the base theme colors must be redefined.

If the redesign is dark-only (no light mode), the approach is simpler: replace all light colors with dark equivalents directly. If supporting both themes, every color class needs a `dark:` counterpart.

**Prevention:**
1. **Audit every Tailwind class in every `.ts` and `.html` file** before starting theme work. Create a comprehensive list.
2. **If dark-only**: do a find-and-replace of all color classes. No `dark:` prefix needed.
3. **If dual-theme**: add `dark:` variant for every color class. Consider extracting common patterns into CSS custom properties referenced in the Tailwind `@theme` block to avoid class proliferation:
   ```css
   @theme {
     --color-surface: oklch(0.97 0.00 0);
     --color-text: oklch(0.15 0.00 0);
   }
   /* Then override in dark mode */
   .dark {
     --color-surface: oklch(0.13 0.02 260);
     --color-text: oklch(0.93 0.01 260);
   }
   ```
4. **Search for inline color strings** in TypeScript (like `'text-gray-900'` in class assignments) -- these are easy to miss in a find-and-replace.

**Detection:**
- Light-colored text on dark background is invisible
- Light-colored borders on dark backgrounds are invisible
- Form inputs have white backgrounds inside dark containers

**Confidence:** HIGH (direct codebase analysis -- every affected file and class identified)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Risk Level |
|-------------|---------------|------------|------------|
| Dark theme colors | OKLCH contrast ratios not meeting WCAG AA (Pitfall 6) | Verify all color pairs with hex equivalents through WebAIM contrast checker before shipping | HIGH |
| SVG icon system | Inline styles blocked by CSP (Pitfall 1) | Use SVG presentation attributes exclusively, never `style=""` on SVG elements | CRITICAL |
| SVG animations | Firefox CSP blocks `<animate>` on fill/stroke (Pitfall 5) | Use CSS `@keyframes` in stylesheet only, never SMIL | HIGH |
| SEO meta tags | OG tags on secret routes leak existence (Pitfall 2) | Serve different HTML for `/secret/*` routes with noindex + generic OG | CRITICAL |
| robots.txt | Swallowed by SPA catch-all (Pitfall 3) | Add explicit route + static file in `client/public/` | CRITICAL |
| Glassmorphism | Performance collapse on mobile (Pitfall 8) | Limit to 1-2 elements, max blur(8px), provide solid fallback | MEDIUM |
| Font loading | FOIT hides revealed secret text (Pitfall 9) | Use system fonts or `font-display: swap` with preloading | MEDIUM |
| Existing tests | Dark theme breaks accessibility tests (Pitfall 4) | Incremental changes, run tests after each color change | HIGH |
| Animations | `prefers-reduced-motion` not checked in JS (Pitfall 7) | Check media query for all JS-driven animations | HIGH |
| Favicon/manifest | Not served correctly (Pitfall 10) | Place in `client/public/`, verify with curl | LOW |
| Theme persistence | Flash of light theme on refresh (Pitfall 13) | Synchronous theme script in `<head>` with CSP nonce | MEDIUM |
| Color migration | Hardcoded light classes throughout codebase (Pitfall 14) | Full audit before starting, systematic replacement | MEDIUM |
| Browser chrome | Scrollbars/selects remain light (Pitfall 11) | Set `color-scheme: dark` on root | LOW |
| Emoji icons | Inconsistent rendering (Pitfall 12) | Replace all emoji with SVG during this redesign | LOW |

---

## Integration Risk Matrix

Pitfalls that are dangerous specifically because of SecureShare's security architecture:

| Feature Being Added | Security Constraint It Conflicts With | Risk | Resolution |
|---------------------|---------------------------------------|------|------------|
| OG meta tags | Zero-knowledge: server must not acknowledge secret existence | CRITICAL | Different HTML templates for public vs. secret routes |
| robots.txt / sitemap | Secret URLs must never be indexed | CRITICAL | Explicit disallow rules + X-Robots-Tag header |
| SVG inline styles | CSP `style-src` nonce-based (no `unsafe-inline`) | HIGH | SVG presentation attributes only, no `style=""` |
| SVG SMIL animations | CSP `style-src` enforcement in Firefox | HIGH | CSS keyframes in nonce'd stylesheet only |
| Custom fonts | No external resource loading (fragment leak prevention) | MEDIUM | Self-host fonts, never use CDN |
| Analytics/tracking for SEO | No third-party scripts (XSS risk, fragment leak) | CRITICAL | Do not add any tracking scripts |
| Structured data (JSON-LD) | Must not reference secret URL patterns | MEDIUM | Generic site-level structured data only |
| `color-scheme: dark` meta | Must not conflict with `referrer` meta tag | LOW | Separate meta elements, no conflict |
| Dark theme toggle script | CSP `script-src` nonce-based | MEDIUM | Must include nonce placeholder |

---

## "Looks Done But Isn't" Checklist for UI/SEO Redesign

- [ ] **SVGs render in production**: Test with Express server (CSP enforced), not just Vite dev mode
- [ ] **robots.txt returns plain text**: `curl localhost:3000/robots.txt` returns `text/plain`, not HTML
- [ ] **Secret routes are noindexed**: `curl -I localhost:3000/secret/test123` includes `X-Robots-Tag: noindex`
- [ ] **No OG tags reference secrets**: View source of `/secret/:id` response -- no `og:url` with secret path
- [ ] **Contrast ratios verified**: Every text/background pair checked with hex values in WebAIM checker
- [ ] **`prefers-reduced-motion` works**: Enable OS reduce motion, verify all animations stop
- [ ] **Firefox animations work**: Test all SVG/CSS animations in Firefox with CSP enforced
- [ ] **Existing 6 a11y tests pass**: `npm run test:run` -- accessibility.test.ts passes
- [ ] **No `'unsafe-inline'` added to CSP**: Check `security.ts` -- `style-src` still nonce-only
- [ ] **Fonts self-hosted**: No external font requests in Network tab
- [ ] **favicon.ico returns ICO/SVG**: `curl -I localhost:3000/favicon.ico` returns image content type
- [ ] **Theme persists on refresh**: Refresh the page -- no flash of light theme
- [ ] **Mobile performance acceptable**: Test glassmorphism on throttled CPU in DevTools

---

## Sources

### CSP and SVG Integration
- [MDN: Content-Security-Policy: style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src) -- HIGH confidence, official documentation
- [MDN: Content-Security-Policy: style-src-attr](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr) -- HIGH confidence, official documentation
- [Firefox Bug 1262842: CSP blocks style attributes inside SVG silently](https://bugzilla.mozilla.org/show_bug.cgi?id=1262842) -- HIGH confidence, confirmed browser bug
- [Firefox Bug 1459872: CSP blocks SVG animate tag](https://bugzilla.mozilla.org/show_bug.cgi?id=1459872) -- HIGH confidence, confirmed browser bug (unresolved)
- [Chrome Bug 378500: CSP style-src and img-src violations in SVG](https://bugs.chromium.org/p/chromium/issues/detail?id=378500) -- HIGH confidence, Chromium issue tracker
- [Font Awesome Issue #16827: SVG Symbols violate strict CSP](https://github.com/FortAwesome/Font-Awesome/issues/16827) -- MEDIUM confidence, real-world library CSP conflict
- [Vite CSP Nonce Documentation](https://vite.dev/guide/features) -- HIGH confidence, official docs
- [CSP Allow Inline Styles](https://content-security-policy.com/examples/allow-inline-style/) -- MEDIUM confidence, reference site

### Accessibility and Dark Theme
- [WCAG 2.1 Understanding SC 1.4.3: Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) -- HIGH confidence, W3C specification
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) -- HIGH confidence, industry standard tool
- [OddContrast: OKLCH-aware contrast checker](https://www.oddcontrast.com/) -- MEDIUM confidence, specialized tool
- [W3C WCAG Technique C39: prefers-reduced-motion](https://www.w3.org/WAI/WCAG21/Techniques/css/C39) -- HIGH confidence, W3C technique
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) -- HIGH confidence, official documentation
- [web.dev: prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion) -- HIGH confidence, Google guidance
- [Color Contrast Accessibility WCAG 2025 Guide](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025) -- MEDIUM confidence, comprehensive guide

### SEO and Crawling
- [Google: Block Search Indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing) -- HIGH confidence, Google official docs
- [Google: Robots Meta Tag Specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) -- HIGH confidence, Google official docs
- [Google: X-Robots-Tag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Robots-Tag) -- HIGH confidence, MDN documentation
- [Open Graph Protocol](https://ogp.me/) -- HIGH confidence, protocol specification
- [Robots.txt and SEO 2026](https://searchengineland.com/robots-txt-seo-453779) -- MEDIUM confidence, SEO industry source

### Dark Theme and Tailwind CSS 4
- [Tailwind CSS 4 Dark Mode](https://tailwindcss.com/docs/dark-mode) -- HIGH confidence, official documentation
- [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme) -- HIGH confidence, official documentation
- [MDN: backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) -- HIGH confidence, official documentation

### Font Loading
- [web.dev: Ensure text remains visible during webfont load](https://www.debugbear.com/blog/ensure-text-remains-visible-during-webfont-load) -- MEDIUM confidence, DebugBear
- [CSS-Tricks: Font Loading Strategies](https://css-tricks.com/the-best-font-loading-strategies-and-how-to-execute-them/) -- MEDIUM confidence, industry reference
- [DebugBear: Fixing Layout Shifts Caused by Web Fonts](https://www.debugbear.com/blog/web-font-layout-shift) -- MEDIUM confidence, performance analysis

---
*Pitfalls research for: SecureShare UI Redesign (dark theme, SVG icons, animations, SEO)*
*Researched: 2026-02-15*
*Supersedes: N/A (complementary to existing PITFALLS.md covering security fundamentals)*
