import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContentBlock {
  id: string;
  block_type: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // ── Fetch session content blocks ────────────────────────────────────────
    const { data: blocks, error: blocksError } = await supabase
      .from("content_blocks")
      .select("*")
      .eq("session_id", sessionId)
      .order("block_order");

    if (blocksError) throw blocksError;

    if (!blocks || blocks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No content blocks found for session" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Build content for Gemini ──────────────────────────────────────────
    const contentSections = blocks
      .map((block: ContentBlock) => {
        let section = "";
        if (block.title) section += `## ${block.title}\n`;
        if (block.content) section += `${block.content}\n`;
        if (block.block_type) section += `\n(Type: ${block.block_type})\n`;
        return section;
      })
      .join("\n\n");

    const prompt = `You are an expert educational content developer. Based on the following learning material, generate 8-10 high-quality multiple-choice quiz questions.

Each question should:
- Test understanding of key concepts
- Have 4 options (A, B, C, D)
- Have one clearly correct answer
- Be appropriately challenging for the content level
- Not overlap with other questions

IMPORTANT: Return ONLY a valid JSON array with this exact structure. Do not include markdown, code blocks, or explanations:
[
  {
    "id": "q1",
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 0
  }
]

Content to analyze:
${contentSections}`;

    // ── Call Gemini API ───────────────────────────────────────────────────
    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY environment variable not set");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Gemini API error:", error);
      throw new Error(`Gemini API failed: ${response.statusText}`);
    }

    const data = await response.json();

    const responseText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    // ── Parse JSON response ────────────────────────────────────────────────
    const jsonMatch = responseText.match(/\[\s*{[\s\S]*}\s*\]/);
    if (!jsonMatch) {
      console.error("Failed to extract JSON from response:", responseText);
      throw new Error("Invalid JSON response from Gemini");
    }

    const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);

    // ── Validate structure ─────────────────────────────────────────────────
    for (const q of questions) {
      if (
        !q.question ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        typeof q.correct_index !== "number"
      ) {
        throw new Error("Invalid question structure from Gemini");
      }
    }

    // ── Save to session_quizzes ────────────────────────────────────────────
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
      // Update existing
      const { data, error } = await supabase
        .from("session_quizzes")
        .update(quizData)
        .eq("id", existingQuiz.id)
        .select()
        .single();
      if (error) throw error;
      savedQuiz = data;
    } else {
      // Create new
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
