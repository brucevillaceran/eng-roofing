# ENG Roofing

**Integrated Payroll System and Roofing Project Management System with Client Feedback Analysis**

React + Vite, Express, Node SQLite, Recharts, and face-api.js. The existing booking, inspection, quotation, project, attendance, payroll, payment, and feedback modules share a persistent database with authenticated user portals.

## Run and create the first administrator

Requires Node 24+ and npm.

```bash
npm ci
npm run dev
```

Open **http://localhost:3000**. Public information is at `/home`; `/login` opens authentication. Clients can register; staff accounts are created by Admin. There are exactly four roles: **Admin, Foreman, Employee, Client**.

A new database starts with company settings and **no sample users, materials, or business records**. Create the first Admin through the local operator command. Use a private file containing a password of 12–128 characters, then remove that file:

```bash
npm run admin -- "your-admin@example.com" "Your name" < /path/to/private/password-file
```

The same command can recover an existing Admin account, invalidating its previous sessions. It cannot promote another role. Credentials are never hardcoded. Admin can create users, set/reset initial passwords, assign valid roles, activate/deactivate accounts, and enroll field personnel. Changing a role with existing linked business records is rejected to preserve record ownership; create a separate account when needed. The last usable Admin cannot be deactivated or demoted.

```bash
npm test       # Workflow, persistence, and multi-user HTTP/security tests
npm run build # Production bundle
npm start     # Production server; HTTPS is required for secure cookies
```

Deploy production behind HTTPS, forwarding the original Host header. Cookies are HttpOnly, SameSite=Strict, and Secure in production. `PORT` defaults to 3000. `ENG_DATABASE` can select another SQLite path for each process/command. Keep the database and backups private; do not expose them through a web server.

## Existing databases

The default database remains `data/eng-roofing.sqlite`; records survive reloads/restarts. Startup preserves existing business records, adds account/session fields, and links legacy bookings only to an unambiguous **existing Client account** with the same email. Unmatched guest bookings remain visible to Admin. Admin can link these legacy bookings to the correct Client account through booking review; never claim them just by registering an email address.

Legacy accounts have no login password until initialized: recover Admin with the local command, then use Users to set other account passwords. Legacy broadcast notifications are removed because they have no trustworthy individual recipient. New notifications always have a user ID. Previously issued tracking links now require login and booking ownership; a token alone does not grant access.

`server/seed.js` is retained for optional synthetic fixtures. The application does not call it unless explicitly requested through `createStore(path, { sample: true })`, and it only applies to a new database. Tests use isolated databases and synthetic accounts; they do not alter application records.

## Workflow

1. Client registers/signs in and submits a booking. Admin can also create one for an existing active Client account.
2. Admin approves/rejects bookings or schedules an inspection with an active Foreman. Client and assigned Foreman receive individual notifications.
3. Assigned Foreman or Admin records the inspection. Internal survey notes remain private; published client results appear in the Client portal.
4. Admin maintains actual catalog materials/prices. Foreman prepares an estimate from a completed assigned inspection; Admin reviews BOQ quantities/charges, sets downpayment, and sends the quotation.
5. The owning Client approves/rejects the quotation. Approval creates the project/job order and planned material usage. Admin is notified.
6. Admin assigns Foreman and Employees, confirms dates, and records the requested downpayment before starting work.
7. Assigned Foreman manages tasks, task status, overall progress/site updates, and material delivery/usage. Client and Admin receive progress notifications. Employees see only their assigned projects/tasks.
8. Admin supervises face enrollment. Employees/Foremen record attendance using camera descriptors and location. The server selects an ongoing assignment covering today; check-out completes the workday.
9. Admin processes payroll from completed verified attendance. Rate snapshots, deductions, and release timestamps are retained. Overlapping periods are rejected. Employees see only their own payroll and release information.
10. Complete required tasks and confirm final inspection/project requirements before completion. Record outstanding payments. Fully paid completed projects lock; historical financial and attendance records are preserved.
11. Owning Client submits completion feedback and sees its history. Admin sees analysis, reviews feedback, monitors system statistics, and can send individual notifications.

## Data and security

Entity tables link bookings → inspections → quotations → projects → tasks/usage/attendance/payments/feedback. SQLite foreign keys and normalized quotation-material, employee-assignment, and payroll-attendance links preserve relationships. Prepared statements and atomic transactions protect saves. Server authorization applies to every action and read endpoint; user IDs or tracking URLs cannot bypass ownership. Passwords use salted scrypt hashes; random session tokens are stored only as hashes, expire after 12 hours, and are revoked by logout or account/credential changes. Mutations validate request origin and session CSRF tokens. Authentication attempts are limited by account/IP and IP totals.

Dashboards calculate statistics from authorized database records and refresh every 30 seconds. Primary UI branding uses red; success, warning, and information states retain semantic colors.

## Operational limits

- In-app notifications work without an email provider. Email messages are persisted in the Admin email outbox; external email delivery is not configured.
- Camera/location need HTTPS (or localhost), supported hardware, and permissions. Face descriptor comparison and geotagging are preserved; there is no liveness detection or geofencing. Enroll consenting personnel and apply appropriate biometric data handling policies.
- Payroll prorates daily rates by verified hours capped at eight per day. Overtime, taxes, and statutory deductions are not automated; enter approved deductions. Admin corrections are allowed before payroll processing/release; paid records remain preserved.
- Material prices must be entered by Admin; seed prices are synthetic fixtures. Historical quotations retain their original prices.
- Booking preferences and completion estimates require Admin scheduling review.
- Bundled face-api model files use the MIT license; see `public/models/LICENSE`.
