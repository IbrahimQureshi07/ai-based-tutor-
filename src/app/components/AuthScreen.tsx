import { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useApp } from '@/app/context/ExamContext';
import { Eye, EyeOff, Mail, Lock, User, Chrome, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { toast } from 'sonner';

// User interface for type safety
interface StoredUser {
  email: string;
  password: string;
  name: string;
  createdAt: string;
}

// LocalStorage helper functions
const getStoredUsers = (): StoredUser[] => {
  try {
    const users = localStorage.getItem('examai_users');
    return users ? JSON.parse(users) : [];
  } catch {
    return [];
  }
};

const saveUser = (user: StoredUser): void => {
  const users = getStoredUsers();
  users.push(user);
  localStorage.setItem('examai_users', JSON.stringify(users));
};

const findUser = (email: string): StoredUser | undefined => {
  const users = getStoredUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  return { valid: true, message: '' };
};

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setIsAuthenticated, setCurrentScreen, setUserName } = useApp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    // Validate email
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      setIsLoading(false);
      return;
    }

    if (isLogin) {
      // LOGIN FLOW
      const existingUser = findUser(email);
      
      if (!existingUser) {
        setError('No account found with this email. Please sign up first.');
        setIsLoading(false);
        return;
      }

      if (existingUser.password !== password) {
        setError('Incorrect password. Please try again.');
        setIsLoading(false);
        return;
      }

      // Login successful
      setUserName(existingUser.name);
      setIsAuthenticated(true);
      setCurrentScreen('dashboard');
      toast.success(`Welcome back, ${existingUser.name}!`);
      
    } else {
      // SIGNUP FLOW
      if (!name.trim()) {
        setError('Please enter your name');
        setIsLoading(false);
        return;
      }

      const existingUser = findUser(email);
      
      if (existingUser) {
        setError('An account with this email already exists. Please login instead.');
        setIsLoading(false);
        return;
      }

      // Create new user
      const newUser: StoredUser = {
        email: email.toLowerCase(),
        password: password,
        name: name.trim(),
        createdAt: new Date().toISOString()
      };

      saveUser(newUser);
      
      // Auto login after signup
      setUserName(newUser.name);
      setIsAuthenticated(true);
      setCurrentScreen('dashboard');
      toast.success(`Account created successfully! Welcome, ${newUser.name}!`);
    }

    setIsLoading(false);
  };

  const handleGoogleLogin = () => {
    // For demo purposes - in production, integrate with Google OAuth
    const demoUser: StoredUser = {
      email: 'demo@google.com',
      password: '',
      name: 'Demo User',
      createdAt: new Date().toISOString()
    };
    
    setUserName(demoUser.name);
    setIsAuthenticated(true);
    setCurrentScreen('dashboard');
    toast.success('Logged in with Google (Demo Mode)');
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(resetEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    const user = findUser(resetEmail);
    
    if (!user) {
      toast.error('No account found with this email');
      return;
    }

    // In a real app, this would send an email
    // For LocalStorage, we'll just show the password (demo only)
    toast.success(`Password reset link sent to ${resetEmail}`, {
      description: 'Check your email for instructions'
    });
    
    setForgotPasswordOpen(false);
    setResetEmail('');
  };

  // Clear error when switching between login/signup
  const handleTabSwitch = (login: boolean) => {
    setIsLogin(login);
    setError('');
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/20">
        <motion.div
          className="absolute top-20 left-20 w-72 h-72 bg-primary/30 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Glassmorphic Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="backdrop-blur-xl bg-card/80 rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Logo/Title */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-3xl mb-2">ExamAI Pro</h1>
            <p className="text-muted-foreground">AI-Powered Exam Preparation</p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-muted/50 rounded-xl">
            <button
              onClick={() => handleTabSwitch(true)}
              className={`flex-1 py-2 rounded-lg transition-all ${
                isLogin
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => handleTabSwitch(false)}
              className={`flex-1 py-2 rounded-lg transition-all ${
                !isLogin
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-12 bg-input-background/50 border-white/20"
                    required
                  />
                </div>
              </motion.div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 bg-input-background/50 border-white/20"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-input-background/50 border-white/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isLogin ? 'Logging in...' : 'Creating account...'}
                </span>
              ) : (
                isLogin ? 'Login' : 'Create Account'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card/80 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google Login */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            className="w-full h-12 border-white/20 bg-input-background/50 hover:bg-input-background"
          >
            <Chrome className="w-5 h-5 mr-2" />
            Google
          </Button>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              Send Reset Link
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
