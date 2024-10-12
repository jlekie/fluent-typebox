export * from './lib/type';
export * from '@sinclair/typebox';
export { Value } from '@sinclair/typebox/value';

import { FluentTypeBuilder } from './lib/type';
export const FluentType = new FluentTypeBuilder();
