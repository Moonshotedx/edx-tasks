import { logger, schemaTask } from "@trigger.dev/sdk"
import { AxiosError } from "axios"
import { Client } from "youtubei"
import { z } from "zod"

import MakimaKB from "../lib/kb"
import { searchKnowledgeBase } from "../lib/makima"

export const searchRelaventYoutubeVidosTask = schemaTask({
  id: "search-youtube-kb",
  retry: {
    maxAttempts: 4,
    factor: 1.2,
    randomize: true,
  },
  schema: z.object({
    query: z.string(),
    k: z.number().default(5),
  }),

  run: async (payload) => {
    const results = await searchKnowledgeBase<{
      url: string
      start: number
      title: string
      channel: string
      videoId: string
      duration: number
      description: string
    }>({
      name: "youtube-videos",
      query: payload.query,
      k: payload.k,
    })

    return results
  },
})

// Initialize MakimaKB client
const kb = new MakimaKB()

export const addYoutubeVideoToKnowledgeBaseTask = schemaTask({
  id: "add-youtube-video-kb",
  retry: {
    maxAttempts: 4,
    factor: 1.2,
    randomize: true,
  },
  schema: z.object({
    kbName: z.string().default("youtube-videos"),
    url: z.string().url(),
  }),

  run: async (payload) => {
    const youtube = new Client() // Initialize YouTube client

    // Extract video ID from the URL
    const videoIdMatch = payload.url.match(
      /(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandalsResorts#\w\/\w\/.*\/))([^\/&\?]*)/
    )?.[1]

    if (!videoIdMatch) {
      logger.error("Could not extract video ID from URL", { url: payload.url })
      throw new Error("Invalid YouTube URL: Could not extract video ID.")
    }

    const videoId = videoIdMatch

    logger.info("Fetching video details", { videoId })

    try {
      const videoDetails = await youtube.getVideo(videoId)

      if (!videoDetails) {
        logger.error("Failed to fetch video details", { videoId })
        throw new Error("Could not fetch video details.")
      }

      const captions = await videoDetails.captions?.get()

      if (!captions) {
        logger.warn("No captions available for video", { videoId })
        throw new Error("Could not fetch captions for the video.")
      }

      logger.info("Fetched video details and captions", {
        title: videoDetails.title,
        captionsCount: captions.length,
      })

      const details = {
        title: videoDetails.title,
        description: videoDetails.description || "",
        channel: videoDetails.channel?.name || "Unknown",
        videoId: videoDetails.id,
        thumbnail: videoDetails.thumbnails?.reduce((prev, curr) =>
          prev.width > curr.width ? prev : curr
        )?.url,
        transcript: captions,
      }

      const documents = captions.map((caption) => ({
        content: caption.text,
        metadata: {
          start: caption.start,
          duration: caption.duration,
          title: details.title,
          description: details.description,
          channel: details.channel,
          videoId: details.videoId,
          thumbnails: details.thumbnail,
          url: payload.url,
        },
      }))

      const filteredDocuments = documents.filter(
        (doc) => doc.content.trim().length > 0
      )

      logger.info("Adding documents to knowledge base", {
        documentsCount: filteredDocuments.length,
      })

      await kb.addDocumentsToKnowledgeBase(payload.kbName, filteredDocuments)

      logger.info("Successfully added documents to knowledge base", {
        kbName: payload.kbName,
        videoId,
      })

      return {
        success: true,
        videoId,
        documentsCount: filteredDocuments.length,
      }
    } catch (e) {
      const error = e as AxiosError
      logger.error("Error processing YouTube video", {
        videoId,
        error: error.response?.data ?? error.message,
      })
      throw new Error(
        "An error occurred while processing the YouTube video. Please check the URL and try again."
      )
    }
  },
})
