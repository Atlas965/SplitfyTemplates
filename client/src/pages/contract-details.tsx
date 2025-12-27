import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { downloadContractPDF } from "@/lib/pdfGenerator";
import Logo from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Contract {
  id: string;
  title: string;
  type: string;
  status: string;
  data: any;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export default function ContractDetails() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const { data: contract, isLoading: contractLoading } = useQuery<Contract>({
    queryKey: ["/api/contracts", id],
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return await apiRequest("PATCH", `/api/contracts/${id}`, { status: newStatus });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Contract status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
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
        description: "Failed to update contract status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/contracts/" + id, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Contract Deleted",
        description: "The contract has been permanently removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setLocation("/contracts");
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

  const handleDownloadPDF = async () => {
    if (!contract) return;
    
    try {
      downloadContractPDF({
        title: contract.title,
        type: contract.type,
        data: contract.data,
        createdAt: contract.createdAt
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

  const handleShare = () => {
    // For now, just copy the contract link to clipboard
    const contractUrl = `${window.location.origin}/contracts/${id}`;
    navigator.clipboard.writeText(contractUrl);
    setShowShareDialog(false);
    setShareEmail("");
    toast({
      title: "Link Copied",
      description: "Contract link has been copied to clipboard.",
    });
  };

  const renderContractContent = () => {
    if (!contract?.data) return null;

    switch (contract.type) {
      case 'split-sheet':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Song Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="font-semibold">Song Title</Label>
                  <p className="text-muted-foreground">{contract.data.title || 'Not specified'}</p>
                </div>
                {contract.data.releaseDate && (
                  <div>
                    <Label className="font-semibold">Release Date</Label>
                    <p className="text-muted-foreground">{new Date(contract.data.releaseDate).toLocaleDateString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collaborators & Ownership</CardTitle>
              </CardHeader>
              <CardContent>
                {contract.data.collaborators && contract.data.collaborators.length > 0 ? (
                  <div className="space-y-3">
                    {contract.data.collaborators.map((collab: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{collab.name}</p>
                          <p className="text-sm text-muted-foreground">{collab.role}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{collab.ownershipPercentage}%</p>
                          <p className="text-sm text-muted-foreground">Ownership</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No collaborators specified</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Royalty Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="font-semibold">Performance Royalties</Label>
                  <p className="text-muted-foreground capitalize">{contract.data.performanceRoyalties || 'Equal'}</p>
                </div>
                <div>
                  <Label className="font-semibold">Mechanical Royalties</Label>
                  <p className="text-muted-foreground capitalize">{contract.data.mechanicalRoyalties || 'Equal'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'performance':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Performance Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="font-semibold">Event Title</Label>
                <p className="text-muted-foreground">{contract.data.title}</p>
              </div>
              <div>
                <Label className="font-semibold">Venue</Label>
                <p className="text-muted-foreground">{contract.data.venue}</p>
              </div>
              <div>
                <Label className="font-semibold">Event Date</Label>
                <p className="text-muted-foreground">{new Date(contract.data.eventDate).toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="font-semibold">Performance Fee</Label>
                <p className="text-muted-foreground">${contract.data.performanceFee || 0}</p>
              </div>
              {contract.data.technicalRequirements && (
                <div>
                  <Label className="font-semibold">Technical Requirements</Label>
                  <p className="text-muted-foreground">{contract.data.technicalRequirements}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'producer':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Producer Agreement Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="font-semibold">Track Title</Label>
                <p className="text-muted-foreground">{contract.data.title}</p>
              </div>
              <div>
                <Label className="font-semibold">Producer Name</Label>
                <p className="text-muted-foreground">{contract.data.producerName}</p>
              </div>
              <div>
                <Label className="font-semibold">Beat Price</Label>
                <p className="text-muted-foreground">${contract.data.beatPrice || 0}</p>
              </div>
              <div>
                <Label className="font-semibold">Royalty Percentage</Label>
                <p className="text-muted-foreground">{contract.data.royaltyPercentage || 0}%</p>
              </div>
              <div>
                <Label className="font-semibold">Credit Requirement</Label>
                <p className="text-muted-foreground">{contract.data.creditRequirement}</p>
              </div>
            </CardContent>
          </Card>
        );

      case 'management':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Management Agreement Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="font-semibold">Agreement Title</Label>
                <p className="text-muted-foreground">{contract.data.title}</p>
              </div>
              <div>
                <Label className="font-semibold">Manager Name</Label>
                <p className="text-muted-foreground">{contract.data.managerName}</p>
              </div>
              <div>
                <Label className="font-semibold">Commission Rate</Label>
                <p className="text-muted-foreground">{contract.data.commissionRate || 0}%</p>
              </div>
              <div>
                <Label className="font-semibold">Contract Duration</Label>
                <p className="text-muted-foreground">{contract.data.contractDuration}</p>
              </div>
              <div>
                <Label className="font-semibold">Responsibilities</Label>
                <p className="text-muted-foreground whitespace-pre-wrap">{contract.data.responsibilities}</p>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(contract.data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        );
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (contractLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <Logo />
                <span className="text-xl font-bold text-primary">Splitfy</span>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <Logo />
                <span className="text-xl font-bold text-primary">Splitfy</span>
              </div>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Contract Not Found</h2>
            <p className="text-muted-foreground mb-4">The contract you're looking for doesn't exist or you don't have access to it.</p>
            <Link href="/contracts">
              <Button>Back to Contracts</Button>
            </Link>
          </div>
        </div>
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
        {/* Breadcrumb */}
        <div className="mb-6">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <Link href="/contracts" className="text-muted-foreground hover:text-foreground">
                  Contracts
                </Link>
              </li>
              <li>
                <i className="fas fa-chevron-right text-muted-foreground text-sm"></i>
              </li>
              <li>
                <span className="text-foreground font-medium">{contract.title}</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* Contract Header */}
        <div className="bg-card p-6 rounded-xl border border-border mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="contract-title">{contract.title}</h1>
              <div className="flex items-center space-x-4 text-muted-foreground">
                <span className="capitalize">{contract.type.replace('-', ' ')} Contract</span>
                <span>•</span>
                <span>Created {new Date(contract.createdAt).toLocaleDateString()}</span>
                {contract.updatedAt !== contract.createdAt && (
                  <>
                    <span>•</span>
                    <span>Updated {new Date(contract.updatedAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {getStatusBadge(contract.status)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleDownloadPDF}
              data-testid="button-download-pdf"
            >
              <i className="fas fa-download mr-2"></i>
              Download PDF
            </Button>
            
            <Link href={`/contracts/${id}/edit`}>
              <Button variant="outline" data-testid="button-edit-contract">
                <i className="fas fa-edit mr-2"></i>
                Edit
              </Button>
            </Link>

            <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-share-contract">
                  <i className="fas fa-share mr-2"></i>
                  Share
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Contract</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="shareEmail">Email Address</Label>
                    <Input
                      id="shareEmail"
                      type="email"
                      placeholder="colleague@example.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      data-testid="input-share-email"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowShareDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleShare} data-testid="button-confirm-share">
                      Copy Link
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Select value={contract.status} onValueChange={(value) => updateStatusMutation.mutate(value)}>
              <SelectTrigger className="w-40" data-testid="select-contract-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="destructive" 
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteContractMutation.isPending}
              data-testid="button-delete-contract"
            >
              <i className="fas fa-trash mr-2"></i>
              Delete Contract
            </Button>
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
                Are you sure you want to delete <span className="font-semibold">"{contract?.title}"</span>? This action is permanent and cannot be undone.
              </p>
              <p className="text-xs text-red-600 font-semibold">
                All contract data, collaborations, and associated information will be permanently removed.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => deleteContractMutation.mutate()}
                disabled={deleteContractMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteContractMutation.isPending ? "Deleting..." : "Delete Contract"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Contract Content */}
        <div className="space-y-6">
          {renderContractContent()}

          {contract.data.additionalTerms && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{contract.data.additionalTerms}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}