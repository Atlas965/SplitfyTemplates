import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Contracts from "@/pages/contracts";
import ContractDetails from "@/pages/contract-details";
import ContractEdit from "@/pages/contract-edit";
import Profile from "@/pages/profile";
import Templates from "@/pages/templates";
import Analytics from "@/pages/analytics";
import Billing from "@/pages/billing";
import ContractForm from "@/pages/contract-form";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/contracts/:id" component={ContractDetails} />
          <Route path="/contracts/:id/edit" component={ContractEdit} />
          <Route path="/profile" component={Profile} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/templates" component={Templates} />
          <Route path="/billing" component={Billing} />
          <Route path="/contract/:type" component={ContractForm} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
