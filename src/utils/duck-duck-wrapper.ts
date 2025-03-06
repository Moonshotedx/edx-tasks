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
    logger.info("Attempting to get VQD manually", { query })

    // Normalize the query for the URL
    const normalizedQuery = encodeURIComponent(query.trim())
    // Use duckduckgo.com instead of links.duckduckgo.com which seems more reliable
    const url = `https://duckduckgo.com/?q=${normalizedQuery}&ia=web`

    logger.debug("Making request to DuckDuckGo", { url })
    const response = await needle("get", url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      follow_max: 5,
      follow_redirect: true,
    })

    if (!response.body || typeof response.body !== "string") {
      logger.error("Empty or invalid response body from DuckDuckGo", {
        statusCode: response.statusCode,
        bodyType: typeof response.body,
      })
      throw new Error("Empty or invalid response from DuckDuckGo")
    }

    // Extract VQD using regex
    const VQD_REGEX = /vqd="([^"]+)"/
    const match = VQD_REGEX.exec(response.body)

    if (!match || match.length < 2) {
      logger.error("Failed to extract VQD from response", {
        responseLength: response.body.length,
        sampleBody: response.body.substring(0, 200) + "...", // Log a sample of the response
      })
      throw new Error("Unable to extract VQD from response")
    }

    logger.info("Successfully extracted VQD", { vqd: match[1] })
    return match[1]
  } catch (error) {
    logger.error("Failed to get VQD", {
      error,
      query,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
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
    logger.info("Attempting news search with original method", { query })
    return await originalSearchNews(query, options, needleOptions)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.warn("Original searchNews failed, attempting fallback method", {
      error: errorMessage,
      query,
    })

    // If the error is related to VQD, try our custom implementation
    if (
      error instanceof Error &&
      (error.message.includes("VQD") ||
        error.message.includes("Cannot read properties of null") ||
        error.message.includes("exec"))
    ) {
      logger.info("Detected VQD-related error, activating fallback process", {
        errorMessage,
        query,
      })

      try {
        // Get VQD manually
        const vqd = await getVQD(query)
        logger.info("Successfully obtained VQD manually - retrying search", {
          query,
          vqd,
        })

        // Retry with the manually obtained VQD
        const results = await originalSearchNews(
          query,
          { ...options, vqd },
          needleOptions
        )

        logger.info("Fallback search successful", {
          query,
          resultCount: results.results?.length || 0,
        })

        return results
      } catch (fallbackError) {
        const fallbackErrorMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError)

        logger.error("Fallback method also failed", {
          fallbackError: fallbackErrorMessage,
          query,
        })
        throw fallbackError
      }
    }

    // If it's not a VQD error, rethrow
    logger.error("Non-VQD error occurred during search", { errorMessage })
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
  logger.info("Starting robust news search", {
    query,
    retries,
    options,
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Add a small delay between retries
      if (attempt > 0) {
        const delayMs = 1000 * attempt
        logger.info(
          `Retry attempt ${attempt + 1}/${retries} - delaying for ${delayMs}ms`,
          { query }
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }

      // Try with different user agents if we're retrying
      const userAgent = getRandomUserAgent()
      const needleOptions: NeedleOptions = {
        follow_max: 5,
        headers: {
          "User-Agent": userAgent,
        },
      }

      logger.debug(`Search attempt ${attempt + 1}/${retries}`, {
        query,
        userAgent: userAgent.substring(0, 20) + "...", // Truncate for logging
      })

      const results = await searchNewsWithRetry(query, options, needleOptions)

      logger.info("Robust search successful", {
        query,
        attempt: attempt + 1,
        resultCount: results.results?.length || 0,
      })

      return results
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.warn(`Search attempt ${attempt + 1}/${retries} failed`, {
        error: errorMessage,
        query,
      })
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  // If we exhausted all retries
  logger.error("All search attempts failed", {
    query,
    retries,
    finalError: lastError?.message,
  })

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
