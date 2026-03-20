// Edge Function: validar-documento-ia
// Usa Google Gemini Flash 1.5 (gratis y obediente)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { storagePath, promptIA, tipoDocumento, nombreSolicitante } = await req.json();

    if (!storagePath || !promptIA || !tipoDocumento || !nombreSolicitante) {
      return new Response(JSON.stringify({ error: "Faltan parámetros obligatorios" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("documentos")
      .createSignedUrl(storagePath, 60);

    if (signedUrlError) {
      return new Response(JSON.stringify({ error: "No se pudo generar URL firmada" }), { status: 500 });
    }

    const urlFirmada = signedUrlData.signedUrl;

    // Llamar a Gemini Flash 1.5 (gratis y obediente)
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyAJAfZLtc_A2KY5zjj0QHMJ0zCWZk76BeQ",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Eres un validador documental. Sigue EXACTAMENTE el prompt del usuario sin agregar ni modificar instrucciones.\n\nPrompt del usuario:\n" + promptIA + "\n\nResponde SOLO con JSON valido segun el formato del prompt."
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: urlFirmada.split(",")[1] || urlFirmada
                }
              }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 1000
          }
        })
      }
    );

    const result = await geminiResponse.json();
    let texto = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    return new Response(texto, { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
