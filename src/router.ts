import { Router, Request, Response, NextFunction } from "express";
import setupRouter from "./crousRoutes";
import { Namespace } from "socket.io";
import CrousAPI from "./crousApi";

const router = Router();
router.use(function (req: Request, res: Response, next: NextFunction) {
	if (CrousAPI.isLoaded) next();
	else {
		res.status(425).send("API starting, please wait...");
	}
});

// router.get("/", (req, res) => {
// 	let dirName = __dirname.split("\\");
// 	dirName.pop();
// 	res.sendFile(dirName.join("\\") + "/static/index.html");
// });

function getCrousRouter({ workspace }: { workspace: Namespace }): Router {
	router.use("/", setupRouter(workspace));
	return router;
}

export default getCrousRouter;
