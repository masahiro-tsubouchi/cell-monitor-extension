
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { createLogger, handleSettingsError } from '../utils';

/**
 * チーム名バリデーション
 */
function validateTeamName(teamName: string): { isValid: boolean; error?: string } {
  const pattern = /^チーム([A-Z]|[1-9][0-9]?)$/;
  
  if (!teamName) {
    return { isValid: false, error: 'チーム名は必須です' };
  }
  
  if (!pattern.test(teamName)) {
    return { 
      isValid: false, 
      error: 'チーム名は「チームA-Z」または「チーム1-99」の形式で入力してください（例: チームA, チーム1, チーム10）' 
    };
  }
  
  return { isValid: true };
}

/**
 * 設定管理クラス
 * JupyterLabの設定レジストリと連携してCell Monitor拡張機能の設定を管理
 */
export class SettingsManager {
  private settings: ISettingRegistry.ISettings | null = null;
  private logger = createLogger('SettingsManager');

  constructor() {
    // コンストラクタは空
  }

  /**
   * 設定を初期化
   */
  async initialize(settingRegistry: ISettingRegistry, pluginId: string): Promise<void> {
    try {
      this.settings = await settingRegistry.load(pluginId);

      // 設定変更の監視とリアルタイムバリデーション
      this.settings.changed.connect(() => {
        this.validateAndUpdateSettings();
      });

      // リアルタイムバリデーション設定
      this.setupRealtimeValidation(settingRegistry, pluginId);

      // 初回設定読み込み
      this.updateSettingsFromRegistry();

      this.logger.info('Settings initialized successfully');
    } catch (error) {
      handleSettingsError(
        error instanceof Error ? error : new Error(String(error)),
        'Settings initialization',
        '設定の初期化に失敗しました。デフォルト設定で継続します。'
      );
    }
  }

  /**
   * 設定レジストリから設定を更新
   */
  private updateSettingsFromRegistry(): void {
    if (!this.settings) return;

    try {
      // 設定値を取得して内部状態を更新
      const serverUrl = this.settings.get('serverUrl').composite as string;
      const emailAddress = this.settings.get('emailAddress').composite as string;
      const userName = this.settings.get('userName').composite as string;
      const teamName = this.settings.get('teamName').composite as string;
      const retryAttempts = this.settings.get('retryAttempts').composite as number;
      const showNotifications = this.settings.get('showNotifications').composite as boolean;

      // チーム名のバリデーション
      if (teamName) {
        const validation = validateTeamName(teamName);
        if (!validation.isValid) {
          this.logger.warn('Invalid team name detected:', validation.error);
          // 警告を表示（UI側で処理）
        }
      }

      this.logger.debug('Settings updated from registry', {
        serverUrl: serverUrl || 'default',
        emailAddress: emailAddress || 'student001@example.com',
        userName: userName || 'Anonymous',
        teamName: teamName || 'チームA',
        retryAttempts,
        showNotifications
      });
    } catch (error) {
      this.logger.warn('Failed to update settings from registry:', error);
    }
  }

  /**
   * 現在の設定を取得
   */
  getSettings(): ISettingRegistry.ISettings | null {
    return this.settings;
  }

  /**
   * ユーザー情報を取得（バリデーション付き）
   */
  getUserInfo(): { emailAddress: string; userName: string; teamName: string } {
    if (!this.settings) {
      return {
        emailAddress: 'student001@example.com',
        userName: 'Anonymous',
        teamName: 'チームA'
      };
    }

    const settingEmailAddress = this.settings.get('emailAddress').composite as string;
    const settingUserName = this.settings.get('userName').composite as string;
    const settingTeamName = this.settings.get('teamName').composite as string;

    // チーム名のバリデーション
    let validatedTeamName = settingTeamName || 'チームA';
    if (settingTeamName) {
      const validation = validateTeamName(settingTeamName);
      if (!validation.isValid) {
        this.logger.warn('Invalid team name, using default:', validation.error);
        validatedTeamName = 'チームA'; // デフォルトにフォールバック
      }
    }

    return {
      emailAddress: settingEmailAddress || 'student001@example.com',
      userName: settingUserName || 'Anonymous',
      teamName: validatedTeamName
    };
  }

  /**
   * リアルタイムバリデーション設定
   */
  private setupRealtimeValidation(_settingRegistry: ISettingRegistry, _pluginId: string): void {
    // 設定エディタのDOMが変更された時の監視
    // JupyterLabの設定UIが表示されたときに入力フィールドを監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.enhanceTeamNameInput();
        }
      });
    });

    // DOM全体を監視（設定UIが動的に生成されるため）
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * チーム名入力フィールドを強化
   */
  private enhanceTeamNameInput(): void {
    // JupyterLabの設定UIでチーム名フィールドを探す
    const teamNameInputs = document.querySelectorAll('input[data-setting-path*="teamName"]');
    
    teamNameInputs.forEach((input) => {
      if (input instanceof HTMLInputElement && !input.dataset.enhanced) {
        input.dataset.enhanced = 'true';
        
        // リアルタイム入力監視
        input.addEventListener('input', (event) => {
          const target = event.target as HTMLInputElement;
          const value = target.value;
          
          if (value) {
            const validation = validateTeamName(value);
            
            if (validation.isValid) {
              // 有効な入力の場合
              target.style.borderColor = '#4caf50';
              target.style.backgroundColor = '#f0f8f0';
              this.clearValidationMessage(target);
            } else {
              // 無効な入力の場合
              target.style.borderColor = '#f44336';
              target.style.backgroundColor = '#fdf0f0';
              this.showValidationMessage(target, validation.error || '');
            }
          } else {
            // 空の場合はリセット
            target.style.borderColor = '';
            target.style.backgroundColor = '';
            this.clearValidationMessage(target);
          }
        });

        // フォーカス時のヘルプメッセージ
        input.addEventListener('focus', (event) => {
          const target = event.target as HTMLInputElement;
          this.showHelpMessage(target);
        });

        // フォーカス外れ時のクリーンアップ
        input.addEventListener('blur', (event) => {
          const target = event.target as HTMLInputElement;
          this.clearHelpMessage(target);
        });
      }
    });
  }

  /**
   * バリデーションメッセージを表示
   */
  private showValidationMessage(input: HTMLInputElement, message: string): void {
    this.clearValidationMessage(input);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'team-name-validation-error';
    errorDiv.style.cssText = `
      color: #f44336;
      font-size: 12px;
      margin-top: 4px;
      padding: 4px;
      background-color: #ffebee;
      border-radius: 4px;
      border-left: 3px solid #f44336;
    `;
    errorDiv.textContent = message;
    
    input.parentNode?.insertBefore(errorDiv, input.nextSibling);
  }

  /**
   * バリデーションメッセージをクリア
   */
  private clearValidationMessage(input: HTMLInputElement): void {
    const existingError = input.parentNode?.querySelector('.team-name-validation-error');
    if (existingError) {
      existingError.remove();
    }
  }

  /**
   * ヘルプメッセージを表示
   */
  private showHelpMessage(input: HTMLInputElement): void {
    this.clearHelpMessage(input);
    
    const helpDiv = document.createElement('div');
    helpDiv.className = 'team-name-help-message';
    helpDiv.style.cssText = `
      color: #1976d2;
      font-size: 12px;
      margin-top: 4px;
      padding: 4px;
      background-color: #e3f2fd;
      border-radius: 4px;
      border-left: 3px solid #1976d2;
    `;
    helpDiv.innerHTML = `
      <strong>チーム名の形式:</strong><br>
      • チームA〜Z (例: チームA, チームB)<br>
      • チーム1〜99 (例: チーム1, チーム10)
    `;
    
    input.parentNode?.insertBefore(helpDiv, input.nextSibling);
  }

  /**
   * ヘルプメッセージをクリア
   */
  private clearHelpMessage(input: HTMLInputElement): void {
    const existingHelp = input.parentNode?.querySelector('.team-name-help-message');
    if (existingHelp) {
      existingHelp.remove();
    }
  }

  /**
   * 設定変更時のバリデーションと更新
   */
  private validateAndUpdateSettings(): void {
    this.updateSettingsFromRegistry();
    
    // 設定UI更新のための少し遅延した処理
    setTimeout(() => {
      this.enhanceTeamNameInput();
    }, 100);
  }

  /**
   * チーム名バリデーションメソッド（外部からアクセス可能）
   */
  validateTeamName(teamName: string): { isValid: boolean; error?: string } {
    return validateTeamName(teamName);
  }

  /**
   * サーバーURLを取得
   */
  getServerUrl(): string {
    if (!this.settings) {
      return 'http://localhost:8000/api/v1/events';
    }
    return this.settings.get('serverUrl').composite as string || 'http://localhost:8000/api/v1/events';
  }

  /**
   * リトライ回数を取得
   */
  getRetryAttempts(): number {
    if (!this.settings) {
      return 3;
    }
    return this.settings.get('retryAttempts').composite as number || 3;
  }

  /**
   * 通知設定を取得
   */
  getNotificationSettings(): {
    showNotifications: boolean;
    animationEnabled: boolean;
  } {
    if (!this.settings) {
      return {
        showNotifications: true,
        animationEnabled: true
      };
    }
    
    const showNotifications = this.settings.get('showNotifications').composite as boolean;
    const animationEnabled = this.settings.get('animationEnabled')?.composite as boolean;
    
    return {
      showNotifications: showNotifications !== undefined ? showNotifications : true,
      animationEnabled: animationEnabled !== undefined ? animationEnabled : true
    };
  }
}
