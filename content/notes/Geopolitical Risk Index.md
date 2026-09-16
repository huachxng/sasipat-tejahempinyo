---
publish: true
title: "Geopolitical Risk Index"
date: 2026-09-16
updated: 2026-09-16
tags: [research, ai-bubble, gpr, sentiment, data-sources]
summary: "The Caldara-Iacoviello news-count index and how it became half of the sentiment pillar."
---

The Geopolitical Risk (GPR) index of Caldara and Iacoviello (2022, American Economic Review 112(4)) is built by counting newspaper articles about geopolitical tension. The benchmark monthly series draws on ten newspapers and runs from January 1985. There are sub-indices for threats (GPRT) and acts (GPRA), and a historical series (GPRH) from three newspapers back to 1900. The data file, data_gpr_export.xls, comes from matteoiacoviello.com/gpr.htm; the authors ask that citations include the download date.

Two sanity checks confirm the right column: a very large spike in September 2001 (the pipeline's row reads 499) and a clear one in February-March 2022.

## How it enters the sentiment pillar

In v0.1 of the [[Bubble Intensity Score]] the sentiment pillar was the inverted VIX alone. In v1.0 it becomes

    S = mean( -z(VIX), -z(GPR) )

Both series are inverted because the pillar measures complacency: bubbles inflate in calm times, so a calm market and a quiet world should both push the score up. Leaving GPR un-inverted would mix "calm markets" with "scary world" and mean nothing.

The justification is variance reduction. Averaging two weakly correlated gauges of nerve cancels some of each one's noise. The v1.0 test confirmed it in all three windows: the pillar's standard deviation fell from 1.04 to 1.00 (Dot-com), 1.35 to 0.72 (GFC) and 1.06 to 0.91 (AI era), with correlations between the two components of +0.19, -0.08 and -0.03. The Dot-com composite peak moved by one month, from March to February 2000, inside the pre-registered six-month band.

## What it changed

The upgrade lets the index feel two shocks the VIX alone understated: the window minima now fall in September 2001 and March 2022. In June 2026 the pillar reads -0.59, and GPR accounts for all of it: the VIX half is +0.10, the GPR half is -1.27. Whatever the present market is, it is not complacent.

## Disclosures

GPR is a Western-press measure built from English-language newspapers. It starts in 1985, so the pillar is VIX-only before then. It overlaps conceptually with the policy-uncertainty index of Baker, Bloom and Davis (2016). The Excel file also trips R's column guessing; see [[Reproducible Research in R]]. The choice is defended in [[Counterarguments to the AI Bubble Thesis]], and it gives the "external shock" pattern in [[Minsky Moments]] and [[AI Bubble Research]] a quantitative hook without turning the shock into a pillar.
