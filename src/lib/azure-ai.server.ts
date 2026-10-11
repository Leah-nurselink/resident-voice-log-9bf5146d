import { createAzure } from "@ai-sdk/azure";

export function createAzureProvider() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing AZURE_OPENAI_API_KEY");
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
  const resourceName = endpoint.replace(/^https?:\/\//, "").split(".")[0];
  if (!resourceName) throw new Error("Missing/invalid AZURE_OPENAI_ENDPOINT");
  return createAzure({
    resourceName,
    apiKey,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview",
  });
}

export function azureDeployment() {
  return process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1-mini";
}
