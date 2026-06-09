import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCleanup } from '../../hooks/useCleanup';
import styles from './GameModePage.module.css';

import boardSvg from '../../assets/board.svg';
import tokenImg from '../../assets/token.svg';
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

export default function GameModePage() {
  const cleanup = useCleanup();
  const navigate = useNavigate();

  const [playerOption, setPlayerOption] = useState<'offline' | 'computer'>('offline');
  const [gameMode, setGameMode] = useState<'classic' | 'quick'>('classic');

  useEffect(() => {
    document.title = 'Select Game Mode - LOOSER LUDO';
    cleanup();
  }, [cleanup]);

  const handleContinue = () => {
    navigate('/setup');
  };

  return (
    <div className={styles.pageContainer}>
      <BackgroundWatermarks />
      
      {/* Header Logo */}
      <div className={styles.logoHeader}>
        <div className={styles.crown}>👑</div>
        <h1 className={styles.ludoText}>
          <span className={styles.letterL}>L</span>
          <span className={styles.letterU}>U</span>
          <span className={styles.letterD}>D</span>
          <span className={styles.letterO}>O</span>
        </h1>
      </div>

      {/* Ludo Board Graphic Area */}
      <div className={styles.graphicArea}>
        <div className={styles.boardWrapper}>
          <img src={boardSvg} alt="Ludo Board" className={styles.boardImg} />
          <img src={tokenImg} alt="Green Token" className={`${styles.token} ${styles.tokenGreen}`} />
          <img src={tokenImg} alt="Blue Token" className={`${styles.token} ${styles.tokenBlue}`} />
          <img src={tokenImg} alt="Red Token" className={`${styles.token} ${styles.tokenRed}`} />
          <img src={tokenImg} alt="Yellow Token" className={`${styles.token} ${styles.tokenYellow}`} />
          <img src={rollingDiceGif} alt="Rolling Dice" className={styles.centerDice} />
        </div>
      </div>

      {/* Wooden Options Grid */}
      <div className={styles.buttonGrid}>
        
        {/* Computer Option */}
        <button 
          className={`${styles.woodBtn} ${playerOption === 'computer' ? styles.activeWood : ''}`}
          onClick={() => setPlayerOption('computer')}
        >
          <div className={styles.woodScrew} style={{top: 4, left: 4}} />
          <div className={styles.woodScrew} style={{top: 4, right: 4}} />
          <div className={styles.woodScrew} style={{bottom: 4, left: 4}} />
          <div className={styles.woodScrew} style={{bottom: 4, right: 4}} />
          <div className={styles.btnIcon}>🤖</div>
          <span className={styles.woodBtnText}>COMPUTER</span>
        </button>

        {/* Offline Option */}
        <button 
          className={`${styles.woodBtn} ${playerOption === 'offline' ? styles.activeWood : ''}`}
          onClick={() => setPlayerOption('offline')}
        >
          <div className={styles.woodScrew} style={{top: 4, left: 4}} />
          <div className={styles.woodScrew} style={{top: 4, right: 4}} />
          <div className={styles.woodScrew} style={{bottom: 4, left: 4}} />
          <div className={styles.woodScrew} style={{bottom: 4, right: 4}} />
          <div className={styles.btnIcon}>👥</div>
          <span className={styles.woodBtnText}>OFFLINE</span>
        </button>

        {/* Classic Mode Option */}
        <button 
          className={`${styles.woodBtn} ${gameMode === 'classic' ? styles.activeWood : ''}`}
          onClick={() => setGameMode('classic')}
        >
          <div className={styles.woodScrew} style={{top: 4, left: 4}} />
          <div className={styles.woodScrew} style={{top: 4, right: 4}} />
          <div className={styles.woodScrew} style={{bottom: 4, left: 4}} />
          <div className={styles.woodScrew} style={{bottom: 4, right: 4}} />
          <div className={styles.btnIcon}>🎲</div>
          <span className={styles.woodBtnText}>CLASSIC</span>
        </button>

        {/* Quick Mode Option */}
        <button 
          className={`${styles.woodBtn} ${gameMode === 'quick' ? styles.activeWood : ''}`}
          onClick={() => setGameMode('quick')}
        >
          <div className={styles.woodScrew} style={{top: 4, left: 4}} />
          <div className={styles.woodScrew} style={{top: 4, right: 4}} />
          <div className={styles.woodScrew} style={{bottom: 4, left: 4}} />
          <div className={styles.woodScrew} style={{bottom: 4, right: 4}} />
          <div className={styles.btnIcon}>⚡</div>
          <span className={styles.woodBtnText}>QUICK</span>
        </button>

      </div>

      {/* Continue Button */}
      <button className={styles.continueBtn} onClick={handleContinue}>
        <span className={styles.chevron}>&raquo;</span>
        <span className={styles.continueText}>CONTINUE</span>
        <span className={styles.chevron}>&laquo;</span>
      </button>

    </div>
  );
}
