---
name: uncodixify-ui
description: Remove generic AI-generated UI aesthetics and replace them with restrained, product-specific interface decisions. Use when designing or refactoring frontend layouts, dashboards, landing pages, components, or visual systems and the goal is to make the result feel human-designed, conventional, and closer to products like Linear, Raycast, Stripe, or GitHub than a default AI SaaS mockup.
---

# Uncodixify UI

## Overview

Strip out default AI UI habits before they reach the final design.
Favor ordinary, disciplined product UI over decorative dashboard theater.

## Workflow

1. Inspect the existing product first
- Read a small set of existing UI files before changing styles.
- Reuse established colors, spacing, typography, border radii, and component patterns when the project already has them.
- If the product already has a strong visual language, preserve it instead of forcing the reference aesthetic.

2. Remove the obvious AI-default moves
- Ban hero sections inside internal tools unless there is a real product reason.
- Ban eyebrow labels, decorative copy blocks, glassmorphism shells, oversized radii, pill overload, fake charts, floating sidebars, and premium-for-the-sake-of-premium styling.
- If a choice feels like a generated dashboard trope, replace it with the plainer and more functional option.

3. Build with normal interface primitives
- Use straightforward sidebars, headers, sections, toolbars, cards, forms, tables, lists, tabs, and dialogs.
- Keep radii mostly within `8px` to `12px`.
- Keep shadows subtle and transitions limited to simple color or opacity changes.
- Keep layout hierarchy predictable and readable rather than dramatic.

4. Match the source of truth
- Replicate existing product patterns or provided Figma/designer components instead of inventing new ones.
- Use product voice, not generic startup copy.
- Avoid default safe font stacks unless the project already uses them.

5. Choose colors conservatively
- First choice: inherit the project's existing palette.
- Fallback: use one of the reference palettes.
- Do not invent arbitrary color combinations just because they look stylish in isolation.

## Quick Checks Before Finalizing

- No headline blocks with `small` labels and explanatory marketing copy inside product UI.
- No rounded `span` badges unless they are functional.
- No blue-leaning palette by default unless the product already uses it or the user explicitly wants it.
- No metric-card grid as the first instinct.
- No mobile fallback that turns the layout into a single long stack with lost hierarchy.
- Colors stay calm, contrast stays readable, and spacing stays consistent.

## Reference

Read `references/uncodixify-guidelines.md` when you need the full banned-pattern list, the "keep it normal" component standards, or fallback light/dark palettes.
