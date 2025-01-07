import { logger, schemaTask } from "@trigger.dev/sdk/v3"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

import { chat } from "../lib/makima"

// Define the schema
const jobDescriptionSchema = z.object({
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
  application_deadline: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message:
      "Invalid date format, must be in ISO format: YYYY-MM-DDTHH:mm:ss.sssZ",
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
})

// Convert schema to JSON Schema
const jobDescriptionJsonSchema = zodToJsonSchema(jobDescriptionSchema)
const schemaString = JSON.stringify(jobDescriptionJsonSchema, null, 2)

export const parseJobDescription = schemaTask({
  id: "job-description-parser",
  retry: {
    maxAttempts: 3,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    job_description: z.string(), // giving raw job description
  }),

  run: async (payload, { ctx }) => {
    logger.log("Received job description", {
      job_description: payload.job_description,
    })

    // use the schema in the prompt
    const res = await chat({
      agent: "job-description-parser",
      content: `Parse the following job description and convert it into the structured format. Use the JSON schema below to ensure the response adheres to the expected structure, Ensure that "application_deadline" is in ISO 8601 format (e.g., "2025-01-11T06:59:37.000Z").
:
      
      JSON Schema:
      ${schemaString}
      
      Job Description: ${payload.job_description}
      `,
    })

    logger.log("LLM response", { response: res })

    // Parse and validate the response
    const parsedResponse = JSON.parse(res)
    try {
      jobDescriptionSchema.parse(parsedResponse)
      logger.log("Validated response successfully", {
        validatedResponse: parsedResponse,
      })
      return parsedResponse
    } catch (e) {
      logger.error("Validation failed", { error: e })
      throw new Error("LLM response did not match the expected schema")
    }
  },
})
