export default function TestsPage() {
  const sections = [
    {
      slice: "Slice 0 — Root",
      routes: [{ path: "/", label: "Root redirect" }],
    },
    {
      slice: "Slice 1 — Auth",
      routes: [
        { path: "/login", label: "Login" },
        { path: "/register", label: "Register" },
        { path: "/onboarding", label: "Onboarding (household creation)" },
        { path: "/invite/[code]", label: "Invite acceptance (requires valid code)" },
      ],
    },
    {
      slice: "Slice 2 — Accounts & Settings",
      routes: [
        { path: "/accounts", label: "Accounts list" },
        { path: "/settings/household", label: "Household settings" },
        { path: "/settings/members", label: "Members & roles" },
        { path: "/settings/symbols", label: "Symbol management" },
      ],
    },
    {
      slice: "Slice 3 — Transactions",
      routes: [
        { path: "/transactions", label: "Transaction list" },
        { path: "/transactions/new", label: "New transaction form" },
      ],
    },
    {
      slice: "Slice 4 — Price Fetching",
      routes: [
        { path: "/settings/price-status", label: "Price fetch status widget (Refresh Now button)" },
        { path: "/api/cron/price-fetch", label: "Cron route (GET, requires CRON_SECRET header in prod)" },
      ],
    },
    {
      slice: "Slice 5 — Dashboard",
      routes: [{ path: "/dashboard", label: "Portfolio dashboard" }],
    },
  ];

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <div
        style={{
          background: "#fef3c7",
          border: "2px solid #f59e0b",
          borderRadius: 6,
          padding: "12px 16px",
          marginBottom: 32,
          fontWeight: "bold",
        }}
      >
        ⚠ Dev only — remove before production.
      </div>

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>PM Testing Hub</h1>
      <p style={{ color: "#6b7280", marginBottom: 32 }}>
        All testable routes, grouped by slice. Links go to the live app — auth-gated pages require a
        logged-in session.
      </p>

      {sections.map((section) => (
        <section key={section.slice} style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6b7280",
              marginBottom: 8,
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: 4,
            }}
          >
            {section.slice}
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {section.routes.map((route) => (
              <li key={route.path} style={{ marginBottom: 6, display: "flex", gap: 12, alignItems: "baseline" }}>
                <a
                  href={route.path.includes("[") ? "#" : route.path}
                  style={{ color: route.path.includes("[") ? "#9ca3af" : "#2563eb", textDecoration: "none", minWidth: 240 }}
                >
                  {route.path}
                </a>
                <span style={{ color: "#374151", fontSize: 13 }}>{route.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
