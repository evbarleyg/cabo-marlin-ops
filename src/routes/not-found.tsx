import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundRoute() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">This route does not exist in Cabo Marlin Ops.</p>
      <Link to="/" className={buttonVariants({ variant: "default" })}>
        Back to dashboard
      </Link>
    </div>
  );
}
