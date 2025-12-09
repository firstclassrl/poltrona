#!/usr/bin/env node

/**
 * Script per applicare il trigger di invio email su cancellazione appuntamento
 * Esegue lo script SQL tramite l'API REST di Supabase
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Leggi la migration SQL
const migrationPath = path.join(__dirname, '../supabase/migrations/20251129095150_fix_cancellation_emails_trigger.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

// Configurazione Supabase
const SUPABASE_URL = 'https://tlwxsluoqzdluzneugbe.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY non configurata!');
  console.error('   Imposta la variabile d\'ambiente: export SUPABASE_SERVICE_ROLE_KEY=your_key');
  process.exit(1);
}

// Funzione per eseguire SQL tramite API REST
function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

// Esegui lo script
async function main() {
  console.log('🚀 Applicazione trigger email cancellazione...');
  console.log('📝 Eseguendo migration SQL...');
  
  try {
    // Dividi lo script in statement separati (semplificato)
    // In realtà, Supabase non ha un endpoint diretto per eseguire SQL arbitrario
    // Dobbiamo usare il dashboard o psql
    
    console.log('⚠️  Questo script richiede l\'esecuzione manuale nel Supabase Dashboard.');
    console.log('📋 Vai su: https://supabase.com/dashboard/project/tlwxsluoqzdluzneugbe/sql');
    console.log('📄 Copia e incolla il contenuto di:');
    console.log(`   ${migrationPath}`);
    console.log('');
    console.log('✅ Dopo l\'esecuzione, il trigger invierà automaticamente le email quando');
    console.log('   un appuntamento viene cancellato (status = \'cancelled\')');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

main();









