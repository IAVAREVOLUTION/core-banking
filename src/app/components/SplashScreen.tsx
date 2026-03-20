import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import logo from '@/assets/7b6cb23c00b7817818c638af3eae0a416e1e9f57.png';

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onFinish, 500); // Wait for fade out animation
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  if (!show) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#C8102E] to-[#A00D28]"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 1.1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Logo con fondo blanco */}
            <div className="bg-white rounded-3xl p-12 shadow-2xl mx-auto mb-8 inline-block">
              <img src={logo} alt="eFinanciaN@t" className="h-32" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Sistema de Core Banking</h1>
            <p className="text-white/90 text-lg">eFinanciaN@t</p>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#C8102E] to-[#A00D28]"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.6,
            ease: [0.34, 1.56, 0.64, 1] // Spring effect
          }}
        >
          {/* Logo con fondo blanco - más grande */}
          <div className="bg-white rounded-3xl p-12 shadow-2xl mx-auto mb-8 inline-block">
            <img src={logo} alt="eFinanciaN@t" className="h-32" />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-white mb-2">Sistema de Core Banking</h1>
          <p className="text-white/90 text-lg">eFinanciaN@t</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-8"
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}