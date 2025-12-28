import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Logo from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { downloadContractPDF } from "@/lib/pdfGenerator";

export default function Contracts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);

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

  interface Contract {
    id: string;
    title: string;
    type: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }

  const { data: contracts, isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    retry: false,
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return await apiRequest("DELETE", `/api/contracts/${contractId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Contract Deleted",
        description: "The contract has been permanently removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to delete contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (contractId: string) => {
    setContractToDelete(contractId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (contractToDelete) {
      deleteContractMutation.mutate(contractToDelete);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "signed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Signed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case "draft":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredContracts = contracts?.filter((contract) => {
    const matchesSearch = contract.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || contract.type === typeFilter;
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleDownloadPDF = async (contract: Contract) => {
    try {
      // Fetch the full contract data including form data
      const response = await fetch(`/api/contracts/${contract.id}`)
      if (!response.ok) {
        throw('Failed to fetch contract details');
      }
      const fullContract = await response.json();
      
      // Generate and download PDF
      downloadContractPDF({
        title: fullContract.title,
        type: fullContract.type,
        data: fullContract.data,
        createdAt: fullContract.createdAt
      });
      
      toast({
        title: "PDF Downloaded",
        description: "Contract PDF has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Error",
        description: "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

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
              <Link href="/" className="nav-item" data-testid="tab-overview">
                <i className="fas fa-home mr-2"></i>Overview
              </Link>
              <Link href="/contracts" className="nav-item nav-active" data-testid="tab-contracts">
                <i className="fas fa-file-contract mr-2"></i>Contracts
              </Link>
              <Link href="/profile" className="nav-item" data-testid="tab-profile">
                <i className="fas fa-user mr-2"></i>Profile
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

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Contracts</h2>
          <Link href="/templates">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-new-contract">
              <i className="fas fa-plus mr-2"></i>New Contract
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-card p-4 rounded-xl border border-border mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40" data-testid="select-type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="split-sheet">Split Sheets</SelectItem>
                <SelectItem value="performance">Performance Agreements</SelectItem>
                <SelectItem value="producer">Producer Agreements</SelectItem>
                <SelectItem value="management">Management Agreements</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex-1">
              <Input 
                type="text" 
                placeholder="Search contracts..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
                data-testid="input-search-contracts"
              />
            </div>
          </div>
        </div>

        {/* Contracts Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            {contractsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredContracts && filteredContracts.length > 0 ? (
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 font-semibold">Contract Name</th>
                    <th className="text-left p-4 font-semibold">Type</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                    <th className="text-left p-4 font-semibold">Created</th>
                    <th className="text-left p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((contract) => (
                    <tr key={contract.id} className="border-b border-border" data-testid={`contract-row-${contract.id}`}>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{contract.title}</p>
                          <p className="text-muted-foreground text-sm">{contract.type} contract</p>
                        </div>
                      </td>
                      <td className="p-4 capitalize">{contract.type.replace('-', ' ')}</td>
                      <td className="p-4">
                        {getStatusBadge(contract.status)}
                      </td>
                      <td className="p-4">{new Date(contract.createdAt).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Link href={`/contracts/${contract.id}`}>
                            <button className="text-muted-foreground hover:text-foreground" data-testid={`button-view-${contract.id}`}>
                              <i className="fas fa-eye"></i>
                            </button>
                          </Link>
                          <button 
                            className="text-muted-foreground hover:text-foreground" 
                            onClick={() => handleDownloadPDF(contract)}
                            data-testid={`button-download-${contract.id}`}
                          >
                            <i className="fas fa-download"></i>
                          </button>
                          <button className="text-muted-foreground hover:text-foreground" data-testid={`button-share-${contract.id}`}>
                            <i className="fas fa-share"></i>
                          </button>
                          <button 
                            className="text-muted-foreground hover:text-red-600" 
                            onClick={() => handleDeleteClick(contract.id)}
                            disabled={deleteContractMutation.isPending}
                            data-testid={`button-delete-${contract.id}`}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <i className="fas fa-file-contract text-4xl text-muted-foreground mb-4"></i>
                <h3 className="text-lg font-semibold mb-2">No contracts found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || typeFilter !== "all" || statusFilter !== "all" 
                    ? "Try adjusting your filters or search terms."
                    : "Create your first contract to get started!"
                  }
                </p>
                <Link href="/templates">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-create-first-contract">
                    <i className="fas fa-plus mr-2"></i>Create Contract
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent data-testid="delete-contract-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this contract? This action is permanent and cannot be undone.
              </p>
              <p className="text-xs text-red-600 font-semibold">
                All contract data, collaborations, and associated information will be permanently removed.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteContractMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteContractMutation.isPending ? "Deleting..." : "Delete Contract"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
