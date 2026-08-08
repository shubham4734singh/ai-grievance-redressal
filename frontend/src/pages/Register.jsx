import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const Register = () => {
  const [formData, setFormData] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.id]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Registration failed');
      }

      // Auto-login or redirect to login
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center py-12">
      <Card className="w-full max-w-md" title="Create an Account">
        <form onSubmit={handleRegister} className="space-y-4">
          <Input label="Full Name" id="full_name" required onChange={handleChange} />
          <Input label="Email Address" id="email" type="email" required onChange={handleChange} />
          <Input label="Phone Number" id="phone" type="tel" onChange={handleChange} />
          <Input label="Password" id="password" type="password" required onChange={handleChange} />
          
          {error && <div className="text-status-urgent text-sm bg-red-50 p-3 rounded-md">{error}</div>}
          
          <Button type="submit" loading={loading} fullWidth>
            Register
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account? <a href="/login" className="text-primary-500 font-semibold hover:underline">Log in</a>
        </p>
      </Card>
    </div>
  );
};

export default Register;
