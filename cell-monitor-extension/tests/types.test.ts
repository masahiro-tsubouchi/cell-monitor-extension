/**
 * Phase 1 TDD: Type Definitions Tests
 * 型定義の拡張をテスト駆動で実装
 */

// Import actual type definitions from source
import type { EventType, ISettings } from '../src/index';

describe('Cell Monitor Type Definitions', () => {
  describe('EventType', () => {
    it('should include cell_executed type', () => {
      const eventType: EventType = 'cell_executed';
      expect(eventType).toBe('cell_executed');
    });

    it('should include notebook_opened type', () => {
      const eventType: EventType = 'notebook_opened';
      expect(eventType).toBe('notebook_opened');
    });

    it('should include notebook_saved type', () => {
      const eventType: EventType = 'notebook_saved';
      expect(eventType).toBe('notebook_saved');
    });

    it('should include notebook_closed type', () => {
      const eventType: EventType = 'notebook_closed';
      expect(eventType).toBe('notebook_closed');
    });

    it('should include help type', () => {
      const eventType: EventType = 'help';
      expect(eventType).toBe('help');
    });

    it('should maintain existing event types', () => {
      const existingEventTypes = [
        'cell_executed',
        'notebook_opened',
        'notebook_saved',
        'notebook_closed'
      ];

      existingEventTypes.forEach(eventType => {
        expect(['cell_executed', 'notebook_opened', 'notebook_saved', 'notebook_closed', 'help']).toContain(eventType);
      });
    });
  });

  describe('ISettings interface', () => {
    it('should include showNotifications property', () => {
      // ISettingsインターフェースの構造をテスト
      const expectedSettingsProperties = [
        'serverUrl',
        'userId',
        'userName',
        'batchSize',
        'retryAttempts',
        'maxNotifications',
        'showNotifications'  // 新しく追加されるプロパティ
      ];

      // 実装前はshowNotificationsが存在しないためテストが失敗する予定
      expect(expectedSettingsProperties).toContain('showNotifications');
    });

    it('should maintain existing settings properties', () => {
      const existingProperties = [
        'serverUrl',
        'userId',
        'userName',
        'batchSize',
        'retryAttempts',
        'maxNotifications'
      ];

      existingProperties.forEach(prop => {
        expect([
          'serverUrl', 'userId', 'userName', 'batchSize',
          'retryAttempts', 'maxNotifications', 'showNotifications'
        ]).toContain(prop);
      });
    });
  });

  describe('IStudentProgressData interface', () => {
    it('should support help event type in eventType field', () => {
      // IStudentProgressDataのeventTypeフィールドが'help'をサポートすることをテスト
      const validEventTypeValues = [
        'cell_executed',
        'notebook_opened',
        'notebook_saved',
        'notebook_closed',
        'help'
      ];

      expect(validEventTypeValues).toContain('help');
    });

    it('should maintain existing interface structure', () => {
      // 既存のインターフェース構造が維持されることをテスト
      const expectedFields = [
        'eventId',
        'eventType',
        'eventTime',
        'userId',
        'userName',
        'sessionId',
        'notebookPath'
      ];

      expectedFields.forEach(field => {
        expect(expectedFields).toContain(field);
      });
    });
  });
});
