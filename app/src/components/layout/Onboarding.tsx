import { useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { GSFilter } from '@/types/article'

const SLIDES = [
  {
    icon: 'fa-newspaper',
    iconBg: 'rgba(226,154,181,.1)',
    iconColor: 'var(--accent)',
    title: 'Daily Updates, Saved Forever',
    body: "Every day's current affairs from The Hindu and UPSCPrep are recorded by date. Go back to any day and revise.",
    hasGsSelector: false,
  },
  {
    icon: 'fa-layer-group',
    iconBg: 'rgba(143,207,192,.1)',
    iconColor: 'var(--teal)',
    title: 'Organised by Subject',
    body: 'All articles sorted by UPSC subjects — Polity, Economy, Environment and more. Revise subject-wise.',
    hasGsSelector: false,
  },
  {
    icon: 'fa-sliders-h',
    iconBg: 'rgba(226,154,181,.1)',
    iconColor: 'var(--accent)',
    title: 'Choose Your Focus',
    body: 'Select the GS papers you\'re preparing for.',
    hasGsSelector: true,
  },
]

const GS_OPTIONS: (keyof GSFilter)[] = ['GS 1', 'GS 2', 'GS 3', 'GS 4']

interface OnboardingProps {
  onDone: () => void
}

export function Onboarding({ onDone }: OnboardingProps) {
  const [current, setCurrent] = useState(0)
  const { gsFilter, setGsFilter } = useAppStore()

  function nextSlide() {
    if (current < SLIDES.length - 1) {
      setCurrent((c) => c + 1)
    } else {
      finish()
    }
  }

  function finish() {
    try {
      localStorage.setItem('u4ob', '1')
    } catch { /* noop */ }
    onDone()
  }

  function toggleGs(paper: keyof GSFilter) {
    setGsFilter({ ...gsFilter, [paper]: !gsFilter[paper] })
  }

  const slide = SLIDES[current]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        paddingTop: 'env(safe-area-inset-top)',
        zIndex: 900,
        background: 'linear-gradient(180deg, var(--bg1), var(--bg3))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Slides */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {SLIDES.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s',
              transform: i === current ? 'translateX(0)' : i < current ? 'translateX(-100%)' : 'translateX(100%)',
              opacity: i === current ? 1 : 0,
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
                marginBottom: 26,
                background: s.iconBg,
                border: '1px solid var(--panel-border)',
                backdropFilter: 'blur(16px)',
                color: s.iconColor,
              }}
            >
              <i className={`fas ${s.icon}`} />
            </div>

            <h2 style={{ fontSize: 27, fontWeight: 900, textAlign: 'center', marginBottom: 12, color: 'var(--on)' }}>
              {s.title}
            </h2>
            <p style={{ color: 'var(--on2)', textAlign: 'center', fontSize: 15, lineHeight: 1.65, maxWidth: 330, fontWeight: 600 }}>
              {s.body}
            </p>

            {/* GS Selector on last slide */}
            {s.hasGsSelector && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                {GS_OPTIONS.map((gs) => (
                  <button
                    key={gs}
                    onClick={() => toggleGs(gs)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 24,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid var(--panel-border)',
                      transition: 'all 0.2s',
                      background: gsFilter[gs] ? '#fff' : 'var(--panel2)',
                      color: gsFilter[gs] ? '#4A4E8C' : 'var(--on2)',
                    }}
                  >
                    {gs} Paper
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: 20 }}>
        {SLIDES.map((_, i) => (
          <div
            key={i}
            style={{
              height: 8,
              borderRadius: 4,
              background: i === current ? '#fff' : 'var(--panel-border)',
              transition: 'all 0.3s',
              width: i === current ? 26 : 8,
            }}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div style={{ padding: '20px 32px 44px', display: 'flex', gap: 12, paddingBottom: 'max(44px, calc(44px + env(safe-area-inset-bottom)))' }}>
        <button
          onClick={finish}
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 26,
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            border: '1px solid var(--panel-border)',
            background: 'var(--panel)',
            backdropFilter: 'blur(14px)',
            color: 'var(--on2)',
          }}
        >
          Skip
        </button>
        <button
          onClick={nextSlide}
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 26,
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            border: 'none',
            background: '#fff',
            color: '#4A4E8C',
          }}
        >
          {current === SLIDES.length - 1 ? "Let's go!" : 'Next'}
        </button>
      </div>
    </div>
  )
}
