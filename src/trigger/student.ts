import { logger, task } from "@trigger.dev/sdk/v3";
import { chat } from "../lib/makima";
import JobManager from "../lib/cache";

type InspirePayload = {
  name: string;
  email: string;
  aspiring_companies: string[];
  aspiring_job_roles: string[];
};

export const generateInpirationalMessage = task({
  id: "inspire-student",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  async init() {
    const jobManager = new JobManager();
    await jobManager.connect();
    return { jobManager };
  },
  run: async (payload: InspirePayload, { ctx, init }) => {
    // check if job is already running for this email

    const jobManager = init?.jobManager as JobManager;

    const jobs = await jobManager.getJobs(payload.email);

    const existing = jobs.find((job) => job.task === "inspire-student");

    if (existing) {
      if (existing.running) {
        logger.log("Job already running", { existing });
        return {
          message: "Job already running",
        };
      }
      logger.log("Job already ran", { existing });
      return existing.output;
    }

    await jobManager.setJob(payload.email, {
      run_id: ctx.run.id,
      running: true,
      task: "inspire-student",
    });
    logger.log("Payload", { payload, ctx });
    const res = await chat({
      agent: "interview-coach",
      content: `Hey need help generating some one liner instpirational messages for ${payload.name}.

The response must be in the following json format:
\`\`\`
{
  message: string; // max 100 characters
}
\`\`\`

This message should be based on the user's aspiring companies and job roles.
`,
      name: "mentor",
    }).catch((err) => {
      jobManager.updateJob(payload.email, ctx.run.id, {
        running: false,
        error: err.message,
      });
      throw err;
    });

    logger.log("Response", { res });

    await jobManager.updateJob(payload.email, ctx.run.id, {
      running: false,
      output: res,
    });

    return res;
  },
});
