import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCleanup } from '../../hooks/useCleanup';
import styles from './IntroPage.module.css';

// Import assets from the project
import boardSvg from '../../assets/board.svg';
import tokenSvg from '../../assets/token.svg';
import rollingDiceGif from '../../assets/dice/dice_placeholder.gif';

import TokenIcon from '../../assets/token.svg?react';

const DieIcon = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%">
    <rect x="10" y="10" width="80" height="80" rx="15" fill="#f5f5f5" stroke="#ccc" strokeWidth="2" />
    <circle cx="30" cy="30" r="8" fill="#333" />
    <circle cx="70" cy="70" r="8" fill="#333" />
    <circle cx="30" cy="70" r="8" fill="#333" />
    <circle cx="70" cy="30" r="8" fill="#333" />
    <circle cx="50" cy="50" r="8" fill="#e53935" />
    <path d="M10 25 Q10 10 25 10 L75 10 Q90 10 90 25" fill="#fff" opacity="0.6" />
  </svg>
);

const BackgroundWatermarks = () => (
  <div className={styles.watermarksContainer}>
    <div className={styles.watermarkToken1}>
      <TokenIcon style={{ ['--fill-colour' as any]: '#ffffff' }} />
    </div>
    <div className={styles.watermarkToken2}>
      <TokenIcon style={{ ['--fill-colour' as any]: '#ffffff' }} />
    </div>
    <div className={styles.watermarkDie1}>
      <DieIcon />
    </div>
    <div className={styles.watermarkDie2}>
      <DieIcon />
    </div>
  </div>
);

export default function IntroPage() {
  const cleanup = useCleanup();
  const navigate = useNavigate();
  const [loadingText, setLoadingText] = useState('LOADING');

  useEffect(() => {
    document.title = 'LOOSER LUDO';
    cleanup();

    // Loading text animation
    const interval = setInterval(() => {
      setLoadingText(prev => prev.length >= 10 ? 'LOADING' : prev + '.');
    }, 500);

    // Redirect to Player Setup after 3.5 seconds
    const timeout = setTimeout(() => {
      navigate('/setup');
    }, 3500);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [cleanup, navigate]);

  return (
    <div className={styles.introContainer}>
      <BackgroundWatermarks />
      
      {/* Header section */}
      <div className={styles.header}>
        <div className={styles.crown}>👑</div>
        <h1 className={styles.title}>LOOSER LUDO</h1>
        <p className={styles.subtitle}>Roll the Dice. Rule the Board.</p>
      </div>

      {/* Main Ludo Graphic Area */}
      <div className={styles.graphicArea}>
        <div className={styles.boardWrapper}>
          <img src={boardSvg} alt="Ludo Board" className={styles.boardImg} />
          
          {/* Animated Tokens hopping on the board */}
          <img src={tokenSvg} alt="Green Token" className={`${styles.token} ${styles.tokenGreen}`} />
          <img src={tokenSvg} alt="Blue Token" className={`${styles.token} ${styles.tokenBlue}`} />
          <img src={tokenSvg} alt="Red Token" className={`${styles.token} ${styles.tokenRed}`} />
          <img src={tokenSvg} alt="Yellow Token" className={`${styles.token} ${styles.tokenYellow}`} />
        </div>
      </div>

      {/* Loading Option with Dice */}
      <div className={styles.loadingSection}>
        <img src={rollingDiceGif} alt="Rolling Dice" className={styles.rollingDice} />
        <h2 className={styles.loadingText}>{loadingText}</h2>
      </div>
    </div>
  );
}
