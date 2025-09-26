import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertContractSchema, 
  insertContractCollaboratorSchema,
  insertContractSignatureSchema,
  insertUserSchema,
  insertNegotiationSchema,
  insertNegotiationConversationSchema,
  activityEventSchema,
  batchActivitiesSchema,
  type ActivityEvent,
  type BatchActivities,
  type Negotiation,
  type NegotiationConversation
} from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import OpenAI from "openai";
import { insertUserMatchSchema, insertMessageSchema, insertNotificationSchema } from "@shared/schema";

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return next();
    
    const now = Date.now();
    const key = `${userId}:messages`;
    const current = rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (current.count >= maxRequests) {
      return res.status(429).json({ message: "Too many messages. Please wait before sending more." });
    }
    
    current.count++;
    next();
  };
}

// Admin authorization middleware
async function isAdmin(req: any, res: any, next: any) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  try {
    // Get user from database to verify admin role
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Check if user has admin privileges (only from database role field)
    const isAdminUser = (dbUser as any).role === 'admin';
                       
    if (!isAdminUser) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Initialize Stripe only if secret key is available
let stripe: Stripe | null = null;
const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.TESTING_STRIPE_SECRET_KEY;

if (stripeKey) {
  // Validate that we have a secret key, not a public key
  if (stripeKey.startsWith('sk_')) {
    stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });
    console.log('Stripe initialized with secret key');
  } else {
    console.warn('Invalid Stripe key - key must start with sk_ for server-side usage. Stripe functionality disabled.');
  }
} else {
  console.warn('STRIPE_SECRET_KEY not found - Stripe functionality will be disabled');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI Analysis function
async function generateAIAnalysis(messages: any[], negotiation: any) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured - skipping AI analysis");
    return null;
  }

  // Prepare conversation context
  const conversationContext = messages.map(msg => 
    `${msg.messageType === 'ai_suggestion' ? 'AI' : 'User'}: ${msg.message}`
  ).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI negotiation assistant. Analyze the following negotiation conversation and provide:
1. A brief summary of the current negotiation state
2. Key points and concerns raised by each party
3. Potential areas of compromise
4. A strategic suggestion for moving forward
5. Overall sentiment score between -1 (negative) and 1 (positive)

Be concise, objective, and focus on constructive outcomes. End with "Sentiment: [score]"`
        },
        {
          role: "user",
          content: `Negotiation Title: ${negotiation.title}
Description: ${negotiation.description || 'No description provided'}

Recent Conversation:
${conversationContext}

Please provide your analysis and strategic recommendation.`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiContent = response.choices[0]?.message?.content || "Unable to generate analysis";
    
    // Extract sentiment from the main response instead of separate call
    const sentimentMatch = aiContent.match(/sentiment[:\s]*(-?[0-9]*\.?[0-9]+)/i);
    const sentimentScore = sentimentMatch ? Math.max(-1, Math.min(1, parseFloat(sentimentMatch[1]))) : 0;

    return {
      suggestion: aiContent,
      analysis: {
        sentimentScore,
        timestamp: new Date().toISOString(),
        messageCount: messages.length,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini"
      }
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null; // Graceful degradation - never throw
  }
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

  app.get('/api/contracts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Check if user owns this contract or is a collaborator
      if (contract.createdBy !== userId) {
        const collaborators = await storage.getContractCollaborators(req.params.id);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
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

  app.patch('/api/contracts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Check if user owns this contract or is a collaborator with edit permission
      if (contract.createdBy !== userId) {
        const collaborators = await storage.getContractCollaborators(req.params.id);
        const userCollaborator = collaborators.find(c => c.userId === userId);
        if (!userCollaborator || userCollaborator.status !== 'accepted') {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const updates = req.body;
      const updatedContract = await storage.updateContract(req.params.id, updates);
      res.json(updatedContract);
    } catch (error) {
      console.error("Error updating contract:", error);
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.delete('/api/contracts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Only the contract owner can delete the contract
      if (contract.createdBy !== userId) {
        return res.status(403).json({ message: "Only the contract owner can delete this contract" });
      }
      
      await storage.deleteContract(req.params.id);
      res.json({ message: "Contract deleted successfully" });
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // Contract collaborator routes
  app.get('/api/contracts/:id/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Check if user owns this contract or is a collaborator
      if (contract.createdBy !== userId) {
        const collaborators = await storage.getContractCollaborators(req.params.id);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const collaborators = await storage.getContractCollaborators(req.params.id);
      res.json(collaborators);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  app.post('/api/contracts/:id/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Only the contract owner can add collaborators
      if (contract.createdBy !== userId) {
        return res.status(403).json({ message: "Only the contract owner can add collaborators" });
      }
      
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
  app.get('/api/contracts/:id/signatures', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Check if user owns this contract or is a collaborator
      if (contract.createdBy !== userId) {
        const collaborators = await storage.getContractCollaborators(req.params.id);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const signatures = await storage.getContractSignatures(req.params.id);
      res.json(signatures);
    } catch (error) {
      console.error("Error fetching signatures:", error);
      res.status(500).json({ message: "Failed to fetch signatures" });
    }
  });

  app.post('/api/contracts/:id/signatures', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Check if user owns this contract or is a collaborator
      if (contract.createdBy !== userId) {
        const collaborators = await storage.getContractCollaborators(req.params.id);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const signatureData = insertContractSignatureSchema.parse({
        ...req.body,
        contractId: req.params.id,
        userId: userId, // Ensure signature is associated with authenticated user
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

  // Profile management routes
  app.get('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.patch('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updateData = insertUserSchema.partial().parse(req.body);
      const updatedUser = await storage.updateUser(userId, updateData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put('/api/profile/image', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { profileImageUrl } = req.body;
      
      if (!profileImageUrl) {
        return res.status(400).json({ message: "Profile image URL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
        profileImageUrl,
        {
          owner: userId,
          visibility: "public", // Profile images are public
        }
      );

      const updatedUser = await storage.updateUser(userId, {
        profileImageUrl: normalizedPath
      });
      
      res.json({ profileImageUrl: normalizedPath });
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ message: "Failed to update profile image" });
    }
  });

  // Object Storage routes
  app.get('/objects/:objectPath(*)', isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post('/api/objects/upload', isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
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

  // Analytics data route - user-specific analytics by default
  app.get('/api/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Don't track page view here to avoid double counting (client-side tracks it)
      
      // Get user-specific analytics (scoped to user's own data)
      const analyticsData = await storage.getAnalyticsData(userId);
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  // Global analytics route - admin only
  app.get('/api/analytics/global', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Check if user is admin (you can adjust this logic based on your admin system)
      if (!user || user.subscriptionTier !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Track admin analytics access
      await storage.trackUserActivity(userId, 'admin_analytics_access');
      
      // Get global platform analytics
      const analyticsData = await storage.getAnalyticsData(); // No userId = global analytics
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching global analytics data:", error);
      res.status(500).json({ message: "Failed to fetch global analytics data" });
    }
  });

  // Activity tracking endpoint
  app.post('/api/activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityEvent = activityEventSchema.parse(req.body);
      
      await storage.trackUserActivity(userId, activityEvent.activityType, activityEvent.activityData);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking activity:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to track activity" });
    }
  });

  // Batch activity tracking endpoint
  app.post('/api/activity/batch', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const batchData = batchActivitiesSchema.parse(req.body);
      
      // Use bulk insert for true batching
      await storage.trackUserActivitiesBulk(userId, batchData.activities);
      
      res.json({ success: true, processed: batchData.activities.length });
    } catch (error) {
      console.error("Error tracking batch activities:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid batch data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to track batch activities" });
    }
  });

  // Negotiation CRUD endpoints
  
  // Get all negotiations for user
  app.get('/api/negotiations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const negotiations = await storage.getNegotiations(userId);
      res.json(negotiations);
    } catch (error) {
      console.error("Error fetching negotiations:", error);
      res.status(500).json({ message: "Failed to fetch negotiations" });
    }
  });

  // Get single negotiation
  app.get('/api/negotiations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const negotiationId = req.params.id;
      const userId = req.user.claims.sub;
      
      const negotiation = await storage.getNegotiation(negotiationId);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }
      
      // Check access (creator or participant)
      const hasAccess = negotiation.createdBy === userId || 
                       (negotiation.participants && negotiation.participants.includes(userId));
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(negotiation);
    } catch (error) {
      console.error("Error fetching negotiation:", error);
      res.status(500).json({ message: "Failed to fetch negotiation" });
    }
  });

  // Create new negotiation
  app.post('/api/negotiations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const negotiationData = insertNegotiationSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      
      const negotiation = await storage.createNegotiation(negotiationData);
      res.status(201).json(negotiation);
    } catch (error) {
      console.error("Error creating negotiation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid negotiation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create negotiation" });
    }
  });

  // Update negotiation
  app.patch('/api/negotiations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const negotiationId = req.params.id;
      const userId = req.user.claims.sub;
      
      const negotiation = await storage.getNegotiation(negotiationId);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }
      
      // Only creator can update negotiation
      if (negotiation.createdBy !== userId) {
        return res.status(403).json({ message: "Only the creator can update this negotiation" });
      }
      
      const updates = req.body;
      const updatedNegotiation = await storage.updateNegotiation(negotiationId, updates);
      res.json(updatedNegotiation);
    } catch (error) {
      console.error("Error updating negotiation:", error);
      res.status(500).json({ message: "Failed to update negotiation" });
    }
  });

  // Get negotiation conversations
  app.get('/api/negotiations/:id/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const negotiationId = req.params.id;
      const userId = req.user.claims.sub;
      
      const negotiation = await storage.getNegotiation(negotiationId);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }
      
      // Check access (creator or participant)
      const hasAccess = negotiation.createdBy === userId || 
                       (negotiation.participants && negotiation.participants.includes(userId));
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const conversations = await storage.getNegotiationConversations(negotiationId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Add conversation message (with optional AI analysis)
  app.post('/api/negotiations/:id/conversations', isAuthenticated, rateLimit(10, 60000), async (req: any, res) => {
    try {
      const negotiationId = req.params.id;
      const userId = req.user.claims.sub;
      
      const negotiation = await storage.getNegotiation(negotiationId);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }
      
      // Check access (creator or participant)
      const hasAccess = negotiation.createdBy === userId || 
                       (negotiation.participants && negotiation.participants.includes(userId));
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const conversationData = insertNegotiationConversationSchema.parse({
        ...req.body,
        negotiationId,
        senderId: userId,
      });
      
      // Add the user message
      const conversation = await storage.addNegotiationConversation(conversationData);
      
      // Send response immediately to ensure message delivery is not blocked by AI
      res.status(201).json(conversation);
      
      // Process AI analysis asynchronously if enabled (never blocks message sending)
      if (negotiation.aiAssistantEnabled && conversationData.messageType === 'text') {
        setImmediate(async () => {
          try {
            // Get recent conversations and limit to last 5 for cost control
            const conversations = await storage.getNegotiationConversations(negotiationId);
            const recentMessages = conversations.slice(-5); // Enforce context limit here
            
            // Generate AI analysis (gracefully handles missing API key)
            const analysis = await generateAIAnalysis(recentMessages, negotiation);
            
            // Add AI suggestion as a separate message if analysis succeeded
            if (analysis?.suggestion) {
              await storage.addNegotiationConversation({
                negotiationId,
                senderId: 'ai-assistant',
                message: analysis.suggestion,
                messageType: 'ai_suggestion',
                sentimentScore: analysis.analysis.sentimentScore,
                aiAnalysis: analysis.analysis,
              });
            }
          } catch (aiError) {
            console.error("Background AI analysis failed:", aiError);
            // Error is logged but never affects user message delivery
          }
        });
      }
    } catch (error) {
      console.error("Error adding conversation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid conversation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add conversation" });
    }
  });


  // ===== USER MATCHING ROUTES =====
  
  // Get user recommendations
  app.get('/api/matches/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit) || 10;
      
      const recommendations = await storage.getUserRecommendations(userId, limit);
      res.json(recommendations);
    } catch (error) {
      console.error("Error getting recommendations:", error);
      res.status(500).json({ message: "Failed to get recommendations" });
    }
  });

  // Get user matches
  app.get('/api/matches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = req.query.status;
      
      const matches = await storage.getUserMatches(userId, status);
      res.json(matches);
    } catch (error) {
      console.error("Error getting matches:", error);
      res.status(500).json({ message: "Failed to get matches" });
    }
  });

  // Connect with a user (create match)
  app.post('/api/matches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body using Zod schema
      const matchData = insertUserMatchSchema.parse({
        ...req.body,
        userId
      });
      
      const { matchedUserId, matchScore, matchReason } = matchData;
      
      const match = await storage.createUserMatch(
        userId, 
        matchedUserId, 
        Number(matchScore) || 0.8, 
        matchReason || "Manual connection"
      );
      
      // Create notification for the matched user
      await storage.createNotification(
        matchedUserId,
        "New Connection Request",
        `You have a new connection request!`,
        "info",
        `/matches`
      );
      
      res.status(201).json(match);
    } catch (error) {
      console.error("Error creating match:", error);
      res.status(500).json({ message: "Failed to create match" });
    }
  });

  // Update match status
  app.patch('/api/matches/:id', isAuthenticated, async (req: any, res) => {
    try {
      const matchId = req.params.id;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      await storage.updateMatchStatus(matchId, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating match status:", error);
      res.status(500).json({ message: "Failed to update match status" });
    }
  });

  // ===== MESSAGING ROUTES =====
  
  // Get user conversations
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error getting conversations:", error);
      res.status(500).json({ message: "Failed to get conversations" });
    }
  });

  // Get conversation with specific user
  app.get('/api/conversations/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const otherUserId = req.params.userId;
      const limit = parseInt(req.query.limit) || 50;
      
      const messages = await storage.getConversation(currentUserId, otherUserId, limit);
      res.json(messages.reverse()); // Return in chronological order
    } catch (error) {
      console.error("Error getting conversation:", error);
      res.status(500).json({ message: "Failed to get conversation" });
    }
  });

  // Send message
  app.post('/api/messages', isAuthenticated, rateLimit(30, 60000), async (req: any, res) => {
    try {
      const senderId = req.user.claims.sub;
      
      // Validate request body using Zod schema
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId
      });
      
      const { receiverId, content, messageType } = messageData;
      
      const message = await storage.sendMessage(senderId, receiverId, content, messageType || 'text');
      
      // Create notification for receiver
      const sender = await storage.getUser(senderId);
      await storage.createNotification(
        receiverId,
        "New Message",
        `${sender?.firstName || 'Someone'} sent you a message`,
        "info",
        `/messages/${senderId}`
      );
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Mark messages as read
  app.patch('/api/conversations/:userId/read', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const senderId = req.params.userId;
      
      await storage.markMessagesAsRead(currentUserId, senderId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // ===== NOTIFICATION ROUTES =====
  
  // Get user notifications
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const unreadOnly = req.query.unread === 'true';
      
      const notifications = await storage.getUserNotifications(userId, unreadOnly);
      res.json(notifications);
    } catch (error) {
      console.error("Error getting notifications:", error);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  // Mark notification as read
  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = req.params.id;
      await storage.markNotificationAsRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.patch('/api/notifications/read-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // ===== ADMIN ROUTES =====
  
  // Get all users (admin only)
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const search = req.query.search || '';
      
      // Get users with pagination and search
      const users = await storage.getAllUsers(page, limit, search);
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Update user status (admin only)
  app.patch('/api/admin/users/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { isActive, subscriptionTier } = req.body;
      
      const updatedUser = await storage.updateUser(userId, { 
        isActive,
        subscriptionTier,
        updatedAt: new Date()
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Get system activity (admin only)
  app.get('/api/admin/activity', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const activity = await storage.getRecentActivity(50);
      res.json(activity);
    } catch (error) {
      console.error("Error getting activity:", error);
      res.status(500).json({ message: "Failed to get activity" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
