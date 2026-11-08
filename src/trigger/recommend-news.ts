/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createHash } from "crypto"
import {
  idempotencyKeys,
  logger,
  queue,
  runs,
  schemaTask,
} from "@trigger.dev/sdk"
import { SafeSearchType } from "duck-duck-scrape"
import { z } from "zod"

import { robustNewsSearch } from "../utils/duck-duck-wrapper"

/**
 * Schema for the recommendNews task payload.
 * Defines the structure and validation rules for the input data.
 */
const recommendNews = z.object({
  search_terms: z.array(z.string(), {
    description: "An array of search terms to find relevant news articles.",
  }),
  // Default to 5 results, max 25
  limit: z.number().min(1).max(25).default(5),
})

/**
 * Schema for the searchNewsByTerm task payload.
 * Defines the structure for searching news by a single term.
 */
const searchNewsByTerm = z.object({
  term: z.string({
    description: "The search term to use when querying for news articles.",
  }),
  // No limit specified here, we'll get all results for the term
})

/**
 * Define a queue for DuckDuckGo tasks.
 * This allows us to control concurrency and prioritize tasks.
 */
export const duck_duck = queue({
  name: "duck_duck",
  concurrencyLimit: 10,
})

/**
 * Child task to search news for a single term with idempotency.
 * This task encapsulates the logic for querying news for a specific term
 * and leverages idempotency keys to prevent duplicate searches.
 */
export const searchNewsByTermTask = schemaTask({
  id: "search-news-by-term",
  retry: {
    maxAttempts: 5,
    factor: 1.8,
    randomize: true,
  },
  queue: duck_duck,
  maxDuration: 60,
  schema: searchNewsByTerm,

  run: async (payload) => {
    logger.log("searchNewsByTerm task started", { payload })

    const allResults: NewsItem[] = []
    const processedUrls = new Set<string>()

    try {
      // Use a single search term
      const term = payload.term
      logger.log(`Searching news for term: ${term}`)

      // Call our robust news search implementation instead of the original
      const newsResults = await robustNewsSearch(term, {
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

        allResults.push(...newsItems)
      }

      // Return empty array instead of throwing an error when no results found
      if (allResults.length === 0) {
        logger.warn(`No news items found for search term: ${term}`, { term })
      }

      return allResults
    } catch (error) {
      logger.error("Error searching for news", { term: payload.term, error })
      throw error
    }
  },
})

/**
 * Main task to recommend news articles based on a list of search terms.
 * This task orchestrates the process of querying news for multiple terms,
 * deduplicating results, and ensuring even representation from each term.
 */
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

    // Generate idempotency keys for each search term
    const termKeys = await Promise.all(
      payload.search_terms.map(async (term) => {
        const key = await idempotencyKeys.create(
          generateHash({
            term,
            env: process.env.NODE_ENV !== "production" ? "test" : undefined,
          })
        )
        return { term, key }
      })
    )

    logger.log("Generated idempotency keys", { termKeys })

    // Trigger search tasks for each term
    const searchTasks = await Promise.all(
      termKeys.map(({ term, key }) =>
        searchNewsByTermTask.trigger(
          {
            term,
          },
          {
            idempotencyKey: key,
            idempotencyKeyTTL:
              process.env.NODE_ENV !== "production" ? "10m" : "1d",
            tags: [`term:${term}`],
          }
        )
      )
    )

    logger.log("All search tasks triggered")

    // Wait for all tasks to complete
    const results = await Promise.all(
      searchTasks.map((task) =>
        runs.poll(task, {
          pollIntervalMs: 1000,
        })
      )
    )

    // Store results by term for even distribution
    const termResults: Record<string, NewsItem[]> = {}
    const processedUrls = new Set<string>()

    // Process and deduplicate each result set by term
    results.forEach((result, index) => {
      const term = payload.search_terms[index]
      termResults[term] = []

      if (result.output && Array.isArray(result.output)) {
        result.output.forEach((item: NewsItem) => {
          if (item.url && !processedUrls.has(item.url)) {
            processedUrls.add(item.url)
            termResults[term].push(item)
          }
        })
      }

      logger.log(
        `Found ${termResults[term].length} unique news for term: ${term}`
      )
    })

    // Calculate how many items to take from each term for even distribution
    const termsWithResults = Object.keys(termResults).filter(
      (term) => termResults[term].length > 0
    )

    if (termsWithResults.length === 0) {
      throw new Error("No news found for any search terms")
    }

    // Calculate items per term, ensuring even distribution with minimum 1 item per term
    const itemsPerTerm = Math.max(
      1,
      Math.floor(payload.limit / termsWithResults.length)
    )

    // Calculate remainder to distribute
    let remainingItems = payload.limit - itemsPerTerm * termsWithResults.length

    // Evenly distribute news from each term
    const finalResults: NewsItem[] = []

    termsWithResults.forEach((term) => {
      // Take base number of items for this term
      const itemsToTake = itemsPerTerm + (remainingItems > 0 ? 1 : 0)
      if (remainingItems > 0) remainingItems--

      // Get news items for this term, limited to the calculated number
      const termNews = termResults[term].slice(0, itemsToTake)
      finalResults.push(...termNews)

      logger.log(`Taking ${termNews.length} items from term: ${term}`)
    })

    // Final safety check to ensure we don't exceed the limit
    const limitedResults = finalResults.slice(0, payload.limit)

    logger.log("Generated news recommendations", {
      count: limitedResults.length,
      termsWithoutResults: payload.search_terms.filter(
        (term) => !termsWithResults.includes(term)
      ),
      distribution: termsWithResults.map(
        (term) =>
          `${term}: ${termResults[term].length} found, ${
            limitedResults.filter((item) =>
              termResults[term].some((termItem) => termItem.url === item.url)
            ).length
          } used`
      ),
    })

    return limitedResults
  },
})

/**
 * Defining our type based on the expected structure from search results
 */
type NewsItem = {
  title: string
  description: string
  url: string
  source: string
  date?: number
  image?: string
}

/**
 * Helper function to generate a SHA256 hash for idempotency keys.
 * This ensures that the keys are unique and consistent for the same input.
 * @param payload The object to hash.
 * @returns A hexadecimal representation of the SHA256 hash.
 */
function generateHash(payload: object) {
  const hash = createHash("sha256")
  hash.update(JSON.stringify(payload))
  return hash.digest("hex")
}
