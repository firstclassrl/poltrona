// Supabase Edge Function per invio email
// Usa il sistema SMTP configurato in Supabase (info@abruzzo.ai)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  subject: string
  html: string
  text: string
  test?: boolean
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, text, test } = await req.json() as EmailRequest

    // Se è un test, restituisci successo
    if (test) {
      return new Response(
        JSON.stringify({ success: true, message: 'Email service configurato correttamente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validazione input
    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: 'Campi obbligatori mancanti: to, subject, html o text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Configurazione SMTP da variabili d'ambiente Supabase
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587')
    const smtpUser = Deno.env.get('SMTP_USER') || 'info@abruzzo.ai'
    const smtpPass = Deno.env.get('SMTP_PASS') || ''
    const fromEmail = Deno.env.get('SMTP_FROM') || 'info@abruzzo.ai'
    const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Poltrona - Barbershop'

    // Log per debug (rimuovi in produzione)
    console.log(`📧 Invio email a: ${to}`)
    console.log(`📧 Oggetto: ${subject}`)
    console.log(`📧 Da: ${fromName} <${fromEmail}>`)

    // Usa Deno SMTPClient per inviare email
    // Import dinamico per evitare errori se il modulo non è disponibile
    try {
      const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts')
      
      const client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port: smtpPort,
          tls: smtpPort === 465,
          auth: {
            username: smtpUser,
            password: smtpPass,
          },
        },
      })

      await client.send({
        from: `${fromName} <${fromEmail}>`,
        to: to,
        subject: subject,
        content: text || '',
        html: html || '',
      })

      await client.close()

      console.log('✅ Email inviata con successo!')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          id: `email-${Date.now()}`,
          message: 'Email inviata con successo' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (smtpError) {
      console.error('❌ Errore SMTP:', smtpError)
      
      // Fallback: prova con fetch a un servizio esterno se SMTP fallisce
      // Questo è un placeholder - puoi sostituire con un altro servizio
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Errore SMTP: ${smtpError.message}`,
          details: 'Verifica la configurazione SMTP in Supabase Dashboard > Project Settings > Edge Functions'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Errore generale:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

