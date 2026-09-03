// frontend/src/pages/Billing.jsx
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createCheckoutSession,
  createPortalSession,
  getBillingSummary,
} from "../api";

const PLANS = [
  {
    key: "SCALE",
    name: "Atlas Core",
    price: "$197",
    description:
      "The essential revenue operating system for growing teams.",
    badge: "Foundation",
    features: [
      "Revenue overview",
      "Command Center",
      "Deal visibility",
      "Account and partner management",
    ],
  },
  {
    key: "GROWTH",
    name: "Atlas Growth",
    price: "$997",
    description:
      "Deeper forecasting, analysis, and reporting for revenue teams.",
    badge: "Most Popular",
    featured: true,
    features: [
      "Everything in Atlas Core",
      "Advanced forecasting",
      "AI revenue analysis",
      "Executive reports",
    ],
  },
  {
    key: "ENTERPRISE",
    name: "Atlas Enterprise",
    price: "$3,500",
    description:
      "Full-scale revenue intelligence and executive decision support.",
    badge: "Full Platform",
    features: [
      "Everything in Atlas Growth",
      "Atlas AI Operator",
      "Executive Board Mode",
      "Enterprise operating visibility",
    ],
  },
];

function normalizePlan(value) {
  const plan = String(value || "")
    .trim()
    .toUpperCase();

  if (plan === "CORE") return "SCALE";
  if (plan === "SCALE") return "SCALE";
  if (plan === "GROWTH") return "GROWTH";
  if (plan === "ENTERPRISE") return "ENTERPRISE";

  return "SCALE";
}

function planName(value) {
  const plan = normalizePlan(value);

  return (
    PLANS.find((item) => item.key === plan)?.name ||
    "Atlas Core"
  );
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function titleCase(value) {
  const stringValue = String(value || "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!stringValue) return "Not available";

  return stringValue.replace(
    /\b\w/g,
    (letter) => letter.toUpperCase()
  );
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getTrialDays(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil(
      (date.getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  );
}

function getBillingState(summary) {
  const billingStatus = normalizeStatus(
    summary?.billingStatus
  );

  const paymentStatus = normalizeStatus(
    summary?.paymentStatus
  );

  const trialStatus = normalizeStatus(
    summary?.trial?.status
  );

  if (
    billingStatus === "past_due" ||
    paymentStatus === "past_due"
  ) {
    return {
      key: "past_due",
      label: "Payment Needs Attention",
      title: "Payment action required",
      message:
        "Your latest payment was unsuccessful. Open billing to update the payment method and restore full access.",
      style: styles.warningBanner,
      pill: styles.warningPill,
    };
  }

  if (
    ["canceled", "cancelled"].includes(
      billingStatus
    ) ||
    ["canceled", "cancelled"].includes(
      paymentStatus
    )
  ) {
    return {
      key: "canceled",
      label: "Canceled",
      title: "Subscription canceled",
      message:
        "This subscription is no longer active. Select a plan to restore workspace access.",
      style: styles.dangerBanner,
      pill: styles.dangerPill,
    };
  }

  if (
    billingStatus === "active" ||
    paymentStatus === "paid"
  ) {
    if (!summary?.hasStripeCustomer) {
      return {
        key: "managed",
        label: "Managed Access",
        title: "Workspace access active",
        message:
          "This workspace has active access managed directly by Atlas Revenue AI.",
        style: styles.successBanner,
        pill: styles.successPill,
      };
    }

    return {
      key: "active",
      label: "Active",
      title: "Subscription active",
      message:
        "Your Atlas subscription is active and this workspace has full access to its current plan.",
      style: styles.successBanner,
      pill: styles.successPill,
    };
  }

  if (
    billingStatus === "trialing" ||
    paymentStatus === "trialing" ||
    trialStatus === "trialing"
  ) {
    return {
      key: "trialing",
      label: "Trial",
      title: "Free trial active",
      message:
        "Explore Atlas during your trial. Choose a plan before the trial ends to keep your workspace active.",
      style: styles.infoBanner,
      pill: styles.infoPill,
    };
  }

  if (
    trialStatus === "expired" ||
    normalizeStatus(summary?.accessStatus) ===
      "suspended"
  ) {
    return {
      key: "expired",
      label: "Access Paused",
      title: "Choose a plan to restore access",
      message:
        "Your trial or subscription access has ended. Select the plan that best fits your team.",
      style: styles.dangerBanner,
      pill: styles.dangerPill,
    };
  }

  return {
    key: "pending",
    label: "Pending",
    title: "Billing setup incomplete",
    message:
      "Choose an Atlas plan to complete billing for this workspace.",
    style: styles.neutralBanner,
    pill: styles.neutralPill,
  };
}

function SummaryCard({
  label,
  value,
  valueStyle,
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>

      <div
        style={{
          ...styles.summaryValue,
          ...(valueStyle || {}),
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  currentPlan,
  summary,
  loadingAction,
  onCheckout,
  onPortal,
}) {
  const isCurrent = currentPlan === plan.key;
  const hasSubscription = Boolean(
    summary?.hasSubscription
  );

  const hasStripeCustomer = Boolean(
    summary?.hasStripeCustomer
  );

  const billingState = getBillingState(summary);
  const canManage = Boolean(summary?.canManage);
  const managedAccess =
    billingState.key === "managed";

  const changingPlan =
    loadingAction === `plan:${plan.key}`;

  let buttonLabel = `Choose ${plan.name}`;
  let disabled = false;
  let action = () => onCheckout(plan.key);

  if (!canManage) {
    buttonLabel = "Owner or Admin Required";
    disabled = true;
  } else if (managedAccess) {
    buttonLabel = isCurrent
      ? "Current Plan"
      : "Managed by Atlas";
    disabled = true;
  } else if (
    hasSubscription &&
    hasStripeCustomer
  ) {
    buttonLabel = isCurrent
      ? "Current Plan"
      : "Change in Billing Portal";

    disabled = isCurrent;
    action = onPortal;
  } else if (isCurrent && billingState.key === "active") {
    buttonLabel = "Current Plan";
    disabled = true;
  } else if (
    isCurrent &&
    billingState.key === "trialing"
  ) {
    buttonLabel = `Subscribe to ${plan.name}`;
  }

  if (changingPlan) {
    buttonLabel = "Opening Checkout...";
  }

  if (
    loadingAction &&
    loadingAction !== `plan:${plan.key}`
  ) {
    disabled = true;
  }

  return (
    <article
      style={{
        ...styles.planCard,
        ...(plan.featured
          ? styles.featuredPlanCard
          : {}),
        ...(isCurrent
          ? styles.currentPlanCard
          : {}),
      }}
    >
      <div style={styles.planTop}>
        <div>
          <div style={styles.planName}>
            {plan.name}
          </div>

          {isCurrent ? (
            <div style={styles.currentText}>
              Current workspace plan
            </div>
          ) : null}
        </div>

        <span
          style={
            plan.featured
              ? styles.featuredBadge
              : styles.planBadge
          }
        >
          {plan.badge}
        </span>
      </div>

      <div style={styles.priceRow}>
        <span style={styles.price}>
          {plan.price}
        </span>
        <span style={styles.pricePeriod}>
          /month
        </span>
      </div>

      <p style={styles.planDescription}>
        {plan.description}
      </p>

      <div style={styles.featureList}>
        {plan.features.map((feature) => (
          <div
            key={feature}
            style={styles.feature}
          >
            <span style={styles.check}>✓</span>
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={action}
        disabled={disabled || changingPlan}
        style={{
          ...styles.planButton,
          ...(plan.featured
            ? styles.featuredPlanButton
            : {}),
          ...(isCurrent && disabled
            ? styles.currentPlanButton
            : {}),
          opacity:
            disabled || changingPlan ? 0.68 : 1,
          cursor:
            disabled || changingPlan
              ? "not-allowed"
              : "pointer",
        }}
      >
        {buttonLabel}
      </button>
    </article>
  );
}

export default function Billing() {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] =
    useState(true);

  const [loadingAction, setLoadingAction] =
    useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadSummary() {
    try {
      setLoadingSummary(true);
      setError("");

      const response = await getBillingSummary();
      const billing =
        response?.billing || response;

      setSummary(billing || null);
    } catch (err) {
      console.error(
        "Billing summary error:",
        err
      );

      setError(
        err?.message ||
          "Unable to load billing information."
      );
    } finally {
      setLoadingSummary(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const checkoutStatus =
      params.get("checkout");

    if (checkoutStatus === "success") {
      setNotice(
        "Checkout completed. Stripe is confirming the subscription now."
      );
    }

    if (checkoutStatus === "cancelled") {
      setNotice(
        "Checkout was canceled. No plan changes were made."
      );
    }

    loadSummary();
  }, []);

  const currentPlan = normalizePlan(
    summary?.plan
  );

  const billingState = useMemo(
    () => getBillingState(summary),
    [summary]
  );

  const trialEnd =
    summary?.trial?.endsAt ||
    summary?.trial?.endDate ||
    "";

  const trialDays = getTrialDays(trialEnd);

  const periodLabel =
    billingState.key === "trialing"
      ? trialEnd
        ? formatDate(trialEnd)
        : "Trial active"
      : summary?.hasSubscription
      ? formatDate(summary?.currentPeriodEnd)
      : billingState.key === "managed"
      ? "Managed by Atlas"
      : "Not started";

  async function openPortal() {
    try {
      setLoadingAction("portal");
      setError("");
      setNotice("");

      const response =
        await createPortalSession();

      if (!response?.url) {
        throw new Error(
          "The billing portal URL was not returned."
        );
      }

      window.location.assign(response.url);
    } catch (err) {
      console.error(
        "Billing portal error:",
        err
      );

      setError(
        err?.message ||
          "Unable to open the billing portal."
      );
      setLoadingAction("");
    }
  }

  async function startCheckout(plan) {
    try {
      setLoadingAction(`plan:${plan}`);
      setError("");
      setNotice("");

      const response =
        await createCheckoutSession(plan);

      if (!response?.url) {
        throw new Error(
          "The checkout URL was not returned."
        );
      }

      window.location.assign(response.url);
    } catch (err) {
      console.error("Checkout error:", err);

      if (
        err?.data?.code ===
        "USE_BILLING_PORTAL"
      ) {
        setLoadingAction("");
        await openPortal();
        return;
      }

      setError(
        err?.message ||
          "Unable to start checkout."
      );
      setLoadingAction("");
    }
  }

  if (loadingSummary) {
    return (
      <div style={styles.loadingPage}>
        Loading billing information...
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        .atlas-billing-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 11px;
        }

        .atlas-billing-plans {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 980px) {
          .atlas-billing-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .atlas-billing-plans {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 580px) {
          .atlas-billing-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={styles.heroHeader}>
            <div>
              <div style={styles.eyebrow}>
                Workspace Billing
              </div>

              <h1 style={styles.title}>
                Billing & Plan
              </h1>

              <p style={styles.subtitle}>
                Manage the Atlas plan for{" "}
                <strong>
                  {summary?.orgName ||
                    "this workspace"}
                </strong>
                .
              </p>
            </div>

            <div style={styles.headerActions}>
              <button
                type="button"
                onClick={loadSummary}
                disabled={Boolean(loadingAction)}
                style={styles.secondaryButton}
              >
                Refresh
              </button>

              {summary?.canManage &&
              summary?.hasStripeCustomer ? (
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={Boolean(loadingAction)}
                  style={styles.primaryButton}
                >
                  {loadingAction === "portal"
                    ? "Opening..."
                    : "Manage Billing"}
                </button>
              ) : null}
            </div>
          </div>

          {notice ? (
            <div style={styles.notice}>
              {notice}
            </div>
          ) : null}

          {error ? (
            <div style={styles.error}>
              {error}
            </div>
          ) : null}

          <div style={billingState.style}>
            <div>
              <div style={styles.stateTitle}>
                {billingState.title}
              </div>

              <div style={styles.stateMessage}>
                {billingState.message}
              </div>

              {billingState.key ===
                "trialing" &&
              trialDays !== null ? (
                <div style={styles.trialMessage}>
                  {trialDays} day
                  {trialDays === 1 ? "" : "s"}{" "}
                  remaining
                </div>
              ) : null}
            </div>

            <span style={billingState.pill}>
              {billingState.label}
            </span>
          </div>

          <div className="atlas-billing-summary">
            <SummaryCard
              label="Current Plan"
              value={planName(currentPlan)}
            />

            <SummaryCard
              label="Billing Status"
              value={billingState.label}
              valueStyle={{
                color:
                  billingState.pill.color,
              }}
            />

            <SummaryCard
              label="Your Access"
              value={titleCase(
                summary?.role || "member"
              )}
            />

            <SummaryCard
              label={
                billingState.key === "trialing"
                  ? "Trial Ends"
                  : "Next Billing Date"
              }
              value={periodLabel}
            />
          </div>

          {!summary?.canManage ? (
            <div style={styles.permissionNotice}>
              You can view this workspace’s plan, but
              only an owner or admin can make billing
              changes.
            </div>
          ) : null}
        </section>

        <section style={styles.plansSection}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>
                Atlas Plans
              </div>

              <h2 style={styles.sectionTitle}>
                Choose the right level of intelligence
              </h2>

              <p style={styles.sectionSubtitle}>
                Plan changes are completed securely
                through Stripe.
              </p>
            </div>
          </div>

          <div className="atlas-billing-plans">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                currentPlan={currentPlan}
                summary={summary}
                loadingAction={loadingAction}
                onCheckout={startCheckout}
                onPortal={openPortal}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const baseBanner = {
  marginTop: 18,
  padding: 15,
  borderRadius: 15,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const basePill = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "7px 11px",
  borderRadius: 999,
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px 16px 42px",
    color: "#EAF0FF",
    background:
      "radial-gradient(900px 480px at 10% 0%, rgba(37,99,235,0.15), transparent 58%), radial-gradient(850px 500px at 92% 5%, rgba(124,92,255,0.11), transparent 58%), #050814",
  },

  loadingPage: {
    minHeight: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(226,232,240,0.72)",
  },

  container: {
    width: "100%",
    maxWidth: 1380,
    margin: "0 auto",
    display: "grid",
    gap: 15,
  },

  hero: {
    padding: "23px",
    borderRadius: 21,
    border:
      "1px solid rgba(125,160,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.19), rgba(76,29,149,0.1), rgba(9,15,32,0.82))",
    boxShadow:
      "0 18px 45px rgba(0,0,0,0.2)",
  },

  heroHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
  },

  eyebrow: {
    color: "#7DD3FC",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.17em",
    textTransform: "uppercase",
  },

  title: {
    margin: "7px 0 0",
    color: "#FFFFFF",
    fontSize: "clamp(29px, 4vw, 38px)",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    margin: "10px 0 0",
    color: "rgba(226,232,240,0.8)",
    fontSize: 14,
    lineHeight: 1.6,
  },

  headerActions: {
    display: "flex",
    gap: 9,
    flexWrap: "wrap",
  },

  stateTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 900,
  },

  stateMessage: {
    marginTop: 5,
    maxWidth: 850,
    color: "rgba(226,232,240,0.78)",
    fontSize: 13,
    lineHeight: 1.55,
  },

  trialMessage: {
    marginTop: 7,
    color: "#BAE6FD",
    fontSize: 12,
    fontWeight: 800,
  },

  successBanner: {
    ...baseBanner,
    border:
      "1px solid rgba(34,197,94,0.25)",
    background: "rgba(34,197,94,0.08)",
  },

  infoBanner: {
    ...baseBanner,
    border:
      "1px solid rgba(56,189,248,0.25)",
    background: "rgba(56,189,248,0.08)",
  },

  warningBanner: {
    ...baseBanner,
    border:
      "1px solid rgba(245,158,11,0.28)",
    background: "rgba(245,158,11,0.09)",
  },

  dangerBanner: {
    ...baseBanner,
    border:
      "1px solid rgba(239,68,68,0.28)",
    background: "rgba(239,68,68,0.09)",
  },

  neutralBanner: {
    ...baseBanner,
    border:
      "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
  },

  successPill: {
    ...basePill,
    color: "#86EFAC",
    border:
      "1px solid rgba(34,197,94,0.27)",
    background: "rgba(34,197,94,0.11)",
  },

  infoPill: {
    ...basePill,
    color: "#BAE6FD",
    border:
      "1px solid rgba(56,189,248,0.27)",
    background: "rgba(56,189,248,0.11)",
  },

  warningPill: {
    ...basePill,
    color: "#FDE68A",
    border:
      "1px solid rgba(245,158,11,0.27)",
    background: "rgba(245,158,11,0.11)",
  },

  dangerPill: {
    ...basePill,
    color: "#FCA5A5",
    border:
      "1px solid rgba(239,68,68,0.27)",
    background: "rgba(239,68,68,0.11)",
  },

  neutralPill: {
    ...basePill,
    color: "#CBD5E1",
    border:
      "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
  },

  summaryCard: {
    marginTop: 16,
    minHeight: 94,
    padding: 14,
    borderRadius: 14,
    border:
      "1px solid rgba(255,255,255,0.075)",
    background: "rgba(3,8,22,0.31)",
  },

  summaryLabel: {
    color: "rgba(148,163,184,0.78)",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.13em",
    textTransform: "uppercase",
  },

  summaryValue: {
    marginTop: 9,
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 1.25,
    fontWeight: 900,
  },

  permissionNotice: {
    marginTop: 13,
    padding: "11px 12px",
    borderRadius: 11,
    border:
      "1px solid rgba(167,139,250,0.16)",
    background: "rgba(167,139,250,0.06)",
    color: "rgba(221,214,254,0.84)",
    fontSize: 12,
    lineHeight: 1.5,
  },

  notice: {
    marginTop: 15,
    padding: "11px 13px",
    borderRadius: 11,
    border:
      "1px solid rgba(56,189,248,0.2)",
    background: "rgba(56,189,248,0.07)",
    color: "#BAE6FD",
    fontSize: 12,
  },

  error: {
    marginTop: 15,
    padding: "11px 13px",
    borderRadius: 11,
    border:
      "1px solid rgba(239,68,68,0.28)",
    background: "rgba(239,68,68,0.09)",
    color: "#FECACA",
    fontSize: 12,
  },

  plansSection: {
    padding: "20px",
    borderRadius: 20,
    border:
      "1px solid rgba(255,255,255,0.08)",
    background: "rgba(8,13,29,0.74)",
    boxShadow:
      "0 16px 38px rgba(0,0,0,0.17)",
  },

  sectionHeader: {
    marginBottom: 16,
  },

  sectionTitle: {
    margin: "6px 0 0",
    color: "#FFFFFF",
    fontSize: 22,
    letterSpacing: "-0.025em",
  },

  sectionSubtitle: {
    margin: "6px 0 0",
    color: "rgba(203,213,225,0.68)",
    fontSize: 12,
    lineHeight: 1.5,
  },

  planCard: {
    minHeight: 410,
    padding: 18,
    borderRadius: 17,
    border:
      "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.025)",
    display: "flex",
    flexDirection: "column",
  },

  featuredPlanCard: {
    border:
      "1px solid rgba(56,189,248,0.29)",
    background:
      "linear-gradient(180deg, rgba(37,99,235,0.13), rgba(14,165,233,0.055))",
    boxShadow:
      "0 13px 32px rgba(37,99,235,0.12)",
  },

  currentPlanCard: {
    boxShadow:
      "inset 0 0 0 1px rgba(34,197,94,0.18)",
  },

  planTop: {
    minHeight: 47,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  planName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: 900,
  },

  currentText: {
    marginTop: 4,
    color: "#86EFAC",
    fontSize: 10,
    fontWeight: 800,
  },

  planBadge: {
    ...basePill,
    color: "#CBD5E1",
    border:
      "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
  },

  featuredBadge: {
    ...basePill,
    color: "#BAE6FD",
    border:
      "1px solid rgba(56,189,248,0.25)",
    background: "rgba(56,189,248,0.1)",
  },

  priceRow: {
    marginTop: 16,
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },

  price: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },

  pricePeriod: {
    color: "rgba(203,213,225,0.58)",
    fontSize: 12,
  },

  planDescription: {
    minHeight: 62,
    margin: "12px 0 0",
    color: "rgba(203,213,225,0.73)",
    fontSize: 13,
    lineHeight: 1.55,
  },

  featureList: {
    marginTop: 13,
    display: "grid",
    gap: 10,
  },

  feature: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    color: "#DCE6F3",
    fontSize: 12,
    lineHeight: 1.45,
  },

  check: {
    color: "#38BDF8",
    fontWeight: 900,
  },

  planButton: {
    width: "100%",
    marginTop: "auto",
    padding: "11px 13px",
    borderRadius: 11,
    border:
      "1px solid rgba(255,255,255,0.11)",
    background: "rgba(255,255,255,0.06)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 900,
  },

  featuredPlanButton: {
    border:
      "1px solid rgba(56,189,248,0.2)",
    background:
      "linear-gradient(90deg, #2563EB, #0EA5E9)",
  },

  currentPlanButton: {
    border:
      "1px solid rgba(34,197,94,0.23)",
    background: "rgba(34,197,94,0.09)",
    color: "#86EFAC",
  },

  primaryButton: {
    padding: "11px 15px",
    border: 0,
    borderRadius: 11,
    background:
      "linear-gradient(90deg, #2563EB, #0EA5E9)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryButton: {
    padding: "11px 15px",
    borderRadius: 11,
    border:
      "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.055)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
};
