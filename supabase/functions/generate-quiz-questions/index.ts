// Use built-in Deno.serve (no deno.land/std import) so the function never
// fails to boot fetching a legacy module — a boot failure makes even the CORS
// preflight return a non-OK status, which the browser reports as a CORS error.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

Deno.serve(async (req) => {
  // CORS preflight — must always return a 200 with CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI is not configured: GEMINI_API_KEY secret is missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user identity
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get request body
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch content blocks for this session
    const { data: blocks, error: blocksError } = await serviceClient
      .from("content_blocks")
      .select("*")
      .eq("session_id", sessionId)
      .order("block_order");

    if (blocksError) throw blocksError;

    if (!blocks || blocks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No content blocks found for this session" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build content text for Gemini
    const contentText = blocks
      .map((b: any) => {
        let text = "";
        if (b.title) text += `## ${b.title}\n`;
        if (b.content) text += `${b.content}\n`;
        return text;
      })
      .join("\n");

    // Call Gemini to generate questions
    const geminiRes = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are an expert educator. Generate 8-10 high-quality multiple-choice quiz questions from this learning content.

Each question must have:
- A clear question text
- Exactly 4 options
- One correct answer (0-3 index)

Return ONLY valid JSON array (no markdown, no explanation):
[{"id":"q1","question":"Question text?","options":["A","B","C","D"],"correct_index":0}]

Content to create questions from:
${contentText}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, errText);

      if (geminiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const responseText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[\s*{[\s\S]*}\s*\]/);
    if (!jsonMatch) {
      console.error("Could not parse JSON from Gemini response:", responseText);
      throw new Error("Invalid response format from Gemini");
    }

    const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);

    // Validate question structure
    for (const q of questions) {
      if (
        !q.question ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        typeof q.correct_index !== "number"
      ) {
        throw new Error("Invalid question structure");
      }
    }

    // Check if quiz already exists for this session
    const { data: existingQuiz } = await serviceClient
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

    // Insert or update quiz
    let savedQuiz;
    if (existingQuiz) {
      const { data, error } = await serviceClient
        .from("session_quizzes")
        .update(quizData)
        .eq("id", existingQuiz.id)
        .select()
        .single();
      if (error) throw error;
      savedQuiz = data;
    } else {
      const { data, error } = await serviceClient
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
  } catch (err) {
    console.error("generate-quiz-questions error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
