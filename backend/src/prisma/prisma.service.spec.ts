jest.mock('@prisma/client', () => ({ PrismaClient: class PrismaClient {} }));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

import { PrismaService } from './prisma.service';

describe('production database transport', () => {
  const originalEnv = { ...process.env };
  afterEach(() => { process.env = { ...originalEnv }; });

  it.each(['', '?sslmode=disable', '?sslmode=require'])('rejects an unverified production connection %s', (query) => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = `postgresql://user:password@db.example/postgres${query}`;
    expect(() => new PrismaService()).toThrow('sslmode=verify-full');
  });

  it('accepts verified TLS in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:password@db.example/postgres?sslmode=verify-full';
    expect(() => new PrismaService()).not.toThrow();
  });

  it('keeps local development databases usable', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost/postgres';
    expect(() => new PrismaService()).not.toThrow();
  });
});
