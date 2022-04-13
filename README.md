<p>
  <img alt="Version" src="https://api.gouv.fr/images/api-logo/logo-cnous.png" align="right"/>
  <h1 align="left">Crous Api</h1>
</p>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0-blue.svg?cacheSeconds=2592000" />
  <a href="https://le-roux-nard.github.io/crous-api/" target="_blank">
    <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
  </a>
  <a href="#" target="_blank">
    <img alt="License: ISC" src="https://img.shields.io/badge/License-ISC-yellow.svg" />
  </a>
  <br/>
  <br/>
</p>

> Cette API a été conçue lors d'un semestre d'études au CEGEP de Matane suite à un échange avec l'IUT de Laval, France.
<br/>
Elle permet la récupération de toutes les données fournies par l'État français et liées aux CROUS. 
<br/>
Les données suivantes sont ainsi accessibles : 
<br/>
* Les Restaurants et leurs menus (si communiqué)
* Les Résidences
* Les Actualités

Les structures de données sont disponibles dans la documention fournie, soit via l'url [prout](), soit via l'endpoint `/docs`

⚠ *Seuls les restaurants et les menus sont disponibles dans un format JSON correct, les données étant récupérées au format HTML il est compliqué de déterminer un pattern pour les deux derniers types de données*

## Install

```sh
npm install
```

## Usage

#### Standalone

```sh
npm run start
```

#### Module

```ts
import express from "express";
import setupRouter from "./router";

const app = express();
const crousRouter = setupRouter(socketIoNamespace);
app.use("myPath", crousRouter);
app.listen(process.env.PORT ?? 8080);
```

### **Special Thing :**
The API will take around 2 minutes to initialize and any request on it before end of initialization will result in `425 - Api Starting, please wait...`

## Author

👤 **Le_Roux-Nard**

<!-- -   Website: ... -->
-   Github: [@le-roux-nard](https://github.com/le-roux-nard)

## Show your support

You can give a 🌟

---

_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
