import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegisterMutation } from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [register, { isLoading }] = useRegisterMutation();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await register({ username, password }).unwrap();
      navigate('/');
    } catch (err) {
      setError('Registration failed. Username may already exist.');
      console.error('Failed to register: ', err);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-6">
        <CardContent>
          <h2 className="text-2xl font-semibold text-center mb-4">Register</h2>
          {error && <p className="text-red-500 text-center mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Registering...' : 'Register'}
            </Button>
            <p className="text-sm text-center mt-3">
              Already have an account? <a href="/" className="text-blue-600 hover:underline">Login</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;