import { Router } from "express";
import { getMe, login, registerCitizen } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/register", registerCitizen);
router.post("/login", login);
router.get("/me", authenticate, getMe);

export default router;
