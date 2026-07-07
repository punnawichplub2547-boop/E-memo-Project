/**
 * Scoped styles for the public /manual page.
 *
 * Every colour / radius / shadow here resolves to a design token defined in
 * `globals.css` (which is imported app-wide via the root layout), so the manual
 * reads as the same product as the rest of the app rather than a bolted-on doc.
 * Classes are prefixed `man-` to avoid colliding with the `em-` app component
 * classes. Syne is pulled in only for the display wordmark, mirroring /login.
 */
export function ManualStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');

      .man-root {
        color: var(--ink);
        font-family: var(--font);
        line-height: 1.7;
        -webkit-font-smoothing: antialiased;
      }
      .man-root h1, .man-root h2, .man-root h3, .man-root h4 { margin: 0; text-wrap: balance; }
      .man-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

      /* ── Cover ─────────────────────────────────────────────── */
      .man-cover {
        position: relative;
        overflow: hidden;
        color: #EDF4FF;
        background:
          radial-gradient(70% 120% at 0% 0%, rgba(37,99,235,0.28), transparent 62%),
          radial-gradient(60% 120% at 100% 100%, rgba(59,130,246,0.20), transparent 60%),
          linear-gradient(148deg, #060C1F 0%, #0B1735 44%, #102060 100%);
        padding: 46px 28px 52px;
        border-bottom: 1px solid #060A17;
      }
      .man-cover::before {
        content: "";
        position: absolute; inset: 0; z-index: 0; pointer-events: none;
        background-image: radial-gradient(rgba(147,197,253,0.09) 1px, transparent 1px);
        background-size: 26px 26px;
        mask-image: linear-gradient(180deg, transparent 5%, rgba(0,0,0,0.55) 25%, rgba(0,0,0,0.55) 78%, transparent 98%);
        -webkit-mask-image: linear-gradient(180deg, transparent 5%, rgba(0,0,0,0.55) 25%, rgba(0,0,0,0.55) 78%, transparent 98%);
      }
      .man-cover-inner {
        position: relative; z-index: 1;
        max-width: 1180px; margin: 0 auto;
        display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; align-items: center;
      }
      @media (max-width: 820px) { .man-cover-inner { grid-template-columns: 1fr; gap: 28px; } }
      .man-cover-back {
        display: inline-flex; align-items: center; gap: 7px;
        font-size: 13px; color: var(--ice-300); text-decoration: none; font-weight: 600;
        margin-bottom: 22px; padding: 5px 11px 5px 8px; border-radius: 999px;
        border: 1px solid rgba(147,197,253,0.24); background: rgba(37,99,235,0.10);
        transition: background 160ms, border-color 160ms;
      }
      .man-cover-back:hover { background: rgba(37,99,235,0.18); border-color: rgba(147,197,253,0.40); }
      .man-cover-kicker {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 11.5px; letter-spacing: 0.14em; text-transform: uppercase;
        color: var(--ice-300); background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.14);
        padding: 6px 12px; border-radius: 999px; margin-bottom: 16px;
      }
      .man-cover h1 {
        font-size: clamp(27px, 4vw, 40px); color: #fff; line-height: 1.22; font-weight: 800;
        font-family: 'Syne', var(--font); letter-spacing: -0.01em;
      }
      .man-cover .man-lede { color: rgba(219,234,254,0.82); font-size: 16px; max-width: 46ch; margin-top: 14px; }
      .man-cover-meta { display: flex; gap: 24px; margin-top: 26px; flex-wrap: wrap; }
      .man-cover-meta div { font-size: 12.5px; color: rgba(147,197,253,0.62); }
      .man-cover-meta strong { display: block; color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 2px; }
      .man-cover-card {
        background: rgba(255,255,255,0.055);
        border: 1px solid rgba(255,255,255,0.13);
        border-radius: 16px; padding: 22px 24px;
        backdrop-filter: blur(2px);
      }
      .man-cover-card h3 { color: #fff; font-size: 14.5px; margin-bottom: 14px; font-weight: 700; }
      .man-cover-card ol { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 11px; }
      .man-cover-card li {
        display: grid; grid-template-columns: 24px 1fr; gap: 11px;
        font-size: 13px; color: rgba(215,221,240,0.92); align-items: center;
      }
      .man-cover-card li b {
        width: 24px; height: 24px; border-radius: 7px;
        background: rgba(201,168,76,0.28); border: 1px solid var(--gold);
        color: var(--gold-2); display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700; font-family: var(--font-mono);
      }

      /* ── Shell (TOC + main) ────────────────────────────────── */
      .man-shell {
        max-width: 1180px; margin: 0 auto;
        display: grid; grid-template-columns: 240px minmax(0, 1fr);
        gap: 48px; padding: 0 28px 88px;
      }
      @media (max-width: 920px) { .man-shell { grid-template-columns: 1fr; gap: 8px; } }
      .man-toc { position: sticky; top: 24px; align-self: start; padding-top: 38px; }
      @media (max-width: 920px) { .man-toc { position: static; padding-top: 30px; } }
      .man-toc-label {
        font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
        color: var(--muted-2); margin-bottom: 12px; font-weight: 700;
      }
      .man-toc nav { display: flex; flex-direction: column; gap: 2px; }
      .man-toc a {
        display: block; padding: 8px 12px; border-radius: 9px;
        color: var(--ink-2); text-decoration: none; font-size: 13.5px;
        border-left: 2px solid transparent;
        transition: background 140ms, color 140ms;
      }
      .man-toc a:hover { background: var(--surface); color: var(--primary); border-left-color: var(--primary); }
      .man-toc a.sub { padding-left: 26px; font-size: 12.5px; color: var(--muted); }

      /* ── Main content ──────────────────────────────────────── */
      .man-main { padding-top: 38px; min-width: 0; }
      .man-section { margin-bottom: 60px; scroll-margin-top: 20px; }
      .man-eyebrow {
        font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
        color: var(--primary); font-weight: 700; margin-bottom: 8px;
        display: inline-flex; align-items: center; gap: 8px;
      }
      .man-eyebrow::before {
        content: ""; width: 16px; height: 2px; border-radius: 2px;
        background: linear-gradient(90deg, var(--primary), rgba(96,165,250,0.35));
      }
      .man-section h2 { font-size: 25px; font-weight: 700; letter-spacing: -0.015em; margin-bottom: 6px; }
      .man-section-desc { color: var(--muted); font-size: 14.5px; max-width: 66ch; margin-top: 8px; }
      .man-rule { height: 1px; background: var(--line); margin: 14px 0 26px; }

      .man-step-title { display: flex; align-items: center; gap: 12px; font-size: 17px; font-weight: 700; margin: 32px 0 12px; }
      .man-step-badge {
        width: 28px; height: 28px; border-radius: 8px;
        background: var(--primary-grad); color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 700; font-family: var(--font-mono); flex-shrink: 0;
        box-shadow: 0 4px 10px -2px rgba(37,99,235,0.4);
      }
      .man-step-badge.warn { background: var(--gold-grad); color: #2A1F03; box-shadow: 0 4px 10px -2px rgba(201,168,76,0.4); }

      .man-main p { margin: 0 0 14px; max-width: 70ch; }
      ul.man-plain { margin: 0 0 16px; padding-left: 20px; max-width: 68ch; }
      ul.man-plain li { margin-bottom: 7px; }
      .man-main code {
        font-family: var(--font-mono); font-size: 12.5px;
        background: var(--surface-soft); color: var(--primary);
        padding: 1px 6px; border-radius: 5px;
      }

      .man-callout {
        border-radius: 12px; padding: 15px 17px; margin: 18px 0;
        display: grid; grid-template-columns: 26px 1fr; gap: 12px;
        font-size: 14px; max-width: 72ch;
      }
      .man-callout b { display: block; margin-bottom: 3px; }
      .man-callout .ic {
        width: 26px; height: 26px; border-radius: 7px;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 800; flex-shrink: 0;
      }
      .man-callout.gold { background: var(--gold-soft); border: 1px solid rgba(201,168,76,0.42); color: #5B4A18; }
      .man-callout.gold .ic { background: var(--gold-grad); color: #2A1F03; }
      .man-callout.blue { background: var(--primary-grad-soft); border: 1px solid var(--ice-200); color: #1D3A82; }
      .man-callout.blue .ic { background: var(--primary-grad); color: #fff; }

      /* ── Illustration frame ────────────────────────────────── */
      .man-shot {
        margin: 22px 0 9px; border-radius: 16px; border: 1px solid var(--line);
        background: var(--surface); box-shadow: var(--shadow-lg); overflow: hidden;
      }
      .man-shot-chrome {
        display: flex; align-items: center; gap: 6px;
        padding: 9px 12px; background: var(--surface-2); border-bottom: 1px solid var(--line);
      }
      .man-shot-chrome i { width: 9px; height: 9px; border-radius: 50%; background: var(--line-strong); display: block; }
      .man-shot-chrome span { margin-left: 8px; font-size: 11.5px; color: var(--muted); font-family: var(--font-mono); }
      .man-figcaption { font-size: 12.5px; color: var(--muted-2); margin: 0 0 4px; padding-left: 2px; }
      /* Mobile-only hint that a desktop-recording GIF scrolls horizontally; hidden on desktop. */
      .man-scroll-hint {
        display: none; align-items: center; gap: 5px; vertical-align: middle;
        font-size: 11px; font-weight: 700; color: var(--primary);
        background: var(--primary-grad-soft); border: 1px solid var(--ice-200);
        padding: 2px 9px; border-radius: 999px; margin-right: 8px;
      }

      /* ── Mini UI kit used inside the illustrations ─────────── */
      .man-mock { font-size: 12px; }
      .man-app-frame { display: grid; grid-template-columns: 150px 1fr; }
      @media (max-width: 640px) { .man-app-frame { grid-template-columns: 104px 1fr; } }
      .man-app-side { background: var(--navy-900); color: #D7DDEE; padding: 14px 10px; }
      .man-app-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 0 4px; }
      .man-app-brand em {
        font-style: normal; width: 24px; height: 24px; border-radius: 7px;
        background: var(--primary-grad); color: #fff;
        display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800;
      }
      .man-app-brand b { font-size: 11px; color: #fff; display: block; }
      .man-app-brand small { font-size: 8.5px; color: var(--ice-300); }
      .man-app-nav div { padding: 7px 9px; border-radius: 7px; font-size: 10.5px; margin-bottom: 2px; color: #B9C3DE; }
      .man-app-nav div.on { background: rgba(59,130,246,0.16); color: #fff; font-weight: 600; }
      .man-app-main { padding: 16px 18px; background: var(--surface-2); }
      .man-app-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 10px; flex-wrap: wrap; }
      .man-crumb { font-size: 9.5px; color: var(--muted-2); margin-bottom: 3px; }
      .man-app-topbar h4 { font-size: 15px; font-weight: 700; }

      .man-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; }
      .man-pill.blue { background: var(--primary-grad); color: #fff; }
      .man-pill.ghost { background: var(--surface); border: 1px solid var(--line); color: var(--muted); }
      .man-pill.good { background: var(--emerald-soft); color: var(--emerald); }
      .man-pill.gold { background: var(--gold-soft); color: #7C5E0F; border: 1px solid rgba(201,168,76,0.4); }

      .man-hero-card {
        background: linear-gradient(135deg, var(--navy-800), #25335A);
        color: #fff; border-radius: 12px; padding: 15px 18px; margin-bottom: 12px;
      }
      .man-hero-card .date { font-size: 9px; letter-spacing: 0.1em; color: var(--ice-300); margin-bottom: 5px; }
      .man-hero-card h5 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
      .man-hero-card p { font-size: 10.5px; color: rgba(198,207,234,0.9); margin: 0; max-width: none; }

      .man-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
      @media (max-width: 640px) { .man-kpi-row { grid-template-columns: repeat(2, 1fr); } }
      .man-kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
      .man-kpi .lbl { font-size: 9px; color: var(--muted-2); margin-bottom: 4px; letter-spacing: 0.04em; }
      .man-kpi .val { font-size: 16px; font-weight: 700; font-family: var(--font-mono); color: var(--ink); }

      .man-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
      .man-field-lbl { font-size: 9.5px; color: var(--slate); margin-bottom: 4px; font-weight: 600; }
      .man-field {
        background: var(--surface-2); border: 1px solid var(--line); border-radius: 7px;
        padding: 7px 10px; font-size: 10.5px; color: var(--muted-2); margin-bottom: 10px;
      }
      .man-field.filled { color: var(--ink); }
      .man-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

      .man-chk-row { display: flex; gap: 8px; align-items: flex-start; padding: 8px 0; border-top: 1px solid var(--line); }
      .man-chk-row:first-of-type { border-top: none; }
      .man-chk-box { width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid var(--muted-2); flex-shrink: 0; margin-top: 1px; }
      .man-chk-box.on { background: var(--gold); border-color: var(--gold); }
      .man-chk-row b { display: block; font-size: 10.5px; }
      .man-chk-row span { font-size: 9.5px; color: var(--muted-2); }

      table.man-mini { width: 100%; border-collapse: collapse; font-size: 10px; }
      table.man-mini th {
        text-align: left; font-size: 8.5px; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--muted-2); padding: 6px 8px; border-bottom: 1px solid var(--line);
      }
      table.man-mini td { padding: 8px; border-bottom: 1px solid var(--line-2); color: var(--ink); }

      .man-mrow { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }

      .man-callout-mini {
        border-radius: 8px; padding: 9px 10px; font-size: 10px; display: flex; gap: 8px;
        background: var(--gold-soft); border: 1px solid rgba(201,168,76,0.42); color: #5B4A18;
      }
      .man-callout-mini .ic {
        width: 16px; height: 16px; border-radius: 5px; background: var(--gold-grad); color: #2A1F03;
        flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 9px;
      }

      .man-avatar-hero {
        background: linear-gradient(135deg, var(--navy-800), #2B3B66);
        color: #fff; border-radius: 12px; padding: 20px 16px; text-align: center; margin-bottom: 12px;
      }
      .man-avatar-circ {
        width: 44px; height: 44px; border-radius: 50%; background: var(--primary-grad);
        display: flex; align-items: center; justify-content: center; margin: 0 auto 8px;
        font-weight: 700; font-size: 14px;
      }

      .man-timeline-item { display: flex; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line); }
      .man-timeline-item:first-of-type { border-top: none; }
      .man-tl-dot {
        width: 18px; height: 18px; border-radius: 50%; background: var(--emerald-soft); color: var(--emerald);
        display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; margin-top: 1px;
      }

      /* ── Footer ────────────────────────────────────────────── */
      .man-footer {
        max-width: 1180px; margin: 0 auto;
        border-top: 1px solid var(--line); padding: 24px 28px 40px;
        color: var(--muted-2); font-size: 12.5px;
        display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; align-items: center;
      }
      .man-footer a { color: var(--primary); text-decoration: none; font-weight: 600; }
      .man-footer a:hover { text-decoration: underline; }

      /* ── Mobile polish (≤640px) ───────────────────────────────
         Tap targets to ~44px, iPhone safe-area insets, tighter
         gutters, and legible desktop-recording GIFs. Desktop (the
         real ≥1100px layout) is untouched — everything is scoped
         here and mirrors the base values it overrides. */
      @media (max-width: 640px) {
        .man-cover {
          padding-top: 34px; padding-bottom: 40px;
          padding-left: max(20px, env(safe-area-inset-left));
          padding-right: max(20px, env(safe-area-inset-right));
        }
        .man-cover-back { padding: 8px 14px 8px 11px; }
        .man-shell {
          padding-left: max(18px, env(safe-area-inset-left));
          padding-right: max(18px, env(safe-area-inset-right));
          padding-bottom: 64px;
        }
        .man-toc a { padding-top: 11px; padding-bottom: 11px; }
        .man-section { margin-bottom: 46px; }
        .man-footer {
          padding-left: max(18px, env(safe-area-inset-left));
          padding-right: max(18px, env(safe-area-inset-right));
          padding-bottom: max(28px, env(safe-area-inset-bottom));
        }
        /* Raster screen recordings can't reflow: let them stay legible
           and scroll horizontally inside their own frame instead of
           shrinking to an unreadable ~320px. Page never scrolls sideways
           — the overflow is clipped to the figure. */
        .man-shot-media { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .man-shot-media > img { min-width: 480px; }
        .man-scroll-hint { display: inline-flex; }
      }

      @media (prefers-reduced-motion: reduce) { .man-root * { animation: none !important; transition: none !important; } }
    `}</style>
  );
}
