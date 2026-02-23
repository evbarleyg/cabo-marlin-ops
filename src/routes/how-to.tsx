import { Link } from "react-router-dom";
import { Compass, Fish, ShipWheel, Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ScreenGuide } from "@/components/screen-guide";
import { cn } from "@/lib/utils";

export function HowToRoute() {
  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">How To Use Cabo Marlin Ops</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Use this flow each day: check sea state safety first, then compare bite momentum versus the season baseline, then shortlist charters and send quote requests.
        </p>
      </header>

      <ScreenGuide text="This page is the operating playbook. Follow the numbered flow each day, then jump to the linked screens for details and decisions." />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1) Conditions First</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Review Go/Caution/No-Go label, wave p90, swell period, and current speed.</p>
            <p>The map heat overlay shows estimated marlin propensity by offshore distance bands around Cabo Marina.</p>
            <Link to="/conditions" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1")}>Open Conditions</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2) Bite In Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Don&apos;t rely on one day alone. Check where the latest marlin signal sits versus the seasonal distribution.</p>
            <p>Use percentile + ratio to average to understand whether action is above or below normal.</p>
            <Link to="/bite" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1")}>Open Bite</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3) Act on Charters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Sort by normalized $/hour and $/angler, shortlist candidates, and copy a quote request template.</p>
            <p>Use settings to tune units and base coordinates for your own runbook.</p>
            <Link to="/charters" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1")}>Open Charters</Link>
          </CardContent>
        </Card>
      </section>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base">Quick Navigation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/dashboard" className={cn(buttonVariants({ variant: "default" }), "justify-start gap-2")}>
            <Compass className="h-4 w-4" />
            Dashboard
          </Link>
          <Link to="/conditions" className={cn(buttonVariants({ variant: "secondary" }), "justify-start gap-2")}>
            <Waves className="h-4 w-4" />
            Conditions
          </Link>
          <Link to="/bite" className={cn(buttonVariants({ variant: "secondary" }), "justify-start gap-2")}>
            <Fish className="h-4 w-4" />
            Bite
          </Link>
          <Link to="/charters" className={cn(buttonVariants({ variant: "secondary" }), "justify-start gap-2")}>
            <ShipWheel className="h-4 w-4" />
            Charters
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
