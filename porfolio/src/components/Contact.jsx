import { profile } from '../data.js'
import { ArrowUpRight, GithubIcon, LinkedinIcon, XIcon, MailIcon } from './Icons.jsx'
import SectionHead from './SectionHead.jsx'

export default function Contact() {
  return (
    <section className="section contact" id="contact">
      <div className="container">
        <SectionHead num="04" label="Contact" />

        <h2 className="contact__title" data-reveal>
          <span className="line line--solid">Let&apos;s build</span>
          <span className="line line--3d" data-text="something loud">
            <span className="text">something loud</span>
          </span>
        </h2>

        <div className="contact__row" data-reveal style={{ '--d': '80ms' }}>
          <a className="email-pill" href={profile.socials.mail}>
            <span className="email-pill__label">Start a conversation</span>
            <span className="email-pill__value">
              {profile.email}
              <span className="email-pill__arrow">
                <ArrowUpRight size={18} />
              </span>
            </span>
          </a>

          <div className="socials socials--lg">
            <a href={profile.socials.github} aria-label="GitHub"><GithubIcon /></a>
            <a href={profile.socials.linkedin} aria-label="LinkedIn"><LinkedinIcon /></a>
            <a href={profile.socials.x} aria-label="X"><XIcon /></a>
            <a href={profile.socials.mail} aria-label="Email"><MailIcon /></a>
          </div>
        </div>

        <footer className="footer">
          <span>© {new Date().getFullYear()} {profile.name} — placeholder content</span>
          <span className="footer__mid">Designed in the browser · React + Vite</span>
          <a href="#top">Back to top ↑</a>
        </footer>
      </div>
    </section>
  )
}
