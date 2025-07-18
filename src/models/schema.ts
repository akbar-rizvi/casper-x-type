import { serial,varchar,pgTable,primaryKey, jsonb, timestamp } from 'drizzle-orm/pg-core';


export const users: any = pgTable("users", {
  id: serial("id"),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }),
  createdAt:timestamp("created_at").notNull().defaultNow(),
});
  



  