import {
  users,
  contracts,
  contractTemplates,
  contractCollaborators,
  contractSignatures,
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
import { eq, desc, and, or } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
