/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger, schemaTask } from "@trigger.dev/sdk/v3"
import axios from "axios"
import { z } from "zod"

import { duck_duck } from "./recommend-news"

const recommendProjects = z.object({
  profile: z.any(),
  search_terms: z.array(z.string()).optional(),
})

const dify_key = process.env.DIFY_PROJECT_REC_FLOW

export const recommendProjectsTask = schemaTask({
  id: "recommend-projects",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  queue: duck_duck,
  maxDuration: 300,
  schema: recommendProjects,

  run: async (payload) => {
    if (!dify_key) {
      logger.error("DIFY_PROJECT_REC_FLOW is not set in the environment")
    }

    logger.log("recommendProjects task started", { payload })

    // Placeholder for the actual implementation
    const res = await generateProjects(payload.profile)

    logger.log("Generated profile", { res })

    return res
  },
})

type Project = {
  title: string
  description: string
  resources: string[]
}

interface ApiResponse {
  task_id: string
  workflow_run_id: string
  data: {
    id: string
    workflow_id: string
    status: string
    outputs: {
      data: string
    }
    error: null | string
    elapsed_time: number
    total_tokens: number
    total_steps: number
    created_at: number
    finished_at: number
  }
}

async function generateProjects(
  profile?: any,
  search_terms?: string[]
): Promise<any> {
  const data = {
    inputs: {
      profile: JSON.stringify(profile || {}),
      search_terms,
    },
    response_mode: "blocking",
    user: "trigger",
  }

  try {
    const response = await axios.post(
      "https://dify.xcelerator.co.in/v1/workflows/run",
      data,
      {
        headers: {
          Authorization: `Bearer ${dify_key}`,
          "Content-Type": "application/json",
        },
      }
    )
    logger.log("API call successful", { response: response.data })
    const apiResponse: ApiResponse = response.data
    const response_data: {
      projects: Project[]
    } = JSON.parse(apiResponse.data.outputs.data)

    const responseSchema = z.object({
      projects: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          resources: z.array(z.string()),
        })
      ),
    })

    const parsedOutput = responseSchema.parse(response_data)

    // Validate each resource link and remove dead links
    const validProjects = await Promise.all(
      parsedOutput.projects.map(async (project) => {
        const validResources = await Promise.all(
          project.resources.map(async (resource) => {
            try {
              await axios.get(resource)
              return resource
            } catch (error) {
              logger.error("Invalid resource link", { resource, error })
              return null
            }
          })
        )
        return {
          ...project,
          resources: validResources.filter((resource) => !!resource),
        }
      })
    )

    // Remove projects that don't have any valid links
    const filteredProjects = validProjects.filter(
      (project) => project.resources.length > 0
    )

    // Throw an error if fewer than 3 projects remain
    if (!filteredProjects.length) {
      throw new Error("Insufficient projects with valid links")
    }

    return { ...parsedOutput, projects: filteredProjects }
  } catch (error) {
    logger.error("Error making API call", { error })
    throw error
  }
}
