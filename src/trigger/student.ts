import { logger, task } from "@trigger.dev/sdk/v3";
import { chat } from "../lib/makima";

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
  run: async (payload: InspirePayload, { ctx }) => {
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

Make sure the message is personal and specific to the above student.
`,
      name: "mentor",
    });

    logger.log("Response", { res });

    return res;
  },
});
