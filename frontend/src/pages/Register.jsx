import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Registrera dig</h1>

      {error && <p className="error-text">Fel: {error}</p>}

      <form className="form-card" onSubmit={handleSubmit}>
        <label>Namn
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>E-post
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Lösenord
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Registrerar...' : 'Skapa konto'}
        </button>
      </form>

      <p>Har du redan ett konto? <Link to="/logga-in">Logga in</Link></p>
    </div>
  );
}

export default Register;