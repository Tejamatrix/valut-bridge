import { useRef } from 'react'
import { ArrowUpRight, DownloadIcon, GithubIcon, LinkedinIcon, XIcon, MailIcon } from './Icons.jsx'
import { profile } from '../data.js'

const barcode = [3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 3]

export default function Hero() {
  const heroRef = useRef(null)
  const titleRef = useRef(null)
  const spotRef = useRef(null)

  const handleMove = (event) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = heroRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    if (spotRef.current) {
      spotRef.current.style.setProperty('--mx', `${x * 100}%`)
      spotRef.current.style.setProperty('--my', `${y * 100}%`)
    }
    if (titleRef.current) {
      const ry = (x - 0.5) * 9
      const rx = (0.5 - y) * 7
      titleRef.current.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
    }
  }

  const handleLeave = () => {
    if (titleRef.current) {
      titleRef.current.style.transform = 'perspective(1100px) rotateX(0deg) rotateY(0deg)'
    }
  }

  return (
    <section className="hero" id="top" ref={heroRef} onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <div className="hero__spot" ref={spotRef} aria-hidden="true" />
      <div className="container hero__grid">
        <div className="hero__copy">
          <div className="eyebrow anim" style={{ animationDelay: '80ms' }}>
            <span className="dot" />
            {profile.availability}
          </div>

          <h1 className="hero__title" ref={titleRef}>
            <span className="line line--solid anim" style={{ animationDelay: '160ms' }}>
              I turn
            </span>
            <span className="line line--3d anim" data-text="bold ideas" style={{ animationDelay: '260ms' }}>
              <span className="text">bold ideas</span>
            </span>
            <span className="line line--outline anim" style={{ animationDelay: '360ms' }}>
              into interfaces
            </span>
          </h1>

          <p className="hero__sub anim" style={{ animationDelay: '460ms' }}>
            {profile.role}. Placeholder intro — one short, sharp sentence about what you build, who it is
            for, and why it matters.
          </p>

          <div className="hero__actions anim" style={{ animationDelay: '540ms' }}>
            <a className="btn btn--primary" href="#work">
              See the work <ArrowUpRight />
            </a>
            <a className="btn btn--ghost" href="#" aria-label="Download CV (placeholder)">
              <DownloadIcon /> Download CV
            </a>
            <div className="socials">
              <a href={profile.socials.github} aria-label="GitHub"><GithubIcon /></a>
              <a href={profile.socials.linkedin} aria-label="LinkedIn"><LinkedinIcon /></a>
              <a href={profile.socials.x} aria-label="X"><XIcon /></a>
              <a href={profile.socials.mail} aria-label="Email"><MailIcon /></a>
            </div>
          </div>
        </div>

        <div className="hero__art art-stage anim" style={{ animationDelay: '420ms' }} aria-hidden="true">
          <div className="stage-glow" />
          <div className="stage-orb" />
          <div className="stage-ring" />
          <div className="stage-ring stage-ring--inner" />

          <div className="id-card">
            <div className="id-card__top">
              <span>PORTFOLIO — 2026</span>
              <span className="id-card__dot" />
            </div>
            <div className="id-card__mono grad-text">{profile.monogram}</div>
            <div className="id-card__name">{profile.name}</div>
            <div className="id-card__role">{profile.role}</div>
            <div className="id-card__rows">
              <span>BASE</span>
              <b>{profile.location}</b>
              <span>MODE</span>
              <b>Remote-first</b>
              <span>STACK</span>
              <b>React · TS · Node</b>
            </div>
            <div className="barcode">
              {barcode.map((w, i) => (
                <i key={i} style={{ width: `${w}px` }} />
              ))}
            </div>
          </div>

          <span className="stage-chip stage-chip--a">
            <i /> React
          </span>
          <span className="stage-chip stage-chip--b">
            <i /> TypeScript
          </span>
          <span className="stage-chip stage-chip--c">
            <i /> WebGL
          </span>
          <span className="stage-tag">FIG. 01 — SELF PORTRAIT</span>
        </div>
      </div>

      <div className="container hero__stats">
        {profile.stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <span className="stat__value">{stat.value}</span>
            <span className="stat__label">{stat.label}</span>
          </div>
        ))}
        <div className="stat stat--hint">
          <span className="stat__label">Scroll to explore</span>
          <span className="stat__arrow" aria-hidden="true">
            <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
              <path d="M7 1v18m0 0 5-5m-5 5L2 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      </div>
    </section>
  )
}
