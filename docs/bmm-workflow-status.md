# Project Workflow Status

**Project:** xiaoy
**Created:** 2025-10-17
**Last Updated:** 2025-10-17
**Status File:** `bmm-workflow-status.md`

---

## Workflow Status Tracker

**Current Phase:** Workflow Definition
**Current Workflow:** brainstorm-project - Complete
**Current Agent:** Analyst
**Overall Progress:** 5%

### Phase Completion Status

- [ ] **1-Analysis** - Research, brainstorm, brief (optional)
- [ ] **2-Plan** - PRD/GDD/Tech-Spec + Stories/Epics
- [ ] **3-Solutioning** - Architecture + Tech Specs (Level 2+ only)
- [ ] **4-Implementation** - Story development and delivery

### Planned Workflow Journey

**This section documents your complete workflow plan from start to finish.**

| Phase | Step | Agent | Description | Status |
| ----- | ---- | ----- | ----------- | ------ |
| 1-Analysis | brainstorm-project | Analyst | Explore software solution ideas | Planned |
| 1-Analysis | research (optional) | Analyst | Market/technical research | Optional |
| 1-Analysis | product-brief | Analyst | Strategic product foundation | Planned |
| 2-Plan | TBD - Level 0-1 → tech-spec, Level 2-4 → prd | PM or Architect | Workflow determined after level assessment | Conditional |
| 2-Plan | ux-spec | PM | UX/UI specification (user flows, wireframes, components) | Planned |
| 3-Solutioning | TBD - depends on level from Phase 2 | Architect | Required if Level 3-4, skipped if Level 0-2 | Conditional |
| 4-Implementation | create-story (iterative) | SM | Draft stories from backlog | Planned |
| 4-Implementation | story-ready | SM | Approve story for dev | Planned |
| 4-Implementation | story-context | SM | Generate context XML | Planned |
| 4-Implementation | dev-story (iterative) | DEV | Implement stories | Planned |
| 4-Implementation | story-approved | DEV | Mark complete, advance queue | Planned |

**Current Step:** brainstorm-project
**Next Step:** brainstorm-project (Analyst agent)

**Instructions:**

- This plan was created during initial workflow-status setup
- Status values: Planned, Optional, Conditional, In Progress, Complete
- Current/Next steps update as you progress through the workflow
- Use this as your roadmap to know what comes after each phase

### Implementation Progress (Phase 4 Only)

**Story Tracking:** Not started

### Artifacts Generated

| Artifact | Status | Location | Date |
| -------- | ------ | -------- | ---- |


### Next Action Required

**What to do next:** Review brainstorming results and run research (optional) or product-brief

**Command to run:** bmad analyst product-brief

**Agent to load:** Analyst

---

## Assessment Results

### Project Classification

- **Project Type:** web (Web Application)
- **Project Level:** TBD
- **Instruction Set:** default
- **Greenfield/Brownfield:** greenfield

### Scope Summary

- **Brief Description:** TBD
- **Estimated Stories:** TBD
- **Estimated Epics:** TBD
- **Timeline:** TBD

### Context

- **Existing Documentation:** N/A (greenfield)
- **Team Size:** TBD
- **Deployment Intent:** TBD

## Recommended Workflow Path

### Primary Outputs

- Brainstorming results, research insights, product brief; then PRD/Tech-Spec and stories

### Workflow Sequence

- Analysis: brainstorm-project → research (optional) → product-brief
- Planning: PRD or Tech-Spec (based on level) → ux-spec (UI projects)
- Solutioning: solution-architecture (Level 3-4 only)
- Implementation: create-story → story-ready → story-context → dev-story → story-approved

### Next Actions

- Run: bmad analyst brainstorm-project
- After completion, re-run: bmad analyst workflow-status

## Special Considerations

- Include UX workflow due to UI components

## Technical Preferences Captured

- Language: Chinese

## Story Naming Convention

### Level 0 (Single Atomic Change)

- **Format:** `story-<short-title>.md`
- **Example:** `story-icon-migration.md`, `story-login-fix.md`
- **Location:** `docs/stories/`
- **Max Stories:** 1 (if more needed, consider Level 1)

### Level 1 (Coherent Feature)

- **Format:** `story-<title>-<n>.md`
- **Example:** `story-oauth-integration-1.md`, `story-oauth-integration-2.md`
- **Location:** `docs/stories/`
- **Max Stories:** 2-3 (prefer longer stories over more stories)

### Level 2+ (Multiple Epics)

- **Format:** `story-<epic>.<story>.md`
- **Example:** `story-1.1.md`, `story-1.2.md`, `story-2.1.md`
- **Location:** `docs/stories/`
- **Max Stories:** Per epic breakdown in epics.md

---

_This file serves as the **single source of truth** for project workflow status, epic/story tracking, and next actions. All BMM agents and workflows reference this document for coordination._

_File Created: 2025-10-17_


## Decision Log

- **2025-10-17**: Completed brainstorm-project workflow. Generated brainstorming session results saved to docs/brainstorming-session-results-2025-10-17.md. Next: Review ideas and consider running research or product-brief workflows.
