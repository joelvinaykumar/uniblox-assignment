---
description: Ask the review agent to review changed files and return the result as a scored rubric.
---

Use the `review-agent` agent to review this repository's modified and untracked files.

Review scope:

- Include only files reported by Git as modified or untracked.
- Read `REQUIREMENTS.md` and compare the changed files against it.
- Do not review ignored files unless they directly affect the visible changed files.
- Do not edit files or propose patches in this run.

Return the review as a rubric with scores and actionable findings.

## Required output format

```markdown
## Rubric Review Summary

- **Files reviewed:** List modified and untracked files reviewed.
- **Overall score:** N/100
- **Overall risk:** Low | Medium | High | Critical
- **Recommendation:** Approve | Approve with comments | Request changes

## Rubric

| Category | Weight | Score | Notes |
| --- | ---: | ---: | --- |
| Requirement adherence | 25 | N/25 | Requirement coverage, missing assignment behavior, admin boundary clarity. |
| Security | 20 | N/20 | Auth boundaries, secret handling, validation, dependency/config risks. |
| Scalability and reliability | 20 | N/20 | Concurrency, idempotency, shared mutable state, multi-instance implications. |
| Clean code and maintainability | 20 | N/20 | Cohesion, naming, coupling, error contracts, minimality. |
| Documentation and operability | 15 | N/15 | README/OpenAPI accuracy, setup/run clarity, decision documentation needs. |

## Findings

### [Severity] [Category] Short title

- **File:** `path/to/file.js`
- **Location:** Function, route, object, or line if known
- **Rubric impact:** Which category loses points and why
- **Issue:** What is wrong or risky?
- **Why it matters:** Explain the concrete impact.
- **Recommendation:** Give the smallest practical fix.

## Positive Notes

- Note strong implementation or design choices.

## Requirement Gaps

- List changed-scope gaps against `REQUIREMENTS.md`.
- If a requirement is outside the current changed scope, say so explicitly.

## Security Notes

- Call out secret, auth, validation, error-leakage, and dependency concerns.

## Scalability Notes

- Call out concurrency, idempotency, in-memory state, and production multi-instance concerns.

## Review Limitations

- State files or concerns not reviewed because they were outside modified/untracked scope.
```

Scoring guidance:

- Start from full points in each category.
- Deduct only for concrete issues visible in the changed/untracked files or directly implied by them.
- Do not penalize for tests during feature implementation unless the user explicitly requested tests; this project defers new tests until the end.
- Prefer high-signal findings over exhaustive commentary.
- Be direct, specific, and concise.
