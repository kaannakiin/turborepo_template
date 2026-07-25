import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { HealthSchema, type Health } from "@repo/contracts/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function fetchHealth(): Promise<Health> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  // The contract is the source of truth on both sides of the wire.
  return HealthSchema.parse(await res.json());
}

const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: fetchHealth,
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(healthQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(healthQuery);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">blank_template</h1>
      <p className="text-sm text-gray-500">
        TanStack Start · NestJS · Turborepo
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-gray-200 p-4 font-mono text-sm">
        <dt className="text-gray-500">status</dt>
        <dd>{data.status}</dd>
        <dt className="text-gray-500">uptime</dt>
        <dd>{data.uptime.toFixed(1)}s</dd>
        <dt className="text-gray-500">timestamp</dt>
        <dd>{data.timestamp}</dd>
      </dl>
    </main>
  );
}
