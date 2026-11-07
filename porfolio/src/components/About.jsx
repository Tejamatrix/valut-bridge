import { profile } from '../data.js'
import SectionHead from './SectionHead.jsx'

export default function About() {
  const lead = profile.bioLead
  return (
    <section className="section" id="about">
      <div className="container">
        <SectionHead num="01" label="About / Bio" />

        <div className="about-grid">
          <article className="card about-main" data-reveal>
            <p className="about-lead">
              {lead.before}
              <em>{lead.em}</em>
              {lead.middle}
              <span className="hl">{lead.highlightA}</span>
              {lead.and}
              <span className="hl">{lead.highlightB}</span>
              {lead.after}
            </p>
            <p className="about-body">{profile.bioBody}</p>
            <div className="about-chips">
              {['Product UI', 'Motion systems', 'WebGL', 'Design engineering'].map((chip) => (
                <span className="tag" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          </article>

          <div className="about-side">
            <div className="card mini" data-reveal style={{ '--d': '60ms' }}>
              <span className="mini__label">Based in</span>
              <strong className="mini__title">{profile.location}</strong>
              <span className="mini__meta">{profile.timezone}</span>
            </div>
            <div className="card mini" data-reveal style={{ '--d': '120ms' }}>
              <span className="mini__label">Currently</span>
              <strong className="mini__title">Building something loud</strong>
              <span className="mini__meta">Open to collaborations</span>
            </div>
            <div className="card mini mini--accent" data-reveal style={{ '--d': '180ms' }}>
              <span className="mini__label">Focus</span>
              <div className="mini__chips">
                {['Interfaces', 'Performance', 'Brand systems'].map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <blockquote className="quote card" data-reveal>
          <span className="quote__mark" aria-hidden="true">
            &ldquo;
          </span>
          <p className="quote__text">{profile.quote.text}</p>
          <cite className="quote__by">{profile.quote.by}</cite>
        </blockquote>
      </div>
    </section>
  )
}
