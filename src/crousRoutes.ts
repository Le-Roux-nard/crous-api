import { Request, Router, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { CronJob } from "cron";

import * as Swagger from "swagger-ui-express";
import { Namespace, Server, Socket } from "socket.io";

import CrousAPI, { replacer } from "./crousApi";
import { DataAvailabilityChecker } from "./customMiddlewares";
import { ClasseDonneeCrous, Restaurant } from "./crousClasses";

const allSockets: Map<string, CustomSocketData> = new Map();

const crousApi: CrousAPI = new CrousAPI();

const router: Router = Router();
let wssWorkspace: Namespace;

const swaggerOptions = {
	customCss: ".swagger-ui .topbar { display: none }",
	customSiteTitle: "Documentation",
	customfavIcon: "/favicon.ico",
};
const swaggerDoc = require("../swagger.json");

router.use("/docs", Swagger.serve, Swagger.setup(swaggerDoc, swaggerOptions));

const apiRateLimit = rateLimit({
	windowMs: 1 * 1000, // 1 seconds
	max: 1, // Limit each IP to 1 requests per `window` (here, per 1 seconds)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	skip: (request: Request, response: Response) =>
		wssWorkspace.allSockets().then((socketList: Set<string>) => {
			return socketList.has(request?.headers["x-socket-id"]?.toString() ?? "");
		}),
});

router.use("/", apiRateLimit);

// router.use(function (req: Request, res: Response, next: any) {
// 	console.log("Time:", Date.now());
// 	next();
// });

router.get("/:nomCrous", (req: Request, res: Response) => {
	let { nomCrous } = req.params;
	try {
		//utilisation du parse/stringify pour éviter l'envoi d'objet vide à cause des Maps de types custom dans des Maps de types custom
		res.json(JSON.parse(JSON.stringify(crousApi.getCrous(nomCrous), replacer)));
	} catch (e) {
		res.status(404).send(`crous ${nomCrous} not found`);
	}
});

router.get(
	"/:nomCrous/:ressource",
	(req: Request, res: Response, next: NextFunction) => {
		new DataAvailabilityChecker().check(req, res, next);
	},
	(req: Request, res: Response) => {
		let { nomCrous, ressource } = req.params;
		try {
			res.json(crousApi.getCrous(nomCrous).donnees.get(ressource));
		} catch (e) {
			res.status(404).send(`ressource ${req.params.ressource} not found in crous ${nomCrous}`);
		}
	}
);

router.get(
	"/:nomCrous/:ressource/:ressourceId",
	(req, res, next) => {
		new DataAvailabilityChecker().check(req, res, next);
	},
	(req: Request, res: Response) => {
		let { nomCrous, ressource, ressourceId } = req.params;
		try {
			let crous = crousApi.getCrous(nomCrous);
			let askedRessource = crousApi
				.getCrous(nomCrous)
				.donnees.get(ressource)
				?.find((data: ClasseDonneeCrous) => data.id == ressourceId);
			res.json(askedRessource?.toJson());
		} catch (e) {
			res.status(404).send(`${ressource} with id ${req.params.ressource} not found in crous ${nomCrous}`);
		}
	}
);

function setupRouter(workspace: Namespace): Router {
	wssWorkspace = workspace;

	wssWorkspace.on("connection", (socket: Socket, ...args) => {
		console.log("New socket connection");
		allSockets.set(socket.id, { followingRestaurants: [] });
		setupSocketFunctions(socket);
	});

	//setup socket functions
	const setupSocketFunctions = (socket: Socket) => {
		socket.on("subscribeToMenu", async (idRestaurant) => {
			let socketData = allSockets.get(socket.id);
			let localRestaurant = await crousApi.getRestaurant(idRestaurant);
			if (socketData && localRestaurant != null) {
				// ajoute le nouveau restaurant à la liste des restaurants suivis via un Set pour garantir l'unicité des identifiants
				socketData.followingRestaurants = [...new Set([...(socketData.followingRestaurants ?? []), idRestaurant])];
			}
		});

		socket.on("unsubscribeToMenu", (idRestaurant) => {
			let socketData = allSockets.get(socket.id);
			if (socketData) {
				// supprime le restaurant de la liste des restaurants suivis
				if (socketData.followingRestaurants && socketData.followingRestaurants.length > 0) {
					socketData.followingRestaurants = socketData.followingRestaurants?.filter((id : string) => id != idRestaurant);
				}
			}
		});

		socket.onAny((eventName, ...args) => {
			console.log(eventName, ...args);
		});

		socket.on("disconnect", () => {
			console.log("Socket disconnected");
			allSockets.delete(socket.id);
		});
	};

	//cronjob pour envoyer les menus à 11h tous les jours (si il y a un menu)
	const cronJob = new CronJob(
		"0 0 11 * * *",
		() => {
			for (let [socketId, socket] of wssWorkspace.sockets) {
				let followingRestaurants = allSockets.get(socketId)?.followingRestaurants ?? [];
				if (followingRestaurants.length > 0) {
					for (const restaurantId of followingRestaurants) {
						new CrousAPI().getRestaurant(restaurantId).then((restaurant: Restaurant | null) => {
							if (restaurant && restaurant.getTodayMenu()) {
								socket.emit("menuSubscription", restaurantId, restaurant?.getTodayMenu()?.toJson());
							}
						});
					}
				}
			}
		},
		null,
		true,
		"Europe/Paris"
	);

	return router;
}

router.get("*", (req: Request, res: Response) => {
	res.redirect("/");
});

export default setupRouter;
