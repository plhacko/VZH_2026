#!/usr/bin/env python3
"""Generate two PDFs from beruna_map/index.html using Playwright/Chromium.

beruna_full.pdf  — entire 594x630mm map on one page
beruna_split.pdf — 6 A4 landscape pages (2 cols x 3 rows)
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

MAP_DIR   = Path(__file__).parent
HTML_FILE = MAP_DIR / "index.html"
FULL_PDF  = MAP_DIR / "beruna_full.pdf"
SPLIT_PDF = MAP_DIR / "beruna_split.pdf"

# JS injected to restructure the page into 6 cropped A4 pages.
# The full SVG (594x630 units) is cloned 6 times; each clone gets a
# 297x210 viewBox slice.  An override style prevents the existing
# @media print rule (svg { width:594mm !important }) from resizing them.
SPLIT_JS = """() => {
    const fullSvg = document.getElementById('map');

    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;padding:0;background:white;';

    const s = document.createElement('style');
    s.textContent = '@media print { .page svg { width:297mm !important; height:210mm !important; } }';
    document.head.appendChild(s);

    const tiles = [[0,0],[297,0],[0,210],[297,210],[0,420],[297,420]];

    for (const [ox, oy] of tiles) {
        const div = document.createElement('div');
        div.className = 'page';
        div.style.cssText = 'width:297mm;height:210mm;overflow:hidden;page-break-after:always;break-after:page;';

        const clone = fullSvg.cloneNode(true);
        clone.setAttribute('viewBox', ox + ' ' + oy + ' 297 210');
        clone.setAttribute('width',  '297mm');
        clone.setAttribute('height', '210mm');
        clone.style.display = 'block';
        clone.removeAttribute('id');

        div.appendChild(clone);
        document.body.appendChild(div);
    }
}"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    pg = browser.new_context().new_page()

    pg.goto(HTML_FILE.as_uri())
    pg.wait_for_selector('#hexes')      # wait until generate() has run

    # 1 — full map on a single non-standard page.
    # Remove the existing @page rule (A4 landscape) that lives inside @media print,
    # then inject a 594x630mm @page and lock body overflow so no bleed triggers
    # a second page.
    pg.evaluate("""() => {
        for (const sheet of [...document.styleSheets]) {
            try {
                for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
                    const r = sheet.cssRules[i];
                    if (r.type === 4) {  // CSSMediaRule
                        for (let j = r.cssRules.length - 1; j >= 0; j--) {
                            if (r.cssRules[j].type === 6) r.deleteRule(j);  // CSSPageRule
                        }
                    }
                    if (r.type === 6) sheet.deleteRule(i);
                }
            } catch(e) {}
        }
    }""")
    pg.add_style_tag(content="""
        @page { size: 594mm 630mm; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important;
                     width: 594mm !important; height: 630mm !important;
                     overflow: hidden !important; }
        #map-wrapper { display: block !important; margin: 0 !important; }
        svg { display: block !important; width: 594mm !important; height: 630mm !important; }
    """)
    pg.pdf(
        path=str(FULL_PDF),
        width="594mm",
        height="630mm",
        print_background=True,
    )
    print(f"Generated {FULL_PDF.name}")

    # 2 — 6 A4 landscape pages: reload fresh so the full-map DOM edits don't carry over
    pg.goto(HTML_FILE.as_uri())
    pg.wait_for_selector('#hexes')
    pg.evaluate(SPLIT_JS)
    pg.pdf(
        path=str(SPLIT_PDF),
        format="A4",
        landscape=True,
        print_background=True,
    )
    print(f"Generated {SPLIT_PDF.name}")

    browser.close()

print("Done.")
