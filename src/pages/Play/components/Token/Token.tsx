import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import { deactivateAllTokens, setIsAnyTokenMoving } from '../../../../state/slices/playersSlice';
import { type TPlayer, type TPlayerColour, type TTokenClickData } from '../../../../types';
import { type TToken } from '../../../../types';
import { useDispatch, useSelector } from 'react-redux';
import { OnlineGameContext } from '../Game/Game';
import { socket } from '../../../../services/socket';
import type { AppDispatch, RootState } from '../../../../state/store';
import TokenImage from '../../../../assets/token.svg?react';
import { useCoordsToPosition } from '../../../../hooks/useCoordsToPosition';
import { setTokenTransitionTime } from '../../../../utils/setTokenTransitionTime';
import { changeTurnThunk } from '../../../../state/thunks/changeTurnThunk';
import { useMoveAndCaptureToken } from '../../../../hooks/useMoveAndCaptureToken';
import { unlockAndAlignTokens } from '../../../../state/thunks/unlockAndAlignTokens';
import { FORWARD_TOKEN_TRANSITION_TIME } from '../../../../game/tokens/constants';
import styles from './Token.module.css';
import clsx from 'clsx';
import { getTokenDOMId } from '../../../../game/tokens/logic';

const woodStainColours: Record<TPlayerColour, string> = {
  red: '#ba2b20',
  green: '#26632f',
  blue: '#1b4b8f',
  yellow: '#c28b17',
};

type Props = {
  colour: TPlayerColour;
  id: number;
  tokenClickData: TTokenClickData | null;
};

function Token({ colour, id, tokenClickData }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { tokenHeight, tokenWidth } = useSelector((state: RootState) => state.board);
  const { players } = useSelector((state: RootState) => state.players);
  const tokenClickDataRef = useRef(tokenClickData);
  const [isCurrentlyFocused, setIsCurrentlyFocused] = useState(false);
  const tokenElRef = useRef<HTMLButtonElement | null>(null);
  const { numberOfConsecutiveSix, tokens: playerTokens } = useMemo(
    () => players.find((v) => v.colour === colour),
    [players, colour]
  ) as TPlayer;
  const token = useMemo(() => playerTokens.find((t) => t.id === id), [playerTokens, id]) as TToken;

  const { coordinates, isActive, isLocked, tokenAlignmentData } = token;

  const { scaleFactor } = tokenAlignmentData;
  const getPosition = useCoordsToPosition();
  const { x, y } = getPosition(coordinates, tokenAlignmentData);
  const diceNumber = useSelector((state: RootState) =>
    state.dice.dice.find((d) => d.colour === colour)
  )?.diceNumber;
  const moveAndCapture = useMoveAndCaptureToken();

  const onlineContext = useContext(OnlineGameContext);

  const unlock = () => {
    dispatch(setIsAnyTokenMoving(true));
    setTokenTransitionTime(FORWARD_TOKEN_TRANSITION_TIME, token);
    dispatch(unlockAndAlignTokens({ colour, id }));
    dispatch(deactivateAllTokens(colour));
    setTimeout(() => {
      dispatch(setIsAnyTokenMoving(false));
    }, FORWARD_TOKEN_TRANSITION_TIME);
  };

  const executeTokenMove = useCallback(async () => {
    if (!isActive || diceNumber === -1 || !diceNumber) return;

    const moveData = await moveAndCapture(token, diceNumber);
    if (!moveData) return;
    const { hasTokenReachedHome, isCaptured, hasPlayerWon } = moveData;
    if (hasPlayerWon) return dispatch(changeTurnThunk(moveAndCapture));
    if ((diceNumber !== 6 || numberOfConsecutiveSix >= 3) && !isCaptured && !hasTokenReachedHome) {
      return dispatch(changeTurnThunk(moveAndCapture));
    }
  }, [diceNumber, dispatch, isActive, moveAndCapture, numberOfConsecutiveSix, token]);

  useEffect(() => {
    const prevClickData = tokenClickDataRef.current;
    const newTokenClickData = tokenClickData;

    if (!newTokenClickData || prevClickData?.timestamp === newTokenClickData.timestamp) return;
    tokenClickDataRef.current = newTokenClickData;

    if (newTokenClickData.colour === colour && newTokenClickData.id === id) {
      if (onlineContext?.isOnline) {
        socket.emit('submit_move', {
          roomId: onlineContext.roomId,
          tokenId: id,
          isUnlock: isLocked
        });
      } else {
        executeTokenMove();
      }
    }
  }, [colour, executeTokenMove, id, tokenClickData, onlineContext, isLocked]);

  const handleTokenClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    tokenElRef.current?.blur?.();
    if (onlineContext?.isOnline) {
      socket.emit('submit_move', {
        roomId: onlineContext.roomId,
        tokenId: id,
        isUnlock: isLocked
      });
    } else {
      if (isLocked) {
        if (isActive && diceNumber !== -1 && diceNumber) unlock();
      } else {
        executeTokenMove();
      }
    }
  };

  return (
    <button
      id={getTokenDOMId(colour, id)}
      className={styles.token}
      tabIndex={isActive ? undefined : -1}
      onFocus={() => setIsCurrentlyFocused(true)}
      onBlur={() => setIsCurrentlyFocused(false)}
      disabled={!isActive}
      ref={tokenElRef}
      onClick={handleTokenClick}
      style={
        {
          '--token-height': `${tokenHeight}px`,
          '--token-width': `${tokenWidth}px`,
          transform: `translate3d(${x}, ${y}, 12px) rotate(calc(-1 * var(--board-rotation, 0deg))) translate3d(0, -30%, 0) scale(${scaleFactor}) rotateX(-12deg) rotateY(5deg)`,
        } as React.CSSProperties
      }
    >
      <span
        key={`${coordinates.x}-${coordinates.y}`}
        className={clsx(styles.bouncer, {
          [styles.active]: isActive && !isCurrentlyFocused,
          [styles.hopper]: !isActive,
        })}
      >
        <TokenImage
          className={styles.svg}
          aria-hidden="true"
          style={
            {
              '--fill-colour': woodStainColours[colour],
            } as React.CSSProperties
          }
        />
      </span>
    </button>
  );
}

export default Token;
