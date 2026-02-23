import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SourceStatus } from "@/lib/schemas";
import { formatDateTime } from "@/lib/utils";

interface SourceStatusListProps {
  generatedAt: string;
  sources: SourceStatus[];
}

export function SourceStatusList({ generatedAt, sources }: SourceStatusListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Last updated: {formatDateTime(generatedAt)}</p>

        <div className="space-y-2">
          {sources.map((source) => (
            <div key={`${source.name}-${source.url}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 p-2">
              <Badge variant={source.ok ? "success" : "destructive"}>{source.ok ? "ok" : "error"}</Badge>
              <span className="font-medium">{source.name}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(source.fetched_at)}</span>
              {source.error ? <span className="text-xs text-destructive">{source.error}</span> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
