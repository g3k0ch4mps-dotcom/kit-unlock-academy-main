import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to known origins instead of "*". Additional origins can be
// supplied via the ALLOWED_ORIGINS env var (comma-separated). *.lovable.app
// preview/production hosts are allowed by default.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8080,http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "https:" && (hostname === "lovable.app" || hostname.endsWith(".lovable.app"));
  } catch {
    return false;
  }
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = isAllowedOrigin(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, programId, sessionId, answers, programTitle, programCategory } = await req.json();

    // ACTION 1: Generate assessment questions for a program
    if (action === "generate_questions") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an educational assessment expert for Mamuza Engineering, a Kenyan STEM learning platform. Generate exactly 5 multiple-choice questions to assess a learner's current skill level for a specific program. The questions should progressively increase in difficulty from absolute beginner to advanced.

Return ONLY valid JSON array, no markdown, no code blocks. Each question object must have:
- "question": the question text
- "options": array of 4 option strings
- "difficulty": "beginner", "intermediate", or "advanced"
- "correct_index": index of correct answer (0-3)

Make questions relevant to ${programCategory || "STEM"} and practical, referencing real-world scenarios in Kenya/Africa.`,
            },
            {
              role: "user",
              content: `Generate 5 assessment questions for the program: "${programTitle}". Questions should help determine if the learner is a beginner, intermediate, or advanced in this topic area.`,
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI service error");
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "[]";
      // Strip markdown code blocks if present
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      let questions;
      try {
        questions = JSON.parse(content);
      } catch {
        questions = [];
      }

      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION 2: Submit assessment and determine skill level
    if (action === "submit_assessment") {
      if (!programId || !answers) throw new Error("Missing programId or answers");

      // Calculate score: each answer has difficulty weight
      let beginnerCorrect = 0, beginnerTotal = 0;
      let intermediateCorrect = 0, intermediateTotal = 0;
      let advancedCorrect = 0, advancedTotal = 0;

      for (const a of answers) {
        if (a.difficulty === "beginner") { beginnerTotal++; if (a.correct) beginnerCorrect++; }
        if (a.difficulty === "intermediate") { intermediateTotal++; if (a.correct) intermediateCorrect++; }
        if (a.difficulty === "advanced") { advancedTotal++; if (a.correct) advancedCorrect++; }
      }

      let skillLevel = "beginner";
      const beginnerRate = beginnerTotal > 0 ? beginnerCorrect / beginnerTotal : 0;
      const intermediateRate = intermediateTotal > 0 ? intermediateCorrect / intermediateTotal : 0;
      const advancedRate = advancedTotal > 0 ? advancedCorrect / advancedTotal : 0;

      if (advancedRate >= 0.5 && intermediateRate >= 0.5) {
        skillLevel = "advanced";
      } else if (intermediateRate >= 0.5 && beginnerRate >= 0.5) {
        skillLevel = "intermediate";
      }

      // Upsert assessment
      const { error } = await supabase
        .from("user_assessments")
        .upsert({
          user_id: user.id,
          program_id: programId,
          skill_level: skillLevel,
          answers: answers,
        }, { onConflict: "user_id,program_id" });

      if (error) throw error;

      return new Response(JSON.stringify({ skillLevel }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION 3: Personalize a session's content
    if (action === "personalize_session") {
      if (!sessionId || !programId) throw new Error("Missing sessionId or programId");

      // Get user's assessment
      const { data: assessment } = await supabase
        .from("user_assessments")
        .select("skill_level")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .maybeSingle();

      if (!assessment) {
        return new Response(JSON.stringify({ error: "No assessment found. Please complete the assessment first." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check for cached personalized content
      const { data: cached } = await supabase
        .from("personalized_content")
        .select("*")
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .eq("skill_level", assessment.skill_level);

      if (cached && cached.length > 0) {
        return new Response(JSON.stringify({ personalized: cached, skillLevel: assessment.skill_level, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get original content blocks
      const { data: blocks } = await supabase
        .from("content_blocks")
        .select("*")
        .eq("session_id", sessionId)
        .order("block_order");

      if (!blocks || blocks.length === 0) {
        return new Response(JSON.stringify({ personalized: [], skillLevel: assessment.skill_level }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only personalize text-heavy blocks (text, introduction, problem, solution, feedback, components, questions)
      const textBlocks = blocks.filter(b => 
        ["text", "introduction", "problem", "solution", "feedback", "components", "questions", "safety_note", "tip"].includes(b.block_type)
        && b.content
      );

      if (textBlocks.length === 0) {
        return new Response(JSON.stringify({ personalized: [], skillLevel: assessment.skill_level }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const levelDescriptions: Record<string, string> = {
        beginner: "Use very simple language, explain every technical term, add extra context and analogies. Assume zero prior knowledge. Use everyday examples from Kenya/Africa.",
        intermediate: "Use moderate technical language, briefly explain complex terms. Assume basic understanding of electronics and programming. Reference practical applications.",
        advanced: "Use technical language freely, skip basic explanations, add deeper insights, optimization tips, and advanced variations. Reference industry standards and best practices.",
      };

      // Batch personalize
      const contentForAI = textBlocks.map(b => ({
        id: b.id,
        type: b.block_type,
        title: b.title,
        content: b.content?.substring(0, 3000), // Limit to avoid token overflow
      }));

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an expert content adapter for Mamuza Engineering. Rewrite session content to match the learner's skill level.

SKILL LEVEL: ${assessment.skill_level}
ADAPTATION RULES: ${levelDescriptions[assessment.skill_level]}

CRITICAL RULES:
- Keep the same structure and meaning
- DO NOT change any code blocks - keep them exactly as-is
- DO NOT use ** for bold - use UPPERCASE or headings
- DO NOT add emojis
- Keep all safety notes and tips
- Maintain Mamuza Engineering branding
- Use examples relevant to Kenya/Africa
- Return valid JSON array only, no markdown code blocks

Return a JSON array where each item has:
- "id": the original block id
- "content": the adapted content text`,
            },
            {
              role: "user",
              content: `Adapt these ${textBlocks.length} content blocks for a ${assessment.skill_level} learner:\n\n${JSON.stringify(contentForAI)}`,
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Usage limit reached." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI personalization error");
      }

      const aiData = await response.json();
      let aiContent = aiData.choices?.[0]?.message?.content || "[]";
      aiContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let adapted;
      try {
        adapted = JSON.parse(aiContent);
      } catch {
        // If parsing fails, return original content
        return new Response(JSON.stringify({ personalized: [], skillLevel: assessment.skill_level, parseError: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cache the personalized content
      const inserts = adapted.map((item: any) => ({
        user_id: user.id,
        session_id: sessionId,
        original_block_id: item.id,
        personalized_text: item.content,
        skill_level: assessment.skill_level,
      }));

      if (inserts.length > 0) {
        await supabase.from("personalized_content").insert(inserts);
      }

      return new Response(JSON.stringify({ personalized: adapted, skillLevel: assessment.skill_level, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION 4: Generate session quiz based on content
    if (action === "generate_session_quiz") {
      if (!sessionId || !programId) throw new Error("Missing sessionId or programId");

      // Get user's skill level
      const { data: assessment } = await supabase
        .from("user_assessments")
        .select("skill_level")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .maybeSingle();

      const skillLevel = assessment?.skill_level || "beginner";

      // Get session content
      const { data: blocks } = await supabase
        .from("content_blocks")
        .select("content, title, block_type")
        .eq("session_id", sessionId)
        .order("block_order");

      const contentSummary = (blocks || [])
        .filter(b => b.content)
        .map(b => `${b.title || ""}: ${b.content?.substring(0, 500)}`)
        .join("\n\n")
        .substring(0, 4000);

      // Get session title
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("title")
        .eq("id", sessionId)
        .maybeSingle();

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an educational quiz generator for Mamuza Engineering. Generate 5-10 multiple-choice questions based on the session content provided. Questions should match the learner's ${skillLevel} level.

Return ONLY a valid JSON array. No markdown, no code blocks. Each question object must have:
- "id": a unique string like "q1", "q2", etc.
- "question": the question text
- "options": array of 4 option strings
- "correct_index": index of correct answer (0-3)

Rules:
- Questions must be directly based on the session content
- Vary difficulty but keep aligned with ${skillLevel} level
- Make options plausible to test real understanding
- Use practical, real-world framing where possible`,
            },
            {
              role: "user",
              content: `Generate quiz questions for the session "${sessionData?.title || "Session"}". Here is the session content:\n\n${contentSummary}`,
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI quiz generation error");
      }

      const aiData = await response.json();
      let content = aiData.choices?.[0]?.message?.content || "[]";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let questions;
      try {
        questions = JSON.parse(content);
      } catch {
        questions = [];
      }

      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION 5: Regenerate personalized content
    if (action === "regenerate") {
      if (!sessionId) throw new Error("Missing sessionId");

      // Delete cached content for this session
      await supabase
        .from("personalized_content")
        .delete()
        .eq("user_id", user.id)
        .eq("session_id", sessionId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[personalize-content] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
