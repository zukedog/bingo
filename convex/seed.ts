import { mutation } from "./_generated/server";
import { hashPassword } from "./passwords";

const ideaTexts = [
  "Someone starts a wildly ambitious side project", "A group chat plan actually makes it out of the group chat",
  "Someone gets unexpectedly obsessed with running", "We all end up at karaoke on a weeknight",
  "Someone moves house and swears it is the last time", "A holiday is booked less than 48 hours before leaving",
  "Someone appears in the background of the news", "A new hobby takes over the entire group chat",
  "Someone buys a very questionable statement chair", "There is a dramatic return to a forgotten hairstyle",
  "Someone hosts a dinner party with a printed menu", "A casual walk accidentally becomes a hike",
  "Someone says 'I could make that' and actually does", "We invent a phrase nobody outside the group understands",
  "Someone gets a pet", "A birthday celebration lasts more than three days",
  "Someone completes a project they have mentioned for years", "We attend an event purely for the snacks",
  "Someone becomes a regular at a suspiciously niche venue", "A spontaneous road trip happens",
  "Someone starts making their own hot sauce", "We recreate an old group photo",
  "Someone wins a competition they forgot entering", "A recommendation changes everyone's personality for a month",
  "Someone learns an oddly specific practical skill", "A group dinner ends with dancing",
  "Someone gets upgraded for no clear reason", "We all agree on a film first try",
  "Someone has a surprisingly wholesome celebrity encounter", "A small purchase becomes a major personality trait",
  "Someone deletes social media for at least a month", "We make matching shirts for an event",
  "Someone gives a speech with no warning", "A recipe becomes group canon", "Someone gets a tattoo",
  "We collectively keep a plant alive", "Someone is quoted in an article", "A game night gets intensely competitive",
  "Someone changes career direction", "A running joke becomes real merchandise", "Someone travels somewhere none of us have heard of",
  "We celebrate a very minor achievement like a major one", "Someone performs in public", "An old friend unexpectedly rejoins the orbit",
  "Someone goes viral for something deeply ordinary", "We start an annual tradition", "Someone learns to make excellent bread",
  "A planned quiet night becomes legendary", "Someone meets their personal hero", "We finish a group project on time",
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("users").first()) return "Already seeded";
    const people = [["josh", "Josh", "#8f72c7"], ["alex", "Alex", "#ff6b4a"], ["jamie", "Jamie", "#7e9f56"], ["sam", "Sam", "#e0a634"], ["taylor", "Taylor", "#7596d2"], ["everyone", "Everyone", "#232320"]];
    await Promise.all(people.map(([key, name, color]) => ctx.db.insert("people", { key, name, color })));
    const demoHash = await hashPassword("demo");
    const userIds = await Promise.all(people.slice(0, 5).map(([personId, name]) => ctx.db.insert("users", { username: personId, passwordHash: demoHash, displayName: name, personId, isAdmin: personId === "josh", mustChangePassword: true })));
    await ctx.db.insert("settings", { key: "main", phase: "ideas", gameName: "Family Bingo", endsAt: new Date("2026-12-31T23:59:59+10:30").getTime() });
    await Promise.all(ideaTexts.map((text, i) => ctx.db.insert("ideas", {
      text,
      personKeys: i % 9 === 0 ? ["alex"] : i % 7 === 0 ? ["jamie"] : i % 5 === 0 ? ["sam"] : ["everyone"],
      authorId: userIds[i % userIds.length],
      createdAt: Date.now() - i * 1000,
      shortlisted: true,
    })));
    return "Seeded. Demo users use password: demo";
  },
});
