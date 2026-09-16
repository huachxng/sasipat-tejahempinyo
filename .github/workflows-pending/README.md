These workflows are parked here because the local GitHub token could not push `.github/workflows/`.
To activate: `gh auth refresh -h github.com -s workflow`, then `git mv .github/workflows-pending .github/workflows && git commit -m "Enable CI" && git push`.
