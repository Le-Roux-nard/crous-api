import { setupServer } from "msw/node";
import { readFileSync } from "fs";

import { http, HttpResponse } from "msw";

const mockFolderPath = "./mockData";

const holidaysJSON = JSON.parse(readFileSync(`${mockFolderPath}/holidays-2023.json`, "utf8"));
const publicHolidaysJSON = JSON.parse(readFileSync(`${mockFolderPath}/publicHolidays-2023.json`, "utf8"));
const datasetActus = JSON.parse(readFileSync(`${mockFolderPath}/datasetActus.json`, "utf8"));
const datasetLogements = JSON.parse(readFileSync(`${mockFolderPath}/datasetLogements.json`, "utf8"));
const crousWebServiceFeed = readFileSync(`${mockFolderPath}/crousWebServiceFeed.htm`).toString();

const handlers = [
	http.get("https://data.education.gouv.fr/api/records/1.0/search/", () => HttpResponse.json(holidaysJSON)),
	http.get(/https?:\/\/calendrier\.api\.gouv\.fr\/jours-feries\/metropole\/\d{4}/, () => HttpResponse.json(publicHolidaysJSON)),
	http.get("https://www.data.gouv.fr/api/2/datasets/5548d35cc751df0767a7b26c/resources/", () => HttpResponse.json(datasetActus)),
	http.get("https://www.data.gouv.fr/api/2/datasets/5548d994c751df32e0a7b26c/resources/", () => HttpResponse.json(datasetLogements)),
	http.get(/https?:\/\/webservices-v2\.crous-mobile\.fr(?::8080)?\/feed\/?/, async ({ request: { url: reqUrl } }) => {
		const crousName = reqUrl.toString().match(/feed\/(?<crousName>.+?)\//)?.groups?.crousName;
		if (!crousName) {
			return HttpResponse.text(crousWebServiceFeed);
		} else {
			const fileName = reqUrl.toString().split("/").pop();
			let filePath, fileData;
			if (fileName?.endsWith(".xml")) {
				filePath = `${mockFolderPath}/${crousName}/${fileName}`;
				fileData = await readFileSync(filePath);
				return HttpResponse.xml(fileData.toString());
			} else if (fileName?.endsWith(".json")) {
				filePath = `${mockFolderPath}/${crousName}/restaurant.json`;
				fileData = await readFileSync(filePath);
				return HttpResponse.json(fileData.toString(), {
					headers: {
						"Content-Type": "application/json",
					},
				});
			} else {
				throw new Error("File extension not supported");
			}
		}
	}),
];

const server = setupServer(...handlers);
export default server;
