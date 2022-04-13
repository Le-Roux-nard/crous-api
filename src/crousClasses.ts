import CrousAPI from "./crousApi";
import moment from "moment";

export class Crous {
	nomCrous: String;
	donneesDisponibles: Map<string, DonnesDisponiblesPourCrous>;
	donnees: DonneesCrous;
	constructor(nomCrous: String, donneesDisponibles: Map<string, DonnesDisponiblesPourCrous>, donnees: DonneesCrous) {
		this.nomCrous = nomCrous;
		this.donneesDisponibles = donneesDisponibles;
		this.donnees = donnees;
	}
}

export class DonnesDisponiblesPourCrous {
	type: String;
	id: String;
	constructor(type: String, id: String) {
		this.type = type;
		this.id = id;
	}

	toJson() {
		return true;
	}
}

export class DonneesCrous {
	actualites: ClasseDonneeCrous[] | undefined;
	restaurants: ClasseDonneeCrous[] | undefined;
	residences: ClasseDonneeCrous[] | undefined;
	constructor(
		actualites: ClasseDonneeCrous[] | undefined,
		restaurants: ClasseDonneeCrous[] | undefined,
		residences: ClasseDonneeCrous[] | undefined
	) {
		this.actualites = actualites;
		this.restaurants = restaurants;
		this.residences = residences;
	}

	get(ressource: string): ClasseDonneeCrous[] | undefined {
		switch (ressource) {
			case "actualites":
				return this.actualites;
			case "restaurants":
				return this.restaurants;
			case "residences":
				return this.residences;
			default:
				throw new Error(`Type ${ressource} inconnu`);
		}
	}

	set(type: string, data: ClasseDonneeCrous[]) {
		switch (type) {
			case "actualites":
				this.actualites = data;
				break;
			case "restaurants":
				this.restaurants = data;
				break;
			case "residences":
				this.residences = data;
				break;
			default:
				throw new Error(`Type ${type} inconnu`);
		}
	}
}

export interface ClasseDonneeCrous {
	id: String;
	toJson(): any;
}

export class Restaurant implements ClasseDonneeCrous {
	parentCrous: String;
	nom: String;
	short_desc: String;
	opening: Opening[];
	position: Position;
	type: String;
	id: String;
	contact: String;
	horaires: String;
	moyen_acces: String;
	pratique: String;
	paiements: String[];
	menus: Menu[] = [];

	constructor(parentCrous: String) {
		this.parentCrous = parentCrous.formatBaseDeDonnees();
		this.nom = "";
		this.short_desc = "";
		this.opening = [];
		this.position = new Position();
		this.type = "";
		this.id = "";
		this.contact = "";
		this.horaires = "";
		this.moyen_acces = "";
		this.pratique = "";
		this.paiements = [];
	}

	addMenu(menu: Menu) {
		this.menus.push(menu);
	}

	getTodayMenu(): Menu | undefined {
		return this.menus.find((menu) => menu.isToday());
	}

	toJson() {
		return {
			nom: this.nom,
			short_desc: this.short_desc,
			opening: this.opening,
			position: this.position,
			type: this.type,
			id: this.id,
			contact: this.contact,
			horaires: this.horaires,
			moyen_acces: this.moyen_acces,
			pratique: this.pratique,
			paiements: this.paiements,
			menus: this.menus.map((menu) => menu.toJson()),
		};
	}
}

export class Opening {
	matin: boolean;
	midi: boolean;
	soir: boolean;
	constructor(txt: string) {
		if (txt.length != 3) {
			throw new Error("Format n'est pas correct");
		}
		txt.charAt(0) == "0" ? (this.matin = false) : (this.matin = true);
		txt.charAt(1) == "0" ? (this.midi = false) : (this.midi = true);
		txt.charAt(2) == "0" ? (this.soir = false) : (this.soir = true);
	}
}

export class Position {
	lat: Number;
	lon: Number;
	zone: String;
	localisation: String;
	constructor(lat: Number = 0, lon: Number = 0, zone: String = "", localisation: String = "") {
		this.lat = lat;
		this.lon = lon;
		this.zone = zone;
		this.localisation = localisation;
	}
}

export class Actualites implements ClasseDonneeCrous {
	id: String;
	titre: String;
	date: String;
	category: String;
	image: String;
	content: String;
	type: string;
	constructor(id: String, titre: String, date: String, category: String, image: String, content: String, type: string) {
		this.id = id;
		this.titre = titre;
		this.date = date;
		this.category = category;
		this.image = image;
		this.content = content;
		this.type = type;
	}
	toJson() {
		return {
			id: this.id,
			titre: this.titre,
			date: this.date,
			category: this.category,
			image: this.image,
			content: this.content,
			type: this.type,
		};
	}
}

export interface ActualitesDataBase {
	_attributes: {
		id: string;
		titre: string;
		date: string;
		category: string;
		image: string;
		type: string;
	};
	_cdata: string;
}

export class Residence implements ClasseDonneeCrous {
	id: string;
	name: string;
	short_desc: string;
	position: Position;
	infos: string;
	services: string;
	contact: string;
	mail: string;
	phone: string;
	websiteUrl: string;
	appointmentUrl: string;
	virtualVisitUrl: string;
	bookingUrl: string;
	troubleshootingUrl: string;

	constructor(
		id: string,
		name: string,
		short_desc: string,

		// lat: number,
		// lon: number,
		// zone: string,
		// address: string,
		position: Position,

		infos: string,
		services: string,
		contact: string,
		mail: string,
		phone: string,
		websiteUrl: string,
		appointmentUrl: string,
		virtualVisitUrl: string,
		bookingUrl: string,
		troubleshootingUrl: string
	) {
		this.id = id;
		this.name = name;
		this.short_desc = short_desc;

		// this.lat = lat;
		// this.lon = lon;
		// this.zone = zone;
		// this.address = address;
		this.position = position;

		this.infos = infos;
		this.services = services;
		this.contact = contact;
		this.mail = mail;
		this.phone = phone;
		this.websiteUrl = websiteUrl;
		this.appointmentUrl = appointmentUrl;
		this.virtualVisitUrl = virtualVisitUrl;
		this.bookingUrl = bookingUrl;
		this.troubleshootingUrl = troubleshootingUrl;
	}

	toJson() {
		return {
			id: this.id,
			name: this.name,
			short_desc: this.short_desc,
			position: this.position,
			infos: this.infos,
			services: this.services,
			contact: this.contact,
			mail: this.mail,
			phone: this.phone,
			websiteUrl: this.websiteUrl,
			appointmentUrl: this.appointmentUrl,
			virtualVisitUrl: this.virtualVisitUrl,
			bookingUrl: this.bookingUrl,
			troubleshootingUrl: this.troubleshootingUrl,
		};
	}
}

export interface ResidenceDataBase {
	_attributes: {
		id: string;
		title: string;
		short_desc: string;
		lat: number;
		lon: number;
		zone: string;
	};
	infos: {
		_text: string;
	};
	services: {
		_text: string;
	};
	contact: {
		_text: string;
	};
	address: {
		_text: string;
	};
	mail: {
		_text: string;
	};
	phone: {
		_text: string;
	};
	openingHours: {};
	internetUrl: {
		_text: string;
	};
	appointmentUrl: {
		_text: string;
	};
	virtualVisitUrl: {
		_text: string;
	};
	bookingUrl: {
		_text: string;
	};
	troubleshootingUrl: {
		_text: string;
	};
}

export class Menu {
	date: string;
	horaire: string;
	plats: Map<String, string[]>;

	constructor(date: string, horaire: string, plats: Map<String, string[]>) {
		this.date = date;
		this.horaire = horaire;
		this.plats = plats;
	}

	toJson() {
		let tmpPlats: { [key: string]: any } = {};

		for (const [key, value] of this.plats.entries()) {
			tmpPlats[key.toString()] = value;
			// console.log(key, value);
		}
		return {
			date: this.date,
			horaire: this.horaire,
			plats: tmpPlats,
		};
	}

	isToday(): unknown {
		return moment(Date.now()).format('YYYY-MM-DD') === this.date;
	}
}

export interface RestaurantMenuDataBase {
	_attributes: {
		id: string;
	};
	menu?: MenuDataBase[];
}

export interface MenuDataBase {
	_attributes: {
		date: string;
	};
	_cdata: string;
}
