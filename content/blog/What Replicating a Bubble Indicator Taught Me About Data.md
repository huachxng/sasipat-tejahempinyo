---
publish: true
title: "What Replicating a Bubble Indicator Taught Me About Data"
date: 2026-09-12
updated: 2026-09-16
tags: [research, ai-bubble, r, reproducibility, data]
summary: "Porting my bubble index from Python to R and forcing it to reproduce five known numbers taught me more about data than building it did."
---

%% TODO: confirm the publish date. %%


In June I had a Python script that produced a number I liked. The [[Bubble Intensity Score]], my four-pillar composite for [[AI Bubble Research]], read +1.81 in March 2000, the month of the Nasdaq top, and +0.93 in May 2026. In August, after a summer statistics course, I decided to rebuild the whole thing in R and not trust it until it reproduced five anchor months from the prototype to two decimal places.

Building the index taught me about bubbles. Replicating it taught me about data. These are the lessons, roughly in the order they hurt.

## The number underneath moves

The first surprise: some anchors could no longer be matched exactly by any correct code. Between June and August, multpl revised its recent CAPE months and the Federal Reserve's June Z.1 release revised the history of corporate debt. My May 2026 leverage reading moved from -0.50 to about -0.05. Nothing in the method changed; the data did. So the regression test now has two passing states, PASS and CLOSE, with an allowed drift written next to each anchor and the reason for it. A FAIL is still a code bug until proven otherwise. A CLOSE is a reminder that "the" value of an economic series is a vintage, not a constant.

## Small conventions carry the result

Three conventions each move every number, and none of them looked important when I started.

R's sd() divides by n minus one. The Python prototype divided by n. On 120 observations that is under half a percent, which is enough to miss a two-decimal anchor. A self-test now expects 1.689278 and flags 1.668028.

Order of operations matters. CAPE runs from 1871. If you join it into the 1985 panel first and then take trailing z-scores, the early windows are truncated and every early value shifts slightly. Close but wrong, which is the worst kind of wrong. Z-score each series at its full length, then join.

And the Z.1 corporate-debt file dates quarters by their end while FRED dates them by their start. Without converting, the leverage pillar shifts two months and the anchors fail.

## When the source goes down, go upstream

On 26 August FRED went down. RStudio reported a "Stream error in the HTTP/2 framing layer". I went to the institutions FRED re-serves: CBOE for the VIX, the Chicago Fed for the NFCI leverage subindex, the Federal Reserve's Z.1 release for corporate debt, Yahoo for the Nasdaq Composite, and a mirror of Shiller's data plus multpl for CAPE. Each file was reshaped into FRED's exact layout so the pipeline could not tell the difference.

Two things came out of that day. A PROVENANCE.md now records what came from where and when, including that the Chicago Fed's published file ends in April 2026, so later months fall back to the corporate-debt series alone, by design. And Chapter 4 of the paper now cites CBOE, the Chicago Fed and the Z.1 directly, which is, if anything, a stronger citation than a re-publication. The [[Geopolitical Risk Index]] file carried a smaller lesson: read_excel guessed its main column as logical, which would have produced a pillar of missing values without a word.

## Make the maths boring

The single rule the R build rests on is that every indicator, whatever its source, becomes exactly two columns: month and value. A small function refuses to write any file that breaks this. Once six series look identical, the pillar arithmetic is the same three lines for each. Data flows one way, from raw downloads that are never edited, through clean files, to outputs that can be deleted and rebuilt without touching the network. The habits are written up in [[Reproducible Research in R]].

## Decide the test before the result

The lesson that matters most is not about code. I wrote the backtest criteria down before running anything: the composite should peak within six months of March 2000; the leverage pillar should peak within twelve months of August 2007; the composite should not exceed +1.5 before 2008. That last criterion sounds like an odd thing to want. It is a test of scope. The index is built from equity-market series, and 2008 was a credit crisis, so a composite that flagged it strongly would be responding to something other than what it claims to measure.

The composite topped out at +0.43 in the 2003-2008 run-up. The leverage pillar alone reached +2.11 in December 2007. An index that fit all three episodes would look tuned. One that misses in an explainable way, and says so, is a result I can defend at a whiteboard, the position I also take in [[Counterarguments to the AI Bubble Thesis]].

## Do one by hand

The pipeline ends with a function that prints the raw inputs for one month so I can redo the calculation on a calculator. For March 2000 under the prototype's pillars: (2.04 + 0.89 - 0.74 + 5.06) / 4 = 1.8125. If I cannot do that unaided, I do not understand my own index, however many tests pass.

What the summer statistics course taught me was that a p-value means only what the design lets it mean. Replication taught me the same thing about an index. The number is downstream of a hundred small choices, and the work is knowing which ones you made.
