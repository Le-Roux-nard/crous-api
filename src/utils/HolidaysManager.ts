import { CustomHolidays } from "crous-api-types";
import { SpecialHoliday, Holiday } from "./Holidays.js";
import { DeepSet } from "./deepSet.js";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

import { CustomHolidaysList } from "./CustomHoliday.js";
import { ActualEvent } from "./ActualEvent.js";
dayjs.extend(customParseFormat);
dayjs.locale("fr");

function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
	return keys.reduce((o, k) => ((o[k] = obj[k]), o), {} as Pick<T, K>);
}

export type SpecialHolidaysType = { [key in CustomHolidays]?: (SpecialHoliday & ActualEvent)[] };

export default class HolidaysManager {
	private static instance: HolidaysManager;

	private cache: DeepSet<Holiday> = new DeepSet();
	private customVacances: SpecialHolidaysType = {};

	public constructor() {
		if (!!HolidaysManager.instance) {
			return HolidaysManager.instance;
		} else {
			HolidaysManager.instance = this;
		}
	}

	public async updateCache() {
		const today = new Date();
		const thisYear = today.getFullYear();
		const isBeforeSeptember = today.getMonth() < 8; // 8 représente le mois de septembre

		// Calculer l'année scolaire en fonction de la date actuelle
		let scholarYear = "";
		if (isBeforeSeptember) {
			scholarYear = `${thisYear - 1}-${thisYear}`;
		} else {
			scholarYear = `${thisYear}-${thisYear + 1}`;
		}

		const data = await fetch(
			`https://data.education.gouv.fr/api/records/1.0/search/?dataset=fr-en-calendrier-scolaire&lang=fr&rows=-1&sort=annee_scolaire&facet=start_date&facet=end_date&facet=zones&facet=annee_scolaire&timezone=Europe%2FParis&q=annee_scolaire%3D${scholarYear}`
		).then((r) => r.json());

		for (const record of data.records) {
			let vacance = new Holiday();
			vacance = pick(record.fields, ...vacance.keys());
			vacance.start_date = new Date(record.fields.start_date);
			vacance.end_date = new Date(record.fields.end_date);
			this.cache.add(vacance);
		}
	}

	public loadCustomVacances() {
		const vacances = this.cache;
		for (const [customPlace, customDelays] of Object.entries(CustomHolidaysList)) {
			for (const customDelay of customDelays ?? []) {
				const baseVacance = [...vacances].find(
					(vac: Holiday) => vac.description === customDelay.description && vac.zones === customDelay.zones
				) as Holiday;
				if (!baseVacance) {
					continue;
				} else {
					const specialVacance = SpecialHoliday.from(baseVacance) as SpecialHoliday;
					customDelay.start_delay && (specialVacance.start_delay = customDelay.start_delay);
					customDelay.end_delay && (specialVacance.end_delay = customDelay.end_delay);

					let startDate = dayjs(baseVacance.start_date);
					let endDate = dayjs(baseVacance.end_date);
					if (!!customDelay.start_delay) {
						startDate = startDate.add(customDelay.start_delay * 24 * 60 * 60 * 1000);
					}
					if (!!customDelay.end_delay) {
						endDate = endDate.add(customDelay.end_delay * 24 * 60 * 60 * 1000);
					}
					specialVacance.start_date = startDate.toDate();
					specialVacance.end_date = endDate.toDate();
					if (!Object.keys(this.customVacances).find((key) => key === customPlace)) {
						this.customVacances[customPlace as CustomHolidays] = [specialVacance];
					} else {
						this.customVacances[customPlace as CustomHolidays]?.push(specialVacance);
					}
				}
			}
		}
	}

	public getStandardVacances(): DeepSet<Holiday & ActualEvent> {
		let tempVacances = this.cache;
		const today = process.env.MOCKED_DATE ? new Date(process.env.MOCKED_DATE) : new Date();
		for (const vac of tempVacances.values() as IterableIterator<Holiday>) {
			if (vac.start_date < today && vac.end_date > today) {
				(vac as ActualEvent & typeof vac).actual = true;
			}
		}
		return new DeepSet([...tempVacances]);
	}

	public getCustomVacances() {
		const specialHoliday = this.customVacances;
		if (Object.keys(specialHoliday).length == 0) {
			return specialHoliday;
		} else {
			const today = process.env.MOCKED_DATE ? new Date(process.env.MOCKED_DATE) : new Date();
			for (const [, customHolidayArr] of Object.entries(specialHoliday)) {
				for (const vac of customHolidayArr) {
					if (vac.start_date < today && vac.end_date > today) {
						(vac as ActualEvent & typeof vac).actual = true;
					}
				}
				return specialHoliday;
			}
		}
	}
}
