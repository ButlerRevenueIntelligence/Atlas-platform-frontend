# Data access review

Requires the backend `feat/data-access-review` API. Deploy the backend before this frontend. Backend DATA_ACCESS_MODE defaults to off: existing connect/upload flows continue without a new contractual acceptance step until configured.

- Integrations links to `/data-privacy` for source disclosures, full document text and current acceptance receipts.
- Connect and spreadsheet selection request a backend-owned source review before proceeding when preview or enforcement is enabled.
- Off: no connection interruption. Preview: draft notice and explicit continuation without recorded agreement acceptance. Enforce: only approved current disclosures can be accepted and the server validates the user's membership and checkbox acknowledgments.
- Native dialog supports keyboard focus containment and Escape; controls are disabled during acceptance saving. Workspace changes are checked before saving/continuing. No draft acceptance is stored.
- Agreement checkbox is required only when that common agreement has not already been accepted by an authorized workspace administrator. Source authority and processing authorization remain required.
- The UI does not promise read-only access, no model training, zero retention, or deletion behavior that has not been verified. Full policy content and approval readiness come from the backend.
- Cancel closes the review and starts no new authorization/upload. Users can return to existing demo workspace exploration; this branch does not silently create or switch their workspace.

See backend `docs/data-access-review.md` for data-flow findings, policy completion, staged activation and production rollout. The technical gate is not an approved legal agreement, deletion workflow, or confirmation of production vendor configuration.
