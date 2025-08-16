declare module 'react-window' {
  import * as React from 'react';
  import { ComponentType, CSSProperties, ReactNode } from 'react';

  export interface ListChildComponentProps<T = any> {
    index: number;
    style: CSSProperties;
    data?: T;
  }

  export interface ListProps {
    children: ComponentType<ListChildComponentProps>;
    height: number;
    itemCount: number;
    itemSize: number;
    itemData?: any;
    overscanCount?: number;
    width?: number | string;
  }

  export class FixedSizeList extends React.Component<ListProps> {}
  export const List: typeof FixedSizeList;
}