---
publish: true
title: "Reproducible Research in R"
date: 2026-09-16
updated: 2026-09-16
tags: [r, reproducibility, tidyverse, data-pipeline, provenance]
summary: "The habits that survived porting the bubble index from Python to R: one data contract, one-way data flow, regression anchors, and recorded provenance."
---

The [[Bubble Intensity Score]] was first computed in a Python script in June 2026. After STATS 110 I rebuilt it in R with the tidyverse and regression-tested the port against the prototype until all five anchor months reproduced to two decimal places. These are the habits that survived; the full story is in [[AI Bubble Research]].

## One contract for every series

Every indicator, whatever its source, becomes two columns: month as "YYYY-MM" and value as a double. check_contract() refuses to write a file that breaks it. Once six series look identical, the pillar maths is the same three lines for each.

## Data flows downhill

data-raw holds downloads and is never edited, by me or by code. data-clean holds the six contracted files. output holds panel, windows, tables, scorecard and figures. run_all.R rebuilds everything below data-raw without touching the network.

## Test against known answers

The five anchors from the prototype live next to the code with an allowed drift for each. Some now come back CLOSE rather than PASS because multpl revised recent CAPE months and the June Z.1 release revised corporate-debt history; the May 2026 leverage reading moved from -0.50 to about -0.05. The data changed, not the method. A FAIL is a code bug until proven otherwise.

Three bugs the test catches: R's sd() is the sample standard deviation while the prototype used the population one; series must be z-scored at full length before joining; and monthly values must be means, not last observations.

## Record provenance

FRED went down on 26 August 2026 ("Stream error in the HTTP/2 framing layer"). I pulled each series from the institution FRED re-serves: the VIX from CBOE, the NFCI leverage subindex from the Chicago Fed, corporate debt from the Federal Reserve Z.1 release, the Nasdaq Composite from Yahoo, and CAPE from a Shiller mirror plus multpl, each reshaped to FRED's exact layout. The Z.1 pull needed two conversions, millions to billions and quarter-end to quarter-start dates; without the second the leverage pillar shifts two months and every anchor fails. A PROVENANCE.md records what came from where and when, and Chapter 4 now cites the primary sources directly. The [[Geopolitical Risk Index]] file had its own trap: read_excel guessed its column as logical until guess_max was raised.

The same habits carry into the risk-report work in [[Quant Career Pathway]].
