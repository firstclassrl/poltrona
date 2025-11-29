// Supabase Edge Function per invio email via Resend API
// Questa funzione agisce da proxy server-side per evitare problemi CORS

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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, text } = await req.json() as EmailRequest

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: 'Campi obbligatori mancanti: to, subject, html o text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ottieni la Resend API Key dalle variabili d'ambiente di Supabase
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
    
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY non configurata nelle variabili d\'ambiente di Supabase')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'RESEND_API_KEY non configurata. Configura la variabile d\'ambiente in Supabase Dashboard.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ottieni l'indirizzo email sender
    // Usa il dominio verificato abruzzo.ai
    // Puoi configurare RESEND_FROM_EMAIL in Supabase Secrets per personalizzarlo
    let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@abruzzo.ai'
    
    // Rimuovi spazi e caratteri non validi
    fromEmail = fromEmail.trim()
    
    // Valida il formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(fromEmail)) {
      console.error(`❌ RESEND_FROM_EMAIL non valido: "${fromEmail}"`)
      // Usa il fallback sicuro
      fromEmail = 'noreply@abruzzo.ai'
      console.log(`⚠️ Usando indirizzo fallback: ${fromEmail}`)
    }

    console.log(`📧 Invio email a: ${to} via Resend API (da: ${fromEmail})`)

    // Chiama Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: to,
        subject: subject,
        html: html || '',
        text: text || '',
      }),
    })

    if (!response.ok) {
      let errorData: any = {}
      let errorText = ''
      try {
        errorText = await response.text()
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || response.statusText }
      }
      
      const errorMessage = errorData.message || errorData.error || errorText || response.statusText
      console.error('❌ Resend API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        errorText
      })
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Resend API error (${response.status}): ${errorMessage}` 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()
    console.log('✅ Email inviata con successo via Resend:', result)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        id: result.id || `resend-${Date.now()}`,
        message: 'Email inviata con successo!' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Errore:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

