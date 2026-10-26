const { MongoClient } = require('mongodb');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/MONGODB_URI=["']?([^"'\r\n]+)/);
const uri = match ? match[1] : '';

async function check() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('Sur_Mithila');

  const u = await db.collection('users').findOne({ email: 'ssssssaa143@gmail.com' });
  console.log('ssssssaa143 history count in DB:', u?.history?.length);
  console.log('ssssssaa143 all history items in DB:');
  (u?.history || []).forEach((h, i) => console.log(`[${i}] id=${h.id}, title=${h.title}, played_at=${h.played_at}`));

  await client.close();
}
check().catch(console.error);
