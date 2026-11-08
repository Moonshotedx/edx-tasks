import { schedules, logger, schemaTask } from "@trigger.dev/sdk";
import axios from "axios";
import { Client } from "pg";

// job categories in a nested list
const jobCategories = [
  ["Software Engineer", "Data Analyst"], // Group 1
  ["Mechanical Engineer", "Civil Engineer"], // Group 2
  ["Cloud Developer", "Full Stack Developer"], // Group 3
  ["Electrical Engineer", "IoT", "VLSI"], // Group// 4
];
async function generateJobPositionEmbedding(jobPosition: string) {
  const modelUrl = `${process.env.OLLAMA_URL}/embeddings`; 
  console.log("job position is ", jobPosition)
  try {
    const response = await axios.post(
      modelUrl, 
      {
        model: "nomic-embed-text:latest",
        prompt: jobPosition,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const embedding = response.data.embedding;

    return embedding;
  } catch (error) {
    logger.error("Failed to generate embedding for job position");
    return null;
  }
}
// Defining the task using Trigger.dev's scheduling system
export const scrapeLinkedInJobsTask = schedules.task({
  id: "scrape-linkedin-jobs-task",
  cron: {
    pattern: "30 19 * * 0,3", // At 19:30 UTC (1:00 AM IST on sunday and wednesday)
    timezone: "UTC",
  },

  run: async (payload) => {
    console.log("Scheduled job triggered at:", payload.timestamp);
    const scrappingDogUrl=process.env.SCRAPPING_DOG_URL;
    const apiKey = process.env.SCRAPPING_DOG_KEY;
    const host = process.env.DB_HOST;
    const name = process.env.DB_NAME;
    const password = process.env.DB_PASSWORD;
    const user = process.env.DB_USER;
    const geoid = "102713980";
    const page = 1;
    const sort_by="week"

    const client = new Client({
      user: user,
      host: host,
      database: name,
      password: password,
      port: 5434,
    });

    await client.connect();

    try {
      // iterate through each job category group
      for (const category of jobCategories) {
        const field = category.join(","); // Combine job categories for the current group
        const url = `${scrappingDogUrl}/?api_key=${apiKey}&field=${encodeURIComponent(
          field
        )}&geoid=${geoid}&page=${page}&sort_by=${sort_by}`;

        try {
          const response = await axios.get(url);

          // Validate response data
          if (response.data && Array.isArray(response.data)) {
            const jobs = response.data;

            for (const job of jobs) {
              // Check for duplicate `job_id` in the database
              const checkQuery = `SELECT COUNT(job_id) FROM jobs WHERE job_id = $1`;
              const checkResult = await client.query(checkQuery, [job.job_id]);

              if (parseInt(checkResult.rows[0].count) > 0) {
                console.log(
                  `Job with job_id ${job.job_id} already exists. Skipping.`
                );
                continue; // Skip duplicate jobs
              }

              const embeddingInput=job.job_position+" "+job.company_name
              console.log("combined input is ",embeddingInput)
              const embedding = await generateJobPositionEmbedding(embeddingInput);
              // Insert new job into the database
              const insertQuery = `
                INSERT INTO jobs (job_position, job_link, job_id, company_name, company_profile, job_location, job_posting_date, company_logo_url, created_at,job_postings_embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,$10::float[])
              `;

              const insertValues = [
                job.job_position,
                job.job_link,
                job.job_id,
                job.company_name,
                job.company_profile,
                job.job_location,
                job.job_posting_date,
                job.company_logo_url,
                new Date().toISOString(),
                embedding,

              ];

              await client.query(insertQuery, insertValues);
              console.log(
                `Inserted job with job_id ${job.job_id} into the database.`
              );
            }
          } else {
            logger.log(`No valid data received for fields: "${field}"`);
          }
        } catch (error) {
          logger.error(`Error fetching jobs for fields "${field}":`);
        }
      }
    } catch (error) {
      logger.error("Error during LinkedIn job scraping:");
    } finally {
      await client.end();
      console.log("Database connection closed.");
    }
  },
});

///////////////////////////////////////////////////////////Fetch job overview and delete expired jobs ////////////////////////////////////////////////////////////////////////

export const fetchJobOverviewTask = schedules.task({
  id: "get-job-overview-and-remove-expired",
  cron: {
    pattern: "10 20 * * 0,3",
    timezone: "UTC",
  },
  run: async () => {
    const apiKey = process.env.SCRAPPING_DOG_KEY;
    const host = process.env.DB_HOST;
    const name = process.env.DB_NAME;
    const password = process.env.DB_PASSWORD;
    const user = process.env.DB_USER;

    // Connect to PostgreSQL database
    const client = new Client({
      user: user,
      host: host,
      database: name,
      password: password,
      port: 5434,
    });

    await client.connect();

    try {
      // Fetch all job_ids from the jobs table
      const jobQuery = "SELECT job_id,job_description,created_at FROM jobs";
      const jobResult = await client.query(jobQuery);

      if (jobResult.rows.length === 0) {
        logger.log("No jobs found in the database.");
        return;
      }
      const currentDate = new Date();
      console.log("current date is ",currentDate)

      // Iterate through each job_id and fetch job overview
      for (const row of jobResult.rows) {
        const jobId = row.job_id;
        const existingDescription = row.job_description;
        const created_at=new Date( row.created_at);
        const scrappingDogUrl=process.env.SCRAPPING_DOG_URL;
        const url = `${scrappingDogUrl}/?api_key=${apiKey}&job_id=${jobId}`;
        console.log("created at date",created_at)

        try {
          const response = await axios.get(url);

          if (response.data) {
            const jobOverview = response.data;
            const daysDifference = Math.floor(
              (currentDate.getTime() - created_at.getTime()) / (1000 * 60 * 60 * 24)
            );

            console.log("days diff is",daysDifference)
            // Check if required fields are empty and mark job as expired if needed
            if(
              !jobOverview[0].job_location ||
              !jobOverview[0].job_description || daysDifference>15
            ){
              logger.log(
                `Job ${jobId} is missing essential data or too old . Marking as expired.`
              );

              // Delete from jobs table
              await client.query("DELETE FROM jobs WHERE job_id = $1", [jobId]);
              logger.log(`Job ${jobId} deleted from jobs table.`);
              continue;
            }

            if (existingDescription) {
              logger.log(
                `Job overview for job_id ${jobId} already exists in the database.`
              );
              continue;
            }
            
            const industryEmbedding = await generateJobPositionEmbedding(jobOverview[0].Industries);

            const updateQuery = `

            UPDATE jobs 

            SET 
              job_position = $1,
              job_status = $2,
              job_location = $3,
              company_name = $4,
              company_linked_in = $5,
              job_posting_date = $6,
              base_pay = $7,
              job_description = $8,
              seniority_level = $9,
              employment_type = $10,
              job_function = $11,
              industries = $12,
              recruiter_photo = $13,
              recruiter_name = $14,
              recruiter_title = $15,
              recruiter_profile_url = $16,
              industries_embedding = $17::float[]
              
            WHERE job_id = $18
            `;

            const updateValues = [
              jobOverview[0].job_position,
              jobOverview[0].jobs_status,
              jobOverview[0].job_location,
              jobOverview[0].company_name,
              jobOverview[0].company_linkedin_id,
              jobOverview[0].job_posting_time,
              jobOverview[0].base_pay,
              jobOverview[0].job_description,
              jobOverview[0].Seniority_level,
              jobOverview[0].Employment_type,
              jobOverview[0].Job_function,
              jobOverview[0].Industries,
              jobOverview[0].recruiter_details?.[0]?.recruiter_photo,
              jobOverview[0].recruiter_details?.[0]?.recruiter_name,
              jobOverview[0].recruiter_details?.[0]?.recruiter_title,
              jobOverview[0].recruiter_details?.[0]?.recruiter_profile_url,
              industryEmbedding,
              jobId
            ];

            try {
              await client.query(updateQuery, updateValues);
              logger.log(
                `Updated job information for job_id ${jobId} in the database.`
              );
            } catch (error) {
              console.error(
                `Error updating job information for job_id ${jobId}:`,
                error
              );
            }
          } else {
            logger.log(`No valid data received for job_id ${jobId}`);
          }
        } catch (error) {
          logger.error(`Error fetching job overview for job_id ${jobId}:`);
        }
      }
    } catch (error) {
      logger.error("Error during fetching job overviews:");
    } finally {
      await client.end();
      logger.log("Database connection closed.");
    }
  },
});
