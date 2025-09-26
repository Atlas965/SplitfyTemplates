import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Logo from "@/components/Logo";
import StatCard from "@/components/StatCard";

interface DashboardStats {
  totalContracts: number;
  pendingSignatures: number;
  completedThisMonth: number;
  revenueSplit: number;
}

interface Contract {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: contracts, isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Logo />
              <span className="text-xl font-bold text-primary">Splitfy</span>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-muted-foreground hover:text-foreground">
                <i className="fas fa-bell"></i>
              </button>
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white font-semibold">
                JD
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tabs */}
        <div className="mb-8">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8">
              <Link href="/" className="nav-item nav-active" data-testid="tab-overview">
                <i className="fas fa-home mr-2"></i>Overview
              </Link>
              <Link href="/contracts" className="nav-item" data-testid="tab-contracts">
                <i className="fas fa-file-contract mr-2"></i>Contracts
              </Link>
              <Link href="/templates" className="nav-item" data-testid="tab-templates">
                <i className="fas fa-layer-group mr-2"></i>Templates
              </Link>
              <Link href="/billing" className="nav-item" data-testid="tab-billing">
                <i className="fas fa-credit-card mr-2"></i>Billing
              </Link>
            </nav>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Contracts"
            value={statsLoading ? "..." : (stats?.totalContracts || 0).toString()}
            icon="fas fa-file-contract"
            iconBg="bg-accent/10"
            iconColor="text-accent"
            data-testid="stat-total-contracts"
          />
          <StatCard
            title="Pending Signatures"
            value={statsLoading ? "..." : (stats?.pendingSignatures || 0).toString()}
            icon="fas fa-clock"
            iconBg="bg-yellow-100"
            iconColor="text-yellow-600"
            data-testid="stat-pending-signatures"
          />
          <StatCard
            title="Completed This Month"
            value={statsLoading ? "..." : (stats?.completedThisMonth || 0).toString()}
            icon="fas fa-check"
            iconBg="bg-green-100"
            iconColor="text-green-600"
            data-testid="stat-completed-month"
          />
          <StatCard
            title="Revenue Split"
            value={statsLoading ? "..." : `$${stats?.revenueSplit || 0}`}
            icon="fas fa-dollar-sign"
            iconBg="bg-green-100"
            iconColor="text-green-600"
            data-testid="stat-revenue-split"
          />
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-4" data-testid="recent-activity">
              {contractsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : contracts && contracts.length > 0 ? (
                contracts.slice(0, 3).map((contract) => (
                  <div key={contract.id} className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      contract.status === 'signed' ? 'bg-green-100' : 
                      contract.status === 'pending' ? 'bg-yellow-100' : 'bg-blue-100'
                    }`}>
                      <i className={`fas ${
                        contract.status === 'signed' ? 'fa-check text-green-600' :
                        contract.status === 'pending' ? 'fa-clock text-yellow-600' : 'fa-plus text-blue-600'
                      }`}></i>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{contract.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {contract.status === 'signed' ? 'Signed' : 
                         contract.status === 'pending' ? 'Pending signatures' : 'Created'} • 
                        {new Date(contract.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <i className="fas fa-file-contract text-4xl mb-4"></i>
                  <p>No contracts yet. Create your first contract to get started!</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/templates" className="block w-full">
                <button className="w-full flex items-center space-x-3 p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors" data-testid="button-create-contract">
                  <i className="fas fa-plus"></i>
                  <span>Create New Contract</span>
                </button>
              </Link>
              
              <button className="w-full flex items-center space-x-3 p-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors" data-testid="button-upload-contract">
                <i className="fas fa-upload"></i>
                <span>Upload Existing Contract</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors" data-testid="button-invite-collaborator">
                <i className="fas fa-users"></i>
                <span>Invite Collaborator</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors" data-testid="button-export-contracts">
                <i className="fas fa-download"></i>
                <span>Export All Contracts</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
