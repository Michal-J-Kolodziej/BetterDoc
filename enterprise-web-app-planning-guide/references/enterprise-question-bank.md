# Enterprise Clarification Question Bank

Use only when answers materially change architecture, compliance, scope, or sequencing.
Pick the smallest set needed.

## Identity and Access

1. Which identity provider must be supported at launch (Okta, Entra ID, Google Workspace, other)?
2. Is SSO mandatory for MVP, or is local auth temporarily acceptable?
3. Which access model is required now: RBAC, ABAC, or both?
4. Are privileged admin actions required in MVP?

## Tenancy and Data Boundaries

1. Is the product single-tenant per customer or multi-tenant from day one?
2. Is strict tenant-level data isolation required (logical or physical)?
3. Are customer-managed encryption keys required?

## Compliance and Security

1. Which compliance targets are in scope for launch (SOC 2, HIPAA, GDPR, ISO 27001)?
2. Will the app store regulated or sensitive data (PII, PHI, financial records)?
3. What audit evidence is required (admin actions, exports, auth events, config changes)?

## Integrations and System Boundaries

1. Which systems are mandatory for launch (CRM, ERP, HRIS, ticketing, data warehouse)?
2. Are integrations pull, push, event-driven, or mixed?
3. Is near-real-time synchronization required?
4. Who owns integration contracts and versioning?

## Reliability and Operations

1. What uptime target is required (for example, 99.9% or higher)?
2. What recovery targets are required (RTO/RPO)?
3. Are regional data residency constraints required?
4. Is on-call support required at launch?

## Delivery and Governance

1. Is there a fixed launch deadline tied to a customer commitment?
2. Is phased rollout required (internal pilot, selected customers, general availability)?
3. What approval gates are mandatory (security review, legal review, architecture review)?
