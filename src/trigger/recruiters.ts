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
    logger.log("Received job description", { job_description: payload.job_description });

    // Use an LLM to parse the raw job description into structured data
    const res = await chat({
      agent: "job-description-parser",
      content: `Parse the following job description and convert it into the structured format. Remember the organisation key should populate the organisation value and label of the target organisation which recruiter is trying to post the job to:
Job Description: ${payload.job_description}

Return the response in the following JSON format, ensuring all keys are included (use empty values if no data is found):
{
  "organisation": {
    "value": "",  // The organisation's ID to which the recruiter wants to post the job
    "label": ""   // The organisation's name to which the recruiter wants to post the job.
  },
  "title": "",
  "description": [
    {
      "id": "",  // Can be empty
      "type": "paragraph",
      "props": {
        "textColor": "default",
        "backgroundColor": "default",
        "textAlignment": "left"
      },
      "content": [
        {
          "type": "text",
          "text": "",
          "styles": {}
        }
      ],
      "children": []
    }
  ],
  "job_type": "",  // Should be "full-time", "part-time", or "internship"
  "requirements": "",
  "application_deadline": "",  // Format: YYYY-MM-DDTHH:mm:ssZ
  "meta_data": {
    "experience": "",
    "faqs": [
      {
        "order": 0,
        "question": "",
        "answer": ""
      }
    ],
    "skills": [
      {
        "order": 0,
        "value": ""
      }
    ],
    "stages": [
      {
        "order": 0,
        "title": "",
        "description": "",
        "tips": "",
        "status": "",
        "duration": "",
        "resources": []
      }
    ],
    "resources": [
      {
        "order": 0,
        "title": "",
        "description": "",
        "url": "",
        "type": ""
      }
    ],
    "start_date": {
      "type": ""  // Should be "Immediate" or "Future"
    },
    "compensation": {
      "type": "",  // Should be "paid" or "unpaid"
      "frequency": "",  // Should be "yearly" or "monthly" based on the prompt
      "salary_type": "fixed",  // Defaulted to "fixed"
      "fixed_salary": 0,  // For fixed compensation
      "salary_range": {
        "min": 0,
        "max": 0  // For ranges when applicable
      }
    }
  },
  "target_org_id": 0  // Should be an integer
}`,
    });

    logger.log("LLM response", { response: res });
    // Define the schema for validation
    const schema = z.object({
      organisation: z.object({
        value: z.string().optional(), // Organisation ID
        label: z.string().optional(), // Organisation name
      }),
      title: z.string().optional(),
      description: z.array(
        z.object({
          id: z.string().optional(),
          type: z.literal("paragraph"),
          props: z.object({
            textColor: z.literal("default"),
            backgroundColor: z.literal("default"),
            textAlignment: z.literal("left"),
          }),
          content: z.array(
            z.object({
              type: z.literal("text"),
              text: z.string(),
              styles: z.object({}).optional(),
            })
          ),
          children: z.array(z.unknown()),
        })
      ),
      job_type: z.enum(["full-time", "part-time", "internship"]),
      requirements: z.string().optional(),
      application_deadline: z
        .string()
        .refine((date) => !isNaN(Date.parse(date)), {
          message:
            "Invalid date format, must be in ISO format: YYYY-MM-DDTHH:mm:ssZ",
        }),
      meta_data: z.object({
        experience: z.string().optional(),
        faqs: z.array(
          z.object({
            order: z.number(),
            question: z.string(),
            answer: z.string(),
          })
        ),
        skills: z.array(
          z.object({
            order: z.number(),
            value: z.string(),
          })
        ),
        stages: z.array(
          z.object({
            order: z.number(),
            title: z.string(),
            description: z.string(),
            tips: z.string(),
            status: z.string(),
            duration: z.string(),
            resources: z.array(z.unknown()),
          })
        ),
        resources: z.array(
          z.object({
            order: z.number(),
            title: z.string(),
            description: z.string(),
            url: z.string(),
            type: z.string(),
          })
        ),
        start_date: z.object({
          type: z.enum(["Immediate", "Future"]),
        }),
        compensation: z.object({
          type: z.enum(["paid", "unpaid"]),
          frequency: z.enum(["yearly", "monthly"]),
          salary_type: z.literal("fixed"),
          fixed_salary: z.number(),
          salary_range: z.object({
            min: z.number(),
            max: z.number(),
          }),
        }),
      }),
      target_org_id: z.number(),
    });

    // Parse and validate the response
    const parsedResponse = JSON.parse(res);
    try {
      schema.parse(parsedResponse);
      logger.log("Validated response successfully", {
        validatedResponse: parsedResponse,
      });
      return parsedResponse;
    } catch (e) {
      logger.error("Validation failed", { error: e });
      throw new Error("LLM response did not match the expected schema");
    }
  },
});
