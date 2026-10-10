import { useEffect, useMemo, useRef, useState } from 'react'

export type Member = {
  name: string
  dp: string // profile picture
  color: string
  colorLight: string
}

export type Message = {
  name: Member['name']
  time: string // ISO string of when the message was sent
  messages: string[] // one person can send multiple messages at once
}

export type RenderChatProps = {
  members: Member[]
  messages: Message[]
  currentlyTyping?: string | null
  /** path to an audio file, played whenever a new message bubble arrives */
  messageSound?: string
  /** delay (ms) between consecutive bubbles. default 100 */
  messageDelay?: number
  /** path to an audio file, played when currentlyTyping goes null -> name or name -> other name */
  typingSound?: string
  /** called with true when bubbles start revealing, false once all are shown. starts as false */
  onLoadingStateChange?: (loading: boolean) => void
}


const ANIMATION_DURATION = 300
/* ---------------------------------- helpers --------------------------------- */

const FALLBACK_MEMBER: Omit<Member, 'name'> = {
  dp: '',
  color: '#4B4B63',
  colorLight: '#ECECF4',
}

const EMOJI_PRESENT = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f|\s)+$/u

const isEmojiOnly = (text: string) => {
  const t = text.trim()
  return t.length > 0 && EMOJI_PRESENT.test(t) && EMOJI_ONLY.test(t)
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const audioCache = new Map<string, HTMLAudioElement>()

const warmSound = (src?: string) => {
  if (!src || audioCache.has(src)) return
  const a = new Audio(src)
  a.preload = 'auto'
  audioCache.set(src, a)
}

const playSound = (src?: string) => {
  if (!src) return
  warmSound(src)
  const audio = audioCache.get(src)!.cloneNode(true) as HTMLAudioElement
  audio.play().catch((err) =>
    console.warn(`[RenderChat] couldn't play "${src}":`, err)
  )
}

const groupKey = (m: Message, i: number) => `${i}:${m.time}`

/* ---------------------------------- avatar ---------------------------------- */

function Avatar({ name, dp, color, colorLight }: Member) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [dp])

  if (!dp || failed) {
    return (
      <div
        className="rc-avatar rc-avatar-fallback"
        style={{ background: colorLight, color }}
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      className="rc-avatar"
      src={dp}
      alt={name}
      onError={() => setFailed(true)}
      draggable={false}
    />
  )
}

/* ---------------------------------- component ------------------------------- */

export function RenderChat({
  members,
  messages,
  currentlyTyping = null,
  messageSound,
  messageDelay = 500,
  typingSound,
  onLoadingStateChange
}: RenderChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // How many strings of each Message group are currently visible.
  const [shown, setShown] = useState<Record<string, number>>({})
  const lastRevealAt = useRef(0)

  // keep latest sound path available inside timers without re-running effects
  const messageSoundRef = useRef(messageSound)
  messageSoundRef.current = messageSound

  const memberMap = useMemo(() => {
    const map = new Map<string, Member>()
    members.forEach((m) => map.set(m.name, m))
    return map
  }, [members])

  const getMember = (name: string): Member =>
    memberMap.get(name) ?? { name, ...FALLBACK_MEMBER }

  // so the files start loading before the first message
  useEffect(() => {
    warmSound(messageSound)
    warmSound(typingSound)
  }, [messageSound, typingSound])

  /* ---- loading state ------------------------------------------------------- */
const isPending = useMemo(
  () =>
    messages.some(
      (group, i) => (shown[groupKey(group, i)] ?? 0) < group.messages.length,
    ),
  [messages, shown],
)

const [loading, setLoading] = useState(false)

useEffect(() => {
  if (isPending) {
    setLoading(true)
    return
  }
  // all bubbles revealed, let the last animation finish
  const timer = window.setTimeout(() => setLoading(false), ANIMATION_DURATION)
  return () => window.clearTimeout(timer)
}, [isPending])

const onLoadingStateChangeRef = useRef(onLoadingStateChange)
onLoadingStateChangeRef.current = onLoadingStateChange

// emit every real change, skipping the initial `false`
const mounted = useRef(false)
useEffect(() => {
  if (!mounted.current) {
    mounted.current = true
    return
  }
  onLoadingStateChangeRef.current?.(loading)
}, [loading])


  /* ---- reveal queue: one bubble at a time, spaced by messageDelay ---------- */
  useEffect(() => {
    let targetKey: string | null = null

    for (let i = 0; i < messages.length; i++) {
      const key = groupKey(messages[i], i)
      if ((shown[key] ?? 0) < messages[i].messages.length) {
        targetKey = key
        break
      }
    }
    if (targetKey === null) return

    const elapsed = Date.now() - lastRevealAt.current
    const wait = Math.max(0, messageDelay - elapsed)

    const timer = window.setTimeout(() => {
      lastRevealAt.current = Date.now()
      setShown((prev) => ({ ...prev, [targetKey!]: (prev[targetKey!] ?? 0) + 1 }))
      playSound(messageSoundRef.current)
    }, wait)

    return () => window.clearTimeout(timer)
  }, [messages, shown, messageDelay])

  /* ---- typing indicator (with exit animation) ------------------------------ */
  const [typing, setTyping] = useState<{ name: string; leaving: boolean } | null>(null)

  useEffect(() => {
    if (currentlyTyping) {
      setTyping({ name: currentlyTyping, leaving: false })
      return
    }
    setTyping((prev) => (prev ? { ...prev, leaving: true } : prev))
    const timer = window.setTimeout(
      () => setTyping((prev) => (prev && prev.leaving ? null : prev)),
      220,
    )
    return () => window.clearTimeout(timer)
  }, [currentlyTyping])

  // typing sound: null -> string, or string -> different string
  const prevTyping = useRef<string | null>(null)
  useEffect(() => {
    if (currentlyTyping && currentlyTyping !== prevTyping.current) {
      playSound(typingSound)
    }
    prevTyping.current = currentlyTyping ?? null
  }, [currentlyTyping, typingSound])

  /* ---- auto scroll --------------------------------------------------------- */
  const totalShown = Object.entries(shown).reduce((sum, [, n]) => sum + n, 0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [totalShown, typing?.name, messages.length])

  /* ---- render -------------------------------------------------------------- */
  const typingMember = typing ? getMember(typing.name) : null

  return (
    <div className="rc-root" ref={scrollRef}>

      <div className="rc-inner">
        {messages.map((group, i) => {
          const key = groupKey(group, i)
          const visible = Math.min(shown[key] ?? 0, group.messages.length)
          if (visible === 0) return null

          const member = getMember(group.name)
          const items = group.messages.slice(0, visible)
          const complete = visible === group.messages.length
          const time = formatTime(group.time)

          return (
            <div
              key={key}
              className="rc-group"
              style={
                { '--c': member.color, '--cl': member.colorLight } as React.CSSProperties
              }
            >
              <Avatar {...member} />

              <div className="rc-col">
                <span className="rc-name">{group.name}</span>

                {items.map((text, j) => {
                  const isLast = complete && j === group.messages.length - 1
                  const emoji = isEmojiOnly(text)

                  if (emoji) {
                    return (
                      <div key={j} className="rc-emoji-wrap">
                        <span className="rc-emoji">{text.trim()}</span>
                        {isLast && time && <span className="rc-time rc-time-emoji">{time}</span>}
                      </div>
                    )
                  }

                  return (
                    <div key={j} className="rc-bubble">
                      <span className="rc-text">{text}</span>
                      {isLast && time && <span className="rc-time">{time}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {typing && typingMember && (
          <div
            key={typing.name}
            className={`rc-group rc-typing ${typing.leaving ? 'rc-leaving' : ''}`}
            style={
              {
                '--c': typingMember.color,
                '--cl': typingMember.colorLight,
              } as React.CSSProperties
            }
            aria-live="polite"
          >
            <Avatar {...typingMember} />
            <div className="rc-col">
              <span className="rc-typing-label">{typing.name} is typing</span>
              <div className="rc-dots" aria-hidden>
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RenderChat

