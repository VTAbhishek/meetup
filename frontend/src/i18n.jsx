import { createContext, useContext, useEffect, useState } from 'react'
import { applyCountryFont } from './fonts'

// Country -> language
const COUNTRY_LANG = {
  us: 'en', gb: 'en', ca: 'en', au: 'en', sg: 'en',
  de: 'de', fr: 'fr', in: 'hi', lk: 'si', ae: 'ar',
}
const RTL = ['ar']

const T = {
  en: {
    writeReview: 'Write a review', categories: 'Categories', login: 'Log in',
    forBusinesses: 'For businesses', chooseCountry: 'Choose country',
    myReviews: 'My reviews', accountSettings: 'Account settings', logout: 'Log out',
    heroTitle: 'Find a company you can trust',
    heroSubtitle: 'Read reviews. Write reviews. Discover companies you can rely on.',
    searchPlaceholder: 'Search company or category',
    whatLookingFor: 'What are you looking for?',
    topRated: 'Top rated companies', recentReviews: 'Recent reviews', seeMore: 'See more',
    helpTitle: 'Help millions make the right choice',
    helpText: 'Share your experience, where reviews make a difference. Your voice helps others shop with confidence.',
  },
  de: {
    writeReview: 'Bewertung schreiben', categories: 'Kategorien', login: 'Anmelden',
    forBusinesses: 'Für Unternehmen', chooseCountry: 'Land auswählen',
    myReviews: 'Meine Bewertungen', accountSettings: 'Kontoeinstellungen', logout: 'Abmelden',
    heroTitle: 'Finden Sie ein Unternehmen, dem Sie vertrauen können',
    heroSubtitle: 'Bewertungen lesen. Bewertungen schreiben. Vertrauenswürdige Unternehmen entdecken.',
    searchPlaceholder: 'Unternehmen oder Kategorie suchen',
    whatLookingFor: 'Wonach suchen Sie?',
    topRated: 'Bestbewertete Unternehmen', recentReviews: 'Neueste Bewertungen', seeMore: 'Mehr anzeigen',
    helpTitle: 'Hilf Millionen, die richtige Wahl zu treffen',
    helpText: 'Teile deine Erfahrung – wo Bewertungen einen Unterschied machen. Deine Stimme hilft anderen, mit Vertrauen einzukaufen.',
  },
  fr: {
    writeReview: 'Donner un avis', categories: 'Catégories', login: 'Connexion',
    forBusinesses: 'Pour les entreprises', chooseCountry: 'Choisir un pays',
    myReviews: 'Mes avis', accountSettings: 'Paramètres du compte', logout: 'Déconnexion',
    heroTitle: 'Trouvez une entreprise de confiance',
    heroSubtitle: 'Lisez des avis. Rédigez des avis. Découvrez des entreprises fiables.',
    searchPlaceholder: 'Rechercher une entreprise ou une catégorie',
    whatLookingFor: 'Que recherchez-vous ?',
    topRated: 'Entreprises les mieux notées', recentReviews: 'Avis récents', seeMore: 'Voir plus',
    helpTitle: 'Aidez des millions de personnes à faire le bon choix',
    helpText: 'Partagez votre expérience, là où les avis font la différence. Votre voix aide les autres à acheter en toute confiance.',
  },
  hi: {
    writeReview: 'समीक्षा लिखें', categories: 'श्रेणियाँ', login: 'लॉग इन करें',
    forBusinesses: 'व्यवसायों के लिए', chooseCountry: 'देश चुनें',
    myReviews: 'मेरी समीक्षाएँ', accountSettings: 'खाता सेटिंग्स', logout: 'लॉग आउट',
    heroTitle: 'एक ऐसी कंपनी खोजें जिस पर आप भरोसा कर सकें',
    heroSubtitle: 'समीक्षाएँ पढ़ें। समीक्षाएँ लिखें। भरोसेमंद कंपनियाँ खोजें।',
    searchPlaceholder: 'कंपनी या श्रेणी खोजें',
    whatLookingFor: 'आप क्या ढूंढ रहे हैं?',
    topRated: 'शीर्ष रेटेड कंपनियाँ', recentReviews: 'हाल की समीक्षाएँ', seeMore: 'और देखें',
    helpTitle: 'लाखों लोगों को सही चुनाव करने में मदद करें',
    helpText: 'अपना अनुभव साझा करें, जहाँ समीक्षाएँ फर्क लाती हैं। आपकी आवाज़ दूसरों को भरोसे के साथ खरीदारी करने में मदद करती है।',
  },
  si: {
    writeReview: 'සමාලෝචනයක් ලියන්න', categories: 'ප්‍රවර්ග', login: 'පිවිසෙන්න',
    forBusinesses: 'ව්‍යාපාර සඳහා', chooseCountry: 'රට තෝරන්න',
    myReviews: 'මගේ සමාලෝචන', accountSettings: 'ගිණුම් සැකසුම්', logout: 'පිටවීම',
    heroTitle: 'ඔබට විශ්වාස කළ හැකි සමාගමක් සොයාගන්න',
    heroSubtitle: 'සමාලෝචන කියවන්න. සමාලෝචන ලියන්න. විශ්වාසවන්ත සමාගම් සොයාගන්න.',
    searchPlaceholder: 'සමාගම හෝ ප්‍රවර්ගය සොයන්න',
    whatLookingFor: 'ඔබ සොයන්නේ කුමක්ද?',
    topRated: 'ඉහළම ශ්‍රේණිගත සමාගම්', recentReviews: 'මෑත සමාලෝචන', seeMore: 'තවත් බලන්න',
    helpTitle: 'මිලියන ගණනකට නිවැරදි තේරීම කිරීමට උදව් කරන්න',
    helpText: 'ඔබේ අත්දැකීම බෙදාගන්න — සමාලෝචන වෙනසක් කරන තැන. ඔබේ හඬ අන් අයට විශ්වාසයෙන් සාප්පු යාමට උදව් කරයි.',
  },
  ar: {
    writeReview: 'اكتب مراجعة', categories: 'الفئات', login: 'تسجيل الدخول',
    forBusinesses: 'للشركات', chooseCountry: 'اختر الدولة',
    myReviews: 'مراجعاتي', accountSettings: 'إعدادات الحساب', logout: 'تسجيل الخروج',
    heroTitle: 'اعثر على شركة يمكنك الوثوق بها',
    heroSubtitle: 'اقرأ المراجعات. اكتب المراجعات. اكتشف شركات يمكنك الاعتماد عليها.',
    searchPlaceholder: 'ابحث عن شركة أو فئة',
    whatLookingFor: 'عمّ تبحث؟',
    topRated: 'أعلى الشركات تقييماً', recentReviews: 'أحدث المراجعات', seeMore: 'عرض المزيد',
    helpTitle: 'ساعد الملايين على اتخاذ القرار الصحيح',
    helpText: 'شارك تجربتك، حيث تُحدث المراجعات فرقاً. صوتك يساعد الآخرين على التسوق بثقة.',
  },
}

const LangContext = createContext(null)

export function LanguageProvider({ children }) {
  const [country, setCountryState] = useState(() => localStorage.getItem('country') || 'us')
  const lang = COUNTRY_LANG[country] || 'en'

  const apply = (c) => {
    const l = COUNTRY_LANG[c] || 'en'
    applyCountryFont(c)
    document.documentElement.lang = l
    document.documentElement.dir = RTL.includes(l) ? 'rtl' : 'ltr'
  }

  useEffect(() => { apply(country) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setCountry = (c) => {
    setCountryState(c)
    localStorage.setItem('country', c)
    apply(c)
  }

  const t = (key) => (T[lang] && T[lang][key]) || T.en[key] || key

  return (
    <LangContext.Provider value={{ country, lang, dir: RTL.includes(lang) ? 'rtl' : 'ltr', setCountry, t }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
