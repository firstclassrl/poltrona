// Test diretto dell'API Resend
const RESEND_API_KEY = 're_Z7X5H9xJ_P2uR6dWLPPVhFx4syYUXWvM1';

async function testResendEmail() {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'noreply@resend.dev',
        to: ['retrobarbershop2020@gmail.com'],
        subject: 'Test Email - Sistema Notifiche',
        html: `
          <h1>Test Email Sistema Notifiche</h1>
          <p>Questa è una email di test per verificare che Resend funzioni correttamente.</p>
          <p>Data: ${new Date().toLocaleString('it-IT')}</p>
        `,
        text: 'Test Email Sistema Notifiche - Questa è una email di test.'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Email inviata con successo:', result);
    return result;
  } catch (error) {
    console.error('❌ Errore nell\'invio email:', error);
    throw error;
  }
}

// Esegui il test
testResendEmail();
