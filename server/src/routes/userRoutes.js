import { Router } from "express";
import {
	getLeaderboard,
	getMyGamificationSummary,
	getMyPointsLedger,
	getUserById,
	listUsers,
} from "../controllers/userController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, authorize("official", "admin"), listUsers);
router.get("/leaderboard", authenticate, authorize("citizen", "official", "admin"), getLeaderboard);
router.get("/me/gamification-summary", authenticate, authorize("citizen", "official", "admin"), getMyGamificationSummary);
router.get("/me/points-ledger", authenticate, authorize("citizen", "official", "admin"), getMyPointsLedger);
router.get("/:id", authenticate, authorize("citizen", "official", "admin"), getUserById);

export default router;
