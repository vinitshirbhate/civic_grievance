import { Router } from "express";
import { getMe, login, registerCitizen, verifyAadhaar, verifyOtp, upload } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/verify-aadhaar", upload.single("aadhaarZip"), verifyAadhaar);
router.post("/verify-otp", verifyOtp);

router.post("/register", registerCitizen);
router.post("/login", login);
router.get("/me", authenticate, getMe);

export default router;
