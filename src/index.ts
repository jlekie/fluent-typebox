export * from './lib/type';
export * from '@sinclair/typebox';

import { FluentTypeBuilder } from './lib/type';
export const FluentType = new FluentTypeBuilder();
