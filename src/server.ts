import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import setupRouter from "./crousRoutes";
import CrousAPI from "./crousApi";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(function (req, res, next) {
	if (CrousAPI.isLoaded) next();
	else {
		res.status(425).send("API starting, please wait...");
	}
});

app.get("/", (req, res) => {
	let dirName = __dirname.split("\\");
	dirName.pop();
	res.send("Hello World");
});

let port = process.env.PORT ?? 8080;
httpServer.listen(port, () => {
	console.log(`Crous API started on port ${port}`);

	let crousPath = "/crous";

	let crousWssWorkspace = io.of(crousPath);
	app.use(crousPath, setupRouter(crousWssWorkspace));

	let crous = new CrousAPI();
});