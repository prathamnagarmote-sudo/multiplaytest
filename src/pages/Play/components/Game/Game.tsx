import React, { useEffect, useRef, createContext, useMemo } from 'react';
import {
  registerNewPlayer,
  setPlayerSequence,
  setPlayerSequenceDirect,
  convertPlayerToBot,
  setCurrentPlayerColour,
  activateTokens,
  deactivateAllTokens,
  setIsAnyTokenMoving,
  declareForfeit,
} from '../../../../state/slices/playersSlice';
import { type TPlayerColour } from '../../../../types';
import Board from '../Board/Board';
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { AppDispatch, RootState } from '../../../../state/store';
import { registerDice, setDiceNumberDirect, setIsPlaceholderShowing } from '../../../../state/slices/diceSlice';
import { handlePostDiceRollThunk } from '../../../../state/thunks/handlePostDiceRollThunk';
import GameFinishedScreen from '../GameFinishedScreen/GameFinishedScreen';
import { changeTurnThunk } from '../../../../state/thunks/changeTurnThunk';
import { useMoveAndCaptureToken } from '../../../../hooks/useMoveAndCaptureToken';
import type { TPlayerInitData, TToken } from '../../../../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { playerCountToWord } from '../../../../game/players/logic';
import { usePageLeaveBlocker } from '../../../../hooks/usePageLeaveBlocker';
import { addToGameInactiveTime, setGameStartTime } from '../../../../state/slices/sessionSlice';
import styles from './Game.module.css';
import { socket, connectSocket } from '../../../../services/socket';
import { toast } from 'react-toastify';
import { selectBestTokenForBot } from '../../../../game/bot/selectBestTokenForBot';
import { isTokenMovable } from '../../../../game/tokens/logic';
import { areCoordsEqual } from '../../../../game/coords/logic';
import { unlockAndAlignTokens } from '../../../../state/thunks/unlockAndAlignTokens';
import { setTokenTransitionTime } from '../../../../utils/setTokenTransitionTime';
import { FORWARD_TOKEN_TRANSITION_TIME } from '../../../../game/tokens/constants';


export const EXIT_MESSAGE = 'Are you sure you want to exit? Any progress made will be lost.';

// Context for multiplayer details
export const OnlineGameContext = createContext<{
  isOnline: boolean;
  roomId: string;
  myPlayerColour: TPlayerColour;
} | null>(null);

type Props = {
  initData: TPlayerInitData[];
  isOnline?: boolean;
  roomId?: string;
  myPlayerId?: string;
  myPlayerColour?: TPlayerColour;
  onlinePlayers?: Array<{ id: string; userId?: string; name: string; color: TPlayerColour; isBot: boolean }>;
};

const areAllTokensInSameCoord = (tokens: TToken[]) => {
  if (tokens.length === 0) return false;
  return tokens.every(t => areCoordsEqual(tokens[0].coordinates, t.coordinates));
};

const getNextTurnColour = (currentColour: TPlayerColour, playerSequence: TPlayerColour[]): TPlayerColour => {
  const idx = playerSequence.indexOf(currentColour);
  return playerSequence[(idx + 1) % playerSequence.length];
};

function Game({
  initData,
  isOnline,
  roomId,
  myPlayerId,
  myPlayerColour,
  onlinePlayers
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const boardTileSize = useSelector((state: RootState) => state.board.boardTileSize);
  const { playerSequence, isGameEnded, playerFinishOrder, currentPlayerColour, players } =
    useSelector((state: RootState) => state.players);
  const playersRegisteredInitiallyRef = useRef(true);
  const gameInactiveStartTime = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const moveAndCapture = useMoveAndCaptureToken();
  usePageLeaveBlocker(!isGameEnded && import.meta.env.PROD);

  const canonicalColour = (location.state as any)?.canonicalColour as TPlayerColour || myPlayerColour;

  const colorMap = useMemo(() => {
    const map: Record<TPlayerColour, TPlayerColour> = {
      blue: 'blue',
      red: 'red',
      green: 'green',
      yellow: 'yellow',
    };
    if (isOnline && canonicalColour && myPlayerColour && canonicalColour !== myPlayerColour) {
      map[canonicalColour] = myPlayerColour;
      map[myPlayerColour] = canonicalColour;
    }
    return map;
  }, [isOnline, canonicalColour, myPlayerColour]);

  useEffect(() => {
    if (initData.length === 0) return;
    if (isOnline) {
      const mappedSequence = initData.map((d) => colorMap[d.colour as TPlayerColour]);
      dispatch(setPlayerSequenceDirect(mappedSequence));
    } else {
      dispatch(setPlayerSequence({ playerCount: playerCountToWord(initData.length) }));
    }
    dispatch(setGameStartTime(Date.now()));
  }, [dispatch, initData, isOnline, colorMap]);

  useEffect(() => {
    if (initData.length === 0) return;
    for (let i = 0; i < initData.length; i++) {
      if (!playerSequence.length || !playersRegisteredInitiallyRef.current) return;
      const rawColour = initData[i].colour || playerSequence[i];
      const colour = isOnline ? colorMap[rawColour] : rawColour;
      dispatch(
        registerNewPlayer({
          name: initData[i].name,
          colour,
          isBot: initData[i].isBot,
          avatarUrl: initData[i].avatarUrl,
          level: initData[i].level,
        })
      );
      dispatch(registerDice(colour));
    }
    playersRegisteredInitiallyRef.current = false;
  }, [dispatch, playerSequence, initData, colorMap, isOnline]);

  useEffect(() => {
    const handlePageVisibilityChange = () => {
      if (isGameEnded) return;
      if (document.visibilityState === 'hidden') {
        gameInactiveStartTime.current = Date.now();
      } else if (document.visibilityState === 'visible' && gameInactiveStartTime.current > 0) {
        const now = Date.now();
        dispatch(addToGameInactiveTime(now - gameInactiveStartTime.current));
        gameInactiveStartTime.current = 0;
      }
    };
    document.addEventListener('visibilitychange', handlePageVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handlePageVisibilityChange);
  }, [dispatch, isGameEnded]);

  // Turn controller for Local Pass & Play
  useEffect(() => {
    if (isOnline) return;
    if (currentPlayerColour || players.length === 0 || initData.length === 0) return;
    dispatch(changeTurnThunk(moveAndCapture));
  }, [currentPlayerColour, dispatch, initData.length, moveAndCapture, players.length, isOnline]);

  // Handle Online Match turn coordination
  useEffect(() => {
    if (!isOnline || !roomId) return;

    connectSocket();

    const humanPlayers = onlinePlayers?.filter(p => !p.isBot) || [];
    const isHost = humanPlayers.length > 0 && (humanPlayers[0].userId || humanPlayers[0].id) === myPlayerId;

    const handleTurnUpdate = (data: { currentTurnIndex: number; currentPlayerId: string; currentPlayerColour: TPlayerColour }) => {
      const localColor = colorMap[data.currentPlayerColour];
      dispatch(setCurrentPlayerColour(localColor));
      dispatch(deactivateAllTokens(localColor));
    };

    const handleDiceRolled = (data: { playerId: string; playerUserId?: string; roll: number }) => {
      const playerColor = onlinePlayers?.find(p => (p.userId && p.userId === data.playerUserId) || p.id === data.playerId)?.color;
      if (!playerColor) return;

      const localColor = colorMap[playerColor];

      dispatch(setIsPlaceholderShowing({ colour: localColor, isPlaceholderShowing: true }));

      setTimeout(() => {
        dispatch(setIsPlaceholderShowing({ colour: localColor, isPlaceholderShowing: false }));
        dispatch(setDiceNumberDirect({ colour: localColor, diceNumber: data.roll }));

        const state = store.getState();
        const playersList = state.players.players;
        const activePlayer = playersList.find(p => p.colour === localColor);
        if (!activePlayer) return;

        const isBot = activePlayer.isBot;

        if (localColor === myPlayerColour) {
          const movableTokens = activePlayer.tokens.filter(t =>
            isTokenMovable(t, data.roll) || (data.roll === 6 && t.isLocked && !t.hasTokenReachedHome)
          );
          if (movableTokens.length === 0) {
            setTimeout(() => {
              const nextColour = getNextTurnColour(localColor, playerSequence);
              socket.emit('finish_turn', { roomId, nextTurnColour: colorMap[nextColour] });
            }, 1500);
          } else if (movableTokens.length === 1 && areAllTokensInSameCoord(movableTokens)) {
            const token = movableTokens[0];
            socket.emit('submit_move', { roomId, tokenId: token.id, isUnlock: token.isLocked });
          } else {
            dispatch(activateTokens({ all: data.roll === 6, colour: localColor, diceNumber: data.roll }));
          }
        } else if (isBot && isHost) {
          const allTokens = playersList.flatMap(p => p.tokens);
          const bestToken = selectBestTokenForBot(localColor, data.roll, allTokens);

          if (!bestToken) {
            setTimeout(() => {
              const nextColour = getNextTurnColour(localColor, playerSequence);
              socket.emit('finish_turn', { roomId, nextTurnColour: colorMap[nextColour] });
            }, 1500);
          } else {
            setTimeout(() => {
              socket.emit('submit_move', { roomId, tokenId: bestToken.id, isUnlock: bestToken.isLocked });
            }, 1500);
          }
        }
      }, 400);
    };

    const handleTokenMoved = async (data: { colour: TPlayerColour; id: number; isUnlock: boolean }) => {
      const localColor = colorMap[data.colour];
      const state = store.getState();
      const playersList = state.players.players;
      const player = playersList.find(p => p.colour === localColor);
      if (!player) return;
      const token = player.tokens.find(t => t.id === data.id);
      if (!token) return;

      const diceNumber = state.dice.dice.find(d => d.colour === localColor)?.diceNumber || 1;

      if (data.isUnlock) {
        dispatch(setIsAnyTokenMoving(true));
        setTokenTransitionTime(FORWARD_TOKEN_TRANSITION_TIME, token);
        dispatch(unlockAndAlignTokens({ colour: localColor, id: data.id }));
        dispatch(deactivateAllTokens(localColor));
        setTimeout(() => {
          dispatch(setIsAnyTokenMoving(false));

          const activePlayer = store.getState().players.players.find(p => p.colour === localColor);
          const isBot = activePlayer?.isBot;

          if (localColor === myPlayerColour || (isBot && isHost)) {
            const getsAnotherTurn = true;
            const nextColour = getsAnotherTurn ? localColor : getNextTurnColour(localColor, playerSequence);
            socket.emit('finish_turn', { roomId, nextTurnColour: colorMap[nextColour] });
          }
        }, FORWARD_TOKEN_TRANSITION_TIME);
      } else {
        const moveData = await moveAndCapture(token, diceNumber);
        
        const activePlayer = store.getState().players.players.find(p => p.colour === localColor);
        const isBot = activePlayer?.isBot;

        if (localColor === myPlayerColour || (isBot && isHost)) {
          if (moveData) {
            const { hasTokenReachedHome, isCaptured, hasPlayerWon } = moveData;
            if (hasPlayerWon) return;

            const getsAnotherTurn = (diceNumber === 6 && activePlayer!.numberOfConsecutiveSix < 3) || isCaptured || hasTokenReachedHome;
            const nextColour = getsAnotherTurn ? localColor : getNextTurnColour(localColor, playerSequence);
            socket.emit('finish_turn', { roomId, nextTurnColour: colorMap[nextColour] });
          } else {
            const nextColour = getNextTurnColour(localColor, playerSequence);
            socket.emit('finish_turn', { roomId, nextTurnColour: colorMap[nextColour] });
          }
        }
      }
    };

    const handlePlayerDisconnected = (data: { colour: TPlayerColour; playerId: string }) => {
      const localColor = colorMap[data.colour];
      const state = store.getState();
      const p = state.players.players.find(pl => pl.colour === localColor);
      const name = p ? p.name : localColor;
      toast.info(`${name} has disconnected. Bot taking over!`);
      dispatch(convertPlayerToBot({ colour: localColor }));
    };

    const handleMatchForfeited = (data: { winnerColor: TPlayerColour; loserColor: TPlayerColour }) => {
      const localWinnerColor = colorMap[data.winnerColor];
      const localLoserColor = colorMap[data.loserColor];
      const pWinner = store.getState().players.players.find(pl => pl.colour === localWinnerColor);
      const winnerName = pWinner ? pWinner.name : localWinnerColor;
      toast.info(`Match ended! Opponent left. Winner: ${winnerName}`);
      dispatch(declareForfeit({ losingColour: localLoserColor }));
    };

    socket.on('turn_update', handleTurnUpdate);
    socket.on('dice_rolled', handleDiceRolled);
    socket.on('token_moved', handleTokenMoved);
    socket.on('player_disconnected', handlePlayerDisconnected);
    socket.on('match_forfeited', handleMatchForfeited);

    // Emit rejoin_room AFTER listeners are registered
    socket.emit('rejoin_room', { roomId, userId: myPlayerId });

    return () => {
      socket.off('turn_update', handleTurnUpdate);
      socket.off('dice_rolled', handleDiceRolled);
      socket.off('token_moved', handleTokenMoved);
      socket.off('player_disconnected', handlePlayerDisconnected);
      socket.off('match_forfeited', handleMatchForfeited);
    };
  }, [isOnline, roomId, myPlayerId, myPlayerColour, onlinePlayers, playerSequence, store, dispatch, moveAndCapture, colorMap]);

  const handleDiceRoll = (colour: TPlayerColour, diceNumber: number) => {
    if (initData.length === 0) return;
    dispatch(handlePostDiceRollThunk(colour, diceNumber, moveAndCapture));
  };

  const handleExitBtnClick = () => {
    if (isOnline && roomId) {
      socket.emit('exit_match', { roomId });
    }
    navigate('/setup');
  };

  return (
    <OnlineGameContext.Provider value={{
      isOnline: !!isOnline,
      roomId: roomId || '',
      myPlayerColour: myPlayerColour || 'blue'
    }}>
      <div
        className={styles.game}
        style={
          {
            '--board-tile-size': `${boardTileSize}px`,
          } as React.CSSProperties
        }
      >
        <Board onDiceClick={handleDiceRoll} />
        <button
          type="button"
          aria-label="Exit button"
          className={styles.exitBtn}
          onClick={handleExitBtnClick}
        >
          &times;
        </button>
        {isGameEnded && <GameFinishedScreen playerFinishOrder={playerFinishOrder} />}
      </div>
    </OnlineGameContext.Provider>
  );
}

export default Game;
