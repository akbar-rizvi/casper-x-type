import express from "express";
const router = express.Router();
import user from "./user"
import auth from './auth'


const defaultRoutes = [
  {
    path: "/user",
    route: user,
  },{
    path: "/auth",
    route: auth,
  }
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

router.get("/", async(req, res):Promise<any> => {
  return res.send("Server is running");
});


export default router;
