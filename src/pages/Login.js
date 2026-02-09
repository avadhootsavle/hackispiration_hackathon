import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, saveSession } from '../services/mockApi';

const Login = () => {
  const navigate = useNavigate();
  const existing = getSession();
  const [form, setForm] = useState(
    existing || {
      name: '',
      email: '',
      organization: '',
      role: 'Hospital',
      contact: '',
      hospitalAccess: true,
    },
  );
  const [connectedBank, setConnectedBank] = useState(Boolean(existing?.organization));

  const handleSubmit = (event) => {
    event.preventDefault();
    saveSession(form);
    navigate('/');
  };

  return (
    <main className="page">
      <section className="hero hero--narrow">
        <div>
          <p className="eyebrow">Secure access</p>
          <h1>Sign in to coordinate donations and requests.</h1>
          <p className="lead">
            Hospitals, individuals, and banks use one login. Choose your role to unlock the right
            tools before continuing.
          </p>
        </div>
      </section>

      <section className="grid grid--two login-grid">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Identity</p>
              <h3>Log in</h3>
              <p className="hint">We keep one session per device using local storage.</p>
            </div>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <div className="role-switch">
              {['Hospital', 'Individual donor'].map((roleOption) => (
                <button
                  type="button"
                  key={roleOption}
                  className={`chip ${form.role === roleOption ? 'chip--active' : ''}`}
                  onClick={() =>
                    setForm({
                      ...form,
                      role: roleOption,
                      hospitalAccess: roleOption === 'Hospital' ? true : false,
                      // clear fields that don't apply
                      name: roleOption === 'Hospital' ? '' : form.name,
                      email: roleOption === 'Hospital' ? '' : form.email,
                      organization: roleOption === 'Hospital' ? form.organization : '',
                    })
                  }
                >
                  {roleOption}
                </button>
              ))}
            </div>

            {form.role === 'Individual donor' && (
              <div className="form__row">
                <label>
                  Full name
                  <input
                    type="text"
                    value={form.name}
                    required
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Full Name"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={form.email}
                    required
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="abc@gmail.com"
                  />
                </label>
              </div>
            )}

            {form.role === 'Hospital' && (
              <div className="form__row">
                <label>
                  Hospital name
                  <input
                    type="text"
                    value={form.organization}
                    required
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    placeholder="Hospital / Bank name"
                  />
                </label>
                <label>
                  Contact email
                  <input
                    type="email"
                    value={form.email}
                    required
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="ops@hospital.org"
                  />
                </label>
              </div>
            )}

            <label>
              Contact phone
              <input
                type="text"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="+91 123456789"
              />
            </label>

            <button type="submit" className="btn btn--primary">
              Continue
            </button>
          </form>
        </div>

        {/* <div className="panel panel--muted">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Banks</p>
              <h3>Bank linking</h3>
              <p className="hint">
                Mark a bank connection so hospitals can reach your desk. Optional, but helpful.
              </p>
            </div>
            <span className="pill">{connectedBank ? 'Connected' : 'Optional'}</span>
          </div>

          <div className="form">
            <label>
              Bank name
              <input
                type="text"
                placeholder="Red Cross Bank / City Blood Center"
                value={form.organization}
                onChange={(e) => {
                  setForm({ ...form, organization: e.target.value });
                  setConnectedBank(Boolean(e.target.value));
                }}
              />
            </label>

            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConnectedBank((prev) => !prev)}
            >
              {connectedBank ? 'Mark as not connected' : 'Mark as connected'}
            </button>
            <p className="hint">
              Sessions are stored locally. For production, wire to a database (PostgreSQL + Prisma,
              Supabase, or Firebase Auth/Firestore).
            </p>
          </div>
        </div> */}
      </section>
    </main>
  );
};

export default Login;
