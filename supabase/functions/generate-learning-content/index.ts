import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { kitName, kitCategory, inputContent, uploadedFiles, numberOfSessions, generateImages, userInstructions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build file context from uploaded files
    let fileContext = "";
    if (uploadedFiles && uploadedFiles.length > 0) {
      fileContext = "\n\n--- UPLOADED REFERENCE FILES ---\n";
      for (const file of uploadedFiles) {
        if (file.type === "code" && file.content) {
          fileContext += `\n### Code File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
        } else if (file.type === "document" && file.content) {
          fileContext += `\n### Document: ${file.name}\n${file.content}\n`;
        } else if (file.type === "image") {
          fileContext += `\n### Image Reference: ${file.name}\n[Image uploaded for visual reference]\n`;
        }
      }
      fileContext += "\n--- END OF UPLOADED FILES ---\n";
    }

    const systemPrompt = `You are an educational content organizer for Mamuza Engineering, a Kenyan company that provides hands-on STEM learning kits for robotics and IoT across Africa.

YOUR PRIMARY JOB:
- Take the content provided by the admin (from uploaded PDFs and text input) and organize it faithfully into the session structure requested.
- DO NOT invent or fabricate content. Paste the provided content AS-IS into the appropriate sections.
- Only restructure, reformat, and organize the content - do not rewrite it.
- If the admin says 1 session, create exactly 1 session. Follow the admin's instructions precisely.

BRANDING:
- All content is branded as Mamuza Engineering
- Tagline: "Inspire. Solve. Lead."

FORMATTING RULES:
- DO NOT use ** for bold text anywhere
- DO NOT use # for any headers - use ### for sub-section titles only
- Use plain text for emphasis or UPPERCASE for important terms
- Add blank lines between paragraphs
- Each point in a list MUST appear on its own line
- Add a blank line after every list item
- NO emojis anywhere

SESSION STRUCTURE RULES:
- Create EXACTLY the number of sessions the admin requests (usually 1)
- Within a session, create at most 3 sub-sections of learning content
- The 4th sub-section (if applicable, starting from session 4 onwards) should be a TEST/QUIZ to assess understanding
- Test questions should vary based on user skill level (beginner/intermediate/advanced)
- DO NOT follow any rigid predefined structure like Problem→Solution→Components→Circuit→Code→Questions→Feedback
- Simply organize the uploaded content logically into sub-sections

SUB-SESSION FORMAT:
- Use ### Part 1: [Title] for each sub-section
- Use #### for sub-sub-sections within parts
- Maximum 3 learning sub-sections per session
- If it's session 4 or later, add a 4th sub-section: ### Part 4: Knowledge Check
  - Include 5-10 questions that test understanding of the session content
  - For BEGINNER level: simple recall and identification questions with 3 choices + "I don't know"
  - For INTERMEDIATE level: application and analysis questions with 3 choices + "I don't know"
  - For ADVANCED level: problem-solving and design questions with 3 choices + "I don't know"

OUTPUT FORMAT:
- Session title on the first line (NO # prefix)
- Then sub-sections using ### headers
- Code blocks with proper language tags
- Lists with proper line breaks`;

    const userPrompt = `Organize the following content for the "${kitName}" kit (Category: ${kitCategory}).

ADMIN INSTRUCTIONS: ${userInstructions || "Create exactly 1 session. Organize the uploaded content faithfully."}

Number of sessions to create: ${numberOfSessions}

CONTENT TO ORGANIZE:

${inputContent}${fileContext}

CRITICAL RULES:
1. DO NOT invent content - use ONLY what is provided above
2. Create exactly ${numberOfSessions} session(s)
3. Maximum 3 learning sub-sections per session
4. DO NOT use ** anywhere
5. DO NOT use # for headers - use ### for sub-sections
6. Paste PDF/document content AS-IS, only restructuring into sub-sections
7. Each listed point on its own line with blank line spacing
8. If session number >= 4, add a test/quiz as the 4th sub-section
9. NO emojis, professional tone only`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    const data = await response.json();
    let generatedContent = data.choices?.[0]?.message?.content || "";

    const imageMarkers: string[] = [];
    const imageRegex = /\[GENERATE_IMAGE:\s*([^\]]+)\]/g;
    let match;
    while ((match = imageRegex.exec(generatedContent)) !== null) {
      imageMarkers.push(match[1]);
    }

    return new Response(JSON.stringify({ 
      content: generatedContent,
      imageMarkers: imageMarkers
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
