import { logger, schemaTask, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";

export const load = schemaTask({
  id: "load",
  retry: {
    maxAttempts: 10,
    factor: 1.5,
    randomize: true,
  },
  maxDuration: 300,
  schema: z.object({
    test: z.string(),
  }),

  run: async (payload, { ctx }) => {
    logger.log("Payload", { payload, ctx });
    await wait.for({ seconds: 10 });
    return {
      test: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.",
    };
  },
});
