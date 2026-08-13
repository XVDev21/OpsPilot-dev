import type { MetadataRoute } from "next";
import { workflows } from "@/features/workflows/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const routes = ["", "/product", "/security", "/demo", "/demo/workflows"];
  return [
    ...routes.map((route) => ({ url: `${baseUrl}${route}`, changeFrequency: "weekly" as const })),
    ...workflows.map((workflow) => ({
      url: `${baseUrl}/demo/workflows/${workflow.id}`,
      changeFrequency: "weekly" as const,
    })),
  ];
}
