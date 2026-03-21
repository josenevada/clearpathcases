import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Users } from 'lucide-react';
import Logo from '@/components/Logo';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="text-center mb-12"
      >
        <Logo size="lg" />
        <p className="text-muted-foreground mt-3 text-lg font-body">
          Bankruptcy document intake, simplified.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.2, 0, 0, 1] }}
          className="surface-card p-8 flex flex-col items-center text-center"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground mb-2">I'm a Client</h2>
          <p className="text-muted-foreground text-sm">Your attorney will send you a secure link to access your document portal.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.2, 0, 0, 1] }}
          className="surface-card-hover p-8 flex flex-col items-center text-center cursor-pointer"
          onClick={() => navigate('/login')}
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground mb-2">I'm a Paralegal / Attorney</h2>
          <p className="text-muted-foreground text-sm">Manage cases, review documents, and track filing deadlines.</p>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-muted-foreground text-sm mt-12"
      >
        Trusted by bankruptcy attorneys to get cases filed faster.
      </motion.p>
    </div>
  );
};

export default Landing;
