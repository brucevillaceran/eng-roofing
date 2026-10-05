import {
  workDate,
  attendanceStatus,
  elapsedHours,
  roundedHours,
} from "../shared/attendance.js";
import React, {
  useState,
  useEffect,
  useRef,
  useId,
  createContext,
  useContext,
} from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardCheck,
  FileText,
  HardHat,
  Package,
  ScanFace,
  Wallet,
  CreditCard,
  ChartNoAxesCombined,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Menu,
  X,
  Check,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  ArrowDownLeft,
  ArrowUp,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  Download,
  Filter,
  Lock,
  Star,
  Camera,
  LogOut,
  House,
  Layers,
  BriefcaseBusiness,
  TrendingUp,
  RefreshCw,
  Send,
  Eye,
  ShieldCheck,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  PolarRadiusAxis,
} from "recharts";
import QRCode from "qrcode";
import { profiles, accessories } from "../shared/roofing.js";
import "./style.css";
import {
  validateAction,
  validateAuth,
  photoValue,
  identifier,
} from "../shared/validation.js";
import { fieldConstraints, checkField, checkForm } from "./form-validation.js";
const Ctx = createContext();
const useApp = () => useContext(Ctx);
const money = (n) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
const day = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not scheduled";
const stamp = (d) =>
  new Date(d).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const today = () => new Date().toISOString().slice(0, 10);
const initials = (n) =>
  n
    ?.split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("") || "EN";
const services = ["Roof Installation", "Roof Replacement", "Roof Repair"];
const projectTypes = [
  "Residential",
  "Commercial",
  "Industrial",
  "Institutional",
];
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Users", Users],
  ["Bookings", CalendarDays],
  ["Site Inspections", ClipboardCheck],
  ["Quotations", FileText],
  ["Projects", HardHat],
  ["Materials", Package],
  ["Attendance", ScanFace],
  ["Payroll", Wallet],
  ["Payments", CreditCard],
  ["Feedback Analysis", ChartNoAxesCombined],
  ["Notifications", Bell],
];
const allowed = {
  Admin: nav.map((x) => x[0]),
  Foreman: [
    "Dashboard",
    "Projects",
    "Site Inspections",
    "Quotations",
    "Tasks",
    "Project Progress",
    "Material Usage",
    "Attendance",
    "Notifications",
    "Profile",
  ],
  Employee: [
    "Dashboard",
    "Projects",
    "Tasks",
    "Attendance",
    "Payroll",
    "Notifications",
    "Profile",
  ],
  Client: [
    "Dashboard",
    "Bookings",
    "Site Inspections",
    "Projects",
    "Quotations",
    "Payments",
    "Feedback",
    "Notifications",
    "Profile",
  ],
};
function Badge({ children }) {
  return (
    <span
      className={`badge ${["Ongoing", "Approved", "Completed", "Fully Paid", "Active", "Paid"].includes(children) ? "green" : ["Pending", "Awaiting Client", "Initial Estimate", "Partially Paid", "Scheduled", "For Inspection", "Rescheduled"].includes(children) ? "amber" : ["Rejected", "Cancelled", "Unpaid", "On Hold", "Disabled"].includes(children) ? "red" : "gray"}`}
    >
      <i />
      {children}
    </span>
  );
}
function Avatar({ name, small = false, photo }) {
  if (photo)
    return (
      <img
        className={`avatar ${small ? "small" : ""}`}
        src={photo}
        alt={name}
      />
    );
  return (
    <span className={`avatar ${small ? "small" : ""}`}>{initials(name)}</span>
  );
}
function Button({ children, variant = "", ...props }) {
  return (
    <button className={`btn ${variant}`} {...props}>
      {children}
    </button>
  );
}
function Empty({
  title = "Nothing here yet",
  text = "Records will appear as your roofing workflow progresses.",
  action,
}) {
  return (
    <div className="empty">
      <Layers size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  name,
  type = "text",
  value,
  options,
  required = false,
  children,
  ...props
}) {
  const [error, setError] = useState("");
  const errorId = useId();
  const constraints = fieldConstraints({
    name,
    label,
    type,
    required,
    options,
    ...props,
  });
  const validationProps = {
    ...constraints,
    ...props,
    "aria-invalid": !!error,
    "aria-describedby": error ? errorId : props["aria-describedby"],
    onInput: (e) => {
      setError(checkField(e.currentTarget) || "");
      props.onInput?.(e);
    },
    onBlur: (e) => {
      setError(checkField(e.currentTarget, true) || "");
      props.onBlur?.(e);
    },
  };
  return (
    <label className={`field ${type === "textarea" ? "full" : ""}`}>
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {options ? (
        <select
          name={name}
          defaultValue={value ?? ""}
          required={required}
          {...validationProps}
        >
          {!value && <option value="">Select {label.toLowerCase()}</option>}
          {options.map((o) => (
            <option
              key={typeof o === "string" ? o : o.value}
              value={typeof o === "string" ? o : o.value}
            >
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          name={name}
          defaultValue={value}
          required={required}
          rows={3}
          {...validationProps}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          {...validationProps}
        />
      )}{" "}
      {children}
      {error && (
        <small id={errorId} className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
function Form({
  children,
  onSubmit,
  submit = "Save changes",
  footer,
  disabled = false,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          checkForm(e.currentTarget);
          await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">{children}</div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="form-footer">
        {footer}
        <Button type="submit" disabled={busy || disabled}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}{" "}
          {busy ? "Saving…" : submit}
        </Button>
      </div>
    </form>
  );
}
function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current.querySelectorAll(
          "button,input,select,textarea,a[href]",
        );
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      old?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Authentication({ onDone }) {
  const [register, setRegister] = useState(location.pathname === "/register");
  return (
    <div className="auth-page">
      <section className="card auth-card">
        <a href="/home" className="auth-brand">
          <img src="/favicon.svg" width="48" alt="ENG Roofing" />
          <h1>ENG Roofing</h1>
        </a>
        <h2>{register ? "Create your client account" : "Sign in"}</h2>
        <p>
          {register
            ? "Track bookings, quotations, projects, and payments in your own portal."
            : "Use your assigned account to open your portal."}
        </p>
        <Form
          submit={register ? "Register" : "Sign in"}
          onSubmit={async (d) => {
            d = validateAuth(register ? "register" : "login", d);
            const res = await fetch(
              `/api/auth/${register ? "register" : "login"}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(d),
              },
            );
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            await onDone();
            const target = location.pathname;
            location.href =
              target.startsWith("/track/") ||
              target.startsWith("/verify/") ||
              target === "/book"
                ? target
                : `/${result.user.role.toLowerCase()}/dashboard`;
          }}
        >
          {register && (
            <Field
              label="Full name"
              name="name"
              maxLength="150"
              autoComplete="name"
              required
            />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          {register && (
            <Field
              label="Contact number"
              name="contact"
              autoComplete="tel"
              required
            />
          )}
          <Field
            label="Password"
            name="password"
            type="password"
            minLength={register ? 12 : undefined}
            maxLength="128"
            autoComplete={register ? "new-password" : "current-password"}
            required
          />
        </Form>
        <button className="text-button" onClick={() => setRegister(!register)}>
          {register
            ? "Already registered? Sign in"
            : "New client? Create an account"}
        </button>
        <p className="muted">Staff accounts are created by Admin.</p>
      </section>
    </div>
  );
}

function App() {
  const [state, setState] = useState(null),
    [session, setSession] = useState(null),
    [page, setPage] = useState(
      () =>
        [
          ...nav.map((n) => n[0]),
          "Settings",
          "Profile",
          "Tasks",
          "Project Progress",
          "Material Usage",
          "Feedback",
        ].find(
          (n) =>
            n.toLowerCase().replaceAll(" ", "-") ===
            window.location.pathname.split("/")[2],
        ) || "Dashboard",
    ),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  const path = window.location.pathname;
  const load = async () => {
    const auth = await fetch("/api/auth/me");
    if (!auth.ok) throw new Error("Could not load your session.");
    const identity = await auth.json();
    setSession(identity.user ? identity : null);
    if (!identity.user) {
      setState({
        users: [],
        bookings: [],
        inspections: [],
        quotations: [],
        projects: [],
        tasks: [],
        materials: [],
        usage: [],
        attendance: [],
        payroll: [],
        payments: [],
        feedback: [],
        notifications: [],
        emails: [],
        settings: [],
      });
      return;
    }
    const r = await fetch("/api/state");
    if (!r.ok) throw new Error("Could not load the workspace.");
    setState(await r.json());
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const refresh = setInterval(
      () => load().catch((e) => setError(e.message)),
      30000,
    );
    const navigate = () =>
      setPage(
        [
          ...nav.map((n) => n[0]),
          "Settings",
          "Profile",
          "Tasks",
          "Project Progress",
          "Material Usage",
          "Feedback",
        ].find(
          (n) =>
            n.toLowerCase().replaceAll(" ", "-") ===
            location.pathname.split("/")[2],
        ) || "Dashboard",
      );
    window.addEventListener("popstate", navigate);
    return () => {
      clearInterval(refresh);
      window.removeEventListener("popstate", navigate);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const act = async (action, data, keep = false) => {
    data = validateAction(action, data, { state, user: session?.user });
    const r = await fetch("/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": session?.csrf || "",
      },
      body: JSON.stringify({ action, data }),
    });
    const result = await r.json();
    if (!r.ok) {
      if (r.status === 401) await load();
      throw new Error(result.error);
    }
    await load();
    if (!keep) setModal(null);
    setToast("Changes saved successfully");
    return result;
  };
  if (!state)
    return (
      <div className="loading">
        <img src="/favicon.svg" width="56" />
        <h2>ENG Roofing</h2>
        <p>{error || "Preparing your workspace…"}</p>
        {error && <Button onClick={() => location.reload()}>Try again</Button>}
      </div>
    );
  const user = session?.user;
  if (
    !user &&
    !["/home", "/book", "/track"].includes(path) &&
    !path.startsWith("/track/")
  )
    return <Authentication onDone={load} />;
  if (
    user &&
    (path === "/login" ||
      path === "/register" ||
      path === "/" ||
      (path === "/book" && !["Admin", "Client"].includes(user.role)) ||
      (path.split("/")[2] &&
        !["track", "verify"].includes(path.split("/")[1]) &&
        path.split("/")[1] !== user.role.toLowerCase()))
  ) {
    location.replace(`/${user.role.toLowerCase()}/dashboard`);
    return null;
  }
  const currentPage =
    user &&
    (allowed[user.role].includes(page) ||
      (user.role === "Admin" && ["Settings", "Profile"].includes(page)))
      ? page
      : "Dashboard";
  const go = (p) => {
    if (!(
      allowed[user.role].includes(p) ||
      (user.role === "Admin" && ["Settings", "Profile"].includes(p))
    ))
      return;
    history.pushState(
      {},
      "",
      `/${user.role.toLowerCase()}/${p.toLowerCase().replaceAll(" ", "-")}`,
    );
    setPage(p);
    setSearch("");
    setMobile(false);
  };
  const context = {
    s: state,
    user,
    act,
    setModal,
    setToast,
    go,
    search,
    setSearch,
  };
  if (path.startsWith("/track/"))
    return (
      <Ctx.Provider value={context}>
        <Tracking token={path.split("/")[2]} />
        {toast && (
          <div className="toast">
            <CheckCircle2 size={18} />
            {toast}
          </div>
        )}
      </Ctx.Provider>
    );
  if (path.startsWith("/verify/"))
    return <PersonnelVerify id={path.split("/")[2]} />;
  if (path === "/home" || path === "/book" || path === "/track")
    return (
      <Ctx.Provider value={context}>
        <PublicPage initial={path} />
        {modal && <ModalContent modal={modal} />}{" "}
        {toast && (
          <div className="toast">
            <CheckCircle2 size={18} />
            {toast}
          </div>
        )}
      </Ctx.Provider>
    );
  const visibleNav = [
    ...nav,
    ...[
      ["Tasks", ClipboardCheck],
      ["Project Progress", TrendingUp],
      ["Material Usage", Package],
      ["Feedback", Star],
      ["Profile", Users],
    ],
  ].filter(([n]) => allowed[user.role].includes(n));
  return (
    <Ctx.Provider value={context}>
      <div className="app-shell">
        {mobile && (
          <div className="sidebar-overlay" onClick={() => setMobile(false)} />
        )}
        <aside className={`sidebar ${mobile ? "open" : ""}`}>
          <a className="brand" href="/">
            <img src="/favicon.svg" />
            <div>
              ENG ROOFING<small>SUPPLY & INSTALLATION</small>
            </div>
          </a>
          <div className="workspace-tag">
            <div className="workspace-icon">
              <BriefcaseBusiness size={17} />
            </div>
            <div>
              Company workspace<small>{user.role} portal</small>
            </div>
            <ChevronDown size={15} />
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {visibleNav.map(([name, Icon]) => (
              <button
                key={name}
                className={`nav-item ${page === name ? "active" : ""}`}
                onClick={() => go(name)}
              >
                <Icon size={18} />
                <span>
                  {user.role !== "Admin" && name === "Projects"
                    ? "My Projects"
                    : user.role === "Foreman" && name === "Quotations"
                      ? "Initial Quotations"
                      : name}
                </span>
                {name === "Bookings" &&
                  state.bookings.filter((b) => b.status === "Pending").length >
                    0 && (
                    <b>
                      {
                        state.bookings.filter((b) => b.status === "Pending")
                          .length
                      }
                    </b>
                  )}
                {name === "Notifications" &&
                  state.notifications.some((n) => !n.read) && (
                    <i className="notification-dot" />
                  )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="portal-card">
              <span className="portal-icon">
                <House size={17} />
              </span>
              <h4>Built for better roofing.</h4>
              <p>
                One team. Every project.
                <br />
                All in one place.
              </p>
              <a href="/home">
                Visit public website <ArrowUpRight size={15} />
              </a>
            </div>
            <button
              className={`nav-item ${page === "Settings" ? "active" : ""}`}
              onClick={() => go(user.role === "Admin" ? "Settings" : "Profile")}
            >
              <Settings size={18} />
              <span>
                {user.role === "Admin" ? "Settings" : "Profile settings"}
              </span>
            </button>
            <div className="sidebar-foot">
              <span className="live-dot" /> Secure account portal{" "}
              <span>v1.0</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-btn mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <b>{page}</b>
            </div>
            <div className="top-actions">
              <span className="portal-label">{user.role}</span>
              <button
                className="icon-btn top-bell"
                aria-label="View notifications"
                onClick={() => go("Notifications")}
              >
                <Bell size={19} />
                {state.notifications.some((n) => !n.read) && <i />}
              </button>
              <div className="top-divider" />
              <Avatar name={user.name} photo={user.photo} />
              <label className="user-select">
                <strong>{user.name}</strong>
                <small>{user.role} account</small>
              </label>
              <Button
                variant="small secondary"
                onClick={async () => {
                  const response = await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-csrf-token": session.csrf,
                    },
                    body: "{}",
                  });
                  if (response.ok) {
                    setSession(null);
                    setState(null);
                    location.href = "/login";
                  } else setToast("Could not sign out. Please try again.");
                }}
              >
                Sign out
              </Button>
            </div>
          </header>
          <main>
            {currentPage === "Dashboard" ? (
              <Dashboard />
            ) : (
              <ModulePage page={currentPage} />
            )}
          </main>
          <footer className="app-footer">
            <span>
              © {new Date().getFullYear()} ENG Roofing Supply & Installation
              Services
            </span>
            <span>Integrated projects. Connected people.</span>
          </footer>
        </div>
      </div>
      {modal && <ModalContent modal={modal} />}{" "}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}
function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
const paymentStatus = (s, p) => {
  const total = s.quotations.find((q) => q.id === p.quotationId)?.total || 0,
    paid = s.payments
      .filter((x) => x.projectId === p.id)
      .reduce((a, x) => a + x.amount, 0);
  return {
    total,
    paid,
    balance: total - paid,
    status:
      paid >= total ? "Fully Paid" : paid > 0 ? "Partially Paid" : "Unpaid",
  };
};
const userProjects = (s, user) =>
  s.projects.filter(
    (p) =>
      user.role === "Admin" ||
      (user.role === "Foreman" && p.foremanId === user.id) ||
      (user.role === "Employee" && p.employeeIds.includes(user.id)) ||
      (user.role === "Client" &&
        s.bookings.find((b) => b.id === p.bookingId)?.clientId === user.id),
  );
function Dashboard() {
  const { s, user, go, setModal } = useApp();
  const projects = userProjects(s, user),
    active = projects.filter((p) => p.status === "Ongoing"),
    outstanding = projects.reduce((a, p) => a + paymentStatus(s, p).balance, 0);
  const pending = s.bookings.filter((b) => b.status === "Pending"),
    quotes = s.quotations.filter((q) =>
      ["Initial Estimate", "Awaiting Client"].includes(q.status),
    );
  const stats =
    user.role === "Admin"
      ? [
          [
            "Total Projects",
            projects.length,
            HardHat,
            "Across all roofing services",
            "neutral",
          ],
          [
            "Active Projects",
            active.length,
            TrendingUp,
            "Projects moving forward",
            "green",
          ],
          [
            "Pending Bookings",
            pending.length,
            CalendarDays,
            "Awaiting your review",
            "amber",
          ],
          [
            "Pending Quotations",
            quotes.length,
            FileText,
            "Ready for the next step",
            "amber",
          ],
          [
            "Outstanding Payments",
            money(outstanding),
            CreditCard,
            "Across active projects",
            "neutral",
          ],
          [
            "Team Members",
            s.users.filter((u) => ["Foreman", "Employee"].includes(u.role))
              .length,
            Users,
            "Your people on the ground",
            "green",
          ],
        ]
      : [
          [
            "My Projects",
            projects.length,
            HardHat,
            "Assigned roofing projects",
            "neutral",
          ],
          [
            "Active Projects",
            active.length,
            TrendingUp,
            "Currently in progress",
            "green",
          ],
          [
            user.role === "Client" ? "Remaining Balance" : "My Tasks",
            user.role === "Client"
              ? money(outstanding)
              : s.tasks.filter(
                  (t) =>
                    (user.role === "Foreman" || t.assigneeId === user.id) &&
                    t.progress < 100,
                ).length,
            user.role === "Client" ? CreditCard : ClipboardCheck,
            user.role === "Client"
              ? "Across your projects"
              : "Ready for your attention",
            "amber",
          ],
        ];
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE, AT A GLANCE"
        title={`Good morning, ${user.name.split(" ")[0]}.`}
        description="Here’s what’s happening with your roofing projects today."
      >
        <div className="date-chip">
          <CalendarDays size={15} />
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        {["Admin", "Client"].includes(user.role) && (
          <Button onClick={() => setModal({ type: "bookingNew" })}>
            <Plus size={17} />
            New Booking
          </Button>
        )}
      </PageHeading>
      <div className="welcome-banner">
        <div className="banner-grid" />
        <div className="banner-copy">
          <span className="banner-eyebrow">
            <span /> EVERY DETAIL. EVERY ROOF.
          </span>
          <h2>
            Great projects start with
            <br />a clear overview.
          </h2>
          <p>
            Keep your team aligned, your projects on track,
            <br className="desktop-only" /> and your clients in the loop.
          </p>
          <button onClick={() => go("Projects")}>
            View all projects <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="banner-art">
          <RoofIllustration />
        </div>
        <div className="banner-summary">
          <span className="banner-summary-icon">
            <ShieldCheck size={22} />
          </span>
          <strong>{active.length} projects in motion</strong>
          <span>Building trust, one roof at a time.</span>
        </div>
      </div>
      <div className={`stats-grid ${user.role !== "Admin" ? "three" : ""}`}>
        {stats.map(([title, value, Icon, note, tone]) => (
          <div className="stat-card" key={title}>
            <div className="stat-top">
              <span>{title}</span>
              <span className={`stat-icon ${tone}`}>
                <Icon size={17} />
              </span>
            </div>
            <strong>{value}</strong>
            <div className="stat-foot">
              <span className={`tiny-dot ${tone}`} />
              {note}
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-charts">
        <section className="card project-status">
          <CardHead
            title="Project overview"
            subtitle="A snapshot of your project pipeline"
          >
            <span className="muted text-xs">
              All projects <ChevronDown size={13} />
            </span>
          </CardHead>
          <div className="donut-layout">
            <div
              className="donut"
              style={{ background: donutBackground(projects) }}
            >
              <div>
                <strong>{projects.length}</strong>
                <span>Total projects</span>
              </div>
            </div>
            <div className="chart-legend">
              {[
                ["Ongoing", "#287453"],
                ["Completed", "#afd0aa"],
                ["Scheduled", "#e9bc68"],
                ["Pending", "#dde4df"],
              ].map(([status, color]) => (
                <div key={status}>
                  <span>
                    <i style={{ background: color }} />
                    {status}
                  </span>
                  <b>
                    {projects
                      .filter((p) => p.status === status)
                      .length.toString()
                      .padStart(2, "0")}
                  </b>
                </div>
              ))}
            </div>
          </div>
          <div className="card-note">
            <TrendingUp size={14} />
            {projects.filter((p) => p.status === "Completed").length} projects
            successfully completed
          </div>
        </section>
        {["Admin", "Client"].includes(user.role) && (
          <section className="card payment-chart">
            <CardHead
              title="Payment summary"
              subtitle="Project value and payments received"
            >
              <span className="legend-inline">
                <i />
                Value <i />
                Received
              </span>
            </CardHead>
            <div className="bar-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={projects.slice(0, 6).map((p) => ({
                    name: p.name.split(" ")[0],
                    Value: paymentStatus(s, p).total,
                    Received: paymentStatus(s, p).paid,
                  }))}
                  barGap={5}
                  margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 4"
                    vertical={false}
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v / 1000}k`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={money}
                    contentStyle={{ borderRadius: 10, fontSize: 12 }}
                  />
                  <Bar
                    dataKey="Value"
                    fill="#fecaca"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={19}
                  />
                  <Bar
                    dataKey="Received"
                    fill="#b91c1c"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={19}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
      <div className="dashboard-bottom">
        <section className="card active-projects">
          <CardHead
            title="Active projects"
            subtitle="A closer look at the work in progress"
          >
            <button className="text-button" onClick={() => go("Projects")}>
              View all projects <ArrowRight size={14} />
            </button>
          </CardHead>
          <ProjectTable
            projects={projects
              .filter(
                (p) => p.status !== "Completed" && p.status !== "Cancelled",
              )
              .slice(0, 4)}
            compact
          />
        </section>
        <section className="card activity">
          <CardHead title="Recent activity">
            <span className="live-tag">Live updates</span>
          </CardHead>
          <div className="activity-list">
            {s.notifications
              .filter((n) => n.userId === user.id)
              .slice(0, 4)
              .map((n, i) => (
                <div className="activity-item" key={n.id}>
                  <span className={`activity-icon a${i}`}>
                    {i === 0 ? (
                      <CalendarDays size={15} />
                    ) : i === 1 ? (
                      <CreditCard size={15} />
                    ) : (
                      <ClipboardCheck size={15} />
                    )}
                  </span>
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <small>{stamp(n.createdAt)}</small>
                  </div>
                </div>
              ))}
            {!s.notifications.some((n) => n.userId === user.id) && (
              <p className="muted">You’re all caught up.</p>
            )}
          </div>
          <button
            className="activity-footer"
            onClick={() => go("Notifications")}
          >
            View all activity <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <div className="dashboard-extra">
        {["Admin", "Client"].includes(user.role) && (
          <section className="card">
            <CardHead
              title="Client satisfaction"
              subtitle="Ratings from completed roofing projects"
            >
              <button
                className="text-button"
                onClick={() =>
                  go(user.role === "Admin" ? "Feedback Analysis" : "Projects")
                }
              >
                View insights <ArrowUpRight size={14} />
              </button>
            </CardHead>
            <div className="satisfaction-mini">
              <span className="rating-number">
                {average(s.feedback).toFixed(1)}
                <small>/ 5</small>
              </span>
              <div>
                <div className="stars">
                  {Array.from({ length: 5 }, (_, i) =>
                    i < Math.round(average(s.feedback)) ? "★" : "☆",
                  ).join("")}
                </div>
                <span className="muted">
                  Based on {s.feedback.length} client reviews
                </span>
              </div>
              <div className="mini-category">
                <b>
                  {s.feedback.length
                    ? [
                        "installation",
                        "service",
                        "timeliness",
                        "professionalism",
                      ].sort(
                        (a, b) =>
                          average(s.feedback, b) - average(s.feedback, a),
                      )[0]
                    : "No ratings yet"}
                </b>
                <span>Highest-rated category</span>
              </div>
            </div>
          </section>
        )}
        {["Admin", "Employee"].includes(user.role) && (
          <section className="card payroll-mini">
            <CardHead
              title="Payroll overview"
              subtitle="Attendance connected to every payslip"
            >
              <Wallet size={20} />
            </CardHead>
            <div>
              <strong>{money(s.payroll.reduce((a, p) => a + p.net, 0))}</strong>
              <span>{s.payroll.length} payroll records processed</span>
              <button
                className="text-button"
                onClick={() =>
                  go(
                    allowed[user.role].includes("Payroll")
                      ? "Payroll"
                      : "Projects",
                  )
                }
              >
                View details <ArrowRight size={14} />
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
function CardHead({ title, subtitle, children }) {
  return (
    <div className="card-head">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
function donutBackground(projects) {
  const n = projects.length || 1;
  let sum = 0;
  const colors = {
    Ongoing: "#287453",
    Completed: "#afd0aa",
    Scheduled: "#e9bc68",
    Pending: "#dde4df",
    Approved: "#83a5b4",
    "On Hold": "#ca9279",
    Cancelled: "#dadada",
  };
  return `conic-gradient(${Object.entries(colors)
    .map(([k, c]) => {
      const prev = sum;
      sum += (projects.filter((p) => p.status === k).length / n) * 100;
      return `${c} ${prev}% ${sum}%`;
    })
    .join(",")})`;
}
function RoofIllustration() {
  return (
    <svg viewBox="0 0 550 260" fill="none" aria-hidden="true">
      <path d="m62 207 230-92 208 70-222 67Z" fill="#7f1d1d" />
      <path d="m149 144 131 47v-92L149 65Z" fill="#e5e7eb" />
      <path d="m280 191 166-65V67L280 99Z" fill="#d1d5db" />
      <path d="m136 65 148 51L453 58 307 11Z" fill="#dc2626" />
      <path d="m136 65 148 51 12-12L159 56Z" fill="#fecaca" />
      <path d="m284 116 169-58-2 10-170 58Z" fill="#f3f4f6" />
      <path d="m307 11-11 93L453 58Z" fill="#991b1b" />
      {Array.from({ length: 14 }, (_, i) => (
        <path
          key={i}
          d={`m${154 + i * 10.4} ${58 - i * 3.45} 141 47`}
          stroke="#7f1d1d"
          strokeWidth="2"
        />
      ))}
      <path d="m184 116 34 12v56l-34-12Z" fill="#374151" />
      <path d="m234 129 25 9v27l-25-9Z" fill="#6b7280" />
      <path d="m306 134 43-17v28l-43 17Z" fill="#6b7280" />
      <path d="m367 111 48-18v29l-48 18Z" fill="#6b7280" />
      <path
        d="m327 126 1 27m61-51v29m-83 17 43-17m18-5 48-18"
        stroke="#e5e7eb"
        strokeWidth="3"
      />
      <path d="m133 178 47 16 7-6-46-16Z" fill="#d1d5db" />
      <path d="m126 186 57 20 5-7-54-18Z" fill="#9ca3af" />
      <path d="M102 184v-63m-14 10 14-42 15 44-15 25Z" fill="#75a077" />
      <path d="M468 158v-51m-12 9 12-33 16 34-15 21Z" fill="#78a477" />
      <path d="m209 223 62 22 174-69" stroke="#9ca3af" strokeDasharray="4 6" />
      <circle cx="472" cy="62" r="18" fill="#7f1d1d" />
      <path
        d="m465 62 5 5 10-10"
        stroke="#fee2e2"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
function ProjectTable({ projects, compact = false }) {
  const { setModal } = useApp();
  return projects.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Project name</th>
            {!compact && <th>Client / location</th>}
            <th>Status</th>
            <th>Progress</th>
            <th>Est. completion</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr
              key={p.id}
              onClick={() => setModal({ type: "projectDetail", record: p })}
              className="clickable"
            >
              <td>
                <div className="project-cell">
                  <span className={`project-icon p${i % 3}`}>
                    <House size={17} />
                  </span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.service} <span>· {p.id}</span>
                    </small>
                  </div>
                </div>
              </td>
              {!compact && (
                <td>
                  <strong>{p.client}</strong>
                  <small>{p.address}</small>
                </td>
              )}
              <td>
                <Badge>{p.status}</Badge>
              </td>
              <td>
                <div className="progress-cell">
                  <div className="progress-track">
                    <i style={{ width: `${p.progress}%` }} />
                  </div>
                  <span>{p.progress}%</span>
                </div>
              </td>
              <td className="muted nowrap">
                {p.end ? day(p.end) : "Not scheduled"}
              </td>
              <td>
                <button className="icon-btn" aria-label={`View ${p.name}`}>
                  <MoreHorizontal size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="No projects to show" />
  );
}
function average(feedback, key) {
  if (!feedback.length) return 0;
  return (
    feedback.reduce(
      (a, f) =>
        a +
        (key
          ? f[key]
          : (f.installation + f.service + f.timeliness + f.professionalism) /
            4),
      0,
    ) / feedback.length
  );
}
const descriptions = {
  Users: "Manage the people behind every successful roofing project.",
  Bookings: "From the first request to the first site visit.",
  Projects: "Keep every roofing project moving in the right direction.",
  Materials: "Maintain materials, current prices, and catalog availability.",
  Quotations: "Turn site measurements into clear, accurate roofing estimates.",
  "Site Inspections":
    "Capture the actual requirements before preparing an estimate.",
  Attendance: "Face verification and geotagging, linked to assigned projects.",
  Payroll: "Verified attendance, transparent calculations, clear payslips.",
  Payments: "Every payment connected to its project and approved quotation.",
  "Feedback Analysis": "Listen to your clients. Improve the work that matters.",
  Notifications: "Stay connected to every step of the roofing workflow.",
  Tasks: "Plan the work. Keep your team aligned.",
  "Project Progress": "Track the details behind each project milestone.",
  "Material Usage":
    "Connect planned quantities to deliveries and actual usage.",
  Feedback: "Tell us about your completed roofing project.",
  Settings: "Manage company details and payroll policy.",
  Profile: "Your personnel identity and contact details.",
};
function ModulePage({ page }) {
  const { s, user, setModal, search, setSearch, act, setToast } = useApp(),
    [filter, setFilter] = useState("All"),
    [view, setView] = useState("List");
  useEffect(() => {
    setFilter("All");
  }, [page]);
  const projects = userProjects(s, user),
    ownedIds = projects.map((p) => p.id),
    ownedBooking = (b) => user.role !== "Client" || b.clientId === user.id;
  const matches = (obj) =>
    JSON.stringify(obj).toLowerCase().includes(search.toLowerCase());
  const add =
    page === "Bookings"
      ? ["New Booking", "bookingNew"]
      : page === "Materials" && user.role === "Admin"
        ? ["Add Material", "material"]
        : page === "Users"
          ? ["Add User", "user"]
          : page === "Payroll" && user.role === "Admin"
            ? ["Process Payroll", "payroll"]
            : page === "Payments" && user.role === "Admin"
              ? ["Record Payment", "payment"]
              : null;
  const exportData = () => {
    const data =
      page === "Projects"
        ? projects
        : page === "Payments"
          ? s.payments.filter((p) => ownedIds.includes(p.projectId))
          : page === "Payroll"
            ? s.payroll.filter(
                (p) => user.role === "Admin" || p.userId === user.id,
              )
            : s.bookings.filter(ownedBooking);
    const text = JSON.stringify(data, null, 2),
      url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `eng-${page.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Export downloaded");
  };
  return (
    <>
      <PageHeading
        eyebrow="ENG ROOFING WORKSPACE"
        title={
          page === "Projects" && user.role !== "Admin" ? "My Projects" : page
        }
        description={descriptions[page]}
      >
        {["Projects", "Payments", "Payroll", "Bookings"].includes(page) && (
          <Button variant="secondary" onClick={exportData}>
            <Download size={15} />
            Export
          </Button>
        )}
        {add && (
          <Button onClick={() => setModal({ type: add[1] })}>
            <Plus size={16} />
            {add[0]}
          </Button>
        )}
      </PageHeading>
      {page === "Feedback Analysis" ? (
        <FeedbackAnalysis />
      ) : page === "Settings" ? (
        <section className="card settings-card">
          <h3>Company settings</h3>
          <Form onSubmit={(d) => act("settings", d)}>
            <Field
              label="Company name"
              name="name"
              value={s.settings[0].name}
              required
            />
            <div className="info full">
              Maintain your current material prices in Materials. Approved
              quotations retain their original prices.
            </div>
            <Field
              label="Payroll policy note"
              name="payrollNote"
              type="textarea"
              value={s.settings[0].payrollNote}
            />
            <div className="info full">
              Accounts use secure sessions and role permissions. Messages are
              saved in the email outbox; external email delivery is not
              configured. Face verification records location but does not
              provide liveness detection.
            </div>
          </Form>
        </section>
      ) : page === "Profile" ? (
        <Profile user={user} />
      ) : page === "Notifications" ? (
        <Notifications />
      ) : page === "Attendance" ? (
        <Attendance />
      ) : page === "Feedback" ? (
        <div className="cards-grid">
          {projects
            .filter((p) => p.status === "Completed")
            .map((p) => (
              <section className="card padded" key={p.id}>
                <Badge>{p.status}</Badge>
                <h3>{p.name}</h3>
                <p>Share your experience with the roofing team.</p>
                <a
                  className="btn"
                  href={`/track/${s.bookings.find((b) => b.id === p.bookingId).token}?feedback=1`}
                >
                  {s.feedback.some((f) => f.projectId === p.id)
                    ? "View feedback"
                    : "Leave feedback"}
                  <ArrowRight size={16} />
                </a>
              </section>
            ))}
        </div>
      ) : (
        <>
          {["Projects", "Payments"].includes(page) && (
            <div className="summary-strip">
              {page === "Projects" ? (
                <>
                  <div>
                    <small>Total projects</small>
                    <strong>{projects.length}</strong>
                  </div>
                  <div>
                    <small>Ongoing</small>
                    <strong>
                      {projects.filter((p) => p.status === "Ongoing").length}
                    </strong>
                  </div>
                  <div>
                    <small>Completed</small>
                    <strong>
                      {projects.filter((p) => p.status === "Completed").length}
                    </strong>
                  </div>
                  <div>
                    <small>On schedule</small>
                    <strong>
                      {
                        projects.filter(
                          (p) => p.status === "Ongoing" && p.end >= today(),
                        ).length
                      }
                    </strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <small>Total project value</small>
                    <strong>
                      {money(
                        projects.reduce(
                          (a, p) => a + paymentStatus(s, p).total,
                          0,
                        ),
                      )}
                    </strong>
                  </div>
                  <div>
                    <small>Received</small>
                    <strong>
                      {money(
                        projects.reduce(
                          (a, p) => a + paymentStatus(s, p).paid,
                          0,
                        ),
                      )}
                    </strong>
                  </div>
                  <div>
                    <small>Outstanding</small>
                    <strong>
                      {money(
                        projects.reduce(
                          (a, p) => a + paymentStatus(s, p).balance,
                          0,
                        ),
                      )}
                    </strong>
                  </div>
                </>
              )}
            </div>
          )}
          <section className="card module-card">
            <div className="table-toolbar">
              <div className="search-input">
                <Search size={16} />
                <input
                  aria-label={`Search ${page}`}
                  placeholder={`Search ${page.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {["Bookings", "Projects", "Quotations", "Materials"].includes(
                page,
              ) && (
                <div className="filter-select">
                  <Filter size={14} />
                  <select
                    aria-label="Filter by status"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {[
                      "All",
                      ...(page === "Bookings"
                        ? [
                            "Pending",
                            "Approved",
                            "Rejected",
                            "Rescheduled",
                            "For Inspection",
                            "Completed",
                            "Cancelled",
                          ]
                        : page === "Projects"
                          ? [
                              "Pending",
                              "Approved",
                              "Scheduled",
                              "Ongoing",
                              "On Hold",
                              "Completed",
                              "Cancelled",
                            ]
                          : page === "Materials"
                            ? ["Active", "Disabled"]
                            : [
                                "Initial Estimate",
                                "Awaiting Client",
                                "Approved",
                                "Rejected",
                              ]),
                    ].map((x) => (
                      <option key={x} value={x}>
                        {x === "All" ? "All statuses" : x}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <span className="table-toolbar-note">
                {page === "Bookings"
                  ? "Oldest submission first · exact timestamps"
                  : "Connected to your roofing workflow"}
              </span>
            </div>
            {page === "Projects" ? (
              <ProjectTable
                projects={projects
                  .filter(matches)
                  .filter((p) => filter === "All" || p.status === filter)}
              />
            ) : page === "Bookings" ? (
              <DataTable
                headers={[
                  "Booking / client",
                  "Roofing service",
                  "Preferred schedule",
                  "Submitted at",
                  "Status",
                  "",
                ]}
                rows={s.bookings
                  .filter(ownedBooking)
                  .filter(matches)
                  .filter((b) => filter === "All" || b.status === filter)
                  .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
                  .map((b) => [
                    <Name name={b.name} sub={b.id} />,
                    <Name name={b.service} sub={b.type} />,
                    <Name name={day(b.date)} sub={b.time} />,
                    <span className="timestamp">
                      {stamp(b.submitted_at)}
                      <small>{new Date(b.submitted_at).toISOString()}</small>
                    </span>,
                    <Badge>{b.status}</Badge>,
                    <Button
                      variant="small secondary"
                      onClick={() =>
                        user.role === "Admin"
                          ? setModal({ type: "booking", record: b })
                          : window.open(`/track/${b.token}`, "_blank")
                      }
                    >
                      {user.role === "Admin" ? "Review" : "Track"}
                      <ArrowRight size={13} />
                    </Button>,
                  ])}
              />
            ) : page === "Materials" ? (
              <>
                <div className="info inline-info">
                  Current catalog prices. Historical quotations keep their
                  original unit prices.
                </div>
                <DataTable
                  headers={[
                    "Material",
                    "Category / profile",
                    "Thickness",
                    "Unit",
                    "Unit price",
                    "Status",
                    "",
                  ]}
                  rows={s.materials
                    .filter(matches)
                    .filter(
                      (m) =>
                        filter === "All" ||
                        (m.active ? "Active" : "Disabled") === filter,
                    )
                    .map((m) => [
                      <Name name={m.name} sub={m.id} />,
                      <Name name={m.category} sub={m.profile} />,
                      m.thickness,
                      m.unit,
                      <b>{money(m.price)}</b>,
                      <Badge>{m.active ? "Active" : "Disabled"}</Badge>,
                      <Button
                        variant="small secondary"
                        onClick={() =>
                          setModal({ type: "material", record: m })
                        }
                      >
                        Edit
                      </Button>,
                    ])}
                />
              </>
            ) : page === "Users" ? (
              <DataTable
                headers={[
                  "Team member",
                  "Role",
                  "Contact",
                  "Daily rate",
                  "Face enrollment",
                  "",
                ]}
                rows={s.users.filter(matches).map((u) => [
                  <div className="person-cell">
                    <Avatar name={u.name} />
                    <Name name={u.name} sub={u.id} />
                  </div>,
                  <div>
                    <Badge>{u.role}</Badge>
                    <Badge>{u.active === false ? "Disabled" : "Active"}</Badge>
                  </div>,
                  <Name name={u.email} sub={u.contact} />,
                  u.role === "Employee" ? money(u.rate) : "Not applicable",
                  u.role === "Employee"
                    ? u.enrolled
                      ? "Enrolled"
                      : "Enrollment required"
                    : "Not applicable",
                  <div className="row-actions">
                    <Button
                      variant="small secondary"
                      onClick={() => setModal({ type: "user", record: u })}
                    >
                      Edit
                    </Button>
                    {u.role === "Employee" && (
                      <Button
                        variant="small secondary"
                        onClick={() => setModal({ type: "enroll", record: u })}
                      >
                        <ScanFace size={14} />
                        Enroll
                      </Button>
                    )}
                  </div>,
                ])}
              />
            ) : page === "Site Inspections" ? (
              <DataTable
                headers={[
                  "Inspection",
                  "Client / service",
                  "Inspector",
                  "Schedule",
                  "Status",
                  "",
                ]}
                rows={s.inspections
                  .filter(
                    (i) =>
                      ["Admin", "Client"].includes(user.role) ||
                      i.foremanId === user.id,
                  )
                  .filter((i) =>
                    matches({
                      ...i,
                      booking: s.bookings.find((b) => b.id === i.bookingId),
                    }),
                  )
                  .map((i) => {
                    const b = s.bookings.find((b) => b.id === i.bookingId);
                    return [
                      <Name name={i.id} sub={b.id} />,
                      <Name name={b.name} sub={b.service} />,
                      s.users.find((u) => u.id === i.foremanId)?.name,
                      day(i.date),
                      <Badge>{i.status}</Badge>,
                      <div className="row-actions">
                        <Button
                          variant="small secondary"
                          onClick={() =>
                            setModal({ type: "inspection", record: i })
                          }
                        >
                          {user.role === "Client" ? "View" : "Inspect"}
                        </Button>
                        {user.role !== "Client" &&
                          i.status === "Completed" &&
                          !s.quotations.some(
                            (q) => q.inspectionId === i.id,
                          ) && (
                            <Button
                              variant="small"
                              onClick={() =>
                                setModal({ type: "estimate", record: i })
                              }
                            >
                              Prepare estimate
                            </Button>
                          )}
                      </div>,
                    ];
                  })}
              />
            ) : page === "Quotations" ? (
              <DataTable
                headers={[
                  "Quotation",
                  "Client / service",
                  "Materials",
                  "Total",
                  "Status",
                  "",
                ]}
                rows={s.quotations
                  .filter(
                    (q) =>
                      user.role === "Admin" ||
                      (user.role === "Foreman" &&
                        s.inspections.find((i) => i.id === q.inspectionId)
                          ?.foremanId === user.id) ||
                      (user.role === "Client" &&
                        s.bookings.find((b) => b.id === q.bookingId)
                          ?.clientId === user.id),
                  )
                  .filter((q) =>
                    matches({
                      ...q,
                      booking: s.bookings.find((b) => b.id === q.bookingId),
                    }),
                  )
                  .filter((q) => filter === "All" || q.status === filter)
                  .map((q) => {
                    const b = s.bookings.find((b) => b.id === q.bookingId);
                    return [
                      <Name name={q.id} sub={day(q.createdAt)} />,
                      <Name name={b.name} sub={b.service} />,
                      `${q.items.length} line items`,
                      <b>{money(q.total)}</b>,
                      <Badge>{q.status}</Badge>,
                      <Button
                        variant="small secondary"
                        onClick={() =>
                          setModal({ type: "quotation", record: q })
                        }
                      >
                        View quotation
                        <ArrowRight size={14} />
                      </Button>,
                    ];
                  })}
              />
            ) : page === "Payments" ? (
              <DataTable
                headers={[
                  "Project / client",
                  "Quotation",
                  "Total amount",
                  "Paid",
                  "Balance",
                  "Payment status",
                  "",
                ]}
                rows={projects.filter(matches).map((p) => {
                  const pay = paymentStatus(s, p);
                  return [
                    <Name name={p.name} sub={p.client} />,
                    p.quotationId,
                    money(pay.total),
                    money(pay.paid),
                    <b>{money(pay.balance)}</b>,
                    <Badge>{pay.status}</Badge>,
                    <Button
                      variant="small secondary"
                      onClick={() =>
                        setModal({
                          type:
                            user.role === "Admin" ? "payment" : "projectDetail",
                          record: p,
                        })
                      }
                    >
                      {user.role === "Admin" && pay.balance > 0
                        ? "Record payment"
                        : "View"}
                    </Button>,
                  ];
                })}
              />
            ) : page === "Payroll" ? (
              <>
                <div className="info inline-info">
                  {s.settings[0].payrollNote}
                </div>
                <DataTable
                  headers={[
                    "Employee",
                    "Period",
                    "Days / hours",
                    "Daily rate",
                    "Gross pay",
                    "Deductions",
                    "Net pay",
                    "Status",
                    "",
                  ]}
                  rows={s.payroll
                    .filter(
                      (p) => user.role === "Admin" || p.userId === user.id,
                    )
                    .filter(matches)
                    .map((p) => [
                      s.users.find((u) => u.id === p.userId)?.name,
                      `${day(p.from)} – ${day(p.to)}`,
                      `${p.days} days / ${p.hours} hrs`,
                      money(p.rate),
                      money(p.gross),
                      money(p.deductions),
                      <b>{money(p.net)}</b>,
                      <Badge>{p.status}</Badge>,
                      <Button
                        variant="small secondary"
                        onClick={() => setModal({ type: "payslip", record: p })}
                      >
                        Payslip
                      </Button>,
                    ])}
                />
              </>
            ) : ["Tasks", "Project Progress", "Material Usage"].includes(
                page,
              ) ? (
              <div className="project-cards">
                {projects.filter(matches).map((p) => (
                  <div className="project-summary-row" key={p.id}>
                    <div>
                      <Badge>{p.status}</Badge>
                      <h3>{p.name}</h3>
                      <p>
                        {p.service} · {p.address}
                      </p>
                      <div className="progress-cell">
                        <div className="progress-track">
                          <i style={{ width: `${p.progress}%` }} />
                        </div>
                        {p.progress}%
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setModal({
                          type: "projectDetail",
                          record: p,
                          tab:
                            page === "Material Usage"
                              ? "Materials"
                              : page === "Project Progress"
                                ? "Overview"
                                : "Tasks",
                        })
                      }
                    >
                      Manage {page.toLowerCase()}
                      <ArrowRight size={15} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}
    </>
  );
}
function Name({ name, sub }) {
  return (
    <div>
      <strong className="table-name">{name}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
function DataTable({ headers, rows }) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
function FeedbackAnalysis() {
  const { s, setModal } = useApp();
  const data = ["installation", "service", "timeliness", "professionalism"].map(
      (k) => ({
        category: k[0].toUpperCase() + k.slice(1),
        rating: Number(average(s.feedback, k).toFixed(1)),
      }),
    ),
    sorted = [...data].sort((a, b) => b.rating - a.rating);
  return (
    <>
      <div className="feedback-stats">
        <div className="card">
          <span>Overall average</span>
          <strong>
            {average(s.feedback).toFixed(1)}
            <small> / 5</small>
          </strong>
          <span className="stars">
            {Array.from({ length: 5 }, (_, i) =>
              i < Math.round(average(s.feedback)) ? "★" : "☆",
            ).join("")}
          </span>
        </div>
        <div className="card">
          <span>Client responses</span>
          <strong>{s.feedback.length}</strong>
          <small>From completed projects</small>
        </div>
        <div className="card">
          <span>Highest-rated category</span>
          <strong className="category-value">
            {s.feedback.length ? sorted[0].category : "No ratings yet"}
          </strong>
          <small>{sorted[0].rating.toFixed(1)} out of 5</small>
        </div>
        <div className="card">
          <span>Opportunity to improve</span>
          <strong className="category-value">
            {s.feedback.length ? sorted.at(-1).category : "No ratings yet"}
          </strong>
          <small>{sorted.at(-1).rating.toFixed(1)} out of 5</small>
        </div>
      </div>
      <div className="feedback-layout">
        <section className="card">
          <CardHead
            title="Client experience, by category"
            subtitle="Numerical rating analysis · scale of 1 to 5"
          />
          <div className="radar">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={data}
                outerRadius="65%"
                startAngle={45}
                endAngle={-315}
              >
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="category"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                />
                <PolarRadiusAxis
                  domain={[0, 5]}
                  tickCount={6}
                  tick={{ fontSize: 10 }}
                />
                <Radar
                  dataKey="rating"
                  stroke="#b91c1c"
                  fill="#dc2626"
                  fillOpacity={0.3}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="rating-bars">
            {data.map((d) => (
              <div key={d.category}>
                <span>{d.category}</span>
                <div className="progress-track">
                  <i style={{ width: `${(d.rating / 5) * 100}%` }} />
                </div>
                <b>{d.rating.toFixed(1)}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <CardHead
            title="What our clients are saying"
            subtitle="Comments submitted after project completion"
          />
          {s.feedback.map((f) => (
            <div className="review" key={f.id}>
              <div className="person-cell">
                <Avatar name={f.name} />
                <div>
                  <strong>{f.name}</strong>
                  <small>
                    {s.projects.find((p) => p.id === f.projectId)?.name}
                  </small>
                </div>
                <span className="review-rating">
                  <Star size={13} fill="currentColor" />
                  {(
                    (f.installation +
                      f.service +
                      f.timeliness +
                      f.professionalism) /
                    4
                  ).toFixed(1)}
                </span>
              </div>
              <p>“{f.comments || "No written comment."}”</p>
              <small>{day(f.createdAt)}</small>
              {f.reviewNotes && <p>Admin review: {f.reviewNotes}</p>}
              <Button
                variant="small secondary"
                onClick={() => setModal({ type: "feedbackReview", record: f })}
              >
                Review feedback
              </Button>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function Notifications() {
  const { s, user, act, setModal } = useApp();
  const [tab, setTab] = useState("Activity");
  return (
    <section className="card">
      <div className="tabs">
        <button
          className={tab === "Activity" ? "active" : ""}
          onClick={() => setTab("Activity")}
        >
          Activity
        </button>
        {user.role === "Admin" && (
          <button
            className={tab === "Email preview" ? "active" : ""}
            onClick={() => setTab("Email preview")}
          >
            Email preview <span>{s.emails.length}</span>
          </button>
        )}
        {user.role === "Admin" && (
          <Button
            variant="small secondary"
            onClick={() => setModal({ type: "notification" })}
          >
            Send notification
          </Button>
        )}
        <Button variant="small secondary" onClick={() => act("read", {}, true)}>
          Mark all as read
        </Button>
      </div>
      {tab === "Activity" ? (
        s.notifications
          .filter((n) => n.userId === user.id)
          .map((n) => (
            <div className="notification-row" key={n.id}>
              <span className="activity-icon">
                <Bell size={17} />
              </span>
              <div>
                <strong>
                  {n.title}
                  {!n.read && <i className="unread-dot" />}
                </strong>
                <p>{n.message}</p>
                <small>{stamp(n.createdAt)}</small>
              </div>
            </div>
          ))
      ) : (
        <>
          <div className="info inline-info">
            Email outbox. These messages contain booking updates and links; no
            external email delivery is configured.
          </div>
          {s.emails.length ? (
            s.emails.map((e) => (
              <div className="notification-row" key={e.id}>
                <Mail size={22} />
                <div>
                  <strong>{e.subject}</strong>
                  <small>
                    To: {e.to} · {stamp(e.createdAt)}
                  </small>
                  <p>{e.message}</p>
                  <a className="text-button" href={e.path} target="_blank">
                    Open client link <ExternalLink size={13} />
                  </a>
                </div>
                <Badge>{e.status}</Badge>
              </div>
            ))
          ) : (
            <Empty title="Your workflow emails will appear here" />
          )}
        </>
      )}
    </section>
  );
}
function Profile({ user }) {
  const { act } = useApp();
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${location.origin}/verify/${user.id}`, {
      width: 180,
      margin: 1,
    }).then(setQr);
  }, [user.id]);
  return (
    <section className="card profile-card">
      <Avatar name={user.name} photo={user.photo} />
      <h2>{user.name}</h2>
      <Badge>{user.role}</Badge>
      <p>
        <Mail size={16} />
        {user.email}
      </p>
      <p>
        <Phone size={16} />
        {user.contact}
      </p>
      <p>Account ID: {user.id}</p>
      <Form onSubmit={(d) => act("profile", d, true)} submit="Save profile">
        <Field label="Full name" name="name" value={user.name} required />
        <Field
          label="Contact number"
          name="contact"
          value={user.contact}
          required
        />
        <Field
          label="Current password (for password change)"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
        />
        <Field
          label="New password (optional)"
          name="password"
          type="password"
          minLength="12"
          autoComplete="new-password"
        />
      </Form>
      {user.role === "Foreman" && (
        <>
          <img src={qr} width="160" alt="Scan to verify assigned foreman" />
          <small>Scan to verify personnel</small>
          <a href={`/verify/${user.id}`} className="text-button">
            Open verification page <ExternalLink size={14} />
          </a>
        </>
      )}
    </section>
  );
}
function UserAccountForm({ record }) {
  const { act } = useApp();
  const [role, setRole] = useState(record?.role || "Employee");
  const [descriptor, setDescriptor] = useState(null);
  const [photos, setPhotos] = useState(record?.photo ? [record.photo] : []);
  const enrolled =
    role === "Employee" && record?.role === "Employee" && record.enrolled;
  return (
    <Form
      onSubmit={(d) =>
        act("user", {
          ...d,
          id: record?.id,
          photo: photos[0] || "",
          ...(role === "Employee" && descriptor ? { descriptor } : {}),
        })
      }
    >
      <Field label="Full name" name="name" value={record?.name} required />
      <Field
        label="Role"
        name="role"
        value={role}
        options={["Admin", "Foreman", "Employee", "Client"]}
        required
        onChange={(e) => {
          setRole(e.target.value);
          setDescriptor(null);
        }}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        value={record?.email}
        required
      />
      <Field
        label="Contact number"
        name="contact"
        value={record?.contact}
        required
      />
      {role === "Employee" && (
        <>
          <Field
            label="Daily rate (₱)"
            name="rate"
            type="number"
            min="0.01"
            max="100000"
            step="0.01"
            value={record?.role === "Employee" ? record.rate : ""}
            required
          />
          <section
            className="full"
            aria-label="Required employee face enrollment"
          >
            <h4>Face enrollment *</h4>
            {descriptor ? (
              <p className="info">
                Face captured. Enrollment will be saved with this account.
              </p>
            ) : enrolled ? (
              <p className="info">This Employee already has face enrollment.</p>
            ) : (
              <p>Capture the Employee’s face before saving the account.</p>
            )}
            {(!enrolled || descriptor) && (
              <CameraCapture onCapture={setDescriptor} />
            )}
          </section>
        </>
      )}
      <Field
        label={
          record
            ? "New password (leave blank to keep existing)"
            : "Initial password"
        }
        name="password"
        type="password"
        minLength="12"
        maxLength="128"
        autoComplete="new-password"
        required={!record}
      />
      <Field
        label="Account status"
        name="active"
        options={["Active", "Inactive"]}
        value={record?.active === false ? "Inactive" : "Active"}
        required
      />
      <PhotoUpload photos={photos} onChange={(p) => setPhotos(p.slice(-1))} />
    </Form>
  );
}

function ModalContent({ modal }) {
  const { s, user, act, setModal } = useApp();
  const close = () => setModal(null),
    r = modal.record;
  const [selected, setSelected] = useState(r?.projectId || r?.id || ""),
    [chosen, setChosen] = useState(r?.employeeIds || []),
    [checks, setChecks] = useState(r?.accessories || []),
    [photos, setPhotos] = useState(r?.photo ? [r.photo] : r?.photos || []),
    [bookingService, setBookingService] = useState(r?.service || services[0]);
  let content,
    title,
    subtitle,
    wide = false;
  if (modal.type === "projectDetail")
    return <ProjectDetail id={r.id} initialTab={modal.tab} />;
  if (modal.type === "estimate" || modal.type === "quotation")
    return <QuotationEditor record={r} isNew={modal.type === "estimate"} />;
  if (modal.type === "bookingNew")
    return (
      <Modal
        title="Book a Roofing Service"
        subtitle="Tell us about your roof. Your request is linked to your client account."
        onClose={close}
      >
        <BookingForm
          onDone={(result) =>
            setModal({ type: "bookingSuccess", record: result })
          }
        />
      </Modal>
    );
  if (modal.type === "bookingSuccess")
    return (
      <Modal title="Your roofing request is in!" onClose={close}>
        <div className="success-panel">
          <CheckCircle2 size={44} />
          <h3>Booking {r.id}</h3>
          <p>Submitted {stamp(r.submitted_at)}</p>
          <p>Save your private tracking link to follow the next steps.</p>
          <a className="btn" href={`/track/${r.token}`}>
            Track my booking <ArrowRight size={16} />
          </a>
          <p className="muted">
            View booking updates in your Notifications portal.
          </p>
        </div>
      </Modal>
    );
  if (modal.type === "booking") {
    title = "Review roofing booking";
    subtitle = `${r.id} · Submitted ${stamp(r.submitted_at)}`;
    content = (
      <>
        <div className="detail-banner">
          <Avatar name={r.name} />
          <div>
            <h3>{r.name}</h3>
            <p>
              {r.email} · {r.phone}
            </p>
          </div>
          <Badge>{r.status}</Badge>
          {r.releasedAt && <p>Released {stamp(r.releasedAt)}</p>}
        </div>
        {!r.clientId && (
          <Form
            onSubmit={(d) => act("bookingOwner", { ...d, id: r.id })}
            submit="Link legacy booking"
          >
            <Field
              label="Client account"
              name="clientId"
              options={s.users
                .filter((u) => u.role === "Client" && u.active !== false)
                .map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
              required
            />
          </Form>
        )}
        <Form
          onSubmit={(d) => act("booking", { ...d, id: r.id })}
          submit="Update booking"
        >
          <Field label="Full name" name="name" value={r.name} required />
          <Field label="Contact number" name="phone" value={r.phone} required />
          <Field
            label="Site address"
            name="address"
            value={r.address}
            required
          />
          <Field
            label="Status"
            name="status"
            value={r.status}
            options={[
              "Pending",
              "Approved",
              "Rejected",
              "Rescheduled",
              "For Inspection",
              "Completed",
              "Cancelled",
            ]}
          />
          <Field
            label="Preferred date"
            name="date"
            type="date"
            value={r.date}
            required
          />
          <Field
            label="Preferred time"
            name="time"
            type="time"
            value={r.time}
            required
          />
          <Field
            label="Inspection date"
            name="inspectionDate"
            type="date"
            value={r.date}
          />
          <Field
            label="Assign inspector / foreman"
            name="foremanId"
            value={
              s.inspections.find((i) => i.bookingId === r.id)?.foremanId || ""
            }
            options={s.users
              .filter((u) => u.role === "Foreman")
              .map((u) => ({ value: u.id, label: u.name }))}
          />
          <div className="info full">
            Select “For Inspection” to create an assigned site inspection.{" "}
            {r.service} · {r.type}
          </div>
          <Field
            label="Roofing concern"
            name="description"
            type="textarea"
            value={r.description}
          />
          <PhotoList photos={r.photos} />
        </Form>
        <a className="text-button" href={`/track/${r.token}`} target="_blank">
          Open client tracking <ExternalLink size={14} />
        </a>
      </>
    );
  }
  if (modal.type === "inspection") {
    title = "Site inspection";
    const b = s.bookings.find((b) => b.id === r.bookingId);
    subtitle = `${r.id} · ${b.name} · ${b.service}`;
    if (user.role === "Client")
      return (
        <Modal
          title="Site inspection"
          subtitle={`${r.id} · ${day(r.date)}`}
          onClose={close}
        >
          <Badge>{r.status}</Badge>
          <p>Roof profile: {r.profile || "Pending inspection"}</p>
          <p>Roof area: {r.area || 0} SQM</p>
          <p>Condition: {r.condition || "Pending inspection"}</p>
          <p>{r.notes || "No published inspection notes yet."}</p>
        </Modal>
      );
    const frozen = s.quotations.some((q) => q.inspectionId === r.id);
    content = (
      <>
        <div className="info">
          <MapPin size={17} />
          {b.address}
        </div>
        <Form
          onSubmit={(d) =>
            act("inspection", { ...d, id: r.id, accessories: checks, photos })
          }
          submit="Complete inspection"
          disabled={frozen}
        >
          <Field
            label="Results shared with the client"
            name="clientNotes"
            type="textarea"
            value={r.clientNotes}
            disabled={frozen}
          />
          <Field
            label="Inspection date"
            max={today()}
            name="date"
            type="date"
            value={r.date}
            required
            disabled={frozen}
          />
          <Field
            label="Roof area (SQM)"
            name="area"
            type="number"
            step="0.01"
            min="0.01"
            value={r.area}
            required
            disabled={frozen}
          />
          <Field
            label="Linear measurement (LM)"
            name="linear"
            type="number"
            step="0.01"
            min="0"
            value={r.linear}
            required
            disabled={frozen}
          />
          <Field
            label="Roof type / profile"
            name="profile"
            options={profiles}
            value={r.profile}
            required
            disabled={frozen}
          />
          <Field
            label="Roof complexity"
            name="complexity"
            options={["Simple", "Moderate", "Complex"]}
            value={r.complexity}
            disabled={frozen}
          />
          <Field
            label="Number of roof sections"
            name="sections"
            type="number"
            min="1"
            step="1"
            value={r.sections}
            required
            disabled={frozen}
          />
          <Field
            label={
              b.service === "Roof Installation"
                ? "Supporting structure condition"
                : "Existing roof condition"
            }
            name="condition"
            options={
              b.service === "Roof Installation"
                ? [
                    "New / No Existing Structure",
                    "Good",
                    "Fair",
                    "Needs Repair",
                    "Requires Further Assessment",
                  ]
                : [
                    "Good",
                    "Fair",
                    "Damaged",
                    "Severely Damaged",
                    "Requires Further Assessment",
                  ]
            }
            value={r.condition}
            required
            disabled={frozen}
          />
          <div className="full">
            <h4>Required accessories</h4>
            <div className="checkbox-grid">
              {accessories.map((a) => (
                <label key={a}>
                  <input
                    type="checkbox"
                    disabled={frozen}
                    checked={checks.includes(a)}
                    onChange={(e) =>
                      setChecks(
                        e.target.checked
                          ? [...checks, a]
                          : checks.filter((x) => x !== a),
                      )
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>
          <Field
            label="Site notes / roof sections"
            name="notes"
            type="textarea"
            value={r.notes}
            disabled={frozen}
          />
          <PhotoUpload photos={photos} onChange={setPhotos} disabled={frozen} />
          {frozen && (
            <div className="info full">
              This inspection is preserved because an estimate has been created.
            </div>
          )}
        </Form>
      </>
    );
  }
  if (modal.type === "material") {
    title = r ? "Edit material" : "Add material";
    subtitle = "Manage catalog prices · historical quotations remain unchanged";
    content = (
      <>
        <Form
          onSubmit={(d) =>
            act("material", { ...d, id: r?.id, active: d.active === "Active" })
          }
        >
          <Field label="Material name" name="name" value={r?.name} required />
          <Field
            label="Category"
            name="category"
            value={r?.category || "Roofing Sheet"}
            options={["Roofing Sheet", "Accessory"]}
            required
          />
          <Field
            label="Unit"
            name="unit"
            value={r?.unit || "SQM"}
            options={["SQM", "LM", "PCS", "TUBE", "SET"]}
            required
          />
          <Field
            label="Unit price (₱)"
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={r?.price}
            required
          />
          <Field
            label="Thickness"
            name="thickness"
            value={r?.thickness}
            placeholder="e.g. 0.40 mm"
          />
          <Field
            label="Roof profile"
            name="profile"
            options={profiles}
            value={r?.profile || "Other"}
          />
          <Field
            label="Status"
            name="active"
            options={["Active", "Disabled"]}
            value={r?.active === false ? "Disabled" : "Active"}
          />
        </Form>
        {r && (
          <div className="history">
            <h4>Material history</h4>
            {r.history.length ? (
              r.history.map((h, i) => (
                <p key={i}>
                  {stamp(h.at)} · {h.note} · {money(h.price)} →{" "}
                  {money(h.newPrice)}
                </p>
              ))
            ) : (
              <p>
                Catalog price: {money(r.price)} / {r.unit}
              </p>
            )}
          </div>
        )}
      </>
    );
  }
  if (modal.type === "user") {
    title = r ? "Edit account" : "Create account";
    content = <UserAccountForm record={r} />;
  }
  if (modal.type === "assignment") {
    title = "Manage roofing project";
    subtitle = r.name;
    content = (
      <Form
        onSubmit={(d) =>
          act("project", { ...d, id: r.id, employeeIds: chosen })
        }
      >
        <Field label="Project name" name="name" value={r.name} required />
        <Field
          label="Status"
          name="status"
          options={[
            "Pending",
            "Approved",
            "Scheduled",
            "Ongoing",
            "On Hold",
            "Cancelled",
          ]}
          value={r.status}
        />
        <Field label="Start date" name="start" type="date" value={r.start} />
        <Field
          label="Estimated completion"
          name="end"
          type="date"
          value={r.end}
        />
        <Field
          label="Assigned foreman"
          name="foremanId"
          options={s.users
            .filter((u) => u.role === "Foreman")
            .map((u) => ({ value: u.id, label: u.name }))}
          value={r.foremanId}
        />
        <div className="full">
          <h4>Assigned employees</h4>
          <div className="checkbox-grid">
            {s.users
              .filter((u) => u.role === "Employee")
              .map((u) => (
                <label key={u.id}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(u.id)}
                    onChange={(e) =>
                      setChosen(
                        e.target.checked
                          ? [...chosen, u.id]
                          : chosen.filter((x) => x !== u.id),
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
          </div>
        </div>
        <div className="info full">
          Attendance is recorded by the assigned Foreman for the selected
          project and current day. Avoid overlapping site assignments where
          possible.
        </div>
      </Form>
    );
  }
  if (modal.type === "task") {
    title = r ? "Edit project task" : "Add project task";
    const p = s.projects.find(
      (p) => p.id === (r?.projectId || modal.projectId),
    );
    content = (
      <Form
        onSubmit={(d) =>
          act("task", {
            ...d,
            id: r?.id,
            projectId: p.id,
            required: d.required === "Yes",
          })
        }
      >
        <Field
          label="Task name"
          name="name"
          value={r?.name}
          placeholder="e.g. Install roofing sheets"
          required
        />
        <Field
          label="Assigned personnel"
          name="assigneeId"
          options={s.users
            .filter((u) => [p.foremanId, ...p.employeeIds].includes(u.id))
            .map((u) => ({ value: u.id, label: u.name }))}
          value={r?.assigneeId}
          required
        />
        <Field
          label="Start date"
          name="start"
          type="date"
          value={r?.start || p.start || today()}
          required
        />
        <Field
          label="Due date"
          name="due"
          type="date"
          value={r?.due || p.end}
          required
        />
        <Field
          label="Completion (%)"
          name="progress"
          type="number"
          min="0"
          max="100"
          value={r?.progress || 0}
          required
        />
        <Field
          label="Required for completion"
          name="required"
          options={["Yes", "No"]}
          value={r?.required === false ? "No" : "Yes"}
        />
        <Field label="Notes" name="notes" type="textarea" value={r?.notes} />
      </Form>
    );
  }
  if (modal.type === "usage") {
    title = "Record material delivery & usage";
    const p = s.projects.find((p) => p.id === r.projectId),
      line = s.quotations
        .find((q) => q.id === p.quotationId)
        .items.find((x) => x.materialId === r.materialId);
    subtitle = `${line.name} · Planned ${line.quantity} ${line.unit}`;
    content = (
      <Form
        onSubmit={(d) =>
          act("usage", { ...d, id: r.id, projectId: r.projectId })
        }
      >
        <Field
          label={`Delivered (${line.unit})`}
          name="delivered"
          type="number"
          step="0.01"
          min="0"
          value={r.delivered}
          required
        />
        <Field
          label={`Used (${line.unit})`}
          name="used"
          type="number"
          step="0.01"
          min="0"
          value={r.used}
          required
        />
      </Form>
    );
  }
  if (modal.type === "payment") {
    title = "Record a payment";
    const p = s.projects.find((p) => p.id === selected),
      pay = p ? paymentStatus(s, p) : null,
      q = p ? s.quotations.find((q) => q.id === p.quotationId) : null;
    content = (
      <>
        <label className="field">
          <span>Project</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select project</option>
            {s.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id}
              </option>
            ))}
          </select>
        </label>
        {p && (
          <>
            <div className="payment-details">
              <div>
                <small>Client</small>
                <b>{p.client}</b>
              </div>
              <div>
                <small>Service</small>
                <b>{p.service}</b>
              </div>
              <div>
                <small>Quotation</small>
                <b>{q.id}</b>
              </div>
              <div>
                <small>Project total</small>
                <b>{money(pay.total)}</b>
              </div>
              <div>
                <small>Requested downpayment</small>
                <b>{money(q.downpayment)}</b>
              </div>
              <div>
                <small>Remaining balance</small>
                <b>{money(pay.balance)}</b>
              </div>
            </div>
            {pay.balance > 0 && !p.locked ? (
              <Form
                key={p.id}
                onSubmit={(d) => act("payment", { ...d, projectId: p.id })}
                submit="Record payment"
              >
                <Field
                  label="Amount paid (₱)"
                  name="amount"
                  type="number"
                  min="0.01"
                  max={pay.balance}
                  step="0.01"
                  required
                />
                <Field
                  label="Payment method"
                  name="method"
                  options={["Cash", "Bank Transfer", "GCash", "Check"]}
                  value="Bank Transfer"
                  required
                />
                <Field
                  label="Payment date"
                  max={today()}
                  name="date"
                  type="date"
                  value={today()}
                  required
                />
                <Field label="Reference number" name="reference" required />
                <Field label="Remarks" name="remarks" type="textarea" />
              </Form>
            ) : (
              <div className="info">
                <CheckCircle2 size={18} />
                This project is fully paid.
              </div>
            )}
            <h4>Payment history</h4>
            {s.payments
              .filter((x) => x.projectId === p.id)
              .map((x) => (
                <div className="line-row" key={x.id}>
                  <Name
                    name={`${money(x.amount)} · ${x.method}`}
                    sub={`${day(x.date)} · ${x.reference}`}
                  />
                  <CheckCircle2 size={16} />
                </div>
              ))}
          </>
        )}
      </>
    );
  }
  if (modal.type === "complete") {
    title = "Complete roofing project";
    subtitle = r.name;
    const tasks = s.tasks.filter((t) => t.projectId === r.id && t.required);
    content = (
      <Form
        onSubmit={(d) =>
          act("complete", { id: r.id, requirements: d.requirements === "on" })
        }
        submit="Complete project"
      >
        <div className="full completion-checks">
          <p>
            <CheckCircle2 size={18} />
            {r.foremanId && r.employeeIds.length
              ? "Personnel assigned"
              : "Personnel assignment required"}
          </p>
          <p>
            <ClipboardCheck size={18} />
            {tasks.filter((t) => t.progress === 100).length} of {tasks.length}{" "}
            required tasks completed
          </p>
          <p>
            <CreditCard size={18} />
            Remaining balance: {money(paymentStatus(s, r).balance)}
          </p>
          <label>
            <input name="requirements" type="checkbox" required /> I confirm the
            final inspection passed and all project requirements are satisfied.
          </label>
        </div>
        <div className="info full">
          Completion generates a feedback email. Once fully paid, this project
          is locked for historical reference.
        </div>
      </Form>
    );
  }
  if (modal.type === "payroll") {
    title = "Process payroll";
    content = (
      <Form onSubmit={(d) => act("payroll", d)} submit="Generate payslip">
        <Field
          label="Employee"
          name="userId"
          options={s.users
            .filter((u) => u.role === "Employee")
            .map((u) => ({
              value: u.id,
              label: `${u.name} · ${money(u.rate)}/day`,
            }))}
          required
        />
        <Field
          label="Deductions (₱)"
          name="deductions"
          type="number"
          min="0"
          step="0.01"
          value="0"
          required
        />
        <Field
          label="Period start"
          max={today()}
          name="from"
          type="date"
          value={today().slice(0, 8) + "01"}
          required
        />
        <Field
          label="Period end"
          max={today()}
          name="to"
          type="date"
          value={today()}
          required
        />
        <div className="info full">
          {s.settings[0].payrollNote} Overlapping payroll periods are prevented.
        </div>
      </Form>
    );
  }
  if (modal.type === "payslip") {
    title = "Employee payslip";
    const u = s.users.find((u) => u.id === r.userId);
    content = (
      <>
        <div className="payslip">
          <div className="payslip-brand">
            <img src="/favicon.svg" width="42" />
            <div>
              <h3>ENG ROOFING</h3>
              <small>SUPPLY & INSTALLATION SERVICES</small>
            </div>
          </div>
          <h2>{u.name}</h2>
          <p>
            {r.id} · {day(r.from)} – {day(r.to)}
          </p>
          {[
            ["Hours worked", r.workedHours ?? r.hours],
            ["Payable hours (maximum 8 per work date)", r.hours],
            ["Equivalent days", r.days],
            ["Daily rate", money(r.rate)],
            ["Gross pay", money(r.gross)],
            ["Deductions", money(r.deductions)],
          ].map(([k, v]) => (
            <div className="line-row" key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
          <div className="line-row net-pay">
            <strong>Net pay</strong>
            <strong>{money(r.net)}</strong>
          </div>
          <Badge>{r.status}</Badge>
          {r.releasedAt && <p>Released {stamp(r.releasedAt)}</p>}
        </div>
        <h3>Attendance included in this payslip</h3>
        <DataTable
          headers={[
            "Record",
            "Date",
            "Project",
            "Time In",
            "Time Out",
            "Hours worked",
          ]}
          rows={(r.attendanceIds || []).map((id) => {
            const a = s.attendance.find((item) => item.id === id);
            return [
              id,
              a ? day(a.date) : "Historical record",
              s.projects.find((p) => p.id === a?.projectId)?.name ||
                a?.projectId ||
                "—",
              a ? stamp(a.checkIn) : "—",
              a?.checkOut ? stamp(a.checkOut) : "—",
              a?.checkOut ? clockHours(a) : "—",
            ];
          })}
        />
        <div className="form-footer">
          <Button variant="secondary" onClick={() => window.print()}>
            <Download size={15} />
            Print payslip
          </Button>
          {user.role === "Admin" && r.status !== "Paid" && (
            <Button
              variant="secondary"
              onClick={() => setModal({ type: "payrollUpdate", record: r })}
            >
              Adjust deductions
            </Button>
          )}
          {user.role === "Admin" && r.status !== "Paid" && (
            <Button onClick={() => act("payrollPaid", { id: r.id })}>
              Mark paid
            </Button>
          )}
        </div>
      </>
    );
  }
  if (
    [
      "payrollUpdate",
      "paymentUpdate",
      "feedbackReview",
      "notification",
    ].includes(modal.type)
  ) {
    const config = {
      payrollUpdate: [
        "Adjust payroll deductions",
        <>
          <Field
            label="Deductions (₱)"
            name="deductions"
            type="number"
            min="0"
            max={r?.gross}
            step="0.01"
            value={r?.deductions}
            required
          />
          <Field
            label="Correction reason"
            name="reason"
            type="textarea"
            required
          />
        </>,
      ],
      paymentUpdate: [
        "Annotate payment",
        <Field
          label="Payment remarks"
          name="remarks"
          type="textarea"
          value={r?.remarks}
          required
        />,
      ],
      feedbackReview: [
        "Review client feedback",
        <Field
          label="Admin review notes"
          name="notes"
          type="textarea"
          value={r?.reviewNotes}
          required
        />,
      ],
      notification: [
        "Send notification",
        <>
          <Field
            label="Recipient"
            name="userId"
            options={s.users
              .filter((u) => u.active !== false)
              .map((u) => ({ value: u.id, label: `${u.name} · ${u.role}` }))}
            required
          />
          <Field label="Title" name="title" required />
          <Field label="Message" name="message" type="textarea" required />
        </>,
      ],
    }[modal.type];
    title = config[0];
    content = (
      <Form onSubmit={(d) => act(modal.type, { ...d, id: r?.id })}>
        {config[1]}
      </Form>
    );
  }
  if (modal.type === "enroll") {
    title = "Enroll employee face";
    subtitle = `${r.name} · Admin-supervised enrollment`;
    content = <CameraCapture enrollUser={r} />;
  }
  return (
    <Modal
      title={title || "Details"}
      subtitle={subtitle}
      onClose={close}
      wide={wide}
    >
      {content}
    </Modal>
  );
}
function PhotoList({ photos = [] }) {
  return photos.length ? (
    <div className="photos full">
      {photos.map((p, i) => (
        <img key={i} src={p} alt={`Roofing site photo ${i + 1}`} />
      ))}
    </div>
  ) : null;
}
function PhotoUpload({ photos, onChange, disabled }) {
  const [error, setError] = useState("");
  return (
    <div className="full">
      <label className="field">
        <span>Site photos (optional, up to 5)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={disabled}
          onChange={async (e) => {
            setError("");
            try {
              const files = [...e.target.files];
              if (files.length + photos.length > 5)
                throw new Error("Choose at most 5 photos.");
              if (
                files.some(
                  (f) =>
                    f.size > 1500000 ||
                    !["image/png", "image/jpeg", "image/webp"].includes(f.type),
                )
              )
                throw new Error(
                  "Use JPG, PNG, or WebP images under 1.5 MB each.",
                );
              const values = await Promise.all(
                files.map(
                  (f) =>
                    new Promise((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(reader.result);
                      reader.readAsDataURL(f);
                    }),
                ),
              );
              values.forEach((value) => photoValue(value));
              onChange([...photos, ...values]);
            } catch (e) {
              setError(e.message);
            }
          }}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <PhotoList photos={photos} />
      {photos.length > 0 && !disabled && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange([])}
        >
          Clear photos
        </button>
      )}
    </div>
  );
}
function BookingForm({ onDone }) {
  const { act, user, s } = useApp(),
    [photos, setPhotos] = useState([]),
    guest = !user || !user.role;
  return (
    <Form
      onSubmit={async (d) => onDone(await act("book", { ...d, photos }, true))}
      submit="Submit roofing booking"
    >
      {user?.role === "Admin" ? (
        <Field
          label="Client account"
          name="clientId"
          options={s.users
            .filter((u) => u.role === "Client" && u.active !== false)
            .map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
          required
        />
      ) : guest ? (
        <>
          <Field label="Full name" name="name" required />
          <Field label="Email" name="email" type="email" required />
        </>
      ) : (
        <div className="info full">
          Booking for {user.name} · {user.email}
        </div>
      )}
      <Field
        label="Contact number"
        name="phone"
        type="tel"
        placeholder="09123456789"
        required
      />
      <Field
        label="Site address"
        name="address"
        placeholder="Street, barangay, city"
        required
      />
      <Field
        label="Preferred date"
        name="date"
        type="date"
        min={today()}
        required
      />
      <Field label="Preferred time" name="time" type="time" required />
      <Field
        label="Service requested"
        name="service"
        options={services}
        required
      />
      <Field label="Project type" name="type" options={projectTypes} required />
      <Field
        label="Description / roofing concern"
        name="description"
        type="textarea"
        placeholder="Tell us about your roofing needs…"
        required
      />
      <PhotoUpload photos={photos} onChange={setPhotos} />
      <div className="info full">
        Your preferred schedule is subject to confirmation. We’ll create a
        reference number and a private tracking link.
      </div>
    </Form>
  );
}
function QuotationEditor({ record, isNew }) {
  const { s, user, act, setModal } = useApp(),
    [items, setItems] = useState(
      isNew ? [] : record.items.map((x) => ({ ...x })),
    ),
    [charges, setCharges] = useState(isNew ? 0 : record.charges),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showHistory, setShowHistory] = useState(false);
  const b = s.bookings.find((b) => b.id === record.bookingId),
    inspection = isNew
      ? record
      : s.inspections.find((i) => i.id === record.inspectionId),
    editable =
      isNew ||
      (user.role === "Admin" &&
        ["Initial Estimate", "Under Review"].includes(record.status)),
    total =
      items.reduce((a, x) => a + Number(x.quantity || 0) * x.price, 0) +
      Number(charges || 0);
  const [downpayment, setDownpayment] = useState(
    isNew ? 0 : record.downpayment,
  );
  return (
    <Modal
      wide
      title={isNew ? "Prepare initial estimate" : "Roofing quotation"}
      subtitle={`${isNew ? inspection.id : record.id} · ${b.name} · ${b.service}`}
      onClose={() => setModal(null)}
    >
      <div className="inspection-summary">
        <span>
          <b>{inspection.area}</b> SQM roof area
        </span>
        <span>
          <b>{inspection.linear}</b> LM
        </span>
        <span>{inspection.profile}</span>
        <span>
          {inspection.complexity} · {inspection.sections} sections
        </span>
      </div>
      <div className="info">
        {isNew
          ? "Foreman’s initial estimate. Admin will review and finalize it before the client receives a quotation."
          : `Status: ${record.status}. Unit prices are preserved from the material catalog when selected.`}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            checkForm(e.currentTarget);
            const form = new FormData(e.currentTarget);
            await act(isNew ? "estimate" : "finalize", {
              ...(isNew
                ? { inspectionId: record.id }
                : { id: record.id, downpayment }),
              items: items.map(({ materialId, quantity }) => ({
                materialId,
                quantity,
              })),
              charges,
              notes: form.get("notes"),
            });
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="quote-lines">
          <div className="quote-header">
            <span>Material / accessory</span>
            <span>Quantity</span>
            <span>Unit price</span>
            <span>Subtotal</span>
            <span />
          </div>
          {items.map((x, i) => (
            <div className="quote-line" key={i}>
              <div>
                <strong>{x.name}</strong>
                <small>{x.unit}</small>
              </div>
              <input
                max="1000000"
                onInput={(e) => checkField(e.currentTarget)}
                aria-label={`Quantity for ${x.name}`}
                type="number"
                min="0.01"
                step="0.01"
                value={x.quantity}
                disabled={!editable}
                onChange={(e) =>
                  setItems(
                    items.map((line, j) =>
                      j === i ? { ...line, quantity: e.target.value } : line,
                    ),
                  )
                }
                required
              />
              <span>{money(x.price)}</span>
              <b>{money(x.quantity * x.price)}</b>
              {editable && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${x.name}`}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {editable && (
          <select
            className="add-material"
            value=""
            onChange={(e) => {
              const m = s.materials.find((m) => m.id === e.target.value);
              if (m)
                setItems([
                  ...items,
                  {
                    materialId: m.id,
                    name: m.name,
                    unit: m.unit,
                    price: m.price,
                    quantity: 1,
                  },
                ]);
            }}
          >
            <option value="">+ Add material or accessory from catalog</option>
            {s.materials
              .filter(
                (m) => m.active && !items.some((x) => x.materialId === m.id),
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {money(m.price)} / {m.unit}
                </option>
              ))}
          </select>
        )}
        <div className="quote-totals">
          <div>
            <span>Material subtotal</span>
            <b>{money(total - Number(charges))}</b>
          </div>
          <div>
            <span>Additional charges (₱)</span>
            <input
              max="1000000000"
              onInput={(e) => checkField(e.currentTarget)}
              aria-label="Additional charges"
              type="number"
              min="0"
              step="0.01"
              disabled={!editable}
              value={charges}
              onChange={(e) => setCharges(e.target.value)}
            />
          </div>
          <div className="quote-grand">
            <span>Total quotation</span>
            <strong>{money(total)}</strong>
          </div>
          {!isNew && (
            <div>
              <span>Requested downpayment (₱)</span>
              <input
                onInput={(e) => checkField(e.currentTarget)}
                aria-label="Requested downpayment"
                type="number"
                min="0"
                max={total}
                step="0.01"
                value={downpayment}
                disabled={!editable}
                onChange={(e) => setDownpayment(e.target.value)}
              />
            </div>
          )}
        </div>
        <Field
          label="Additional charges breakdown / notes"
          name="notes"
          type="textarea"
          value={isNew ? "" : record.notes}
          disabled={!editable}
        />
        {error && <div className="error">{error}</div>}
        {editable && (
          <div className="form-footer">
            <Button disabled={busy || !items.length} type="submit">
              <Send size={15} />
              {busy
                ? "Saving…"
                : isNew
                  ? "Submit estimate for review"
                  : "Finalize & send to client"}
            </Button>
          </div>
        )}
      </form>
      {isNew && (
        <div className="history">
          <button
            className="text-button"
            onClick={() => setShowHistory(!showHistory)}
          >
            Previous project materials · reference only{" "}
            <ChevronDown size={14} />
          </button>
          {showHistory &&
            s.quotations
              .filter((q) => q.status === "Approved")
              .slice(0, 3)
              .map((q) => (
                <div className="history-reference" key={q.id}>
                  <strong>
                    {s.bookings.find((b) => b.id === q.bookingId)?.name} ·{" "}
                    {q.id}
                  </strong>
                  <p>
                    {q.items
                      .map(
                        (x) =>
                          `${x.name} — ${x.quantity} ${x.unit} at ${money(x.price)}`,
                      )
                      .join("; ")}
                  </p>
                </div>
              ))}
        </div>
      )}
      {user.role === "Client" && (
        <a className="btn" href={`/track/${b.token}`}>
          Open quotation approval <ArrowRight size={16} />
        </a>
      )}
    </Modal>
  );
}
function ProjectDetail({ id, initialTab = "Overview" }) {
  const { s, user, setModal, act } = useApp(),
    [tab, setTab] = useState(initialTab);
  const p = s.projects.find((p) => p.id === id);
  if (!p)
    return (
      <Modal title="Project unavailable" onClose={() => setModal(null)}>
        <Empty
          title="Project access changed"
          text="This project is no longer in your assigned workspace."
        />
      </Modal>
    );
  const q = s.quotations.find((q) => q.id === p.quotationId) || {
      id: p.quotationId,
      items: [],
      total: 0,
    },
    pay = paymentStatus(s, p),
    tasks = s.tasks.filter((t) => t.projectId === id),
    b = s.bookings.find((b) => b.id === p.bookingId),
    foreman = s.users.find((u) => u.id === p.foremanId),
    canManage = ["Admin", "Foreman"].includes(user.role) && !p.locked;
  return (
    <Modal
      wide
      title={p.name}
      subtitle={`${p.id} · ${p.service} · ${p.type}`}
      onClose={() => setModal(null)}
    >
      <div className="project-detail-top">
        <Badge>{p.status}</Badge>
        <span>
          <MapPin size={14} />
          {p.address}
        </span>
        {p.locked && (
          <span className="locked">
            <Lock size={14} />
            Record locked
          </span>
        )}
      </div>
      <div className="project-progress">
        <div>
          <strong>Overall progress</strong>
          <b>{p.progress}%</b>
        </div>
        <div className="progress-track">
          <i style={{ width: `${p.progress}%` }} />
        </div>
      </div>
      <div className="tabs">
        {[
          "Overview",
          "Tasks",
          ...(["Admin", "Client", "Foreman"].includes(user.role)
            ? ["Materials"]
            : []),
          ...(["Admin", "Client"].includes(user.role) ? ["Payments"] : []),
          ...(["Admin", "Foreman", "Employee"].includes(user.role)
            ? ["Attendance"]
            : []),
          "Timeline",
        ].map((t) => (
          <button
            key={t}
            className={t === tab ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Tasks" && <span>{tasks.length}</span>}
          </button>
        ))}
      </div>
      {tab === "Attendance" && user.role !== "Client" && (
        <Attendance projectId={p.id} />
      )}
      {tab === "Overview" && (
        <>
          <div className="detail-grid">
            <div>
              <small>Client</small>
              <b>{p.client}</b>
            </div>
            {["Admin", "Client", "Foreman"].includes(user.role) && (
              <div>
                <small>Approved quotation</small>
                <button
                  className="text-button"
                  onClick={() => setModal({ type: "quotation", record: q })}
                >
                  {q.id}
                  <ArrowUpRight size={13} />
                </button>
              </div>
            )}
            <div>
              <small>Start date</small>
              <b>{day(p.start)}</b>
            </div>
            <div>
              <small>Estimated completion</small>
              <b>{day(p.end)}</b>
            </div>
            {["Admin", "Client"].includes(user.role) && (
              <>
                <div>
                  <small>Project value</small>
                  <b>{money(q.total)}</b>
                </div>
                <div>
                  <small>Payment status</small>
                  <Badge>{pay.status}</Badge>
                </div>
              </>
            )}
          </div>
          <div className="info">
            Completion date is an estimate and may change due to weather, site
            conditions, materials, or additional work.
          </div>
          {canManage && p.status !== "Completed" && (
            <Form
              onSubmit={(d) => act("progress", { ...d, projectId: p.id }, true)}
              submit="Save site update"
            >
              <Field
                label="Overall progress (%)"
                name="progress"
                type="number"
                min="0"
                max="100"
                value={p.progress}
                required
              />
              <Field
                label="Site update shared with client"
                name="notes"
                type="textarea"
                required
              />
            </Form>
          )}
          <h4>Assigned personnel</h4>
          <div className="personnel-list">
            {foreman ? (
              <div className="person-cell">
                <Avatar name={foreman.name} photo={foreman.photo} />
                <Name name={foreman.name} sub="Foreman" />
                <a
                  className="text-button"
                  href={`/verify/${foreman.id}`}
                  target="_blank"
                >
                  Verify <ShieldCheck size={14} />
                </a>
              </div>
            ) : (
              <p className="muted">No foreman assigned</p>
            )}
            {p.employeeIds.map((id) => {
              const u = s.users.find((u) => u.id === id);
              if (!u) return null;
              return (
                <div className="person-cell" key={id}>
                  <Avatar name={u.name} />
                  <Name name={u.name} sub="Employee" />
                </div>
              );
            })}
          </div>
          <div className="form-footer">
            {["Admin", "Client"].includes(user.role) && b?.token && (
              <a
                className="text-button"
                href={`/track/${b.token}`}
                target="_blank"
              >
                Client tracking page <ExternalLink size={14} />
              </a>
            )}
            {user.role === "Admin" && !p.locked && p.status !== "Completed" && (
              <Button
                variant="secondary"
                onClick={() => setModal({ type: "assignment", record: p })}
              >
                Manage project
              </Button>
            )}
            {canManage && p.status !== "Completed" && (
              <Button onClick={() => setModal({ type: "complete", record: p })}>
                <CheckCircle2 size={15} />
                Complete project
              </Button>
            )}
          </div>
        </>
      )}
      {tab === "Tasks" && (
        <>
          <DataTable
            headers={["Task", "Assigned to", "Due date", "Progress", ""]}
            rows={tasks.map((t) => [
              <Name name={t.name} sub={t.required ? "Required" : "Optional"} />,
              s.users.find((u) => u.id === t.assigneeId)?.name,
              day(t.due),
              <Badge>
                {t.progress === 100
                  ? "Completed"
                  : t.progress > 0
                    ? "Ongoing"
                    : "Pending"}
              </Badge>,
              <div className="row-actions">
                <span>{t.progress}%</span>
                {canManage && (
                  <Button
                    variant="small secondary"
                    onClick={() => setModal({ type: "task", record: t })}
                  >
                    Update
                  </Button>
                )}
              </div>,
            ])}
          />
          {canManage && (
            <div className="form-footer">
              <Button
                onClick={() => setModal({ type: "task", projectId: p.id })}
              >
                <Plus size={15} />
                Add task
              </Button>
            </div>
          )}
        </>
      )}
      {tab === "Materials" &&
        (user.role === "Client" ? (
          <DataTable
            headers={["Material", "Quantity", "Unit", "Unit price", "Subtotal"]}
            rows={q.items.map((i) => [
              i.name,
              i.quantity,
              i.unit,
              money(i.price),
              money(i.quantity * i.price),
            ])}
          />
        ) : (
          <DataTable
            headers={[
              "Material",
              "Planned",
              "Delivered",
              "Used",
              "Remaining planned",
              "",
            ]}
            rows={s.usage
              .filter((u) => u.projectId === p.id)
              .map((u) => {
                const line = q.items.find((x) => x.materialId === u.materialId);
                return [
                  <Name
                    name={line.name}
                    sub={`${money(line.price)} / ${line.unit}`}
                  />,
                  `${line.quantity} ${line.unit}`,
                  u.delivered,
                  u.used,
                  `${line.quantity - u.used} ${line.unit}`,
                  canManage && (
                    <Button
                      variant="small secondary"
                      onClick={() => setModal({ type: "usage", record: u })}
                    >
                      Update
                    </Button>
                  ),
                ];
              })}
          />
        ))}
      {tab === "Payments" && (
        <>
          <div className="summary-strip">
            <div>
              <small>Total</small>
              <strong>{money(pay.total)}</strong>
            </div>
            <div>
              <small>Paid</small>
              <strong>{money(pay.paid)}</strong>
            </div>
            <div>
              <small>Remaining</small>
              <strong>{money(pay.balance)}</strong>
            </div>
          </div>
          <DataTable
            headers={["Date", "Amount", "Method", "Reference", "Remarks", ""]}
            rows={s.payments
              .filter((x) => x.projectId === p.id)
              .map((x) => [
                day(x.date),
                money(x.amount),
                x.method,
                x.reference,
                x.remarks || "—",
                user.role === "Admin" ? (
                  <Button
                    variant="small secondary"
                    onClick={() =>
                      setModal({ type: "paymentUpdate", record: x })
                    }
                  >
                    Annotate
                  </Button>
                ) : (
                  ""
                ),
              ])}
          />
          {user.role === "Admin" && !p.locked && pay.balance > 0 && (
            <div className="form-footer">
              <Button onClick={() => setModal({ type: "payment", record: p })}>
                Record payment
              </Button>
            </div>
          )}
        </>
      )}
      {tab === "Timeline" && (
        <div className="timeline">
          {p.timeline.map((e, i) => (
            <div key={i}>
              <i />
              <strong>{e.text}</strong>
              <small>{stamp(e.at)}</small>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
function clockHours(record) {
  try {
    return roundedHours(elapsedHours(record));
  } catch {
    return "Needs review";
  }
}
function Attendance({ projectId }) {
  const { s, user } = useApp();
  const [selection, setSelection] = useState(projectId || "");
  const [capture, setCapture] = useState(null);
  const [notice, setNotice] = useState("");
  const foreman = user.role === "Foreman";
  const projects = s.projects.filter(
    (p) => !foreman || p.foremanId === user.id,
  );
  // Keep an Employee's own history reachable after reassignment without
  // exposing details of projects they can no longer open.
  if (user.role === "Employee")
    for (const a of s.attendance)
      if (!projects.some((p) => p.id === a.projectId))
        projects.push({
          id: a.projectId,
          name: `Past project ${a.projectId}`,
          client: "",
          employeeIds: [],
        });
  const selected = projectId || selection || projects[0]?.id;
  const p = projects.find((project) => project.id === selected);
  const entries = s.attendance.filter((a) => a.projectId === p?.id);
  const employees = s.users.filter(
    (u) => u.role === "Employee" && p?.employeeIds.includes(u.id),
  );
  const today = workDate();
  const canTimeIn =
    p &&
    !p.locked &&
    p.status === "Ongoing" &&
    p.start <= today &&
    p.end >= today;
  return (
    <>
      <div className="attendance-banner">
        <span className="attendance-large">
          <ScanFace size={35} />
        </span>
        <div>
          <h3>
            {foreman ? "Project attendance" : "Verified attendance history"}
          </h3>
          <p>
            {foreman
              ? "Select the Employee, then let them verify their face for Time In or Time Out."
              : "Time In and Time Out are recorded through the assigned Foreman's project portal. Hours cannot be entered manually."}
          </p>
        </div>
      </div>
      {!projectId && (
        <Field
          label={foreman ? "Assigned project" : "Project"}
          name="attendanceProject"
          options={projects.map((p) => ({
            value: p.id,
            label: `${p.name} · ${p.client || p.id}`,
          }))}
          value={p?.id || ""}
          onChange={(e) => {
            setSelection(e.target.value);
            setCapture(null);
            setNotice("");
          }}
        />
      )}
      {!p ? (
        <Empty
          title="No assigned project"
          text="Project attendance becomes available after Admin assigns a Foreman and Employees."
        />
      ) : (
        <>
          <h3>
            PROJECT: {p.name} · {p.client}
          </h3>
          <div className="info">
            Hours worked are calculated from Time In and Time Out. Payroll
            retains the maximum of eight payable hours per work date across
            projects; no automatic break deduction is applied.
          </div>
          {notice && (
            <p className="info" role="status">
              {notice}
            </p>
          )}
          {foreman && (
            <section className="card">
              <CardHead
                title="Today's assigned Employees"
                subtitle="Completed sessions cannot be repeated. Open sessions from a prior date remain available for Time Out."
              />
              <DataTable
                headers={[
                  "Employee",
                  "Status",
                  "Time In",
                  "Time Out",
                  "Hours worked",
                  "Facial recognition",
                ]}
                rows={employees.map((employee) => {
                  const a =
                    entries.find(
                      (a) => a.userId === employee.id && !a.checkOut,
                    ) ||
                    entries.find(
                      (a) => a.userId === employee.id && a.date === today,
                    );
                  const operation = a?.checkIn ? "timeOut" : "timeIn";
                  const disabled =
                    !!a?.checkOut ||
                    !employee.enrolled ||
                    employee.active === false ||
                    (!a && !canTimeIn);
                  return [
                    employee.name,
                    attendanceStatus(a),
                    a ? stamp(a.checkIn) : "—",
                    a?.checkOut ? stamp(a.checkOut) : "—",
                    a?.checkOut ? clockHours(a) : "—",
                    <div>
                      <Button
                        variant="small secondary"
                        disabled={disabled || !!capture}
                        onClick={() => {
                          setNotice("");
                          setCapture({
                            projectId: p.id,
                            userId: employee.id,
                            operation,
                            ...(a ? { attendanceId: a.id } : {}),
                          });
                        }}
                      >
                        {operation === "timeIn" ? "Time In" : "Time Out"} ·{" "}
                        {employee.name}
                      </Button>
                      {!employee.enrolled && (
                        <small>Ask Admin to enroll this Employee's face.</small>
                      )}
                    </div>,
                  ];
                })}
              />
              {!canTimeIn && (
                <p className="info">
                  New Time In requires an ongoing project scheduled for today.
                  Existing sessions can still Time Out.
                </p>
              )}
            </section>
          )}
          {foreman && capture && capture.projectId === p.id && (
            <section className="card padded">
              <h3>
                {capture.operation === "timeIn" ? "Time In" : "Time Out"}:{" "}
                {employees.find((u) => u.id === capture.userId)?.name}
              </h3>
              <p>
                Project: {p.name}. The selected Employee must face the camera.
              </p>
              <CameraCapture
                key={`${capture.userId}-${capture.operation}`}
                attendance={capture}
                onDone={() => {
                  setNotice(
                    `${capture.operation === "timeIn" ? "Time In" : "Time Out"} recorded successfully for this project.`,
                  );
                  setCapture(null);
                }}
              />
              <Button variant="secondary" onClick={() => setCapture(null)}>
                Cancel capture
              </Button>
            </section>
          )}
          <section className="card">
            <CardHead
              title="Attendance history"
              subtitle="Verified clock records for the selected project"
            />
            <DataTable
              headers={[
                "Employee",
                "Work date",
                "Status",
                "Time In",
                "Time Out",
                "Hours worked",
                "Foreman",
                "Verification",
                "Geotag",
              ]}
              rows={[...entries]
                .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
                .map((a) => [
                  s.users.find((u) => u.id === a.userId)?.name || a.userId,
                  day(a.date),
                  attendanceStatus(a),
                  stamp(a.checkIn),
                  a.checkOut ? stamp(a.checkOut) : "Working",
                  a.checkOut ? clockHours(a) : "—",
                  s.users.find((u) => u.id === a.foremanId)?.name ||
                    a.foremanId ||
                    "Not recorded",
                  <Name
                    name={a.verified ? "Verified" : "Unverified"}
                    sub={a.source}
                  />,
                  Number.isFinite(a.latitude) &&
                  Number.isFinite(a.longitude) ? (
                    <a
                      className="text-button"
                      href={`https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                    </a>
                  ) : (
                    "Not recorded"
                  ),
                ])}
            />
          </section>
        </>
      )}
    </>
  );
}
function CameraCapture({ enrollUser, onCapture, attendance, onDone }) {
  const { user, act, setModal } = useApp(),
    video = useRef(),
    stream = useRef(),
    active = useRef(true),
    api = useRef(),
    [status, setStatus] = useState(
      enrollUser || onCapture
        ? "Camera permission is required for enrollment."
        : "Camera and location permission are required.",
    ),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      setStatus("Loading facial verification models…");
      const face = await import("@vladmandic/face-api");
      api.current = face;
      // CPU works without a GPU or separately hosted WASM binaries.
      await face.tf.setBackend("cpu");
      await face.tf.ready();
      await Promise.all([
        face.nets.tinyFaceDetector.loadFromUri("/models"),
        face.nets.faceLandmark68Net.loadFromUri("/models"),
        face.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      if (!active.current) return;
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (!active.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      video.current.srcObject = stream.current;
      await video.current.play();
      setReady(true);
      setStatus("Center one face in the camera, in good lighting.");
    } catch (e) {
      setError(
        `Camera setup failed: ${e.message}. Use a secure browser connection and allow camera access.`,
      );
    } finally {
      setBusy(false);
    }
  };
  const capture = async () => {
    setBusy(true);
    setError("");
    try {
      const face = api.current;
      const detections = await face
        .detectAllFaces(
          video.current,
          new face.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.6,
          }),
        )
        .withFaceLandmarks()
        .withFaceDescriptors();
      if (detections.length !== 1)
        throw new Error("Exactly one clearly visible face is required.");
      const descriptor = Array.from(detections[0].descriptor);
      if (onCapture) {
        await onCapture(descriptor);
        stream.current?.getTracks().forEach((t) => t.stop());
        setReady(false);
        setStatus("Face captured. Save the account to store enrollment.");
      } else if (enrollUser)
        await act("enroll", { userId: enrollUser.id, descriptor });
      else {
        setStatus("Recording your location…");
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }),
        );
        if (!attendance)
          throw new Error("Select an assigned project and Employee first.");
        await act(
          "attendance",
          {
            ...attendance,
            descriptor,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
          true,
        );
        onDone?.();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="camera-capture">
      <video ref={video} autoPlay muted playsInline />
      <p>{status}</p>
      {error && <div className="error">{error}</div>}
      <div className="info">
        {enrollUser || onCapture
          ? "Admin-supervised enrollment saves a 128-value face descriptor for this employee."
          : "The selected Employee’s face is compared on the server with their enrolled descriptor, and project assignments are checked again. No camera image is saved."}{" "}
        Face verification does not perform liveness detection.
      </div>
      <Button type="button" disabled={busy} onClick={ready ? capture : start}>
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Camera size={16} />
        )}{" "}
        {busy
          ? "Please wait…"
          : ready
            ? enrollUser || onCapture
              ? "Save face enrollment"
              : attendance?.operation === "timeOut"
                ? "Verify face & Time Out"
                : "Verify face & Time In"
            : "Enable camera"}
      </Button>
    </div>
  );
}
function PublicHeader() {
  return (
    <header className="public-header">
      <a className="brand" href="/home">
        <img src="/favicon.svg" />
        <div>
          ENG ROOFING<small>SUPPLY & INSTALLATION</small>
        </div>
      </a>
      <nav>
        <a href="/home#services">Our services</a>
        <a href="/home#process">How it works</a>
        <a href="/track">Track my project</a>
        <a href="/" className="public-login">
          Sign in <ArrowUpRight size={15} />
        </a>
      </nav>
    </header>
  );
}
function PublicPage({ initial }) {
  const { setModal } = useApp(),
    [reference, setReference] = useState(""),
    [success, setSuccess] = useState(null);
  return (
    <div className="public-page">
      <PublicHeader />
      {initial === "/book" ? (
        <div className="public-form card">
          <div className="eyebrow">LET’S BUILD SOMETHING LASTING</div>
          <h1>Book a Roofing Service</h1>
          <p>Sign in to your client account. A better roof starts here.</p>
          {success ? (
            <div className="success-panel">
              <CheckCircle2 size={44} />
              <h3>Your booking is confirmed</h3>
              <b>{success.id}</b>
              <p>Submitted {stamp(success.submitted_at)}</p>
              <a className="btn" href={`/track/${success.token}`}>
                Track my booking <ArrowRight size={16} />
              </a>
              <p>
                Your confirmation email is available in the local preview inbox.
              </p>
            </div>
          ) : (
            <BookingForm onDone={setSuccess} />
          )}
        </div>
      ) : initial === "/track" ? (
        <div className="public-form card track-form">
          <MapPin size={35} />
          <h1>Track your roofing project</h1>
          <p>
            Paste the private tracking link or token from your booking
            confirmation. A reference number alone does not grant access.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const token = reference
                .trim()
                .split("/track/")
                .at(-1)
                .split("?")[0];
              try {
                checkForm(e.currentTarget);
                identifier(token, "Tracking token", 128);
                location.href = `/track/${encodeURIComponent(token)}`;
              } catch (error) {
                const field = e.currentTarget.elements.token;
                field.setCustomValidity(error.message);
                field.reportValidity();
              }
            }}
          >
            <Field
              label="Private tracking link or token"
              required
              name="token"
              onChange={(e) => setReference(e.target.value)}
            />
            <Button type="submit">
              Track my project <ArrowRight size={16} />
            </Button>
          </form>
          <a href="/book">Need a roofing service? Book a site visit</a>
        </div>
      ) : (
        <>
          <section className="public-hero">
            <div>
              <span className="eyebrow">
                ENG ROOFING SUPPLY & INSTALLATION SERVICES
              </span>
              <h1>
                A better roof.
                <br />
                Built on trust.
              </h1>
              <p>
                Professional roofing solutions for homes and businesses.
                <br />
                From the first site visit to the final detail, we’ve got you
                covered.
              </p>
              <div className="hero-actions">
                <a className="btn" href="/book">
                  Book a Roofing Service <ArrowUpRight size={17} />
                </a>
                <a className="btn secondary" href="/track">
                  Track My Project <ArrowRight size={16} />
                </a>
              </div>
              <div className="hero-trust">
                <ShieldCheck size={19} />
                Experienced team <span>·</span> Quality workmanship{" "}
                <span>·</span> Clear communication
              </div>
            </div>
            <div className="public-roof">
              <RoofIllustration />
            </div>
          </section>
          <section className="public-section" id="services">
            <div className="eyebrow">THE RIGHT SOLUTION FOR YOUR ROOF</div>
            <h2>Roofing is what we do.</h2>
            <div className="service-cards">
              {[
                [
                  "Roof Installation",
                  "A strong start for your property. Complete roofing systems, fitted with care.",
                  House,
                ],
                [
                  "Roof Replacement",
                  "Give your property a fresh layer of protection with a professionally replaced roof.",
                  Layers,
                ],
                [
                  "Roof Repair",
                  "From leaks to damaged panels, get the repairs your roof needs.",
                  HardHat,
                ],
              ].map(([title, desc, Icon], i) => (
                <article className="card" key={title}>
                  <span className="service-number">0{i + 1}</span>
                  <Icon size={30} />
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  <a href="/book">
                    Book a site visit <ArrowUpRight size={16} />
                  </a>
                </article>
              ))}
            </div>
          </section>
          <section className="public-section process-section" id="process">
            <div className="eyebrow">SIMPLE, FROM START TO FINISH</div>
            <h2>Your roof. A clear plan.</h2>
            <div className="process-steps">
              {[
                "Booking",
                "Site Inspection",
                "Quotation",
                "Project Execution",
                "Completion",
              ].map((step, i) => (
                <div key={step}>
                  <b>0{i + 1}</b>
                  <h3>{step}</h3>
                  <p>
                    {
                      [
                        "Tell us what you need.",
                        "We assess your actual site.",
                        "Review and approve your quote.",
                        "Follow the work as it happens.",
                        "Enjoy your roof. Share your experience.",
                      ][i]
                    }
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className="public-cta">
            <h2>Let’s put a solid roof over your plans.</h2>
            <a className="btn" href="/book">
              Book a Roofing Service <ArrowUpRight size={17} />
            </a>
          </section>
        </>
      )}
      <footer className="public-footer">
        <span>
          © {new Date().getFullYear()} ENG Roofing Supply & Installation
          Services
        </span>
        <span>
          Integrated Payroll System and Roofing Project Management System with
          Client Feedback Analysis
        </span>
      </footer>
    </div>
  );
}
function Tracking({ token }) {
  const { act, user } = useApp(),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const res = await fetch(`/api/track/${encodeURIComponent(token)}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    setData(d);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [token]);
  const change = async (action, d) => {
    setBusy(true);
    setActionError("");
    try {
      await act(action, { ...d, token }, true);
      await load();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const b = data?.booking,
    p = data?.project,
    q = data?.quotation;
  return (
    <div className="public-page">
      <PublicHeader />
      <div className="tracking-container">
        {error ? (
          <Empty
            title="Tracking link not found"
            text={error}
            action={
              <a className="btn" href="/track">
                Try another link
              </a>
            }
          />
        ) : !data ? (
          <p>Loading your roofing project…</p>
        ) : (
          <>
            <PageHeading
              eyebrow="YOUR ROOFING JOURNEY"
              title={`Hello, ${b.name.split(" ")[0]}.`}
              description="Every step of your roofing project, in one place."
            >
              <Badge>{p?.status || b.status}</Badge>
            </PageHeading>
            <div className="tracking-hero">
              <div>
                <span>{p?.id || b.id}</span>
                <h2>{p?.name || b.service}</h2>
                <p>
                  <MapPin size={16} />
                  {b.address}
                </p>
                <div className="project-progress">
                  <div>
                    <strong>
                      {p ? "Overall progress" : "Booking received"}
                    </strong>
                    <b>{p?.progress || 0}%</b>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${p?.progress || 0}%` }} />
                  </div>
                </div>
              </div>
              <div className="tracking-dates">
                <small>
                  {p ? "Estimated completion" : "Preferred inspection date"}
                </small>
                <strong>{day(p?.end || b.date)}</strong>
                <p>
                  {p
                    ? "Subject to weather, site conditions, and material availability."
                    : `${b.time} · subject to confirmation`}
                </p>
                <small>Submitted {stamp(b.submitted_at)}</small>
              </div>
            </div>
            <div className="tracking-grid">
              <section className="card padded">
                <h3>Your project timeline</h3>
                <div className="timeline">
                  <div>
                    <i />
                    <strong>Booking submitted</strong>
                    <small>
                      {stamp(b.submitted_at)} · {b.id}
                    </small>
                  </div>
                  <div>
                    <i />
                    <strong>Booking {b.status.toLowerCase()}</strong>
                    <small>
                      {b.service} · {b.type}
                    </small>
                  </div>
                  {p?.timeline.map((e, i) => (
                    <div key={i}>
                      <i />
                      <strong>{e.text}</strong>
                      <small>{stamp(e.at)}</small>
                    </div>
                  ))}
                </div>
                {data.foreman && (
                  <>
                    <h4>Your assigned foreman</h4>
                    <ForemanCard foreman={data.foreman} />
                  </>
                )}
              </section>
              <section className="card padded">
                <h3>Your quotation & payments</h3>
                {q ? (
                  <>
                    <Badge>{q.status}</Badge>
                    <DataTable
                      headers={["Material", "Qty", "Price", "Subtotal"]}
                      rows={q.items.map((x) => [
                        x.name,
                        `${x.quantity} ${x.unit}`,
                        money(x.price),
                        money(x.quantity * x.price),
                      ])}
                    />
                    <div className="line-row">
                      <span>Additional charges</span>
                      <b>{money(q.charges)}</b>
                    </div>
                    <div className="line-row">
                      <strong>Total quotation</strong>
                      <strong>{money(q.total)}</strong>
                    </div>
                    <div className="line-row">
                      <span>Requested downpayment</span>
                      <b>{money(q.downpayment)}</b>
                    </div>
                    <div className="line-row">
                      <span>Remaining balance</span>
                      <b>{money(data.balance ?? q.total)}</b>
                    </div>
                    <p className="muted">{q.notes}</p>
                    {user?.role === "Client" &&
                      q.status === "Awaiting Client" && (
                        <div className="form-footer">
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              change("quoteDecision", {
                                id: q.id,
                                status: "Rejected",
                              })
                            }
                          >
                            Reject quotation
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              change("quoteDecision", {
                                id: q.id,
                                status: "Approved",
                              })
                            }
                          >
                            Approve quotation <Check size={16} />
                          </Button>
                        </div>
                      )}
                    {data.payments.length > 0 && (
                      <>
                        <h4>Payments received</h4>
                        {data.payments.map((x) => (
                          <div className="line-row" key={x.id}>
                            <Name
                              name={`${money(x.amount)} · ${x.method}`}
                              sub={`${day(x.date)} · ${x.reference}`}
                            />
                            <CheckCircle2 size={15} />
                          </div>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <Empty
                    title="Your quotation is on its way"
                    text="After the site inspection, our team will prepare and review your quotation."
                  />
                )}
              </section>
            </div>
            {user?.role === "Client" && p?.status === "Completed" && (
              <section className="card padded feedback-form">
                <h2>How did we do?</h2>
                <p>Your feedback helps us build a better roofing experience.</p>
                {data.feedback ? (
                  <div className="success-panel">
                    <CheckCircle2 size={32} />
                    <h3>Thank you for your feedback.</h3>
                    <p>
                      Overall rating: {average([data.feedback]).toFixed(1)} / 5
                    </p>
                    <p>{data.feedback.comments}</p>
                  </div>
                ) : (
                  <Form
                    onSubmit={(d) =>
                      change("feedback", { ...d, projectId: p.id })
                    }
                    submit="Submit feedback"
                  >
                    {[
                      "Installation",
                      "Service",
                      "Timeliness",
                      "Professionalism",
                    ].map((k) => (
                      <Field
                        key={k}
                        label={k}
                        name={k.toLowerCase()}
                        options={[
                          "1 — Very Poor",
                          "2 — Poor",
                          "3 — Average",
                          "4 — Good",
                          "5 — Excellent",
                        ].map((label, i) => ({ value: i + 1, label }))}
                        required
                      />
                    ))}
                    <Field
                      label="Comments"
                      name="comments"
                      type="textarea"
                      placeholder="Tell us about your experience…"
                    />
                  </Form>
                )}
              </section>
            )}
            {actionError && (
              <div className="error" role="alert">
                {actionError}
              </div>
            )}
            <p className="private-link">
              <Lock size={13} />
              This is your private tracking page. Keep the link secure.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
function ForemanCard({ foreman }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${location.origin}/verify/${foreman.id}`, {
      width: 100,
      margin: 1,
    }).then(setQr);
  }, [foreman.id]);
  return (
    <div className="foreman-card">
      <Avatar name={foreman.name} photo={foreman.photo} />
      <div>
        <strong>{foreman.name}</strong>
        <small>Foreman · {foreman.contact}</small>
        <a href={`/verify/${foreman.id}`} className="text-button">
          Verify personnel <ShieldCheck size={13} />
        </a>
      </div>
      <img src={qr} alt="Scan to verify foreman" width="90" />
    </div>
  );
}
function PersonnelVerify({ id }) {
  const [person, setPerson] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/personnel/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setPerson(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <div className="public-page">
      <PublicHeader />
      <div className="public-form card profile-card">
        {person ? (
          <>
            <ShieldCheck size={42} color="#b91c1c" />
            <h2>Verified ENG personnel</h2>
            <Avatar name={person.name} photo={person.photo} />
            <h1>{person.name}</h1>
            <Badge>{person.role}</Badge>
            <p>{person.id}</p>
            <p>{person.contact}</p>
            <p>ENG Roofing Supply & Installation Services</p>
          </>
        ) : (
          <p>{error || "Checking personnel identity…"}</p>
        )}
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
