import type { CsvImportFailure, CsvImportResult, StaffRecord, RewardsMemberRecord } from "../types";

export function parseStaffRecord(
  row: number,
  raw: Record<string, string>,
): StaffRecord | CsvImportFailure {
  const employeeId = raw.employeeId?.trim() ?? raw.EmployeeId?.trim() ?? raw.employee_id?.trim() ?? "";
  const firstName = raw.firstName?.trim() ?? raw.FirstName?.trim() ?? raw.first_name?.trim() ?? "";
  const lastName = raw.lastName?.trim() ?? raw.LastName?.trim() ?? raw.last_name?.trim() ?? "";
  const email = raw.email?.trim() ?? raw.Email?.trim() ?? raw.email_address?.trim() ?? "";
  const phone = raw.phone?.trim() ?? raw.Phone?.trim() ?? raw.phone_number?.trim() ?? "";
  const roleRaw = raw.role?.trim() ?? raw.Role?.trim() ?? raw.role_code?.trim() ?? "";
  const hourlyRateText = raw.hourlyRate?.replace(/[$,\s]/g, "") ?? raw.HourlyRate?.replace(/[$,\s]/g, "") ?? "0";
  const activeRaw = raw.active?.toLowerCase() ?? raw.Active?.toLowerCase() ?? "true";
  const pinCode = raw.pinCode?.trim() ?? raw.PinCode?.trim() ?? raw.pin?.trim() ?? undefined;

  if (!employeeId) {
    return { row, raw, error: "Staff row is missing employeeId." };
  }
  if (!firstName || !lastName) {
    return { row, raw, error: "Staff row is missing first or last name." };
  }
  if (!email) {
    return { row, raw, error: "Staff row is missing email." };
  }

  const hourlyRate = Number(hourlyRateText);
  if (Number.isNaN(hourlyRate) || hourlyRate < 0) {
    return { row, raw, error: "Staff row has an invalid hourly rate." };
  }

  const role: StaffRecord["role"] =
    roleRaw.toLowerCase() === "server"
      ? "server"
      : roleRaw.toLowerCase() === "bartender"
        ? "bartender"
        : roleRaw.toLowerCase() === "cook"
          ? "cook"
          : roleRaw.toLowerCase() === "shift_lead" || roleRaw.toLowerCase() === "shiftlead"
            ? "shift_lead"
            : roleRaw.toLowerCase() === "manager" || roleRaw.toLowerCase() === "mgr"
              ? "manager"
              : "server";

  return {
    employeeId,
    firstName,
    lastName,
    role,
    email,
    phone,
    hourlyRate,
    pinCode,
    active: activeRaw === "true" || activeRaw === "yes" || activeRaw === "1",
  };
}

export function parseRewardsMemberRecord(
  row: number,
  raw: Record<string, string>,
): RewardsMemberRecord | CsvImportFailure {
  const memberId = raw.memberId?.trim() ?? raw.MemberId?.trim() ?? raw.member_id?.trim() ?? raw.id?.trim() ?? "";
  const firstName = raw.firstName?.trim() ?? raw.FirstName?.trim() ?? raw.first_name?.trim() ?? "";
  const lastName = raw.lastName?.trim() ?? raw.LastName?.trim() ?? raw.last_name?.trim() ?? "";
  const email = raw.email?.trim() ?? raw.Email?.trim() ?? raw.email_address?.trim() ?? "";
  const phone = raw.phone?.trim() ?? raw.Phone?.trim() ?? raw.phone_number?.trim() ?? "";
  const pointsBalanceText = raw.pointsBalance?.replace(/[$,\s]/g, "") ?? raw.PointsBalance?.replace(/[$,\s]/g, "") ?? "0";
  const totalLifetimeSpendText = raw.totalLifetimeSpend?.replace(/[$,\s]/g, "") ?? raw.TotalLifetimeSpend?.replace(/[$,\s]/g, "") ?? "0";
  const tierRaw = raw.tier?.trim() ?? raw.Tier?.trim() ?? raw.rewards_tier?.trim() ?? raw.tier_level?.trim() ?? "";
  const enrolledDate = raw.enrollmentDate?.trim() ?? raw.EnrollmentDate?.trim() ?? raw.enrolled_date?.trim() ?? "";

  if (!memberId) {
    return { row, raw, error: "Rewards row is missing memberId." };
  }
  if (!firstName || !lastName) {
    return { row, raw, error: "Rewards row is missing first or last name." };
  }
  if (!email) {
    return { row, raw, error: "Rewards row is missing email." };
  }

  const pointsBalance = Number(pointsBalanceText);
  if (Number.isNaN(pointsBalance) || pointsBalance < 0) {
    return { row, raw, error: "Rewards row has an invalid points balance." };
  }

  const totalLifetimeSpend = Number(totalLifetimeSpendText);
  if (Number.isNaN(totalLifetimeSpend) || totalLifetimeSpend < 0) {
    return { row, raw, error: "Rewards row has an invalid lifetime spend value." };
  }

  const tier: RewardsMemberRecord["tier"] =
    tierRaw.toLowerCase() === "bronze"
      ? "bronze"
      : tierRaw.toLowerCase() === "silver"
        ? "silver"
        : tierRaw.toLowerCase() === "gold" || tierRaw.toLowerCase() === "platinum"
          ? tierRaw.toLowerCase() === "gold"
            ? "gold"
            : tierRaw.toLowerCase() === "platinum"
              ? "platinum"
              : "gold"
          : tierRaw.toLowerCase() === "platinum"
            ? "platinum"
            : tierRaw.toLowerCase().includes("gold")
              ? "gold"
              : "bronze";

  if (!enrolledDate) {
    return { row, raw, error: "Rewards row is missing enrollmentDate." };
  }

  return {
    memberId,
    firstName,
    lastName,
    phone,
    email,
    pointsBalance,
    tier,
    enrollmentDate: enrolledDate,
    totalLifetimeSpend,
  };
}

export function buildStaffImportResult(records: StaffRecord[], failures: CsvImportFailure[]): CsvImportResult<StaffRecord> {
  return {
    success: failures.length === 0,
    inserted: 0,
    updated: records.length,
    failedRecords: failures,
    records,
  };
}

export function buildRewardsImportResult(records: RewardsMemberRecord[], failures: CsvImportFailure[]): CsvImportResult<RewardsMemberRecord> {
  return {
    success: failures.length === 0,
    inserted: 0,
    updated: records.length,
    failedRecords: failures,
    records,
  };
}
