import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface SubscriptionData {
  hasSubscription: boolean;
  subscriptionId?: string;
  status?: string;
  tier: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  nextBillingDate?: number;
}

export default function Billing() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Fetch subscription data
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/stripe/subscription"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/stripe/cancel-subscription", {});
    },
    onSuccess: () => {
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will be cancelled at the end of the current billing period.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  const currentPlan = (user as any)?.subscriptionTier || "free";
  const currentPlanName = currentPlan === "free" ? "Free" : currentPlan === "pro" ? "Pro" : "Label";
  const currentPlanPrice = currentPlan === "free" ? "$0" : currentPlan === "pro" ? "$19" : "$49";

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
              <Link href="/contracts" className="nav-item" data-testid="tab-contracts">
                <i className="fas fa-file-contract mr-2"></i>Contracts
              </Link>
              <Link href="/templates" className="nav-item" data-testid="tab-templates">
                <i className="fas fa-layer-group mr-2"></i>Templates
              </Link>
              <Link href="/billing" className="nav-item nav-active" data-testid="tab-billing">
                <i className="fas fa-credit-card mr-2"></i>Billing
              </Link>
            </nav>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Billing & Subscription</h2>
          <p className="text-muted-foreground">Manage your subscription and payment methods</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Plan */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="text-lg font-semibold mb-4">Current Plan</h3>
              {subscriptionLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-accent">
                          {subscriptionData?.tier === 'pro' ? 'Pro' : 
                           subscriptionData?.tier === 'label' ? 'Label' : 'Free'} Plan
                        </p>
                        {subscriptionData?.hasSubscription && (
                          <Badge variant={subscriptionData.status === 'active' ? 'default' : 'secondary'}>
                            {subscriptionData.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        {subscriptionData?.tier === 'pro' ? '$19' : 
                         subscriptionData?.tier === 'label' ? '$49' : '$0'}/month • Billed monthly
                      </p>
                    </div>
                    <Button variant="outline" data-testid="button-change-plan">
                      Change Plan
                    </Button>
                  </div>
                  {subscriptionData?.hasSubscription && subscriptionData.nextBillingDate && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-green-800 dark:text-green-200 text-sm">
                        <i className="fas fa-check-circle mr-2"></i>
                        {subscriptionData.cancelAtPeriodEnd ? 
                          `Subscription ends on ${new Date(subscriptionData.nextBillingDate * 1000).toLocaleDateString()}` :
                          `Your next billing date is ${new Date(subscriptionData.nextBillingDate * 1000).toLocaleDateString()}`
                        }
                      </p>
                    </div>
                  )}
                  {subscriptionData?.hasSubscription && !subscriptionData.cancelAtPeriodEnd && (
                    <div className="mt-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => cancelSubscriptionMutation.mutate()}
                        disabled={cancelSubscriptionMutation.isPending}
                        data-testid="button-cancel-subscription"
                      >
                        {cancelSubscriptionMutation.isPending ? 'Canceling...' : 'Cancel Subscription'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Payment Method */}
            {currentPlan !== "free" && (
              <div className="bg-card p-6 rounded-xl border border-border">
                <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded flex items-center justify-center">
                      <i className="fab fa-cc-visa text-white"></i>
                    </div>
                    <div>
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-muted-foreground text-sm">Expires 12/25</p>
                    </div>
                  </div>
                  <button className="text-accent hover:text-accent/80" data-testid="button-update-payment">
                    Update
                  </button>
                </div>
              </div>
            )}

            {/* Billing History */}
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="text-lg font-semibold mb-4">Billing History</h3>
              <div className="space-y-4">
                {currentPlan === "free" ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-credit-card text-4xl mb-4"></i>
                    <p>No billing history on free plan</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between py-3 border-b border-border">
                      <div>
                        <p className="font-medium">{currentPlanName} Plan - January 2024</p>
                        <p className="text-muted-foreground text-sm">Paid on Jan 21, 2024</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{currentPlanPrice}.00</p>
                        <button className="text-accent text-sm hover:text-accent/80" data-testid="button-download-invoice">
                          <i className="fas fa-download mr-1"></i>Invoice
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-b border-border">
                      <div>
                        <p className="font-medium">{currentPlanName} Plan - December 2023</p>
                        <p className="text-muted-foreground text-sm">Paid on Dec 21, 2023</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{currentPlanPrice}.00</p>
                        <button className="text-accent text-sm hover:text-accent/80" data-testid="button-download-invoice-2">
                          <i className="fas fa-download mr-1"></i>Invoice
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Usage Summary */}
          <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="text-lg font-semibold mb-4">Usage This Month</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Contracts Created</span>
                    <span>{currentPlan === "free" ? "3 / 3" : "12 / ∞"}</span>
                  </div>
                  <Progress value={currentPlan === "free" ? 100 : 60} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Storage Used</span>
                    <span>1.2 GB / ∞</span>
                  </div>
                  <Progress value={12} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Collaborators</span>
                    <span>8 / ∞</span>
                  </div>
                  <Progress value={40} className="h-2" />
                </div>
              </div>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full text-left p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors" data-testid="button-update-payment-method">
                  <i className="fas fa-credit-card mr-3 text-muted-foreground"></i>
                  Update Payment Method
                </button>
                <button className="w-full text-left p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors" data-testid="button-download-all-invoices">
                  <i className="fas fa-receipt mr-3 text-muted-foreground"></i>
                  Download All Invoices
                </button>
                {currentPlan !== "free" && (
                  <button className="w-full text-left p-3 text-destructive bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors" data-testid="button-cancel-subscription">
                    <i className="fas fa-times mr-3"></i>
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
