import { createHash } from "crypto"
import { idempotencyKeys, logger, runs, schemaTask } from "@trigger.dev/sdk/v3"
import { z } from "zod"
import { chat, searchKnowledgeBase } from "../lib/makima"

type YoutubeMetadata = {
  url: string
  start: number
  title: string
  channel: string
  videoId: string
  duration: number
  description: string
}

const StageSchema = z.object({
  order: z.number().optional(),
  title: z.string(),
  status: z.string().optional(),
  duration: z.string().optional(),
  description: z.string().optional(),
  tips: z.union([z.string(), z.array(z.string())]).optional(),
  resources: z.array(z.unknown()).optional(),
})

export const generateStageInterviewPrep = schemaTask({
  id: "generate-stage-interview-prep",
  retry: { maxAttempts: 5, factor: 1.5, randomize: true },
  maxDuration: 300,
  schema: z.object({
    job: z.object({
      details: z.any(),
    }),
    // stage information from job.details.meta_data.stages[...]
    stage: StageSchema,
    // student is OPTIONAL and used ONLY for suggestions/resources (NOT for MCQs)
    student: z
      .object({
        name: z.string(),
        email: z.string().email(),
        aspiring_job_roles: z.array(z.string()).optional(),
        projects_done: z.array(z.any()).optional(),
        education_experiences: z.array(z.any()).optional(),
        certifications: z.array(z.any()).optional(),
      })
      .optional(),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Stage Prep Payload", { payload, ctx })

    const jobContext = payload.job.details
    const stage = payload.stage

    // MCQs (JOB + STAGE DETAILS ONLY)
    const mcqPrompt = `
You are an interview coach helping candidates prepare for a specific interview stag, generating stage-specific MCQs for interview preparation.

Rules:
- Questions must be directly relevant to BOTH the job role AND this specific interview stage
- Focus on what candidates are typically assessed on during the "${stage.title}" stage
- Include a mix of technical, behavioral, and role-specific questions appropriate for this stage
- DO NOT use any student details for MCQs.
- Each question must have 2-4 options.
- Include a 'hint' and the correct answer via 'correct_index' (0-based).

Return strict JSON:
{
  "mcqs": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],  // 2-4 items
      "correct_index": 0,                                   // number 0..3
      "hint": "string"
    }
  ]
}

Job details:
${JSON.stringify(jobContext, null, 2)}

Stage details:
${JSON.stringify(stage, null, 2)}
`

    const mcqRaw = await chat({
      agent: "interview-coach",
      content: mcqPrompt,
      name: "stage_mcqs",
    })

    const mcqSchema = z.object({
      mcqs: z.array(
          z.object({
            question: z.string(),
            options: z.array(z.string()).min(2).max(4),
            correct_index: z.number().int().min(0).max(3),
            hint: z.string(),
          })
        ).min(5),
    })

    const mcqJson = JSON.parse(mcqRaw)
    const mcqs = mcqSchema.parse(mcqJson).mcqs

    // Resources/Topics/Suggestions (can use student + job + stage)
    const studentSafe = payload.student ?? {}
    const preparePrompt = ` You are an interview coach helping candidates prepare for a specific interview stage, Generate "resources and topics" and "suggestions" for this stage.

Rules:
- Topics must be specifically relevant to BOTH the job requirements AND this interview stage
- Focus on what interviewers typically assess during the "${stage.title}" stage
- Include both technical and soft skills topics as appropriate for the stage
- Resources and topics CAN use job details, stage details, and (optionally) student profile to tailor advice.
- ADD suggestions on what the student can do and update their profile to be better suited for the job, use job and student details for this.
- Keep everything concise and actionable.

Return strict JSON:
{
  "topics": ["string", "..."],             // 3-8 key topics for this stage
  "suggestions": ["string", "..."]         // optional list
}

Job details:
${JSON.stringify(jobContext, null, 2)}

Stage details:
${JSON.stringify(stage, null, 2)}

Student (optional; ignore if not useful):
${JSON.stringify(studentSafe, null, 2)}
`

    const infoRaw = await chat({
      agent: "interview-coach",
      content: preparePrompt,
      name: "stage_info",
    })

    const infoSchema = z.object({
      topics: z.array(z.string()).min(1).optional(),
      suggestions: z.array(z.string()).optional(),
    })
    const info = infoSchema.parse(JSON.parse(infoRaw))

    // search external resources via KB (based on stage + job keywords)
    let resourceSuggestions: YoutubeMetadata[] = []
    try {
      const seed =
        stage.description ||
        (Array.isArray(stage.tips) ? stage.tips.join(", ") : stage.tips) ||
        jobContext?.title ||
        jobContext?.description ||
        ""

      if (seed && String(seed).trim()) {
        const found = await searchKnowledgeBase<YoutubeMetadata>({
          name: "youtube-videos",
          query: JSON.stringify({ stage: stage.title, seed }),
          k: 5,
        })

        const dedup = found.filter((r, i, arr) => {
          const j = arr.findIndex((x) => x.metadata.url === r.metadata.url)
          return i === j
        })
        resourceSuggestions = dedup.map((r) => r.metadata)
      }
    } catch (e) {
      logger.error("KB search failed", { e })
    }

    return {
      stage: {
        title: stage.title,
        order: stage.order ?? null,
      },
      topics: info.topics ?? [],
      suggestions: info.suggestions ?? [],
      mcqs,
      resources: resourceSuggestions,
    }
  },
})

export function generateHash(payload: object) {
  const hash = createHash("sha256")
  hash.update(JSON.stringify(payload))
  return hash.digest("hex")
}
