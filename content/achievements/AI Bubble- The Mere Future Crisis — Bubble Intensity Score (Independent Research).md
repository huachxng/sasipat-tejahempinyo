---
publish: true
title: "AI Bubble: The Mere Future Crisis — Bubble Intensity Score (Independent Research)"
slug: ai-bubble-mere-future-crisis-research
date: 2025-01-01
dateText: "2025 – present"
category: research
org: "Independent research"
result: "Working paper in preparation (SSRN)"
summary: "Solo economics research building a four-pillar Bubble Intensity Score in Python and R, backtested against the dot-com and 2008 episodes and applied to the 2025–26 AI market; working paper prepared for SSRN."
tags: ["economics", "finance", "asset-bubbles", "python", "r", "tidyverse", "research", "ssrn"]
links: ["GitHub (profile) | https://github.com/huachxng"]
resume: true
resumeLine: "Independent researcher, 'AI Bubble: The Mere Future Crisis' (2025–present) — 4-pillar Bubble Intensity Score in Python/R; pre-registered backtests on dot-com and 2008; applied to the 2026 AI market; SSRN working paper in preparation."
featured: true
cover: ai-bubble-mere-future-crisis-research-01.png
---

I am writing an independent research paper that asks whether the structural state of a market bubble can be captured in one transparent number computed from free public data. The Bubble Intensity Score is the equal-weighted mean of four pillar z-scores (valuation, leverage, sentiment, concentration), each measured against a trailing ten-year window; I prototyped it in Python in June 2026, rebuilt the pipeline in R with the tidyverse, and regression-tested the two until the anchor months matched, then added a geopolitical-risk component to the sentiment pillar for v1.0. Backtested against criteria I wrote down before running it, the index peaks at +2.20 in February 2000, stays quiet through 2008 (a credit crisis, where only the leverage pillar warns at +2.11 in December 2007), and reads +0.78 for June 2026. The v1.0 pipeline and figures were produced in early September 2026 and the SSRN working-paper package is drafted, with more than 30 scholarly sources.

%% TODO (review): Add the SSRN URL once posted (planned early October 2026) and the public GitHub repository URL; confirm the paper's final title (the SSRN package recommends 'The Bubble Intensity Score: A Simple Composite Index...') and the v1.0 run date (inventory says 5 Sep 2026; figures are dated 8 Sep 2026). %%

Related notes: [[AI Bubble Research]], [[Bubble Intensity Score]], [[Reproducible Research in R]].

![[ai-bubble-mere-future-crisis-research-01.png|Bubble Intensity Score v1.0 from 1995 to present, with the +1.5 danger line and the three analysis windows shaded.]]
![[ai-bubble-mere-future-crisis-research-02.png|Pillar z-scores at the Dot-com peak, the 2007 credit-crunch onset and the AI era, showing the AI profile resembles 2000 rather than 2008.]]
![[ai-bubble-mere-future-crisis-research-03.png|S&P 500 on a log scale with the three canonical external triggers marked.]]
![[ai-bubble-mere-future-crisis-research-04.png|2008 GFC backtest of the composite BIS with pillar decomposition, annotated with the Lehman collapse.]]
