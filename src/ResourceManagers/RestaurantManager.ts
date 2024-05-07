import { Restaurant, ResourceManager, Opening, Position } from "crous-api-types";
import { RestaurantJson } from "../classes/RestaurantJSON.js";
import { MenuBuilder } from "../classes/Menu.js";

export default class RestaurantManager extends ResourceManager<Restaurant> {
	searchByName(name: string): Promise<Restaurant[]> {
		return new Promise((resolve) => {
			let matchingRestaurants = this.list.filter((restaurant) => restaurant.nom.trim().toLowerCase().includes(name.trim().toLowerCase()));
			if (matchingRestaurants.length > 0) {
				let perfectMatchIdx = matchingRestaurants.findIndex(
					(restaurant) => restaurant.nom.trim().toLowerCase() === name.trim().toLowerCase()
				);
				//replace perfect match at the beginning of the array
				perfectMatchIdx > -1 && matchingRestaurants.unshift(matchingRestaurants.splice(perfectMatchIdx, 1)[0]);
			}
			resolve(matchingRestaurants);
		});
	}

	add(item: RestaurantJson): void {
		let newRestaurant = new Restaurant(item.id.toString());
		newRestaurant.nom = item.title;
		newRestaurant.short_desc = item.shortdesc;
		newRestaurant.opening = item.opening.split(",").map((o) => new Opening(o));
		newRestaurant.position = new Position(item.lat, item.lon, item.area, item.description);
		newRestaurant.type = item.type;
		newRestaurant.moyen_acces = item.access;
		newRestaurant.contact = item.contact;
		newRestaurant.horaires = item.operationalhours;
		newRestaurant.paiements = item.payment.map((p) => p.name);
		newRestaurant.menus = item.menus
			.map((menuList) => menuList.meal.map((repas) => new MenuBuilder(newRestaurant.id, menuList.date, repas)))
			.flat();

		let existingRestaurantIndex = this.list.findIndex((r) => r.id === item.id.toString());
		if (!existingRestaurantIndex) {
			this.list.concat([newRestaurant]);
		} else {
			this.list[existingRestaurantIndex] = newRestaurant;
		}
	}
}
