// frontend/src/pages/CreateWorkspace.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createWorkspace } from "../api";

export default function CreateWorkspace() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
    companyWebsite: "",
    industry: "",
  });

  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    try {
      setCreating(true);

      await createWorkspace({
        name: form.name.trim(),
        companyWebsite: form.companyWebsite.trim(),
        industry: form.industry.trim(),
      });

      nav("/setup", { replace: true });
    } catch (error) {
      console.error("Workspace creation failed:", error);
      setErr(error?.message || "Failed to create workspace. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "radial-gradient(1200px 700px at 15% 15%, rgba(124,92,255,0.22), transparent 60%), radial-gradient(1000px 650px at 85% 30%, rgba(56,189,248,0.18), transparent 60%), linear-gradient(180deg, rgba(5,8,18,1) 0%, rgba(7,12,28,1) 55%, rgba(5,8,18,1) 100%)",
        color: "#EAF0FF",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          padding: 28,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.30)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(191,219,254,0.88)",
            marginBottom: 10,
          }}
        >
          Workspace Setup
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>
          Create your Atlas workspace
        </h1>

        <p style={{ opacity: 0.8, margin: "0 0 24px", lineHeight: 1.6 }}>
          Every company using Atlas gets its own secure workspace, account context,
          and operating environment.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <input
            type="text"
            placeholder="Company name"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            required
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              outline: "none",
            }}
          />

          <input
            type="text"
            placeholder="Company website"
            value={form.companyWebsite}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, companyWebsite: e.target.value }))
            }
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              outline: "none",
            }}
          />

          <input
            type="text"
            placeholder="Industry"
            value={form.industry}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, industry: e.target.value }))
            }
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              outline: "none",
            }}
          />

          {err ? (
            <div
              style={{
                borderRadius: 12,
                padding: 12,
                border: "1px solid rgba(255,120,120,0.35)",
                background: "rgba(255,0,0,0.10)",
                color: "#FFD7D7",
                fontSize: 14,
              }}
            >
              {err}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={creating}
            style={{
              padding: 14,
              borderRadius: 10,
              fontWeight: 900,
              border: "none",
              background: "linear-gradient(90deg,#2563eb,#38bdf8)",
              color: "#fff",
              cursor: creating ? "not-allowed" : "pointer",
              marginTop: 6,
              opacity: creating ? 0.75 : 1,
            }}
          >
            {creating ? "Creating Workspace..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}