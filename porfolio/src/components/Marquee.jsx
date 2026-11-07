const words = ['Creative developer', 'Interface design', 'Full-stack', 'Motion & WebGL']

export default function Marquee() {
  const items = [...words, ...words, ...words]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {items.map((word, i) => (
          <span className="marquee__item" key={i}>
            {word}
            <span className="marquee__sep" />
          </span>
        ))}
      </div>
    </div>
  )
}
