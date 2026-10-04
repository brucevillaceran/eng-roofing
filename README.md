# ENG Roofing

**Integrated Payroll System and Roofing Project Management System with Client Feedback Analysis**

A persistent, responsive prototype for ENG Roofing Supply & Installation Services. React + Vite, Express, Node SQLite, Recharts, and face-api.js descriptors.

## Run

Requires Node 24+ and npm.

```bash
npm ci
npm run dev
```

Open **http://localhost:3000** for the Admin workspace. Public pages: `/home`, `/book`, `/track`. The role selector at the top right switches between Admin, Foreman, Employee, and Client demonstration identities.

```bash
npm test       # Workflow and persistence tests
npm run build # Production bundle
npm start     # Serve the production bundle on port 3000
```

SQLite is automatically seeded on first startup at `data/eng-roofing.sqlite` (ignored by Git). Changes survive reloads and restarts. Stop the server and delete the task-local `data/` directory to restore sample data.

## Connected demonstration

1. Open `/book`. Submit a guest roofing request. Save the reference and private tracking link.
2. In **Admin → Bookings**, review the request and choose **For Inspection**, an inspector, and date. Exact submission timestamps establish ordering for conflicting schedules.
3. Switch to **Foreman → Site Inspections**. Complete measurements, condition, roof profile, accessories, photos, and notes.
4. Select **Prepare estimate**, choose catalog materials and quantities, and submit for review. Previous material records are available as reference only.
5. Switch to **Admin → Quotations**. Review quantities and charges, set the requested downpayment, and finalize. Prices are snapshots and cannot silently change with the catalog.
6. Open the guest tracking link (also in **Notifications → Email preview**) and approve. A project/job order and planned material records are created automatically.
7. In **Admin → Projects**, open the new project and **Manage project**. Assign foreman/employees and dates. Record the requested downpayment in **Payments** before changing status to Ongoing.
8. As the assigned Foreman, open the project to add tasks, record progress, and update material delivery/usage. Task assignees must belong to the project.
9. **Admin → Users → Enroll** starts supervised camera enrollment for personnel. Switch to the enrolled worker, then **Attendance → Verify & record attendance**. Grant camera/location permissions. The second verification checks out. The system chooses the earliest-starting ongoing assignment that includes today; the employee never selects a project.
10. **Admin → Payroll** calculates pay from completed, verified attendance. The seed has October 2 sample attendance for Pedro Santos and Mark Reyes to demonstrate a full workday. Rates are configurable; hours are capped at eight per day; deductions are entered explicitly. Overlapping payroll periods are rejected.
11. Complete required tasks and confirm the final inspection/project requirements, then complete the project. Record any remaining balance. Completed work is preserved; the fully paid record becomes locked.
12. Completion generates a feedback link in the email preview inbox. Submit the four numerical ratings through guest tracking and view **Feedback Analysis** for averages, strongest/weakest categories, radar chart, and comments.

## Data and rules

Entity tables link bookings → inspections → quotations → projects → tasks/usage/attendance/payments/feedback. SQLite foreign keys enforce entity relationships; `quotation_materials`, `project_employees`, and `payroll_attendance` preserve normalized links. JSON columns hold flexible inspection details and project timelines. Saves are atomic transactions. Failed actions are never committed.

Catalog prices are editable **sample/default prototype prices**, not official ENG Roofing prices. Historical quotation and payroll rates are retained.

## Prototype boundaries

- The role selector is an explicit demo mechanism, **not authentication**. Do not expose this app with real customer or biometric data. Account registration, secure sessions, and production authorization are not implemented.
- Emails are stored in the **local email preview inbox**, including clickable tracking/quotation/feedback links. External email delivery is not configured or claimed.
- Face-api models are bundled locally. Real camera capture, descriptor comparison, and location recording are implemented. This is **geotagging**, not geofencing. Physical device verification needs a secure context (localhost or HTTPS), supported hardware, and granted permissions. There is no liveness/anti-spoofing detection.
- Location and descriptors are synthetic/demo-local data; no biometric provider is called. Enrollment should use consenting test participants only.
- Payroll demonstrates daily rate prorated by verified hours, with manually approved deductions. No overtime, tax, statutory deductions, or task-based compensation is assumed.
- Preferred booking time and estimated completion are scheduling information; real availability is reviewed by Admin.
- Face-api model files are distributed by `@vladmandic/face-api` under its MIT license. See `public/models/LICENSE`.
