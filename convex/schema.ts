import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    passwordHash: v.string(),
    displayName: v.string(),
    personId: v.string(),
    isAdmin: v.optional(v.boolean()),
    icon: v.optional(v.string()),
    mustChangePassword: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  }).index("by_username", ["username"]).index("by_token", ["sessionToken"]),
  people: defineTable({ key: v.string(), name: v.string(), color: v.string() }).index("by_key", ["key"]),
  settings: defineTable({
    key: v.string(),
    phase: v.union(v.literal("ideas"), v.literal("voting"), v.literal("shortlist"), v.literal("playing")),
    gameName: v.string(),
    endsAt: v.number(),
    timezone: v.optional(v.string()),
    votingStartsAt: v.optional(v.number()),
    shortlistStartsAt: v.optional(v.number()),
    playingStartsAt: v.optional(v.number()),
    eventStartsAt: v.optional(v.number()),
  }).index("by_key", ["key"]),
  ideas: defineTable({
    text: v.string(),
    authorId: v.id("users"),
    personKeys: v.array(v.string()),
    createdAt: v.number(),
    shortlisted: v.boolean(),
  }),
  ballots: defineTable({
    userId: v.id("users"),
    rankedIdeaIds: v.array(v.id("ideas")),
    submittedAt: v.number(),
  }).index("by_user", ["userId"]),
  cards: defineTable({
    userId: v.id("users"),
    ideaIds: v.array(v.id("ideas")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  checks: defineTable({
    userId: v.id("users"),
    ideaId: v.id("ideas"),
    comment: v.string(),
    checkedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_idea", ["userId", "ideaId"]),
  wins: defineTable({
    userId: v.id("users"),
    wonAt: v.number(),
  }).index("by_user", ["userId"]).index("by_wonAt", ["wonAt"]),
});
