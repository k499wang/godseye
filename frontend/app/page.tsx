import { GlobeProvider } from "@/components/GlobeContext";
import { GlobeHomePage } from "@/components/GlobeHomePage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; event?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialMode = resolvedSearchParams.mode === "explore" ? "explore" : "intro";
  const initialSelectedEventId =
    typeof resolvedSearchParams.event === "string" ? resolvedSearchParams.event : null;

  return (
    <GlobeProvider>
      <GlobeHomePage
        initialMode={initialMode}
        initialSelectedEventId={initialSelectedEventId}
      />
    </GlobeProvider>
  );
}
