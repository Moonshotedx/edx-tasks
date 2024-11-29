import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { chat } from "../lib/makima";
import { z } from "zod";

export const generateInpirationalMessage = schemaTask({
  id: "inspire-student",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    aspiring_companies: z.array(z.string()),
    aspiring_job_roles: z.array(z.string()),
  }),

  run: async (payload, { ctx }) => {
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

export const generateCareerProgress = schemaTask({
  id: "get-career-progress",
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    // aspiring_companies: z.array(z.string()),
    aspiring_job_roles: z.array(z.string()),
    projects_done: z.array(z.any()),
    education_experiences: z.array(z.any()),
    certifications: z.array(z.any()),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Payload", { payload, ctx });
    const res = await chat({
      agent: "interview-coach",
      content: `Hey need help generating the current career progress for ${payload.name}.

Here is the students current details:
${JSON.stringify(payload, null, 2)}

Use the above details to generate a list of aspiring job roles and the progress the user has made towards becoming a professional in that role.

The response must be in the following json format:
\`\`\`
{
  aspiring_job_roles: {
    role: string;
    progress: number; // 0-100 to how close the user is to being a professional based on the complexity of their projects done and education.
    message: string; // A message to the user on how they can improve their progress towards becoming a professional in the role or any other suggestions.
  }[]
}
\`\`\`
`,
      name: "mentor",
    });

    logger.log("Response", { res });

    return res;
  },
});
