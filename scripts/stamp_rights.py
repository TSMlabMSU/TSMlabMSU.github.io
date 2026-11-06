#!/usr/bin/env python3
"""Stamp the publisher-required self-archiving rights statement onto a paper PDF's first page.

Single source of policy: src/data/publisher-policies.yaml. Per-paper metadata: src/data/publications.csl.json.
The statement is DERIVED from (publisher policy + paper version + DOI + volume/page/year) — never hand-written
per paper — so adding a future paper means setting its `version`+`DOI` and re-running, nothing to forget.

Usage:
    python3 scripts/stamp_rights.py <manifest.json> <outdir>

manifest.json: [{ "citekey": "...", "source": "/abs/path.pdf", "r2key": "papers/x.pdf", "version": "aam|vor" }, ...]
Writes stamped <outdir>/<basename(r2key)> for each, and prints a JSON summary to stdout.
Reads CSL + policy relative to the repo root (the script's parent's parent).
"""
import json
import sys
import os
import fitz  # pymupdf
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSL = os.path.join(ROOT, "src/data/publications.csl.json")
POLICY = os.path.join(ROOT, "src/data/publisher-policies.yaml")


def derive_statement(paper, version, policy):
    """Return (statement, error). Mirrors src/lib/rights.ts — keep both in sync."""
    ctype = paper.get("type")
    journal = paper.get("container-title", "")
    if ctype == "paper-conference":
        pol = policy["conference"]
    else:
        pol = policy["journals"].get(journal)
        if not pol:
            return None, f"no policy for publisher/journal '{journal}'"
    if version not in pol.get("hostable", []):
        return None, f"version '{version}' not hostable for '{journal}' (allowed: {pol.get('hostable')})"
    year = paper.get("issued", {}).get("date-parts", [[None]])[0][0]
    doi = paper.get("DOI", "")
    vol = paper.get("volume")
    page = paper.get("page")
    if vol and page:
        volpage = f" {vol}, {page}"
    elif vol:
        volpage = f" {vol}"
    else:
        volpage = ""
    stmt = pol["statement"].format(journal=journal, volpage=volpage, year=year, doi=doi)
    return stmt, None


def stamp(src, out, text):
    doc = fitz.open(src)
    page = doc[0]
    w = page.rect.width
    strip_h = 30.0
    # White strip across the very top margin, then the rights line on top of it.
    page.draw_rect(fitz.Rect(0, 0, w, strip_h), color=None, fill=(1, 1, 1), overlay=True)
    rect = fitz.Rect(36, 3, w - 36, strip_h - 1)
    # Shrink font until the statement fits the two-line strip. Repaint a clean strip BEFORE each
    # attempt so a failed insert never leaves partial text, and raise if it never fits — otherwise
    # the saved PDF would carry a blank strip (no rights line) yet be reported as stamped OK.
    fitted = False
    for size in (7.0, 6.5, 6.0, 5.5, 5.0):
        page.draw_rect(fitz.Rect(0, 0, w, strip_h), color=None, fill=(1, 1, 1), overlay=True)
        leftover = page.insert_textbox(rect, text, fontsize=size, fontname="helv",
                                        color=(0.25, 0.25, 0.25), align=0)
        if leftover >= 0:
            fitted = True
            break
    if not fitted:
        doc.close()
        raise ValueError(f"rights statement does not fit the stamp strip even at 5pt: {text!r}")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    doc.save(out, garbage=3, deflate=True)
    doc.close()


def main():
    manifest = json.load(open(sys.argv[1]))
    outdir = sys.argv[2]
    csl = {p["id"]: p for p in json.load(open(CSL))}
    policy = yaml.safe_load(open(POLICY))
    results = []
    for item in manifest:
        ck = item["citekey"]
        paper = csl.get(ck)
        rec = {"citekey": ck, "r2key": item["r2key"]}
        if not paper:
            rec["error"] = "citekey not in CSL"
            results.append(rec); continue
        if not os.path.isfile(item["source"]):
            rec["error"] = f"source missing: {item['source']}"
            results.append(rec); continue
        stmt, err = derive_statement(paper, item["version"], policy)
        if err:
            rec["error"] = err
            results.append(rec); continue
        out = os.path.join(outdir, os.path.basename(item["r2key"]))
        try:
            stamp(item["source"], out, stmt)
            rec.update(out=out, statement=stmt)
        except Exception as e:  # noqa
            rec["error"] = f"stamp failed: {e}"
        results.append(rec)
    json.dump(results, sys.stdout, indent=2, ensure_ascii=False)
    print()
    ok = sum(1 for r in results if "out" in r)
    sys.stderr.write(f"\nstamped {ok}/{len(results)} OK\n")


if __name__ == "__main__":
    main()
