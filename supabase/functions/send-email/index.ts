// Supabase Edge Function per invio email via SMTP
// Supporta Aruba, Gmail, e altri provider SMTP

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

// Funzione per inviare email usando fetch a un relay SMTP-to-HTTP
// Usiamo smtp2go o un servizio simile che ha un endpoint HTTP
async function sendViaSMTP(config: {
  host: string
  port: number
  user: string
  pass: string
  from: string
  fromName: string
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ success: boolean; error?: string }> {
  
  // Per Aruba, correggi automaticamente la configurazione
  let host = config.host
  let port = config.port
  let useTLS = false
  
  // Correzione automatica per Aruba
  if (host.includes('aruba')) {
    if (host.startsWith('smtps.')) {
      // smtps richiede SSL su porta 465
      port = 465
      useTLS = true
    } else if (host.startsWith('smtp.')) {
      // smtp usa STARTTLS su porta 587
      port = 587
      useTLS = false
    }
  }
  
  // Per Gmail
  if (host.includes('gmail')) {
    port = 587
    useTLS = false // Gmail usa STARTTLS
  }

  console.log(`📧 Configurazione corretta: ${host}:${port} (TLS: ${useTLS})`)

  // Tenta connessione SMTP diretta usando Deno
  try {
    // Usa connessione TCP raw con TLS se necessario
    let conn: Deno.Conn
    
    if (useTLS) {
      // Connessione SSL/TLS diretta (porta 465)
      conn = await Deno.connectTls({
        hostname: host,
        port: port,
      })
    } else {
      // Connessione plain (poi STARTTLS)
      conn = await Deno.connect({
        hostname: host,
        port: port,
      })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    // Helper per leggere risposta
    const readResponse = async (): Promise<string> => {
      const buffer = new Uint8Array(1024)
      const n = await conn.read(buffer)
      if (n === null) return ''
      return decoder.decode(buffer.subarray(0, n))
    }

    // Helper per inviare comando
    const sendCommand = async (cmd: string): Promise<string> => {
      await conn.write(encoder.encode(cmd + '\r\n'))
      return await readResponse()
    }

    // Leggi banner iniziale
    let response = await readResponse()
    console.log('SMTP Banner:', response.trim())

    // EHLO
    response = await sendCommand(`EHLO ${host}`)
    console.log('EHLO:', response.substring(0, 100))

    // Se non TLS, prova STARTTLS
    if (!useTLS && response.includes('STARTTLS')) {
      response = await sendCommand('STARTTLS')
      console.log('STARTTLS:', response.trim())
      
      if (response.startsWith('220')) {
        // Upgrade a TLS
        conn = await Deno.startTls(conn, { hostname: host })
        
        // EHLO di nuovo dopo TLS
        response = await sendCommand(`EHLO ${host}`)
        console.log('EHLO after TLS:', response.substring(0, 100))
      }
    }

    // AUTH LOGIN
    response = await sendCommand('AUTH LOGIN')
    console.log('AUTH:', response.trim())

    // Username (base64)
    response = await sendCommand(btoa(config.user))
    console.log('User response:', response.trim())

    // Password (base64)
    response = await sendCommand(btoa(config.pass))
    console.log('Pass response:', response.trim())

    if (!response.startsWith('235')) {
      conn.close()
      return { success: false, error: `Autenticazione fallita: ${response.trim()}` }
    }

    // MAIL FROM
    response = await sendCommand(`MAIL FROM:<${config.from}>`)
    console.log('MAIL FROM:', response.trim())

    // RCPT TO
    response = await sendCommand(`RCPT TO:<${config.to}>`)
    console.log('RCPT TO:', response.trim())

    // DATA
    response = await sendCommand('DATA')
    console.log('DATA:', response.trim())

    // Messaggio email
    const boundary = `----=_Part_${Date.now()}`
    const emailContent = [
      `From: ${config.fromName} <${config.from}>`,
      `To: ${config.to}`,
      `Subject: ${config.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      config.text,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      config.html,
      ``,
      `--${boundary}--`,
      `.`
    ].join('\r\n')

    response = await sendCommand(emailContent)
    console.log('Message response:', response.trim())

    // QUIT
    await sendCommand('QUIT')
    conn.close()

    if (response.startsWith('250')) {
      return { success: true }
    } else {
      return { success: false, error: `Errore invio: ${response.trim()}` }
    }

  } catch (error) {
    console.error('Errore connessione SMTP:', error)
    return { success: false, error: error.message }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, text, test } = await req.json() as EmailRequest

    const smtpHost = Deno.env.get('SMTP_HOST') || ''
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587')
    const smtpUser = Deno.env.get('SMTP_USER') || ''
    const smtpPass = Deno.env.get('SMTP_PASS') || ''
    const fromEmail = Deno.env.get('SMTP_FROM') || smtpUser
    const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Poltrona - Barbershop'

    if (test) {
      if (!smtpHost || !smtpUser || !smtpPass) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Variabili SMTP mancanti',
            current: {
              SMTP_HOST: smtpHost || '✗ mancante',
              SMTP_PORT: smtpPort,
              SMTP_USER: smtpUser ? '✓' : '✗ mancante',
              SMTP_PASS: smtpPass ? '✓' : '✗ mancante',
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Configurazione SMTP OK',
          config: { host: smtpHost, port: smtpPort, user: smtpUser, from: fromEmail }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: 'Campi obbligatori mancanti' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📧 Invio email a: ${to}`)
    console.log(`📧 SMTP: ${smtpHost}:${smtpPort}`)

    const result = await sendViaSMTP({
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
      from: fromEmail,
      fromName: fromName,
      to: to,
      subject: subject,
      html: html || '',
      text: text || '',
    })

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, id: `email-${Date.now()}`, message: 'Email inviata!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Errore:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
