import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { Seat, LayoutConfig } from '../../types';
import { StudentHelpRequestEvent, InstructorStatusUpdate } from '../../types/api';
import webSocketService from '../../services/websocket';

interface SeatMapProps {
  seats: Seat[];
  layout: LayoutConfig;
  onSeatClick: (seat: Seat) => void;
}

const getSeatStatusClass = (status: Seat['status']): string => {
  switch (status) {
    case 'normal':
      return 'seat-normal';
    case 'help_requested':
      return 'seat-help-requested';
    case 'inactive':
      return 'seat-inactive';
    case 'empty':
      return 'seat-empty';
    default:
      return 'seat-normal';
  }
};

const getSeatStatusColor = (status: Seat['status']): string => {
  switch (status) {
    case 'normal':
      return '#4caf50'; // 緑
    case 'help_requested':
      return '#f44336'; // 赤
    case 'inactive':
      return '#ff9800'; // オレンジ
    case 'empty':
      return '#9e9e9e'; // グレー
    default:
      return '#4caf50';
  }
};

const SeatItem: React.FC<{
  seat: Seat;
  onClick: (seat: Seat) => void;
}> = ({ seat, onClick }) => {
  const handleClick = () => {
    onClick(seat);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(seat);
    }
  };

  return (
    <Card
      data-testid={`seat-${seat.id}`}
      className={getSeatStatusClass(seat.status)}
      role="gridcell"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        minHeight: 80,
        cursor: 'pointer',
        backgroundColor: getSeatStatusColor(seat.status),
        color: 'white',
        '&:hover': {
          opacity: 0.8,
        },
        '&:focus': {
          outline: '2px solid #2196f3',
          outlineOffset: '2px',
        },
      }}
    >
      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Typography variant="caption" component="div" align="center">
          {seat.seatNumber}
        </Typography>
        <Typography variant="body2" component="div" align="center" sx={{ mt: 0.5 }}>
          {seat.status === 'empty'
            ? '空席'
            : seat.studentName || `学生${seat.studentId || ''}`
          }
        </Typography>
        {seat.teamNumber && (
          <Typography variant="caption" component="div" align="center" sx={{ mt: 0.5 }}>
            チーム{seat.teamNumber}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export const SeatMap: React.FC<SeatMapProps> = ({ seats, layout, onSeatClick }) => {
  const [currentSeats, setCurrentSeats] = useState<Seat[]>(seats);

  // WebSocket統合: コンポーネントマウント時の接続とイベントハンドラ設定
  useEffect(() => {
    // 座席データの初期化
    setCurrentSeats(seats);

    // WebSocketイベントハンドラの定義
    const handleStudentHelpRequest = (data: StudentHelpRequestEvent) => {
      setCurrentSeats(prevSeats =>
        prevSeats.map(seat =>
          seat.seatNumber === data.seat_number
            ? { ...seat, status: 'help_requested' as const }
            : seat
        )
      );
    };

    const handleInstructorStatusUpdate = (data: InstructorStatusUpdate) => {
      // 講師ステータス更新の処理（必要に応じて実装）
      console.log('Instructor status updated:', data);
    };

    // WebSocketサービスにイベントハンドラを設定
    webSocketService.setEventHandlers({
      onStudentHelpRequest: handleStudentHelpRequest,
      onInstructorStatusUpdate: handleInstructorStatusUpdate,
    });

    // クリーンアップ関数
    return () => {
      // コンポーネントのアンマウント時にイベントハンドラをクリア
      webSocketService.setEventHandlers({});
    };
  }, [seats]); // seatsが変更された時も再実行

  if (currentSeats.length === 0) {
    return (
      <Box
        data-testid="seat-map"
        role="grid"
        aria-label="座席マップ"
        sx={{ p: 2, textAlign: 'center' }}
      >
        <Typography variant="h6" color="text.secondary">
          座席データがありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      data-testid="seat-map"
      role="grid"
      aria-label="座席マップ"
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.gridCols}, 1fr)`,
        gap: 1,
        p: 2,
        maxWidth: '100%',
        overflow: 'auto',
      }}
    >
      {currentSeats.map((seat) => (
        <SeatItem
          key={seat.id}
          seat={seat}
          onClick={onSeatClick}
        />
      ))}
    </Box>
  );
};
