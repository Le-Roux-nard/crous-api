import { NextFunction, Request, Response } from "express";
import { Crous } from "./crousClasses";
import CrousAPI from "./crousApi";

export class DataAvailabilityChecker implements CustomMiddleware {
	async check(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			let { nomCrous, ressource, ressourceId } = req.params;

			let crousData: Crous | undefined = await new CrousAPI().getCrous(nomCrous);
			if (crousData != undefined && crousData?.donneesDisponibles?.get(ressource)) {
				if (ressourceId) {
					let ressourceData = crousData?.donnees.get(ressource)?.find((data) => data.id == ressourceId);
					if (ressourceData) {
						next();
					} else {
						res.status(404).send(`${ressource} with id '${ressourceId}' not found in crous ${nomCrous}`);
					}
				} else {
					next();
				}
			} else {
				res.status(412).send(`Precondition Failed : '${ressource}' is not available for this crous (${nomCrous})`);
			}
		} catch (e) {
			res.status(500).send((<Error>e).message);
		}
	}
}
