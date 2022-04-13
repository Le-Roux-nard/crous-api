declare interface String {
	snake(): string;
	escape(): string;
	formatBaseDeDonnees(): string;
	generateDatasetLink(): string;
}

declare interface CustomMiddleware {
	check(req: any, res: any, next: any): void;
}

declare interface xml2jonResult {
	_declaration: {
		_attributes: {
			version: string;
			encoding: string;
		};
	};
	root: any;
}

declare interface CustomSocketData {
	followingRestaurants?: Array<string>;
}
