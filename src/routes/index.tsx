import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "New project" },
      { name: "description", content: "A blank starter." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-semibold">Blank canvas</h1>
        <p className="text-muted-foreground">Tell me what to build next.</p>
      </div>
    </main>
  );
}
