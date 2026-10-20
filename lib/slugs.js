// slugs.js - Phonetic Roman transliteration and URL slug generator for Maithili text

const M_CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h', 'ड़': 'r', 'ढ़': 'rh'
};

const M_MATRAS = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au'
};

const M_VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'ं': 'n', 'ँ': 'n', 'ः': 'h', '।': '.', '॥': '..'
};

export function transliterateWord(word) {
  if (!word) return '';
  const chars = Array.from(word);
  const out = [];
  const n = chars.length;
  let i = 0;

  while (i < n) {
    const c = chars[i];
    if (M_CONSONANTS[c]) {
      const base = M_CONSONANTS[c];
      if (i + 1 < n && chars[i + 1] === '्') {
        out.push(base);
        i += 2;
      } else if (i + 1 < n && M_MATRAS[chars[i + 1]]) {
        out.push(base + M_MATRAS[chars[i + 1]]);
        i += 2;
      } else {
        // Schwa deletion at word boundaries
        if (i + 1 === n || (i + 1 < n && /[\s,.\-!?;:]/.test(chars[i + 1]))) {
          out.push(base);
        } else {
          out.push(base + 'a');
        }
        i += 1;
      }
    } else if (M_MATRAS[c]) {
      out.push(M_MATRAS[c]);
      i += 1;
    } else if (M_VOWELS[c]) {
      out.push(M_VOWELS[c]);
      i += 1;
    } else if (c === '्') {
      i += 1;
    } else {
      out.push(c);
      i += 1;
    }
  }

  return out.join('');
}

export function transliterateLyrics(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const resLines = lines.map(line => {
    // Split into tokens preserving whitespace and delimiters
    const tokens = line.split(/(\s+|[,\-।॥!?:;])/);
    const transTokens = tokens.map(t => transliterateWord(t));
    let res = transTokens.join('');
    if (res && /^[a-z]/.test(res)) {
      res = res.charAt(0).toUpperCase() + res.slice(1);
    }
    return res;
  });
  return resLines.join('\n');
}

export function toRoman(text) {
  if (!text) return '';
  if (!/[\u0900-\u097F]/.test(text)) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  }
  const clean = transliterateLyrics(text).toLowerCase();
  return clean.replace(/[^a-z0-9\s]/g, '').trim();
}

export function generateSongSlug(title, songId = '') {
  let clean = toRoman(title);
  clean = clean.replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  if (!clean) clean = 'geet';
  const numSuffix = (songId || '').replace('maithili_geet_', '').replace(/[^0-9]/g, '');
  return numSuffix ? `${clean}-${numSuffix}` : clean;
}

export function generateArtistSlug(artistName) {
  let clean = toRoman(artistName);
  clean = clean.replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'artist';
}
