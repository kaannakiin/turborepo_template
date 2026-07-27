import { HealthSchema, type Health } from "@repo/contracts/shared";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function fetchHealth(): Promise<Health> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return HealthSchema.parse(await res.json());
}

const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: fetchHealth,
});

const environments = [
  { label: "Development", value: "development" },
  { label: "Staging", value: "staging" },
  { label: "Production", value: "production" },
];

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(healthQuery),
  component: Home,
});

function Home() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(healthQuery);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="flex items-start justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("appTitle")}
        </h1>
        <LanguageSwitcher />
      </div>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-border p-4 font-mono text-sm">
        <dt className="text-muted-foreground">{t("status")}</dt>
        <dd>{data.status}</dd>
        <dt className="text-muted-foreground">{t("uptime")}</dt>
        <dd>{data.uptime.toFixed(1)}s</dd>
        <dt className="text-muted-foreground">{t("timestamp")}</dt>
        <dd>{data.timestamp}</dd>
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>shadcn/ui + Base UI</CardTitle>
          <CardDescription>
            Smoke test for the Base UI primitives and the theme tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input placeholder="Service name" />
          <Select items={environments} defaultValue="development">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {environments.map((environment) => (
                <SelectItem key={environment.value} value={environment.value}>
                  {environment.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
        <CardFooter className="gap-2">
          <Button>Save</Button>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
              Open dialog
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Health snapshot</DialogTitle>
                <DialogDescription>
                  Status {data.status}, uptime {data.uptime.toFixed(1)}s.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter showCloseButton />
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </main>
  );
}
