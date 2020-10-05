import { Router } from "express";

import User from "./app/models/User";

const routes = new Router();

routes.get("/", (req, res) => {
  res.json({ message: "Hello Beth Cabelo e Estética" });
});

export default routes;
