import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Logga in</h1>

      {error && <p className="error-text">Fel: {error}</p>}

      <form className="form-card" onSubmit={handleSubmit}>
        <label>E-post
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Lösenord
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Loggar in...' : 'Logga in'}
        </button>
      </form>

      <p>Inget konto? <Link to="/registrera">Registrera dig</Link></p>
    </div>
  );
}

export default Login;