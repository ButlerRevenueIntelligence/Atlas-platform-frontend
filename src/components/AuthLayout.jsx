import { Link } from "react-router-dom";
import "./AuthLayout.css";

export default function AuthLayout({ signup = false, children }) {
  return (
    <main className="atlas-auth">
      <header className="atlas-auth-header">
        <a className="atlas-auth-brand" href="https://atlasrevenueai.com/" aria-label="Atlas Revenue AI home">
          <span className="atlas-auth-mark" aria-hidden="true">A<span /></span>
          <span>Atlas Revenue AI<small>Decision intelligence for revenue leaders</small></span>
        </a>
        <div className="atlas-auth-switch">
          <span>{signup ? "Already have an account?" : "New to Atlas?"}</span>
          <Link to={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Start your trial"}<span aria-hidden="true">↗</span></Link>
        </div>
      </header>
      <div className="atlas-auth-main">
        <section className="atlas-auth-story" aria-labelledby="auth-story-title">
          <div className="atlas-auth-eyebrow"><span /> BUILT FOR THE PEOPLE LEADING REVENUE</div>
          <h1 id="auth-story-title">{signup ? <>A clearer view.<br />A better <em>next move.</em></> : <>See what matters.<br />Know what to <em>do next.</em></>}</h1>
          <p>Bring your revenue data into one place. Understand what’s moving, what’s at risk, and where to focus your team.</p>
          <div className="atlas-auth-questions">
            <div><span>01</span><div><strong>What needs attention?</strong><p>See the deals and execution gaps that need a decision.</p></div></div>
            <div><span>02</span><div><strong>Where can we grow?</strong><p>Explore account opportunities and external company intelligence.</p></div></div>
            <div><span>03</span><div><strong>What should we do next?</strong><p>Turn the signals into priorities with Atlas AI Operator.</p></div></div>
          </div>
          <div className="atlas-auth-story-note">Your data. Your workspace. A clearer direction.</div>
        </section>
        <section className="atlas-auth-card" aria-labelledby="auth-form-title">{children}</section>
      </div>
      <footer className="atlas-auth-footer"><span>Atlas Revenue AI</span><a href="mailto:admin@butlerco.com?subject=Atlas%20Access%20Support">Need help getting started?</a></footer>
    </main>
  );
}

export function PasswordField({ id, value, onChange, visible, onToggle, autoComplete, minLength, disabled }) {
  return (
    <div className="atlas-auth-password">
      <input id={id} name="password" type={visible ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} minLength={minLength} required disabled={disabled} placeholder={autoComplete === "new-password" ? "Create your password" : "Enter your password"} />
      <button type="button" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} aria-controls={id} disabled={disabled}>{visible ? "Hide" : "Show"}</button>
    </div>
  );
}
