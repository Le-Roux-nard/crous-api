import {
	Actualites,
	ActualitesDataBase,
	Crous,
	DonneesCrous,
	DonnesDisponiblesPourCrous,
	RestaurantMenuDataBase,
	Opening,
	Position,
	Residence,
	ResidenceDataBase,
	Restaurant,
	Menu,
} from "./crousClasses";
import he from "he";
const axios = require("axios");
const convert = require("xml-js");

String.prototype.snake = function (this: string) {
	return (this.escape().match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g) ?? [])
		.map((x: String) => x.toLowerCase())
		.join("_");
};

String.prototype.escape = function (this: string) {
	var accents = "ÀÁÂÃÄÅàáâãäåÒÓÔÕÕÖØòóôõöøÈÉÊËèéêëðÇçÐÌÍÎÏìíîïÙÚÛÜùúûüÑñŠšŸÿýŽž'";
	var accentsOut = "AAAAAAaaaaaaOOOOOOOooooooEEEEeeeeeCcDIIIIiiiiUUUUuuuuNnSsYyyZz ";
	let s = this.split("");
	let strLen = s.length;
	let i, x;
	for (i = 0; i < strLen; i++) {
		if (this[i] !== "'") {
			if ((x = accents.indexOf(this[i])) != -1) {
				s[i] = accentsOut[x];
			}
		} else {
			s.splice(i, 1);
		}
	}
	return s.join("");
};

String.prototype.formatBaseDeDonnees = function (this: string) {
	return this.trim().toLowerCase().snake();
};

/**
 * Convert a `Map` to a standard
 * JS object recursively.
 *
 * @param {Map} map to convert.
 * @returns {Object} converted object.
 */
function map_to_object(map: Map<any, any>): JSON {
	const out = Object.create(null);
	map.forEach((value, key) => {
		key = key.toString();
		if (value instanceof Map) {
			out[key] = map_to_object(value);
		} else {
			out[key] = value;
		}
	});
	return out;
}

export function replacer(key: any, value: any) {
	if (value instanceof DonnesDisponiblesPourCrous) {
		return true;
	} else if (value instanceof Map) {
		let obj = map_to_object(value);
		return obj;
		// return Array.from(value.entries()); // or with spread: value: [...value]
	} else {
		return value;
	}
}

String.prototype.generateDatasetLink = function (this: string) {
	return `https://www.data.gouv.fr/fr/datasets/r/${this}`;
};

const promises: Promise<any>[] = [];

class CrousAPI {
	static isLoaded: boolean = false;
	private static lienPourListeCrous: String[] = [
		"https://www.data.gouv.fr/api/2/datasets/5548d35cc751df0767a7b26c/resources/?page=1&type=main&page_size=-1", //Actualites
		"https://www.data.gouv.fr/api/2/datasets/5548d994c751df32e0a7b26c/resources/?page=1&type=main&page_size=-1", //Résidences
		"https://www.data.gouv.fr/api/2/datasets/55f28fe088ee386774a46ec2/resources/?page=1&type=main&page_size=-1", //Restaurants
		"https://www.data.gouv.fr/api/2/datasets/55f27f8988ee383ebda46ec1/resources/?page=1&type=main&page_size=-1", //menus
	];

	static cache: CrousAPI | null = null;

	private listeCrous: Map<String, Crous> = new Map<String, Crous>();

	private async initialisationAPI() {
		for (const lien of CrousAPI.lienPourListeCrous) {
			let promise = new Promise(async (resolve) => {
				let { data: reponse } = await axios({
					method: "get",
					url: lien,
					transformResponse: [(data: string) => JSON.parse(data)?.data],
				});

				//#region Récupération des données
				for (const ressource of reponse) {
					let result = /^(?<type>\S+).+(?:CROUS\s)(?:(?:de|d')\s?)?(?<nomCrous>.+)/gim.exec(ressource.title);
					if (result && result.groups) {
						let nom: String = result.groups.nomCrous;
						let tempType: string = result.groups.type == "Lieux" ? "Restaurants" : result.groups.type;
						let type: String = tempType.endsWith("s") || tempType.endsWith("x") ? tempType : tempType + "s";
						let nomCrous = { affichage: nom, baseDeDonnees: nom.formatBaseDeDonnees() };

						if (!this.listeCrous.get(nomCrous.baseDeDonnees)) {
							this.listeCrous.set(
								nomCrous.baseDeDonnees,
								new Crous(
									nomCrous.affichage,
									new Map().set(type.formatBaseDeDonnees(), new DonnesDisponiblesPourCrous(type, ressource.id)),
									new DonneesCrous(undefined, undefined, undefined)
								)
							);
						}
						this.listeCrous
							.get(nomCrous.baseDeDonnees)
							?.donneesDisponibles.set(type.formatBaseDeDonnees(), new DonnesDisponiblesPourCrous(type, ressource.id));
					}
				}
				resolve(undefined);
			});
			promises.push(promise);
			//#endregion
		}
		await Promise.all(promises);
		while (promises.length > 0) {
			promises.pop();
		}

		//#region Récupération des datasets
		console.time("récupération datasets");
		for (const crousData of this.listeCrous.values()) {
			for (const [type, { id }] of crousData.donneesDisponibles.entries()) {
				let promise = new Promise(async (resolve) => {
					switch (type) {
						case "actualites": {
							await this.fetchDataset(id.generateDatasetLink(), (data: xml2jonResult) => {
								crousData.donnees.set(
									type,
									data.root.article.map(
										(articleDb: ActualitesDataBase) =>
											new Actualites(
												articleDb._attributes.id,
												articleDb._attributes.titre,
												articleDb._attributes.date,
												articleDb._attributes.category,
												articleDb._attributes.image,
												articleDb._cdata,
												articleDb._attributes.type
											)
									)
								);
							});
							break;
						}
						case "residences": {
							await this.fetchDataset(id.generateDatasetLink(), (data: xml2jonResult) => {
								crousData.donnees.set(
									type,
									data.root.residence.map(
										(residenceDb: ResidenceDataBase) =>
											new Residence(
												residenceDb._attributes.id,
												residenceDb._attributes.title,
												residenceDb._attributes.short_desc,

												// residenceDb._attributes.lat,
												// residenceDb._attributes.lon,
												// residenceDb._attributes.zone,
												// residenceDb.address?._text ?? "",
												new Position(
													residenceDb._attributes.lat,
													residenceDb._attributes.lon,
													residenceDb._attributes.zone,
													residenceDb.address?._text
												),

												residenceDb.infos?._text ?? "",
												residenceDb.services?._text ?? "",
												residenceDb.contact?._text ?? "",
												residenceDb.mail?._text ?? "",
												residenceDb.phone?._text ?? "",
												residenceDb.internetUrl?._text ?? "",
												residenceDb.appointmentUrl?._text ?? "",
												residenceDb.virtualVisitUrl?._text ?? "",
												residenceDb.bookingUrl?._text ?? "",
												residenceDb.troubleshootingUrl?._text ?? ""
											)
									)
								);
							});
							break;
						}
						case "restaurants": {
							await this.fetchDataset(id.generateDatasetLink(), (data: xml2jonResult) => {
								let listeRestaurants: Restaurant[] = [];
								for (const restaurant of data.root.resto) {
									let tempResto: Restaurant = new Restaurant(crousData.nomCrous);
									tempResto.nom = restaurant._attributes.title;
									tempResto.short_desc = restaurant._attributes.short_desc;
									tempResto.opening = restaurant._attributes.opening?.split(",")?.map((e: string) => new Opening(e)) ?? [];
									tempResto.type = restaurant._attributes.type;
									tempResto.id = restaurant._attributes.id;

									for (let arr of restaurant.infos._cdata.replace(/<img.*?>/gi, "").split("<h2>")) {
										arr = arr.replace("</p>", "");
										let tmp = arr.split("</h2><p>");
										if (tmp[1]) {
											restaurant[tmp[0]] = tmp[1];

											while (restaurant[tmp[0]].includes("&#")) {
												restaurant[tmp[0]] = he.decode(restaurant[tmp[0]]);
											}
											restaurant[tmp[0]] = restaurant[tmp[0]]
												.replace(/<br\/>/gi, "\n")
												.split("\n\n")
												.join("\n");
										}
									}
									tempResto.position = new Position(
										restaurant._attributes.lat,
										restaurant._attributes.lon,
										restaurant._attributes.zone,
										restaurant["Localisation"]
									);
									tempResto.horaires = restaurant["Horaires"];
									tempResto.pratique = restaurant["Pratique"];
									tempResto.paiements = restaurant["Paiements possibles"]?.split(/\n(?:\ )*/gi)?.map((e: string) => e.trim()) ?? [];
									tempResto.paiements[tempResto.paiements.length - 1] == "" && tempResto.paiements.pop();

									tempResto.moyen_acces = restaurant["Moyen d'accès"];
									listeRestaurants.push(tempResto);
								}
								crousData.donnees.restaurants = listeRestaurants;
							});
							break;
						}
						case "menus": {
							await this.fetchDataset(id.generateDatasetLink(), async (data: xml2jonResult) => {
								for (const resto of <RestaurantMenuDataBase[]>data.root.resto) {
									if (resto?.menu?.length && resto?.menu?.length > 0) {
										let restaurantMenus: Menu[] = [];

										for (const menu of resto?.menu ?? []) {
											let date = menu._attributes.date;
											let content = menu._cdata;

											for (const serviceData of content.match(/<h2>.*?<\/h2><h4>.*?<\/h4>.*?(?=<h4>|<h2>|$)(?=<h2>|$)/g) ||
												[]) {
												let tmpMenu: { [key: string]: any } = {};
												let [, service] = serviceData?.match(/(?:<h2>)(.*?)(?:<\/h2>)/) ?? [];
												tmpMenu = {};
												tmpMenu.date = date;
												tmpMenu.restaurantId = resto._attributes.id;
												tmpMenu.horaire = service;
												tmpMenu.plats = new Map<String, string[]>();

												let differentFoodTypesArray =
													serviceData?.match(/<h4>(?<typePlat>.*?)<\/h4>(?<data>.*?)(?=<h4>|$)/g) ?? [];

												for (const foodList of differentFoodTypesArray) {
													let [, foodCategory] = foodList?.match(/(?:<h4>)(.*?)(?:<\/h4>)/) ?? [];
													let food = foodList
														.replace(/<\/?ul.*?>|<h4>.*?<\/h4>/g, "")
														.split(/<\/li>|<li>/g)
														.filter(String);
													tmpMenu.plats.set(foodCategory, food);
												}

												let parentRestaurant = await (<Restaurant>(
													crousData.donnees.restaurants?.find((r) => r.id === resto._attributes.id)
												));
												if (parentRestaurant) {
													parentRestaurant.addMenu(new Menu(tmpMenu.date, tmpMenu.horaire, tmpMenu.plats));
												}
											}
										}
									}
								}
							});
							break;
						}
					}
					resolve(id);
				});

				promises.push(promise);
			}
		}
		await Promise.all(promises);
		console.timeEnd("récupération datasets");
		CrousAPI.isLoaded = true;
		//#endregion
	}

	constructor() {
		if (CrousAPI.cache === null) {
			CrousAPI.cache = this;
			this.initialisationAPI();
		} else {
			return CrousAPI.cache;
		}
	}

	public getCrous(nomCrous: String): Crous {
		let crousData = this.listeCrous.get(nomCrous);
		if (!crousData) {
			throw new Error("Le Crous demandé n'existe pas");
		}
		return crousData;
	}

	public async fetchDataset(link: string, onFinish: Function) {
		let { data: reponse } = await axios({
			method: "get",
			url: link,
			transformResponse: [
				(data: string) => {
					try {
						return JSON.parse(convert.xml2json(data, { compact: true, spaces: 4 }));
					} catch (error) {
						throw new Error(`Une erreur est survenue lors de la transformation des données via le lien ${link}.\n${error}`);
					}
					// finally {
					// 	return null;
					// }
				},
			],
		});
		onFinish(reponse);
	}

	public async getRestaurant(restaurantId: string): Promise<Restaurant | null> {
		for await (const crous of this.listeCrous.values()) {
			if (crous.donneesDisponibles.has("restaurants")) {
				let restaurant = crous.donnees?.restaurants?.find((resto) => resto.id === restaurantId);
				if (restaurant) {
					return <Restaurant>restaurant;
				}
			}
		}
		return null;
	}
}

export default CrousAPI;
