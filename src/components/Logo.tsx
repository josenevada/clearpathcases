import { Link } from 'react-router-dom';

const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <Link to="/" className={`font-display font-extrabold ${sizes[size]} tracking-tight`}>
      <span className="text-foreground">Clear</span>
      <span className="text-primary">Path</span>
    </Link>
  );
};

export default Logo;
