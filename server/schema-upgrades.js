// Explicit additive upgrades only. Nullable additions preserve imported history
// without inventing the Foreman or timestamps of old attendance records.
export const columnUpgrades = {
  attendance: {
    foremanId:
      "ADD COLUMN `foremanId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD CONSTRAINT attendance_in_foreman FOREIGN KEY (`foremanId`) REFERENCES users(id) ON DELETE RESTRICT",
    checkOutForemanId:
      "ADD COLUMN `checkOutForemanId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD CONSTRAINT attendance_out_foreman FOREIGN KEY (`checkOutForemanId`) REFERENCES users(id) ON DELETE RESTRICT",
    createdAt: "ADD COLUMN `createdAt` DATETIME(3) NULL",
    updatedAt: "ADD COLUMN `updatedAt` DATETIME(3) NULL",
  },
  payroll: { workedHours: "ADD COLUMN `workedHours` DOUBLE NULL" },
};
