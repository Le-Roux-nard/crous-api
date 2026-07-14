import { Request, Router, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { CronJob } from "cron";

import * as Swagger from "swagger-ui-express";
import { Namespace, Socket } from "socket.io";

import swaggerDoc from "./swagger.json" with { type: "json" };

import CrousAPI from "./crousApi.js";
import { CrousData, Crous, CustomSocketData, CustomHolidays, ResourceManager, Restaurant } from "crous-api-types";
import { HolidayZone } from "crous-api-types/types/HolidayZones";
import HolidaysManager from "./utils/HolidaysManager.js";
import PublicHolydaysManager from "./utils/publicHolydayManager.js";
import { byEnum } from "./utils/Utils.js";

const allSockets: Map<string, CustomSocketData> = new Map();

const crousApi: CrousAPI = CrousAPI.getInstance();

const router: Router = Router();
let wssWorkspace: Namespace;

const swaggerOptions = {
	customCss: ".swagger-ui .topbar { display: none }",
	customSiteTitle: "Documentation",
	customfavIcon: "/favicon.ico",
};

router.use("/docs", Swagger.serveFiles(swaggerDoc, swaggerOptions), Swagger.setup(swaggerDoc));

const apiRateLimit = rateLimit({
	windowMs: 1 * 1000, // 1 seconds
	max: 10, // Limit each IP to 1 requests per `window` (here, per 1 seconds)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	skip: (request) => {
		let socketId: string | undefined = request?.headers["x-socket-id"]?.toString();
		return !!socketId && wssWorkspace.sockets.has(socketId);
	},
});

router.use("/", apiRateLimit);

router.get("/", (req: Request, res: Response) => {
	res.send(crousApi.getCrousList());
});

router.get("/:resource(residences|restaurants|actualites)/:id?", async (req: Request, res: Response) => {
	const { resource, id } = req.params;
	const { search, by } = req.query;

	const searchString = search?.toString();
	const byString: byEnum | string | undefined = by?.toString();
	if (!!id && !!searchString && !!byString) {
		return res.status(400).send("You can't provide both id and search parameters");
	} else if (!!searchString && !!byString) {
		if (!(byString in byEnum)) {
			return res.status(400).send(`Invalid search by parameter "${byString}", valid values are ${Object.keys(byEnum).join(", ")}`);
		}
		const searchResult = await crousApi.searchResourceByName(resource, byString as byEnum, searchString);
		if (!searchResult) return res.status(404).send(`No ${resource} found with ${byString} ${searchString}`);
		else res.json(searchResult);
		//
	} else if ((!!searchString && !byString) || (!searchString && !!byString)) {
		return res.status(400).send("You must provide both search and by parameters");
		//
	} else if (!!id) {
		const resourceItem = await crousApi.getResource(resource, id);
		if (!resourceItem) return res.status(404).send(`No ${resource} found with id ${id}`);
		else res.json(resourceItem);
		//
	} else {
		const resourceList = crousApi.listResource(resource);
		if (!resourceList) return res.status(404).send(`No ${resource} found`);
		else res.json(resourceList);
		//
	}
	return;
});

router.get("/:nomCrous", (req: Request, res: Response) => {
	const { nomCrous } = req.params;
	try {
		res.json(crousApi.getCrous(nomCrous));
	} catch (e) {
		res.status(404).send(`${nomCrous} is not a valid Crous name`);
	}
});

router.get("/:nomCrous/:resource", (req: Request, res: Response) => {
	const { nomCrous, resource } = req.params;
	try {
		const crous = crousApi.getCrous(nomCrous);
		if (!crous) throw new Error("Crous not found");
		const payload = crous[resource as keyof Crous] as ResourceManager<CrousData>;
		if (!payload) throw new Error("resource not found");
		res.json(payload);
	} catch (e) {
		res.status(404).send(`resource ${req.params.resource} not found in crous ${nomCrous}`);
	}
});

router.get("/:nomCrous/:resource/:resourceId", async (req: Request, res: Response) => {
	const { nomCrous, resource, resourceId } = req.params;
	try {
		const crous = crousApi.getCrous(nomCrous);
		if (!crous) throw new Error("Crous not found");
		const payload = crous[resource as keyof Crous] as ResourceManager<CrousData>;
		if (!payload) throw new Error("resource not found");
		const resourceItem = await payload.get(resourceId);
		if (!resourceItem) throw new Error("resource item not found");
		else res.json(resourceItem);
	} catch (e) {
		console.error(e);
		res.status(404).send(`${resource} with id ${req.params.resourceId} not found in crous ${nomCrous}`);
	}
});

function setupRouter(workspace: Namespace): Router {
	wssWorkspace = workspace;

	wssWorkspace.on("connection", (socket: Socket) => {
		const parsedQuery = JSON.parse(JSON.stringify(socket.handshake.query));
		const socketSettings: CustomSocketData = parsedQuery as CustomSocketData;
		if (socketSettings.followingRestaurants && Array.isArray(socketSettings.followingRestaurants)) {
			socketSettings.followingRestaurants = [...new Set(socketSettings.followingRestaurants)];
		} else if (typeof socketSettings.followingRestaurants === "string") {
			socketSettings.followingRestaurants = (socketSettings.followingRestaurants as string).split(",");
		} else {
			socketSettings.followingRestaurants = [];
		}
		allSockets.set(socket.id, socketSettings);
		setupSocketFunctions(socket);
		const followedRestaurants = [];
		for (const socketS of allSockets.values()) {
			followedRestaurants.push(socketS.followingRestaurants ?? []);
		}
		console.debug(`Now following ${new Set(followedRestaurants.flat()).size} restaurants`);
	});
	return router;
}

//setup socket functions
const setupSocketFunctions = (socket: Socket) => {
	socket.on("subscribeToMenu", async (idRestaurant: string) => {
		let socketData = allSockets.get(socket.id);
		let localRestaurant = await crousApi.getResource("restaurants", idRestaurant);
		if (socketData && localRestaurant != null) {
			// ajoute le nouveau restaurant à la liste des restaurants suivis via un Set pour garantir l'unicité des identifiants
			socketData.followingRestaurants = [...new Set([...(socketData.followingRestaurants ?? []), idRestaurant])];
		}
	});

	socket.on("unsubscribeToMenu", (idRestaurant: string) => {
		let socketData = allSockets.get(socket.id);
		if (socketData) {
			// supprime le restaurant de la liste des restaurants suivis
			if (socketData.followingRestaurants && socketData.followingRestaurants.length > 0) {
				socketData.followingRestaurants = socketData.followingRestaurants?.filter((id: string) => id != idRestaurant);
			}
		}
	});

	socket.on("disconnect", () => {
		allSockets.delete(socket.id);
	});
};

//cronjob pour envoyer les menus à 11h tous les jours (si il y a un menu)
const cronJob = new CronJob(
	"0 0 11 * * *",
	async () => {
		const crousApi = CrousAPI.getInstance();
		const holidaysManager = new HolidaysManager();
		await holidaysManager.updateCache();
		await holidaysManager.loadCustomVacances();

		const publicHolydaysManager = new PublicHolydaysManager();
		await publicHolydaysManager.updateCache();

		const holidays = holidaysManager.getStandardVacances();
		const customHolidays = holidaysManager.getCustomVacances() ?? {};
		const publicHolidays = publicHolydaysManager.getPublicHolydays();

		const skipZoneList: (CustomHolidays | HolidayZone)[] = [];

		for (const publicHoliday of publicHolidays) {
			if (publicHoliday.actual) {
				return;
			}
		}

		for (const holiday of holidays.values()) {
			if (holiday.actual && !skipZoneList.includes(holiday.zones)) {
				skipZoneList.push(holiday.zones);
			}
		}
		for (const [zone, holidays] of Object.entries(customHolidays)) {
			for (const holiday of holidays) {
				if (holiday.actual && !skipZoneList.includes(zone as CustomHolidays)) {
					skipZoneList.push(zone as CustomHolidays);
					break;
				}
			}
		}

		for (let [socketId, socket] of wssWorkspace.sockets) {
			const socketData = allSockets.get(socketId);
			const zoneVacances = socketData?.vacancesZones;
			const vacancesCustom = socketData?.vacancesCustom;

			if (!socketData || skipZoneList.includes(zoneVacances!) || skipZoneList.includes(vacancesCustom!)) continue;

			if ((zoneVacances && skipZoneList.includes(zoneVacances)) || (vacancesCustom && skipZoneList.includes(vacancesCustom))) continue;

			const followingRestaurants = socketData?.followingRestaurants;
			if (!!followingRestaurants && followingRestaurants.length > 0) {
				for (const restaurantId of followingRestaurants) {
					const restaurant = (await crousApi.getResource("restaurants", restaurantId)) as Restaurant;
					if (!!restaurant && restaurant.opening[new Date().getDay()] && restaurant.getTodayMenu()) {
						socket.emit("menuSubscription", restaurantId, restaurant?.getTodayMenu());
					}
				}
			}
		}
	},
	null,
	true,
	"Europe/Paris"
);

export default setupRouter;
