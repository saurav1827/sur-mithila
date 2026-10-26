// Plain module (works in both Node.js and Next.js client/server)
export const CULTURAL_CATEGORIES = [
    { name: 'सभ (All)', en: 'All', pure: 'सभ', value: 'all', aliases: ['all', 'सभ'] },
    { name: 'भगवती गीत', en: 'Bhagwati Geet', pure: 'भगवती गीत', value: 'भगवती', aliases: ['भगवती', 'भगवती गीत', 'bhagwati', 'दुर्गा', 'गोसाउनि'] },
    { name: 'विवाह संस्कार', en: 'Wedding Songs', pure: 'विवाह संस्कार', value: 'विवाह', aliases: ['विवाह', 'विवाह संस्कार', 'विवाह गीत', 'vivah', 'wedding'] },
    { name: 'छठि महापर्व', en: 'Chhath Mahaparv', pure: 'छठि महापर्व', value: 'छठि', aliases: ['छठि', 'छठ', 'chhath', 'छठि महापर्व', 'छठ गीत', 'छठि गीत'] },
    { name: 'नचारी / महेशवाणी', en: 'Shiva Nachari', pure: 'नचारी व महेशवाणी', value: 'नचारी', aliases: ['नचारी', 'महेशवाणी', 'nachari', 'शिव'] },
    { name: 'समदाउन (विदाई)', en: 'Samdaun (Farewell)', pure: 'समदाउन', value: 'समदाउन', aliases: ['समदाउन', 'samdaun', 'विदाई'] },
    { name: 'सोहर (जन्मोत्सव)', en: 'Sohar (Birth Songs)', pure: 'सोहर', value: 'सोहर', aliases: ['सोहर', 'sohar', 'जन्मोत्सव', 'सोहर / जन्मोत्सव'] },
    { name: 'विद्यापति पदावली', en: 'Vidyapati Padavali', pure: 'विद्यापति पदावली', value: 'विद्यापति', aliases: ['विद्यापति', 'vidyapati', 'विद्यापति पदावली'] },
    { name: 'ऋतु / पर्व गीत', en: 'Seasons & Festivals', pure: 'ऋतु व पर्व गीत', value: 'पर्व', aliases: ['पर्व', 'ऋतु', 'ऋतु / पर्व गीत', 'festivals'] },
    { name: 'सलहेस गाथा', en: 'Salhesh Gatha', pure: 'सलहेस गाथा', value: 'सलहेस', aliases: ['सलहेस', 'salhesh', 'सलहेस गाथा'] },
    { name: 'मैथिली लोकगीत', en: 'Maithili Lokgeet', pure: 'मैथिली लोकगीत', value: 'मैथिली लोकगीत', aliases: ['मैथिली लोकगीत', 'लोकगीत', 'folk'] },
];

/**
 * Find category metadata by value, name, pure, or alias
 */
export function getCategoryMeta(val) {
    if (!val || val === 'all') return CULTURAL_CATEGORIES[0];
    const k = String(val).trim().toLowerCase();

    const exact = CULTURAL_CATEGORIES.find(c =>
        c.value.toLowerCase() === k ||
        c.name.toLowerCase() === k ||
        c.pure.toLowerCase() === k ||
        c.en.toLowerCase() === k ||
        c.aliases?.some(a => a.toLowerCase() === k)
    );
    if (exact) return exact;

    const partial = CULTURAL_CATEGORIES.find(c =>
        c.value !== 'all' && (
            k.includes(c.value.toLowerCase()) ||
            c.value.toLowerCase().includes(k) ||
            c.name.toLowerCase().includes(k) ||
            c.aliases?.some(a => k.includes(a.toLowerCase()))
        )
    );
    if (partial) return partial;

    return { name: val, en: val, pure: val, value: val };
}

/**
 * Construct MongoDB filter for a category query
 */
export function getCategoryMongoFilter(category) {
    if (!category || category === 'all') return null;
    const k = category.trim().toLowerCase();

    if (k.includes('छठ') || k.includes('chhath')) {
        return {
            $or: [
                { category: { $regex: 'छठ', $options: 'i' } },
                { tags: { $regex: 'chhath|छठि|छठी|छठ पूजा', $options: 'i' } },
                { 'title.canonical': { $regex: 'छठि|छठी|छठ |Chhath|बहँगिया|बहंगिया', $options: 'i' } },
                { 'title.raw_title': { $regex: 'छठि|छठी|छठ |Chhath|बहँगिया|बहंगिया', $options: 'i' } },
                { 'title.roman': { $regex: 'chhath', $options: 'i' } },
                { 'lyrics.devanagari': { $regex: 'छठि पूजा|छठी मइया|छठी मैया|छठी माई|बहँगिया|बहंगिया|सुरुजदेव|सुरुज देव', $options: 'i' } }
            ]
        };
    }

    if (k.includes('समदाउन') || k.includes('samdaun') || k.includes('विदाई')) {
        return {
            $or: [
                { category: { $regex: 'समदाउन|विदाई', $options: 'i' } },
                { tags: { $regex: 'समदाउन|samdaun', $options: 'i' } },
                { 'title.canonical': { $regex: 'समदाउन|विदाई', $options: 'i' } },
                { 'title.raw_title': { $regex: 'समदाउन|विदाई', $options: 'i' } },
                { 'title.roman': { $regex: 'samdaun', $options: 'i' } },
                { 'lyrics.devanagari': { $regex: 'समदाउन', $options: 'i' } }
            ]
        };
    }

    if (k.includes('नचारी') || k.includes('महेशवाणी') || k.includes('nachari')) {
        return {
            $or: [
                { category: { $regex: 'नचारी|महेशवाणी', $options: 'i' } },
                { tags: { $regex: 'नचारी|महेशवाणी|nachari|maheshvani', $options: 'i' } },
                { 'title.canonical': { $regex: 'नचारी|महेशवाणी|भोलेनाथ|शिव भजन', $options: 'i' } },
                { 'title.raw_title': { $regex: 'नचारी|महेशवाणी|भोलेनाथ|शिव भजन', $options: 'i' } }
            ]
        };
    }

    if (k.includes('सोहर') || k.includes('sohar') || k.includes('जन्मोत्सव')) {
        return {
            $or: [
                { category: { $regex: 'सोहर|जन्मोत्सव', $options: 'i' } },
                { tags: { $regex: 'सोहर|sohar|जन्मोत्सव', $options: 'i' } },
                { 'title.canonical': { $regex: 'सोहर|जन्मोत्सव|ललना', $options: 'i' } },
                { 'title.raw_title': { $regex: 'सोहर|जन्मोत्सव|ललना', $options: 'i' } }
            ]
        };
    }

    if (k.includes('विवाह') || k.includes('vivah') || k.includes('लगन')) {
        return {
            $or: [
                { category: { $regex: 'विवाह|लगन', $options: 'i' } },
                { tags: { $regex: 'विवाह|vivah|wedding|लगन|मटकोर|कन्यादान', $options: 'i' } },
                { 'title.canonical': { $regex: 'विवाह|लगन|मटकोर|कन्यादान|परिछन', $options: 'i' } }
            ]
        };
    }

    if (k.includes('विद्यापति') || k.includes('vidyapati')) {
        return {
            $or: [
                { category: { $regex: 'विद्यापति', $options: 'i' } },
                { 'credits.writer.name': { $regex: 'विद्यापति', $options: 'i' } },
                { 'credits.writer': { $regex: 'विद्यापति', $options: 'i' } },
                { tags: { $regex: 'विद्यापति|vidyapati', $options: 'i' } },
                { 'title.canonical': { $regex: 'विद्यापति', $options: 'i' } }
            ]
        };
    }

    if (k.includes('पर्व') || k.includes('ऋतु')) {
        return {
            $or: [
                { category: { $regex: 'ऋतु|पर्व', $options: 'i' } },
                { tags: { $regex: 'ऋतु|पर्व|चैती|फगुआ|होली|झिझिया|सामा', $options: 'i' } },
                { 'title.canonical': { $regex: 'पर्व|ऋतु|चैती|फगुआ|होली|झिझिया|सामा', $options: 'i' } }
            ]
        };
    }

    if (k.includes('भगवती') || k.includes('bhagwati')) {
        return {
            $or: [
                { category: { $regex: 'भगवती', $options: 'i' } },
                { tags: { $regex: 'भगवती|bhagwati|गोसाउनि|दुर्गा', $options: 'i' } },
                { 'title.canonical': { $regex: 'भगवती|गोसाउनि|दुर्गा|भैरवि', $options: 'i' } }
            ]
        };
    }

    if (k.includes('सलहेस') || k.includes('salhesh')) {
        return {
            $or: [
                { category: { $regex: 'सलहेस', $options: 'i' } },
                { tags: { $regex: 'सलहेस|salhesh', $options: 'i' } },
                { 'title.canonical': { $regex: 'सलहेस', $options: 'i' } }
            ]
        };
    }

    return { category: { $regex: category, $options: 'i' } };
}

/**
 * Match a song in memory by category keyword (for local JSON database or arrays)
 */
export function matchSongCategory(s, category) {
    if (!category || category === 'all') return true;
    const k = category.trim().toLowerCase();

    const cat = (s.category || '').toLowerCase();
    const title = (s.title?.canonical || s.title?.devanagari || s.title?.raw_title || (typeof s.title === 'string' ? s.title : '')).toLowerCase();
    const roman = (s.title?.roman || '').toLowerCase();
    const desc = (s.description || '').toLowerCase();
    const tags = (Array.isArray(s.tags) ? s.tags.join(' ') : (s.tags || '')).toLowerCase();
    const writer = (s.credits?.writer?.name || s.credits?.writer || '').toLowerCase();
    const lyrics = (s.lyrics?.devanagari || s.lyrics?.raw_text || '').toLowerCase();
    const full = cat + ' ' + title + ' ' + roman + ' ' + desc + ' ' + tags + ' ' + writer + ' ' + lyrics;

    if (cat === k || cat.includes(k)) return true;

    if (k.includes('छठ') || k.includes('chhath')) {
        return (
            cat.includes('छठ') ||
            tags.includes('chhath') || tags.includes('छठ') || tags.includes('छठी') ||
            title.includes('छठि') || title.includes('छठी') || title.includes('छठ ') || title.includes('chhath') || title.includes('बहँगिया') || title.includes('बहंगिया') ||
            lyrics.includes('छठि पूजा') || lyrics.includes('छठी मइया') || lyrics.includes('छठी मैया') || lyrics.includes('छठी माई') || lyrics.includes('बहँगिया') || lyrics.includes('बहंगिया') || lyrics.includes('सुरुजदेव')
        );
    }

    if (k.includes('समदाउन') || k.includes('samdaun') || k.includes('विदाई')) {
        return (
            cat.includes('समदाउन') ||
            tags.includes('samdaun') || tags.includes('समदाउन') ||
            title.includes('समदाउन') || title.includes('विदाई') ||
            lyrics.includes('समदाउन')
        );
    }

    if (k.includes('सोहर') || k.includes('sohar') || k.includes('जन्मोत्सव')) {
        return cat.includes('सोहर') || tags.includes('सोहर') || tags.includes('sohar') || title.includes('सोहर') || title.includes('जन्मोत्सव') || title.includes('ललना');
    }

    if (k.includes('विवाह') || k.includes('vivah') || k.includes('लगन')) {
        return cat.includes('विवाह') || tags.includes('विवाह') || tags.includes('vivah') || title.includes('विवाह') || title.includes('मटकोर') || title.includes('कन्यादान');
    }

    if (k.includes('नचारी') || k.includes('महेशवाणी') || k.includes('nachari')) {
        return cat.includes('नचारी') || cat.includes('महेशवाणी') || tags.includes('नचारी') || title.includes('नचारी') || title.includes('महेशवाणी') || title.includes('शिव भजन') || title.includes('भोलेनाथ');
    }

    if (k.includes('विद्यापति') || k.includes('vidyapati')) {
        return cat.includes('विद्यापति') || writer.includes('विद्यापति') || tags.includes('विद्यापति') || title.includes('विद्यापति');
    }

    if (k.includes('पर्व') || k.includes('ऋतु')) {
        return cat.includes('पर्व') || cat.includes('ऋतु') || tags.includes('पर्व') || tags.includes('ऋतु') || title.includes('पर्व') || title.includes('ऋतु') || title.includes('चैती') || title.includes('फगुआ') || title.includes('सामा');
    }

    if (k.includes('भगवती') || k.includes('bhagwati')) {
        return cat.includes('भगवती') || tags.includes('भगवती') || title.includes('भगवती') || title.includes('गोसाउनि') || title.includes('दुर्गा');
    }

    if (k.includes('सलहेस') || k.includes('salhesh')) {
        return cat.includes('सलहेस') || tags.includes('सलहेस') || title.includes('सलहेस');
    }

    return cat.includes(k) || full.includes(k);
}