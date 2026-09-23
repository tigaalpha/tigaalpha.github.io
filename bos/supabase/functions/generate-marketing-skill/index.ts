import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, generateWithModel } from "../_shared/ai-provider.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";

/* ── Tool definitions for each skill type ── */

const RETURN_CONTENT_TOOL: ToolDefinition = {
  name: "return_content",
  description: "Return the generated content. Call this exactly once with the complete result.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "A short descriptive title for this content" },
      content: { type: "string", description: "The full generated content as formatted text" },
      summary: { type: "string", description: "1-2 sentence summary of what was generated" },
      tags: { type: "array", items: { type: "string" }, description: "3-5 relevant tags/hashtags" },
    },
    required: ["title", "content", "summary", "tags"],
  },
};

interface ContentResult {
  title: string;
  content: string;
  summary: string;
  tags: string[];
}

/* ── Skill prompts by tool type ── */

function getSystemPrompt(toolType: string, language: string): string {
  const langLabel = language === "th" ? "Thai" : language === "zh" ? "Chinese (Mandarin)" : "English";
  const brandContext = `Brand: Tiga Studio — a piano learning studio offering 1-on-1 courses (40hrs, 27,000 THB), online video courses (Piano Mindset 990 THB, 0 to HERO 1,490 THB), and free trial lessons. Target: parents of children aged 4-15 in Bangkok. Tone: authoritative but warm, expert but approachable.`;

  const prompts: Record<string, string> = {
    // ── Tier 1: Writing Formats ──
    "hook-writer": `You are an expert viral hook writer for social media. Write the first 1-3 seconds of content that stops the scroll.

${brandContext}

Rules:
- Write exactly 10 hook variations
- Each hook must use a different archetype: Contrarian, Curiosity Gap, Bold Claim, Story Opener, Question Hook, Statistic Shock, Fear of Missing Out, Transformation Promise, Challenge, Insider Secret
- Each hook must be 1-2 sentences max
- Make them punchy, specific, and impossible to skip
- Write in ${langLabel}
- Include a brief note on WHY each hook works

Format each hook as:
**[Archetype Name]**
"[The hook text]"
_Why it works: brief explanation_`,

    "caption-writer": `You are an expert social media caption writer. Create platform-optimized captions.

${brandContext}

Rules:
- Write 5 different caption variations for the given platform and topic
- Each caption should have: opening hook, body, CTA, and hashtags
- Adapt tone and length to the platform
- Include 5-8 relevant hashtags per caption
- Write in ${langLabel}

Format:
**Caption 1: [Style Name]**
[Caption text with line breaks]
---
Hashtags: #tag1 #tag2 #tag3

**Caption 2: [Style Name]**
...`,

    "tiktok-script": `You are a TikTok scriptwriting expert. Create a 25-line vertical video script.

${brandContext}

Rules:
- Exactly 25 lines (no more, no less)
- Line 1: Open with a scroll-stopping hook (3 seconds)
- Line 2: CTA to follow/save
- Lines 3-20: Core content with dopamine triggers every 1-2 lines
- Include at least 1 strategic plot twist
- Lines 21-25: Strong closing CTA
- No scene descriptions, just spoken text
- Each line = one beat of the script
- Write in ${langLabel}

Format the output as a clean numbered list 1-25.`,

    "reels-script": `You are an Instagram Reels scriptwriting expert. Create a 20-line Reels script.

${brandContext}

Rules:
- Exactly 20 lines for a 30-60 second Reel
- Line 1: Pattern interrupt hook
- Lines 2-15: Value delivery with visual cues noted as [VISUAL: description]
- Include on-screen text suggestions as [TEXT: suggestion]
- Lines 16-20: CTA and loop prompt
- Optimize for Sends Per Reach (save-worthy content)
- Write in ${langLabel}

Format as numbered script with visual cues inline.`,

    "linkedin-post": `You are a LinkedIn post writing expert. Create professional, engaging posts.

${brandContext}

Rules:
- Write 3 different LinkedIn post variations
- Each post: Hook line → Line break → Story/Insight → Takeaway → CTA
- Use the "3-line paragraph" format (short paragraphs)
- Include a personal/brand story element
- End with a question to drive comments
- Professional but not corporate — thought leadership tone
- Write in ${langLabel}

Format each as:
**Post 1: [Angle]**
[Full post text with line breaks]

---

**Post 2: [Angle]**
...`,

    "thread-writer": `You are an X/Twitter thread writing expert. Create engaging thread formats.

${brandContext}

Rules:
- Write a thread of exactly 8 tweets
- Tweet 1: Hook that makes people click "Show this thread"
- Tweet 2: Context/setup
- Tweets 3-6: Core value (one insight per tweet)
- Tweet 7: Unexpected twist or advanced insight
- Tweet 8: Summary + CTA to follow
- Each tweet ≤280 characters
- Use bullet points and numbers within tweets
- Write in ${langLabel}

Format:
**1/** [Hook tweet]
**2/** [Context]
...`,

    "carousel-writer": `You are a carousel content expert. Create slide-by-slide carousel content for Instagram/LinkedIn.

${brandContext}

Rules:
- Create a 10-slide carousel
- Slide 1: Bold title slide (hook)
- Slides 2-9: One key insight per slide (max 30 words each)
- Slide 10: Summary + CTA
- Each slide should work standalone but flow as a story
- Include design notes as [DESIGN: description]
- Write in ${langLabel}

Format:
**Slide 1: [Title]**
[Content]
[DESIGN: visual suggestion]

**Slide 2: [Title]**
...`,

    // ── Tier 2: Strategy & Planning ──
    "content-calendar": `You are a content calendar strategist. Create a detailed 2-week content calendar.

${brandContext}

Rules:
- Create a 14-day calendar (Mon-Sun, 2 weeks)
- For each day specify: Platform, Content Type, Topic, Hook, Best Posting Time, Objective
- Maintain a good mix: 40% educational, 30% engagement, 20% promotional, 10% trending
- Include at least 3 platforms (TikTok, Instagram, Facebook, LinkedIn, X)
- Each post should have a unique angle
- Write in ${langLabel}

Format as a table-like structure:

**Week 1**
| Day | Platform | Type | Topic | Hook | Time | Goal |
|---|---|---|---|---|---|---|
| Mon | TikTok | Educational | ... | ... | 12:00 | Awareness |

**Week 2**
...`,

    "hashtag-strategy": `You are a hashtag research strategist. Create a comprehensive hashtag strategy.

${brandContext}

Rules:
- Research and suggest hashtags across 3 tiers:
  - Tier 1 (5-10): High volume (>1M posts) — for reach
  - Tier 2 (10-15): Medium volume (100K-1M) — for relevance  
  - Tier 3 (5-10): Low volume (<100K) — for niche targeting
- Include platform-specific hashtag sets (TikTok vs Instagram vs LinkedIn)
- Explain the strategy behind each tier
- Include banned/avoid hashtags for this niche
- Write in ${langLabel}

Format:
**Platform: [Name]**
Tier 1 (Reach): #tag1, #tag2...
Tier 2 (Relevance): #tag1, #tag2...
Tier 3 (Niche): #tag1, #tag2...
Avoid: #tag1, #tag2...
Strategy: [explanation]`,

    "repurpose": `You are a content repurposing expert. Transform one piece of content into multiple platform formats.

${brandContext}

Rules:
- Take the input content and repurpose it into 7 platform-specific formats:
  1. TikTok (15-60s script)
  2. Instagram Reel (30s script)
  3. Instagram Carousel (10 slides outline)
  4. LinkedIn Post (thought leadership)
  5. X/Twitter Thread (5 tweets)
  6. Facebook Post (long-form)
  7. YouTube Shorts description + tags
- Each format should be native to the platform
- Maintain the core message but adapt tone/length
- Write in ${langLabel}

Format each with clear headers for each platform.`,

    // ── Tier 3: Brand & Research ──
    "brand-profile": `You are a brand strategist. Build a comprehensive brand profile.

${brandContext}

Rules:
- Create a complete brand profile document covering:
  1. Brand Mission (1 sentence)
  2. Brand Vision (1 sentence)
  3. Core Values (3-5 values with explanations)
  4. Target Audience Persona (detailed)
  5. Brand Voice (adjectives + examples)
  6. Visual Direction (colors, mood, style)
  7. Key Messages (3-5 core messages)
  8. Brand Story (short paragraph)
  9. Competitor Positioning
  10. Unique Selling Proposition
- Write in ${langLabel}

Format as a structured brand document with clear sections.`,

    "voice-guide": `You are a voice and tone expert. Create a brand voice guide.

${brandContext}

Rules:
- Create a voice guide with:
  1. Voice Attributes (3-4 adjectives with do/don't examples)
  2. Tone Spectrum (how voice adapts to: Sales, Support, Social, Educational)
  3. Writing Rules (sentence structure, word choices, banned words)
  4. Before/After examples (5 transformations from generic to on-brand)
  5. Emoji & Punctuation Guidelines
  6. Platform-Specific Adaptations
- Write in ${langLabel}

Format with clear sections and practical examples.`,

    "audience-research": `You are an audience research specialist. Create a detailed audience analysis.

${brandContext}

Rules:
- Create an audience analysis covering:
  1. Primary Persona (detailed demographics, psychographics, behaviors)
  2. Secondary Persona
  3. Pain Points (5-7 specific to piano learning)
  4. Desires & Aspirations (what success looks like)
  5. Objections (why they hesitate + counter-messages)
  6. Content Preferences (what they consume, where, when)
  7. Decision Journey (awareness → consideration → purchase)
  8. Language & Phrases they actually use
- Write in ${langLabel}

Format as a research report with clear sections.`,

    "dm-script": `You are a social selling expert. Create DM conversation scripts.

${brandContext}

Rules:
- Create DM scripts for 5 scenarios:
  1. Cold outreach to a new lead
  2. Follow-up after someone engages with content
  3. Handling price objections
  4. Closing a warm lead
  5. Re-engaging a cold lead
- Each script: Opening → Bridge → Value → CTA
- Include "if they say X, you say Y" variations
- Natural, conversational tone (not salesy)
- Write in ${langLabel}

Format each scenario as a conversation flow with branching paths.`,

    "funnel-builder": `You are a funnel strategy expert. Create a lead generation funnel.

${brandContext}

Rules:
- Design a complete funnel:
  1. Lead Magnet (3 ideas with descriptions)
  2. Landing Page Copy (headline, subhead, bullets, CTA)
  3. Email Sequence (5 emails: Welcome → Value → Story → Offer → Close)
  4. Tripwire Offer (low-ticket entry product)
  5. Core Offer Presentation
  6. Upsell Path
  7. Retargeting Ad Copy (3 variations)
- Write in ${langLabel}

Format as a step-by-step funnel blueprint.`,

    // ── Tier 4: Advanced Growth ──
    "story-structure": `You are a storytelling expert for social media. Create narrative frameworks.

${brandContext}

Rules:
- Create 5 story structures for marketing content:
  1. The Hero's Journey (customer as hero)
  2. Before-After-Bridge
  3. Problem-Agitate-Solve
  4. The Epiphany Story
  5. The Underdog Story
- For each: outline + filled example for Tiga Studio
- Include emotional beats and dopamine triggers
- Write in ${langLabel}

Format with framework outline followed by a filled example.`,

    "community-building": `You are a community building strategist. Create engagement frameworks.

${brandContext}

Rules:
- Create a community building plan:
  1. Community Pillars (3-5 content themes)
  2. Engagement Rituals (daily/weekly activities)
  3. User-Generated Content Prompts (10 ideas)
  4. Discussion Starters (10 questions)
  5. Community Challenges (3 monthly challenges)
  6. Loyalty/Reward Structure
  7. Moderation Guidelines
- Write in ${langLabel}

Format as an actionable community playbook.`,

    "ab-testing": `You are an A/B testing expert. Create testing frameworks.

${brandContext}

Rules:
- Create an A/B testing plan:
  1. 5 Hook Variations to test (with hypothesis)
  2. 3 CTA Variations (with hypothesis)
  3. 3 Posting Time Tests
  4. 3 Content Format Tests
  5. 3 Caption Length Tests
- For each: Hypothesis → Variant A → Variant B → Success Metric → Duration
- Write in ${langLabel}

Format as structured test cards.`,

    "paid-ads": `You are a paid advertising expert. Create ad copy and strategy.

${brandContext}

Rules:
- Create ad materials:
  1. Facebook/Instagram Ads (3 variations: awareness, consideration, conversion)
  2. Google Search Ads (3 variations with keywords)
  3. TikTok Ads (2 variations: in-feed, spark ads)
  4. Retargeting Ad Copy (2 variations)
  5. Landing Page Headlines (5 variations)
  6. Budget Allocation Recommendation
- Each ad: Headline → Primary Text → CTA → Visual Description
- Write in ${langLabel}

Format as ready-to-use ad copy with targeting notes.`,

    "analytics-report": `You are a social media analytics expert. Create a reporting template.

${brandContext}

Rules:
- Create a weekly analytics report template:
  1. KPI Dashboard (metrics to track per platform)
  2. Content Performance Ranking template
  3. Audience Growth Analysis template
  4. Engagement Rate Benchmarks
  5. Top Performing Content Analysis framework
  6. Week-over-Week Comparison format
  7. Action Items & Recommendations format
  8. Goals vs Actuals tracker
- Write in ${langLabel}

Format as a fill-in analytics report template.`,

    // ── Tier 5: Advanced Strategies ──
    "content-pillars": `You are a content strategy architect. Build content pillar frameworks.

${brandContext}

Rules:
- Create 5 content pillars:
  1. Educational (teach piano/music knowledge)
  2. Inspirational (success stories, transformations)
  3. Behind-the-scenes (studio life, teacher insights)
  4. Entertaining (music challenges, fun facts)
  5. Promotional (courses, offers, events)
- For each pillar: 10 content ideas with hooks
- Include the 80/20 rule application
- Write in ${langLabel}

Format as pillar cards with content ideas underneath.`,

    "trend-jacking": `You are a trend-jacking expert. Create trend-based content strategies.

${brandContext}

Rules:
- Create a trend-jacking playbook:
  1. Current trending formats on TikTok/Reels (describe 5)
  2. How to adapt each trend to piano/music niche
  3. Trend evaluation framework (3 questions to ask before joining)
  4. 10 ready-to-use trend adaptations
  5. Timing guidelines (when to jump on vs skip)
  6. Risk management (what NOT to trend-jack)
- Write in ${langLabel}

Format as an actionable playbook with examples.`,

    "engagement-routine": `You are an engagement strategy expert. Create daily/weekly engagement routines.

${brandContext}

Rules:
- Create a structured engagement routine:
  1. Morning Routine (15 min): platforms, actions, targets
  2. Midday Check (10 min): respond, engage, monitor
  3. Evening Routine (15 min): community management, planning
  4. Weekly Deep Dive (1 hour): analysis, strategy adjustment
  5. Engagement Templates (10 reply templates for common comments)
  6. Outreach Scripts (5 DM templates for relationship building)
- Include specific time blocks and platform priorities
- Write in ${langLabel}

Format as a daily planner with actionable steps.`,

    "social-seo": `You are a social media SEO expert. Optimize content for platform search.

${brandContext}

Rules:
- Create a Social SEO guide:
  1. Platform-specific keyword research method
  2. TikTok SEO (keywords in captions, on-screen text, hashtags)
  3. Instagram SEO (alt text, captions, hashtags, bio)
  4. YouTube SEO (titles, descriptions, tags, chapters)
  5. Pinterest SEO (pin descriptions, board names, keywords)
  6. LinkedIn SEO (headline, about, article keywords)
  7. 20 high-value keywords for piano/music niche
  8. SEO-optimized content templates
- Write in ${langLabel}

Format as an actionable SEO playbook per platform.`,
  };

  return prompts[toolType] || `You are a marketing expert. Generate high-quality marketing content for the given topic. Write in ${langLabel}. ${brandContext}`;
}

/* ── Edge Function ── */

const VALID_TOOL_TYPES = [
  // Tier 1
  "hook-writer", "caption-writer", "tiktok-script", "reels-script", "linkedin-post", "thread-writer", "carousel-writer",
  // Tier 2
  "content-calendar", "hashtag-strategy", "repurpose",
  // Tier 3
  "brand-profile", "voice-guide", "audience-research", "dm-script", "funnel-builder",
  // Tier 4
  "story-structure", "community-building", "ab-testing", "paid-ads", "analytics-report",
  // Tier 5
  "content-pillars", "trend-jacking", "engagement-routine", "social-seo",
];

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-marketing-skill", { windowMinutes: 60, maxRequests: 20 });

    const { toolType, topic, language = "th", model, extraContext = "" } = await req.json();

    if (!toolType || !VALID_TOOL_TYPES.includes(toolType)) {
      return jsonResponse({ error: `Invalid toolType. Valid types: ${VALID_TOOL_TYPES.join(", ")}` }, 400);
    }
    if (!topic) {
      return jsonResponse({ error: "topic is required" }, 400);
    }

    const systemPrompt = getSystemPrompt(toolType, language);
    const userPrompt = `Task: ${toolType.replace(/-/g, " ").toUpperCase()}
Topic/Focus: ${topic}
${extraContext ? `Additional context: ${extraContext}` : ""}

Generate the content now. You MUST call the return_content tool with the complete result.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    const result = model
      ? await generateWithModel(model, messages, [RETURN_CONTENT_TOOL], 0.8, 4096)
      : await generate(messages, [RETURN_CONTENT_TOOL], 0.8, 4096, "content");

    await logAiUsage(admin, result.usage, `marketing-skill:${toolType}`);

    const call = result.message.toolCalls?.find((c) => c.name === "return_content");
    let args = call ? (call.arguments as unknown as ContentResult) : null;

    // Fallback: if AI returned plain text instead of tool call
    if (!args && result.message.content) {
      const text = result.message.content.trim();
      if (text.length > 50) {
        args = {
          title: `${toolType.replace(/-/g, " ")} — ${topic}`,
          content: text,
          summary: text.slice(0, 200),
          tags: [toolType, topic.slice(0, 30)],
        };
      }
    }

    if (!args) {
      return jsonResponse({ error: "AI did not return content. Please try again." }, 502);
    }

    return jsonResponse({
      result: {
        toolType,
        topic,
        language,
        title: args.title,
        content: args.content,
        summary: args.summary,
        tags: args.tags,
        model: model || "default",
        createdAt: new Date().toISOString(),
      },
    }, 200);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-marketing-skill", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-marketing-skill", error);
  }
});
