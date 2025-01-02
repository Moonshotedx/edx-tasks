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
    logger.log("Received job description", {
      job_description: payload.job_description,
    });

    // Use an LLM to parse the raw job description into structured data
    const res = await chat({
      agent: "job-description-parser",
      content: `Parse the following job description and convert it into the structured format. Remember the organisation key should populate the organisation value and label of the target organisation which recruiter is trying to post the job to:
Job Description: ${payload.job_description}

Return the response in the following JSON format, ensuring all keys are included (use empty values if no data is found):
{
  {
  "type": "object",
  "properties": {
    "organisation": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "label": { "type": "string" }
      },
      "required": ["value", "label"]
    },
    "title": { "type": "string" },
    "description": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "type": { "type": "string", "enum": ["paragraph"] },
          "props": {
            "type": "object",
            "properties": {
              "textColor": { "type": "string", "enum": ["default"] },
              "backgroundColor": { "type": "string", "enum": ["default"] },
              "textAlignment": { "type": "string", "enum": ["left"] }
            },
            "required": ["textColor", "backgroundColor", "textAlignment"]
          },
          "content": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": { "type": "string", "enum": ["text"] },
                "text": { "type": "string" },
                "styles": { "type": "object" }
              },
              "required": ["type", "text"]
            }
          },
          "children": { "type": "array", "items": {} }
        },
        "required": ["id", "type", "props", "content"]
      }
    },
    "job_type": { "type": "string", "enum": ["full-time", "part-time", "internship"] },
    "requirements": { "type": "string" },
    "application_deadline": { "type": "string", "format": "date-time" },
    "meta_data": {
      "type": "object",
      "properties": {
        "experience": { "type": "string" },
        "faqs": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "order": { "type": "integer" },
              "question": { "type": "string" },
              "answer": { "type": "string" }
            },
            "required": ["order", "question", "answer"]
          }
        },
        "skills": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "order": { "type": "integer" },
              "value": { "type": "string" }
            },
            "required": ["order", "value"]
          }
        },
        "stages": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "order": { "type": "integer" },
              "title": { "type": "string" },
              "description": { "type": "string" },
              "tips": { "type": "string" },
              "status": { "type": "string" },
              "duration": { "type": "string" },
              "resources": {
                "type": "array",
                "items": { "type": "string" }
              }
            },
            "required": ["order", "title", "description", "tips", "status", "duration", "resources"]
          }
        },
        "resources": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "order": { "type": "integer" },
              "title": { "type": "string" },
              "description": { "type": "string" },
              "url": { "type": "string" },
              "type": { "type": "string" }
            },
            "required": ["order", "title", "description", "url", "type"]
          }
        },
        "start_date": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["Immediate", "Future"] }
          },
          "required": ["type"]
        },
        "compensation": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["paid", "unpaid"] },
            "frequency": { "type": "string", "enum": ["yearly", "monthly"] },
            "salary_type": { "type": "string", "default": "fixed", "enum": ["fixed"] },
            "fixed_salary": { "type": "integer", "default": 0 },
            "salary_range": {
              "type": "object",
              "properties": {
                "min": { "type": "integer" },
                "max": { "type": "integer" }
              },
              "required": ["min", "max"]
            }
          },
          "required": ["type", "frequency", "salary_type", "fixed_salary", "salary_range"]
        }
      },
      "required": ["experience", "faqs", "skills", "stages", "resources", "start_date", "compensation"]
    },
    
  },
  "required": ["organisation", "title", "description", "job_type", "requirements", "application_deadline", "meta_data"]
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
