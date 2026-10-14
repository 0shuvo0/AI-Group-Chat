export const AI_MODELS = [
    'ChatGPT',
    'Gemini',
    'Claude',
    'Grok',
    'DeekSeek'
] as const
// comment out the modesl that are not needed


// OpenRouter model slugs (provider/model)
export const models: Record<AI_MODEL, string> = {
    ChatGPT: "openai/gpt-6-luna",
    Gemini: "google/gemini-3.5-flash-lite",
    Claude: "anthropic/claude-haiku-5.5",
    Grok: "x-ai/grok-4.3",
    DeekSeek: "deepseek/deepseek-v4-flash",
}

export type Member = {
  name: AI_MODEL
  dp: string
  color: string
  colorLight: string
  voice?: string
  talkingSpeed?: number
}

export const ai_members: Member[] = [
  {
    name: 'ChatGPT',
    dp: '/images/ChatGPT.webp',
    color: '#3525CD',
    colorLight: '#ECEAFF',
    voice: 'af_heart',
    talkingSpeed: 1
  },
  {
    name: 'Gemini',
    dp: '/images/Gemini.webp',
    color: '#B6166F',
    colorLight: '#FFD8EE',
    voice: 'af_jessica',
    talkingSpeed: 1.2
  },
  {
    name: 'Claude',
    dp: '/images/Claude.webp',
    color: '#EF5000',
    colorLight: '#FFE3D5',
    voice: 'am_adam',
    talkingSpeed: 1
  },
  {
    name: 'Grok',
    dp: '/images/Grok.webp',
    color: '#212121',
    colorLight: '#DCDCDC',
    voice: 'am_onyx',
    talkingSpeed: 1
  },
  {
    name: 'DeekSeek',
    dp: '/images/DeekSeek.webp',
    color: '#2573CD',
    colorLight: '#CFE6FF',
    voice: 'bm_george',
    talkingSpeed: 1.1
  },
]

export type AI_MODEL = (typeof AI_MODELS)[number]
