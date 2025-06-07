import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Bridge from "@/pages/bridge";
import Testnet from "@/pages/testnet";
import Mirror from "@/pages/mirror";
import Relay from "@/pages/relay";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Bridge} />
      <Route path="/bridge" component={Bridge} />
      <Route path="/testnet" component={Testnet} />
      <Route path="/mirror" component={Mirror} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
