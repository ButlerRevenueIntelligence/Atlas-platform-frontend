import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { DataAccessReview } from "../components/dataAccess/DataAccessReview";
const sources = [
  "hubspot",
  "salesforce",
  "zoho_crm",
  "pipedrive",
  "bitrix24",
  "google_ads",
  "meta_ads",
  "linkedin_ads",
  "ga4",
  "stripe",
  "quickbooks",
  "shopify",
  "slack",
  "excel_csv",
];
const orgId = () =>
  localStorage.getItem("x-org-id") ||
  localStorage.getItem("orgId") ||
  localStorage.getItem("butler_org_id") ||
  localStorage.getItem("active_org_id") ||
  "";
export default function DataPrivacy() {
  const [source, setSource] = useState("hubspot"),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const context = useRef("");
  async function load() {
    try {
      setBusy(true);
      setError("");
      const org = orgId();
      const result = await apiGet(`/data-access/${source}`);
      if (org !== orgId())
        throw new Error("Workspace changed. Please try again.");
      context.current = org;
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="data-privacy">
      <Link to="/integrations">← Integrations</Link>
      <h1>Data &amp; Privacy</h1>
      <p>
        Review source permissions, AI processing, service providers, and
        retention information. Published agreement text and acceptance receipts
        are available inside each source review.
      </p>
      <p>
        Disconnecting a source stops future access through that connection. It
        does not by itself delete imported records. Review the published
        retention and deletion procedure for further steps.
      </p>
      <label htmlFor="privacy-source">Data source </label>
      <select
        id="privacy-source"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      >
        {sources.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ")}
          </option>
        ))}
      </select>{" "}
      <button onClick={load} disabled={busy}>
        {busy ? "Loading…" : "Review data use"}
      </button>
      {error && <p role="alert">{error}</p>}
      {data && (
        <DataAccessReview
          data={data}
          onClose={() => setData(null)}
          workspaceCurrent={() => context.current === orgId()}
        />
      )}
    </main>
  );
}
