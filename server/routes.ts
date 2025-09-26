import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertContractSchema, 
  insertContractCollaboratorSchema,
  insertContractSignatureSchema 
} from "@shared/schema";
import { z } from "zod";

// Initialize Stripe only if secret key is available
let stripe: Stripe | null = null;
const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.TESTING_STRIPE_SECRET_KEY;

if (stripeKey) {
  // Validate that we have a secret key, not a public key
  if (stripeKey.startsWith('sk_')) {
    stripe = new Stripe(stripeKey, {
      apiVersion: "2024-09-30.acacia",
    });
    console.log('Stripe initialized with secret key');
  } else {
    console.warn('Invalid Stripe key - key must start with sk_ for server-side usage. Stripe functionality disabled.');
  }
} else {
  console.warn('STRIPE_SECRET_KEY not found - Stripe functionality will be disabled');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Contract template routes
  app.get('/api/contract-templates', isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getContractTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching contract templates:", error);
      res.status(500).json({ message: "Failed to fetch contract templates" });
    }
  });

  app.get('/api/contract-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getContractTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Contract template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching contract template:", error);
      res.status(500).json({ message: "Failed to fetch contract template" });
    }
  });

  // Contract routes
  app.get('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contracts = await storage.getContracts(userId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get('/api/contracts/:id', isAuthenticated, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.post('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contractData = insertContractSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      
      const contract = await storage.createContract(contractData);
      res.json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contract data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  app.patch('/api/contracts/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = req.body;
      const contract = await storage.updateContract(req.params.id, updates);
      res.json(contract);
    } catch (error) {
      console.error("Error updating contract:", error);
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.delete('/api/contracts/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteContract(req.params.id);
      res.json({ message: "Contract deleted successfully" });
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // Contract collaborator routes
  app.get('/api/contracts/:id/collaborators', isAuthenticated, async (req, res) => {
    try {
      const collaborators = await storage.getContractCollaborators(req.params.id);
      res.json(collaborators);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  app.post('/api/contracts/:id/collaborators', isAuthenticated, async (req, res) => {
    try {
      const collaboratorData = insertContractCollaboratorSchema.parse({
        ...req.body,
        contractId: req.params.id,
      });
      
      const collaborator = await storage.addContractCollaborator(collaboratorData);
      res.json(collaborator);
    } catch (error) {
      console.error("Error adding collaborator:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid collaborator data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add collaborator" });
    }
  });

  // Contract signature routes
  app.get('/api/contracts/:id/signatures', isAuthenticated, async (req, res) => {
    try {
      const signatures = await storage.getContractSignatures(req.params.id);
      res.json(signatures);
    } catch (error) {
      console.error("Error fetching signatures:", error);
      res.status(500).json({ message: "Failed to fetch signatures" });
    }
  });

  app.post('/api/contracts/:id/signatures', isAuthenticated, async (req, res) => {
    try {
      const signatureData = insertContractSignatureSchema.parse({
        ...req.body,
        contractId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      const signature = await storage.createContractSignature(signatureData);
      res.json(signature);
    } catch (error) {
      console.error("Error creating signature:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid signature data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create signature" });
    }
  });

  // Stripe subscription routes
  app.post('/api/get-or-create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured. Please contact support." });
      }

      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        res.json({
          subscriptionId: subscription.id,
          clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        });
        return;
      }
      
      if (!user.email) {
        throw new Error('No user email on file');
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      });

      // Determine price ID based on plan
      const { plan = 'pro' } = req.body;
      let priceId;
      let tier;
      
      switch (plan) {
        case 'pro':
          priceId = process.env.STRIPE_PRO_PRICE_ID || 'price_pro_default';
          tier = 'pro';
          break;
        case 'label':
          priceId = process.env.STRIPE_LABEL_PRICE_ID || 'price_label_default';
          tier = 'label';
          break;
        default:
          priceId = process.env.STRIPE_PRO_PRICE_ID || 'price_pro_default';
          tier = 'pro';
      }

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: priceId,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          tier: tier,
          userId: userId,
        },
      });

      await storage.updateUserStripeInfo(userId, customer.id, subscription.id);
  
      res.json({
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      });
    } catch (error: any) {
      console.error("Stripe subscription error:", error);
      return res.status(400).json({ error: { message: error.message } });
    }
  });

  // Stripe webhook handler
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Stripe is not configured" });
    }

    const sig = req.headers['stripe-signature'];
    let event: any;

    try {
      // Verify webhook signature
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret);
      } else {
        // For development - accept event without verification
        event = req.body;
        console.warn('Webhook signature verification skipped - STRIPE_WEBHOOK_SECRET not configured');
      }
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err}`);
    }

    try {
      // Handle the event
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          const subscription = event.data.object;
          console.log(`Subscription ${event.type}:`, subscription.id);
          
          // Update user subscription status in database
          if (subscription.customer) {
            const user = await storage.getUserByStripeCustomerId(subscription.customer);
            if (user) {
              const tier = subscription.metadata?.tier || 'pro';
              const subscriptionStatus = subscription.status === 'active' ? tier : 'free';
              
              await storage.updateUser(user.id, {
                subscriptionStatus: subscription.status,
                subscriptionTier: subscriptionStatus,
                stripeSubscriptionId: subscription.id,
              });
              
              console.log(`Updated user ${user.id} subscription to ${tier} (${subscription.status})`);
            } else {
              console.warn(`User not found for Stripe customer: ${subscription.customer}`);
            }
          }
          break;

        case 'customer.subscription.deleted':
          const deletedSubscription = event.data.object;
          console.log('Subscription deleted:', deletedSubscription.id);
          
          // Update user to free tier
          if (deletedSubscription.customer) {
            const user = await storage.getUserByStripeCustomerId(deletedSubscription.customer);
            if (user) {
              await storage.updateUser(user.id, {
                subscriptionStatus: 'cancelled',
                subscriptionTier: 'free',
                stripeSubscriptionId: null,
              });
              
              console.log(`Updated user ${user.id} to free tier after subscription deletion`);
            } else {
              console.warn(`User not found for Stripe customer: ${deletedSubscription.customer}`);
            }
          }
          break;

        case 'invoice.payment_succeeded':
          const invoice = event.data.object;
          console.log('Payment succeeded for invoice:', invoice.id);
          break;

        case 'invoice.payment_failed':
          const failedInvoice = event.data.object;
          console.log('Payment failed for invoice:', failedInvoice.id);
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Cancel subscription endpoint
  app.post('/api/stripe/cancel-subscription', isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured. Please contact support." });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      // Cancel the subscription at period end
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({
        message: "Subscription cancelled successfully",
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
      });
    } catch (error: any) {
      console.error("Subscription cancellation error:", error);
      return res.status(400).json({ error: { message: error.message } });
    }
  });

  // Get subscription details endpoint
  app.get('/api/stripe/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // If no user or subscription, return free tier
      if (!user || !user.stripeSubscriptionId) {
        return res.json({
          hasSubscription: false,
          tier: user?.subscriptionTier || 'free',
          status: 'inactive'
        });
      }

      // If Stripe is properly configured, get live data
      if (stripe) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          
          return res.json({
            hasSubscription: subscription.status === 'active',
            subscriptionId: subscription.id,
            status: subscription.status,
            tier: subscription.metadata?.tier || user.subscriptionTier || 'pro',
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            nextBillingDate: subscription.current_period_end,
          });
        } catch (stripeError: any) {
          console.error("Stripe API error:", stripeError);
          // Fall back to database data if Stripe fails
        }
      }

      // Fallback to database-stored subscription info when Stripe unavailable
      return res.json({
        hasSubscription: user.subscriptionTier !== 'free',
        tier: user.subscriptionTier || 'free',
        status: user.subscriptionStatus || 'active',
        subscriptionId: user.stripeSubscriptionId,
        // Mock dates for demo purposes when Stripe unavailable
        currentPeriodStart: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60),
        currentPeriodEnd: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        nextBillingDate: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      });
    } catch (error: any) {
      console.error("Subscription retrieval error:", error);
      return res.status(500).json({ error: { message: error.message } });
    }
  });

  // Dashboard stats route
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contracts = await storage.getContracts(userId);
      
      const now = new Date();
      const stats = {
        totalContracts: contracts.length,
        pendingSignatures: contracts.filter(c => c.status === 'pending').length,
        completedThisMonth: contracts.filter(c => {
          if (c.status !== 'signed' || !c.updatedAt) return false;
          const updatedDate = new Date(c.updatedAt);
          return updatedDate.getMonth() === now.getMonth() && 
                 updatedDate.getFullYear() === now.getFullYear();
        }).length,
        revenueSplit: contracts.filter(c => c.status === 'signed').length * 100, // Simplified: $100 per signed contract
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
