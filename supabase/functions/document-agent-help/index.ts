import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { document_category, client_message, messages, chapter_type } = body;

    // Support both legacy single-message and new multi-turn chat
    const chatMessages = messages as { role: string; content: string }[] | undefined;

    if (!document_category || (!client_message && (!chatMessages || chatMessages.length === 0))) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ response: "I'm unable to help right now. Please follow the written steps above." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chapterLabel = chapter_type === '13' ? 'Chapter 13' : 'Chapter 7';

    const systemPrompt = `You are a friendly, warm intake assistant helping a client gather documents for their ${chapterLabel} filing. The client is currently on the "${document_category}" step.

Your role:
- Help the client find and upload their ${document_category}.
- Give clear, step-by-step instructions in plain English.
- Be warm, encouraging, and patient. Many clients feel stressed.
- If you can identify a specific website or platform, include the URL.
- Keep responses under 80 words.

You must NEVER:
- Give legal advice of any kind.
- Tell the client they don't need a document or can skip it.
- Mention bankruptcy, court proceedings, or legal terms.
- Suggest the client doesn't need to provide something.

If unsure, always say: "That's a great question — I'd recommend checking with your attorney's office to be sure."`;

    let apiMessages: { role: string; content: string }[];

    if (chatMessages && chatMessages.length > 0) {
      // Multi-turn: pass conversation history
      apiMessages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages,
      ];
    } else {
      // Legacy single-message
      apiMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: client_message },
      ];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ response: "I'm getting a lot of requests right now. Please try again in a moment, or follow the written steps above." }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ response: "This feature is temporarily unavailable. Please follow the written steps above." }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I couldn't find specific instructions. Please contact your attorney's office for help.";

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('document-agent-help error:', e);
    return new Response(JSON.stringify({ response: "I'm having trouble right now. Please follow the written steps above." }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
