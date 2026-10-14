import 'server-only'

import OpenAI from "openai";
import { models, AI_MODELS, type AI_MODEL } from './models'

export type { AI_MODEL } from './models'


const apiKey = process.env.OPEN_ROUTER_API_KEY

const openRouter = apiKey
    ? new OpenAI({
          apiKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
              // optional, shows up in OpenRouter's dashboard/rankings
              "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
              "X-Title": "AI Group Chat",
          },
      })
    : undefined

async function askModel(ai: AI_MODEL, prompt: string): Promise<string> {
    if (!openRouter) throw new Error("OpenRouter is not available, set OPEN_ROUTER_API_KEY.")

    const response = await openRouter.chat.completions.create({
        model: models[ai],
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
    })

    return response.choices[0]?.message?.content ?? ''
}

// One key covers every model
export const AVAILABLE_MODELS: AI_MODEL[] = openRouter ? [...AI_MODELS] : []

export async function AskAI(ai: AI_MODEL, history?: string, theme?: string): Promise<string[]> {
    if (!AVAILABLE_MODELS.includes(ai)) {
        throw new Error(`${ai} is not available; set OPEN_ROUTER_API_KEY on the server.`)
    }

    const others = AVAILABLE_MODELS.filter((m) => m !== ai)

    const prompt = `
You are ${ai} ai, chatting in a group chat with these AIs ${others.join(', ')}.
Talk the way people do in a casual group chat.

${theme ? `\nTheme of this chat: ${theme}\n` : ''}

Rules:
- Write only your own messages, never lines for the others.
- Send 1 to 3 short messages. Put each message on its own line.
- Keep each message to a sentence or two. Do not write paragraphs.
- No markdown, no quotes, and do not start with your name or a label.
- An emoji-only message is fine now and then.
- Respond to what others said, by name if it helps. Add something new instead of just agreeing or repeating.
- Do not say goodbye or try to wrap up the conversation.
- Talk like carefree young generation: relaxed, fun, expressive, emojis

${
  history?.length
    ? `Chat so far:
<chat>
${history}
</chat>

If you have nothing to add right now, reply with exactly: <SKIP>
Otherwise, send your next message(s).`
    : 'Nobody has said anything yet, so you are sending the first message.'
}
`.trim()

    const raw = await askModel(ai, prompt)

    if (raw.includes('<SKIP>')) return []

    return raw
        .split('\n')
        .map((line) => line.trim().replace(new RegExp(`^${ai}\\s*:\\s*`, 'i'), '')) // strip "Name:" prefix
        .filter(Boolean)
}