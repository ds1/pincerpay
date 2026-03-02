import { google } from "googleapis";
import { getEnv } from "./env.js";
import { withRetry } from "./retry.js";

function getYouTubeClient() {
  const env = getEnv();
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN) {
    throw new Error(
      "YouTube API not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN in .env"
    );
  }

  const auth = new google.auth.OAuth2(
    env.YOUTUBE_CLIENT_ID,
    env.YOUTUBE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: env.YOUTUBE_REFRESH_TOKEN });

  return google.youtube({ version: "v3", auth });
}

export async function updateVideoDescription(
  videoId: string,
  title: string,
  description: string,
  tags: string[]
): Promise<{ id: string; url: string }> {
  const youtube = getYouTubeClient();

  await withRetry(
    () => youtube.videos.update({
      part: ["snippet"],
      requestBody: {
        id: videoId,
        snippet: {
          title,
          description,
          tags,
          categoryId: "28", // Science & Technology
        },
      },
    }),
    { label: "YouTube updateVideoDescription" },
  );

  return {
    id: videoId,
    url: `https://youtube.com/watch?v=${videoId}`,
  };
}

export async function getVideoMetrics(videoId: string): Promise<{
  views: number;
  likes: number;
  comments: number;
}> {
  const youtube = getYouTubeClient();

  const response = await withRetry(
    () => youtube.videos.list({
      part: ["statistics"],
      id: [videoId],
    }),
    { label: "YouTube getVideoMetrics" },
  );

  const stats = response.data.items?.[0]?.statistics;
  return {
    views: parseInt(stats?.viewCount ?? "0", 10),
    likes: parseInt(stats?.likeCount ?? "0", 10),
    comments: parseInt(stats?.commentCount ?? "0", 10),
  };
}
