export default function SectionHead({ num, label, children }) {
  return (
    <div className="sec-head" data-reveal>
      <span className="sec-num">{num}</span>
      <span className="sec-label">{label}</span>
      <span className="sec-rule" />
      {children}
    </div>
  )
}
