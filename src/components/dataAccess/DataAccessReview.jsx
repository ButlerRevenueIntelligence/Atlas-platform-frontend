import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../../api";
import "./dataAccess.css";

export function downloadReceipt(receipt) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `atlas-data-access-${receipt.provider}-${receipt._id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DataAccessReview({
  data,
  onClose,
  onContinue,
  workspaceCurrent = () => true,
}) {
  const dialog = useRef(null),
    [checks, setChecks] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(data.receipt);
  const { snapshot: s, ready, mode } = data;
  const agreementNeeded = !data.agreementAccepted;
  const required = Object.keys(s.checkboxes).filter(
    (k) => k !== "agreement" || agreementNeeded,
  );
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  async function proceed() {
    if (!workspaceCurrent()) {
      setError("The workspace changed. Close this review and start again.");
      return;
    }
    if (mode !== "enforce") {
      onContinue?.();
      return;
    }
    try {
      setBusy(true);
      setError("");
      const result = await apiPost(`/data-access/${s.provider}/accept`, {
        digest: data.digest,
        acknowledgments: checks,
      });
      if (!workspaceCurrent()) {
        setError(
          "The workspace changed. Start again in the selected workspace.",
        );
        return;
      }
      setReceipt(result.receipt);
      onContinue?.();
    } catch (e) {
      setError(
        e.message ||
          "Acceptance could not be saved. Reload the disclosure and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="data-review"
      ref={dialog}
      aria-labelledby="data-review-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="data-review-header">
        <div>
          <p className="data-eyebrow">Atlas Revenue AI · {s.name}</p>
          <h2 id="data-review-title">Before you connect your data</h2>
        </div>
        <button
          aria-label="Close data review"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <p>
        Review what Atlas accesses and how the information is processed before
        you authorize this source.
      </p>
      {(mode !== "enforce" || !ready) && (
        <p className="data-review-notice">
          Draft disclosure. Agreement acceptance is not available until the
          data-use details and agreement are finalized.
          {mode === "enforce" ? " This source cannot be connected yet." : ""}
        </p>
      )}
      <dl>
        {[
          ["Information imported", s.imports],
          ["Access and changes", s.access],
          ["Purpose and AI limitations", s.purpose],
          ["AI processing", s.aiProcessing],
          ["Other service providers", s.otherProviders],
          ["Sale, advertising, and model training", s.saleAndTraining],
          ["Storage and access", s.storageAndAccess],
          ["Retention, disconnection, and deletion", s.retentionAndDeletion],
        ].map(([label, text]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <p>
        Contracting entity: {s.legalEntity || "Awaiting confirmation"} ·
        Version: {s.version}
      </p>
      <div>
        {Object.entries(s.documents).map(([key, doc]) => (
          <details key={key}>
            <summary>View full {doc.title}</summary>
            <div className="data-document">
              {doc.text ||
                "This document is awaiting publication and cannot yet be accepted."}
            </div>
          </details>
        ))}
      </div>
      {s.contact && <p>Questions: {s.contact}</p>}
      {mode === "enforce" && ready && (
        <fieldset disabled={busy || !data.canAccept}>
          <legend>Confirm before continuing</legend>
          {required.map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(checks[key])}
                onChange={(e) =>
                  setChecks((old) => ({ ...old, [key]: e.target.checked }))
                }
              />
              <span>{s.checkboxes[key]}</span>
            </label>
          ))}
          {!agreementNeeded && (
            <p>
              Your organization has already accepted this agreement version.
              This review authorizes the selected source.
            </p>
          )}
          {!data.canAccept && (
            <p>
              An active workspace owner or administrator must complete this
              step.
            </p>
          )}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="data-review-error">
          {error}
        </p>
      )}
      {receipt && (
        <div className="data-receipt">
          <p>
            Latest acceptance: {new Date(receipt.acceptedAt).toLocaleString()} ·{" "}
            {receipt.email}
          </p>
          <button onClick={() => downloadReceipt(receipt)}>
            Download acceptance receipt
          </button>
        </div>
      )}
      <div className="data-review-actions">
        <button disabled={busy} onClick={onClose}>
          Cancel
        </button>
        {onContinue && (
          <button
            className="data-primary"
            onClick={proceed}
            disabled={
              busy ||
              (mode === "enforce" &&
                (!ready ||
                  !data.canAccept ||
                  !required.every((k) => checks[k])))
            }
          >
            {busy
              ? "Saving acceptance…"
              : mode === "enforce"
                ? "Agree and continue"
                : "Continue without acceptance (preview)"}
          </button>
        )}
      </div>
    </dialog>
  );
}
export function useDataAccessReview(getWorkspaceId) {
  const [review, setReview] = useState(null),
    [error, setError] = useState("");
  const pending = useRef(null),
    mounted = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.(false);
    };
  }, []);
  function finish(value) {
    pending.current?.(value);
    pending.current = null;
    setReview(null);
  }
  async function requestReview(provider) {
    if (inFlight.current || pending.current) return false;
    const orgId = getWorkspaceId();
    inFlight.current = true;
    setError("");
    try {
      const data = await apiGet(`/data-access/${provider}`);
      if (!mounted.current || getWorkspaceId() !== orgId) return false;
      if (data.mode === "off") return true;
      return await new Promise((resolve) => {
        pending.current = resolve;
        setReview({ data, orgId });
      });
    } catch (e) {
      if (mounted.current)
        setError(e.message || "Unable to load the data disclosure.");
      return false;
    } finally {
      inFlight.current = false;
    }
  }
  const modal = review ? (
    <DataAccessReview
      key={`${review.orgId}:${review.data.snapshot.provider}`}
      data={review.data}
      workspaceCurrent={() => getWorkspaceId() === review.orgId}
      onClose={() => finish(false)}
      onContinue={() => finish(true)}
    />
  ) : null;
  return { requestReview, modal, error };
}
