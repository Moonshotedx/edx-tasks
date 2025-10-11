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

export const generateInpirationalMessage = schemaTask({
  id: "inspire-student",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    aspiring_companies: z.array(z.string()),
    aspiring_job_roles: z.array(z.string()),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Payload", { payload, ctx })
    const res = await chat({
      agent: "interview-coach",
      content: `Hey need help generating some one liner instpirational messages for ${payload.name}.


This message should be based on the user's aspiring companies and job roles.

Make sure the message is personal and specific to the above student.

Here is the students current details:
${JSON.stringify(payload, null, 2)}

The response must be in the following json format:
\`\`\`
{
  message: string; // max 100 characters
}
\`\`\`
`,
      name: "mentor",
    })

    logger.log("Raw response", { res })

    // validate the response;
    const responseSchema = z.object({
      message: z.string(),
    })

    const jsonParsed = JSON.parse(res)

    const parsedOutput = responseSchema.parse(jsonParsed)

    return parsedOutput
  },
})

export const generateCareerProgress = schemaTask({
  id: "get-career-progress",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    aspiring_job_roles: z.array(z.string()),
    projects_done: z.array(z.any()),
    education_experiences: z.array(z.any()),
    certifications: z.array(z.any()),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Payload", { payload, ctx })
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
    })

    logger.log("Raw response", { res })

    // validate the response;
    const responseSchema = z.object({
      aspiring_job_roles: z.array(
        z.object({
          role: z.string(),
          progress: z.number(),
          message: z.string(),
        })
      ),
    })

    const jsonParsed = JSON.parse(res)

    const parsedOutput = responseSchema.parse(jsonParsed)

    return parsedOutput
  },
})

export const generateImprovementActionPlan = schemaTask({
  id: "generate-improvement-action-plan",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    aspiring_job_roles: z.array(z.string()),
    projects_done: z.array(z.any()),
    education_experiences: z.array(z.any()),
    certifications: z.array(z.any()),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Payload", { payload, ctx })
    const res = await chat({
      agent: "interview-coach",
      content: `Hey need help generating an improvement action plan for ${payload.name}.

Here is the students current details:
${JSON.stringify(payload, null, 2)}

Use the above details to generate a improvement action plan for the following parts of the student's profile:
1. Skills: Give points on how the student can improve their skills to better match their aspiring job roles/jobs.
2. Experience: Give points on how the student can improve their experience to better match their aspiring job roles/jobs.
3. Network: Give points on how the student can improve their network to better match their aspiring job roles/jobs.
4. Education: Give points on how the student can improve their education to better match their aspiring job roles/jobs **if** they have not already done so.

All of the above keys are optional and can be skipped if the student has already done enough to match their aspiring job roles/jobs in context of that key.

The response must be in the following json format:
\`\`\`
{
  skills?: {
    subtitle: string;
    points: string[];
  },
  experience?: {
    subtitle: string;
    points: string[];
  },
  network?: {
    subtitle: string;
    points: string[];
  },
  education?: {
    subtitle: string;
    points: string[];
  }
}
\`\`\`

NOTE: Subtitle in the above is gonna be shown under the respective key as a subtitle for that catagory of points.
`,
      name: "mentor",
    })

    logger.log("Raw response", { res })

    // validate the response;
    const responseSchema = z.object({
      skills: z
        .object({
          subtitle: z.string(),
          points: z.array(z.string()),
        })
        .optional(),
      experience: z
        .object({
          subtitle: z.string(),
          points: z.array(z.string()),
        })
        .optional(),
      network: z
        .object({
          subtitle: z.string(),
          points: z.array(z.string()),
        })
        .optional(),
      education: z
        .object({
          subtitle: z.string(),
          points: z.array(z.string()),
        })
        .optional(),
    })

    const jsonParsed = JSON.parse(res)

    const parsedOutput = responseSchema.parse(jsonParsed)

    return parsedOutput
  },
})

export const generateRecommendedProjectIdeas = schemaTask({
  id: "generate-recommended-project-ideas",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    aspiring_job_roles: z.array(z.string()),
    projects_done: z.array(z.any()),
    education_experiences: z.array(z.any()),
    certifications: z.array(z.any()),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Payload", { payload, ctx })
    const res = await chat({
      agent: "interview-coach",
      content: `Hey need help generating some project ideas for ${payload.name}.
Here is the students current details:
${JSON.stringify(payload, null, 2)}

Use the above details to generate a list of project ideas that the student can work on to improve their skills and experience to better match their aspiring job roles/jobs.

The response must be in the following json format:
\`\`\`
{
  projects: {
    title: string;
    description: string;
    resources?: string[]; // links to resources that can help the student in building the project.
  }[]
}
\`\`\`
`,
      name: "mentor",
    })

    logger.log("Raw response", { res })

    // validate the response;
    const responseSchema = z.object({
      projects: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          resources: z.array(z.string()).optional(),
        })
      ),
    })

    const jsonParsed = JSON.parse(res)

    const parsedOutput = responseSchema.parse(jsonParsed)

    return parsedOutput
  },
})

export const generateResourceRecommendations = schemaTask({
  id: "generate-resource-recommendations",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    aspiring_job_roles: z.array(z.string()),
    projects_done: z.array(z.unknown()),
    education_experiences: z.array(z.unknown()),
    certifications: z.array(z.unknown()),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Payload", { payload, ctx })

    const [
      resourcesBasedOnJobRoles,
      resourcesBasedOnProjects,
      resourcesBasedOnEducation,
      resourcesBasedOnCertifications,
    ] = await Promise.all([
      Promise.allSettled(
        payload.aspiring_job_roles.map(async (role) => {
          const res = await searchKnowledgeBase<YoutubeMetadata>({
            name: "youtube-videos",
            query: role,
            k: 1,
          })
          if (res.length === 0) {
            throw new Error(`No resources found for ${role}`)
          }
          return res?.[0]
        })
      ),
      Promise.allSettled(
        payload.projects_done.map(async (project) => {
          const res = await searchKnowledgeBase<YoutubeMetadata>({
            name: "youtube-videos",
            query: JSON.stringify(project),
            k: 1,
          })
          if (res.length === 0) {
            throw new Error(`No resources found for ${project}`)
          }
          return res?.[0]
        })
      ),
      Promise.allSettled(
        payload.education_experiences.map(async (education) => {
          const res = await searchKnowledgeBase<YoutubeMetadata>({
            name: "youtube-videos",
            query: JSON.stringify(education),
            k: 1,
          })
          if (res.length === 0) {
            throw new Error(`No resources found for ${education}`)
          }
          return res?.[0]
        })
      ),
      Promise.allSettled(
        payload.certifications.map(async (cert) => {
          const res = await searchKnowledgeBase<YoutubeMetadata>({
            name: "youtube-videos",
            query: JSON.stringify(cert),
            k: 1,
          })
          if (res.length === 0) {
            throw new Error(`No resources found for ${cert}`)
          }
          return res?.[0]
        })
      ),
    ])

    const resources = [
      ...resourcesBasedOnJobRoles
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value),
      ...resourcesBasedOnProjects
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value),
      ...resourcesBasedOnEducation
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value),
      ...resourcesBasedOnCertifications
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value),
    ]

    const duplicateFilteredResources = resources.filter(
      (resource, index, self) => {
        const indexInSelf = self.findIndex(
          (r) => r.metadata.url === resource.metadata.url
        )
        return index === indexInSelf
      }
    )
    return duplicateFilteredResources.map((r) => r.metadata)
  },
})

export const generateStudentPrepPack = schemaTask({
  id: "generate-student-prep-pack",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    aspiring_companies: z.array(z.string()),
    aspiring_job_roles: z.array(z.string()),
    projects_done: z.array(z.any()),
    education_experiences: z.array(z.any()),
    certifications: z.array(z.any()),
  }),

  run: async (payload) => {
    logger.log("env", { env: process.env.NODE_ENV })

    const keys = {
      inspirationalMessage: await idempotencyKeys.create(
        generateHash({
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          name: payload.name,
          env: process.env.NODE_ENV !== "production" ? "test" : undefined,
        })
      ),
      careerProgress: await idempotencyKeys.create(
        generateHash({
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          name: payload.name,
          projects_done: payload.projects_done,
          education_experiences: payload.education_experiences,
          certifications: payload.certifications,
          env: process.env.NODE_ENV !== "production" ? "test" : undefined,
        })
      ),
      improvementActionPlan: await idempotencyKeys.create(
        generateHash({
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          name: payload.name,
          projects_done: payload.projects_done,
          education_experiences: payload.education_experiences,
          certifications: payload.certifications,
          env: process.env.NODE_ENV !== "production" ? "test" : undefined,
        })
      ),
      recommendedProjectIdeas: await idempotencyKeys.create(
        generateHash({
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          name: payload.name,
          projects_done: payload.projects_done,
          education_experiences: payload.education_experiences,
          certifications: payload.certifications,
          env: process.env.NODE_ENV !== "production" ? "test" : undefined,
        })
      ),
      resourceRecommendations: await idempotencyKeys.create(
        generateHash({
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          name: payload.name,
          projects_done: payload.projects_done,
          education_experiences: payload.education_experiences,
          certifications: payload.certifications,
          env: process.env.NODE_ENV !== "production" ? "test" : undefined,
        })
      ),
    }

    logger.log("Idempotency keys generated")

    const [
      inspirationalMessage,
      careerProgress,
      improvementActionPlan,
      recommendedProjectIdeas,
      resourceRecommendations,
    ] = await Promise.all([
      await generateInpirationalMessage.trigger(
        {
          name: payload.name,
          email: payload.email,
          aspiring_companies: payload.aspiring_companies,
          aspiring_job_roles: payload.aspiring_job_roles,
        },
        {
          idempotencyKey: keys.inspirationalMessage,
          idempotencyKeyTTL:
            process.env.NODE_ENV !== "production" ? "10m" : "14d",
        }
      ),
      generateCareerProgress.trigger(
        {
          name: payload.name,
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          projects_done: payload.projects_done,
          education_experiences: payload.education_experiences,
          certifications: payload.certifications,
        },
        {
          idempotencyKey: keys.careerProgress,
          idempotencyKeyTTL:
            process.env.NODE_ENV !== "production" ? "10m" : "14d",
        }
      ),
      generateImprovementActionPlan.trigger(
        {
          name: payload.name,
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          projects_done: payload.projects_done,
          education_experiences: payload.education_experiences,
          certifications: payload.certifications,
        },
        {
          idempotencyKey: keys.improvementActionPlan,
          idempotencyKeyTTL:
            process.env.NODE_ENV !== "production" ? "10m" : "14d",
        }
      ),
      generateRecommendedProjectIdeas.trigger(
        {
          name: payload.name,
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          projects_done: payload.projects_done,
          education_experiences: payload.education_experiences,
          certifications: payload.certifications,
        },
        {
          idempotencyKey: keys.recommendedProjectIdeas,
          idempotencyKeyTTL:
            process.env.NODE_ENV !== "production" ? "10m" : "14d",
        }
      ),
      generateResourceRecommendations.trigger(
        {
          name: payload.name,
          email: payload.email,
          aspiring_job_roles: payload.aspiring_job_roles,
          projects_done: payload.projects_done,
          education_experiences: payload.education_experiences,
          certifications: payload.certifications,
        },
        {
          idempotencyKey: keys.resourceRecommendations,
          idempotencyKeyTTL:
            process.env.NODE_ENV !== "production" ? "10m" : "14d",
        }
      ),
    ])

    logger.log("All tasks triggered")

    const groupPoll = await Promise.all([
      runs.poll(inspirationalMessage, {
        pollIntervalMs: 1000,
      }),
      runs.poll(careerProgress, {
        pollIntervalMs: 2000,
      }),
      runs.poll(improvementActionPlan, {
        pollIntervalMs: 3000,
      }),
      runs.poll(recommendedProjectIdeas, {
        pollIntervalMs: 4000,
      }),
      runs.poll(resourceRecommendations, {
        pollIntervalMs: 5000,
      }),
    ])

    const final = {
      inspirationalMessage: groupPoll[0].output,
      careerProgress: groupPoll[1].output,
      improvementActionPlan: groupPoll[2].output,
      recommendedProjectIdeas: groupPoll[3].output,
      resourceRecommendations: groupPoll[4].output,
    }

    logger.log("All tasks completed", final)

    return final
  },
})

export const generateInterviewPrepQuestionsPerJobDesc = schemaTask({
  id: "generate-interview-prep-per-jd",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    job: z.object({
      details: z.any(),
    }),
    aspiring_job_roles: z.array(z.string()),
    projects_done: z.array(z.unknown()),
    education_experiences: z.array(z.unknown()),
    certifications: z.array(z.unknown()),
  }),
  run: async (payload) => {
    logger.log("Payload", { payload })
    const studentDetails = {
      jobsRolesStudentAspires: payload.aspiring_job_roles,
      projectsDoneByStudent: payload.projects_done,
      educationExperiences: payload.education_experiences,
      certifications: payload.certifications,
    }
    const res = await chat({
      agent: "interview-coach",
      content: `Hey need help generating some project ideas for a student.

Here are some of the details of the student's profile:
${JSON.stringify(studentDetails, null, 2)}

The job details that the student trying to apply to:
${JSON.stringify(payload.job.details, null, 2)}

Based on the details of the provided student profile/resume help generate some interview prep questions that the student can prepare for.
You can also add suggestions on what the student can do and update their profile to be better suited for the job.

The response must be in the following json format:
\`\`\`
{
  questions: {
    question: string;
    answers: [string, string, string];
  }[];
  suggestions?: string[];
}
\`\`\`
`,
      name: "mentor",
    })

    logger.log("Raw response", { res })

    // validate the response;

    const responseSchema = z.object({
      questions: z.array(
        z.object({
          question: z.string(),
          answers: z.array(z.string()),
        })
      ),
      suggestions: z.array(z.string()).optional(),
    })

    const jsonParsed = JSON.parse(res)

    const parsedOutput = responseSchema.parse(jsonParsed)

    const modelSuggestions = parsedOutput

    let resouceSuggestions: YoutubeMetadata[] = []

    // fetch related resources for the student based on the job description
    try {
      const relatedResources = await searchKnowledgeBase<YoutubeMetadata>({
        name: "youtube-videos",
        query: JSON.stringify(payload.job.details),
        k: 5,
      })

      const duplicateFilteredResources = relatedResources.filter(
        (resource, index, self) => {
          const indexInSelf = self.findIndex(
            (r) => r.metadata.url === resource.metadata.url
          )
          return index === indexInSelf
        }
      )

      if (!duplicateFilteredResources.length) {
        throw new Error("No resources found for the job description")
      }

      resouceSuggestions = duplicateFilteredResources.map((r) => r.metadata)
    } catch (error) {
      logger.error("Error fetching resources", { error })
    }

    return {
      modelSuggestions,
      resouceSuggestions,
    }
  },
})

function generateHash(payload: object) {
  const hash = createHash("sha256")
  hash.update(JSON.stringify(payload))
  return hash.digest("hex")
}

// Recommend profile highlights for a given job description
export const recommendProfileHighlightsForJob = schemaTask({
  id: "recommend-profile-highlights-for-job",
  retry: { maxAttempts: 5, factor: 1.5, randomize: true },
  maxDuration: 300,
  schema: z.object({
    job: z.object({
      title: z.string(),
      description: z.string(),
    }),
    student: z.object({
      projects_done: z.array(z.unknown()).default([]),
      work_experiences: z.array(z.unknown()).default([]),
      certifications: z.array(z.unknown()).default([]),
    }),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Payload", { payload, ctx })

    type Lite = { id: string; title?: string; description?: string; organisation?: string }
    const asId = (v: unknown, idx: number) => {
      const o = (v ?? {}) as any
      // id extraction; fall back to stable index if truly missing
      const idRaw = o.id ?? o._id ?? o.key ?? idx
      return String(idRaw)
    }

    const projCatalog: Lite[] = payload.student.projects_done.map((p, i) => ({
      id: asId(p, i),
      title: (p as any)?.title ?? "",
      description: (p as any)?.description ?? "",
      organisation: (p as any)?.organisation ?? (p as any)?.org ?? undefined,
    }))

    const expCatalog: Lite[] = payload.student.work_experiences.map((w, i) => ({
      id: asId(w, i),
      title: (w as any)?.title ?? "",
      description: (w as any)?.description ?? "",
      organisation: (w as any)?.organisation ?? (w as any)?.company ?? undefined,
    }))

    const certCatalog: Lite[] = payload.student.certifications.map((c, i) => ({
      id: asId(c, i),
      title: (c as any)?.title ?? "",
      description: (c as any)?.description ?? "",
      organisation: (c as any)?.organisation ?? (c as any)?.issuer ?? undefined,
    }))

    const prompt = `
        You are ranking a student's existing projects, experiences, and certifications for a target job.

        Rules:
        - ONLY choose from the catalogs below. Do NOT invent or modify items.
        - Return the chosen items by their "id" from the catalogs, with an optional "reason".
        - Pick the most relevant 3–6 per category (or fewer if there aren't enough).
        - Never include titles/descriptions in the response—only ids and reason. We'll hydrate ids ourselves.

Job details:
${JSON.stringify(payload.job, null, 2)}

Catalogs (choose ONLY from these):
{
  "projects": ${JSON.stringify(projCatalog, null, 2)},
  "experiences": ${JSON.stringify(expCatalog, null, 2)},
  "certifications": ${JSON.stringify(certCatalog, null, 2)}
}

Return JSON in EXACTLY this shape:
{
  "job_title": string,
  "job_description": string,
  "recommended": {
    "projects": [{"id": string, "reason"?: string}],
    "experiences": [{"id": string, "reason"?: string}],
    "certifications": [{"id": string, "reason"?: string}]
  }
}
`

    const raw = await chat({
      agent: "interview-coach",
      content: prompt,
      name: "mentor",
    })

    logger.log("Raw response", { raw })

    // Validate the model response (ids only)
    const responseSchema = z.object({
      job_title: z.string(),
      job_description: z.string(),
      recommended: z.object({
        projects: z.array(z.object({ id: z.string(), reason: z.string().optional() })),
        experiences: z.array(z.object({ id: z.string(), reason: z.string().optional() })),
        certifications: z.array(z.object({ id: z.string(), reason: z.string().optional() })),
      }),
    })

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      logger.error("Failed to JSON.parse model output", { error, raw })
      throw error
    }

    const validated = responseSchema.parse(parsed)

    const mapById = <T extends Record<string, any>>(arr: T[]) =>
      new Map(arr.map((x, i) => [String((x as any)?.id ?? (x as any)?._id ?? (x as any)?.key ?? i), x]))

    const projMap = mapById(payload.student.projects_done as any[])
    const expMap = mapById(payload.student.work_experiences as any[])
    const certMap = mapById(payload.student.certifications as any[])

    // Hydrate ids to full objects; attach the model reason as __ai_reason
    const hydrate = (ids: { id: string; reason?: string }[], m: Map<string, any>) =>
      ids
        .map(({ id, reason }) => {
          const full = m.get(id)
          if (!full) return null
          return { ...full, __ai_reason: reason }
        })
        .filter(Boolean) as any[]

    const hydrated = {
      job_title: validated.job_title,
      job_description: validated.job_description,
      recommended: {
        projects: hydrate(validated.recommended.projects, projMap),
        experiences: hydrate(validated.recommended.experiences, expMap),
        certifications: hydrate(validated.recommended.certifications, certMap),
      },
    }

    return hydrated
  },
})
