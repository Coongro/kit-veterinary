---
"@coongro/kit-veterinary": patch
---

fix(ci): correct release and publish workflows

- Fix changesets/action version command (use shell script instead of inline &&)
- Fix scoped registry override in production publish
- Add tag creation and GitHub Release in publish workflow
- Remove obsolete tag-release workflow
