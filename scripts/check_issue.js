const { MongoClient } = require('mongodb');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/MONGODB_URI=["']?([^"'\r\n]+)/);
const uri = match ? match[1] : '';

async function check() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('Sur_Mithila');

  const sUser = await db.collection('users').findOne({ email: 'ssssssaa143@gmail.com' });
  console.log('ssssssaa143 user:', { id: sUser?.id, name: sUser?.name, email: sUser?.email, role: sUser?.role, is_private: sUser?.is_private });

  const jiaRec = await db.collection('community_recordings').findOne({ song_title: /जिया बसु/i });
  console.log('Jia Basu recording:', {
    _id: jiaRec?._id,
    recording_id: jiaRec?.recording_id,
    song_title: jiaRec?.song_title,
    user_id: jiaRec?.user_id,
    user_name: jiaRec?.user_name,
    is_private: jiaRec?.is_private,
    audio_url: jiaRec?.audio_url
  });

  if (jiaRec?.user_id) {
    const creator = await db.collection('users').findOne({ id: jiaRec.user_id });
    console.log('Creator of Jia Basu:', { id: creator?.id, name: creator?.name, email: creator?.email, role: creator?.role, is_private: creator?.is_private });
  }

  await client.close();
}
check().catch(console.error);
