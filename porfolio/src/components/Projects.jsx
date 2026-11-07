import { projects } from '../data.js'
import { ArrowUpRight } from './Icons.jsx'
import SectionHead from './SectionHead.jsx'

export default function Projects() {
  return (
    <section className="section" id="work">
      <div className="container">
        <SectionHead num="03" label="Selected work">
          <a className="sec-link" href="#work">
            All projects <ArrowUpRight size={14} />
          </a>
        </SectionHead>

        <div className="projects">
          {projects.map((project, i) => (
            <a
              className={`p-card card${project.feature ? ' p-card--feature' : ''}`}
              href={project.href}
              key={project.id}
              data-reveal
              style={{ '--d': `${i * 60}ms` }}
            >
              <div className={`p-art art--${project.art}`} aria-hidden="true">
                <span className="p-art__index">{project.id}</span>
              </div>
              <div className="p-body">
                <div className="p-copy">
                  <span className="p-sub">{project.subtitle}</span>
                  <h3 className="p-title">{project.title}</h3>
                  {project.feature && <p className="p-desc">{project.description}</p>}
                  <div className="p-tags">
                    {project.tags.map((tag) => (
                      <span className="tag tag--sm" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="p-arrow" aria-hidden="true">
                  <ArrowUpRight size={18} />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
