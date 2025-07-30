import webSocketService, { WebSocketEventHandlers } from './websocket';
import { InstructorStatusUpdate, StudentHelpRequestEvent, InstructorStatus } from '../types/api';

// Socket.IOクライアントのモック
jest.mock('socket.io-client');
const mockIo = jest.mocked(require('socket.io-client'));

describe('WebSocketService', () => {
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // モックソケットの設定
    mockSocket = {
      connected: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn()
    };

    mockIo.io.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    webSocketService.disconnect();
  });

  describe('Connection Management', () => {
    it('should connect with authentication token', () => {
      const token = 'test-token';

      webSocketService.connect(token);

      expect(mockIo.io).toHaveBeenCalledWith(
        'ws://localhost:8000',
        expect.objectContaining({
          auth: { token },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          forceNew: true
        })
      );
    });

    it('should not reconnect if already connected', () => {
      mockSocket.connected = true;
      const token = 'test-token';

      webSocketService.connect(token);
      webSocketService.connect(token); // 2回目の接続試行

      expect(mockIo.io).toHaveBeenCalledTimes(1);
    });

    it('should disconnect properly', () => {
      const token = 'test-token';
      webSocketService.connect(token);

      webSocketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(webSocketService.isConnected()).toBe(false);
    });

    it('should return correct connection state', () => {
      expect(webSocketService.getConnectionState()).toBe('disconnected');

      webSocketService.connect('test-token');
      expect(webSocketService.getConnectionState()).toBe('disconnected');

      mockSocket.connected = true;
      expect(webSocketService.isConnected()).toBe(true); // モックソケットの状態を直接反映
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      webSocketService.connect('test-token');
    });

    it('should set up socket event listeners on connect', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('instructor_status_update', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('student_help_request', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should handle instructor status update events', () => {
      const mockHandler = jest.fn();
      const handlers: WebSocketEventHandlers = {
        onInstructorStatusUpdate: mockHandler
      };

      webSocketService.setEventHandlers(handlers);

      // connect時に設定されたイベントハンドラーを取得
      const statusUpdateHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'instructor_status_update'
      )?.[1];

      const statusUpdate: InstructorStatusUpdate = {
        instructor_id: 1,
        status: InstructorStatus.BREAK,
        session_id: 123
      };

      statusUpdateHandler(statusUpdate);

      expect(mockHandler).toHaveBeenCalledWith(statusUpdate);
    });

    it('should handle student help request events', () => {
      const mockHandler = jest.fn();
      const handlers: WebSocketEventHandlers = {
        onStudentHelpRequest: mockHandler
      };

      webSocketService.setEventHandlers(handlers);

      // connect時に設定されたイベントハンドラーを取得
      const helpRequestHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'student_help_request'
      )?.[1];

      const helpRequest: StudentHelpRequestEvent = {
        student_id: 1,
        seat_number: 'A-01',
        urgency: 'high',
        description: 'Need help with coding'
      };

      helpRequestHandler(helpRequest);

      expect(mockHandler).toHaveBeenCalledWith(helpRequest);
    });

    it('should handle connection events', () => {
      const mockConnectHandler = jest.fn();
      const mockDisconnectHandler = jest.fn();

      const handlers: WebSocketEventHandlers = {
        onConnect: mockConnectHandler,
        onDisconnect: mockDisconnectHandler
      };

      webSocketService.setEventHandlers(handlers);

      // connect時に設定されたイベントハンドラーを取得
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];

      connectHandler();
      disconnectHandler('io server disconnect');

      expect(mockConnectHandler).toHaveBeenCalled();
      expect(mockDisconnectHandler).toHaveBeenCalled();
    });

    it('should handle connection errors', () => {
      const mockErrorHandler = jest.fn();

      const handlers: WebSocketEventHandlers = {
        onError: mockErrorHandler
      };

      webSocketService.setEventHandlers(handlers);

      // connect時に設定されたイベントハンドラーを取得
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1];

      const error = new Error('Connection failed');
      errorHandler(error);

      expect(mockErrorHandler).toHaveBeenCalledWith(error);
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      webSocketService.connect('test-token');
      mockSocket.connected = true;
    });

    it('should send generic messages', () => {
      const messageType = 'test_message';
      const messageData = { test: 'data' };

      webSocketService.sendMessage(messageType, messageData);

      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        type: messageType,
        data: messageData,
        timestamp: expect.any(String)
      });
    });

    it('should send status update message', () => {
      const statusUpdate = {
        instructor_id: 1,
        status: 'BREAK' as any,
        timestamp: new Date().toISOString()
      };

      webSocketService.sendStatusUpdate(statusUpdate);

      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        type: 'instructor_status_update',
        data: statusUpdate,
        timestamp: expect.any(String)
      });
    });

    it('should send help responses', () => {
      const helpRequestId = 456;
      const response = 'accept';

      webSocketService.sendHelpResponse(helpRequestId, response);

      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        type: 'help_response',
        data: {
          help_request_id: helpRequestId,
          response,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should not send messages when disconnected', () => {
      mockSocket.connected = false;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      webSocketService.sendMessage('test', {});

      expect(mockSocket.emit).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket not connected, cannot send message');

      consoleSpy.mockRestore();
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(global, 'setTimeout');
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should attempt reconnection on server disconnect', () => {
      webSocketService.connect('test-token');

      // disconnect時に設定されたイベントハンドラーを取得
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];

      // サーバー側切断をシミュレート
      disconnectHandler('io server disconnect');

      // 再接続タイマーが設定されることを確認
      expect(setTimeout).toHaveBeenCalled();
    });

    it('should use exponential backoff for reconnection', () => {
      webSocketService.connect('test-token');

      // connect_error時に設定されたイベントハンドラーを取得
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1];

      // 1回目のエラー
      errorHandler(new Error('Connection failed'));
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000);

      // 2回目のエラー
      errorHandler(new Error('Connection failed'));
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 2000);

      // 3回目のエラー
      errorHandler(new Error('Connection failed'));
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 4000);
    });

    it('should stop reconnection after max attempts', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      webSocketService.connect('test-token');

      // connect_error時に設定されたイベントハンドラーを取得
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1];

      // 最大試行回数を超えるまでエラーを発生
      for (let i = 0; i < 6; i++) {
        errorHandler(new Error('Connection failed'));
      }

      expect(consoleSpy).toHaveBeenCalledWith('Max reconnection attempts reached');

      consoleSpy.mockRestore();
    });
  });
});
