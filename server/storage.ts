import {
  users,
  contracts,
  contractTemplates,
  contractCollaborators,
  contractSignatures,
  userActivity,
  profileViews,
  type User,
  type UpsertUser,
  type Contract,
  type InsertContract,
  type ContractTemplate,
  type InsertContractTemplate,
  type ContractCollaborator,
  type InsertContractCollaborator,
  type ContractSignature,
  type InsertContractSignature,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, count, gte, lt } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  
  // Contract template operations
  getContractTemplates(): Promise<ContractTemplate[]>;
  getContractTemplate(id: string): Promise<ContractTemplate | undefined>;
  createContractTemplate(template: InsertContractTemplate): Promise<ContractTemplate>;
  
  // Contract operations
  getContracts(userId: string): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, updates: Partial<Contract>): Promise<Contract>;
  deleteContract(id: string): Promise<void>;
  
  // Contract collaborator operations
  getContractCollaborators(contractId: string): Promise<ContractCollaborator[]>;
  addContractCollaborator(collaborator: InsertContractCollaborator): Promise<ContractCollaborator>;
  updateCollaboratorStatus(id: string, status: string): Promise<ContractCollaborator>;
  
  // Contract signature operations
  createContractSignature(signature: InsertContractSignature): Promise<ContractSignature>;
  getContractSignatures(contractId: string): Promise<ContractSignature[]>;
  
  // Analytics operations
  getAnalyticsData(userId?: string): Promise<any>;
  trackUserActivity(userId: string, activityType: string, activityData?: any): Promise<void>;
  trackUserActivitiesBulk(userId: string, activities: Array<{ activityType: string, activityData?: any }>): Promise<void>;
  trackProfileView(viewerId: string | null, profileId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Contract template operations
  async getContractTemplates(): Promise<ContractTemplate[]> {
    return await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.isActive, true))
      .orderBy(contractTemplates.name);
  }

  async getContractTemplate(id: string): Promise<ContractTemplate | undefined> {
    const [template] = await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id));
    return template;
  }

  async createContractTemplate(template: InsertContractTemplate): Promise<ContractTemplate> {
    const [newTemplate] = await db
      .insert(contractTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  // Contract operations
  async getContracts(userId: string): Promise<Contract[]> {
    return await db
      .select()
      .from(contracts)
      .where(
        or(
          eq(contracts.createdBy, userId),
          // TODO: Add join for collaborators
        )
      )
      .orderBy(desc(contracts.updatedAt));
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, id));
    return contract;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [newContract] = await db
      .insert(contracts)
      .values(contract)
      .returning();
    return newContract;
  }

  async updateContract(id: string, updates: Partial<Contract>): Promise<Contract> {
    const [updatedContract] = await db
      .update(contracts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();
    return updatedContract;
  }

  async deleteContract(id: string): Promise<void> {
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  // Contract collaborator operations
  async getContractCollaborators(contractId: string): Promise<ContractCollaborator[]> {
    return await db
      .select()
      .from(contractCollaborators)
      .where(eq(contractCollaborators.contractId, contractId));
  }

  async addContractCollaborator(collaborator: InsertContractCollaborator): Promise<ContractCollaborator> {
    const [newCollaborator] = await db
      .insert(contractCollaborators)
      .values(collaborator)
      .returning();
    return newCollaborator;
  }

  async updateCollaboratorStatus(id: string, status: string): Promise<ContractCollaborator> {
    const [updatedCollaborator] = await db
      .update(contractCollaborators)
      .set({
        status,
        signedAt: status === "signed" ? new Date() : null,
      })
      .where(eq(contractCollaborators.id, id))
      .returning();
    return updatedCollaborator;
  }

  // Contract signature operations
  async createContractSignature(signature: InsertContractSignature): Promise<ContractSignature> {
    const [newSignature] = await db
      .insert(contractSignatures)
      .values(signature)
      .returning();
    return newSignature;
  }

  async getContractSignatures(contractId: string): Promise<ContractSignature[]> {
    return await db
      .select()
      .from(contractSignatures)
      .where(eq(contractSignatures.contractId, contractId));
  }

  // Analytics operations
  async getAnalyticsData(userId?: string): Promise<any> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const today = new Date(now.toDateString());

    // Check if user-specific analytics or global analytics
    const isUserScoped = !!userId;

    // User statistics - scope appropriately
    let totalUsers, activeUsers, newUsersToday, userGrowthRate;

    if (isUserScoped) {
      // User-specific analytics: return metrics about this specific user
      totalUsers = 1; // The user themselves
      
      // Check if user has been active in last 7 days
      const userActivityResult = await db
        .select({ count: count() })
        .from(userActivity)
        .where(
          and(
            eq(userActivity.userId, userId!),
            gte(userActivity.createdAt, sevenDaysAgo)
          )
        );
      activeUsers = userActivityResult[0]?.count > 0 ? 1 : 0;
      
      // Check if user joined today
      const userCreatedResult = await db
        .select({ createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, userId!));
      const userCreatedAt = userCreatedResult[0]?.createdAt;
      newUsersToday = userCreatedAt && userCreatedAt >= today ? 1 : 0;
      
      // User growth rate doesn't make sense for individual users
      userGrowthRate = 0;
    } else {
      // Global analytics: platform-wide metrics
      const totalUsersResult = await db.select({ count: count() }).from(users);
      totalUsers = totalUsersResult[0]?.count || 0;

      // Active users based on actual activity
      const activeUsersResult = await db
        .selectDistinct({ userId: userActivity.userId })
        .from(userActivity)
        .where(gte(userActivity.createdAt, sevenDaysAgo));
      activeUsers = activeUsersResult.length;

      const newUsersTodayResult = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, today));
      newUsersToday = newUsersTodayResult[0]?.count || 0;

      // Fix growth rate calculation: compare non-overlapping periods
      const previousMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const startOfCurrentMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const previousMonthResult = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            gte(users.createdAt, previousMonth),
            lt(users.createdAt, startOfCurrentMonth)
          )
        );
      const previousMonthUsers = previousMonthResult[0]?.count || 0;
      
      const currentMonthResult = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, startOfCurrentMonth));
      const currentMonthUsers = currentMonthResult[0]?.count || 0;
      
      userGrowthRate = previousMonthUsers > 0 ? Math.round(((currentMonthUsers - previousMonthUsers) / previousMonthUsers) * 100) : 0;
    }

    // Get real daily activity data for the last 30 days using efficient SQL aggregations
    const thirtyDaysAgoStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Efficient aggregation using SQL group by with date truncation
    let dailyLoginsData, profileViewsData;
    
    if (isUserScoped) {
      // User-scoped daily activity
      dailyLoginsData = await db
        .select({
          date: sql<string>`DATE(${userActivity.createdAt})`,
          logins: count()
        })
        .from(userActivity)
        .where(
          and(
            eq(userActivity.userId, userId!),
            eq(userActivity.activityType, 'login'),
            gte(userActivity.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(sql`DATE(${userActivity.createdAt})`)
        .orderBy(sql`DATE(${userActivity.createdAt})`);

      profileViewsData = await db
        .select({
          date: sql<string>`DATE(${profileViews.viewedAt})`,
          views: count()
        })
        .from(profileViews)
        .where(
          and(
            eq(profileViews.profileId, userId!),
            gte(profileViews.viewedAt, thirtyDaysAgo)
          )
        )
        .groupBy(sql`DATE(${profileViews.viewedAt})`)
        .orderBy(sql`DATE(${profileViews.viewedAt})`);
    } else {
      // Global daily activity
      dailyLoginsData = await db
        .select({
          date: sql<string>`DATE(${userActivity.createdAt})`,
          logins: sql<number>`COUNT(DISTINCT ${userActivity.userId})`
        })
        .from(userActivity)
        .where(
          and(
            eq(userActivity.activityType, 'login'),
            gte(userActivity.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(sql`DATE(${userActivity.createdAt})`)
        .orderBy(sql`DATE(${userActivity.createdAt})`);

      profileViewsData = await db
        .select({
          date: sql<string>`DATE(${profileViews.viewedAt})`,
          views: count()
        })
        .from(profileViews)
        .where(gte(profileViews.viewedAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${profileViews.viewedAt})`)
        .orderBy(sql`DATE(${profileViews.viewedAt})`);
    }

    // Convert aggregated data to the format expected by charts
    const dailyLoginsMap = new Map(dailyLoginsData.map(d => [d.date, Number(d.logins)]));
    const profileViewsMap = new Map(profileViewsData.map(d => [d.date, Number(d.views)]));

    // Fill in missing days with zero values for complete 30-day series
    const dailyLogins: Array<{ date: string; logins: number }> = [];
    const profileViewsDaily: Array<{ date: string; views: number }> = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      dailyLogins.push({
        date: dateStr,
        logins: dailyLoginsMap.get(dateStr) || 0
      });

      profileViewsDaily.push({
        date: dateStr,
        views: profileViewsMap.get(dateStr) || 0
      });
    }

    // Calculate profile completeness from actual user data
    const usersWithProfiles = await db
      .select({
        id: users.id,
        bio: users.bio,
        skills: users.skills,
        profileImageUrl: users.profileImageUrl,
        contactInfo: users.contactInfo
      })
      .from(users);

    const profileCompleteness = [
      { range: "0-25%", count: 0, color: "#ff6b6b" },
      { range: "26-50%", count: 0, color: "#feca57" },
      { range: "51-75%", count: 0, color: "#48dbfb" },
      { range: "76-100%", count: 0, color: "#1dd1a1" }
    ];

    usersWithProfiles.forEach(user => {
      let completeness = 0;
      if (user.bio) completeness += 25;
      if (user.skills && user.skills.length > 0) completeness += 25;
      if (user.profileImageUrl) completeness += 25;
      if (user.contactInfo && (user.contactInfo as any)?.phone) completeness += 25;

      if (completeness <= 25) profileCompleteness[0].count++;
      else if (completeness <= 50) profileCompleteness[1].count++;
      else if (completeness <= 75) profileCompleteness[2].count++;
      else profileCompleteness[3].count++;
    });

    // Extract top skills from actual user data
    const skillCounts: { [key: string]: number } = {};
    usersWithProfiles.forEach(user => {
      if (user.skills && Array.isArray(user.skills)) {
        user.skills.forEach((skill: string) => {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        });
      }
    });

    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([skill, count]) => ({ skill, count }));

    // Extract locations from user contact info
    const locationCounts: { [key: string]: number } = {};
    usersWithProfiles.forEach(user => {
      if (user.contactInfo && (user.contactInfo as any)?.location) {
        const location = (user.contactInfo as any).location;
        locationCounts[location] = (locationCounts[location] || 0) + 1;
      }
    });

    const usersByLocation = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }));

    return {
      userStats: {
        totalUsers,
        activeUsers,
        newUsersToday,
        userGrowthRate
      },
      activityStats: {
        dailyLogins,
        profileViews: profileViewsDaily,
        messagesSent: [] // TODO: Implement when messaging system is built
      },
      userEngagement: {
        profileCompleteness,
        topSkills,
        usersByLocation
      }
    };
  }

  async trackUserActivity(userId: string, activityType: string, activityData?: any): Promise<void> {
    await db.insert(userActivity).values({
      userId,
      activityType,
      activityData: activityData ? activityData : null
    });
  }

  async trackUserActivitiesBulk(userId: string, activities: Array<{ activityType: string, activityData?: any }>): Promise<void> {
    if (activities.length === 0) return;
    
    const activityRecords = activities.map(activity => ({
      userId,
      activityType: activity.activityType,
      activityData: activity.activityData ? activity.activityData : null
    }));
    
    // True bulk insert - single database operation
    await db.insert(userActivity).values(activityRecords);
  }

  async trackProfileView(viewerId: string | null, profileId: string): Promise<void> {
    await db.insert(profileViews).values({
      viewerId,
      profileId
    });
  }
}

export const storage = new DatabaseStorage();
