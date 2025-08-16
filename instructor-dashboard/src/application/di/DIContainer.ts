/**
 * Dependency Injection Container
 * Clean ArchitectureのDependency Inversion Principleを実現
 */

export type Factory<T> = () => T;
export type AsyncFactory<T> = () => Promise<T>;

export interface DIToken<T = any> {
  readonly name: string;
  readonly __type?: T; // 型安全性のためのファントムタイプ
}

export function createToken<T>(name: string): DIToken<T> {
  return { name };
}

/**
 * DI Container Implementation
 * Singleton pattern with lazy loading and circular dependency detection
 */
export class DIContainer {
  private static instance: DIContainer | null = null;
  
  private factories = new Map<string, Factory<any>>();
  private asyncFactories = new Map<string, AsyncFactory<any>>();
  private singletons = new Map<string, any>();
  private creating = new Set<string>();

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  static reset(): void {
    DIContainer.instance = null;
  }

  // Synchronous Registration
  register<T>(token: DIToken<T>, factory: Factory<T>): this {
    this.factories.set(token.name, factory);
    return this;
  }

  registerSingleton<T>(token: DIToken<T>, factory: Factory<T>): this {
    this.register(token, () => {
      if (!this.singletons.has(token.name)) {
        this.singletons.set(token.name, factory());
      }
      return this.singletons.get(token.name);
    });
    return this;
  }

  registerInstance<T>(token: DIToken<T>, instance: T): this {
    this.singletons.set(token.name, instance);
    this.register(token, () => instance);
    return this;
  }

  // Asynchronous Registration
  registerAsync<T>(token: DIToken<T>, factory: AsyncFactory<T>): this {
    this.asyncFactories.set(token.name, factory);
    return this;
  }

  registerSingletonAsync<T>(token: DIToken<T>, factory: AsyncFactory<T>): this {
    this.registerAsync(token, async () => {
      if (!this.singletons.has(token.name)) {
        this.singletons.set(token.name, await factory());
      }
      return this.singletons.get(token.name);
    });
    return this;
  }

  // Resolution
  get<T>(token: DIToken<T>): T {
    // 循環依存検出
    if (this.creating.has(token.name)) {
      throw new Error(`Circular dependency detected for ${token.name}`);
    }

    const factory = this.factories.get(token.name);
    if (!factory) {
      throw new Error(`No factory registered for ${token.name}`);
    }

    this.creating.add(token.name);
    try {
      const instance = factory();
      return instance;
    } finally {
      this.creating.delete(token.name);
    }
  }

  async getAsync<T>(token: DIToken<T>): Promise<T> {
    // 循環依存検出
    if (this.creating.has(token.name)) {
      throw new Error(`Circular dependency detected for ${token.name}`);
    }

    const asyncFactory = this.asyncFactories.get(token.name);
    if (asyncFactory) {
      this.creating.add(token.name);
      try {
        const instance = await asyncFactory();
        return instance;
      } finally {
        this.creating.delete(token.name);
      }
    }

    // 同期版にフォールバック
    return this.get(token);
  }

  // Optional Resolution
  tryGet<T>(token: DIToken<T>): T | null {
    try {
      return this.get(token);
    } catch {
      return null;
    }
  }

  async tryGetAsync<T>(token: DIToken<T>): Promise<T | null> {
    try {
      return await this.getAsync(token);
    } catch {
      return null;
    }
  }

  // Registration Check
  isRegistered<T>(token: DIToken<T>): boolean {
    return this.factories.has(token.name) || this.asyncFactories.has(token.name);
  }

  // Cleanup
  unregister<T>(token: DIToken<T>): this {
    this.factories.delete(token.name);
    this.asyncFactories.delete(token.name);
    this.singletons.delete(token.name);
    return this;
  }

  clear(): this {
    this.factories.clear();
    this.asyncFactories.clear();
    this.singletons.clear();
    this.creating.clear();
    return this;
  }

  // Debug Methods
  getRegisteredTokens(): string[] {
    const tokens = new Set<string>();
    this.factories.forEach((_, key) => tokens.add(key));
    this.asyncFactories.forEach((_, key) => tokens.add(key));
    return Array.from(tokens);
  }

  getLoadedSingletons(): string[] {
    const keys: string[] = [];
    this.singletons.forEach((_, key) => keys.push(key));
    return keys;
  }
}

/**
 * Convenience functions for global container
 */
export const getGlobalContainer = (): DIContainer => DIContainer.getInstance();

export const register = <T>(token: DIToken<T>, factory: Factory<T>): DIContainer => 
  getGlobalContainer().register(token, factory);

export const registerSingleton = <T>(token: DIToken<T>, factory: Factory<T>): DIContainer => 
  getGlobalContainer().registerSingleton(token, factory);

export const registerInstance = <T>(token: DIToken<T>, instance: T): DIContainer => 
  getGlobalContainer().registerInstance(token, instance);

export const get = <T>(token: DIToken<T>): T => 
  getGlobalContainer().get(token);

export const tryGet = <T>(token: DIToken<T>): T | null => 
  getGlobalContainer().tryGet(token);

/**
 * Decorator for automatic injection (optional)
 */
export function injectable<T extends new (...args: any[]) => any>(constructor: T) {
  return constructor;
}

export function inject<T>(token: DIToken<T>) {
  return function(target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    // Decorator logic for parameter injection
    // 実装は必要に応じて追加
  };
}

/**
 * Container Builder for fluent configuration
 */
export class ContainerBuilder {
  private container = new DIContainer();

  register<T>(token: DIToken<T>, factory: Factory<T>): this {
    this.container.register(token, factory);
    return this;
  }

  registerSingleton<T>(token: DIToken<T>, factory: Factory<T>): this {
    this.container.registerSingleton(token, factory);
    return this;
  }

  registerInstance<T>(token: DIToken<T>, instance: T): this {
    this.container.registerInstance(token, instance);
    return this;
  }

  registerAsync<T>(token: DIToken<T>, factory: AsyncFactory<T>): this {
    this.container.registerAsync(token, factory);
    return this;
  }

  registerSingletonAsync<T>(token: DIToken<T>, factory: AsyncFactory<T>): this {
    this.container.registerSingletonAsync(token, factory);
    return this;
  }

  build(): DIContainer {
    return this.container;
  }
}

export const createContainerBuilder = (): ContainerBuilder => new ContainerBuilder();