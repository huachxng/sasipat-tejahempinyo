---
publish: true
title: "Bubble Intensity Score"
date: 2026-09-16
updated: 2026-09-16
tags: [research, ai-bubble, bis, composite-index, z-scores]
summary: "One number built from four pillar z-scores that says how closely current market conditions resemble past pre-crash configurations."
---

The Bubble Intensity Score (BIS) is the composite index at the centre of [[AI Bubble Research]]. It is one number, built from four pillars, that says how closely today's conditions resemble the run-up to past bubbles: a resemblance score, not a forecast.

## The four pillars

- **V, Valuation**: Shiller CAPE (PE10).
- **L, Leverage**: nonfinancial corporate debt growth, year on year, averaged in v1.0 with the Chicago Fed NFCI leverage subindex.
- **S, Sentiment**: the VIX, inverted, averaged in v1.0 with the inverted [[Geopolitical Risk Index]]. Calm conditions push the score up; the pillar reads as complacency.
- **C, Concentration**: the Nasdaq Composite divided by the S&P 500, a proxy for tech concentration.

## How it is built

Each indicator is turned into a z-score against its own trailing 120-month mean and population standard deviation (minimum 36 months, window including the current month). Pillars with two indicators average them. BIS is the equal-weighted mean of V, L, S and C. The panel starts in 1985-01 so every scored month has a full decade behind it. Three windows: 1995-2003, 2003-2010 and 2019-2026. An optional readability rescale is BIS* = 50 + 15 x BIS.

## Key numbers (v1.0 run, 2026-09-05)

- Dot-com: first crosses +1.5 in July 1999 and peaks at +2.20 in February 2000, one month before the Nasdaq top. At the peak V = +1.97, L = +1.77, S = -0.15, C = +5.22.
- 2008: the composite never exceeds +0.43. The leverage pillar alone peaks at +2.11 in December 2007. The composite missed 2008 because 2008 was a credit crisis, not an equity-valuation bubble; see [[Minsky Moments]].
- AI era: window maximum +1.63 in December 2020. June 2026 reads +0.78 with V = +2.14, L = -0.05, S = -0.59, C = +1.63. Valuation is at December 1999 levels (+2.39 by August 2026 against +2.33 then); leverage sits at its decade average.

The Python prototype (v0.1, June 2026) gave +1.81 for March 2000, +0.30 for July 2007 and +0.93 for May 2026. Those are the regression anchors for the R port; see [[Reproducible Research in R]].

Under valuation-, leverage- and sentiment-heavy weightings the episode ordering does not change. Known limits are set out in [[Counterarguments to the AI Bubble Thesis]]: C is a proxy, L sees only listed-market debt, and N = 3.

![[fig_threeway.png]]
![[fig_pillars_gfc.png]]
