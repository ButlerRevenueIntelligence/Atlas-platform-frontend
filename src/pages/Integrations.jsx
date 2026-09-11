import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  getActiveOrgName,
  getActiveWorkspace,
  uploadSpreadsheetData,
  apiGet,
  apiPost,
  getHubSpotStatus,
  syncHubSpot,
  selectGA4Property,
  syncZohoCRM,
  syncPipedrive,
  syncBitrix24,
  connectBitrix24Webhook,
} from "../api";

const connectorCatalog = [
  { id: "hubspot", name: "HubSpot CRM", category: "CRM", supportsLive: true },
  { id: "salesforce", name: "Salesforce", category: "CRM", supportsLive: true },
  { id: "zoho_crm", name: "Zoho CRM", category: "CRM", supportsLive: true },
  { id: "pipedrive", name: "Pipedrive", category: "CRM", supportsLive: true },
  { id: "bitrix24", name: "Bitrix24", category: "CRM", supportsLive: true, webhook: true },
  { id: "google_ads", name: "Google Ads", category: "Advertising", supportsLive: true },
  { id: "meta_ads", name: "Meta Ads", category: "Advertising", supportsLive: true },
  { id: "linkedin_ads", name: "LinkedIn Ads", category: "Advertising", supportsLive: true },
  { id: "ga4", name: "Google Analytics 4", category: "Analytics", supportsLive: true },
  { id: "stripe", name: "Stripe", category: "Payments", supportsLive: true },
  { id: "quickbooks", name: "QuickBooks Online", category: "Accounting", supportsLive: true },
  { id: "shopify", name: "Shopify", category: "Commerce", supportsLive: true },
  {
    id: "excel_csv",
    name: "Excel / CSV Import",
    category: "Manual Data Import",
    manual: true,
    supportsLive: false,
  },
];

const statusColor = {
  connected: "#22c55e",
  syncing: "#facc15",
  disconnected: "#64748b",
  error: "#fb7185",
};

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function getWorkspaceModeLabel(workspace) {
  const name = String(workspace?.name || "").trim().toLowerCase();
  const slug = String(workspace?.slug || "").trim().toLowerCase();
  const explicitMode = String(workspace?.workspaceMode || "").trim().toLowerCase();

  const isDemoWorkspace =
    explicitMode === "demo" ||
    slug === "atlas-demo-company" ||
    name === "atlas demo company";

  return isDemoWorkspace ? "demo" : "live";
}

function normalizeIntegrationMap(list) {
  const map = {};
  (Array.isArray(list) ? list : []).forEach((item) => {
    map[item.id] = item;
  });
  return map;
}

function customerIdFromResourceName(value) {
  return String(value || "").replace("customers/", "");
}

function prettifyProviderLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getActiveOrgId() {
  return (
    localStorage.getItem("x-org-id") ||
    localStorage.getItem("orgId") ||
    localStorage.getItem("butler_org_id") ||
    localStorage.getItem("active_org_id") ||
    ""
  );
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedGoogleAccounts, setSelectedGoogleAccounts] = useState({});
  const [selectedGA4Properties, setSelectedGA4Properties] = useState({});
  const [bitrixWebhookDraft, setBitrixWebhookDraft] = useState({});

  const fileInputRef = useRef(null);

  const [activeOrgName, setActiveOrgNameState] = useState(() => {
    const workspace = getActiveWorkspace();
    return workspace?.name || getActiveOrgName() || "";
  });

  const [workspaceModeLabel, setWorkspaceModeLabel] = useState(() => {
    const workspace = getActiveWorkspace();
    return getWorkspaceModeLabel(workspace);
  });

  useEffect(() => {
    const workspace = getActiveWorkspace();
    setActiveOrgNameState(workspace?.name || getActiveOrgName() || "");
    setWorkspaceModeLabel(getWorkspaceModeLabel(workspace));
  }, [loading]);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const workspace = getActiveWorkspace();
      setActiveOrgNameState(workspace?.name || getActiveOrgName() || "");
      setWorkspaceModeLabel(getWorkspaceModeLabel(workspace));

      const data = await getIntegrations();
      const map = normalizeIntegrationMap(data?.integrations);
      setIntegrations(map);

      const googleAds = map.google_ads;
      if (googleAds?.selectedCustomer) {
        setSelectedGoogleAccounts((prev) => ({
          ...prev,
          google_ads: customerIdFromResourceName(googleAds.selectedCustomer),
        }));
      } else if (googleAds?.externalAccountId && !googleAds?.needsSelection) {
        setSelectedGoogleAccounts((prev) => ({
          ...prev,
          google_ads: googleAds.externalAccountId,
        }));
      } else if (
        Array.isArray(googleAds?.accessibleCustomers) &&
        googleAds.accessibleCustomers.length === 1
      ) {
        setSelectedGoogleAccounts((prev) => ({
          ...prev,
          google_ads: customerIdFromResourceName(googleAds.accessibleCustomers[0]),
        }));
      }

      const ga4 = map.ga4;
      if (ga4?.selectedProperty?.propertyId) {
        setSelectedGA4Properties((prev) => ({
          ...prev,
          ga4: ga4.selectedProperty.propertyId,
        }));
      } else if (ga4?.externalAccountId && !ga4?.needsSelection) {
        setSelectedGA4Properties((prev) => ({
          ...prev,
          ga4: ga4.externalAccountId,
        }));
      } else if (Array.isArray(ga4?.properties) && ga4.properties.length === 1) {
        setSelectedGA4Properties((prev) => ({
          ...prev,
          ga4: ga4.properties[0].propertyId,
        }));
      }

      const bitrix = map.bitrix24;
      if (bitrix?.bitrixWebhookUrl || bitrix?.webhookUrl) {
        setBitrixWebhookDraft((prev) => ({
          ...prev,
          bitrix24: bitrix.bitrixWebhookUrl || bitrix.webhookUrl || "",
        }));
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to load connectors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const errorParam = params.get("error");

    if (connected) {
      setSuccess(`${prettifyProviderLabel(connected)} connected successfully`);
      load();

      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("mode");
      url.searchParams.delete("needsSelection");
      window.history.replaceState({}, "", url.toString());
    }

    if (errorParam) {
      setError(prettifyProviderLabel(errorParam));
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function handleConnect(id) {
    try {
      setBusyId(id);
      setError("");
      setSuccess("");

      const connector = connectorCatalog.find((c) => c.id === id);

      if (id === "bitrix24") {
        const webhookUrl = String(bitrixWebhookDraft.bitrix24 || "").trim();

        if (!webhookUrl) {
          throw new Error("Please paste your Bitrix24 webhook URL first.");
        }

        const data = await connectBitrix24Webhook(webhookUrl);
        setIntegrations(normalizeIntegrationMap(data?.integrations));
        setSuccess("Bitrix24 connected");
        return;
      }

      if (connector?.supportsLive) {
        const activeOrgId = getActiveOrgId();

        if (!activeOrgId) {
          throw new Error("No workspace selected");
        }

        if (id === "shopify") {
          const shopDomainInput = window.prompt(
            "Enter your Shopify store domain (example: store.myshopify.com)"
          );

          const shopDomain = String(shopDomainInput || "").trim();

          if (!shopDomain) {
            setBusyId("");
            return;
          }

          const res = await apiGet(
            `/integrations/shopify/auth-url?orgId=${encodeURIComponent(
              activeOrgId
            )}&shopDomain=${encodeURIComponent(shopDomain)}`
          );

          if (!res?.authUrl) {
            throw new Error("No Shopify auth URL returned from backend");
          }

          window.location.href = res.authUrl;
          return;
        }

        if (id === "pipedrive") {
          const res = await apiGet(
            `/integrations/pipedrive/auth-url?orgId=${encodeURIComponent(activeOrgId)}`
          );

          if (!res?.authUrl) {
            throw new Error("No Pipedrive auth URL returned from backend");
          }

          window.location.href = res.authUrl;
          return;
        }

        const res = await apiGet(
          `/integrations/${id}/auth-url?orgId=${encodeURIComponent(activeOrgId)}`
        );

        if (!res?.authUrl) {
          throw new Error("No auth URL returned from backend");
        }

        window.location.href = res.authUrl;
        return;
      }

      const data = await connectIntegration(id);
      setIntegrations(normalizeIntegrationMap(data?.integrations));
      setSuccess(`${connector?.name || id} connected`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to connect integration");
    } finally {
      setBusyId("");
    }
  }

  async function handleDisconnect(id) {
    try {
      setBusyId(id);
      setError("");
      setSuccess("");

      const data = await disconnectIntegration(id);
      setIntegrations(normalizeIntegrationMap(data?.integrations));
      setSuccess(`${connectorCatalog.find((c) => c.id === id)?.name || id} disconnected`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to disconnect integration");
    } finally {
      setBusyId("");
    }
  }

  async function handleHubSpotSync() {
    try {
      setBusyId("hubspot_sync");
      setError("");
      setSuccess("");

      const res = await getHubSpotStatus();
      if (!res?.connected) {
        throw new Error("HubSpot is not connected for this workspace.");
      }

      await syncHubSpot();
      setSuccess("HubSpot sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync HubSpot");
    } finally {
      setBusyId("");
    }
  }

  async function handleZohoSync() {
    try {
      setBusyId("zoho_crm_sync");
      setError("");
      setSuccess("");

      await syncZohoCRM();
      setSuccess("Zoho CRM sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync Zoho CRM");
    } finally {
      setBusyId("");
    }
  }

  async function handlePipedriveSync() {
    try {
      setBusyId("pipedrive_sync");
      setError("");
      setSuccess("");

      await syncPipedrive();
      setSuccess("Pipedrive sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync Pipedrive");
    } finally {
      setBusyId("");
    }
  }

  async function handleBitrix24Sync() {
    try {
      setBusyId("bitrix24_sync");
      setError("");
      setSuccess("");

      await syncBitrix24();
      setSuccess("Bitrix24 sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync Bitrix24");
    } finally {
      setBusyId("");
    }
  }

  async function handleStripeSync() {
    try {
      setBusyId("stripe_sync");
      setError("");
      setSuccess("");

      await apiPost("/integrations/stripe/sync", {});
      setSuccess("Stripe sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync Stripe");
    } finally {
      setBusyId("");
    }
  }

  async function handleShopifySync() {
    try {
      setBusyId("shopify_sync");
      setError("");
      setSuccess("");

      await apiPost("/integrations/shopify/sync", {});
      setSuccess("Shopify sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync Shopify");
    } finally {
      setBusyId("");
    }
  }

  async function handleQuickBooksSync() {
    try {
      setBusyId("quickbooks_sync");
      setError("");
      setSuccess("");

      await apiPost("/integrations/quickbooks/sync", {});
      setSuccess("QuickBooks sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync QuickBooks");
    } finally {
      setBusyId("");
    }
  }

  async function handleSalesforceSync() {
    try {
      setBusyId("salesforce_sync");
      setError("");
      setSuccess("");

      await apiPost("/integrations/salesforce/sync", {});
      setSuccess("Salesforce sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync Salesforce");
    } finally {
      setBusyId("");
    }
  }

  async function handleMetaAdsSync() {
  try {
    setBusyId("meta_ads_sync");
    setError("");
    setSuccess("");

    await apiPost("/integrations/meta_ads/sync", {});

    setSuccess("Meta Ads sync completed");
    await load();
  } catch (err) {
    console.error(err);
    setError(err?.message || "Failed to sync Meta Ads");
  } finally {
    setBusyId("");
  }
}
  async function handleLinkedInAdsSync() {
    try {
      setBusyId("linkedin_ads_sync");
      setError("");
      setSuccess("");

      await apiPost("/integrations/linkedin_ads/sync", {});
      setSuccess("LinkedIn Ads sync completed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sync LinkedIn Ads");
    } finally {
      setBusyId("");
    }
  }

  async function handleGoogleAdsSelectAccount() {
    try {
      const customerId = selectedGoogleAccounts.google_ads;
      if (!customerId) {
        throw new Error("Please select a Google Ads account.");
      }

      setBusyId("google_ads_select");
      setError("");
      setSuccess("");

      const data = await apiPost("/integrations/google_ads/select-account", {
        customerId,
      });

      const map = normalizeIntegrationMap(data?.integrations);
      setIntegrations(map);
      setSuccess("Google Ads account selected");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to select Google Ads account");
    } finally {
      setBusyId("");
    }
  }

  async function handleGA4SelectProperty() {
    try {
      const propertyId = selectedGA4Properties.ga4;
      if (!propertyId) {
        throw new Error("Please select a GA4 property.");
      }

      setBusyId("ga4_select");
      setError("");
      setSuccess("");

      const data = await selectGA4Property(propertyId);
      const map = normalizeIntegrationMap(data?.integrations);
      setIntegrations(map);
      setSuccess("GA4 property selected");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to select GA4 property");
    } finally {
      setBusyId("");
    }
  }

  function handleExcelClick() {
    setError("");
    setSuccess("");
    fileInputRef.current?.click();
  }

  async function handleSpreadsheetUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json(firstSheet, {
        defval: "",
        raw: false,
      });

      if (!rows.length) {
        throw new Error("This spreadsheet is empty.");
      }

      const res = await uploadSpreadsheetData({
        fileName: file.name,
        mode: "auto",
        rows,
      });

      const summary = res?.summary || {};
      setSuccess(
        `Upload complete. Clients: ${summary.clientsInserted || 0}, Deals: ${
          summary.dealsInserted || 0
        }, Metrics: ${summary.metricsInserted || 0}, Skipped: ${summary.skipped || 0}`
      );

      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to import spreadsheet");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const connectedCount = useMemo(() => {
    return Object.values(integrations).filter((i) => i?.status === "connected").length;
  }, [integrations]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "14px 16px 24px",
        color: "#EAF0FF",
        background:
          "radial-gradient(900px 500px at 15% 0%, rgba(37,99,235,0.18), transparent 55%), radial-gradient(900px 500px at 85% 0%, rgba(124,92,255,0.14), transparent 55%), linear-gradient(180deg, #050814 0%, #070b18 100%)",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleSpreadsheetUpload}
        style={{ display: "none" }}
      />

      <div
        style={{
          maxWidth: 1380,
          margin: "0 auto 12px",
          padding: "18px 20px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          background:
            "linear-gradient(135deg, rgba(30,64,175,0.18), rgba(37,99,235,0.10), rgba(255,255,255,0.02))",
          boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(191,219,254,0.82)",
            marginBottom: 6,
          }}
        >
          Data Infrastructure
        </div>

        <h1 style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.6, fontWeight: 900, margin: 0 }}>
          Atlas Data Connectors
        </h1>

        <div
          style={{
            fontSize: 14,
            color: "rgba(226,232,240,0.7)",
            marginTop: 8,
            lineHeight: 1.55,
            maxWidth: 900,
          }}
        >
          Connect your revenue stack so Atlas can model pipeline, forecast revenue,
          and detect growth signals across your workspace.
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Active Workspace: {activeOrgName || "Unknown"}
          </div>

          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "capitalize",
            }}
          >
            Workspace Mode: {workspaceModeLabel}
          </div>

          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Connected: {connectedCount}
          </div>

          <button
            onClick={load}
            disabled={loading || !!busyId || uploading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
              cursor: loading || !!busyId || uploading ? "not-allowed" : "pointer",
              opacity: loading || !!busyId || uploading ? 0.7 : 1,
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1380, margin: "0 auto" }}>
      {error ? (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 12,
            padding: 12,
            border: "1px solid rgba(255,120,120,0.35)",
            background: "rgba(255,0,0,0.10)",
            color: "#FFD7D7",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 12,
            padding: 12,
            border: "1px solid rgba(34,197,94,0.35)",
            background: "rgba(34,197,94,0.10)",
            color: "#DCFCE7",
            fontSize: 14,
          }}
        >
          {success}
        </div>
      ) : null}

      {loading ? (
        <div style={{ opacity: 0.7, marginBottom: 16 }}>Loading connectors...</div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))",
          gap: 12,
        }}
      >
        {connectorCatalog.map((c) => {
          const live = integrations[c.id];
          const status = live?.status || "disconnected";
          const color = statusColor[status] || "#64748b";
          const isConnected = status === "connected";
          const isBusy = busyId === c.id;

          const isHubSpotLive = c.id === "hubspot" && live?.mode === "live";
          const isZohoLive = c.id === "zoho_crm" && live?.mode === "live";
          const isPipedriveLive = c.id === "pipedrive" && live?.mode === "live";
          const isBitrix24Live = c.id === "bitrix24" && live?.mode === "live";
          const isStripeLive = c.id === "stripe" && live?.mode === "live";
          const isQuickBooksLive = c.id === "quickbooks" && live?.mode === "live";
          const isShopifyLive = c.id === "shopify" && live?.mode === "live";
          const isSalesforceLive = c.id === "salesforce" && live?.mode === "live";
          const isMetaAdsLive = c.id === "meta_ads" && live?.mode === "live";
          const isLinkedInAdsLive = c.id === "linkedin_ads" && live?.mode === "live";
          const isGoogleAds = c.id === "google_ads";
          const isGA4 = c.id === "ga4";
          const isStripe = c.id === "stripe";
          const isManualImport = c.id === "excel_csv";
          const isBitrix24 = c.id === "bitrix24";

          const needsGoogleSelection =
            isGoogleAds &&
            isConnected &&
            live?.mode === "live" &&
            live?.needsSelection &&
            Array.isArray(live?.accessibleCustomers) &&
            live.accessibleCustomers.length > 0;

          const needsGA4Selection =
            isGA4 &&
            isConnected &&
            live?.mode === "live" &&
            live?.needsSelection &&
            Array.isArray(live?.properties) &&
            live.properties.length > 0;

          const accountLabel =
            live?.externalAccountName ||
            (live?.externalAccountId
              ? c.id === "ga4"
                ? `GA4 Property ${live.externalAccountId}`
                : c.id === "stripe"
                ? `Stripe ${live.externalAccountId}`
                : c.id === "bitrix24"
                ? "Bitrix24 Webhook"
                : `Account ${live.externalAccountId}`
              : "");

          const lastSyncTime = live?.lastSyncAt || live?.lastSync;
          const syncStatus = live?.lastSyncStatus || "unknown";

          return (
            <div
              key={c.id}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 14,
                background: "rgba(10,16,35,0.40)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>{c.name}</div>

              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  marginBottom: 8,
                }}
              >
                {c.category}
              </div>

              {isManualImport ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "#38bdf8",
                    }}
                  />
                  Manual Import
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    marginBottom: 8,
                    textTransform: "capitalize",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: color,
                    }}
                  />
                  {status}
                </div>
              )}

              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  marginBottom: 6,
                  minHeight: 16,
                  textTransform: "none",
                }}
              >
                {isManualImport
                  ? success && success.toLowerCase().includes("upload complete")
                    ? "Last upload completed"
                    : "Ready to upload"
                  : isConnected
                  ? live?.mode === "live"
                    ? needsGoogleSelection
                      ? "Select client account"
                      : needsGA4Selection
                      ? "Select property"
                      : "Live connection"
                    : "Connected"
                  : isBitrix24
                  ? "Paste webhook and connect"
                  : isStripe
                  ? "Live connection available"
                  : ""}
              </div>

              <div
                style={{
                  fontSize: 11,
                  opacity: 0.6,
                  marginBottom: 6,
                  minHeight: 16,
                }}
              >
                {isManualImport ? "Upload Excel or CSV data into Atlas" : ""}
                {!isManualImport && lastSyncTime
                  ? `Last sync: ${formatDate(lastSyncTime)}`
                  : ""}
              </div>

              {!isManualImport && isConnected && live?.mode === "live" ? (
                <div
                  style={{
                    fontSize: 11,
                    marginBottom: 8,
                    minHeight: 16,
                  }}
                >
                  {syncStatus === "success" ? (
                    <span style={{ color: "#22c55e" }}>✅ Data synced successfully</span>
                  ) : null}
                  {syncStatus === "error" ? (
                    <span style={{ color: "#fb7185" }}>❌ Sync failed</span>
                  ) : null}
                  {syncStatus === "syncing" ? (
                    <span style={{ color: "#facc15" }}>🔄 Syncing...</span>
                  ) : null}
                  {syncStatus === "never" ? (
                    <span style={{ color: "rgba(226,232,240,0.6)" }}>Waiting for first sync</span>
                  ) : null}
                </div>
              ) : (
                <div style={{ minHeight: 16, marginBottom: 8 }} />
              )}

              {!isManualImport && isConnected && live?.mode === "live" ? (
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.65,
                    marginBottom: 10,
                    minHeight: 16,
                  }}
                >
                  Live CRM data flowing into Atlas
                </div>
              ) : (
                <div style={{ minHeight: 16, marginBottom: 10 }} />
              )}

              {!c.manual && accountLabel ? (
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.75,
                    marginBottom: 14,
                    minHeight: 16,
                    wordBreak: "break-word",
                  }}
                >
                  Account: {accountLabel}
                  {live?.externalAccountId && c.id !== "bitrix24"
                    ? ` (${live.externalAccountId})`
                    : ""}
                </div>
              ) : (
                <div style={{ minHeight: 16, marginBottom: 14 }} />
              )}

              {isBitrix24 && !isConnected ? (
                <div
                  style={{
                    marginBottom: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <input
                    type="text"
                    value={bitrixWebhookDraft.bitrix24 || ""}
                    onChange={(e) =>
                      setBitrixWebhookDraft((prev) => ({
                        ...prev,
                        bitrix24: e.target.value,
                      }))
                    }
                    placeholder="https://yourcompany.bitrix24.com/rest/1/xxxxxxxx"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      fontSize: 12,
                      outline: "none",
                    }}
                  />
                </div>
              ) : null}

              {needsGoogleSelection ? (
                <div
                  style={{
                    marginBottom: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <select
                    value={selectedGoogleAccounts.google_ads || ""}
                    onChange={(e) =>
                      setSelectedGoogleAccounts((prev) => ({
                        ...prev,
                        google_ads: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      fontSize: 12,
                      outline: "none",
                    }}
                  >
                    <option value="" style={{ color: "#111" }}>
                      Select Google Ads account
                    </option>
                    {live.accessibleCustomers.map((item) => {
                      const customerId = customerIdFromResourceName(item);
                      return (
                        <option key={item} value={customerId} style={{ color: "#111" }}>
                          Google Ads {customerId}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    onClick={handleGoogleAdsSelectAccount}
                    disabled={!!busyId || uploading || !selectedGoogleAccounts.google_ads}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor:
                        !!busyId || uploading || !selectedGoogleAccounts.google_ads
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        !!busyId || uploading || !selectedGoogleAccounts.google_ads ? 0.7 : 1,
                    }}
                  >
                    {busyId === "google_ads_select" ? "Saving..." : "Use Selected Account"}
                  </button>
                </div>
              ) : null}

              {needsGA4Selection ? (
                <div
                  style={{
                    marginBottom: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <select
                    value={selectedGA4Properties.ga4 || ""}
                    onChange={(e) =>
                      setSelectedGA4Properties((prev) => ({
                        ...prev,
                        ga4: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      fontSize: 12,
                      outline: "none",
                    }}
                  >
                    <option value="" style={{ color: "#111" }}>
                      Select GA4 property
                    </option>
                    {live.properties.map((item) => (
                      <option
                        key={item.resourceName || item.propertyId}
                        value={item.propertyId}
                        style={{ color: "#111" }}
                      >
                        {item.property} ({item.propertyId})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleGA4SelectProperty}
                    disabled={!!busyId || uploading || !selectedGA4Properties.ga4}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor:
                        !!busyId || uploading || !selectedGA4Properties.ga4
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        !!busyId || uploading || !selectedGA4Properties.ga4 ? 0.7 : 1,
                    }}
                  >
                    {busyId === "ga4_select" ? "Saving..." : "Use Selected Property"}
                  </button>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {c.manual ? (
                  <button
                    onClick={handleExcelClick}
                    disabled={uploading || !!busyId}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: uploading || !!busyId ? "not-allowed" : "pointer",
                      opacity: uploading || !!busyId ? 0.7 : 1,
                    }}
                  >
                    {uploading ? "Uploading..." : "Upload Excel / CSV"}
                  </button>
                ) : !isConnected ? (
                  <button
                    onClick={() => handleConnect(c.id)}
                    disabled={!!busyId || uploading}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(96,165,250,0.34)",
                      background: "#2563eb",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                      opacity: !!busyId || uploading ? 0.7 : 1,
                    }}
                  >
                    {isBusy ? "Connecting..." : c.supportsLive ? "Connect Live" : "Connect"}
                  </button>
                ) : (
                  <>
                    <button
                      disabled
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(34,197,94,0.30)",
                        background: "rgba(34,197,94,0.12)",
                        color: "#DCFCE7",
                        fontWeight: 700,
                        fontSize: 12,
                        opacity: 0.95,
                      }}
                    >
                      Connected
                    </button>

                    {isHubSpotLive ? (
                      <button
                        onClick={handleHubSpotSync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "hubspot_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    {isZohoLive ? (
                      <button
                        onClick={handleZohoSync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "zoho_crm_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    {isPipedriveLive ? (
                      <button
                        onClick={handlePipedriveSync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "pipedrive_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    {isBitrix24Live ? (
                      <button
                        onClick={handleBitrix24Sync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "bitrix24_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    {isStripeLive ? (
                      <button
                        onClick={handleStripeSync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "stripe_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    {isShopifyLive ? (
                      <button
                        onClick={handleShopifySync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "shopify_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    {isQuickBooksLive ? (
                      <button
                        onClick={handleQuickBooksSync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "quickbooks_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    {isSalesforceLive ? (
                      <button
                        onClick={handleSalesforceSync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "salesforce_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    {isMetaAdsLive ? (
  <button
    onClick={handleMetaAdsSync}
    disabled={!!busyId || uploading}
    style={{
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.05)",
      color: "#fff",
      fontWeight: 700,
      fontSize: 12,
      cursor: !!busyId || uploading ? "not-allowed" : "pointer",
      opacity: !!busyId || uploading ? 0.7 : 1,
    }}
  >
    {busyId === "meta_ads_sync" ? "Syncing..." : "Run Sync"}
  </button>
) : null}
                    {isLinkedInAdsLive ? (
                      <button
                        onClick={handleLinkedInAdsSync}
                        disabled={!!busyId || uploading}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                          opacity: !!busyId || uploading ? 0.7 : 1,
                        }}
                      >
                        {busyId === "linkedin_ads_sync" ? "Syncing..." : "Run Sync"}
                      </button>
                    ) : null}

                    <button
                      onClick={() => handleDisconnect(c.id)}
                      disabled={!!busyId || uploading}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.05)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: !!busyId || uploading ? "not-allowed" : "pointer",
                        opacity: !!busyId || uploading ? 0.7 : 1,
                      }}
                    >
                      {isBusy ? "Disconnecting..." : "Disconnect"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
