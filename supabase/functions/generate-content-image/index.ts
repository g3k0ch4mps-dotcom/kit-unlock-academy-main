import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    // Require a valid authenticated user before doing any work
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, sessionId, blockOrder } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating image for prompt:", prompt);

    // Use the Lovable AI image generation model
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `Generate an educational, professional image for a STEM learning course. The image should be clear, well-lit, and suitable for educational content. Style: Technical illustration or realistic photo-style diagram.

Description: ${prompt}

Requirements:
- Clean, professional appearance
- Clear labels if showing components
- Good lighting and contrast
- Educational context appropriate for electronics/IoT/robotics learning`
          }
        ],
        modalities: ["image", "text"]
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
      throw new Error("Image generation failed");
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      throw new Error("No image generated");
    }

    // If we have session context, upload to storage and update the content block
    if (sessionId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Convert base64 to blob
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const fileName = `generated/${sessionId}/${Date.now()}.png`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("kit-images")
        .upload(fileName, imageBytes, {
          contentType: "image/png",
          upsert: true
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        // Return base64 as fallback
        return new Response(JSON.stringify({ 
          imageUrl: imageData,
          isBase64: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: publicUrl } = supabase.storage
        .from("kit-images")
        .getPublicUrl(fileName);

      return new Response(JSON.stringify({ 
        imageUrl: publicUrl.publicUrl,
        isBase64: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return base64 if no storage context
    return new Response(JSON.stringify({ 
      imageUrl: imageData,
      isBase64: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-content-image] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
