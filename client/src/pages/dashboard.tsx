import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Logo from "@/components/Logo";
import StatCard from "@/components/StatCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChevronDown, Home, User, FileText, Handshake, Mail, Users, Search, BarChart, Layers, CreditCard, Plus, Bell, Upload, Download, Menu, Trash2 } from "lucide-react";

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

  const deleteContractMutation = useMutation({
    mutationFn: (contractId: string) => apiRequest("DELETE", `/api/contracts/${contractId}`, {}),
    onSuccess: () => {
      toast({
        title: "Contract deleted",
        description: "The contract has been removed from recent activity.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete contract. Please try again.",
        variant: "destructive",
      });
    },
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
              <button className="text-muted-foreground hover:text-foreground" data-testid="nav-notifications">
                <Bell className="h-4 w-4" />
              </button>
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white font-semibold">
                JD
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Dropdown Menu */}
        <div className="mb-8">
          <div className="border-b border-border pb-4">
            <nav className="relative">
              {/* Main Navigation Dropdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Primary Action - Dashboard */}
                  <Link href="/" className="nav-item nav-active" data-testid="tab-overview">
                    <Home className="mr-2 h-4 w-4" />Dashboard
                  </Link>
                  
                  {/* Navigation Dropdown - Accessible */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="nav-item flex items-center space-x-2" data-testid="nav-dropdown-trigger">
                        <Menu className="mr-1 h-4 w-4" />
                        <span>Navigation</span>
                        <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64" align="start" data-testid="nav-dropdown-menu">
                      {/* Highest Precedence - Core Functions */}
                      <DropdownMenuLabel>Core Functions</DropdownMenuLabel>
                      <DropdownMenuItem asChild data-testid="dropdown-profile">
                        <Link href="/profile" className="flex items-center w-full">
                          <User className="mr-3 h-4 w-4" />
                          <span>Profile</span>
                          <span className="ml-auto text-xs text-muted-foreground">Essential</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="dropdown-contracts">
                        <Link href="/contracts" className="flex items-center w-full">
                          <FileText className="mr-3 h-4 w-4" />
                          <span>Contracts</span>
                          <span className="ml-auto text-xs text-muted-foreground">High</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="dropdown-negotiations">
                        <Link href="/negotiations" className="flex items-center w-full">
                          <Handshake className="mr-3 h-4 w-4" />
                          <span>Negotiations</span>
                          <span className="ml-auto text-xs text-muted-foreground">High</span>
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Medium-High Precedence - Communication */}
                      <DropdownMenuLabel>Communication</DropdownMenuLabel>
                      <DropdownMenuItem asChild data-testid="dropdown-messages">
                        <Link href="/messages" className="flex items-center w-full">
                          <Mail className="mr-3 h-4 w-4" />
                          <span>Messages</span>
                          <span className="ml-auto text-xs text-muted-foreground">Medium</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="dropdown-matches">
                        <Link href="/matches" className="flex items-center w-full">
                          <Users className="mr-3 h-4 w-4" />
                          <span>Connections</span>
                          <span className="ml-auto text-xs text-muted-foreground">Medium</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="dropdown-search">
                        <Link href="/search" className="flex items-center w-full">
                          <Search className="mr-3 h-4 w-4" />
                          <span>Search</span>
                          <span className="ml-auto text-xs text-muted-foreground">Medium</span>
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Lower Precedence - Tools & Admin */}
                      <DropdownMenuLabel>Tools & Analytics</DropdownMenuLabel>
                      <DropdownMenuItem asChild data-testid="dropdown-analytics">
                        <Link href="/analytics" className="flex items-center w-full">
                          <BarChart className="mr-3 h-4 w-4" />
                          <span>Analytics</span>
                          <span className="ml-auto text-xs text-muted-foreground">Low</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="dropdown-templates">
                        <Link href="/templates" className="flex items-center w-full">
                          <Layers className="mr-3 h-4 w-4" />
                          <span>Templates</span>
                          <span className="ml-auto text-xs text-muted-foreground">Low</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="dropdown-billing">
                        <Link href="/billing" className="flex items-center w-full">
                          <CreditCard className="mr-3 h-4 w-4" />
                          <span>Billing</span>
                          <span className="ml-auto text-xs text-muted-foreground">Lowest</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* Quick Actions */}
                <div className="flex items-center space-x-3">
                  <Button asChild className="btn-primary btn-sm" data-testid="btn-new-contract">
                    <Link href="/contract/new">
                      <Plus className="mr-1 h-3 w-3" />
                      New Contract
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild data-testid="quick-messages">
                    <Link href="/messages">
                      <Mail className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild data-testid="quick-notifications">
                    <Link href="/notifications">
                      <Bell className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
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
                  <div key={contract.id} className="flex items-center space-x-4 p-4 bg-muted rounded-lg group hover:bg-muted/80 transition-colors">
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
                    <button
                      onClick={() => deleteContractMutation.mutate(contract.id)}
                      disabled={deleteContractMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-100 hover:text-red-600 rounded-lg"
                      data-testid={`button-delete-contract-${contract.id}`}
                      title="Delete contract"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
              <Button asChild className="w-full justify-start space-x-3 p-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90" data-testid="button-create-contract">
                <Link href="/templates">
                  <Plus className="h-4 w-4" />
                  <span>Create New Contract</span>
                </Link>
              </Button>
              
              <button className="w-full flex items-center space-x-3 p-3 bg-muted text-muted-foreground rounded-lg hover:opacity-80 transition-opacity" data-testid="button-upload-contract">
                <Upload className="h-4 w-4" />
                <span>Upload Existing Contract</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 bg-muted text-muted-foreground rounded-lg hover:opacity-80 transition-opacity" data-testid="button-invite-collaborator">
                <Users className="h-4 w-4" />
                <span>Invite Collaborator</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 bg-muted text-muted-foreground rounded-lg hover:opacity-80 transition-opacity" data-testid="button-export-contracts">
                <Download className="h-4 w-4" />
                <span>Export All Contracts</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
