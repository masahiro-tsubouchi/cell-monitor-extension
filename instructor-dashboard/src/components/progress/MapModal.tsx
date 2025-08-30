import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { StudentActivity } from '../../services/dashboardAPI';
import { TeamPosition } from '../../services/classroomAPI';
import TeamIconsRenderer from './TeamIconsRenderer';

interface MapModalProps {
  open: boolean;
  onClose: () => void;
  mapImageUrl: string;
  students: StudentActivity[];
  teams: string[];
  editingPositions: { [teamName: string]: TeamPosition };
  teamPositions?: { [teamName: string]: TeamPosition };
  browserZoomLevel: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  position: { x: number; y: number };
  dragStart: { x: number; y: number } | null;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  getImageUrl: (url: string) => string;
}

export const MapModal: React.FC<MapModalProps> = ({
  open,
  onClose,
  mapImageUrl,
  students,
  teams,
  editingPositions,
  teamPositions,
  browserZoomLevel,
  zoom,
  onZoomIn,
  onZoomOut,
  position,
  dragStart,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  getImageUrl
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">チームMAP - 詳細表示</Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={onZoomOut} size="small">
            <ZoomOutIcon />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: '60px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton onClick={onZoomIn} size="small">
            <ZoomInIcon />
          </IconButton>

          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <Box
          sx={{
            width: '100%',
            height: '70vh',
            minHeight: 400,
            position: 'relative',
            cursor: 'default', // ドラッグカーソルを無効化
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
            aspectRatio: '16 / 9'
          }}
          // モーダル表示時はMAP背景ドラッグを無効化
        >
          {mapImageUrl && (
            <>
              <img
                src={getImageUrl(mapImageUrl)}
                alt="チームMAP"
                style={{
                  transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                  transformOrigin: 'center center',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
              {/* モーダル内チームアイコン */}
              <TeamIconsRenderer
                students={students}
                teams={teams}
                editingPositions={editingPositions}
                teamPositions={teamPositions}
                draggedTeam={null}
                isEditMode={false}
                zoom={zoom}
                browserZoomLevel={browserZoomLevel}
                isModal={true}
              />
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MapModal;
