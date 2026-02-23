import { Card, CardContent } from "@/components/ui/card";

export function ScreenGuide({ text }: { text: string }) {
  return (
    <Card className="border-primary/35 bg-primary/5">
      <CardContent className="pt-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">How to interpret this screen:</strong> {text}
        </p>
      </CardContent>
    </Card>
  );
}
