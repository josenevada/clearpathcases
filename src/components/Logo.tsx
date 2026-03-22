import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  let target = '/';
  try {
    const { user } = useAuth();
    if (user) {
      target = user.role === 'super_admin' ? '/admin/dashboard' : '/paralegal';
    }
  } catch {
    // Outside AuthProvider context — default to landing
  }

  return (
    <Link to={target} className={`font-display font-extrabold ${sizes[size]} tracking-tight`}>
      <span className="text-foreground">Clear</span>
      <span className="text-primary">Path</span>
    </Link>
  );
};

export default Logo;
