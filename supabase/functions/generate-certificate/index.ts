import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { testAttemptId, userId, programId, kitId, certificateType } = await req.json();

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const isSelf = user.id === userId;
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = roleData?.role === "admin";
    if (!isSelf && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    let verifiedScore: number;
    let validatedCertType: string;

    if (testAttemptId) {
      const { data: attempt } = await adminClient
        .from("test_attempts")
        .select("id, score, passed")
        .eq("id", testAttemptId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!attempt || !attempt.passed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
      verifiedScore = attempt.score;
      validatedCertType = certificateType || (verifiedScore >= 80 ? "completion" : "participation");
    } else {
      const { data: quizAttempts } = await adminClient
        .from("session_quiz_attempts")
        .select("score, total_questions")
        .eq("user_id", userId)
        .eq("program_id", programId);
      if (!quizAttempts || quizAttempts.length === 0) {
        return new Response(JSON.stringify({ error: "No quiz attempts found" }), { status: 403, headers: corsHeaders });
      }
      const totalScore = quizAttempts.reduce((sum, a) => sum + a.score, 0);
      const totalPossible = quizAttempts.reduce((sum, a) => sum + a.total_questions, 0);
      verifiedScore = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
      validatedCertType = verifiedScore >= 80 ? "completion" : "participation";
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      throw new Error("User profile not found");
    }

    let programTitle = "Mamuza Engineering Course";

    if (programId) {
      const { data: program } = await adminClient
        .from("programs")
        .select("title")
        .eq("id", programId)
        .maybeSingle();
      if (program) programTitle = program.title;
    } else if (kitId) {
      const { data: kit } = await adminClient
        .from("kits")
        .select("name")
        .eq("id", kitId)
        .maybeSingle();
      if (kit) programTitle = kit.name;
    }

    const hexCode = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const certificateNumber = `MAM-${hexCode.substring(0, 8)}-${hexCode.substring(8, 16)}-${hexCode.substring(16)}`;

    const issuedAt = new Date().toISOString();
    const issueDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    const learnerName = profile.full_name || profile.email.split('@')[0];
    const certType = validatedCertType;
    const certTitle = certType === "completion" ? "Certificate of Completion" : "Certificate of Participation";

    const programHash = (programTitle || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const hue = programHash % 360;
    const accentColor = `hsl(${hue}, 70%, 45%)`;
    const accentLight = `hsl(${hue}, 70%, 95%)`;

    const certificateSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <defs>
          <linearGradient id="border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentColor}"/>
            <stop offset="100%" style="stop-color:hsl(${(hue + 30) % 360}, 70%, 40%)"/>
          </linearGradient>
          <linearGradient id="header-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${accentColor}"/>
            <stop offset="100%" style="stop-color:hsl(${(hue + 20) % 360}, 65%, 50%)"/>
          </linearGradient>
        </defs>

        <rect width="800" height="600" fill="#ffffff"/>
        <rect x="10" y="10" width="780" height="580" fill="none" stroke="url(#border-gradient)" stroke-width="8" rx="8"/>
        <rect x="25" y="25" width="750" height="550" fill="none" stroke="#1f2937" stroke-width="1" rx="4"/>

        <rect x="40" y="40" width="720" height="80" fill="url(#header-gradient)" rx="4"/>
        <text x="400" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff">
          MAMUZA ENGINEERING
        </text>

        <text x="400" y="165" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#1f2937">
          ${certTitle}
        </text>

        <line x1="200" y1="185" x2="600" y2="185" stroke="${accentColor}" stroke-width="2"/>

        <text x="400" y="225" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">
          This is to certify that
        </text>

        <text x="400" y="275" text-anchor="middle" font-family="Georgia, serif" font-size="36" font-weight="bold" fill="#1f2937">
          ${learnerName}
        </text>
        <line x1="150" y1="290" x2="650" y2="290" stroke="#e5e7eb" stroke-width="1"/>

        <text x="400" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">
          has ${certType === "completion" ? "successfully completed" : "participated in"}
        </text>

        <text x="400" y="370" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="bold" fill="${accentColor}">
          ${programTitle}
        </text>

        <text x="400" y="410" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">
          with an average score of ${verifiedScore}%
        </text>

        <text x="200" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">
          Issue Date: ${issueDate}
        </text>
        <text x="600" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">
          Certificate No: ${certificateNumber}
        </text>

        <rect x="200" y="530" width="400" height="30" fill="${accentLight}" rx="4"/>
        <text x="400" y="550" text-anchor="middle" font-family="monospace" font-size="11" fill="${accentColor}">
          Authentication: ${hexCode}
        </text>

        <text x="400" y="580" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-style="italic" fill="${accentColor}">
          Inspire. Solve. Lead.
        </text>
      </svg>
    `;

    const encoder = new TextEncoder();
    const svgBytes = encoder.encode(certificateSvg);
    const fileName = `${userId}/${certificateNumber}.svg`;

    const { error: uploadError } = await adminClient.storage
      .from("certificates")
      .upload(fileName, svgBytes, {
        contentType: "image/svg+xml",
        upsert: true
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload certificate");
    }

    const { data: urlData } = adminClient.storage
      .from("certificates")
      .getPublicUrl(fileName);

    const certificateUrl = urlData.publicUrl;

    const { data: certificate, error: insertError } = await adminClient
      .from("certificates")
      .insert({
        user_id: userId,
        program_id: programId,
        kit_id: kitId,
        test_attempt_id: testAttemptId,
        learner_name: learnerName,
        program_title: programTitle,
        certificate_number: certificateNumber,
        certificate_url: certificateUrl,
        score: verifiedScore,
        issued_at: issuedAt,
        certificate_type: certType,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save certificate record");
    }

    return new Response(
      JSON.stringify({
        success: true,
        certificate: {
          id: certificate.id,
          certificateNumber,
          certificateUrl,
          learnerName,
          programTitle,
          score: verifiedScore,
          certificateType: certType,
          issuedAt
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Certificate generation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
