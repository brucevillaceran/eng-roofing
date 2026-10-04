-- Existing installations: prefer npm run db:init to also normalize legacy table casing.
-- Do not import over a case-sensitive mixed-case archive, use the initializer instead.
-- ENG Roofing relational schema. Select/create your database before importing.
-- Non-destructive: existing tables and records are never dropped.
-- DOUBLE preserves the existing JavaScript numeric calculations and SQLite REAL values.
-- _fields contains key names only, preserving optional legacy fields without storing entity blobs.

CREATE TABLE IF NOT EXISTS `users` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `name` TEXT NULL,
  `email` VARCHAR(254) NULL,
  `contact` TEXT NULL,
  `initials` TEXT NULL,
  `role` ENUM('Admin','Foreman','Employee','Client') NULL,
  `rate` DOUBLE NULL,
  `active` BOOLEAN NULL,
  `sessionVersion` INT NULL,
  `passwordHash` TEXT NULL,
  `photo` LONGTEXT NULL,
  `descriptor` JSON NULL,
  _fields JSON NOT NULL,
  UNIQUE KEY users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `materials` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `name` TEXT NULL,
  `unit` TEXT NULL,
  `price` DOUBLE NULL,
  `category` TEXT NULL,
  `thickness` TEXT NULL,
  `profile` TEXT NULL,
  `active` BOOLEAN NULL,
  _fields JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bookings` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `clientId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `name` TEXT NULL,
  `email` TEXT NULL,
  `phone` TEXT NULL,
  `address` TEXT NULL,
  `date` DATE NULL,
  `time` TEXT NULL,
  `service` TEXT NULL,
  `type` TEXT NULL,
  `description` TEXT NULL,
  `status` TEXT NULL,
  `submitted_at` DATETIME(3) NULL,
  `token` VARCHAR(128) NULL,
  `photos` JSON NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`clientId`) REFERENCES `users`(id) ON DELETE RESTRICT,
  UNIQUE KEY bookings_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inspections` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `bookingId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `foremanId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `date` DATE NULL,
  `status` TEXT NULL,
  `area` DOUBLE NULL,
  `linear` DOUBLE NULL,
  `sections` INT NULL,
  `profile` TEXT NULL,
  `complexity` TEXT NULL,
  `condition` TEXT NULL,
  `notes` TEXT NULL,
  `clientNotes` TEXT NULL,
  `accessories` JSON NULL,
  `photos` JSON NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`bookingId`) REFERENCES `bookings`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`foremanId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quotations` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `bookingId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `inspectionId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `charges` DOUBLE NULL,
  `total` DOUBLE NULL,
  `downpayment` DOUBLE NULL,
  `status` TEXT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`bookingId`) REFERENCES `bookings`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`inspectionId`) REFERENCES `inspections`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `projects` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `bookingId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `quotationId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `name` TEXT NULL,
  `client` TEXT NULL,
  `service` TEXT NULL,
  `type` TEXT NULL,
  `address` TEXT NULL,
  `status` TEXT NULL,
  `progress` DOUBLE NULL,
  `start` DATE NULL,
  `end` DATE NULL,
  `foremanId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `requirements` BOOLEAN NULL,
  `locked` BOOLEAN NULL,
  `createdAt` DATETIME(3) NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`bookingId`) REFERENCES `bookings`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`quotationId`) REFERENCES `quotations`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`foremanId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `projectId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `name` TEXT NULL,
  `assigneeId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `start` DATE NULL,
  `due` DATE NULL,
  `progress` DOUBLE NULL,
  `notes` TEXT NULL,
  `required` BOOLEAN NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`projectId`) REFERENCES `projects`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`assigneeId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usage` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `projectId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `materialId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `used` DOUBLE NULL,
  `delivered` DOUBLE NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`projectId`) REFERENCES `projects`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`materialId`) REFERENCES `materials`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attendance` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `userId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `projectId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `date` DATE NULL,
  `checkIn` DATETIME(3) NULL,
  `checkOut` DATETIME(3) NULL,
  `hours` DOUBLE NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `checkOutLatitude` DOUBLE NULL,
  `checkOutLongitude` DOUBLE NULL,
  `verified` BOOLEAN NULL,
  `source` TEXT NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `users`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`projectId`) REFERENCES `projects`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `userId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `from` DATE NULL,
  `to` DATE NULL,
  `days` DOUBLE NULL,
  `hours` DOUBLE NULL,
  `rate` DOUBLE NULL,
  `gross` DOUBLE NULL,
  `deductions` DOUBLE NULL,
  `net` DOUBLE NULL,
  `status` TEXT NULL,
  `createdAt` DATETIME(3) NULL,
  `releasedAt` DATETIME(3) NULL,
  `correctionReason` TEXT NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `projectId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `amount` DOUBLE NULL,
  `method` TEXT NULL,
  `date` DATE NULL,
  `reference` TEXT NULL,
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`projectId`) REFERENCES `projects`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feedback` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `projectId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `name` TEXT NULL,
  `installation` INT NULL,
  `service` INT NULL,
  `timeliness` INT NULL,
  `professionalism` INT NULL,
  `comments` TEXT NULL,
  `createdAt` DATETIME(3) NULL,
  `reviewNotes` TEXT NULL,
  `reviewedAt` DATETIME(3) NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`projectId`) REFERENCES `projects`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `userId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `role` ENUM('Admin','Foreman','Employee','Client') NULL,
  `title` TEXT NULL,
  `message` TEXT NULL,
  `createdAt` DATETIME(3) NULL,
  `read` BOOLEAN NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `emails` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `to` TEXT NULL,
  `subject` TEXT NULL,
  `message` TEXT NULL,
  `path` TEXT NULL,
  `createdAt` DATETIME(3) NULL,
  `status` TEXT NULL,
  _fields JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  `name` TEXT NULL,
  `hoursPerDay` DOUBLE NULL,
  `currency` TEXT NULL,
  `payrollNote` TEXT NULL,
  _fields JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quotation_materials` (
  `quotationId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  _position INT NOT NULL,
  `materialId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `name` TEXT NULL,
  `unit` TEXT NULL,
  `quantity` DOUBLE NULL,
  `price` DOUBLE NULL,
  _fields JSON NOT NULL,
  PRIMARY KEY (`quotationId`, _position),
  FOREIGN KEY (`quotationId`) REFERENCES `quotations`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`materialId`) REFERENCES `materials`(id) ON DELETE RESTRICT,
  UNIQUE KEY quotation_material (quotationId, materialId),
  CHECK (quantity > 0),
  CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_employees` (
  `projectId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  _position INT NOT NULL,
  `userId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  _fields JSON NOT NULL,
  PRIMARY KEY (`projectId`, _position),
  FOREIGN KEY (`projectId`) REFERENCES `projects`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`userId`) REFERENCES `users`(id) ON DELETE RESTRICT,
  UNIQUE KEY project_employee (projectId, userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll_attendance` (
  `payrollId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  _position INT NOT NULL,
  `attendanceId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  _fields JSON NOT NULL,
  PRIMARY KEY (`payrollId`, _position),
  FOREIGN KEY (`payrollId`) REFERENCES `payroll`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`attendanceId`) REFERENCES `attendance`(id) ON DELETE RESTRICT,
  UNIQUE KEY paid_attendance (attendanceId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_progress` (
  `projectId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  _position INT NOT NULL,
  `text` TEXT NULL,
  `at` DATETIME(3) NULL,
  `actorId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `progress` DOUBLE NULL,
  _fields JSON NOT NULL,
  PRIMARY KEY (`projectId`, _position),
  FOREIGN KEY (`projectId`) REFERENCES `projects`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`actorId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `material_history` (
  `materialId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  _position INT NOT NULL,
  `at` DATETIME(3) NULL,
  `price` DOUBLE NULL,
  `unit` TEXT NULL,
  `name` TEXT NULL,
  `newPrice` DOUBLE NULL,
  `note` TEXT NULL,
  _fields JSON NOT NULL,
  PRIMARY KEY (`materialId`, _position),
  FOREIGN KEY (`materialId`) REFERENCES `materials`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attendance_corrections` (
  `attendanceId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  _position INT NOT NULL,
  `previousHours` DOUBLE NULL,
  `hours` DOUBLE NULL,
  `reason` TEXT NULL,
  `actorId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `at` DATETIME(3) NULL,
  _fields JSON NOT NULL,
  PRIMARY KEY (`attendanceId`, _position),
  FOREIGN KEY (`attendanceId`) REFERENCES `attendance`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`actorId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll_adjustments` (
  `payrollId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  _position INT NOT NULL,
  `previousDeductions` DOUBLE NULL,
  `deductions` DOUBLE NULL,
  `reason` TEXT NULL,
  `actorId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `at` DATETIME(3) NULL,
  _fields JSON NOT NULL,
  PRIMARY KEY (`payrollId`, _position),
  FOREIGN KEY (`payrollId`) REFERENCES `payroll`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`actorId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_annotations` (
  `paymentId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  _position INT NOT NULL,
  `previousRemarks` TEXT NULL,
  `remarks` TEXT NULL,
  `actorId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `at` DATETIME(3) NULL,
  _fields JSON NOT NULL,
  PRIMARY KEY (`paymentId`, _position),
  FOREIGN KEY (`paymentId`) REFERENCES `payments`(id) ON DELETE RESTRICT,
  FOREIGN KEY (`actorId`) REFERENCES `users`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  tokenHash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  userId VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  csrf CHAR(64) NOT NULL,
  version INT NOT NULL,
  expires BIGINT NOT NULL,
  INDEX (expires),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `key` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  count INT NOT NULL,
  expires BIGINT NOT NULL,
  INDEX (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `migrations` (
  id VARCHAR(191) PRIMARY KEY,
  details JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `app_state` (
  id INT PRIMARY KEY,
  revision BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO app_state (id, revision) VALUES (1, 0) ON DUPLICATE KEY UPDATE id=id;

-- Retired account-level payroll fields, never exposed in API state.
-- Attendance, payslips, and their financial snapshots remain in their original tables.
CREATE TABLE IF NOT EXISTS `userpayrollarchive` (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  _position INT NOT NULL,
  userId VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role ENUM('Admin','Foreman','Employee','Client') NOT NULL,
  rate DOUBLE NULL,
  descriptor JSON NULL,
  archivedAt DATETIME(3) NOT NULL,
  _fields JSON NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
