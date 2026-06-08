import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
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
          `${b.title || "Untitled"}: ${b.content?.substring(0, 200) || ""}`
      )
      .join("\n");

    // Call Gemini API
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

    const prompt = `Generate 8-10 multiple-choice quiz questions from this content:

${contentText}

Return ONLY valid JSON array (no markdown):
[{"id":"q1","question":"?","options":["A","B","C","D"],"correct_index":0}]`;

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
        JSON.stringify({ error: `Gemini API error: ${geminiRes.status}` }),
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
      return new Response(
        JSON.stringify({ error: "Could not parse Gemini response" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);

    // Save to DB
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
