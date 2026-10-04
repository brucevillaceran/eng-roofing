# ENG Roofing

**Integrated Payroll System and Roofing Project Management System with Client Feedback Analysis**

React + Vite frontend, Node.js + Express backend, **MySQL/MariaDB via mysql2 connection pooling**, Recharts, and face-api.js. The red UI, four roles (**Admin, Foreman, Employee, Client**), APIs, calculations, and workflow are preserved. SQLite is no longer the active application database.

## XAMPP / phpMyAdmin setup

Requires **Node.js 24+**, npm, and MySQL 8+ or MariaDB 10.4+ (verified with MariaDB 10.11.18). XAMPP supplies Apache, PHP, and MySQL/MariaDB; Node still runs ENG Roofing.

1. Install/start XAMPP. Start **MySQL** (often MariaDB internally). Start **Apache** to open phpMyAdmin; Apache is not required to serve the application during Node/Vite development.
2. Open **http://localhost/phpmyadmin** (or XAMPP's MySQL **Admin** button). In SQL, create your database:

   ```sql
   CREATE DATABASE eng_roofing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Select `eng_roofing`, choose **Import**, and import **database/schema.sql**. The schema uses `CREATE TABLE IF NOT EXISTS`; it does not drop tables or delete existing data. Do not import into an unrelated application's database.
4. In the repository folder, copy `.env.example` to `.env` (Windows Command Prompt: `copy .env.example .env`; macOS/Linux: `cp .env.example .env`). Configure:

   ```dotenv
   DB_DRIVER=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=eng_roofing
   DB_USER=root
   DB_PASSWORD=
   PORT=3000
   ```

   `DB_DRIVER=mysql` and `DB_DRIVER=mariadb` both use mysql2's compatible protocol. Adjust host, port, name, user, and password to your installation. Empty password matches a default local XAMPP setup; use your actual configured password and a dedicated database user for deployment. Credentials remain server-side and `.env` is ignored by Git; never use `VITE_` prefixes for credentials. Existing process environment variables take precedence over `.env`.

5. Install dependencies and check the connection:

   ```bash
   npm install
   npm run db:check
   ```

   As an alternative to phpMyAdmin's schema import, run `npm run db:init` once after creating the database. It is safe to rerun; it does not reset data. Company settings are initialized on first application startup, without sample accounts/business records.

6. If migrating existing SQLite records, follow the migration instructions below **before creating any new users or records**. Otherwise create the first Admin as described below.
7. Start the application:

   ```bash
   npm run dev
   ```

   **This single command starts both Express and the React/Vite frontend on http://localhost:3000.** No separate frontend command or PHP conversion is needed. Open `/login`; public information is at `/home`. Clients can register; Admin creates staff accounts.

**phpMyAdmin is a database management interface. Express connects directly to MySQL/MariaDB using `server/database.js`; it does not connect through phpMyAdmin.** Do not copy the entire project, `.env`, or SQLite backups into Apache's public `htdocs`. Apache may serve the built frontend in a separately configured production deployment, but the Express API is still required.

### Connection troubleshooting

- `ECONNREFUSED`: start XAMPP MySQL and check `DB_HOST`/`DB_PORT`. Use `127.0.0.1` if your localhost resolution differs from the server's TCP bind address.
- Access denied: correct `DB_USER`/`DB_PASSWORD` and grant access to `DB_NAME`.
- Unknown database/table: create the database, select it before importing `database/schema.sql`, then run `npm run db:check`.
- Large media uploads: configure MySQL/MariaDB `max_allowed_packet=64M` or higher in XAMPP's `my.ini`, then restart MySQL. Express retains the existing 12 MB request limit; facial descriptors and photos remain server-persisted.
- Never run two different versions of the application against the same data during migration.

## Safe migration from SQLite

Migration is an explicit **offline operator command**. Runtime code never initializes, queries, or writes SQLite. Only the standalone importer and its legacy-fixture tests use `node:sqlite`.

1. Stop the old SQLite application and any new MySQL application processes. Retain `data/eng-roofing.sqlite` and its WAL/SHM files. Keep a separate backup before deployment.
2. Configure `.env` for an **empty** target database. Create it and import the schema, or run `npm run db:init`. Do not bootstrap Admin or enter records yet.
3. Run:

   ```bash
   npm run db:migrate -- data/eng-roofing.sqlite
   ```

   Custom source paths are accepted, quoted if they contain spaces. The importer creates a consistent SQLite backup next to the source, including committed WAL data. It opens the source read-only and never deletes it.

4. The importer verifies redundant SQLite relationship tables, maps every supported field, and inserts records in foreign-key order inside one MySQL transaction. It compares every reconstructed entity and authentication record before committing. IDs, passwords, sessions, CSRF tokens, expiration timestamps, attempt counters, assignments, BOQ prices, attendance/payroll links, progress and correction histories are preserved. Unmapped fields, invalid relationships, unsupported roles, or lossy conversions fail with rollback instead of silently discarding data.
5. A `sqlite-import-v1` migration record stores the source checksum, counts, and import timestamp. An already imported target, existing business/authentication records, or customized settings cause refusal. There is no overwrite/reset flag. To repeat a migration, use another empty database; retain the failed target for investigation if needed.
6. Run `npm run db:check`, start `npm run dev`, verify your accounts and records, and inspect tables in phpMyAdmin. Keep the original SQLite source and backup until you have independently verified the migration and backed up MySQL. Switching `.env` to MySQL does not synchronize subsequent changes back to SQLite.

Legacy user defaults (`active`, `sessionVersion`) are filled explicitly. Only a source without the existing `account-ownership-v1` marker gets the original one-time, unambiguous existing-client email linkage. Registering an email later never claims guest records. Unmatched bookings remain Admin-managed. Legacy notifications without a trustworthy recipient are retained as historical rows but are not shown in any user's notification feed. Legacy accounts without password hashes need credential initialization through Admin account management; existing hashes need no reset.

## First administrator and production

Create/recover an Admin with the local operator command. Put a 12–128 character password in a private file, then remove that file:

```bash
npm run admin -- "your-admin@example.com" "Your name" < /path/to/private/password-file
```

The same stdin redirection works in Windows Command Prompt using your local file path. In PowerShell, use `Get-Content .\private-password.txt | npm run admin -- "your-admin@example.com" "Your name"`. This command invalidates the Admin's previous sessions and cannot promote an account belonging to another role. Existing linked business records prevent unsafe role changes; the last usable Admin cannot be deactivated/demoted.

```bash
npm run build # Build React into dist/
npm start     # Express serves the production API and built frontend
```

`npm start` works without Unix-specific environment syntax. Deploy behind HTTPS with the original Host header forwarded: production cookies are Secure, HttpOnly, and SameSite=Strict. `PORT` defaults to 3000. Keep database and backups private. Stop/restart Node after changing database configuration.

## Database map

| Area                     | Tables / relationships                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Accounts and roles       | `users`; Client, Employee, Foreman, Admin are roles of real users                                                    |
| Authentication           | `sessions` → users, `login_attempts`                                                                                 |
| Bookings and surveys     | `bookings` → client user; `inspections` → booking, Foreman                                                           |
| Quotations / BOQ         | `quotations` → booking, inspection; `quotation_materials` → quotation, material; saved quantity/unit/price snapshots |
| Projects and assignments | `projects` → booking, quotation, Foreman; `project_employees` → project, employee                                    |
| Execution                | `tasks`, `project_progress` → project; progress entries optionally link their actor                                  |
| Materials                | `materials`, `material_history`; `usage` → project, material                                                         |
| Attendance               | `attendance` → user, project; `attendance_corrections`                                                               |
| Payroll                  | `payroll` → user; `payroll_attendance` uniquely links paid attendance; `payroll_adjustments`                         |
| Payments / history       | `payments` → project; `payment_annotations` retains amendment history                                                |
| Feedback                 | `feedback` → project, with Admin review fields                                                                       |
| Communications           | `notifications` → recipient user; `emails` is the existing local outbox                                              |
| Configuration            | `settings`, `migrations`, `app_state` (transaction lock/revision)                                                    |

Business fields have individual SQL columns and relationships have foreign keys. JSON is limited to media arrays, facial descriptors, inspection accessory selections, and `_fields` metadata containing **key names**, which preserves absent versus empty legacy fields. `_position` preserves existing ordering. ISO timestamps map to UTC `DATETIME(3)`; dates use `DATE`, booleans use `BOOLEAN`, session expirations remain epoch milliseconds. Numeric columns use `DOUBLE` to preserve the current JavaScript/SQLite numerical behavior; existing domain rounding and financial calculations are unchanged. `server/seed.js` remains a synthetic test fixture and is never loaded by runtime startup.

## Validation and Employee enrollment

After updating an existing installation, stop Node, run `npm run db:init` (or reimport `database/schema.sql` in phpMyAdmin), then restart `npm run dev`. This adds the private `userPayrollArchive` table without deleting users or historical records. Startup moves existing non-Employee daily rates and facial descriptors into this archive and clears their active account fields. Attendance, payroll, payments, and unrelated profile information remain intact. The archive is never returned by the application API; protect it like other biometric database records. This cleanup is idempotent and also applies to permitted role changes.

Only **Employee** accounts have a daily rate and attendance face enrollment. Add User displays both fields only for Employee; a new Employee requires a positive rate and a captured face before the account is saved. An existing valid Employee enrollment can be retained on edit. Admin, Foreman, and Client requests containing either payroll field are rejected, as are attempts to enroll them or create new attendance/payroll for them. Foremen continue managing assigned projects and tasks. Historical payroll remains preserved for authorized inspection.

`shared/validation.js` supplies the same rules to React and Express. Forms show field errors immediately and validate again before submitting; the backend independently validates every mutation and checks selected records and ownership inside the transaction. Unknown/read-only request fields are rejected. Existing invalid legacy profile values are not fabricated or silently rewritten; they must be corrected when edited.

| Input                 | Rules                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone/contact         | Exactly 11 digits beginning `09`; no spaces, letters, or punctuation. Required for registration, account/profile forms, and booking contact.                                                                                                                                 |
| Person names          | 1–150 characters; Unicode letters, spaces, internal single hyphens/apostrophes; trim and collapse repeated spaces; no digits.                                                                                                                                                |
| Email                 | Trimmed, lowercased, valid local/domain format, no internal spaces, maximum 254 characters.                                                                                                                                                                                  |
| Numbers               | Finite plain decimal notation, maximum two decimal places; no exponent notation, commas, arbitrary text, or negative amounts. Counts and piece/tube/set quantities must be whole numbers.                                                                                    |
| Rates/prices/amounts  | Daily rate ₱0.01–₱100,000; material price ₱0–₱1,000,000; financial amounts capped at ₱1,000,000,000. Payments must be positive and remain subject to outstanding-balance checks. Peso displays retain cents.                                                                 |
| Quantities/dimensions | Quantities up to 1,000,000; BOQ quantities positive; usage/delivery nonnegative with existing delivery limits. Area positive, dimensions up to 1,000,000; sections 1–10,000 whole numbers.                                                                                   |
| Percentages/hours     | Progress 0–100; attendance hours 0–8, at most two decimal places.                                                                                                                                                                                                            |
| Dates/times           | Actual ISO calendar dates within 2000–2100; strict 24-hour HH:MM times. New/rescheduled bookings cannot be in the past; completed inspections, payments, and payroll periods cannot be in the future. Start/end, project/task, payroll, and attendance ordering is enforced. |
| Text                  | Trimmed; names/titles generally 150, addresses 500, descriptions/comments/notes 2,000 characters; reject control characters while retaining normal punctuation.                                                                                                              |
| Selects/IDs           | Allowed enum values, valid existing records, correct role/assignment/ownership; reject duplicate assignments/material lines and inactive recipients where applicable.                                                                                                        |
| Photos/enrollment     | Valid JPEG/PNG/WebP data URLs up to 1.5 MB each, at most five photos. Face descriptors require exactly 128 finite bounded numbers; only Admin may enroll Employees.                                                                                                          |

Passwords retain the existing 12–128-character policy, scrypt hashing, and verification. Sessions, HttpOnly cookies, expiration, activation checks, CSRF, and role/ownership protections remain enforced. The operator Admin command permits omitted contact/photo fields because they are not needed to bootstrap an administrator; it does not invent payroll fields.

## Verify real persistence

1. Log in as Admin and open **Materials → Add Material**. Enter a clearly labeled verification record, price, unit and category, then save.
2. In phpMyAdmin, select **eng_roofing → materials → Browse**. The new ID/name/price must appear as SQL columns.
3. Reload the application, edit that material's price, save, and reload phpMyAdmin. Confirm the new price and inspect `material_history` for the old price. Disable the verification material when finished.
4. Restart Node and check it again. Data is stored in MySQL/MariaDB, not browser localStorage. Client bookings can likewise be checked in `bookings`, notifications in `notifications`, and authenticated sessions in `sessions` (keep session/biometric data private).

Useful read-only SQL in phpMyAdmin:

```sql
SELECT id, name, price, active FROM materials;
SELECT materialId, price, newPrice, note FROM material_history ORDER BY _position;
SELECT id, clientId, status, submitted_at FROM bookings;
```

### Automated verification

```bash
npm test
npm run build
npm run format:check
```

Tests require a running real MySQL/MariaDB server and a local test account allowed to create/drop databases. They create randomly named `eng_roofing_test_*` databases and drop only those generated names, never `DB_NAME`. Do not grant those extra privileges to a deployed application account. Tests cover the four roles, ownership, CSRF, authentication/rate limits/session restart, workflow, facial/geolocation calculations, payroll/payment/history, migration fidelity/rollback, and concurrent writes. SQLite exists only as a temporary source fixture in migration tests. A missing database is a test failure, not a silent skip.

## Workflow

1. Client registers/signs in and submits a booking. Admin can also create one for an existing active Client account.
2. Admin approves/rejects bookings or schedules an inspection with an active Foreman. Client and assigned Foreman receive individual notifications.
3. Assigned Foreman or Admin records the inspection. Internal survey notes remain private; published client results appear in the Client portal.
4. Admin maintains actual catalog materials/prices. Foreman prepares an estimate from a completed assigned inspection; Admin reviews BOQ quantities/charges, sets downpayment, and sends the quotation.
5. The owning Client approves/rejects the quotation. Approval creates the project/job order and planned material usage. Admin is notified.
6. Admin assigns Foreman and Employees, confirms dates, and records the requested downpayment before starting work.
7. Assigned Foreman manages tasks, task status, overall progress/site updates, and material delivery/usage. Client and Admin receive progress notifications. Employees see only their assigned projects/tasks.
8. Admin supervises face enrollment. Employees record attendance using camera descriptors and location. The server selects an ongoing assignment covering today; check-out completes the workday.
9. Admin processes Employee payroll from completed verified attendance. Rate snapshots, deductions, and release timestamps are retained. Overlapping periods are rejected. Employees see only their own payroll and release information.
10. Complete required tasks and confirm final inspection/project requirements before completion. Record outstanding payments. Fully paid completed projects lock; historical financial and attendance records are preserved.
11. Owning Client submits completion feedback and sees its history. Admin sees analysis, reviews feedback, monitors system statistics, and can send individual notifications.

## Data and security

Prepared statements and InnoDB transactions protect writes. Each mutation acquires an `app_state` row lock before reading the current state, so multiple Node processes cannot lose updates, double-process payroll, or overpay through stale snapshots. Only changed rows and affected relationship collections are written; entity history is not bulk-deleted. Separate snapshot reads remain consistent. This intentionally preserves the existing state-based domain architecture; very large installations may later need paginated reads and finer-grained transaction boundaries.

Server authorization applies to every action and read endpoint. Mutations recheck the session and live account inside their transaction. Changing a URL, user ID or tracking token cannot bypass ownership. Passwords retain salted scrypt hashes; session tokens are stored as hashes, expire after 12 hours, and are revoked by logout or credential/account changes. Origin and CSRF checks remain active. Authentication limits are persisted and updated atomically. Database credentials are never included in frontend state.

Dashboards calculate from authorized database records and refresh every 30 seconds. Primary branding remains red; semantic status colors are preserved.

## Operational limits

- In-app notifications work without an email provider. Email messages are persisted in the Admin email outbox; external email delivery is not configured.
- Camera/location need HTTPS (or localhost), supported hardware, and permissions. Face descriptor comparison and geotagging are preserved; there is no liveness detection or geofencing. Enroll consenting personnel and apply appropriate biometric data handling policies.
- Payroll prorates daily rates by verified hours capped at eight per day. Overtime, taxes, and statutory deductions are not automated; enter approved deductions. Admin corrections are allowed before payroll processing/release; paid records remain preserved.
- Material prices must be entered by Admin; seed prices are synthetic fixtures. Historical quotations retain their original prices.
- Booking preferences and completion estimates require Admin scheduling review.
- Bundled face-api model files use the MIT license; see `public/models/LICENSE`.
