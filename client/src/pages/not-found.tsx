import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navigation />
      <div className="w-full flex items-center justify-center py-16">
        <Card className="w-full max-w-md mx-4 bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2 items-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-white">404 Page Not Found</h1>
            </div>

            <p className="mt-4 text-sm text-slate-300 mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>

            <Link href="/">
              <Button className="w-full flex items-center gap-2">
                <Home className="h-4 w-4" />
                Back to Bridge
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
