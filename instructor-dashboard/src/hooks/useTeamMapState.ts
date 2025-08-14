/**
 * TeamMapView.tsx の14個のuseStateをuseReducerで統合
 * 状態管理の複雑さを解決
 */

import { useReducer, useCallback } from 'react';
import { ClassroomMapWithPositions, TeamPosition } from '../services/classroomAPI';

// 状態の型定義
export interface TeamMapState {
  // サーバー側データ
  mapData: ClassroomMapWithPositions | null;
  isLoading: boolean;
  error: string | null;
  
  // UI状態
  isModalOpen: boolean;
  zoom: number;
  dragStart: { x: number; y: number } | null;
  position: { x: number; y: number };
  isEditMode: boolean;
  containerSize: { width: number; height: number };
  browserZoomLevel: number;
  
  // チーム配置編集
  editingPositions: { [teamName: string]: TeamPosition };
  
  // グリッドスナップ機能
  showGrid: boolean;
  snapToGrid: boolean;
  
  // Undo/Redo機能
  history: { [teamName: string]: TeamPosition }[];
  historyIndex: number;
  
  // UI フィードバック
  successMessage: string | null;
}

// アクションの型定義
export type TeamMapAction =
  // データ関連
  | { type: 'SET_MAP_DATA'; payload: ClassroomMapWithPositions | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  
  // UI状態
  | { type: 'SET_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_DRAG_START'; payload: { x: number; y: number } | null }
  | { type: 'SET_POSITION'; payload: { x: number; y: number } }
  | { type: 'SET_EDIT_MODE'; payload: boolean }
  | { type: 'SET_CONTAINER_SIZE'; payload: { width: number; height: number } }
  | { type: 'SET_BROWSER_ZOOM_LEVEL'; payload: number }
  
  // チーム配置編集
  | { type: 'SET_EDITING_POSITIONS'; payload: { [teamName: string]: TeamPosition } }
  | { type: 'UPDATE_TEAM_POSITION'; payload: { teamName: string; position: TeamPosition } }
  | { type: 'RESET_EDITING_POSITIONS' }
  
  // グリッド機能
  | { type: 'SET_SHOW_GRID'; payload: boolean }
  | { type: 'SET_SNAP_TO_GRID'; payload: boolean }
  
  // 履歴管理
  | { type: 'SAVE_TO_HISTORY'; payload: { [teamName: string]: TeamPosition } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_HISTORY' }
  
  // フィードバック
  | { type: 'SET_SUCCESS_MESSAGE'; payload: string | null }
  
  // 複合アクション
  | { type: 'RESET_ALL_STATE' }
  | { type: 'ENTER_EDIT_MODE'; payload: { [teamName: string]: TeamPosition } }
  | { type: 'EXIT_EDIT_MODE' };

// 初期状態
export const initialTeamMapState: TeamMapState = {
  // サーバー側データ
  mapData: null,
  isLoading: false,
  error: null,
  
  // UI状態
  isModalOpen: false,
  zoom: 1,
  dragStart: null,
  position: { x: 0, y: 0 },
  isEditMode: false,
  containerSize: { width: 0, height: 0 },
  browserZoomLevel: 1,
  
  // チーム配置編集
  editingPositions: {},
  
  // グリッドスナップ機能
  showGrid: false,
  snapToGrid: true,
  
  // Undo/Redo機能
  history: [],
  historyIndex: -1,
  
  // UI フィードバック
  successMessage: null,
};

// Reducer関数
export const teamMapReducer = (
  state: TeamMapState,
  action: TeamMapAction
): TeamMapState => {
  switch (action.type) {
    // データ関連
    case 'SET_MAP_DATA':
      return { ...state, mapData: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    // UI状態
    case 'SET_MODAL_OPEN':
      return { ...state, isModalOpen: action.payload };
    
    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };
    
    case 'SET_DRAG_START':
      return { ...state, dragStart: action.payload };
    
    case 'SET_POSITION':
      return { ...state, position: action.payload };
    
    case 'SET_EDIT_MODE':
      return { ...state, isEditMode: action.payload };
    
    case 'SET_CONTAINER_SIZE':
      return { ...state, containerSize: action.payload };
    
    case 'SET_BROWSER_ZOOM_LEVEL':
      return { ...state, browserZoomLevel: action.payload };
    
    // チーム配置編集
    case 'SET_EDITING_POSITIONS':
      return { ...state, editingPositions: action.payload };
    
    case 'UPDATE_TEAM_POSITION':
      return {
        ...state,
        editingPositions: {
          ...state.editingPositions,
          [action.payload.teamName]: action.payload.position,
        },
      };
    
    case 'RESET_EDITING_POSITIONS':
      return { ...state, editingPositions: {} };
    
    // グリッド機能
    case 'SET_SHOW_GRID':
      return { ...state, showGrid: action.payload };
    
    case 'SET_SNAP_TO_GRID':
      return { ...state, snapToGrid: action.payload };
    
    // 履歴管理
    case 'SAVE_TO_HISTORY':
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ ...action.payload });
      return {
        ...state,
        history: newHistory.slice(-50), // 最大50履歴
        historyIndex: Math.min(state.historyIndex + 1, 49),
      };
    
    case 'UNDO':
      if (state.historyIndex > 0) {
        const previousState = state.history[state.historyIndex - 1];
        return {
          ...state,
          editingPositions: previousState,
          historyIndex: state.historyIndex - 1,
        };
      }
      return state;
    
    case 'REDO':
      if (state.historyIndex < state.history.length - 1) {
        const nextState = state.history[state.historyIndex + 1];
        return {
          ...state,
          editingPositions: nextState,
          historyIndex: state.historyIndex + 1,
        };
      }
      return state;
    
    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: [],
        historyIndex: -1,
      };
    
    // フィードバック
    case 'SET_SUCCESS_MESSAGE':
      return { ...state, successMessage: action.payload };
    
    // 複合アクション
    case 'RESET_ALL_STATE':
      return { ...initialTeamMapState };
    
    case 'ENTER_EDIT_MODE':
      return {
        ...state,
        isEditMode: true,
        editingPositions: action.payload,
      };
    
    case 'EXIT_EDIT_MODE':
      return {
        ...state,
        isEditMode: false,
        editingPositions: {},
      };
    
    default:
      return state;
  }
};

// カスタムフック
export const useTeamMapState = () => {
  const [state, dispatch] = useReducer(teamMapReducer, initialTeamMapState);

  // アクションクリエーター（型安全なヘルパー関数）
  const actions = {
    // データ関連
    setMapData: useCallback((data: ClassroomMapWithPositions | null) => {
      dispatch({ type: 'SET_MAP_DATA', payload: data });
    }, []),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setError: useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, []),

    // UI状態
    setModalOpen: useCallback((open: boolean) => {
      dispatch({ type: 'SET_MODAL_OPEN', payload: open });
    }, []),

    setZoom: useCallback((zoom: number) => {
      dispatch({ type: 'SET_ZOOM', payload: zoom });
    }, []),

    setDragStart: useCallback((dragStart: { x: number; y: number } | null) => {
      dispatch({ type: 'SET_DRAG_START', payload: dragStart });
    }, []),

    setPosition: useCallback((position: { x: number; y: number }) => {
      dispatch({ type: 'SET_POSITION', payload: position });
    }, []),

    setEditMode: useCallback((editMode: boolean) => {
      dispatch({ type: 'SET_EDIT_MODE', payload: editMode });
    }, []),

    setContainerSize: useCallback((size: { width: number; height: number }) => {
      dispatch({ type: 'SET_CONTAINER_SIZE', payload: size });
    }, []),

    setBrowserZoomLevel: useCallback((level: number) => {
      dispatch({ type: 'SET_BROWSER_ZOOM_LEVEL', payload: level });
    }, []),

    // チーム配置編集
    setEditingPositions: useCallback((positions: { [teamName: string]: TeamPosition }) => {
      dispatch({ type: 'SET_EDITING_POSITIONS', payload: positions });
    }, []),

    updateTeamPosition: useCallback((teamName: string, position: TeamPosition) => {
      dispatch({ type: 'UPDATE_TEAM_POSITION', payload: { teamName, position } });
    }, []),

    resetEditingPositions: useCallback(() => {
      dispatch({ type: 'RESET_EDITING_POSITIONS' });
    }, []),

    // グリッド機能
    setShowGrid: useCallback((show: boolean) => {
      dispatch({ type: 'SET_SHOW_GRID', payload: show });
    }, []),

    setSnapToGrid: useCallback((snap: boolean) => {
      dispatch({ type: 'SET_SNAP_TO_GRID', payload: snap });
    }, []),

    // 履歴管理
    saveToHistory: useCallback((positions: { [teamName: string]: TeamPosition }) => {
      dispatch({ type: 'SAVE_TO_HISTORY', payload: positions });
    }, []),

    undo: useCallback(() => {
      dispatch({ type: 'UNDO' });
    }, []),

    redo: useCallback(() => {
      dispatch({ type: 'REDO' });
    }, []),

    clearHistory: useCallback(() => {
      dispatch({ type: 'CLEAR_HISTORY' });
    }, []),

    // フィードバック
    setSuccessMessage: useCallback((message: string | null) => {
      dispatch({ type: 'SET_SUCCESS_MESSAGE', payload: message });
    }, []),

    // 複合アクション
    resetAllState: useCallback(() => {
      dispatch({ type: 'RESET_ALL_STATE' });
    }, []),

    enterEditMode: useCallback((positions: { [teamName: string]: TeamPosition }) => {
      dispatch({ type: 'ENTER_EDIT_MODE', payload: positions });
    }, []),

    exitEditMode: useCallback(() => {
      dispatch({ type: 'EXIT_EDIT_MODE' });
    }, []),
  };

  // 計算プロパティ
  const computed = {
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
    hasError: !!state.error,
    hasSuccessMessage: !!state.successMessage,
    isInEditMode: state.isEditMode,
    hasMapData: !!state.mapData,
  };

  return {
    state,
    actions,
    computed,
    dispatch, // 直接dispatchも提供（高度な用途）
  };
};

export default useTeamMapState;