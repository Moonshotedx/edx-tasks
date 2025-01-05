interface InterviewQuestion {
  question: string
  answers: [string, string, string]
}

const makima_url = process.env.MAKIMA_URL

if (!makima_url) {
  throw new Error("MAKIMA_URL env variable is required")
}

export async function generateInterviewPrep(
  userContext: string,
  jobContext: string
): Promise<{
  questions: InterviewQuestion[]
  suggestions?: string[]
}> {
  const response = await fetch(`${makima_url}/agent/interview-coach/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "human",
      name: "student",
      content: `User details: ${userContext}
Job details: ${jobContext}

Based on the user's details and the job details, generate a set of interview questions for the user that could be asked in the job interview along with three possible answers for each question.

You can also add suggestions for the user on what they can improve on their resume details to increase their chances of getting the job, you can also add a 1-10 rating on how well the user's resume matches the job requirements.

Based on the above user and job details generate a json of the following type:
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
    }),
  })

  // Parse the response and return the interview question
  const result = await response.json()
  const message = result as {
    content: string
  }

  const questions = JSON.parse(message.content)
  return questions as {
    questions: InterviewQuestion[]
  }
}

export async function chat({
  agent,
  content,
  name,
}: {
  agent: string
  content: string
  name?: string
}): Promise<string> {
  const response = await fetch(`${makima_url}/agent/${agent}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "human",
      name: name ?? "user",
      content,
    }),
  })
  const result_1 = await response.json()
  const message = result_1 as {
    content: string
  }
  return message.content
}

export async function searchKnowledgeBase<T>({
  name,
  query,
  k,
}: {
  name: string
  query: string
  k: number
}) {
  const response = await fetch(
    `${makima_url}/knowledge/${name}/search?q=${encodeURIComponent(query)}&k=${k}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
  const result = await response.json()
  const results = result as {
    id: string
    content: string
    model: string
    metadata: T
  }[]

  return results
}
