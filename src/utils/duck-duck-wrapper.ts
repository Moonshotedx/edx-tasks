import { logger } from "@trigger.dev/sdk/v3"
import {
  NewsSearchOptions,
  NewsSearchResults,
  searchNews as originalSearchNews,
} from "duck-duck-scrape"
import needle, { NeedleOptions } from "needle"

/**
 * Custom implementation to get VQD when the original method fails
 * @param query The search query
 * @returns Promise with the VQD string
 */
async function getVQD(query: string): Promise<string> {
  try {
    // Normalize the query for the URL
    const normalizedQuery = encodeURIComponent(query.trim())
    // Use duckduckgo.com instead of links.duckduckgo.com which seems more reliable
    const url = `https://duckduckgo.com/?q=${normalizedQuery}&ia=web`

    const response = await needle("get", url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      follow_max: 5,
      follow_redirect: true,
    })

    if (!response.body || typeof response.body !== "string") {
      throw new Error("Empty or invalid response from DuckDuckGo")
    }

    // Extract VQD using regex
    const VQD_REGEX = /vqd="([^"]+)"/
    const match = VQD_REGEX.exec(response.body)

    if (!match || match.length < 2) {
      throw new Error("Unable to extract VQD from response")
    }

    return match[1]
  } catch (error) {
    logger.error("Failed to get VQD", { error })
    throw error
  }
}

/**
 * Wrapper for searchNews that handles VQD errors
 */
export async function searchNewsWithRetry(
  query: string,
  options?: NewsSearchOptions,
  needleOptions?: NeedleOptions
): Promise<NewsSearchResults> {
  try {
    // First try with the original method
    return await originalSearchNews(query, options, needleOptions)
  } catch (error) {
    logger.warn("Original searchNews failed, attempting fallback method", {
      error,
    })

    // If the error is related to VQD, try our custom implementation
    if (error instanceof Error && error.message.includes("VQD")) {
      try {
        // Get VQD manually
        const vqd = await getVQD(query)
        logger.info("Successfully obtained VQD manually", { query, vqd })

        // Retry with the manually obtained VQD
        return await originalSearchNews(
          query,
          { ...options, vqd },
          needleOptions
        )
      } catch (fallbackError) {
        logger.error("Fallback method also failed", { fallbackError })
        throw fallbackError
      }
    }

    // If it's not a VQD error, rethrow
    throw error
  }
}

/**
 * A more resilient version of the news search function
 */
export async function robustNewsSearch(
  query: string,
  options?: NewsSearchOptions,
  retries = 3
): Promise<NewsSearchResults> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Add a small delay between retries
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }

      // Try with different user agents if we're retrying
      const needleOptions: NeedleOptions = {
        follow_max: 5,
        headers: {
          "User-Agent": getRandomUserAgent(),
        },
      }

      return await searchNewsWithRetry(query, options, needleOptions)
    } catch (error) {
      logger.warn(`Search attempt ${attempt + 1}/${retries} failed`, { error })
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  // If we exhausted all retries
  throw (
    lastError ||
    new Error(`Failed to search news for "${query}" after ${retries} attempts`)
  )
}

/**
 * Helper to get a random user agent to avoid detection
 */
function getRandomUserAgent(): string {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36 Edg/92.0.902.55",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
  ]

  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

export type { NewsSearchOptions, NewsSearchResults } from "duck-duck-scrape"
