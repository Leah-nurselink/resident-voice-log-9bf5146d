import { describe, expect, it } from "vitest";
import { carePlanReviewDate, scheduleDates } from "../resident-calendar";

describe("resident calendar dates", () => {
  it("uses the profile's 30-day care plan review cycle", () => {
    expect(carePlanReviewDate("2026-09-20")).toBe("2026-10-20");
  });
  it("shows a dated appointment once regardless of weekdays", () => {
    expect(scheduleDates({ specific_date: "2026-10-06", days_of_week: [1, 2] }, "2026-10-01", "2026-10-31")).toEqual(["2026-10-06"]);
  });
  it("does not include dates outside the calendar", () => {
    expect(scheduleDates({ specific_date: "2026-11-06", days_of_week: [2] }, "2026-10-01", "2026-10-31")).toEqual([]);
  });
  it("expands recurring appointments on matching days", () => {
    expect(scheduleDates({ specific_date: null, days_of_week: [2] }, "2026-10-05", "2026-10-18")).toEqual(["2026-10-06", "2026-10-13"]);
  });
});