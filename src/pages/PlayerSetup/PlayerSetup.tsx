import { useEffect, useMemo, useState, useRef } from 'react';
import PlayerInput from './components/PlayerInput/PlayerInput';
import { Link, useNavigate } from 'react-router-dom';
import type { TPlayerInitData, TPlayerColour } from '../../types';
import { ToastContainer, toast } from 'react-toastify';
import LoadingScreen from '../../components/LoadingScreen/LoadingScreen';
import { useCleanup } from '../../hooks/useCleanup';
import { playerCountToWord } from '../../game/players/logic';
import { playerSequences } from '../../game/players/constants';
import TokenIcon from '../../assets/token.svg?react';
import styles from './PlayerSetup.module.css';
import { Tooltip } from 'react-tooltip';
import { socket, connectSocket, disconnectSocket } from '../../services/socket';

const ALL_BOT_PLAYER_TOAST_ID = 'all-bot-player';
const PLAYER_NAME_EMPTY_TOAST_ID = 'player-name-empty';

const INITIAL_PLAYER_DATA: TPlayerInitData[] = [
  { name: 'Player 1', isBot: false },
  { name: 'Player 2', isBot: false },
  { name: 'Player 3', isBot: false },
  { name: 'Player 4', isBot: false },
];

const CrownIcon = () => (
  <svg viewBox="0 0 100 60" width="100%" height="100%" fill="#ffca28">
    <path d="M10 50 L20 10 L40 30 L50 5 L60 30 L80 10 L90 50 Z" stroke="#ff8f00" strokeWidth="4" strokeLinejoin="round" />
    <circle cx="20" cy="8" r="6" fill="#ffb300" />
    <circle cx="50" cy="3" r="6" fill="#ffb300" />
    <circle cx="80" cy="8" r="6" fill="#ffb300" />
    <path d="M15 50 L85 50 L80 58 L20 58 Z" fill="#ff8f00" />
  </svg>
);

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

const GroupTwoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05.02.01.03.03.04.04 1.14.83 1.93 1.94 1.93 3.41V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const GroupThreeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    <circle cx="20" cy="9" r="3" />
    <circle cx="4" cy="9" r="3" />
    <path d="M24 19v-2.5c0-1.47-.79-2.58-1.93-3.41-.35.43-.8.8-1.31 1.1.72.63 1.24 1.45 1.24 2.31V19h2zM4 19v-2.5c0-.86.52-1.68 1.24-2.31-.51-.3-.96-.67-1.31-1.1C2.79 13.92 2 15.03 2 16.5V19h2z" />
  </svg>
);

const GroupFourIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="8" r="3" />
    <circle cx="15" cy="8" r="3" />
    <path d="M9 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    <path d="M15 13c-.29 0-.62.02-.97.05 1.14.83 1.97 2.11 1.97 3.45V19h8v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    <circle cx="12" cy="4" r="2.5" opacity="0.6" />
    <path d="M12 8c-1.33 0-4 .67-4 2v1h8v-1c0-1.33-2.67-2-4-2z" opacity="0.6" />
  </svg>
);

const BackgroundWatermarks = () => (
  <div className={styles.watermarksContainer}>
    <div className={styles.watermarkToken1}>
      <TokenIcon style={{ '--fill-colour': '#ffffff' } as React.CSSProperties} />
    </div>
    <div className={styles.watermarkToken2}>
      <TokenIcon style={{ '--fill-colour': '#ffffff' } as React.CSSProperties} />
    </div>
    <div className={styles.watermarkDie1}>
      <DieIcon />
    </div>
    <div className={styles.watermarkDie2}>
      <DieIcon />
    </div>
  </div>
);

type TUserProfile = {
  userId: string;
  userName: string;
  email: string;
  isbot: boolean;
  user_skill: string;
  user_level: number;
  avatar_url: string;
  gamethumbnailurl: string;
  canPlay: boolean;
};

function PlayerSetup() {
  const [playerCount, setPlayerCount] = useState(2);
  const [currentUser, setCurrentUser] = useState<TUserProfile | null>(() => {
    const stored = localStorage.getItem('ludo_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [playersData, setPlayersData] = useState<TPlayerInitData[]>(() => {
    const stored = localStorage.getItem('ludo_user');
    let username = '';
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.userName) username = parsed.userName;
      } catch (e) {}
    }
    if (username) {
      return [
        { name: username, isBot: false },
        { name: 'Player 2', isBot: false },
        { name: 'Player 3', isBot: false },
        { name: 'Player 4', isBot: false },
      ];
    }
    return INITIAL_PLAYER_DATA;
  });
  const [isLoading, setIsLoading] = useState(false);
  const matchStartedRef = useRef(false);

  // Matchmaking state variables
  const [playMode, setPlayMode] = useState<'local' | 'online'>('local');
  const [onlineMatchSize, setOnlineMatchSize] = useState<number>(4);
  const [preferredColor, setPreferredColor] = useState<TPlayerColour>('blue');
  const [isSearching, setIsSearching] = useState(false);
  const [queueStatus, setQueueStatus] = useState<{
    players: number;
    max: number;
    playerList: Array<{ id: string; name: string; avatarUrl?: string; level?: number }>;
  }>({
    players: 0,
    max: 4,
    playerList: []
  });
  const [timeRemaining, setTimeRemaining] = useState(30);

  const [matchData, setMatchData] = useState<{
    roomId: string;
    players: Array<{ id: string; userId?: string; name: string; color: string; isBot: boolean; avatarUrl?: string; level?: number }>;
  } | null>(null);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);

  // Mock Login states
  const [profilesList, setProfilesList] = useState<TUserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const navigate = useNavigate();
  const cleanup = useCleanup();
  const playerSequence = useMemo(
    () => playerSequences[playerCountToWord(playerCount)],
    [playerCount]
  );

  // Load profiles on mount
  useEffect(() => {
    document.title = 'LOOSER LUDO - Player Setup';
    cleanup();

    connectSocket();
    socket.emit('get_profiles');

    // Auto login on mount if profile is saved in localStorage
    const stored = localStorage.getItem('ludo_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.userId) {
          socket.emit('login', { userId: parsed.userId });
        }
      } catch (e) {}
    }

    const handleProfilesList = (list: TUserProfile[]) => {
      setProfilesList(list);
      if (list.length > 0) {
        setSelectedUserId(list[0].userId);
      }
    };

    const handleLoginSuccess = (user: TUserProfile) => {
      setCurrentUser(user);
      localStorage.setItem('ludo_user', JSON.stringify(user));
      // Auto fill Player 1 name with username
      setPlayersData((prev) =>
        prev.map((d, i) => (i === 0 ? { ...d, name: user.userName } : d))
      );
    };

    const handleLoginError = (err: { message: string }) => {
      toast.error(err.message);
    };

    socket.on('profiles_list', handleProfilesList);
    socket.on('login_success', handleLoginSuccess);
    socket.on('login_error', handleLoginError);

    return () => {
      socket.off('profiles_list', handleProfilesList);
      socket.off('login_success', handleLoginSuccess);
      socket.off('login_error', handleLoginError);
    };
  }, [cleanup]);

  // Handle Matchmaking Sockets Lifecycle
  useEffect(() => {
    if (!isSearching) return;
    matchStartedRef.current = false;

    connectSocket();

    // Join queue
    socket.emit('join_matchmaking', {
      matchSize: onlineMatchSize,
      userId: currentUser?.userId,
      name: currentUser?.userName || 'Anonymous',
      avatarUrl: currentUser?.avatar_url || '',
      level: currentUser?.user_level || 1,
      preferredColor: preferredColor
    });

    const handleQueueUpdate = (data: {
      players: number;
      max: number;
      playerList?: Array<{ id: string; name: string; avatarUrl?: string; level?: number }>;
    }) => {
      setQueueStatus({
        players: data.players,
        max: data.max,
        playerList: data.playerList || []
      });
    };

    const handleTimerUpdate = (data: { timeRemaining: number }) => {
      setTimeRemaining(data.timeRemaining);
    };

    const handleMatchStarted = (data: {
      roomId: string;
      players: Array<{ id: string; userId?: string; name: string; color: string; isBot: boolean; avatarUrl?: string; level?: number }>;
      currentTurnIndex: number;
    }) => {
      matchStartedRef.current = true;
      setMatchData(data);
      setStartCountdown(3);
    };

    const handleMatchmakingKicked = (data: { reason: string }) => {
      setIsSearching(false);
      toast.warn(data.reason || 'Logged in from another session. Matchmaking cancelled.');
    };

    socket.on('queue_update', handleQueueUpdate);
    socket.on('timer_update', handleTimerUpdate);
    socket.on('match_started', handleMatchStarted);
    socket.on('matchmaking_kicked', handleMatchmakingKicked);

    return () => {
      socket.off('queue_update', handleQueueUpdate);
      socket.off('timer_update', handleTimerUpdate);
      socket.off('match_started', handleMatchStarted);
      socket.off('matchmaking_kicked', handleMatchmakingKicked);
      if (!matchStartedRef.current) {
        socket.emit('leave_matchmaking');
        disconnectSocket();
      }
    };
  }, [isSearching, navigate, currentUser, onlineMatchSize, preferredColor]);

  // Handle start match countdown transition
  useEffect(() => {
    if (startCountdown === null) return;
    if (startCountdown === 0) {
      if (!matchData) return;
      setIsSearching(false);
      
      const initData = matchData.players.map((p) => ({
        name: p.name,
        isBot: p.isBot,
        colour: p.color as TPlayerColour,
        id: p.userId || p.id,
        avatarUrl: p.avatarUrl,
        level: p.level
      }));

      const myId = currentUser?.userId || socket.id;
      const myColour = matchData.players.find((p) => (p.userId && p.userId === currentUser?.userId) || p.id === socket.id)?.color || 'blue';

      navigate('/play', {
        state: {
          initData,
          isOnline: true,
          roomId: matchData.roomId,
          myPlayerId: myId,
          myPlayerColour: preferredColor,
          canonicalColour: myColour as TPlayerColour,
          onlinePlayers: matchData.players
        }
      });
      
      setMatchData(null);
      setStartCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      setStartCountdown(startCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [startCountdown, matchData, navigate, currentUser, preferredColor]);

  const handlePlayBtnClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    const playerInitData = playersData.slice(0, playerCount);
    const isAnyNameEmpty = playerInitData.some(
      (d) => d.name === '' || [...d.name].every((c) => c === ' ')
    );
    if (isAnyNameEmpty)
      return toast('Player name must not be empty', {
        type: 'error',
        toastId: PLAYER_NAME_EMPTY_TOAST_ID,
      });
    const areAllPlayersBot = playerInitData.every((d) => d.isBot);
    if (areAllPlayersBot)
      return toast('There must be at least one human player', {
        type: 'error',
        toastId: ALL_BOT_PLAYER_TOAST_ID,
      });
    setIsLoading(true);
    navigate('/play', { state: { initData: playerInitData } });
  };

  const handleOnlinePlayClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSearching(true);
  };

  const handleCancelSearch = () => {
    setIsSearching(false);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    socket.emit('login', { userId: selectedUserId });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ludo_user');
    setSelectedUserId(profilesList[0]?.userId || '');
    setPlayersData((prev) =>
      prev.map((d, i) => (i === 0 ? { ...d, name: 'Player 1' } : d))
    );
  };

  return isLoading ? (
    <LoadingScreen />
  ) : (
    <div className={styles.playerSetup}>
      <BackgroundWatermarks />

      {/* Mock Login Screen Overlay */}
      {!currentUser && (
        <div className={styles.loginOverlay}>
          <form className={styles.loginCard} onSubmit={handleLoginSubmit}>
            <div className={styles.crown}>
              <CrownIcon />
            </div>
            <h2 className={styles.loginTitle}>LibreLudo Login</h2>
            <p className={styles.loginSubtitle}>Select a testing profile to continue</p>
            
            <div className={styles.profileSelectGrid}>
              {profilesList.map((user) => (
                <button
                  type="button"
                  key={user.userId}
                  className={`${styles.profileSelectCard} ${selectedUserId === user.userId ? styles.active : ''}`}
                  onClick={() => setSelectedUserId(user.userId)}
                >
                  <img src={user.avatar_url} className={styles.profileCardAvatar} alt="" />
                  <div className={styles.profileCardDetails}>
                    <div className={styles.profileCardName}>{user.userName}</div>
                    <div className={styles.profileCardEmail}>{user.email}</div>
                  </div>
                  <div className={styles.profileCardMeta}>
                    <span className={styles.profileCardLevel}>Lvl {user.user_level}</span>
                    <span className={styles.profileCardSkill}>Skill: {user.user_skill}</span>
                  </div>
                </button>
              ))}
            </div>

            <button type="submit" className={styles.loginSubmitBtn}>
              LOG IN
            </button>
          </form>
        </div>
      )}

      <Link to="/" className={styles.backBtn}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      <main className={styles.playerSetupDialog}>
        <div className={styles.logoHeader}>
          <div className={styles.crown}>
            <CrownIcon />
          </div>
          <div className={styles.looserBanner}>
            <span>LOOSER</span>
          </div>
          <div className={styles.ludoTextContainer}>
            <div className={styles.pawnLeft}>
              <TokenIcon style={{ '--fill-colour': '#1e88e5' } as React.CSSProperties} />
            </div>
            <h1 className={styles.ludoText}>
              <span className={styles.letterL}>L</span>
              <span className={styles.letterU}>U</span>
              <span className={styles.letterD}>D</span>
              <span className={styles.letterO}>O</span>
            </h1>
            <div className={styles.pawnRight}>
              <TokenIcon style={{ '--fill-colour': '#e53935' } as React.CSSProperties} />
            </div>
            <div className={styles.dieRight}>
              <DieIcon />
            </div>
          </div>
        </div>

        <div className={styles.sectionHeader}>
          <div className={styles.headerLine}>
            <span className={styles.lineBar} />
            <span className={styles.diamond} />
          </div>
          <h2>PLAYER SETUP</h2>
          <div className={styles.headerLine}>
            <span className={styles.diamond} />
            <span className={styles.lineBar} />
          </div>
        </div>
        <p className={styles.subText}>Choose play mode and enter your name</p>

        {/* Play Mode Toggle */}
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeTab} ${playMode === 'local' ? styles.active : ''}`}
            onClick={() => setPlayMode('local')}
          >
            LOCAL PASS & PLAY
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${playMode === 'online' ? styles.active : ''}`}
            onClick={() => setPlayMode('online')}
          >
            PLAY ONLINE
          </button>
        </div>

        {playMode === 'local' ? (
          <>
            <div className={styles.subSectionHeader}>
              <span className={styles.diamondSmall} />
              <span className={styles.dashLine} />
              <h3>CHOOSE PLAYERS</h3>
              <span className={styles.dashLine} />
              <span className={styles.diamondSmall} />
            </div>

            <div className={styles.playerCountGrid}>
              <button
                className={`${styles.playerCountCard} ${styles.card2} ${playerCount === 2 ? styles.active : ''}`}
                onClick={() => setPlayerCount(2)}
              >
                <div className={styles.cardIconCircle}>
                  <GroupTwoIcon />
                </div>
                <span className={styles.cardNum}>2</span>
                <span className={styles.cardText}>PLAYERS</span>
              </button>
              <button
                className={`${styles.playerCountCard} ${styles.card3} ${playerCount === 3 ? styles.active : ''}`}
                onClick={() => setPlayerCount(3)}
              >
                <div className={styles.cardIconCircle}>
                  <GroupThreeIcon />
                </div>
                <span className={styles.cardNum}>3</span>
                <span className={styles.cardText}>PLAYERS</span>
              </button>
              <button
                className={`${styles.playerCountCard} ${styles.card4} ${playerCount === 4 ? styles.active : ''}`}
                onClick={() => setPlayerCount(4)}
              >
                <div className={styles.cardIconCircle}>
                  <GroupFourIcon />
                </div>
                <span className={styles.cardNum}>4</span>
                <span className={styles.cardText}>PLAYERS</span>
              </button>
            </div>

            <div className={styles.subSectionHeader}>
              <span className={styles.diamondSmall} />
              <span className={styles.dashLine} />
              <h3>ENTER PLAYER NAMES</h3>
              <span className={styles.dashLine} />
              <span className={styles.diamondSmall} />
            </div>

            <div className={styles.playerInputsContainer}>
              <div className={styles.playerInputsList}>
                {playerSequence.map((c, index) => (
                  <div key={index} className={styles.playerInputRowWrapper}>
                    {index > 0 && (
                      <div className={styles.rowDivider}>
                        <span className={styles.diamondSmallCenter} />
                      </div>
                    )}
                    <PlayerInput
                      colour={c}
                      name={playersData[index].name}
                      isBot={playersData[index].isBot}
                      playerNum={index + 1}
                      onBotStatusChange={(isBot) =>
                        setPlayersData(playersData.map((d, i) => (i === index ? { ...d, isBot } : d)))
                      }
                      onNameChange={(name) =>
                        setPlayersData(playersData.map((d, i) => (i === index ? { ...d, name } : d)))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <Link className={styles.playBtn} to="/play" onClick={handlePlayBtnClick}>
              <span className={styles.chevron}>&raquo;</span>
              <span className={styles.playText}>PLAY</span>
              <span className={styles.chevron}>&laquo;</span>
            </Link>
          </>
        ) : (
          <>
            <div className={styles.subSectionHeader}>
              <span className={styles.diamondSmall} />
              <span className={styles.dashLine} />
              <h3>LOGGED IN PROFILE</h3>
              <span className={styles.dashLine} />
              <span className={styles.diamondSmall} />
            </div>

            {/* Profile Info Summary Card */}
            {currentUser && (
              <div className={styles.userAccountSummary}>
                <img src={currentUser.avatar_url} className={styles.userSummaryAvatar} alt="" />
                <div className={styles.userSummaryInfo}>
                  <div className={styles.userSummaryWelcome}>Signed In As</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className={styles.userSummaryName}>{currentUser.userName}</span>
                    <span className={styles.userSummaryLevel}>Lvl {currentUser.user_level}</span>
                  </div>
                </div>
                <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
                  LOG OUT
                </button>
              </div>
            )}

            <div className={styles.subSectionHeader}>
              <span className={styles.diamondSmall} />
              <span className={styles.dashLine} />
              <h3>SELECT MATCH TYPE</h3>
              <span className={styles.dashLine} />
              <span className={styles.diamondSmall} />
            </div>

            <div className={styles.onlineSizeSelection}>
              <button
                type="button"
                className={`${styles.onlineSizeCard} ${onlineMatchSize === 2 ? styles.active : ''}`}
                onClick={() => setOnlineMatchSize(2)}
              >
                <div className={styles.cardIconCircle}>
                  <GroupTwoIcon />
                </div>
                <span className={styles.cardText}>2 PLAYERS</span>
              </button>
              <button
                type="button"
                className={`${styles.onlineSizeCard} ${onlineMatchSize === 4 ? styles.active : ''}`}
                onClick={() => setOnlineMatchSize(4)}
              >
                <div className={styles.cardIconCircle}>
                  <GroupFourIcon />
                </div>
                <span className={styles.cardText}>4 PLAYERS</span>
              </button>
            </div>

            <div className={styles.subSectionHeader}>
              <span className={styles.diamondSmall} />
              <span className={styles.dashLine} />
              <h3>CHOOSE YOUR COLOR</h3>
              <span className={styles.dashLine} />
              <span className={styles.diamondSmall} />
            </div>

            <div className={styles.colorSelectionGrid}>
              {(['blue', 'red', 'green', 'yellow'] as TPlayerColour[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`${styles.colorCard} ${styles[color]} ${preferredColor === color ? styles.active : ''}`}
                  onClick={() => setPreferredColor(color)}
                  title={`Select ${color.charAt(0).toUpperCase() + color.slice(1)}`}
                >
                  <span className={styles.colorCircle} />
                  <span className={styles.colorName}>{color.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.playBtn}
              onClick={handleOnlinePlayClick}
              style={{ width: '100%', maxWidth: '280px', border: 'none', cursor: 'pointer' }}
            >
              <span className={styles.chevron}>&raquo;</span>
              <span className={styles.playText}>FIND MATCH</span>
              <span className={styles.chevron}>&laquo;</span>
            </button>
          </>
        )}
      </main>

      {/* Matchmaking Lobby Overlay */}
      {isSearching && (
        <div className={styles.lobbyOverlay}>
          <div className={styles.lobbyContainer}>
            {startCountdown === null && <div className={styles.spinnerRing} />}
            <h2 className={styles.lobbyTitle}>
              {startCountdown !== null ? 'Match Found!' : 'Searching for players...'}
            </h2>
            <div className={styles.lobbyTimer}>
              {startCountdown !== null ? `Starting in ${startCountdown}s...` : `${timeRemaining}s remaining`}
            </div>

            <div className={styles.lobbyPlayersGrid}>
              {Array.from({ length: onlineMatchSize }).map((_, idx) => {
                const matchedPlayer = matchData ? matchData.players[idx] : queueStatus.playerList[idx];
                const colorToHex: Record<string, string> = {
                  blue: '#1e88e5',
                  red: '#e53935',
                  green: '#43a047',
                  yellow: '#fdd835'
                };
                const badgeColor: string = matchData 
                  ? (matchedPlayer && 'color' in matchedPlayer ? (colorToHex[matchedPlayer.color as string] || (matchedPlayer.color as string)) : '#ffffff')
                  : (onlineMatchSize === 2
                      ? (idx === 0 ? '#1e88e5' : '#43a047')
                      : (idx === 0 ? '#1e88e5' : idx === 1 ? '#e53935' : idx === 2 ? '#43a047' : '#fdd835'));

                return matchedPlayer ? (
                  <div key={idx} className={`${styles.lobbyPlayerCard} ${styles.filled}`}>
                    <span
                      className={styles.cardColorBadge}
                      style={{
                        backgroundColor: badgeColor,
                        color: badgeColor,
                      }}
                    />
                    {matchedPlayer.avatarUrl ? (
                      <img src={matchedPlayer.avatarUrl} className={styles.profileCardAvatar} alt="" style={{ width: '40px', height: '40px', marginBottom: '4px' }} />
                    ) : (
                      <div style={{ fontSize: '24px' }}>👤</div>
                    )}
                    <div className={styles.lobbyPlayerName} style={{ marginTop: '2px', fontSize: '13px' }}>{matchedPlayer.name}</div>
                    <div className={styles.lobbyPlayerStatus} style={{ fontSize: '10px' }}>
                      Level {matchedPlayer.level || 1}
                    </div>
                  </div>
                ) : (
                  <div key={idx} className={styles.lobbyPlayerCard}>
                    <div className={styles.lobbyPlayerEmpty}>Lobby Slot {idx + 1}</div>
                    <div className={styles.lobbyPlayerStatus} style={{ color: 'rgba(255,255,255,0.2)' }}>
                      Searching...
                    </div>
                  </div>
                );
              })}
            </div>

            {startCountdown === null && (
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancelSearch}
              >
                CANCEL
              </button>
            )}
          </div>
        </div>
      )}

      <ToastContainer position="top-center" />
      <Tooltip
        id="bot-status-tooltip"
        className="tooltip"
        openEvents={{ focus: false, mouseover: true }}
        place="bottom-start"
      />
    </div>
  );
}

export default PlayerSetup;
