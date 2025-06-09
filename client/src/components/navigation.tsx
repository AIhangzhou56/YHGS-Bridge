import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeftRight, TestTube, Copy, Repeat } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Bridge", icon: Home },
    { path: "/mirror", label: "Mirror", icon: Copy },
    { path: "/relay", label: "Relay", icon: Repeat },
    { path: "/testnet", label: "Testnet", icon: TestTube },
  ];

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center space-x-2">
            <ArrowLeftRight className="h-6 w-6 text-orange-500" />
            <span className="font-bold text-xl">YHGS Bridge</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link key={path} href={path}>
                <Button
                  variant={location === path ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Button>
              </Link>
            ))}
          </div>

          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">Live</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}