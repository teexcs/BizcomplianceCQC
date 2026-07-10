# Library additions log

A plain record of documents added to the compliance library, so you can see what changed without digging.

---

## 2026-07-09 — 7 policies added (library 139 → 146)

Seven domiciliary-specific policies that your library didn't have as standalone documents were authored, added to the library folders, registered in `LIBRARY_INDEX.csv`, and seeded into the live system (library bucket + `library_assets`). Confirmed: **146 assets in the database, 0 failures.**

| Ref | Document | Area | Regulatory basis |
|---|---|---|---|
| **SC-11** | Key Holding in Domiciliary Care Policy | 04 Safe Care & Risk Management | HSCA 2008 (RA) Regs 2014, reg 12 |
| **SC-12** | Security of & Access to Service Users' Homes Policy | 04 Safe Care & Risk Management | HSCA 2008 (RA) Regs 2014, reg 12 |
| **CM-09** | Advocacy Policy | 03 Consent & Mental Capacity | Care Act 2014, ss.67–68; Mental Capacity Act 2005, ss.35–39 |
| **ST-12** | Continuity of Care Workers Policy | 11 Staffing, Training & Supervision | HSCA 2008 (RA) Regs 2014, reg 18 |
| **BC-06** | Missed Visits & Service Contingency Policy | 17 Business Continuity & Emergency Planning | HSCA 2008 (RA) Regs 2014, regs 12 & 17 |
| **SG-12** | Gifts, Gratuities & Legacies Policy | 02 Safeguarding Adults | HSCA 2008 (RA) Regs 2014, reg 13; Care Act 2014 |
| **DG-06** | Intimate Personal Care & Contact Policy | 18 Dignity, Equality & Service-User Rights | HSCA 2008 (RA) Regs 2014, regs 9, 10 & 11 |

All are `CQC EXPECTED`, `Policy` type, version 1.0.

### How they were built (so you can trust them)
- **Matched to your existing format exactly** — same `B I Z C O M P L I A N C E` header, area · POLICY line, document-control table, numbered sections (Purpose / Scope / Legislative basis / topic sections with `Source:` citations / Roles table / Monitoring / Evidence an inspector would expect / Review), and the same `[PLACEHOLDER]` convention (`[PROVIDER NAME]`, `[DATE]`, `[REGISTERED MANAGER]`, etc.).
- **Grounded in real UK law only** — every regulation cited (Reg 9, 10, 11, 12, 13, 17, 18; Care Act 2014; Mental Capacity Act 2005) is genuine and matches the citations already used across your library. No invented statistics, standards, or case law. Where a figure is provider-specific (e.g. the gift-value limit), a `[AMOUNT]` placeholder is used rather than asserting a number.
- **Length/depth** comparable to your originals (~700 words each).

### Where they live
- **Files:** in the correct area folders under `~/Downloads/BizCompliance_Domiciliary_Care_Library_COMPLETE/`, named `<REF> <Title>.docx`.
- **Index:** 7 rows appended to `LIBRARY_INDEX.csv` (at the end, grouped together).
- **Live system:** uploaded to the `library` storage bucket and upserted into `library_assets` via `npm run seed:library`.

### Two things to be aware of
1. **Your library is now 146 documents, not 139.** New audits will snapshot a 146-item checklist. Any app copy that still says "139 evidence points" (pricing/marketing) is now slightly out of date — worth updating to 146 when convenient. *(Not changed automatically — that's marketing copy, your call.)*
2. **Existing in-progress audits are unaffected** — they keep the checklist they were created with. Only audits created from now on include the 7 new items.

### Deliberately NOT added (and why)
These appear in generic competitor policy sets but were left out as low-value or setting-inappropriate for domiciliary care. Say the word if you want any of them:
- **Food Safety / Hygiene, "mini-kitchens"** — residential care-home content, not domiciliary.
- **Pets, Dress Code / Uniforms, CCTV in the home** — peripheral / HR-flavoured, minimal CQC weight.
- **Religion & Belief, Advocacy-adjacent duplicates** — already covered within your Equality & Human Rights (DG-02), Person-Centred Care (PC-01) and the new Advocacy policy (CM-09).
