---
name: enterprise-web-app-planning-guide
description: Convert short enterprise web app ideas into implementation-ready product and architecture plans that cover scope, UX, data model, API design, integrations, SSO/RBAC, compliance, governance, rollout, and operational readiness. Use when a user asks to plan, design, scope, or architect a B2B/enterprise web application from limited requirements and targeted clarification may be needed.
---

# Enterprise Web App Planning Guide

## Overview

Produce a complete enterprise web app plan from a short prompt.
Ask clarifying questions only when missing details would materially change compliance posture, architecture, scope, or delivery sequencing.

## Workflow

1. Parse the brief
- Extract problem, target organization, user personas, and expected business outcome.
- Capture explicit constraints: timeline, budget, existing systems, hosting, compliance.

2. Build a baseline draft
- Create a first-pass plan before asking questions.
- Mark unknowns as `high`, `medium`, or `low` impact.

3. Decide whether questions are required
- Ask questions only for `high` impact unknowns.
- Treat these as high impact by default: auth/identity model, tenancy model, sensitive data handling, mandatory integrations, regulatory constraints, uptime/recovery requirements.
- Continue with assumptions for `medium/low` unknowns.

4. Ask minimal follow-ups (if required)
- Ask at most 7 questions in one round.
- Prefer forced-choice options and concise wording.
- Use `references/enterprise-question-bank.md`.

5. Generate the final plan
- Use `references/enterprise-plan-template.md`.
- Separate confirmed facts from assumptions.
- Keep initial scope realistic for an MVP release in an enterprise setting.

## Enterprise Defaults When Unspecified

Use these defaults if the user does not provide answers, and label them as assumptions:
- Platform: web app, responsive, desktop-first workflows.
- Identity: enterprise SSO via OIDC/SAML.
- Access control: RBAC with least privilege.
- Governance: immutable audit logs for security-sensitive actions.
- Delivery: separate environments (`dev`, `staging`, `prod`) with CI/CD gates.
- Security baseline: encryption in transit and at rest, secret management, vulnerability scanning.
- Operations baseline: centralized logging, metrics, alerting, backup and restore plan.

## Output Rules

- Distinguish `MVP` vs `Later` scope.
- Include role-to-capability mapping.
- Include at least one end-to-end enterprise workflow.
- Recommend one primary architecture/stack and include one fallback only when tradeoffs are significant.
- Include integration strategy (sync pattern, failure handling, ownership boundaries).
- Include non-functional targets and compliance implications.
- Include phased delivery with rough sizing (`S`, `M`, `L`).
- Include risks, mitigations, open questions, and immediate next actions.

## Interaction Rules

- Avoid long discovery interviews.
- Prefer forward progress with explicit assumptions.
- If follow-up questions are unanswered, proceed with an assumption set and note risk impact.
- Keep language practical and implementation-focused.

## Quality Gate Before Finalizing

- Ensure business goals, user roles, and feature scope are consistent.
- Ensure architecture, data model, and API boundaries align with compliance and security constraints.
- Ensure reliability, observability, and operational ownership are defined.
- Ensure plan is executable by engineering and product teams without further reinterpretation.
