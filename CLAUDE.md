# cafe-social

## Committing — overrides the global rule

Commit and push straight to `main`. **Do not open pull requests in this repo.**

This replaces the Committing section of the global `~/.claude/CLAUDE.md`, which
mandates a branch and a PR and says "Always finish on an open PR. No exception."
That rule does not apply here. This is a solo repo with no reviewer waiting, so a
PR is a round trip to nobody.

Everything else in the global file still stands — in particular, Codex implements
and Claude reviews, and the review happens *before* the push, not after. Pushing
to `main` removes the PR, not the review: read the diff, run the gate, say what
you would change.

Still off limits: force-pushing `main`, and rewriting history that is already
pushed.
