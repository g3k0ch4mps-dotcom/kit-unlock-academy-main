import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
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
  const allowOrigin = isAllowedOrigin(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch content blocks
    const { data: blocks, error: blocksError } = await supabase
      .from("content_blocks")
      .select("*")
      .eq("session_id", sessionId)
      .order("block_order");

    if (blocksError) throw blocksError;

    if (!blocks || blocks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No content blocks found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build content summary
    const contentText = blocks
      .map(
        (b: any) =>
          `${b.title || "Untitled"}: ${b.content?.substring(0, 300) || ""}`
      )
      .join("\n\n");

    // Get Gemini API key
    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const prompt = `You are an educational expert. Generate 8-10 high-quality multiple-choice quiz questions from this learning content.

Each question must have:
- A clear question text
- Exactly 4 options
- One correct answer

Return ONLY valid JSON array (no markdown, no code blocks):
[{"id":"q1","question":"Question text?","options":["Option A","Option B","Option C","Option D"],"correct_index":0}]

Content:
${contentText}`;

    // Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error("Gemini error:", err);
      return new Response(
        JSON.stringify({ error: `Gemini API failed: ${geminiRes.status}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const geminiData = await geminiRes.json();
    const responseText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = responseText.match(/\[\s*{[\s\S]*}\s*\]/);
    if (!jsonMatch) {
      console.error("Could not parse response:", responseText);
      return new Response(
        JSON.stringify({ error: "Invalid response format from AI" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);

    // Save to database
    const { data: existingQuiz } = await supabase
      .from("session_quizzes")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    const quizData = {
      session_id: sessionId,
      title: "AI-Generated Quiz",
      questions,
      passing_score: 70,
    };

    let savedQuiz;
    if (existingQuiz) {
      const { data, error } = await supabase
        .from("session_quizzes")
        .update(quizData)
        .eq("id", existingQuiz.id)
        .select()
        .single();
      if (error) throw error;
      savedQuiz = data;
    } else {
      const { data, error } = await supabase
        .from("session_quizzes")
        .insert([quizData])
        .select()
        .single();
      if (error) throw error;
      savedQuiz = data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        quiz_id: savedQuiz.id,
        questions_count: questions.length,
        questions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
});
