import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { runEscalationSweep } from "./services/escalationService.js";

async function bootstrap() {
  await connectDatabase();
  const runSweep = async () => {
    try {
      const result = await runEscalationSweep();
      if (result.modifiedCount > 0) {
        console.log(`Escalation sweep updated ${result.modifiedCount} complaints`);
      }
    } catch (error) {
      console.error("Escalation sweep failed", error.message);
    }
  };

  await runSweep();
  setInterval(runSweep, 5 * 60 * 1000);

  app.listen(env.port, () => {
    console.log(`API server running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
