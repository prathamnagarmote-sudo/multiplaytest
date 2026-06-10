import boardSvg from '../../../../assets/board.svg';
import Token from '../Token/Token';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../../state/store';
import { useCallback, useState, useContext } from 'react';
import { OnlineGameContext } from '../Game/Game';
import { NUMBER_OF_BLOCKS_IN_ONE_ROW, resizeBoard } from '../../../../state/slices/boardSlice';
import { ERRORS } from '../../../../utils/errors';
import Dice from '../Dice/Dice';
import type { TCoordinate, TPlayerColour } from '../../../../types';
import { getTokenDOMId, tokensWithCoord } from '../../../../game/tokens/logic';
import type { TTokenClickData } from '../../../../types/tokens';
import styles from './Board.module.css';
import { useResizeObserver } from '../../../../hooks/useResizeObserver';

type Props = {
  onDiceClick: (colour: TPlayerColour, diceNumber: number) => void;
};

function Board({ onDiceClick: onDiceRoll }: Props) {
  const onlineContext = useContext(OnlineGameContext);
  const isOnline = onlineContext?.isOnline;
  const myPlayerColour = onlineContext?.myPlayerColour || 'blue';

  const rotationAngle = isOnline
    ? {
        blue: 0,
        yellow: 90,
        green: 180,
        red: 270,
      }[myPlayerColour] || 0
    : 0;

  const { players, currentPlayerColour } = useSelector((state: RootState) => state.players);
  const { boardTileSize, boardSideLength } = useSelector((state: RootState) => state.board);
  const { dice } = useSelector((state: RootState) => state.dice);
  const [tokenClickData, setTokenClickData] = useState<TTokenClickData | null>(null);
  const [boardNode, setBoardNode] = useState<HTMLDivElement | null>(null);
  const dispatch = useDispatch();

  const onBoardResize = useCallback(() => {
    if (!boardNode) throw new Error(ERRORS.boardDoesNotExist());
    const boardSideLength = boardNode.getBoundingClientRect().width;
    dispatch(resizeBoard(boardSideLength));
  }, [boardNode, dispatch]);

  useResizeObserver(boardNode, onBoardResize);

  const handleBoardClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (players.find((p) => p.colour === currentPlayerColour)?.isBot) return;
    if (!boardNode) throw new Error(ERRORS.boardDoesNotExist());
    const { top, left } = boardNode.getBoundingClientRect();
    const boardX = e.clientX - left;
    const boardY = e.clientY - top;
    const tileStartCoords = Array(NUMBER_OF_BLOCKS_IN_ONE_ROW)
      .fill(null)
      .map((_, i) => (i + 1) * boardTileSize);

    if (boardX > boardSideLength || boardY > boardSideLength || boardX < 0 || boardY < 0) return;

    const coordX = tileStartCoords.findIndex((v) => boardX < v);
    const coordY = tileStartCoords.findIndex((v) => boardY < v);

    // Apply coordinate rotation translation math to map screen clicks back to board coordinates
    let unrotatedX = coordX;
    let unrotatedY = coordY;
    if (rotationAngle === 90) {
      unrotatedX = coordY;
      unrotatedY = 14 - coordX;
    } else if (rotationAngle === 180) {
      unrotatedX = 14 - coordX;
      unrotatedY = 14 - coordY;
    } else if (rotationAngle === 270) {
      unrotatedX = 14 - coordY;
      unrotatedY = coordX;
    }

    const coords: TCoordinate = { x: unrotatedX, y: unrotatedY };

    const tokenToMove = tokensWithCoord(coords, players).filter(
      (t) => t.colour === currentPlayerColour && t.isActive && !t.isLocked
    )[0];

    if (!tokenToMove) return;

    setTokenClickData({
      timestamp: Date.now(),
      colour: tokenToMove.colour,
      id: tokenToMove.id,
    });
  };

  const getDicePositionClass = (colour: TPlayerColour): TPlayerColour => {
    if (rotationAngle === 0) return colour;
    if (rotationAngle === 90) {
      const map: Record<TPlayerColour, TPlayerColour> = {
        yellow: 'blue',
        green: 'yellow',
        red: 'green',
        blue: 'red',
      };
      return map[colour];
    }
    if (rotationAngle === 180) {
      const map: Record<TPlayerColour, TPlayerColour> = {
        green: 'blue',
        red: 'yellow',
        blue: 'green',
        yellow: 'red',
      };
      return map[colour];
    }
    if (rotationAngle === 270) {
      const map: Record<TPlayerColour, TPlayerColour> = {
        red: 'blue',
        blue: 'yellow',
        yellow: 'green',
        green: 'red',
      };
      return map[colour];
    }
    return colour;
  };

  return (
    <div className={styles.boardWrapper}>
      <div
        className={styles.board}
        ref={setBoardNode}
        onClick={handleBoardClick}
        style={{
          '--board-rotation': `${rotationAngle}deg`,
        } as React.CSSProperties}
      >
        <img src={boardSvg} className={styles.boardImage} aria-hidden="true" />
        <div className={`${styles.paddockGlow} ${styles.red} ${currentPlayerColour === 'red' ? styles.active : ''}`} />
        <div className={`${styles.paddockGlow} ${styles.green} ${currentPlayerColour === 'green' ? styles.active : ''}`} />
        <div className={`${styles.paddockGlow} ${styles.yellow} ${currentPlayerColour === 'yellow' ? styles.active : ''}`} />
        <div className={`${styles.paddockGlow} ${styles.blue} ${currentPlayerColour === 'blue' ? styles.active : ''}`} />
        {players.map((p) =>
          p.tokens.map((t) => (
            <Token
              colour={t.colour}
              id={t.id}
              tokenClickData={tokenClickData}
              key={getTokenDOMId(t.colour, t.id)}
            />
          ))
        )}
      </div>
      {dice.map((d) => (
        <Dice
          colour={d.colour}
          positionColour={getDicePositionClass(d.colour)}
          onDiceClick={onDiceRoll}
          playerName={players.find((p) => p.colour === d.colour)?.name as string}
          key={d.colour}
        />
      ))}
    </div>
  );
}

export default Board;
