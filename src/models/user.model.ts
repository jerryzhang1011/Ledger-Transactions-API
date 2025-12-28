import { db } from '../database/connection.js';
import { User, UserResponse } from '../types/database.js';

export interface CreateUserData {
  email: string;
  name?: string;
  avatarUrl?: string;
  provider: string;
  providerId: string;
}

export class UserModel {
  private static tableName = 'users';

  static async findById(id: string): Promise<User | null> {
    const user = await db<User>(this.tableName).where({ id }).first();
    return user || null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const user = await db<User>(this.tableName).where({ email }).first();
    return user || null;
  }

  static async findByProvider(provider: string, providerId: string): Promise<User | null> {
    const user = await db<User>(this.tableName)
      .where({ provider, provider_id: providerId })
      .first();
    return user || null;
  }

  static async create(data: CreateUserData): Promise<User> {
    const [user] = await db<User>(this.tableName)
      .insert({
        email: data.email,
        name: data.name || null,
        avatar_url: data.avatarUrl || null,
        provider: data.provider,
        provider_id: data.providerId,
      })
      .returning('*');

    return user;
  }

  static async findOrCreate(data: CreateUserData): Promise<{ user: User; isNew: boolean }> {
    const existingUser = await this.findByProvider(data.provider, data.providerId);

    if (existingUser) {
      // Update user info if changed
      const [updatedUser] = await db<User>(this.tableName)
        .where({ id: existingUser.id })
        .update({
          name: data.name || existingUser.name,
          avatar_url: data.avatarUrl || existingUser.avatar_url,
          updated_at: new Date(),
        })
        .returning('*');

      return { user: updatedUser, isNew: false };
    }

    const newUser = await this.create(data);
    return { user: newUser, isNew: true };
  }

  static async update(id: string, data: Partial<CreateUserData>): Promise<User | null> {
    const [user] = await db<User>(this.tableName)
      .where({ id })
      .update({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.avatarUrl !== undefined && { avatar_url: data.avatarUrl }),
        updated_at: new Date(),
      })
      .returning('*');

    return user || null;
  }

  static toResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at.toISOString(),
    };
  }
}

