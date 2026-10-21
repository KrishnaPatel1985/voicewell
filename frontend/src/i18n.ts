// Country catalog, language catalog, and end-to-end translations (en, es, zh-CN).

export type SupportedLanguage = 'en' | 'es' | 'zh-CN'

export interface SubdivisionOption {
  code: string
  name: string
}

export interface CountryOption {
  code: string
  name: string
  nativeName: string
  supported: boolean
  featured?: boolean
  requiresRegion?: boolean
  subdivisions?: SubdivisionOption[]
  kidSummary: {
    en: string
    es: string
    'zh-CN': string
  }
}

export const COUNTRIES: CountryOption[] = [
  {
    code: 'US',
    name: 'United States',
    nativeName: 'United States',
    supported: true,
    featured: true,
    requiresRegion: true,
    subdivisions: [
      { code: 'US', name: 'United States (General / Federal)' },
      { code: 'US-CA', name: 'California (US-CA)' },
      { code: 'US-UT', name: 'Utah (US-UT)' },
      { code: 'US-NY', name: 'New York (US-NY)' },
      { code: 'US-TX', name: 'Texas (US-TX)' },
      { code: 'US-FL', name: 'Florida (US-FL)' },
      { code: 'US-WA', name: 'Washington (US-WA)' },
      { code: 'US-IL', name: 'Illinois (US-IL)' },
    ],
    kidSummary: {
      en: 'Digital consent age 13 · Kids <13 need parental consent; Teens 13–17 can self-toggle AI permissions (PLAYER); Adults 18+ full access.',
      es: 'Edad de consentimiento digital 13 · Niños <13 requieren permiso paterno; Adolescentes 13–17 gestionan IA (PLAYER); Adultos 18+ acceso completo.',
      'zh-CN': '数字同意年龄 13 岁 · 13岁以下需家长同意；13–17岁青少年可自主开关 AI 权限 (PLAYER)；18岁以上完全开放。',
    },
  },
  {
    code: 'AU',
    name: 'Australia',
    nativeName: 'Australia',
    supported: true,
    featured: true,
    requiresRegion: true,
    subdivisions: [
      { code: 'AU', name: 'Australia (National)' },
      { code: 'AU-NSW', name: 'New South Wales (AU-NSW)' },
      { code: 'AU-VIC', name: 'Victoria (AU-VIC)' },
      { code: 'AU-QLD', name: 'Queensland (AU-QLD)' },
      { code: 'AU-WA', name: 'Western Australia (AU-WA)' },
    ],
    kidSummary: {
      en: 'Digital consent age 15 · Kids & Teens <15 need parental consent; Teens 15–17 get Text AI ON (PLAYER) while Voice AI requires a Guardian (GUARDIAN).',
      es: 'Edad de consentimiento 15 · Menores de 15 requieren permiso paterno; Adolescentes 15–17 tienen chat IA activo (PLAYER) pero voz requiere tutor (GUARDIAN).',
      'zh-CN': '数字同意年龄 15 岁 · 15岁以下需家长同意；15–17岁青少年默认开启文字 AI (PLAYER)，但语音 AI 需监护人批准 (GUARDIAN)。',
    },
  },
  {
    code: 'ES',
    name: 'Spain',
    nativeName: 'España',
    supported: true,
    featured: true,
    kidSummary: {
      en: 'Digital consent age 14 · Kids & 13yo Teens need parental consent; Teens 14–15 have AI locked by Guardian (GUARDIAN); 16–17 self-manage (PLAYER).',
      es: 'Edad de consentimiento 14 · Menores de 14 requieren consentimiento paterno; 14–15 años tienen IA gestionada por tutor (GUARDIAN); 16–17 (PLAYER).',
      'zh-CN': '数字同意年龄 14 岁 · 14岁以下（含13岁青少年）需家长同意；14–15岁 AI 权限由监护人控制 (GUARDIAN)；16–17岁可自主管理。',
    },
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    nativeName: 'United Kingdom',
    supported: true,
    featured: true,
    subdivisions: [
      { code: 'GB', name: 'England, Wales & Northern Ireland (GB)' },
      { code: 'GB-SCT', name: 'Scotland (GB-SCT)' },
    ],
    kidSummary: {
      en: 'Digital consent age 13 · Kids <13 need parental consent; Teens 13–15 have AI locked by Guardian (GUARDIAN); Teens 16–17 self-manage (PLAYER).',
      es: 'Edad de consentimiento 13 · Menores de 13 requieren permiso paterno; 13–15 años requieren tutor para IA (GUARDIAN); 16–17 gestionan sus permisos.',
      'zh-CN': '数字同意年龄 13 岁 · 13岁以下需家长同意；13–15岁青少年 AI 权限需监护人开启 (GUARDIAN)；16–17岁可自主开关。',
    },
  },
  {
    code: 'CN',
    name: 'China',
    nativeName: '中国',
    supported: true,
    featured: true,
    kidSummary: {
      en: 'Digital consent age 14 · Under 14 needs parental consent; Teens 14–17 get Text AI ON (PLAYER) while Voice AI is Prohibited (PROHIBITED).',
      es: 'Edad de consentimiento 14 · Menores de 14 requieren permiso paterno; 14–17 años tienen texto IA activo pero voz IA prohibida (PROHIBITED).',
      'zh-CN': '数字同意年龄 14 岁 · 14岁以下需家长同意；14–17岁青少年默认开启文字 AI (PLAYER)，实时语音模式对未成年人禁用 (PROHIBITED)。',
    },
  },
  {
    code: 'BR',
    name: 'Brazil',
    nativeName: 'Brasil',
    supported: true,
    featured: true,
    kidSummary: {
      en: 'Digital consent age 12 · A 12yo Child passes the initial gate (Kids UI) with Guardian-managed AI (GUARDIAN); under 12 needs parental consent.',
      es: 'Edad de consentimiento 12 · Niños de 12 años pasan el control inicial (interfaz infantil) con IA gestionada por tutor (GUARDIAN).',
      'zh-CN': '数字同意年龄 12 岁 · 12岁儿童可直接通过初始验证进入儿童界面（AI 需监护人开启）；12岁以下需家长同意。',
    },
  },
  {
    code: 'DE',
    name: 'Germany',
    nativeName: 'Deutschland',
    supported: true,
    kidSummary: {
      en: 'Digital consent age 16 · Kids and Teens 13–15 require parental consent; Teens 16–17 get PLAYER text AI and GUARDIAN voice AI.',
      es: 'Edad de consentimiento 16 · Menores de 16 requieren consentimiento paterno; 16–17 años gestionan texto IA (PLAYER) y voz por tutor (GUARDIAN).',
      'zh-CN': '数字同意年龄 16 岁 · 16岁以下需家长同意；16–17岁文字 AI 可自主管理 (PLAYER)，语音 AI 需监护人开启 (GUARDIAN)。',
    },
  },
  {
    code: 'CA',
    name: 'Canada',
    nativeName: 'Canada',
    supported: true,
    requiresRegion: true,
    subdivisions: [
      { code: 'CA', name: 'Canada (Federal)' },
      { code: 'CA-ON', name: 'Ontario (CA-ON)' },
      { code: 'CA-QC', name: 'Québec (CA-QC)' },
      { code: 'CA-BC', name: 'British Columbia (CA-BC)' },
      { code: 'CA-AB', name: 'Alberta (CA-AB)' },
    ],
    kidSummary: {
      en: 'Digital consent age 13 (14 in Québec) · Provincial rules govern minor consent and AI permissions.',
      es: 'Edad de consentimiento 13 (14 en Quebec) · Las reglas provinciales determinan los permisos de IA.',
      'zh-CN': '数字同意年龄 13 岁（魁北克省为 14 岁）· 按省份适用未成年人同意与 AI 权限规则。',
    },
  },
  {
    code: 'MX',
    name: 'Mexico',
    nativeName: 'México',
    supported: true,
    kidSummary: {
      en: 'Digital consent age 18 · All users under 18 (both Kids and Teens) require parental consent.',
      es: 'Edad de consentimiento 18 · Todos los menores de 18 años requieren consentimiento de un adulto.',
      'zh-CN': '数字同意年龄 18 岁 · 所有 18 岁以下未成年人均需家长同意。',
    },
  },
  {
    code: 'FR',
    name: 'France',
    nativeName: 'France',
    supported: true,
    kidSummary: {
      en: 'Digital consent age 15 · Under 15 requires parental consent; 15–17 Guardian/Player managed permissions.',
      es: 'Edad de consentimiento 15 · Menores de 15 requieren permiso paterno.',
      'zh-CN': '数字同意年龄 15 岁 · 15岁以下需家长同意。',
    },
  },
  {
    code: 'JP',
    name: 'Japan',
    nativeName: '日本',
    supported: true,
    kidSummary: {
      en: 'Digital consent age 16 · Under 16 requires parental consent; 18+ adult permissions.',
      es: 'Edad de consentimiento 16 · Menores de 16 requieren consentimiento paterno.',
      'zh-CN': '数字同意年龄 16 岁 · 16岁以下需家长同意。',
    },
  },
  // Explicitly unsupported jurisdictions (never silently default to another country)
  {
    code: 'CU',
    name: 'Cuba',
    nativeName: 'Cuba',
    supported: false,
    kidSummary: {
      en: 'Unsupported jurisdiction — Voicewell does not currently operate or have verified compliance rules here.',
      es: 'Jurisdicción no compatible — Voicewell aún no está disponible en este país.',
      'zh-CN': '暂不支持的司法管辖区 — Voicewell 目前尚未在此地区提供服务。',
    },
  },
  {
    code: 'KP',
    name: 'North Korea',
    nativeName: '조선민주주의인민共和国',
    supported: false,
    kidSummary: {
      en: 'Unsupported jurisdiction — Voicewell is not available in this country.',
      es: 'Jurisdicción no compatible — Voicewell no está disponible en este país.',
      'zh-CN': '暂不支持的司法管辖区 — Voicewell 在此国家/地区不可用。',
    },
  },
  {
    code: 'IR',
    name: 'Iran',
    nativeName: 'ایران',
    supported: false,
    kidSummary: {
      en: 'Unsupported jurisdiction — Voicewell is not available in this country.',
      es: 'Jurisdicción no compatible — Voicewell no está disponible en este país.',
      'zh-CN': '暂不支持的司法管辖区 — Voicewell 在此国家/地区不可用。',
    },
  },
  {
    code: 'SY',
    name: 'Syria',
    nativeName: 'سوريا',
    supported: false,
    kidSummary: {
      en: 'Unsupported jurisdiction — Voicewell is not available in this country.',
      es: 'Jurisdicción no compatible — Voicewell no está disponible en este país.',
      'zh-CN': '暂不支持的司法管辖区 — Voicewell 在此国家/地区不可用。',
    },
  },
]

export interface LanguageOption {
  code: string
  nativeName: string
  englishName: string
  enabled: boolean
  voiceNote: {
    en: string
    es: string
    'zh-CN': string
  }
}

export const LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    enabled: true,
    voiceNote: {
      en: 'Full UI, AI conversation, Pause & Coach, journal cards, and live voice supported.',
      es: 'Interfaz completa, conversación IA, Pausa y Coach, diario y voz en vivo compatibles.',
      'zh-CN': '全面支持界面、AI 对话、暂停与指导、日记卡片及实时语音。',
    },
  },
  {
    code: 'es',
    nativeName: 'Español',
    englishName: 'Spanish',
    enabled: true,
    voiceNote: {
      en: 'Full UI, AI conversation, Pause & Coach, and journal cards in Español. Live voice uses English TTS engine with Spanish text fallback when needed.',
      es: 'Interfaz, conversación IA, Pausa y Coach y diario en Español. Si la voz en vivo tiene limitaciones de acento, puedes usar texto permitido en Español.',
      'zh-CN': '全面支持西班牙语界面、AI 对话、暂停指导与日记卡片；同时提供文字互动备选。',
    },
  },
  {
    code: 'zh-CN',
    nativeName: '简体中文',
    englishName: 'Simplified Chinese',
    enabled: true,
    voiceNote: {
      en: 'Full UI, AI conversation, Pause & Coach, and journal cards in 简体中文. Live voice uses English TTS engine; permitted text mode is always available in 简体中文.',
      es: 'Interfaz, conversación IA, Pausa y Coach y diario en Chino Simplificado, con alternativa de texto completo.',
      'zh-CN': '全面支持简体中文界面、AI 对话、暂停与指导及日记卡片。实时语音引擎主要针对英语优化，您可随时使用完整的简体中文文字模式。',
    },
  },
  {
    code: 'fr',
    nativeName: 'Français',
    englishName: 'French',
    enabled: false,
    voiceNote: {
      en: 'Unavailable — end-to-end translation and safety review not yet enabled.',
      es: 'No disponible — traducción completa aún no habilitada.',
      'zh-CN': '暂不可用 — 尚未完成端到端语言与安全审核。',
    },
  },
  {
    code: 'de',
    nativeName: 'Deutsch',
    englishName: 'German',
    enabled: false,
    voiceNote: {
      en: 'Unavailable — end-to-end translation and safety review not yet enabled.',
      es: 'No disponible — traducción completa aún no habilitada.',
      'zh-CN': '暂不可用 — 尚未完成端到端语言与安全审核。',
    },
  },
  {
    code: 'pt-BR',
    nativeName: 'Português (Brasil)',
    englishName: 'Portuguese',
    enabled: false,
    voiceNote: {
      en: 'Unavailable — end-to-end translation and safety review not yet enabled.',
      es: 'No disponible — traducción completa aún no habilitada.',
      'zh-CN': '暂不可用 — 尚未完成端到端语言与安全审核。',
    },
  },
  {
    code: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    enabled: false,
    voiceNote: {
      en: 'Unavailable — end-to-end translation and safety review not yet enabled.',
      es: 'No disponible — traducción completa aún no habilitada.',
      'zh-CN': '暂不可用 — 尚未完成端到端语言与安全审核。',
    },
  },
  {
    code: 'ko',
    nativeName: '한국어',
    englishName: 'Korean',
    enabled: false,
    voiceNote: {
      en: 'Unavailable — end-to-end translation and safety review not yet enabled.',
      es: 'No disponible — traducción completa aún no habilitada.',
      'zh-CN': '暂不可用 — 尚未完成端到端语言与安全审核。',
    },
  },
]

export const UI_STRINGS = {
  en: {
    navHome: 'Home',
    navJournal: 'My Journal',
    navSpecialists: 'Specialists',
    navPermissions: 'Permissions & Settings',
    navLogout: 'Log out',
    welcomeKicker: 'Everyone starts together · Adapts by age & country',
    welcomeTitle: 'Find your words.',
    welcomeSubtitle: 'Practise saying how you feel and what you need, at your own pace.',
    getStarted: 'Get started',
    trustPrivate: 'Private',
    trustNoDiagnosis: 'No diagnosis',
    trustAdaptive: 'Your pace',
    // Onboarding
    stepOf: (cur: number, total: number) => `Step ${cur} of ${total}`,
    back: 'Back',
    continueBtn: 'Continue',
    ageTitle: 'How old are you?',
    ageCopy: 'Select your actual age. Voicewell uses k-ID to check real permissions for your country and sets your starting workspace.',
    underSixTitle: 'Voicewell is for ages 6 and up',
    underSixBody: 'We are sorry — Voicewell is not available for children under 6. Please ask a parent or trusted grown-up for help.',
    countryTitle: 'Where do you live?',
    countryCopy: 'Choose your country. We use your real jurisdiction for k-ID requirements and feature permissions — never inferred from language.',
    searchCountryPlaceholder: 'Search countries (e.g. United States, Australia, Spain, China, Brazil)…',
    regionLabel: 'State, province, or region (required for this country)',
    unsupportedCountryTitle: 'Voicewell isn’t supported in this country yet',
    unsupportedCountryBody: 'We do not silently default to another country’s laws. Please choose a supported jurisdiction if applicable.',
    languageTitle: 'Choose your preferred language',
    languageCopy: 'Pick any supported language regardless of your country. Applied across navigation, lessons, AI conversations, coaching, and journals.',
    searchLanguagePlaceholder: 'Search languages (English, Español, 简体中文)…',
    langUnavailableBadge: 'Unavailable',
    langEnabledBadge: 'Supported end-to-end',
    gateTitle: 'Required permission check',
    gateCopy: 'k-ID checks your age and jurisdiction rules to set your AI chat and voice permissions.',
    // Home - Kids (6-12)
    kidsHeading: 'How are you feeling today?',
    kidsGuideIntro: 'Hi! I’m Wello, your friendly guide. Pick one picture below to start — there are no wrong answers!',
    kidsQuestionPrompt: 'When you feel this way, where do you notice it most?',
    kidsFeelings: [
      { id: 'worried', label: 'Worried or butterfly tummy', emoji: '🦋', followUp: 'Butterflies in your tummy happen when something feels big or new.' },
      { id: 'overwhelmed', label: 'Too much all at once', emoji: '🌧️', followUp: 'When lots of noisy or busy things happen together, your brain can feel full.' },
      { id: 'frustrated', label: 'Mad or frustrated', emoji: '🌋', followUp: 'Feeling hot or frustrated is a sign that something feels unfair or super hard.' },
      { id: 'tired', label: 'Tired and low energy', emoji: '🐢', followUp: 'Sometimes your body and mind just need a slow, quiet shell for a little while.' },
      { id: 'calm', label: 'Okay or calm', emoji: '🌤️', followUp: 'Feeling steady is a great time to practise finding your words!' },
      { id: 'unsure', label: 'I’m not sure', emoji: '❓', followUp: 'Not knowing how you feel is totally normal! Let’s explore together.' },
    ],
    kidsActivitiesTitle: 'Fun ways to find your words',
    kidsDetectiveTitle: 'Feeling Detective',
    kidsDetectiveDesc: 'Explore how a character might feel — more than one answer can fit!',
    kidsBuildWordsTitle: 'Build My Words',
    kidsBuildWordsDesc: 'Complete “I feel… because… I need…” step by step.',
    kidsAskHelpTitle: 'Ask for Help',
    kidsAskHelpDesc: 'Rehearse talking to a trusted grown-up.',
    skipBtn: 'Skip',
    explainAnotherWayBtn: 'Explain another way',
    helpLabelKids: 'Help me understand',
    wantHelpGrownUp: 'Want help telling a grown-up?',
    // Home - Teens (13-17)
    teensHeading: 'What’s on your mind?',
    teensSub: 'Start talking or type freely — or pick a starter card below. Cards collapse once you begin.',
    startTalkingBtn: 'Start talking',
    teenStarters: [
      { id: 'overwhelmed', title: '“I feel overwhelmed”', prompt: 'I feel overwhelmed lately with everything piling up, and I’m not sure where to start.' },
      { id: 'explain', title: '“Help me explain this”', prompt: 'Something has been bothering me and I want help figuring out how to explain it without it turning into a lecture.' },
      { id: 'practise', title: '“Practise a conversation”', prompt: 'I want to practise a conversation with a parent or friend about how stressed I’ve been.' },
    ],
    giveMeStarter: 'Give me a starter',
    explainThis: 'Explain this',
    practiseSayingIt: 'Practise saying it',
    helpSomeoneUnderstandTeen: 'Help someone understand what I need',
    // Home - Adults (18+)
    adultsHeading: 'What would you like to work through?',
    adultsSub: 'Set your goal directly in the workspace below, or choose a shortcut.',
    adultShortcuts: [
      { id: 'feelings', title: 'Understand my feelings', topic: 'stress', intent: 'myself' as const, mode: 'talk' as const, goal: 'Sort through stress and how it is affecting my day-to-day energy.' },
      { id: 'conversation', title: 'Prepare for a conversation', topic: 'stress', intent: 'myself' as const, mode: 'practice' as const, goal: 'Rehearse talking openly about stress and asking for what I need.' },
      { id: 'appointment', title: 'Prepare for an appointment', topic: 'appointment', intent: 'myself' as const, mode: 'practice' as const, goal: 'Organize timing, daily impact, and key questions for my doctor.' },
      { id: 'support', title: 'Support someone else', topic: 'stress', intent: 'someone-else' as const, mode: 'practice' as const, goal: 'Practise listening without lecturing and offering steady support.' },
    ],
    showGuidance: 'Show conversation guidance & warm-up lessons',
    hideGuidance: 'Hide guidance',
    // Practice & Pause & Coach
    talkItThrough: 'Talk it through',
    practiseConversation: 'Practise the conversation',
    explainWithAudio: 'Explain with audio',
    readItInstead: 'Read it instead',
    keepGoing: 'Keep going',
    resumeBtn: 'Resume',
    tryMomentAgainBtn: 'Try that moment again',
    moreHelpBtn: 'More help',
    // Post-practice & Journal & Specialists
    createJournalCard: 'Create a journal card',
    findSpecialist: 'Find a specialist',
  },
  es: {
    navHome: 'Inicio',
    navJournal: 'Mi Diario',
    navSpecialists: 'Especialistas',
    navPermissions: 'Permisos y Ajustes',
    navLogout: 'Cerrar sesión',
    welcomeKicker: 'Todos empezamos juntos · Adaptado por edad y país',
    welcomeTitle: 'Encuentra tus palabras.',
    welcomeSubtitle: 'Practica decir cómo te sientes y lo que necesitas, a tu ritmo.',
    getStarted: 'Comenzar',
    trustPrivate: 'Privado',
    trustNoDiagnosis: 'Sin diagnósticos',
    trustAdaptive: 'A tu ritmo',
    stepOf: (cur: number, total: number) => `Paso ${cur} de ${total}`,
    back: 'Atrás',
    continueBtn: 'Continuar',
    ageTitle: '¿Cuántos años tienes?',
    ageCopy: 'Selecciona tu edad real. Voicewell usa k-ID para verificar los permisos de tu país y adaptar tu espacio.',
    underSixTitle: 'Voicewell es para mayores de 6 años',
    underSixBody: 'Lo sentimos: Voicewell no está disponible para menores de 6 años. Pide ayuda a un adulto de confianza.',
    countryTitle: '¿Dónde vives?',
    countryCopy: 'Elige tu país. Usamos tu jurisdicción real para los requisitos de k-ID, sin adivinarlo por tu idioma.',
    searchCountryPlaceholder: 'Buscar país (ej. España, Estados Unidos, Australia, México, Brasil)…',
    regionLabel: 'Estado, provincia o región (requerido para este país)',
    unsupportedCountryTitle: 'Voicewell aún no está disponible en este país',
    unsupportedCountryBody: 'No aplicamos leyes de otro país por defecto. Elige una jurisdicción compatible si corresponde.',
    languageTitle: 'Elige tu idioma preferido',
    languageCopy: 'Selecciona cualquier idioma habilitado sin importar tu país. Se aplica a menús, lecciones, IA, coaching y diario.',
    searchLanguagePlaceholder: 'Buscar idioma (English, Español, 简体中文)…',
    langUnavailableBadge: 'No disponible',
    langEnabledBadge: 'Habilitado de principio a fin',
    gateTitle: 'Verificación de permisos requerida',
    gateCopy: 'k-ID verifica las reglas de tu edad y país para configurar el chat y la voz con IA.',
    kidsHeading: '¿Cómo te sientes hoy?',
    kidsGuideIntro: '¡Hola! Soy Wello, tu guía. Elige un dibujo para empezar: ¡no hay respuestas incorrectas!',
    kidsQuestionPrompt: 'Cuando te sientes así, ¿dónde lo notas más?',
    kidsFeelings: [
      { id: 'worried', label: 'Preocupado o con nervios', emoji: '🦋', followUp: 'Sentir mariposas en la barriga es normal cuando algo parece grande o nuevo.' },
      { id: 'overwhelmed', label: 'Demasiadas cosas a la vez', emoji: '🌧️', followUp: 'Cuando pasan muchas cosas ruidosas o rápidas, tu mente puede sentirse llena.' },
      { id: 'frustrated', label: 'Enojado o frustrado', emoji: '🌋', followUp: 'Sentirse frustrado muestra que algo te parece difícil o necesitas ayuda.' },
      { id: 'tired', label: 'Cansado y con poca energía', emoji: '🐢', followUp: 'A veces tu cuerpo y tu mente solo necesitan ir despacio y descansar.' },
      { id: 'calm', label: 'Tranquilo o bien', emoji: '🌤️', followUp: '¡Sentirse tranquilo es un gran momento para practicar tus palabras!' },
      { id: 'unsure', label: 'No estoy seguro', emoji: '❓', followUp: '¡No saber cómo te sientes es totalmente normal! Descubrámoslo juntos.' },
    ],
    kidsActivitiesTitle: 'Juegos cortos para encontrar tus palabras',
    kidsDetectiveTitle: 'Detective de Emociones',
    kidsDetectiveDesc: 'Explora cómo podría sentirse un personaje: ¡más de una respuesta vale!',
    kidsBuildWordsTitle: 'Construye Mis Palabras',
    kidsBuildWordsDesc: 'Completa “Me siento… porque… necesito…” paso a paso.',
    kidsAskHelpTitle: 'Pedir Ayuda',
    kidsAskHelpDesc: 'Practica cómo hablar con un adulto de confianza.',
    skipBtn: 'Saltar',
    explainAnotherWayBtn: 'Explicar de otra manera',
    helpLabelKids: 'Ayúdame a entender',
    wantHelpGrownUp: '¿Quieres ayuda para contárselo a un adulto?',
    teensHeading: '¿Qué tienes en mente?',
    teensSub: 'Empieza a hablar o escribe libremente, o elige una tarjeta de inicio.',
    startTalkingBtn: 'Empezar a hablar',
    teenStarters: [
      { id: 'overwhelmed', title: '“Me siento abrumado/a”', prompt: 'Últimamente me siento abrumado con todo lo que tengo encima y no sé por dónde empezar.' },
      { id: 'explain', title: '“Ayúdame a explicar esto”', prompt: 'Algo me preocupa y quiero ayuda para explicarlo sin que se convierta en un sermón.' },
      { id: 'practise', title: '“Practicar una conversación”', prompt: 'Quiero practicar una conversación con mis padres o un amigo sobre cómo me he sentido.' },
    ],
    giveMeStarter: 'Dame una frase para empezar',
    explainThis: 'Explícame esto',
    practiseSayingIt: 'Practicar cómo decirlo',
    helpSomeoneUnderstandTeen: 'Ayudar a alguien a entender lo que necesito',
    adultsHeading: '¿Qué te gustaría trabajar hoy?',
    adultsSub: 'Escribe tu objetivo directamente abajo o elige un acceso directo.',
    adultShortcuts: [
      { id: 'feelings', title: 'Entender cómo me siento', topic: 'stress', intent: 'myself' as const, mode: 'talk' as const, goal: 'Ordenar lo que siento y cómo el estrés afecta mi día a día.' },
      { id: 'conversation', title: 'Preparar una conversación', topic: 'stress', intent: 'myself' as const, mode: 'practice' as const, goal: 'Practicar cómo hablar del estrés y pedir apoyo claro.' },
      { id: 'appointment', title: 'Preparar una cita médica', topic: 'appointment', intent: 'myself' as const, mode: 'practice' as const, goal: 'Organizar cuándo empezó, el impacto diario y mis preguntas para el médico.' },
      { id: 'support', title: 'Apoyar a otra persona', topic: 'stress', intent: 'someone-else' as const, mode: 'practice' as const, goal: 'Practicar cómo escuchar sin juzgar y ofrecer apoyo.' },
    ],
    showGuidance: 'Mostrar guía y lecciones breves',
    hideGuidance: 'Ocultar guía',
    talkItThrough: 'Hablarlo paso a paso',
    practiseConversation: 'Practicar la conversación',
    explainWithAudio: 'Explicar con audio',
    readItInstead: 'Leerlo en texto',
    keepGoing: 'Seguir adelante',
    resumeBtn: 'Reanudar',
    tryMomentAgainBtn: 'Intentar ese momento otra vez',
    moreHelpBtn: 'Más ayuda',
    createJournalCard: 'Crear tarjeta de diario',
    findSpecialist: 'Buscar un especialista',
  },
  'zh-CN': {
    navHome: '首页',
    navJournal: '我的日记',
    navSpecialists: '专业顾问',
    navPermissions: '权限与设置',
    navLogout: '退出登录',
    welcomeKicker: '从同一个起点出发 · 按年龄与国家智能适配',
    welcomeTitle: '找到你想说的话。',
    welcomeSubtitle: '按自己的节奏，练习说出你的感受和需要。',
    getStarted: '开始使用',
    trustPrivate: '私密',
    trustNoDiagnosis: '不做诊断',
    trustAdaptive: '按你的节奏',
    stepOf: (cur: number, total: number) => `第 ${cur} 步（共 ${total} 步）`,
    back: '返回',
    continueBtn: '继续',
    ageTitle: '你今年多大？',
    ageCopy: '请选择你的真实年龄。Voicewell 会通过 k-ID 检查你所在国家/地区的真实权限，并为你定制专属界面。',
    underSixTitle: 'Voicewell 适用于 6 岁及以上用户',
    underSixBody: '很抱歉，Voicewell 暂不面向 6 岁以下儿童开放。请找父母或信任的大人寻求帮助。',
    countryTitle: '你居住在哪个国家或地区？',
    countryCopy: '请选择你所在的国家/地区。我们将根据真实司法管辖区执行 k-ID 权限要求，绝不仅凭语言推断国家。',
    searchCountryPlaceholder: '搜索国家/地区（如：中国、美国、澳大利亚、西班牙、英国、巴西）…',
    regionLabel: '州、省或地区（该国家要求选择）',
    unsupportedCountryTitle: 'Voicewell 暂不支持该国家/地区',
    unsupportedCountryBody: '我们不会静默套用其他国家的法规。如果适用，请选择受支持的司法管辖区。',
    languageTitle: '选择你的首选语言',
    languageCopy: '无论身在哪个国家，你都可以自由选择任何已启用的语言。将应用于导航、练习、AI 对话、暂停指导及日记卡片。',
    searchLanguagePlaceholder: '搜索语言（English, Español, 简体中文）…',
    langUnavailableBadge: '暂未开放',
    langEnabledBadge: '全流程支持',
    gateTitle: '必要的权限检查',
    gateCopy: 'k-ID 正在根据你的年龄与所在地区法规配置 AI 聊天与语音权限。',
    kidsHeading: '你今天感觉怎么样？',
    kidsGuideIntro: '嗨！我是你的好朋友 Wello。先点选下面的一张图片吧——每一种感受都没有对错！',
    kidsQuestionPrompt: '当你有这种感觉时，身体哪里最明显？',
    kidsFeelings: [
      { id: 'worried', label: '有点担心、心里七上八下', emoji: '🦋', followUp: '遇到新事情或大事情时，肚子里像有小蝴蝶飞一样是很正常的。' },
      { id: 'overwhelmed', label: '事情太多、忙不过来', emoji: '🌧️', followUp: '当周围又吵事情又多的时候，脑袋就会觉得装不下啦。' },
      { id: 'frustrated', label: '生气或懊恼', emoji: '🌋', followUp: '觉得生气或受挫，说明有些事让你觉得太难了或者需要帮助。' },
      { id: 'tired', label: '累了、没力气', emoji: '🐢', followUp: '有时候你的身体和脑袋只需要像小乌龟一样安静休息一会儿。' },
      { id: 'calm', label: '平静、还不错', emoji: '🌤️', followUp: '心情平静的时候，最适合练习怎么表达自己的想法啦！' },
      { id: 'unsure', label: '我也不太确定', emoji: '❓', followUp: '说不清自己什么感觉完全没关系！我们一起来慢慢发现。' },
    ],
    kidsActivitiesTitle: '帮你找到表达方式的小活动',
    kidsDetectiveTitle: '情绪小侦探',
    kidsDetectiveDesc: '猜猜故事里的小伙伴可能有哪些感受——可以选好几个哦！',
    kidsBuildWordsTitle: '拼出我的话',
    kidsBuildWordsDesc: '一步步完成“我感到……因为……我需要……”',
    kidsAskHelpTitle: '向大人求助',
    kidsAskHelpDesc: '练习怎么跟信任的大人开口说心里话。',
    skipBtn: '跳过',
    explainAnotherWayBtn: '换一种方式讲给我听',
    helpLabelKids: '帮我弄明白',
    wantHelpGrownUp: '想让卡片帮你告诉大人吗？',
    teensHeading: '你心里正在想什么？',
    teensSub: '可以直接开口说或打字，也可以点击下面的起始卡片（对话开始后卡片会自动收起）。',
    startTalkingBtn: '开始语音对话',
    teenStarters: [
      { id: 'overwhelmed', title: '“我最近觉得压力很大”', prompt: '最近所有事情都堆在一起，我感觉压力特别大，不知道该从哪里说起。' },
      { id: 'explain', title: '“帮我想想怎么解释这件事”', prompt: '有件事一直困扰着我，我想弄清楚怎么跟家里人或朋友说，才不会变成被说教。' },
      { id: 'practise', title: '“练习一次对话”', prompt: '我想练习一下怎么跟父母或朋友坦诚聊聊我最近的压力。' },
    ],
    giveMeStarter: '给我一句开场白',
    explainThis: '解释一下这个',
    practiseSayingIt: '练习怎么说出口',
    helpSomeoneUnderstandTeen: '帮助别人理解我需要什么支持',
    adultsHeading: '今天你想理清或准备什么？',
    adultsSub: '直接在下方输入你的目标，或选择一个快捷入口开始。',
    adultShortcuts: [
      { id: 'feelings', title: '理清我的感受', topic: 'stress', intent: 'myself' as const, mode: 'talk' as const, goal: '梳理最近的压力来源以及它对我日常精力的影响。' },
      { id: 'conversation', title: '准备一次重要沟通', topic: 'stress', intent: 'myself' as const, mode: 'practice' as const, goal: '练习坦诚表达自己的感受并提出具体的支持需求。' },
      { id: 'appointment', title: '准备看诊/医疗预约', topic: 'appointment', intent: 'myself' as const, mode: 'practice' as const, goal: '整理症状出现的时间、日常影响以及想问医生的核心问题。' },
      { id: 'support', title: '支持身边的人', topic: 'stress', intent: 'someone-else' as const, mode: 'practice' as const, goal: '练习不带评判地倾听孩子、伴侣或朋友，并提供恰当支持。' },
    ],
    showGuidance: '展开沟通指南与热身卡片',
    hideGuidance: '收起沟通指南',
    talkItThrough: '先跟我理一理 (指导)',
    practiseConversation: '练习模拟对话 (角色扮演)',
    explainWithAudio: '用语音讲解',
    readItInstead: '阅读文字讲解',
    keepGoing: '继续对话',
    resumeBtn: '继续练习',
    tryMomentAgainBtn: '重新试一次刚才那句话',
    moreHelpBtn: '更多帮助',
    createJournalCard: '创建日记卡片',
    findSpecialist: '寻找专业顾问',
  },
} as const

export function getStrings(lang?: string | null) {
  if (lang === 'es') return UI_STRINGS.es
  if (lang === 'zh-CN') return UI_STRINGS['zh-CN']
  return UI_STRINGS.en
}

export function findCountry(code?: string | null): CountryOption {
  const clean = (code || 'US').toUpperCase().slice(0, 2)
  return COUNTRIES.find((c) => c.code === clean) ?? COUNTRIES[0]
}

export function formatLocalDate(iso: string, lang?: string | null): string {
  try {
    const d = new Date(iso)
    const locale = lang === 'es' ? 'es' : lang === 'zh-CN' ? 'zh-CN' : 'en'
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d)
  } catch {
    return iso.slice(0, 10)
  }
}

export function formatLocalDateTime(iso: string, lang?: string | null): string {
  try {
    const d = new Date(iso)
    const locale = lang === 'es' ? 'es' : lang === 'zh-CN' ? 'zh-CN' : 'en'
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch {
    return iso
  }
}

export function formatLocalNumber(n: number, lang?: string | null): string {
  const locale = lang === 'es' ? 'es' : lang === 'zh-CN' ? 'zh-CN' : 'en'
  return new Intl.NumberFormat(locale).format(n)
}


export const SUPPORTED_LANGUAGES = LANGUAGES

export const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  AU: '🇦🇺',
  ES: '🇪🇸',
  GB: '🇬🇧',
  CN: '🇨🇳',
  BR: '🇧🇷',
  DE: '🇩🇪',
  CA: '🇨🇦',
  MX: '🇲🇽',
  FR: '🇫🇷',
  JP: '🇯🇵',
  CU: '🇨🇺',
  KP: '🇰🇵',
  IR: '🇮🇷',
  SY: '🇸🇾',
}

export interface SupportedCountryItem extends CountryOption {
  flag: string
  kidHighlight: string
}

export const SUPPORTED_COUNTRIES: SupportedCountryItem[] = COUNTRIES.map((c) => ({
  ...c,
  flag: COUNTRY_FLAGS[c.code] ?? '🌍',
  kidHighlight: c.kidSummary.en,
}))

export function formatCurrency(amount: number, lang?: string | null): string {
  try {
    const locale = lang === 'es' ? 'es-ES' : lang === 'zh-CN' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `$${amount}`
  }
}

const DOT_KEY_MAP: Record<string, Record<SupportedLanguage, string>> = {
  'kids.heading': {
    en: 'How are you feeling today?',
    es: '¿Cómo te sientes hoy?',
    'zh-CN': '你今天感觉怎么样？',
  },
  'kids.guideIntro': {
    en: "Hi! I'm Wello. Tap a feeling picture below — there are no wrong answers!",
    es: '¡Hola! Soy Wello. Toca un dibujo abajo: ¡no hay respuestas incorrectas!',
    'zh-CN': '嗨！我是 Wello。点选下面的心情图片吧——没有对错之分！',
  },
  'kids.notSure': {
    en: "I'm not sure",
    es: 'No estoy seguro/a',
    'zh-CN': '我说不清',
  },
  'kids.feelingDetective': {
    en: 'Feeling Detective',
    es: 'Detective de Emociones',
    'zh-CN': '情绪小侦探',
  },
  'kids.feelingDetectiveDesc': {
    en: 'Spot the feeling from the clues',
    es: 'Descubre la emoción con las pistas',
    'zh-CN': '从线索里找出感受',
  },

  'kids.buildMyWords': {
    en: 'Build My Words',
    es: 'Construye Mis Palabras',
    'zh-CN': '拼出我的话',
  },
  'kids.buildMyWordsDesc': {
    en: 'Make a sentence about how you feel',
    es: 'Haz una frase sobre cómo te sientes',
    'zh-CN': '拼一句说出你的感受',
  },

  'kids.askForHelp': {
    en: 'Practise Asking for Help',
    es: 'Practica pedir ayuda',
    'zh-CN': '练习开口求助',
  },

  'kids.askForHelpDesc': {
    en: 'Try asking a grown-up',
    es: 'Prueba a pedírselo a un adulto',
    'zh-CN': '试着向大人开口',
  },

  'kids.skip': {
    en: 'Skip',
    es: 'Saltar',
    'zh-CN': '跳过',
  },
  'kids.explainAnotherWay': {
    en: 'Explain another way',
    es: 'Explicar de otra manera',
    'zh-CN': '换一种方式讲给我听',
  },
  'help.kids': {
    en: 'Help me understand',
    es: 'Ayúdame a entender',
    'zh-CN': '帮我弄明白',
  },
  'help.teens': {
    en: 'Explain this',
    es: 'Explícame esto',
    'zh-CN': '解释一下这个',
  },
  'help.adults': {
    en: 'Pause & Coach',
    es: 'Pausa y Coach',
    'zh-CN': '暂停与指导',
  },
  'teens.heading': {
    en: "What's on your mind?",
    es: '¿Qué tienes en mente?',
    'zh-CN': '你心里正在想什么？',
  },
  'teens.startTalking': {
    en: 'Start talking',
    es: 'Empezar a hablar',
    'zh-CN': '开始对话',
  },
  'teens.placeholder': {
    en: 'Write what is on your mind, or pick a starter below…',
    es: 'Escribe lo que tienes en mente o elige una tarjeta abajo…',
    'zh-CN': '写下你心里的想法，或者从下方选择一张起始卡片……',
  },
  'teens.card1': {
    en: 'I feel overwhelmed',
    es: 'Me siento abrumado/a',
    'zh-CN': '我觉得压力很大',
  },
  'teens.card2': {
    en: 'Help me explain this',
    es: 'Ayúdame a explicar esto',
    'zh-CN': '帮我想想怎么解释这件事',
  },
  'teens.card3': {
    en: 'Practise a conversation',
    es: 'Practicar una conversación',
    'zh-CN': '练习一次对话',
  },
  'teens.giveStarter': {
    en: 'Give me a starter',
    es: 'Dame una frase para empezar',
    'zh-CN': '给我一句开场白',
  },
  'teens.explainThis': {
    en: 'Explain this',
    es: 'Explícame esto',
    'zh-CN': '解释一下这个',
  },
  'teens.practiceSaying': {
    en: 'Practise saying it',
    es: 'Practicar cómo decirlo',
    'zh-CN': '练习怎么说出口',
  },
  'adults.heading': {
    en: 'What would you like to work through?',
    es: '¿Qué te gustaría trabajar hoy?',
    'zh-CN': '今天你想理清或准备什么？',
  },
  'adults.placeholder': {
    en: 'Describe the conversation, appointment, or situation you want to work through…',
    es: 'Describe la conversación, cita o situación que quieres trabajar…',
    'zh-CN': '描述你想准备的对话、看诊预约或具体情境……',
  },
  'adults.shortcut1': {
    en: 'Understand my feelings',
    es: 'Entender cómo me siento',
    'zh-CN': '理清我的感受',
  },
  'adults.shortcut2': {
    en: 'Prepare for a conversation',
    es: 'Preparar una conversación',
    'zh-CN': '准备一次重要沟通',
  },
  'adults.shortcut3': {
    en: 'Prepare for an appointment',
    es: 'Preparar una cita médica',
    'zh-CN': '准备看诊/医疗预约',
  },
  'adults.shortcut4': {
    en: 'Support someone else',
    es: 'Apoyar a otra persona',
    'zh-CN': '支持身边的人',
  },
  'adults.myChild': {
    en: 'My child',
    es: 'Mi hijo/a',
    'zh-CN': '我的孩子',
  },
  'adults.partner': {
    en: 'Partner',
    es: 'Pareja',
    'zh-CN': '伴侣',
  },
  'adults.friend': {
    en: 'Friend',
    es: 'Amigo/a',
    'zh-CN': '朋友',
  },
  'adults.someoneElse': {
    en: 'Someone else',
    es: 'Otra persona',
    'zh-CN': '其他人',
  },
  'practice.talkMode': {
    en: 'Talk it through',
    es: 'Hablarlo paso a paso',
    'zh-CN': '先跟我理一理',
  },
  'practice.practiceMode': {
    en: 'Practise the conversation',
    es: 'Practicar la conversación',
    'zh-CN': '练习模拟对话',
  },
  'practice.pausePrompt': {
    en: 'Would you like to pause and have me talk you through it?',
    es: '¿Te gustaría hacer una pausa para que te lo explique paso a paso?',
    'zh-CN': '你想先暂停一下，让我一步步帮你理一理吗？',
  },
  'practice.explainAudio': {
    en: 'Explain with audio',
    es: 'Explicar con audio',
    'zh-CN': '用语音讲解',
  },
  'practice.readInstead': {
    en: 'Read it instead',
    es: 'Leerlo en texto',
    'zh-CN': '阅读文字讲解',
  },
  'practice.keepGoing': {
    en: 'Keep going',
    es: 'Seguir adelante',
    'zh-CN': '继续对话',
  },
  'practice.resume': {
    en: 'Resume',
    es: 'Reanudar',
    'zh-CN': '继续练习',
  },
  'practice.tryAgain': {
    en: 'Try that moment again',
    es: 'Intentar ese momento otra vez',
    'zh-CN': '重新试一次刚才那句话',
  },
  'practice.moreHelp': {
    en: 'More help',
    es: 'Más ayuda',
    'zh-CN': '更多帮助',
  },
  'kidPractice.readAloud': {
    en: 'Read this out loud',
    es: 'Leer esto en voz alta',
    'zh-CN': '把这句话读出来',
  },
  'kidPractice.stopReading': {
    en: 'Stop reading',
    es: 'Dejar de leer',
    'zh-CN': '停止朗读',
  },
  'kidPractice.back': {
    en: 'Back to my board',
    es: 'Volver a mi tablero',
    'zh-CN': '回到我的主页',
  },
  'kidPractice.sub': {
    en: 'Practising with {name} · simulated. A practice partner, not a prediction of how a real person will respond.',
    es: 'Practicando con {name} · simulado. Un compañero de práctica, no una predicción de cómo responderá una persona real.',
    'zh-CN': '正在和 {name} 练习 · 模拟对话。这是练习伙伴，并不代表真人会怎样回应。',
  },
  'kidPractice.badge': {
    en: 'Simulated practice',
    es: 'Práctica simulada',
    'zh-CN': '模拟练习',
  },
  'kidPractice.wFirst': {
    en: 'You go first! Tap the mic to talk, or type it below.',
    es: '¡Empiezas tú! Toca el micrófono para hablar o escríbelo abajo.',
    'zh-CN': '你先说！点麦克风说话，或者在下面打字。',
  },
  'kidPractice.youCouldSay': {
    en: 'You could say',
    es: 'Podrías decir',
    'zh-CN': '你可以说',
  },
  'kidPractice.sayYourWay': {
    en: 'Or say it your way',
    es: 'O dilo a tu manera',
    'zh-CN': '或者用你自己的话说',
  },
  'kidPractice.placeholder': {
    en: 'Type here…',
    es: 'Escribe aquí…',
    'zh-CN': '在这里输入…',
  },
  'kidPractice.send': {
    en: 'Send',
    es: 'Enviar',
    'zh-CN': '发送',
  },
  'kidPractice.talk': {
    en: 'Talk out loud',
    es: 'Hablar en voz alta',
    'zh-CN': '大声说出来',
  },
  'kidPractice.voiceOff': {
    en: 'Voice is off.',
    es: 'La voz está desactivada.',
    'zh-CN': '语音现在是关闭的。',
  },
  'kidPractice.end': {
    en: 'End & reflect',
    es: 'Terminar y reflexionar',
    'zh-CN': '结束并回顾',
  },
  'kidPractice.tapToStop': {
    en: 'Tap to stop',
    es: 'Toca para parar',
    'zh-CN': '点一下停止',
  },
  'kidPractice.connecting': {
    en: 'Getting ready… if your browser asks, tap Allow for the microphone.',
    es: 'Preparando todo… si el navegador pregunta, toca Permitir para el micrófono.',
    'zh-CN': '正在准备…如果浏览器询问，请点“允许”使用麦克风。',
  },
  'kidPractice.listening': {
    en: 'I’m listening. Go ahead and talk!',
    es: 'Te escucho. ¡Habla cuando quieras!',
    'zh-CN': '我在听，你说吧！',
  },
  'kidPractice.hearing': {
    en: 'I can hear you…',
    es: 'Te estoy oyendo…',
    'zh-CN': '我听到你了…',
  },
  'kidPractice.talking': {
    en: '{name} is talking…',
    es: '{name} está hablando…',
    'zh-CN': '{name} 正在说话…',
  },
  'kidPractice.captionsOff': {
    en: 'Captions are turned off. Listen to {name}.',
    es: 'Los subtítulos están desactivados. Escucha a {name}.',
    'zh-CN': '字幕已关闭。请听 {name} 说话。',
  },
  'kidPractice.doneTitle': {
    en: 'Great practising!',
    es: '¡Buen trabajo practicando!',
    'zh-CN': '练得真棒！',
  },
  'kidPractice.doneBody': {
    en: 'You tried something brave. Let’s look at what went well.',
    es: 'Intentaste algo valiente. Veamos qué salió bien.',
    'zh-CN': '你勇敢地试了一次。我们来看看哪里做得好。',
  },
  'kidPractice.getReflection': {
    en: 'See my reflection',
    es: 'Ver mi reflexión',
    'zh-CN': '看看我的回顾',
  },
  'kidPractice.paused': {
    en: 'Paused for coaching',
    es: 'En pausa para ayudarte',
    'zh-CN': '暂停，帮你一下',
  },
  'kidPractice.coachNote': {
    en: 'Coaching doesn’t count toward your feedback.',
    es: 'La ayuda no cuenta para tu retroalimentación.',
    'zh-CN': '这段帮助不会计入你的反馈。',
  },
  'kidPractice.tryPhrase': {
    en: 'Phrase you can try',
    es: 'Frase que puedes probar',
    'zh-CN': '你可以试试这句话',
  },
  'kidPractice.usePhrase': {
    en: 'Use this phrase',
    es: 'Usar esta frase',
    'zh-CN': '用这句话',
  },
  'kids.hiWello': {
    en: "Hi! I'm Wello.",
    es: '¡Hola! Soy Wello.',
    'zh-CN': '嗨！我是 Wello。',
  },
  'kids.talkToWello': {
    en: 'Talk to Wello',
    es: 'Hablar con Wello',
    'zh-CN': '和 Wello 说话',
  },
  'kids.thingsToDo': {
    en: 'Things to do',
    es: 'Cosas para hacer',
    'zh-CN': '今天可以做的事',
  },
  'kids.myCards': {
    en: 'My cards',
    es: 'Mis tarjetas',
    'zh-CN': '我的卡片',
  },
  'kids.voiceOffHome': {
    en: 'Talking out loud is off for now.',
    es: 'Hablar en voz alta está desactivado por ahora.',
    'zh-CN': '现在还不能用语音说话。',
  },
  'kids.feel.happy': {
    en: 'Happy',
    es: 'Feliz',
    'zh-CN': '开心',
  },
  'kids.feel.calm': {
    en: 'Calm',
    es: 'Tranquilo/a',
    'zh-CN': '平静',
  },
  'kids.feel.worried': {
    en: 'Worried',
    es: 'Preocupado/a',
    'zh-CN': '担心',
  },
  'kids.feel.sad': {
    en: 'Sad',
    es: 'Triste',
    'zh-CN': '难过',
  },
  'kids.feel.cross': {
    en: 'Cross',
    es: 'Enfadado/a',
    'zh-CN': '生气',
  },
  'kids.feel.tired': {
    en: 'Tired',
    es: 'Cansado/a',
    'zh-CN': '累了',
  },
  'vc.speaking': {
    en: 'SPEAKING',
    es: 'HABLANDO',
    'zh-CN': '正在说',
  },
  'vc.listening': {
    en: 'LISTENING',
    es: 'ESCUCHANDO',
    'zh-CN': '正在听',
  },
  'vc.connecting': {
    en: 'GETTING READY',
    es: 'PREPARANDO',
    'zh-CN': '准备中',
  },
  'vc.you': {
    en: 'YOU',
    es: 'TÚ',
    'zh-CN': '你',
  },
  'vc.captions': {
    en: 'Captions',
    es: 'Subtítulos',
    'zh-CN': '字幕',
  },
  'vc.captionsOff': {
    en: 'Captions are off. Turn them on to read what is said.',
    es: 'Los subtítulos están desactivados. Actívalos para leer lo que se dice.',
    'zh-CN': '字幕已关闭。打开字幕可以看到说的内容。',
  },
  'vc.typeInstead': {
    en: 'Type instead',
    es: 'Escribir',
    'zh-CN': '改为打字',
  },
  'vc.replay': {
    en: 'Replay',
    es: 'Repetir',
    'zh-CN': '重播',
  },
  'vc.startMic': {
    en: 'Start talking',
    es: 'Empezar a hablar',
    'zh-CN': '开始说话',
  },
  'vc.stopMic': {
    en: 'Stop talking',
    es: 'Dejar de hablar',
    'zh-CN': '停止说话',
  },
  'vc.orTapOne': {
    en: 'Or tap one:',
    es: 'O toca una:',
    'zh-CN': '或者点一句：',
  },
  'vc.showConversation': {
    en: 'Show conversation',
    es: 'Mostrar conversación',
    'zh-CN': '显示对话',
  },
  'vc.hideConversation': {
    en: 'Hide conversation',
    es: 'Ocultar conversación',
    'zh-CN': '隐藏对话',
  },
  'vc.end': {
    en: 'End & reflect',
    es: 'Terminar y reflexionar',
    'zh-CN': '结束并回顾',
  },
  'vc.voiceCoach': {
    en: 'Voice coach',
    es: 'Entrenador de voz',
    'zh-CN': '语音教练',
  },
  'vc.tips': {
    en: 'Tips',
    es: 'Consejos',
    'zh-CN': '小提示',
  },
  'vc.tip1': {
    en: 'Take a breath before you speak. There is no rush.',
    es: 'Respira antes de hablar. No hay prisa.',
    'zh-CN': '开口前先深呼吸，不用着急。',
  },
  'vc.tip2': {
    en: 'Start with how you feel, then say what you need.',
    es: 'Empieza por cómo te sientes y luego di lo que necesitas.',
    'zh-CN': '先说你的感受，再说你需要什么。',
  },
  'vc.tip3': {
    en: 'You can pause, type instead, or ask for help any time.',
    es: 'Puedes pausar, escribir o pedir ayuda cuando quieras.',
    'zh-CN': '你可以随时暂停、改为打字或请求帮助。',
  },
  'vc.readyHint': {
    en: 'Tap the mic and {name} will say hello first.',
    es: 'Toca el micrófono y {name} saludará primero.',
    'zh-CN': '点一下麦克风，{name} 会先打招呼。',
  },
  'vc.typeFirst': {
    en: 'You go first. Type what you would say.',
    es: 'Empiezas tú. Escribe lo que dirías.',
    'zh-CN': '你先说。把你想说的话打出来。',
  },
  'feedback.createJournal': {
    en: 'Create a journal card',
    es: 'Crear tarjeta de diario',
    'zh-CN': '创建日记卡片',
  },
  'feedback.helpUnderstand': {
    en: 'Help someone understand',
    es: 'Ayudar a alguien a entender',
    'zh-CN': '帮助他人理解我',
  },
  'feedback.kidsShare': {
    en: 'Want help telling a grown-up?',
    es: '¿Quieres ayuda para contárselo a un adulto?',
    'zh-CN': '想让卡片帮你告诉大人吗？',
  },
  'feedback.teensShare': {
    en: 'Help someone understand what I need',
    es: 'Ayudar a alguien a entender lo que necesito',
    'zh-CN': '帮助别人理解我需要什么支持',
  },
  'feedback.findSpecialist': {
    en: 'Find a specialist',
    es: 'Buscar un especialista',
    'zh-CN': '寻找专业顾问',
  },
  'journal.title': {
    en: 'My Private Journal & Support Cards',
    es: 'Mi Diario Privado y Tarjetas de Apoyo',
    'zh-CN': '我的私密日记与支持卡片',
  },
  'journal.subtitle': {
    en: 'Your journal cards are private by default. Nothing is saved or shared unless you preview and approve it.',
    es: 'Tus tarjetas son privadas por defecto. Nada se guarda ni comparte sin tu aprobación.',
    'zh-CN': '日记卡片默认完全私密。未经你的预览与确认，绝不会自动保存或分享任何内容。',
  },
  'journal.previewSave': {
    en: 'Preview before saving',
    es: 'Vista previa antes de guardar',
    'zh-CN': '保存前预览',
  },
  'journal.saveCard': {
    en: 'Save to My Journal',
    es: 'Guardar en Mi Diario',
    'zh-CN': '保存到我的日记',
  },
  'caregiver.portalTitle': {
    en: 'Caregiver & Supporter Portal',
    es: 'Portal para Padres y Cuidadores',
    'zh-CN': '家长与支持者门户',
  },
  'caregiver.portalSubtitle': {
    en: 'A young person shared this approved card with you so you can understand what they need and practise a supportive response.',
    es: 'Un joven compartió esta tarjeta aprobada contigo para ayudarte a comprender lo que necesita.',
    'zh-CN': '孩子向你分享了这张经本人确认的支持卡片，帮助你了解他的想法并练习温和的回应。',
  },
  'caregiver.listeningLesson': {
    en: 'Short Listening Lesson',
    es: 'Lección Breve de Escucha',
    'zh-CN': '简短倾听指南',
  },
  'caregiver.phrasesToTry': {
    en: 'Phrases to try',
    es: 'Frases para probar',
    'zh-CN': '建议尝试的表达',
  },
  'caregiver.phrasesToAvoid': {
    en: 'Phrases to avoid',
    es: 'Frases a evitar',
    'zh-CN': '建议避免的表达',
  },
  'caregiver.isolatedPractice': {
    en: 'Optional Isolated AI Practice',
    es: 'Práctica Opcional con IA (Aislada)',
    'zh-CN': '可选的独立 AI 回应练习',
  },
  'caregiver.chooseAction': {
    en: 'Commit to 1 Concrete Support Action',
    es: 'Comprométete con 1 Acción Concreta de Apoyo',
    'zh-CN': '选择 1 项具体的支持行动',
  },
  'specialists.title': {
    en: 'Verified Specialists & Support',
    es: 'Especialistas Verificados y Apoyo',
    'zh-CN': '认证专家与预约支持',
  },
  'specialists.subtitle': {
    en: 'Filter verified communication, youth, and family specialists. Appointment requests are never confirmed until reviewed by the provider.',
    es: 'Busca especialistas verificados. Las solicitudes nunca se confirman automáticamente sin revisión del profesional.',
    'zh-CN': '筛选认证的沟通、青少年与家庭支持专家。预约申请需经专家确认，绝不虚构自动确认状态。',
  },
  'specialists.requestBtn': {
    en: 'Request Appointment (Pending Provider Confirmation)',
    es: 'Solicitar Cita (Pendiente de Confirmación)',
    'zh-CN': '提交预约申请（待专家确认）',
  },
  'specialists.inviteChildBtn': {
    en: 'Invite My Child/Teen to Agree',
    es: 'Invitar a Mi Hijo/a a Aceptar',
    'zh-CN': '邀请孩子确认参与',
  },
  'specialists.askGuardianBtn': {
    en: 'Ask a Parent/Guardian for Approval & Payment',
    es: 'Pedir Aprobación y Pago a un Adulto',
    'zh-CN': '请家长批准并授权支付',
  },
  'specialists.childYes': {
    en: 'Yes',
    es: 'Sí',
    'zh-CN': '同意参加',
  },
  'specialists.childQuestions': {
    en: 'I have questions',
    es: 'Tengo preguntas',
    'zh-CN': '我有问题想问',
  },
  'specialists.childNo': {
    en: 'Not right now',
    es: 'Ahora no',
    'zh-CN': '暂时不想',
  },
}

export function t(lang: string | null | undefined, key: string): string {
  const clean: SupportedLanguage = lang === 'es' ? 'es' : lang === 'zh-CN' ? 'zh-CN' : 'en'
  const entry = DOT_KEY_MAP[key]
  if (!entry) return key
  return entry[clean] ?? entry.en
}

