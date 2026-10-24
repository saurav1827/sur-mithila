const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Read Mongo URI from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
let uri = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/MONGODB_URI=["']?([^"'\r\n]+)["']?/);
  if (match) uri = match[1].trim();
}
if (!uri) {
  uri = 'mongodb+srv://ssssssaa143:UYnydmYfSnbo4146@cluster0.q8k2p.mongodb.net/Sur_Mithila?retryWrites=true&w=majority';
}

const GENUINE_ARTISTS_METADATA = {
  'paramparik': {
    slug: 'paramparik',
    name: 'पारंपरिक',
    name_devanagari: 'पारंपरिक लोक गायक',
    name_roman: 'Traditional Folk Ensemble',
    role: 'मिथिला लोक संस्कृति धरोहर',
    gender: 'ensemble',
    avatar_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'मिथिलांचल (Mithilanchal)',
      subdivision: 'समस्त क्षेत्र',
      district: 'दरभंगा, मधुबनी, सुपौल, सहरसा, सीतामढ़ी',
      state: 'बिहार / नेपाल (Mithila)'
    },
    bio: {
      maithili: 'मिथिलाक सदियौ पुरान लोक परंपरा, माता-बहिन सबहक कंठहार गीत, सोहर, समदाउन, नचारी, बटगमनी आ विवाहक अमर लोक संस्कृति। ई कोनो एक व्यक्तिक नहि, अपितु संपूर्ण मिथिलाक सामूहिक सांस्कृतिक आत्मा छी।',
      english: 'The timeless ancestral folk heritage of Mithila, preserved over centuries across village courtyards, sacred domestic ceremonies, Vivah Sanskar, Sohar, and festive community gatherings.'
    },
    awards: ['अमर लोक धरोहर', 'मिथिला संस्कृति कंठहार'],
    era: 'सनातन लोक परंपरा (Timeless Heritage)',
    featured: true
  },
  'sharda-sinha': {
    slug: 'sharda-sinha',
    name: 'Sharda Sinha',
    name_devanagari: 'शारदा सिन्हा',
    name_roman: 'Sharda Sinha',
    role: 'पद्म भूषण अमर लोक गायिका (बिहार कोकिला)',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'हुलास (Hulas)',
      subdivision: 'राघोपुर (Raghopur)',
      district: 'सुपौल (Supaul)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'पद्म भूषण से अलंकृत अमर लोक गायिका, बिहार कोकिला शारदा सिन्हा। छठि पर्व, भगवती वंदना, विवाह आ समदाउन गीतक अमर स्वर जे देश-विदेश में मिथिलाक पहचान बनल।',
      english: 'Padma Bhushan & Padma Shri awardee, celebrated globally as Bihar Kokila. The definitive and immortal voice of Chhath Mahaparv, Bhagwati Vandana, and Mithila wedding rituals.'
    },
    awards: ['पद्म भूषण (2018)', 'पद्म श्री (1991)', 'संगीत नाटक अकादमी पुरस्कार (2000)', 'राष्ट्रीय देवी अहिल्या सम्मान'],
    era: 'अमर शास्त्रीय युग (Golden Classical Era)',
    featured: true
  },
  'maithili-thakur': {
    slug: 'maithili-thakur',
    name: 'Maithili Thakur',
    name_devanagari: 'मैथिली ठाकुर',
    name_roman: 'Maithili Thakur',
    role: 'शास्त्रीय एवं लोक गायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'उड़ेन (Uren)',
      subdivision: 'बेनीपट्टी (Benipatti)',
      district: 'मधुबनी (Madhubani)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'संगीत नाटक अकादमी उस्ताद बिस्मिल्लाह खान युवा पुरस्कार से सम्मानित। मैथिली लोक संगीत, विद्यापति पदावली आ पारंपरिक भजनक समकालीन विश्व ध्वजवाहक।',
      english: 'Sangeet Natak Akademi Ustad Bismillah Khan Yuva Puraskar recipient and globally acclaimed contemporary maestro of Maithili folk melodies, Vidyapati Padavali, and sacred devotional hymns.'
    },
    awards: ['उस्ताद बिस्मिल्लाह खान युवा पुरस्कार (2021)', 'बिहार राज्य खादी एवं हस्तशिल्प ब्रांड एंबेसडर', 'राष्ट्रीय सांस्कृतिक दूत'],
    era: 'समकालीन युग (Contemporary)',
    featured: true
  },
  'vidyapati': {
    slug: 'vidyapati',
    name: 'Vidyapati',
    name_devanagari: 'महाकवि विद्यापति',
    name_roman: 'Mahakavi Vidyapati',
    role: 'मैथिल कोकिल एवं पदावली जनक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'बिसफी (Bisafee)',
      subdivision: 'बिसफी',
      district: 'मधुबनी (Madhubani)',
      state: 'मिथिला (Mithila)'
    },
    bio: {
      maithili: 'मैथिल कोकिल, अभिनव जयदेव महाकवि विद्यापति। मैथिली साहित्य आ संगीतक आदि जनक। हुनक पदावली, महेशवाणी, नचारी आ भगवती वंदना संपूर्ण भारतीय संस्कृति के अमूल्य धरोहर छी।',
      english: 'Revered as Maithil Kokil (The Cuckoo of Mithila) and Abhinava Jayadeva. 14th-century master whose musical poetry shaped the bedrock of Maithili classical and devotional literature.'
    },
    awards: ['मैथिल कोकिल उपाधि', 'अभिनव जयदेव', 'मिथिला शिरोमणि'],
    era: 'मध्यकालीन शास्त्रीय युग (14th Century Classical)',
    featured: true
  },
  'poonam-mishra': {
    slug: 'poonam-mishra',
    name: 'Poonam Mishra',
    name_devanagari: 'पूनम मिश्रा',
    name_roman: 'Poonam Mishra',
    role: 'प्रसिद्ध मैथिली पारंपरिक गायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'लखनौर / मिथिला',
      subdivision: 'दरभंगा',
      district: 'दरभंगा (Darbhanga)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'प्रसिद्ध मैथिली पारंपरिक एवं भगवती भजन गायिका। मिथिलाक देवी स्थान, जागरण आ विवाह-संस्कारक अत्यंत लोकप्रिय आ सुरीली गायिका।',
      english: 'Beloved Maithili folk and devotional vocalist whose resonant renderings of Bhagwati Geets, festive bhajans, and marriage ceremonies are celebrated across North India and Nepal.'
    },
    awards: ['मिथिला रत्न सम्मान', 'चेतना समिति सुर सम्मान', 'मिथिला विभूति'],
    era: 'समकालीन लोक युग',
    featured: true
  },
  'kunj-bihari-mishra': {
    slug: 'kunj-bihari-mishra',
    name: 'Kunj Bihari Mishra',
    name_devanagari: 'कुंज बिहारी मिश्र',
    name_roman: 'Kunj Bihari Mishra',
    role: 'शास्त्रीय मैथिली गायक एवं सुर साधक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'मंगरौनी (Mangrauni)',
      subdivision: 'मधुबनी',
      district: 'मधुबनी (Madhubani)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'मैथिली शास्त्रीय एवं पारंपरिक संगीतक मूर्धन्य गायक। विद्यापति राग, महेशवाणी आ भगवती वंदनाक अद्वितीय साधक।',
      english: 'Virtuoso classical vocalist of Mithila, renowned for rigorous command over ancient Vidyapati ragas, Shiv Nachari, and traditional devotional expositions.'
    },
    awards: ['मिथिला विभूति सम्मान', 'विद्यापति पुरस्कार', 'शास्त्रीय संगीत साधक'],
    era: 'शास्त्रीय संगीत युग',
    featured: true
  },
  'udit-narayan': {
    slug: 'udit-narayan',
    name: 'Udit Narayan',
    name_devanagari: 'उदित नारायण झा',
    name_roman: 'Udit Narayan Jha',
    role: 'पद्म भूषण पार्श्वगायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'बैसी (Baisi)',
      subdivision: 'सुपौल',
      district: 'सुपौल (Supaul)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'पद्म भूषण से अलंकृत विश्वप्रसिद्ध पार्श्वगायक। पहिल मैथिली चलचित्र "कन्यादान" से संगीत यात्रा शुरू कए बॉलीवुड आ मैथिली संगीत के अमर आवाज बनलाह।',
      english: 'Legendary playback singer honored with Padma Bhushan & 4 National Film Awards. Commenced his career with the iconic Maithili classic Kanyadaan before conquering Indian cinema.'
    },
    awards: ['पद्म भूषण (2016)', 'पद्म श्री (2009)', '४ राष्ट्रीय फिल्म पुरस्कार', 'मिथिला गौरव सम्मान'],
    era: 'गोल्डन एरा (Bollywood & Folk Legend)',
    featured: true
  },
  'dilip-darbhangiya': {
    slug: 'dilip-darbhangiya',
    name: 'Dilip Darbhangiya',
    name_devanagari: 'दिलीप दरभंगिया',
    name_roman: 'Dilip Darbhangiya',
    role: 'लोकप्रिय मैथिली जनगायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'दरभंगा नगर',
      subdivision: 'दरभंगा',
      district: 'दरभंगा (Darbhanga)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'मैथिली लोकगीतक अत्यंत लोकप्रिय गायक। समकालीन लगनी, विवाह गीत, होली आ हास्य-व्यंग्य गीतोक अद्वितीय कलाकार।',
      english: 'Prolific grassroots Maithili folk vocalist and entertainer, famous for cheerful festive songs, Vivah Lagani, and spirited seasonal folk melodies.'
    },
    awards: ['जनकवि लोक सम्मान', 'मिथिला संगीत गौरव'],
    era: 'समकालीन लोक युग',
    featured: true
  },
  'madhav-rai': {
    slug: 'madhav-rai',
    name: 'Madhav Rai',
    name_devanagari: 'माधव राय',
    name_roman: 'Madhav Rai',
    role: 'मैथिली सुगम संगीत गायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'लोहना (Lohna)',
      subdivision: 'झंझारपुर',
      district: 'मधुबनी (Madhubani)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'सुप्रसिद्ध मैथिली सुगम संगीत गायक। विद्यापति पदावली आ आधुनिक मैथिली भावगीतोक सशक्त आ सुरीला स्वर।',
      english: 'Celebrated modern Maithili melodist whose smooth vocal style has modernized Vidyapati compositions and lyrical bhavgeets for new generations.'
    },
    awards: ['विद्यापति स्मृति सम्मान', 'मिथिला विभूति'],
    era: 'आधुनिक सुगम संगीत युग',
    featured: true
  },
  'dr-shanti-jain': {
    slug: 'dr-shanti-jain',
    name: 'Dr. Shanti Jain',
    name_devanagari: 'डॉ. शांति जैन',
    name_roman: 'Dr. Shanti Jain',
    role: 'पद्म श्री लोक संस्कृति विदुषी एवं गायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'आरा / पटना',
      subdivision: 'भोजपुर',
      district: 'भोजपुर / पटना',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'पद्म श्री से अलंकृत प्रख्यात लोक विदुषी, साहित्यकार एवं संगीतज्ञा। मैथिली-भोजपुरी लोकगीतों के प्रामाणिक संकलन, अनुसंधान एवं गायन में जीवनपर्यंत योगदान।',
      english: 'Padma Shri scholar, folklorist, and singer who dedicated her life to authentic documentation and performance of traditional Maithili and Bhojpuri oral traditions.'
    },
    awards: ['पद्म श्री (2020)', 'संगीत नाटक अकादमी सम्मान', 'बिहार कला पुरस्कार'],
    era: 'शास्त्रीय लोक अनुसंधान युग',
    featured: true
  },
  'rajni-pallavi': {
    slug: 'rajni-pallavi',
    name: 'Rajni Pallavi',
    name_devanagari: 'रजनी पल्लवी',
    name_roman: 'Rajni Pallavi',
    role: 'मैथिली शास्त्रीय एवं सुगम संगीत साधक',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'समस्तीपुर / दरभंगा',
      district: 'समस्तीपुर (Samastipur)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'मैथिली सुगम आ शास्त्रीय संगीतक प्रतिष्ठित गायिका। विद्यापति गीतोक राग-आधारित शुद्ध गायकीक लेल ख्यातिप्राप्त।',
      english: 'Eminent classical and semi-classical exponent of Maithili music, recognized for rag-pure expositions of Vidyapati verse.'
    },
    awards: ['शास्त्रीय सुर साधक सम्मान', 'विद्यापति पुरस्कार'],
    era: 'शास्त्रीय संगीत युग',
    featured: true
  },
  'rama-jha': {
    slug: 'rama-jha',
    name: 'Rama Jha',
    name_devanagari: 'रमा झा',
    name_roman: 'Rama Jha',
    role: 'वरिष्ठ मैथिली संस्कार गायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'झंझारपुर',
      district: 'मधुबनी (Madhubani)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'मैथिली पारंपरिक संस्कार, कोहबर, समदाउन आ विवाह गीतोक प्रतिष्ठित एवं वरिष्ठ गायिका।',
      english: 'Senior tradition bearer recognized for authentic rendering of domestic Vivah rituals, Kohbar geet, and auspicious family celebrations.'
    },
    awards: ['मिथिला विदुषी सम्मान'],
    era: 'पारंपरिक संस्कार युग',
    featured: false
  },
  'anuradha-paudwal': {
    slug: 'anuradha-paudwal',
    name: 'Anuradha Paudwal',
    name_devanagari: 'अनुराधा पौडवाल',
    name_roman: 'Anuradha Paudwal',
    role: 'पद्म श्री पार्श्वगायक',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'मुंबई',
      district: 'मुंबई (Mumbai)',
      state: 'महाराष्ट्र (Maharashtra)'
    },
    bio: {
      maithili: 'पद्म श्री से अलंकृत सुप्रसिद्ध भारतीय पार्श्वगायक। मैथिली भक्ति संगीत, छठि गीत आ भगवती वंदना में अद्वितीय योगदान।',
      english: 'Padma Shri playback legend whose devotional albums in Maithili remain staples across homes and temples.'
    },
    awards: ['पद्म श्री (2017)', 'राष्ट्रीय फिल्म पुरस्कार'],
    era: 'गोल्डन एरा',
    featured: false
  },
  'suresh-wadkar': {
    slug: 'suresh-wadkar',
    name: 'Suresh Wadkar',
    name_devanagari: 'सुरेश वाडेकर',
    name_roman: 'Suresh Wadkar',
    role: 'पद्म श्री शास्त्रीय पार्श्वगायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'कोल्हापुर / मुंबई',
      district: 'मुंबई',
      state: 'महाराष्ट्र'
    },
    bio: {
      maithili: 'पद्म श्री से अलंकृत शास्त्रीय संगीत गुरु आ पार्श्वगायक। मैथिली भक्ति रचना आ विद्यापति गीतोक विशिष्ट गायक।',
      english: 'Padma Shri classical master whose soulful timbre graces several iconic Maithili devotional suites.'
    },
    awards: ['पद्म श्री (2020)', 'संगीत नाटक अकादमी'],
    era: 'शास्त्रीय संगीत युग',
    featured: false
  },
  'chandan-tiwari': {
    slug: 'chandan-tiwari',
    name: 'Chandan Tiwari',
    name_devanagari: 'चंदन तिवारी',
    name_roman: 'Chandan Tiwari',
    role: 'युवा लोक गायिका (बिस्मिल्लाह खान पुरस्कार)',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    origin: {
      village: 'बड़कागांव',
      district: 'भोजपुर (Bhojpur)',
      state: 'बिहार (Bihar)'
    },
    bio: {
      maithili: 'उस्ताद बिस्मिल्लाह खान युवा पुरस्कार से अलंकृत लोक गायिका। बिहारक पारंपरिक पुरबिया, मैथिली आ लोक संस्कार गीतोक समर्पित साधिका।',
      english: 'Sangeet Natak Akademi Ustad Bismillah Khan Yuva Puraskar winner dedicated to reviving classical Maithili and Purabiya traditions.'
    },
    awards: ['उस्ताद बिस्मिल्लाह खान युवा पुरस्कार', 'लोक सुर श्री सम्मान'],
    era: 'समकालीन लोक युग',
    featured: true
  }
};

async function enrich() {
  console.log('Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('Sur_Mithila');
  const collection = db.collection('artists');

  const dataDir = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const artistsDbPath = path.join(dataDir, 'artists_db.json');

  let updatedCount = 0;

  for (const [slug, meta] of Object.entries(GENUINE_ARTISTS_METADATA)) {
    const updateDoc = {
      $set: {
        role: meta.role,
        origin: meta.origin,
        bio: meta.bio,
        awards: meta.awards,
        era: meta.era,
        featured: meta.featured,
        name_devanagari: meta.name_devanagari,
        avatar_url: meta.avatar_url,
        banner_url: meta.banner_url,
        'stats.total_plays': 0 // Real tracking initializes to 0
      }
    };

    const res = await collection.updateOne({ slug }, updateDoc);
    if (res.matchedCount > 0) {
      updatedCount++;
      console.log(`✓ Enriched: ${meta.name_devanagari} (${slug}) -> Village: ${meta.origin.village}, District: ${meta.origin.district}`);
    } else {
      // Upsert if not found
      await collection.updateOne(
        { slug },
        {
          $set: {
            ...meta,
            stats: {
              total_songs: 0,
              total_plays: 0,
              verified_songs: 0
            }
          }
        },
        { upsert: true }
      );
      console.log(`+ Inserted new artist: ${meta.name_devanagari} (${slug})`);
      updatedCount++;
    }
  }

  // Dump updated database to local artists_db.json
  const allArtists = await collection.find({}).sort({ 'stats.total_songs': -1 }).toArray();
  fs.writeFileSync(artistsDbPath, JSON.stringify(allArtists, null, 2), 'utf8');
  console.log(`Successfully synced ${allArtists.length} artists to ${artistsDbPath}`);

  await client.close();
  console.log(`Enrichment complete! Updated ${updatedCount} artists with genuine origins and authentic awards.`);
}

enrich().catch(err => {
  console.error('Enrichment failed:', err);
  process.exit(1);
});
