import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { chat } from "../lib/makima";
import { z } from "zod";

export const parseJobDescription = schemaTask({
  id: "job-description-parser",
  retry: {
    maxAttempts: 3,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    job_description: z.string(), // Input: Raw job description as a string
  }),

  run: async (payload, { ctx }) => {
    console.log("Received job description", { job_description: payload.job_description });

    // Use an LLM to parse the raw job description into structured data
    const res = await chat({
      agent: "job-description-parser",
      content: `Parse the following job description and convert it into the structured format remember the organisation key should populate the organisation value  and label of the target organisation which recruiter is trying to post job to:Job Description: ${payload.job_description}

Return the response in the following JSON format, ensuring all keys are included (use empty values if no data is found):
`
    });

    logger.log("LLM response", { response: res });
    return JSON.parse(res);


  },
});
