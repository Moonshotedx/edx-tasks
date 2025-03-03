/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger, queue, schemaTask } from "@trigger.dev/sdk/v3"
import { NewsResult, SafeSearchType, searchNews } from "duck-duck-scrape"
import { z } from "zod"

const recommendNews = z.object({
  search_terms: z.array(z.string()),
  // Default to 5 results, max 10
  limit: z.number().min(1).max(25).default(5),
})

export const duck_duck = queue({
  name: "duck_duck",
  concurrencyLimit: 5,
})

export const recommendNewsTask = schemaTask({
  id: "recommend-news",
  retry: {
    maxAttempts: 10,
    factor: 1.8,
    randomize: true,
  },
  queue: duck_duck,
  maxDuration: 120,
  schema: recommendNews,

  run: async (payload) => {
    logger.log("recommendNews task started", { payload })

    const res = await fetchRelevantNews(payload.search_terms, payload.limit)

    logger.log("Generated news recommendations", { count: res.length })

    return res
  },
})

// Defining our type based on the expected structure from search results
type NewsItem = {
  title: string
  description: string
  url: string
  source: string
  date?: number
  image?: string
}

/**
 * Fetch relevant news based on search terms
 */
async function fetchRelevantNews(
  searchTerms: string[],
  limit: number = 5
): Promise<NewsItem[]> {
  const allResults: NewsItem[] = []
  const processedUrls = new Set<string>()

  try {
    // Process each search term until we have enough results
    for (const term of searchTerms) {
      if (allResults.length >= limit) break

      logger.log(`Searching news for: ${term}`)

      try {
        // Use the dedicated news search API
        const newsResults = await searchNews(term, {
          safeSearch: SafeSearchType.MODERATE,
        })

        if (newsResults.results && newsResults.results.length > 0) {
          // Process and transform news results
          const newsItems = newsResults.results
            .filter((item) => {
              if (!item.url || processedUrls.has(item.url)) {
                return false
              }
              processedUrls.add(item.url)
              return true
            })
            .map((item) => ({
              title: item.title || "Untitled",
              description: item.excerpt || "",
              url: item.url,
              source: item.syndicate || "Unknown Source",
              date: item.date,
              image: item.image,
            }))
            .slice(0, limit - allResults.length)

          allResults.push(...newsItems)
        }
      } catch (err) {
        logger.error("Error searching for news", { term, error: err })
      }
    }

    // If we couldn't find any results, throw an error
    if (allResults.length === 0) {
      throw new Error("No news items found for the given search terms")
    }

    return allResults
  } catch (error) {
    logger.error("Error fetching news", { error })
    throw error
  }
}
