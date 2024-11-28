import { createClient } from "redis";

interface Job {
  run_id: string;
  running: boolean;
  error?: string;
  output?: string;
  task: string;
}

class JobManager {
  private client;

  constructor() {
    this.client = createClient({
      url: "redis://arke:6379",
    });
    this.client.on("error", (err) => console.error("Redis Client Error", err));
  }

  // Connect to Redis
  async connect(): Promise<void> {
    await this.client.connect();
    console.log("Connected to Redis at arke:6379");
  }

  // Disconnect from Redis
  async disconnect(): Promise<void> {
    await this.client.disconnect();
    console.log("Disconnected from Redis");
  }

  // Add or update a job for a user
  async setJob(email: string, job: Job): Promise<void> {
    const key = `user:${email}:jobs`;
    await this.client.hSet(key, job.run_id, JSON.stringify(job));
  }

  // Get all jobs for a user
  async getJobs(email: string): Promise<Job[]> {
    const key = `user:${email}:jobs`;
    const jobs = await this.client.hGetAll(key);

    return Object.values(jobs).map((jobStr) => JSON.parse(jobStr));
  }

  // Update a job by run_id
  async updateJob(
    email: string,
    run_id: string,
    updates: Partial<Job>,
  ): Promise<void> {
    const key = `user:${email}:jobs`;
    const jobStr = await this.client.hGet(key, run_id);

    if (!jobStr) {
      throw new Error(`Job with run_id ${run_id} not found for user ${email}`);
    }

    const job: Job = JSON.parse(jobStr);
    const updatedJob = { ...job, ...updates };

    await this.client.hSet(key, run_id, JSON.stringify(updatedJob));
  }

  // Remove a job by run_id
  async removeJob(email: string, run_id: string): Promise<void> {
    const key = `user:${email}:jobs`;
    await this.client.hDel(key, run_id);
  }
}

export default JobManager;
