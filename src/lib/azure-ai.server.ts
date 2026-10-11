import { createAzure } from "@ai-sdk/azure";

export function createAzureProvider() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing AZURE_OPENAI_API_KEY");
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
  const resourceName = endpoint.replace(/^https?:\/\//, "").split(".")[0];
  if (!resourceName) throw new Error("Missing/invalid AZURE_OPENAI_ENDPOINT");
  // Use classic deployment-based URLs (…/openai/deployments/<deployment>/chat/completions?api-version=…)
  // instead of the SDK default "v1" API surface, which rejects dated api-versions.
  // Only a dated api-version works on this path, so ignore non-dated values like "preview"/"v1".
  const envVersion = process.env.AZURE_OPENAI_API_VERSION;
  const apiVersion = envVersion && /^\d{4}-\d{2}-\d{2}/.test(envVersion) ? envVersion : "2024-12-01-preview";
  return createAzure({
    resourceName,
    apiKey,
    apiVersion,
    useDeploymentBasedUrls: true,
  });
}

export function azureDeployment() {
  return process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1-mini";
}
