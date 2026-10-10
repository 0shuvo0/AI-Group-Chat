'use client'

import { useEffect, useRef, useState } from 'react'

type ThemeInputModalProps = {
  /** Called once when the modal closes. Receives the entered theme ('' if skipped or left empty). */
  onDismiss: (text: string) => void
}

function ThemeInputModal({ onDismiss }: ThemeInputModalProps) {
  const [open, setOpen] = useState(true)
  const [closing, setClosing] = useState(false)
  const [text, setText] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dismissed = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    textareaRef.current?.focus()
    return () => window.clearTimeout(timer.current)
  }, [])

  const dismiss = (value: string) => {
    if (dismissed.current) return // guard against double clicks / key repeat
    dismissed.current = true

    onDismiss(value)
    setClosing(true)
    timer.current = window.setTimeout(() => setOpen(false), 220)
  }

  const skip = () => dismiss('')
  const submit = () => dismiss(text.trim())

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      skip()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  if (!open) return null

  return (
    <div
      className={`tm-overlay ${closing ? 'tm-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tm-title"
      onKeyDown={onKeyDown}
    >
      <style>{CSS}</style>

      <div className="tm-card">
        <h1 id="tm-title" className="tm-title">
          Pick a theme for this chat
        </h1>
        <p className="tm-hint">Optional. Give the AIs something to talk about.</p>

        <textarea
          ref={textareaRef}
          className="tm-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Arguing about the best pizza topping"
          rows={4}
          maxLength={300}
        />

        <div className="tm-actions">
          <button type="button" className="tm-btn tm-ghost" onClick={skip}>
            No, thanks
          </button>
          <button type="button" className="tm-btn tm-primary" onClick={submit}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

export default ThemeInputModal

const CSS = `
.tm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: #faf9ff;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: #1b1b24;
  animation: tm-fade-in 260ms ease both;
}
.tm-overlay *, .tm-overlay *::before, .tm-overlay *::after { box-sizing: border-box; }
.tm-overlay.tm-closing { animation: tm-fade-out 220ms ease forwards; pointer-events: none; }

.tm-card {
  width: 100%;
  max-width: 460px;
  animation: tm-rise 380ms cubic-bezier(.2,.9,.3,1.15) both;
}
.tm-closing .tm-card { animation: tm-sink 220ms ease forwards; }

.tm-title {
  margin: 0 0 6px;
  font-size: 26px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.tm-hint {
  margin: 0 0 20px;
  font-size: 15px;
  color: #55556a;
}

.tm-input {
  display: block;
  width: 100%;
  resize: none;
  padding: 14px 16px;
  border: 1.5px solid #dcd9f0;
  border-radius: 18px;
  background: #fff;
  font: inherit;
  font-size: 16px;
  line-height: 1.45;
  color: inherit;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.tm-input::placeholder { color: #9a98b0; }
.tm-input:focus {
  outline: none;
  border-color: #3525cd;
  box-shadow: 0 0 0 4px #eceaff;
}

.tm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.tm-btn {
  height: 44px;
  padding: 0 22px;
  border: 0;
  border-radius: 999px;
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease, transform 120ms ease, box-shadow 150ms ease;
}
.tm-btn:active { transform: scale(.97); }
.tm-btn:focus-visible { outline: 3px solid #3525cd; outline-offset: 2px; }
.tm-ghost { background: transparent; color: #4b4b5e; }
.tm-ghost:hover { background: #eceaff; }
.tm-primary { background: #3525cd; color: #fff; }
.tm-primary:hover { background: #2a1ca8; }

@keyframes tm-fade-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes tm-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes tm-rise {
  from { opacity: 0; transform: translateY(18px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
@keyframes tm-sink {
  from { opacity: 1; transform: none; }
  to   { opacity: 0; transform: translateY(8px) scale(.98); }
}

@media (prefers-reduced-motion: reduce) {
  .tm-overlay, .tm-card, .tm-closing .tm-card { animation-duration: 1ms; }
}
`