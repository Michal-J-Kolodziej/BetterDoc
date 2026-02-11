---
name: app-planning-guide
description: Transform short app ideas into actionable product and technical plans with an MVP scope, UX flow, architecture, data model, API surface, milestones, and risk log. Use when a user provides a brief app concept and asks to plan, design, scope, or architect the app, especially when requirements are incomplete and targeted follow-up questions may be needed before finalizing the plan.
---

# App Planning Guide

## Overview

Turn a short app description into a concrete implementation-ready plan.
Ask clarifying questions only when uncertainty blocks meaningful planning or creates a high risk of wrong assumptions.

## Workflow

1. Parse the brief
- Extract the app idea, target user, core job-to-be-done, and any explicit constraints.
- Infer missing details as provisional assumptions.

2. Build a draft internally
- Draft a first-pass plan before asking questions.
- Mark assumptions by impact: `high`, `medium`, `low`.

3. Decide whether to ask questions
- Ask questions only for `high` impact unknowns that materially change product scope, architecture, or delivery.
- Skip questions and proceed with assumptions when unknowns are `medium/low` impact.
- If questions are needed, ask only the smallest set required to unblock planning.

4. Ask concise follow-ups (if needed)
- Use at most 5 questions in one round.
- Use short, forced-choice wording when possible.
- Prioritize: platform, target audience, must-have outcome, integration/dependency constraints, privacy/compliance constraints.
- Use `references/question-bank.md` to pick relevant questions.

5. Produce the final plan
- Generate a complete planning/design deliverable using `references/plan-template.md`.
- Separate confirmed facts from assumptions.
- Keep scope realistic for an MVP.

## Output Rules

- Label each assumption explicitly.
- Include both `MVP` and `Later` scope.
- Include at least one end-to-end user flow.
- Recommend one primary stack and mention one fallback only if tradeoffs are material.
- Include implementation phases with rough effort sizing (`S`, `M`, `L`).
- Include risks, open questions, and next-step actions.

## Interaction Rules

- Avoid long discovery interviews.
- Prefer moving forward with reasonable assumptions over blocking on minor unknowns.
- If the user does not answer follow-up questions, continue with a clearly marked assumption set.
- Keep language practical and execution-focused.

## Quality Check Before Finalizing

- Ensure the plan can be executed by an engineer without additional interpretation.
- Ensure features, data model, API design, and architecture are consistent.
- Ensure non-functional requirements are covered: security, reliability, observability, and performance.
- Ensure scope fits an MVP timeline.
