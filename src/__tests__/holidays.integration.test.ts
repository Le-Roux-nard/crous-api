/// <reference types="jest" />
import PublicHolidaysManager from "../utils/publicHolydayManager.js";
import HolidaysManager from "../utils/HolidaysManager.js";
import server from "../__mocks__/server.js";

beforeAll(() => {
	jest.useFakeTimers().setSystemTime(new Date("2023-03-01"));
	server.listen();
});

describe("PublicHolidayManager", () => {
	it("should return Public Holidays List for 2023", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2023-01-01"));

		const publicHolidaysManager = new PublicHolidaysManager();
		await publicHolidaysManager.updateCache();
		expect(publicHolidaysManager.getPublicHolydays()).toHaveLength(11);

		const jourDeLan = publicHolidaysManager.getPublicHolydays()[0];
		expect(jourDeLan.description).toBe("1er janvier");
		expect(jourDeLan.date).toStrictEqual(new Date("2023-01-01"));
		expect(jourDeLan.actual).toBeTruthy();
	});
});

describe("HolidayManager", () => {
	it("should return Holidays List for 2022-2023 school year", async () => {
		const holidayManager = new HolidaysManager();
		await holidayManager.updateCache();
		const holidays = holidayManager.getStandardVacances();
		expect(holidays.size).toBe(holidays.size);
	});

	it("should delay start of special holidays", async () => {
		const holidayManager = new HolidaysManager();
		await holidayManager.updateCache();
		holidayManager.loadCustomVacances();
		const customHolidays = holidayManager.getCustomVacances();

		expect(customHolidays?.["Le Mans Université"]).toBeDefined();

		const expectedStartDate: Date = new Date("2022-10-28");
		expectedStartDate.setUTCHours(22);
		if (customHolidays?.["Le Mans Université"]) {
			expect(customHolidays["Le Mans Université"][0].start_date).toStrictEqual(expectedStartDate);
		}
	});
});
