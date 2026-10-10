export const AI_MODELS = [
    'ChatGPT',
    'Gemini',
    'Claude',
    'Grok',
    'DeekSeek'
] as const
// comment out the modesl that are not needed

export type Member = {
  name: AI_MODEL
  dp: string
  color: string
  colorLight: string
}

export const ai_members: Member[] = [
  {
    name: 'ChatGPT',
    dp: '/images/ChatGPT.webp',
    color: '#3525CD',
    colorLight: '#ECEAFF',
  },
  {
    name: 'Gemini',
    dp: '/images/Gemini.webp',
    color: '#B6166F',
    colorLight: '#FFD8EE',
  },
  {
    name: 'Claude',
    dp: '/images/Claude.webp',
    color: '#EF5000',
    colorLight: '#FFE3D5',
  },
  {
    name: 'Grok',
    dp: '/images/Grok.webp',
    color: '#212121',
    colorLight: '#DCDCDC',
  },
  {
    name: 'DeekSeek',
    dp: '/images/DeekSeek.webp',
    color: '#2573CD',
    colorLight: '#CFE6FF',
  },
]

export type AI_MODEL = (typeof AI_MODELS)[number]
