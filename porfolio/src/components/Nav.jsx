import { useEffect, useState } from 'react'
import { Mark, ArrowUpRight } from './Icons.jsx'
import { profile } from '../data.js'

const links = [
  { label: 'About', href: '#about' },
  { label: 'Toolkit', href: '#toolkit' },
  { label: 'Work', href: '#work' },
  { label: 'Contact', href: '#contact' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24)
      const max = document.documentElement.scrollHeight - window.innerHeight
      const pct = max > 0 ? window.scrollY / max : 0
      document.documentElement.style.setProperty('--scroll', pct.toFixed(4))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div className="progress" aria-hidden="true" />
      <header className={`nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="nav__inner">
          <a className="brand" href="#top" aria-label="Back to top">
            <span className="brand__mark">
              <Mark />
            </span>
            <span className="brand__text">{profile.handle}</span>
          </a>

          <nav className="nav__links" aria-label="Sections">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="nav__link">
                {link.label}
              </a>
            ))}
          </nav>

          <a className="nav__cta" href="#contact">
            Let&apos;s talk <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
    </>
  )
}
