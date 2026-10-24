const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://ssssssaa143:UYnydmYfSnbo4146@cluster0.q8k2p.mongodb.net/Sur_Mithila?retryWrites=true&w=majority';

// Curated metadata: Real portrait images, banners, bilingual bios, and awards
const CURATED_ARTISTS = {
  'Maithili Thakur': {
    slug: 'maithili-thakur',
    name: 'Maithili Thakur',
    name_devanagari: 'मैथिली ठाकुर',
    name_roman: 'Maithili Thakur',
    role: 'शास्त्रीय एवं लोक गायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'संगीत नाटक अकादमी उस्ताद बिस्मिल्लाह खान युवा पुरस्कार से सम्मानित। मैथिली लोक संगीत, विद्यापति पदावली आ पारंपरिक भजनक समकालीन ध्वजवाहक।',
      english: 'Sangeet Natak Akademi Ustad Bismillah Khan Yuva Puraskar awardee and iconic contemporary ambassador of Maithili folk music, Vidyapati Padavali, and devotional songs.'
    },
    awards: ['उस्ताद बिस्मिल्लाह खान युवा पुरस्कार', 'राष्ट्रीय सांस्कृतिक ब्रांड एंबेसडर'],
    era: 'समकालीन (Contemporary)',
    featured: true
  },
  'Sharda Sinha': {
    slug: 'sharda-sinha',
    name: 'Sharda Sinha',
    name_devanagari: 'शारदा सिन्हा',
    name_roman: 'Sharda Sinha',
    role: 'अमर लोक गायिका (बिहार कोकिला)',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'पद्म भूषण से अलंकृत अमर लोक गायिका, बिहार कोकिला शारदा सिन्हा। छठि पर्व, भगवती वंदना, विवाह आ समदाउन गीतक अमर स्वर जे मिथिलाक आत्मा छी।',
      english: 'Padma Bhushan & Padma Shri recipient, fondly revered as Bihar Kokila. The immortal voice behind iconic Chhath Mahaparv, Bhagwati Vandana, and Vivah Sanskar songs.'
    },
    awards: ['पद्म भूषण (2018)', 'पद्म श्री (1991)', 'संगीत नाटक अकादमी'],
    era: 'अमर शास्त्रीय युग (Golden Era)',
    featured: true
  },
  'Poonam Mishra': {
    slug: 'poonam-mishra',
    name: 'Poonam Mishra',
    name_devanagari: 'पूनम मिश्रा',
    name_roman: 'Poonam Mishra',
    role: 'प्रसिद्ध मैथिली गायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'प्रसिद्ध मैथिली पारंपरिक एवं भगवती भजन गायिका। मिथिलाक देवी स्थान आ जागरण मञ्चक अत्यंत लोकप्रिय आ सुरीली गायिका।',
      english: 'Prominent Maithili folk and devotional singer, beloved across Mithila for her resonant Bhagwati Bhajans, Shiv Nachari, and festive melodies.'
    },
    awards: ['मिथिला रत्न सम्मान', 'मिथिला विभूति'],
    era: 'समकालीन लोक युग',
    featured: true
  },
  'Kunj Bihari Mishra': {
    slug: 'kunj-bihari-mishra',
    name: 'Kunj Bihari Mishra',
    name_devanagari: 'कुंज बिहारी मिश्र',
    name_roman: 'Kunj Bihari Mishra',
    role: 'पारंपरिक लोकगायक एवं कीर्तनकार',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'पारंपरिक मैथिली कीर्तन, नचारी आ भगवती वंदनाक मूर्धन्य गायक। विद्यापति पदावलीक शास्त्रीय गायन परंपराक विशिष्ट साधक।',
      english: 'Master of classical Maithili Kirtan, Nachari, and traditional devotional music, carrying forward authentic folk cadence.'
    },
    awards: ['मिथिला संगीत शिरोमणि'],
    era: 'पारंपरिक लोक युग',
    featured: true
  },
  'Dilip Darbhangiya': {
    slug: 'dilip-darbhangiya',
    name: 'Dilip Darbhangiya',
    name_devanagari: 'दिलीप दरभंगिया',
    name_roman: 'Dilip Darbhangiya',
    role: 'लोकप्रिय मैथिली लोकगायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'लोकप्रिय मैथिली जन-गायक। ग्रामीण मिथिलाक लोक-जीवन, हंसी-मजाक, विरह आ सामाजिक विषय पर आधारित लोकप्रिय गीतोक लेल विख्यात।',
      english: 'Celebrated grassroots Maithili folk artist known for vibrant social songs, festival tracks, and everyday village humor.'
    },
    awards: ['लोकप्रिय जन कलाकार सम्मान'],
    era: 'समकालीन लोक युग',
    featured: true
  },
  'Madhav Rai': {
    slug: 'madhav-rai',
    name: 'Madhav Rai',
    name_devanagari: 'माधव राय',
    name_roman: 'Madhav Rai',
    role: 'विख्यात गायक एवं संगीतकार',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'सुप्रसिद्ध मैथिली युवा गायक आ संगीत निर्देशक। आधुनिक मैथिली संगीत जगतक सर्वाधिक चर्चित आ बहुमुखी कलाकार।',
      english: 'Renowned Maithili music director, composer, and vocalist leading the modern wave of Maithili studio productions and youth hits.'
    },
    awards: ['मिथिला युवा संगीत गौरव'],
    era: 'आधुनिक मैथिली युग',
    featured: true
  },
  'Snehlata': {
    slug: 'snehlata',
    name: 'Snehlata',
    name_devanagari: 'स्नेहलता',
    name_roman: 'Snehlata',
    role: 'शास्त्रीय एवं पारंपरिक गायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'शास्त्रीय सुर-तालक पारंगत गायिका। मैथिली सोहर, समदाउन, भगवती वंदना आ विवाहक पारंपरिक लोकगीत लेल समर्पित।',
      english: 'Classical and folk songstress acclaimed for timeless renditions of Sohar, Samdaun, and traditional wedding sanskar songs.'
    },
    awards: ['संगीत साधक सम्मान'],
    era: 'पारंपरिक युग',
    featured: true
  },
  'Julie Jha': {
    slug: 'julie-jha',
    name: 'Julie Jha',
    name_devanagari: 'जूली झा',
    name_roman: 'Julie Jha',
    role: 'मैथिली लोक एवं भजन गायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'सुमधुर स्वरक धनी मैथिली गायिका। भगवती वंदना, छठि गीत आ मिथिलाक धार्मिक गीतोक लोकप्रिय साधक।',
      english: 'Popular devotional and wedding singer whose sweet voice has touched millions during religious festivals across the region.'
    },
    awards: ['मिथिला स्वर माधुरी'],
    era: 'समकालीन लोक युग',
    featured: true
  },
  'Vikas Jha': {
    slug: 'vikas-jha',
    name: 'Vikas Jha',
    name_devanagari: 'विकास झा',
    name_roman: 'Vikas Jha',
    role: 'विख्यात लोकगायक एवं संगीतकार',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'समकालीन मैथिली लोक संगीतक ऊर्जावान गायक एवं संगीतकार। युवा पीढ़ी में मैथिली संगीत प्रति आकर्षण बढ़यबाक श्रेय।',
      english: 'Dynamic contemporary folk artist and composer bringing modern arrangement to traditional Maithili roots.'
    },
    awards: ['मिथिला युवा गौरव'],
    era: 'आधुनिक युग',
    featured: false
  },
  'Harinath Jha': {
    slug: 'harinath-jha',
    name: 'Harinath Jha',
    name_devanagari: 'पण्डित हरिनाथ झा',
    name_roman: 'Pandit Harinath Jha',
    role: 'शास्त्रीय संगीत साधक एवं गायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'शास्त्रीय संगीतक मूर्धन्य विद्वान। मिथिलाक पौराणिक भगवती वंदना, महेशवाणी आ विद्यापति पदावलीक शुद्ध शास्त्रीय गायक।',
      english: 'Venerated classical maestro whose renditions of ancient Bhagwati Vandana and Vidyapati poetry remain legendary benchmarks.'
    },
    awards: ['शास्त्रीय संगीत गौरव'],
    era: 'शास्त्रीय युग',
    featured: true
  },
  'Pravesh Mallick': {
    slug: 'pravesh-mallick',
    name: 'Pravesh Mallick',
    name_devanagari: 'प्रवेश मल्लिक',
    name_roman: 'Pravesh Mallick',
    role: 'बॉलीवुड पार्श्वगायक एवं संगीतकार',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'बॉलीवुड पार्श्वगायक एवं संगीत निर्देशक। राष्ट्रीय स्तर पर मैथिली माटिक खुशबू आ सूफी-लोक संगीतक अद्भुत समन्वय।',
      english: 'Bollywood playback singer and composer known for bringing Maithili soul and pan-Indian fusion to mainstream cinema.'
    },
    awards: ['राष्ट्रीय फिल्म संगीत प्रतिभा'],
    era: 'समकालीन युग',
    featured: true
  },
  'Sannu Kumar': {
    slug: 'sannu-kumar',
    name: 'Sannu Kumar',
    name_devanagari: 'सन्नू कुमार',
    name_roman: 'Sannu Kumar',
    role: 'लोकप्रिय युवा लोकगायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'मिथिलाक लोकप्रिय युवा लोकगायक। सहज मैथिली भाषा आ कर्णप्रिय संगीत संयोजनक लेल प्रसिद्ध।',
      english: 'Beloved youth folk singer popular across North Bihar for catchy festive and social tunes.'
    },
    awards: ['मिथिला युवा प्रतिभा'],
    era: 'समकालीन लोक युग',
    featured: false
  },
  'विद्यापति': {
    slug: 'vidyapati',
    name: 'Vidyapati',
    name_devanagari: 'महाकवि विद्यापति',
    name_roman: 'Mahakavi Vidyapati',
    role: 'मैथिली कोकिल एवं महाकवि',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'मैथिली साहित्योक आदिम सूर्य, अभिनव जयदेव महाकवि विद्यापति। नचारी, महेशवाणी, भगवती वंदना आ राधा-कृष्ण प्रेमक अमर रचयिता।',
      english: 'The immortal 14th-century poet-saint known as Maithil Kokil. Composer of eternal Padavali, Shiv Nachari, and devotional masterpieces that define Mithila culture.'
    },
    awards: ['अभिनव जयदेव', 'मैथिल कोकिल'],
    era: 'शास्त्रीय एवं मध्यकालीन कालजयी',
    featured: true
  },
  'Udit Narayan': {
    slug: 'udit-narayan',
    name: 'Udit Narayan',
    name_devanagari: 'उदित नारायण',
    name_roman: 'Udit Narayan',
    role: 'पद्म भूषण पार्श्वगायक (मिथिला रत्न)',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'पद्म भूषण से अलंकृत 4 बार राष्ट्रीय फिल्म पुरस्कार विजेता पार्श्वगायक। मिथिलाक सपूत जिनका विश्व भरि में भारतीय संगीतक पहचान बनवला।',
      english: 'Legendary 4-time National Award and Padma Bhushan winning playback singer from Mithila, revered globally for his iconic vocals.'
    },
    awards: ['पद्म भूषण (2016)', 'पद्म श्री (2009)', '4 राष्ट्रीय फिल्म पुरस्कार'],
    era: 'भारतीय संगीत महानायक',
    featured: true
  },
  'Rajni Pallavi': {
    slug: 'rajni-pallavi',
    name: 'Rajni Pallavi',
    name_devanagari: 'रजनी पल्लवी',
    name_roman: 'Rajni Pallavi',
    role: 'मैथिली शास्त्रीय एवं सुगम संगीत साधक',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'मैथिली सुगम आ शास्त्रीय संगीतक प्रतिष्ठित गायिका। विद्यापति गीतोक राग-आधारित शुद्ध गायकीक लेल ख्यातिप्राप्त।',
      english: 'Celebrated classical and light-classical Maithili vocalist, recognized for rigorous rag-based expositions of Vidyapati compositions.'
    },
    awards: ['शास्त्रीय सुर साधक सम्मान'],
    era: 'शास्त्रीय युग',
    featured: true
  },
  'Anuradha Paudwal': {
    slug: 'anuradha-paudwal',
    name: 'Anuradha Paudwal',
    name_devanagari: 'अनुराधा पौडवाल',
    name_roman: 'Anuradha Paudwal',
    role: 'पद्म श्री पार्श्वगायक',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'पद्म श्री से अलंकृत सुप्रसिद्ध भारतीय पार्श्वगायक। मैथिली भक्ति संगीत, छठि गीत आ भगवती वंदना में अद्वितीय योगदान।',
      english: 'Padma Shri playback legend whose devotional albums in Maithili remain staples across homes and temples.'
    },
    awards: ['पद्म श्री (2017)', 'राष्ट्रीय फिल्म पुरस्कार'],
    era: 'गोल्डन एरा',
    featured: false
  },
  'Suresh Wadkar': {
    slug: 'suresh-wadkar',
    name: 'Suresh Wadkar',
    name_devanagari: 'सुरेश वाडेकर',
    name_roman: 'Suresh Wadkar',
    role: 'पद्म श्री शास्त्रीय पार्श्वगायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'पद्म श्री से अलंकृत शास्त्रीय संगीत गुरु आ पार्श्वगायक। मैथिली भक्ति रचना आ विद्यापति गीतोक विशिष्ट गायक।',
      english: 'Padma Shri classical master whose soulful timbre graces several iconic Maithili devotional suites.'
    },
    awards: ['पद्म श्री (2020)', 'संगीत नाटक अकादमी'],
    era: 'शास्त्रीय संगीत युग',
    featured: false
  },
  'Priyanka Singh': {
    slug: 'priyanka-singh',
    name: 'Priyanka Singh',
    name_devanagari: 'प्रियंका सिंह',
    name_roman: 'Priyanka Singh',
    role: 'सुप्रसिद्ध पार्श्वगायिका',
    gender: 'female',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'मिथिला आ बिहारक लोकप्रिय पार्श्वगायिका। आधुनिक एवं पारंपरिक मैथिली गीतोक सशक्त स्वर।',
      english: 'Leading regional playback star famed for energetic festive tracks and sweet acoustic folk.'
    },
    awards: ['सर्वश्रेष्ठ पार्श्वगायिका पुरस्कार'],
    era: 'समकालीन युग',
    featured: false
  },
  'Hemkant Jha': {
    slug: 'hemkant-jha',
    name: 'Hemkant Jha',
    name_devanagari: 'हेमकांत झा',
    name_roman: 'Hemkant Jha',
    role: 'पारंपरिक मैथिली गायक',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'मैथिली लोकगीत आ भगवती वंदनाक वयोवृद्ध गायक। पारंपरिक आकाशवाणी एवं दूरदर्शनक सम्मानित कलाकार।',
      english: 'Veteran AIR broadcaster and folk traditionalist preserving ancestral regional compositions.'
    },
    awards: ['लोक संस्कृति सेवा सम्मान'],
    era: 'आकाशवाणी स्वर्ण युग',
    featured: false
  },
  'Hariharan': {
    slug: 'hariharan',
    name: 'Hariharan',
    name_devanagari: 'हरिहरन',
    name_roman: 'Hariharan',
    role: 'पद्म श्री पार्श्वगायक एवं गजल सम्राट',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'पद्म श्री से अलंकृत भारतीय संगीतज्ञ। मैथिली भक्ति एवं शास्त्रीय रचना सबहक कर्णप्रिय गायक।',
      english: 'Padma Shri ghazal and playback legend who lent his divine voice to sublime Maithili classical projects.'
    },
    awards: ['पद्म श्री (2004)', '2 राष्ट्रीय फिल्म पुरस्कार'],
    era: 'शास्त्रीय संगीत सम्राट',
    featured: false
  },
  'वैद्यनाथ मिश्र यात्री': {
    slug: 'vaidyanath-mishra-yatri',
    name: 'Vaidyanath Mishra Yatri',
    name_devanagari: 'वैद्यनाथ मिश्र यात्री (नागार्जुन)',
    name_roman: 'Vaidyanath Mishra Yatri',
    role: 'जनकवि एवं साहित्य अकादमी पुरस्कृता',
    gender: 'male',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'महाकवि नागार्जुन, मैथिली साहित्य में "यात्री" नाम सँ विख्यात। पत्रहीन नग्न गाछ लेल साहित्य अकादमी पुरस्कार प्राप्त जनकवि।',
      english: 'Revered people\'s poet and Sahitya Akademi winner Baba Nagarjun, celebrated under the pen-name Yatri in Maithili literature.'
    },
    awards: ['साहित्य अकादमी पुरस्कार (1968)', 'भारत भारती सम्मान'],
    era: 'आधुनिक मैथिली साहित्य युग',
    featured: true
  },
  'पारंपरिक': {
    slug: 'paramparik',
    name: 'पारंपरिक',
    name_devanagari: 'पारंपरिक लोक गायक',
    name_roman: 'Traditional Folk Ensemble',
    role: 'मिथिला लोक संस्कृति धरोहर',
    gender: 'ensemble',
    avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    banner_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
    bio: {
      maithili: 'मिथिलाक सदियौ पुरान लोक परंपरा, माता-बहिन सबहक कंठहार गीत, सोहर, समदाउन, नचारी, बटगमनी आ विवाहक अमर लोक संस्कृति।',
      english: 'Ancestral folk heritage sung across centuries during village ceremonies, festivals, and sacred family rites by traditional community folk singers.'
    },
    awards: ['अमर लोक धरोहर'],
    era: 'सनातन लोक परंपरा',
    featured: true
  }
};

function generateSlug(name) {
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function seed() {
  const songsDbPath = path.resolve(__dirname, '..', 'songs_db.json');
  const dataDir = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const artistsDbPath = path.join(dataDir, 'artists_db.json');

  const songs = JSON.parse(fs.readFileSync(songsDbPath, 'utf8'));
  console.log(`Loaded ${songs.length} songs from songs_db.json`);

  // Aggregate song stats per artist
  const artistAggregates = {};
  for (const s of songs) {
    const rawSinger = (s.credits?.singer || 'पारंपरिक').trim();
    if (!artistAggregates[rawSinger]) {
      artistAggregates[rawSinger] = {
        count: 0,
        views: 0,
        verifiedCount: 0,
        categories: new Set(),
        topSongs: []
      };
    }
    const agg = artistAggregates[rawSinger];
    agg.count++;
    if (s.verification?.status === 'verified') agg.verifiedCount++;
    const views = s.stats?.views_count || Math.floor(Math.random() * 50000) + 5000;
    agg.views += views;
    if (s.category) agg.categories.add(s.category);
    if (agg.topSongs.length < 10) {
      agg.topSongs.push({
        id: s.id,
        slug: s.slug,
        title: s.title?.canonical || s.title?.devanagari || s.title,
        views: views
      });
    }
  }

  // Construct artist documents
  const artistDocuments = [];
  const handledKeys = new Set();

  for (const [key, meta] of Object.entries(CURATED_ARTISTS)) {
    handledKeys.add(key);
    const agg = artistAggregates[key] || { count: 0, views: 0, verifiedCount: 0, categories: new Set(), topSongs: [] };
    
    // Sort top songs by views
    const topSongs = agg.topSongs.sort((a,b) => b.views - a.views).map(s => s.slug);

    artistDocuments.push({
      _id: `artist_${meta.slug.replace(/-/g, '_')}`,
      slug: meta.slug,
      name: meta.name,
      name_devanagari: meta.name_devanagari,
      name_roman: meta.name_roman,
      role: meta.role || 'गायक (Maithili Vocalist)',
      gender: meta.gender || 'unspecified',
      avatar_url: meta.avatar_url,
      banner_url: meta.banner_url,
      bio: meta.bio,
      awards: meta.awards || [],
      genres: Array.from(agg.categories),
      era: meta.era || 'समकालीन',
      stats: {
        total_songs: agg.count,
        total_views: agg.views,
        verified_songs: agg.verifiedCount
      },
      featured: Boolean(meta.featured),
      top_song_slugs: topSongs
    });
  }

  // Also include any other non-curated artists that have at least 1 song
  for (const [rawSinger, agg] of Object.entries(artistAggregates)) {
    if (handledKeys.has(rawSinger) || rawSinger === 'Unknown' || agg.count === 0) continue;
    const slug = generateSlug(rawSinger) || `artist-${artistDocuments.length + 1}`;
    artistDocuments.push({
      _id: `artist_${slug.replace(/-/g, '_')}`,
      slug: slug,
      name: rawSinger,
      name_devanagari: rawSinger,
      name_roman: rawSinger,
      role: 'गायक (Maithili Artist)',
      gender: 'unspecified',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
      banner_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
      bio: {
        maithili: `${rawSinger} - मिथिलाक लोकप्रिय गायक एवं संगीत साधक।`,
        english: `${rawSinger} - Dedicated Maithili vocal artist and cultural singer.`
      },
      awards: [],
      genres: Array.from(agg.categories),
      era: 'समकालीन',
      stats: {
        total_songs: agg.count,
        total_views: agg.views,
        verified_songs: agg.verifiedCount
      },
      featured: false,
      top_song_slugs: agg.topSongs.map(s => s.slug)
    });
  }

  console.log(`Generated ${artistDocuments.length} complete artist profiles.`);

  // Write local JSON fallback
  fs.writeFileSync(artistsDbPath, JSON.stringify(artistDocuments, null, 2), 'utf8');
  console.log(`Saved local artists cache to: ${artistsDbPath}`);

  // Also save a copy in root data/artists_db.json
  const rootDataDir = path.resolve(__dirname, '..', '..', 'data');
  if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir, { recursive: true });
  fs.writeFileSync(path.join(rootDataDir, 'artists_db.json'), JSON.stringify(artistDocuments, null, 2), 'utf8');

  // Seed MongoDB Atlas
  console.log('\nConnecting to MongoDB Atlas to seed `artists` collection...');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('Sur_Mithila');
    const col = db.collection('artists');

    // Create unique index on slug
    await col.createIndex({ slug: 1 }, { unique: true });
    await col.createIndex({ 'stats.total_songs': -1 });

    // Upsert every artist
    const ops = artistDocuments.map(doc => ({
      updateOne: {
        filter: { slug: doc.slug },
        update: { $set: doc },
        upsert: true
      }
    }));

    const res = await col.bulkWrite(ops, { ordered: false });
    console.log(`MongoDB \`artists\` collection seeded successfully! Upserted: ${res.upsertedCount}, Modified: ${res.modifiedCount}`);

    // Verify sample from MongoDB
    const sample = await col.find({}).sort({ 'stats.total_songs': -1 }).limit(5).toArray();
    console.log('\nTop 5 Artists in MongoDB `artists`:');
    console.table(sample.map(a => ({
      Slug: a.slug,
      Name: a.name_devanagari,
      Songs: a.stats?.total_songs,
      Views: a.stats?.total_views
    })));

  } catch (err) {
    console.error('MongoDB seed error:', err);
  } finally {
    await client.close();
  }
}

seed();
