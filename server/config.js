export const config = {
  port: Number(process.env.PORT ?? 8080),

  signingSecret: process.env.MONDAY_SIGNING_SECRET ?? "",

  mondayApiToken: process.env.MONDAY_API_TOKEN ?? "",

  mongoUri: process.env.MNDY_MONGODB_CONNECTION_STRING ?? "",

  seedOnStart: process.env.SEED_FRAGRANCES === "true",
};
