import { useEffect, useMemo, useRef, useState } from 'react'
import { KokoroTTS } from 'kokoro-js'

export type Member = {
  name: string
  dp: string // profile picture
  color: string
  colorLight: string
  /** Kokoro voice id for this member, e.g. "af_heart". Falls back to `defaultVoice` */
  voice?: string
  /** speaking speed for this member, 0.1-2. Falls back to `defaultTalkingSpeed` */
  talkingSpeed?: number
}

export type Message = {
  name: Member['name']
  time: string // ISO string of when the message was sent
  messages: string[] // one person can send multiple messages at once
  /** overrides the member's voice for this message group */
  voice?: string
  /** overrides the member's talking speed for this message group, 0.1-2 */
  talkingSpeed?: number
}

export type RenderChatProps = {
  members: Member[]
  messages: Message[]
  currentlyTyping?: string | null
  /** path to an audio file, played whenever a new message bubble arrives */
  messageSound?: string
  /** delay (ms) between consecutive bubbles. default 500 */
  messageDelay?: number
  /** path to an audio file, played when currentlyTyping goes null -> name or name -> other name */
  typingSound?: string
  /**
   * called with true when a message starts being processed (audio generation + playback + reveal),
   * false once everything is shown. starts as false
   */
  onLoadingStateChange?: (loading: boolean) => void
  /** called once the Kokoro model has finished loading */
  onTTSAILoaded?: () => void
  /** voice used for members without their own `voice`. default "af_heart" */
  defaultVoice?: string
  /** talking speed used when neither the message nor the member sets one (0.1-2). default 1 */
  defaultTalkingSpeed?: number
  /** "wasm" | "webgpu". default "wasm". (the model is loaded once per page, so changing this later has no effect) */
  ttsDevice?: 'wasm' | 'webgpu'
  /** default "q8". use "fp32" with webgpu */
  ttsDtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16'
}

const ANIMATION_DURATION = 300
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

/* ------------------------------ model loading ------------------------------- */
// Loaded once per page, shared across mounts (also survives React StrictMode double-mount).

let ttsLoader: Promise<KokoroTTS> | null = null
const progressListeners = new Set<(pct: number) => void>()
const fileProgress = new Map<string, { loaded: number; total: number }>()

const loadTTS = (device: 'wasm' | 'webgpu', dtype: NonNullable<RenderChatProps['ttsDtype']>) => {
  if (!ttsLoader) {
    ttsLoader = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype,
      device,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (p: any) => {
        if (p?.status !== 'progress' || !p.total) return
        fileProgress.set(p.file, { loaded: p.loaded, total: p.total })
        let loaded = 0
        let total = 0
        fileProgress.forEach((f) => {
          loaded += f.loaded
          total += f.total
        })
        const pct = total ? (loaded / total) * 100 : 0
        progressListeners.forEach((fn) => fn(pct))
      },
    }).catch((err) => {
      ttsLoader = null // allow retry on next mount
      throw err
    })
  }
  return ttsLoader
}

/* ---------------------------------- helpers --------------------------------- */

const FALLBACK_MEMBER: Omit<Member, 'name'> = {
  dp: '',
  color: '#4B4B63',
  colorLight: '#ECECF4',
}

const EMOJI_PRESENT = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f|\s)+$/u
const EMOJI_STRIP =
  /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f/gu

const isEmojiOnly = (text: string) => {
  const t = text.trim()
  return t.length > 0 && EMOJI_PRESENT.test(t) && EMOJI_ONLY.test(t)
}

/** text that is actually spoken: emojis removed, whitespace collapsed */
const speakable = (text: string) => text.replace(EMOJI_STRIP, '').replace(/\s+/g, ' ').trim()

const formatTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

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

/** plays a url and resolves when finished (or if playback fails, so the queue never hangs) */
const playUrl = (url: string) =>
  new Promise<void>((resolve) => {
    const a = new Audio(url)
    a.addEventListener('ended', () => resolve())
    a.addEventListener('error', () => resolve())
    a.play().catch((err) => {
      console.warn('[RenderChat] TTS playback blocked/failed:', err)
      resolve()
    })
  })

const groupKey = (m: Message, i: number) => `${i}:${m.time}`

const clampSpeed = (n: number) => Math.min(2, Math.max(0.1, Number.isFinite(n) ? n : 1))

type PendingItem = {
  key: string
  j: number
  name: string
  text: string
  voice: string
  speed: number
}
type Speaking = { key: string; phase: 'generating' | 'playing' }

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
  onLoadingStateChange,
  onTTSAILoaded,
  defaultVoice = 'af_heart',
  defaultTalkingSpeed = 1,
  ttsDevice = 'wasm',
  ttsDtype = 'q8',
}: RenderChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // How many strings of each Message group are currently visible.
  const [shown, setShown] = useState<Record<string, number>>({})
  const shownRef = useRef<Record<string, number>>({})
  const lastRevealAt = useRef(0)

  // which bubble is currently being generated / spoken (rendered as an animated placeholder)
  const [speaking, setSpeaking] = useState<Speaking | null>(null)

  // keep latest values available inside the async queue without re-running effects
  const messageSoundRef = useRef(messageSound)
  messageSoundRef.current = messageSound
  const messageDelayRef = useRef(messageDelay)
  messageDelayRef.current = messageDelay
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const membersRef = useRef(members)
  membersRef.current = members
  const defaultVoiceRef = useRef(defaultVoice)
  defaultVoiceRef.current = defaultVoice
  const defaultSpeedRef = useRef(defaultTalkingSpeed)
  defaultSpeedRef.current = defaultTalkingSpeed
  const onTTSAILoadedRef = useRef(onTTSAILoaded)
  onTTSAILoadedRef.current = onTTSAILoaded

  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

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

  /* ---- TTS model loading --------------------------------------------------- */
  const ttsRef = useRef<KokoroTTS | null>(null)
  const [ttsStatus, setTtsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [ttsProgress, setTtsProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    const onProgress = (pct: number) => setTtsProgress(pct)
    progressListeners.add(onProgress)

    loadTTS(ttsDevice, ttsDtype)
      .then((tts) => {
        if (cancelled) return
        ttsRef.current = tts
        // log all voices for testing (list_voices prints a console table)
        tts.list_voices()
        setTtsProgress(100)
        setTtsStatus('ready')
        onTTSAILoadedRef.current?.()
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[RenderChat] failed to load Kokoro TTS, showing text only:', err)
        setTtsStatus('error')
      })

    return () => {
      cancelled = true
      progressListeners.delete(onProgress)
    }
  }, [ttsDevice, ttsDtype])

  /* ---- loading state (covers audio generation + playback) ------------------ */
  // a message only counts as "shown" after its audio has finished, so this stays
  // true for the whole generate -> play -> reveal cycle
  const isPending = useMemo(
    () =>
      messages.some(
        (group, i) => (shown[groupKey(group, i)] ?? 0) < group.messages.length,
      ),
    [messages, shown],
  )

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // true as soon as there are unshown messages (even while the model is still
    // loading) and it stays true until every bubble has been spoken and shown
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

  /* ---- audio generation (serialised, with prefetch of the next bubble) ----- */
  const audioJobs = useRef(new Map<string, Promise<string | null>>())
  const genChain = useRef<Promise<unknown>>(Promise.resolve())

  const requestAudio = (id: string, text: string, voice: string, speed: number) => {
    const existing = audioJobs.current.get(id)
    if (existing) return existing

    const job = genChain.current.then(async () => {
      const tts = ttsRef.current
      if (!tts) return null
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audio = await tts.generate(text, { voice: voice as any, speed })
        return URL.createObjectURL(audio.toBlob())
      } catch (err) {
        console.warn(`[RenderChat] TTS generation failed for voice "${voice}":`, err)
        return null
      }
    })
    genChain.current = job
    audioJobs.current.set(id, job)
    return job
  }

  const pendingItems = (): PendingItem[] => {
    const out: PendingItem[] = []
    messagesRef.current.forEach((group, i) => {
      const key = groupKey(group, i)
      const member = membersRef.current.find((m) => m.name === group.name)
      // message > member > defaults
      const voice = group.voice ?? member?.voice ?? defaultVoiceRef.current
      const speed = clampSpeed(group.talkingSpeed ?? member?.talkingSpeed ?? defaultSpeedRef.current)
      for (let j = shownRef.current[key] ?? 0; j < group.messages.length; j++) {
        out.push({ key, j, name: group.name, text: group.messages[j], voice, speed })
      }
    })
    return out
  }

  /** generate + play audio for one bubble. resolves when it's time to show the text */
  const speak = async (item: PendingItem, after?: PendingItem) => {
    const spoken = speakable(item.text)
    // emoji-only bubbles, or no model -> nothing to say, show right away
    if (!spoken || !ttsRef.current) return

    const id = `${item.key}:${item.j}`
    setSpeaking({ key: item.key, phase: 'generating' })

    const url = await requestAudio(id, spoken, item.voice, item.speed)

    // start generating the next bubble while this one is playing
    if (after) {
      const nextSpoken = speakable(after.text)
      if (nextSpoken) {
        void requestAudio(`${after.key}:${after.j}`, nextSpoken, after.voice, after.speed)
      }
    }

    if (!url || !aliveRef.current) return

    setSpeaking({ key: item.key, phase: 'playing' })
    await playUrl(url)
    URL.revokeObjectURL(url)
    audioJobs.current.delete(id)
  }

  const reveal = (key: string) => {
    const next = { ...shownRef.current, [key]: (shownRef.current[key] ?? 0) + 1 }
    shownRef.current = next
    setShown(next)
  }

  /* ---- reveal queue: one bubble at a time -> speak, then show text --------- */
  const processing = useRef(false)

  useEffect(() => {
    if (ttsStatus === 'loading' || processing.current) return
    processing.current = true

    void (async () => {
      try {
        while (aliveRef.current) {
          const items = pendingItems()
          const next = items[0]
          if (!next) break

          const wait = Math.max(0, messageDelayRef.current - (Date.now() - lastRevealAt.current))
          if (wait > 0) await sleep(wait)
          if (!aliveRef.current) break

          await speak(next, items[1])
          if (!aliveRef.current) break

          lastRevealAt.current = Date.now()
          reveal(next.key)
          setSpeaking(null)
          playSound(messageSoundRef.current)
        }
      } finally {
        processing.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, ttsStatus])

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
  }, [totalShown, typing?.name, messages.length, speaking?.key])

  /* ---- render -------------------------------------------------------------- */
  const typingMember = typing ? getMember(typing.name) : null

  return (
    <div className="rc-root" ref={scrollRef}>
      {ttsStatus === 'loading' && (
        <div className="rc-loader-wrap" role="status" aria-live="polite">
          <div className="rc-loader">
            <span className="rc-loader-text">
              Loading voice model… {Math.round(ttsProgress)}%
            </span>
            <span className="rc-loader-bar">
              <span className="rc-loader-fill" style={{ width: `${ttsProgress}%` }} />
            </span>
          </div>
        </div>
      )}

      <div className="rc-inner">
        <div className='group-members'>
          {
            members.map(m => (
              <img
                key={m.name}
                src={m.dp}
                alt={m.name}
              />
            ))
          }
        </div>
        {messages.map((group, i) => {
          const key = groupKey(group, i)
          const visible = Math.min(shown[key] ?? 0, group.messages.length)
          const isSpeakingHere = speaking?.key === key
          if (visible === 0 && !isSpeakingHere) return null

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

                {isSpeakingHere && speaking && (
                  <div
                    className="rc-bubble rc-voice"
                    data-phase={speaking.phase}
                    aria-label={speaking.phase === 'generating' ? 'Preparing voice' : 'Speaking'}
                  >
                    <span className="rc-wave" aria-hidden>
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                )}
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