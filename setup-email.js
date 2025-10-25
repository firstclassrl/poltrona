#!/usr/bin/env node

/**
 * Script di Setup per Configurazione Email
 * Retro Barbershop - Sistema di Gestione Prenotazioni
 * 
 * Questo script ti guida nella configurazione delle notifiche email
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('📧 Setup Configurazione Email - Retro Barbershop');
console.log('================================================\n');

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setupEmail() {
  try {
    console.log('Scegli il provider email che vuoi utilizzare:');
    console.log('1. SendGrid (Raccomandato per produzione)');
    console.log('2. Gmail (Perfetto per test)');
    console.log('3. Mailgun (Alternativa robusta)');
    console.log('4. Solo modalità mock (per ora)');
    
    const choice = await askQuestion('\nInserisci il numero della tua scelta (1-4): ');
    
    switch (choice) {
      case '1':
        await setupSendGrid();
        break;
      case '2':
        await setupGmail();
        break;
      case '3':
        await setupMailgun();
        break;
      case '4':
        console.log('\n✅ Configurazione completata!');
        console.log('Il sistema userà la modalità mock per le email.');
        console.log('Per abilitare l\'invio reale, esegui di nuovo questo script.');
        break;
      default:
        console.log('\n❌ Scelta non valida. Riprova.');
        await setupEmail();
        return;
    }
    
    rl.close();
  } catch (error) {
    console.error('❌ Errore durante il setup:', error);
    rl.close();
  }
}

async function setupSendGrid() {
  console.log('\n🔧 Configurazione SendGrid');
  console.log('==========================');
  
  console.log('\n1. Vai su https://sendgrid.com/ e registrati');
  console.log('2. Crea un API Key:');
  console.log('   - Settings > API Keys > Create API Key');
  console.log('   - Nome: "Barbershop App"');
  console.log('   - Permissions: "Full Access"');
  console.log('   - Copia la chiave generata\n');
  
  const apiKey = await askQuestion('Inserisci la tua SendGrid API Key: ');
  const fromEmail = await askQuestion('Inserisci l\'email mittente (es: noreply@yourdomain.com): ');
  
  if (!apiKey || !fromEmail) {
    console.log('\n❌ API Key e email mittente sono obbligatori!');
    return;
  }
  
  // Installa SendGrid
  console.log('\n📦 Installazione SendGrid...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install @sendgrid/mail', { stdio: 'inherit' });
    console.log('✅ SendGrid installato con successo!');
  } catch (error) {
    console.log('❌ Errore nell\'installazione di SendGrid:', error.message);
    return;
  }
  
  // Crea file .env
  const envContent = `# Configurazione Email - Retro Barbershop
SENDGRID_API_KEY=${apiKey}
FROM_EMAIL=${fromEmail}
NODE_ENV=production
`;
  
  fs.writeFileSync('.env', envContent);
  console.log('✅ File .env creato con successo!');
  
  // Aggiorna emailService.ts
  await updateEmailService('sendgrid');
  
  console.log('\n🎉 Configurazione SendGrid completata!');
  console.log('Ora le email verranno inviate realmente.');
  console.log('\nPer testare:');
  console.log('1. Fai una prenotazione');
  console.log('2. Controlla che l\'email arrivi al barbiere');
  console.log('3. Verifica i log nella console');
}

async function setupGmail() {
  console.log('\n🔧 Configurazione Gmail');
  console.log('=======================');
  
  console.log('\n1. Abilita la verifica in 2 passaggi su Gmail');
  console.log('2. Crea una App Password:');
  console.log('   - Google Account > Sicurezza > App passwords');
  console.log('   - Seleziona "Mail" e "Other"');
  console.log('   - Inserisci "Barbershop App" come nome');
  console.log('   - Copia la password generata (16 caratteri)\n');
  
  const gmailUser = await askQuestion('Inserisci la tua email Gmail: ');
  const appPassword = await askQuestion('Inserisci la tua App Password (16 caratteri): ');
  
  if (!gmailUser || !appPassword) {
    console.log('\n❌ Email e App Password sono obbligatori!');
    return;
  }
  
  // Installa Nodemailer
  console.log('\n📦 Installazione Nodemailer...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install nodemailer @types/nodemailer', { stdio: 'inherit' });
    console.log('✅ Nodemailer installato con successo!');
  } catch (error) {
    console.log('❌ Errore nell\'installazione di Nodemailer:', error.message);
    return;
  }
  
  // Crea file .env
  const envContent = `# Configurazione Email - Retro Barbershop
GMAIL_USER=${gmailUser}
GMAIL_APP_PASSWORD=${appPassword}
FROM_EMAIL=${gmailUser}
NODE_ENV=production
`;
  
  fs.writeFileSync('.env', envContent);
  console.log('✅ File .env creato con successo!');
  
  // Aggiorna emailService.ts
  await updateEmailService('gmail');
  
  console.log('\n🎉 Configurazione Gmail completata!');
  console.log('Ora le email verranno inviate realmente.');
}

async function setupMailgun() {
  console.log('\n🔧 Configurazione Mailgun');
  console.log('=========================');
  
  console.log('\n1. Vai su https://www.mailgun.com/ e registrati');
  console.log('2. Ottieni le credenziali:');
  console.log('   - API Key: Dashboard > Settings > API Keys');
  console.log('   - Domain: Dashboard > Domains\n');
  
  const apiKey = await askQuestion('Inserisci la tua Mailgun API Key: ');
  const domain = await askQuestion('Inserisci il tuo Mailgun Domain: ');
  const fromEmail = await askQuestion('Inserisci l\'email mittente (es: noreply@yourdomain.com): ');
  
  if (!apiKey || !domain || !fromEmail) {
    console.log('\n❌ API Key, Domain e email mittente sono obbligatori!');
    return;
  }
  
  // Installa Mailgun
  console.log('\n📦 Installazione Mailgun...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install mailgun-js', { stdio: 'inherit' });
    console.log('✅ Mailgun installato con successo!');
  } catch (error) {
    console.log('❌ Errore nell\'installazione di Mailgun:', error.message);
    return;
  }
  
  // Crea file .env
  const envContent = `# Configurazione Email - Retro Barbershop
MAILGUN_API_KEY=${apiKey}
MAILGUN_DOMAIN=${domain}
FROM_EMAIL=${fromEmail}
NODE_ENV=production
`;
  
  fs.writeFileSync('.env', envContent);
  console.log('✅ File .env creato con successo!');
  
  // Aggiorna emailService.ts
  await updateEmailService('mailgun');
  
  console.log('\n🎉 Configurazione Mailgun completata!');
  console.log('Ora le email verranno inviate realmente.');
}

async function updateEmailService(provider) {
  console.log(`\n📝 Aggiornamento emailService.ts per ${provider}...`);
  
  const emailServicePath = path.join(__dirname, 'src', 'services', 'emailService.ts');
  const emailServiceRealPath = path.join(__dirname, 'src', 'services', 'emailServiceReal.ts');
  
  if (fs.existsSync(emailServiceRealPath)) {
    fs.copyFileSync(emailServiceRealPath, emailServicePath);
    console.log('✅ emailService.ts aggiornato con successo!');
  } else {
    console.log('⚠️ File emailServiceReal.ts non trovato. Aggiorna manualmente emailService.ts');
  }
}

// Avvia il setup
setupEmail();

