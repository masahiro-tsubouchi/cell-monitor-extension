/**
 * Phase 1 TDD: Settings Schema Tests
 * 設定スキーマの拡張をテスト駆動で実装
 */

import { readFileSync } from 'fs';
import { join } from 'path';

describe('Cell Monitor Settings Schema', () => {
  let schema: any;

  beforeAll(() => {
    // schema/plugin.jsonを読み込み
    const schemaPath = join(__dirname, '..', 'schema', 'plugin.json');
    const schemaContent = readFileSync(schemaPath, 'utf8');
    schema = JSON.parse(schemaContent);
  });

  describe('showNotifications setting', () => {
    it('should have showNotifications property in schema', () => {
      expect(schema.properties).toHaveProperty('showNotifications');
    });

    it('should have correct type for showNotifications', () => {
      const showNotifications = schema.properties.showNotifications;
      expect(showNotifications.type).toBe('boolean');
    });

    it('should have correct title for showNotifications', () => {
      const showNotifications = schema.properties.showNotifications;
      expect(showNotifications.title).toBe('通知表示');
    });

    it('should have correct description for showNotifications', () => {
      const showNotifications = schema.properties.showNotifications;
      expect(showNotifications.description).toBe('データがサーバーに送信された時に通知を表示する');
    });

    it('should have default value true for showNotifications', () => {
      const showNotifications = schema.properties.showNotifications;
      expect(showNotifications.default).toBe(true);
    });
  });

  describe('existing settings validation', () => {
    it('should maintain all existing properties', () => {
      const expectedProperties = [
        'serverUrl',
        'userId',
        'userName',
        'batchSize',
        'retryAttempts',
        'maxNotifications'
      ];

      expectedProperties.forEach(prop => {
        expect(schema.properties).toHaveProperty(prop);
      });
    });

    it('should maintain correct schema structure', () => {
      expect(schema).toHaveProperty('title');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('type');
      expect(schema).toHaveProperty('properties');
      expect(schema.type).toBe('object');
    });
  });
});
