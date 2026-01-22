import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AlertCircle, Shield, ArrowRight, Building } from 'lucide-react';
import { toast } from 'sonner';

const Register = () => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      await register(name, email, password, organizationName);
      toast.success('Account created successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img 
          src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
          alt="Modern medical office"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-teal-900/80 to-teal-700/60 flex items-center justify-center">
          <div className="text-white text-center px-12 max-w-lg">
            <Shield className="w-16 h-16 mx-auto mb-6 text-white/90" />
            <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Manrope' }}>AuthPilot</h1>
            <p className="text-lg text-white/80 leading-relaxed">
              Join healthcare teams automating prior authorization workflows with intelligent document analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Shield className="w-12 h-12 mx-auto mb-3 text-teal-700" />
            <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>AuthPilot</h1>
          </div>

          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                Create account
              </CardTitle>
              <CardDescription className="text-slate-600">
                Set up your workspace and start streamlining appeals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="register-name-input"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="register-email-input"
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="register-password-input"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization" className="text-slate-700 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Organization Name
                  </Label>
                  <Input
                    id="organization"
                    type="text"
                    placeholder="Your Specialty Clinic"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    data-testid="register-org-input"
                    className="h-11"
                  />
                  <p className="text-xs text-slate-500">Optional - creates a shared workspace</p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-teal-700 hover:bg-teal-800 text-white font-medium mt-2"
                  disabled={loading}
                  data-testid="register-submit-btn"
                >
                  {loading ? (
                    <div className="spinner w-5 h-5 border-white border-t-transparent" />
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-teal-700 hover:text-teal-800 hover:underline">
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-slate-500">
            By creating an account, you agree that this is an administrative tool only.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
