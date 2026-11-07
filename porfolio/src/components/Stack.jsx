import { coreStack, stackGroups } from '../data.js'
import SectionHead from './SectionHead.jsx'

export default function Stack() {
  return (
    <section className="section" id="toolkit">
      <div className="container">
        <SectionHead num="02" label="Toolkit / Stack" />

        <div className="stack-core" data-reveal>
          {coreStack.map((item, i) => (
            <span className="stack-core__item" key={item}>
              {item}
              {i < coreStack.length - 1 && <span className="stack-core__sep" aria-hidden="true" />}
            </span>
          ))}
        </div>

        <div className="stack-grid">
          {stackGroups.map((group, i) => (
            <article className="card stack-card" key={group.id} data-reveal style={{ '--d': `${i * 70}ms` }}>
              <div className="stack-card__head">
                <span className="stack-card__num">{group.id}</span>
                <h3 className="stack-card__title">{group.title}</h3>
                <span className="stack-card__count">{group.items.length}</span>
              </div>
              <div className="stack-card__tags">
                {group.items.map((item) => (
                  <span className="tag" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
