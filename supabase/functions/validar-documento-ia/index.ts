import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const BUCKET_EXPEDIENTES = "make-7e2d13d9-expedientes-electronicos-prospectos";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storagePath, promptIA, tipoDocumento, nombreSolicitante } = await req.json();

    if (!storagePath || !promptIA || !tipoDocumento || !nombreSolicitante) {
      return new Response(JSON.stringify({ error: "Faltan parametros obligatorios" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Obtener URL firmada del archivo
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .createSignedUrl(storagePath, 60);

    if (signedUrlError) {
      return new Response(JSON.stringify({ error: "No se pudo generar URL firmada" }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const urlFirmada = signedUrlData.signedUrl;

    // Descargar la imagen
    const imageResponse = await fetch(urlFirmada);
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Convertir a base64 de forma segura
    const bytes = new Uint8Array(imageBuffer);
    const binary = String.fromCharCode(...bytes);
    const imageBase64 = btoa(binary);
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Llamar a Gemini
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyAJAfZLtc_A2KY5zjj0QHMJ0zCWZk76BeQ",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Eres un validador documental. Sigue EXACTAMENTE el prompt del usuario.\n\nPrompt del usuario:\n" + promptIA + "\n\nResponde SOLO con JSON."
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64
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

    return new Response(texto, { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
